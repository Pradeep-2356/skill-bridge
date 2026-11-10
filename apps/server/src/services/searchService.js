/**
 * Mentor discovery (SB1/US50, extended in SB2/US1, US3–7, US32, US35–41).
 *
 * 1. The query is sanitised and split into terms ("react, vue" → 2 terms).
 * 2. Matching skills come from discoveryService (partial match + MongoDB text index).
 * 3. Active mentors who teach a matching skill are loaded (never the searcher,
 *    never deactivated accounts), at most 500 candidates per search.
 * 4. Filters run on those candidates: category, minimum proficiency, availability
 *    window (converted to each mentor's time zone) and time-zone compatibility.
 * 5. Results are ranked, counted and paginated (max 50 per page).
 * Without a query the same pipeline lists every active mentor (mentor listing).
 */
import {
  ACCOUNT_STATUS,
  LIMITS,
  PROFICIENCY_LEVELS,
  TZ_COMPATIBLE_HOURS,
  splitSearchTerms,
  sanitizeSearchText,
  slotsToUtcIntervals,
  windowToUtcIntervals,
  intersectIntervals,
  totalIntervalMinutes,
  timeZoneGapHours,
} from '@skillbridge/shared';
import { Skill, User } from '../models/index.js';
import { pageMeta } from '../utils/respond.js';
import { serializeCategory } from '../utils/serializers.js';
import { findMatchingSkills, fallbackSuggestions } from './discoveryService.js';

const RANK = Object.fromEntries(PROFICIENCY_LEVELS.map((l) => [l.value, l.rank]));
const MIN_WINDOW_OVERLAP = 30;

/** Pure ranking score for one mentor (SB2/US3). Exported for unit tests. */
export function relevanceScore({
  matchScore = 0,
  bestRank = 0,
  sharedMinutes = 0,
  acceptingRequests = true,
  hasProfile = false,
}) {
  return (
    matchScore +
    bestRank * 5 +
    Math.round((Math.min(sharedMinutes, 180) / 180) * 10) +
    (acceptingRequests ? 5 : 0) +
    (hasProfile ? 2 : 0)
  );
}

