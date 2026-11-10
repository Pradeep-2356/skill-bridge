/**
 * Skill discovery (SB2/US1–3, US32–35, US41, US42).
 * Finds catalogue skills for one or more search terms by combining:
 *  1. partial, case-insensitive matching on the normalised name and aliases
 *     (regex with escaped input, so "c++" or ".*" are literal), and
 *  2. MongoDB full-text search on name, aliases and description (the `skill_text` index),
 *     which also catches single words inside longer phrases ("java spring boot" → Java).
 * Each skill gets a relevance score; the best score across all terms is kept.
 */
import {
  ACCOUNT_STATUS,
  SKILL_STATUS,
  LIMITS,
  escapeRegex,
  skillMatchScore,
  normalizeSkillName,
} from '@skillbridge/shared';
import mongoose from 'mongoose';
import { Skill, User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { serializeSkill } from '../utils/serializers.js';

const TEXT_MATCH_SCORE = 30;
const CATEGORY_POPULATE = { path: 'category', select: 'name slug icon description' };

/** Removes characters MongoDB $text treats as operators. */
const textQuery = (terms) => terms.join(' ').replace(/["-]/g, ' ').trim();

/**
 * Returns Map<skillId, { skill, score, term }> for the given normalised terms.
 * `statuses` limits the catalogue (search includes pending custom skills people already teach).
 */
export async function findMatchingSkills(terms, { category, statuses } = {}) {
  const found = new Map();
  if (!terms.length) return found;
  const base = {};
  if (category) base.category = category;
  if (statuses) base.status = { $in: statuses };

  const regexes = terms.map((t) => new RegExp(escapeRegex(t), 'i'));
  const partial = await Skill.find({
    ...base,
    $or: regexes.flatMap((re) => [{ normalizedName: re }, { aliases: re }]),
  })
    .populate(CATEGORY_POPULATE)
    .limit(200)
    .lean();

  const consider = (skill, extra = 0) => {
    const best = terms.reduce(
      (acc, term) => {
        const score = skillMatchScore(skill, term);
        return score > acc.score ? { score, term } : acc;
      },
      { score: extra, term: terms[0] },
    );
    if (best.score <= 0) return;
    const key = String(skill._id);
    if (!found.has(key) || found.get(key).score < best.score) found.set(key, { skill, ...best });
  };
  partial.forEach((s) => consider(s));

  const text = textQuery(terms);
  if (text) {
    const textHits = await Skill.find({ ...base, $text: { $search: text } }, { score: { $meta: 'textScore' } })
      .populate(CATEGORY_POPULATE)
      .limit(50)
      .lean();
    textHits.forEach((s) => consider(s, TEXT_MATCH_SCORE));
  }
  return found;
}

/** How many active members teach each of these skills. */
export async function mentorCounts(skillIds) {
  if (!skillIds.length) return new Map();
  const ids = skillIds.map((id) => new mongoose.Types.ObjectId(String(id)));
  const rows = await User.aggregate([
    { $match: { status: ACCOUNT_STATUS.ACTIVE, 'teachSkills.skill': { $in: ids } } },
    { $unwind: '$teachSkills' },
    { $match: { 'teachSkills.skill': { $in: ids } } },
    { $group: { _id: '$teachSkills.skill', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

const withCounts = async (skills) => {
  const counts = await mentorCounts(skills.map((s) => s._id));
  return skills.map((s) => ({ ...serializeSkill(s), mentorCount: counts.get(String(s._id)) ?? 0 }));
};

/**
 * Search-box suggestions (SB2/US2): up to 8 approved skills, best matches first,
 * each with how many mentors teach it so learners can see where help exists.
 */
export async function suggestSkills({ q, limit = LIMITS.SUGGESTIONS_MAX }) {
  const terms = [normalizeSkillName(q)].filter(Boolean);
  const found = await findMatchingSkills(terms, { statuses: [SKILL_STATUS.APPROVED] });
  const ranked = [...found.values()]
    .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name))
    .slice(0, limit)
    .map((f) => f.skill);
  return withCounts(ranked);
}

/** Other approved skills in the same category, most-taught first (SB2/US2). */
export async function relatedSkills(skillId, limit = 6) {
  const skill = await Skill.findById(skillId).lean();
  if (!skill) throw AppError.notFound('That skill does not exist.');
  const siblings = await Skill.find({
    category: skill.category,
    status: SKILL_STATUS.APPROVED,
    _id: { $ne: skill._id },
  })
    .populate(CATEGORY_POPULATE)
    .lean();
  const counts = await mentorCounts(siblings.map((s) => s._id));
  return siblings
    .map((s) => ({ ...serializeSkill(s), mentorCount: counts.get(String(s._id)) ?? 0 }))
    .sort((a, b) => b.mentorCount - a.mentorCount || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/**
 * Ideas for an empty result (SB2/US35): skills that share a word with the query,
 * otherwise the most-taught skills on the platform.
 */
export async function fallbackSuggestions(terms, limit = 6) {
  const words = terms
    .flatMap((t) => t.split(/\s+/))
    .filter((w) => w.length >= 3)
    .map((w) => w.slice(0, 3));
  let skills = [];
  if (words.length) {
    const found = await findMatchingSkills([...new Set(words)], { statuses: [SKILL_STATUS.APPROVED] });
    skills = [...found.values()].map((f) => f.skill);
  }
  let list = await withCounts(skills);
  list = list.filter((s) => s.mentorCount > 0);
  if (list.length < limit) {
    const popular = await User.aggregate([
      { $match: { status: ACCOUNT_STATUS.ACTIVE } },
      { $unwind: '$teachSkills' },
      { $group: { _id: '$teachSkills.skill', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: limit * 2 },
    ]);
    const extra = await Skill.find({ _id: { $in: popular.map((p) => p._id) }, status: SKILL_STATUS.APPROVED })
      .populate(CATEGORY_POPULATE)
      .lean();
    const byId = new Map(popular.map((p) => [String(p._id), p.count]));
    const seen = new Set(list.map((s) => s.id));
    extra
      .map((s) => ({ ...serializeSkill(s), mentorCount: byId.get(String(s._id)) ?? 0 }))
      .sort((a, b) => b.mentorCount - a.mentorCount || a.name.localeCompare(b.name))
      .forEach((s) => !seen.has(s.id) && list.push(s));
  }
  return list.slice(0, limit);
}
