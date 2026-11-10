/**
 * Simplified, explainable matchmaking rules (SB2/US17–24, US42, US43, US46).
 *
 * Pure functions only: no database, no clock except the `now` passed in, so every
 * rule can be unit-tested and the same inputs always give the same ranking.
 * This is a transparent points formula, not machine learning – see MATCH_WEIGHTS.
 *
 *   Skill fit        35  mentor teaches the exact skill (required)
 *   Level fit        20  mentor above the wanted level · 12 equal · below = not a candidate
 *   Shared time      25  × weekly overlap (capped at 180 min) ÷ 180
 *   Time-zone gap    10  ≤3 h: 10 · ≤6 h: 6 · ≤9 h: 3 · more: 0
 *   Skill exchange   10  mentor wants to learn something the learner teaches
 */
import {
  ACCOUNT_STATUS,
  MATCH_WEIGHTS,
  PROFICIENCY_LEVELS,
  LEARNING_LEVELS,
  MATCH_FAILURE_REASONS,
  SLOT_LEAD_HOURS,
  SLOT_HORIZON_DAYS,
  slotsToUtcIntervals,
  intersectIntervals,
  totalIntervalMinutes,
  timeZoneGapHours,
  nextSlotIn,
} from '@skillbridge/shared';

const TEACH_RANK = Object.fromEntries(PROFICIENCY_LEVELS.map((l) => [l.value, l.rank]));
const LEARN_RANK = Object.fromEntries(LEARNING_LEVELS.map((l) => [l.value, l.rank]));
const LEVEL_LABEL = Object.fromEntries(PROFICIENCY_LEVELS.map((l) => [l.value, l.label]));

const idOf = (v) => String(v?._id ?? v?.id ?? v);

/** "3 h 30 min" */
export function describeMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function levelPoints(mentorLevel, wantedLevel) {
  const mentor = TEACH_RANK[mentorLevel] ?? 0;
  const wanted = LEARN_RANK[wantedLevel] ?? 1;
  if (mentor > wanted) return MATCH_WEIGHTS.level;
  if (mentor === wanted) return MATCH_WEIGHTS.levelEqual;
  return null; // below the wanted level
}

export function availabilityPoints(sharedMinutes) {
  const capped = Math.min(Math.max(sharedMinutes, 0), MATCH_WEIGHTS.availabilityCapMinutes);
  return Math.round((MATCH_WEIGHTS.availability * capped) / MATCH_WEIGHTS.availabilityCapMinutes);
}

export function timezonePoints(gapHours) {
  if (gapHours <= 3) return MATCH_WEIGHTS.timezone;
  if (gapHours <= 6) return 6;
  if (gapHours <= 9) return 3;
  return 0;
}

/** Skills the mentor wants to learn that the learner can teach (SB2/US10, US18). */
export function exchangeSkills(learner, mentor) {
  const learnerTeaches = new Set((learner.teachSkills ?? []).map((t) => idOf(t.skill)));
  return (mentor.learnSkills ?? []).filter((l) => l.skill && learnerTeaches.has(idOf(l.skill)));
}

/**
 * Scores one mentor for one learner and skill. Returns why they are not a
 * candidate (`code`) or the score breakdown with plain-English reasons.
 * `requireLevel: false` is used for direct requests, where the learner chose the mentor.
 */