/** Pure sort used by the API (SB2/US3). Ties always fall back to name, then id. */
export function sortMentors(items, sort) {
  const byName = (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  const comparators = {
    relevance: (a, b) => b.relevance - a.relevance || byName(a, b),
    name: byName,
    newest: (a, b) => new Date(b.memberSince) - new Date(a.memberSince) || byName(a, b),
    availability: (a, b) => b.sharedMinutes - a.sharedMinutes || byName(a, b),
  };
  return [...items].sort(comparators[sort] ?? comparators.relevance);
}

export async function searchMentors(viewerId, query, now = new Date()) {
  const { q = '', category, proficiency, days, from, to, tzCompatible, sort = 'relevance', page, limit } = query;
  const cleaned = sanitizeSearchText(q);
  const terms = splitSearchTerms(q);
  const appliedFilters = {
    ...(category ? { category } : {}),
    ...(proficiency ? { proficiency } : {}),
    ...(days?.length ? { days } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(tzCompatible ? { tzCompatible: true } : {}),
  };
  const baseMeta = { query: q, terms, sort, appliedFilters };
  const empty = async () => ({
    items: [],
    meta: { ...pageMeta({ page, limit, total: 0 }), ...baseMeta, relatedSkills: await fallbackSuggestions(terms) },
  });

  // Text was typed but nothing searchable is left (e.g. ".*") → no results, not "everyone".
  if (cleaned && !terms.length) return empty();

  const viewer = await User.findById(viewerId).select('timezone availability').lean();
  const viewerTz = viewer?.timezone ?? 'UTC';

  let matches = null; // Map<skillId, {score}> when searching by text
  if (terms.length) {
    matches = await findMatchingSkills(terms, { category });
    if (!matches.size) return empty();
  }

  const filter = { _id: { $ne: viewerId }, status: ACCOUNT_STATUS.ACTIVE, 'teachSkills.0': { $exists: true } };
  if (matches) filter['teachSkills.skill'] = { $in: [...matches.keys()] };
  else if (category) {
    const inCategory = await Skill.find({ category }).distinct('_id');
    filter['teachSkills.skill'] = { $in: inCategory };
  }

  const users = await User.find(filter)
    .select('name headline avatar timezone teachSkills availability acceptingRequests createdAt bio')
    .populate({
      path: 'teachSkills.skill',
      select: 'name category normalizedName aliases',
      populate: { path: 'category', select: 'name slug icon description' },
    })
    .limit(LIMITS.SEARCH_CANDIDATES_MAX)
    .lean();

  const minRank = proficiency ? RANK[proficiency] : 0;
  const windowIntervals = days?.length || from || to ? windowToUtcIntervals({ days, from, to }, viewerTz, now) : null;
  const viewerIntervals = slotsToUtcIntervals(viewer?.availability ?? [], viewerTz, now);

  const items = [];
  for (const u of users) {
    const entries = u.teachSkills.filter((t) => t.skill);
    const relevant = entries.filter(
      (t) =>
        (!matches || matches.has(String(t.skill._id))) &&
        (!category || String(t.skill.category?._id) === String(category)) &&
        RANK[t.proficiency] >= minRank,
    );
    if (!relevant.length) continue;

    const mentorIntervals = slotsToUtcIntervals(u.availability ?? [], u.timezone, now);
    let windowMinutes = null;
    if (windowIntervals) {
      windowMinutes = totalIntervalMinutes(intersectIntervals(windowIntervals, mentorIntervals));
      if (windowMinutes < MIN_WINDOW_OVERLAP) continue;
    }
    const tzGapHours = timeZoneGapHours(viewerTz, u.timezone, now);
    if (tzCompatible && tzGapHours > TZ_COMPATIBLE_HOURS) continue;

    const sharedMinutes = totalIntervalMinutes(intersectIntervals(viewerIntervals, mentorIntervals));
    const matchScore = matches ? Math.max(...relevant.map((t) => matches.get(String(t.skill._id)).score)) : 0;
    const ordered = [...relevant].sort(
      (a, b) =>
        (matches ? matches.get(String(b.skill._id)).score - matches.get(String(a.skill._id)).score : 0) ||
        RANK[b.proficiency] - RANK[a.proficiency],
    );
    const relevantIds = new Set(relevant.map((t) => String(t.skill._id)));
    const acceptingRequests = u.acceptingRequests !== false;

    items.push({
      id: String(u._id),
      name: u.name,
      headline: u.headline ?? '',
      avatarUrl: u.avatar?.url ?? null,
      timezone: u.timezone,
      tzGapHours,
      matchedSkills: ordered.slice(0, matches ? ordered.length : 3).map((t) => ({
        id: String(t.skill._id),
        name: t.skill.name,
        proficiency: t.proficiency,
        category: serializeCategory(t.skill.category),
      })),
      otherSkills: entries
        .filter((t) => !relevantIds.has(String(t.skill._id)))
        .slice(0, 3)
        .map((t) => t.skill.name),
      teachSkillsCount: entries.length,
      availabilitySlots: u.availability?.length ?? 0,
      sharedMinutes,
      windowMinutes,
      acceptingRequests,
      memberSince: u.createdAt,
      relevance: relevanceScore({
        matchScore,
        bestRank: Math.max(...relevant.map((t) => RANK[t.proficiency])),
        sharedMinutes,
        acceptingRequests,
        hasProfile: Boolean(u.headline && u.bio),
      }),
    });
  }

  const sorted = sortMentors(items, sort);
  const total = sorted.length;
  const pageItems = sorted.slice((page - 1) * limit, page * limit);
  const meta = { ...pageMeta({ page, limit, total }), ...baseMeta };
  if (!total) meta.relatedSkills = await fallbackSuggestions(terms);
  return { items: pageItems, meta };
}