export function evaluateCandidate({
  learner,
  mentor,
  skillId,
  skillName,
  wantedLevel = 'beginner',
  now = new Date(),
  requireLevel = true,
}) {
  if (idOf(mentor) === idOf(learner)) return { eligible: false, code: 'SELF' };
  const entry = (mentor.teachSkills ?? []).find((t) => idOf(t.skill) === String(skillId));
  if (!entry) return { eligible: false, code: 'NOT_TEACHING' };
  if (mentor.status && mentor.status !== ACCOUNT_STATUS.ACTIVE) return { eligible: false, code: 'INACTIVE' };
  if (mentor.acceptingRequests === false) return { eligible: false, code: 'NOT_ACCEPTING' };
  if (!mentor.availability?.length) return { eligible: false, code: 'NO_AVAILABILITY' };

  const level = levelPoints(entry.proficiency, wantedLevel);
  if (level === null && requireLevel) return { eligible: false, code: 'LEVEL_TOO_LOW' };

  const learnerIntervals = slotsToUtcIntervals(learner.availability ?? [], learner.timezone, now);
  const mentorIntervals = slotsToUtcIntervals(mentor.availability, mentor.timezone, now);
  const sharedIntervals = intersectIntervals(learnerIntervals, mentorIntervals);
  const sharedMinutes = totalIntervalMinutes(sharedIntervals);
  const tzGapHours = timeZoneGapHours(learner.timezone ?? 'UTC', mentor.timezone ?? 'UTC', now);
  const exchange = exchangeSkills(learner, mentor);

  const score = {
    skill: MATCH_WEIGHTS.skill,
    level: level ?? 0,
    availability: availabilityPoints(sharedMinutes),
    timezone: timezonePoints(tzGapHours),
    exchange: exchange.length ? MATCH_WEIGHTS.exchange : 0,
  };
  score.total = score.skill + score.level + score.availability + score.timezone + score.exchange;

  const wantedLabel = LEVEL_LABEL[wantedLevel] ?? wantedLevel;
  const reasons = [
    `Teaches ${skillName ?? 'this skill'} at ${LEVEL_LABEL[entry.proficiency]} level` +
      (level === MATCH_WEIGHTS.level
        ? ` (above the ${wantedLabel.toLowerCase()} level you want)`
        : level === MATCH_WEIGHTS.levelEqual
          ? ' (the level you want)'
          : ` (below the ${wantedLabel.toLowerCase()} level you want)`),
    sharedMinutes ? `${describeMinutes(sharedMinutes)} of shared free time each week` : 'No overlapping free time yet',
    tzGapHours ? `${describeMinutes(Math.round(tzGapHours * 60))} time difference` : 'Same time zone',
  ];
  if (exchange.length) {
    const names = exchange.map((l) => l.skill?.name).filter(Boolean);
    reasons.push(
      `Wants to learn ${names.length ? names.join(', ') : 'a skill'}, which you teach – you could swap skills`,
    );
  }

  const opts = { now, leadHours: SLOT_LEAD_HOURS, horizonDays: SLOT_HORIZON_DAYS };
  const shared = nextSlotIn(sharedIntervals, opts);
  const fallback = shared ? null : nextSlotIn(mentorIntervals, opts);
  const proposedSlot = shared ? { ...shared, shared: true } : fallback ? { ...fallback, shared: false } : null;

  return {
    eligible: true,
    mentorLevel: entry.proficiency,
    score,
    reasons,
    sharedMinutes,
    tzGapHours,
    exchange,
    proposedSlot,
  };
}

/** Best first: total score, then more shared time, then name, then id (SB2/US22). */
export function rankCandidates(evaluated) {
  return [...evaluated].sort(
    (a, b) =>
      b.score.total - a.score.total ||
      b.sharedMinutes - a.sharedMinutes ||
      (a.mentor.name ?? '').localeCompare(b.mentor.name ?? '') ||
      idOf(a.mentor).localeCompare(idOf(b.mentor)),
  );
}

/**
 * Picks the reason shown when automatic matching finds nobody (SB2/US46).
 * `results` are evaluateCandidate outputs; `alreadyRequested` is a Set of mentor ids.
 */
export function explainNoMatch(results, alreadyRequested = new Set()) {
  const teaching = results.filter((r) => r.code !== 'NOT_TEACHING' && r.code !== 'SELF');
  if (!teaching.length) return 'NO_MENTORS_FOR_SKILL';
  const reachable = teaching.filter((r) => !['INACTIVE', 'NOT_ACCEPTING', 'NO_AVAILABILITY'].includes(r.code));
  if (!reachable.length) return 'NO_ACTIVE_MENTORS';
  const levelOk = reachable.filter((r) => r.code !== 'LEVEL_TOO_LOW');
  if (!levelOk.length) return 'LEVEL_TOO_HIGH';
  const requested = (r) => alreadyRequested.has(idOf(r.mentor));
  const fresh = levelOk.filter((r) => !requested(r));
  if (!fresh.length) return 'ALREADY_REQUESTED';
  // Everyone who shares time with the learner has already been asked.
  if (!fresh.some((r) => r.sharedMinutes > 0) && levelOk.some((r) => requested(r) && r.sharedMinutes > 0)) {
    return 'ALREADY_REQUESTED';
  }
  return 'NO_COMMON_AVAILABILITY';
}

export function failureFor(code) {
  const reason = MATCH_FAILURE_REASONS[code] ?? MATCH_FAILURE_REASONS.PROCESSING_FAILED;
  return { code, reason: reason.message, nextStep: reason.nextStep };
}
