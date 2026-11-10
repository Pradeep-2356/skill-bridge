/**
 * Matchmaking that reads and writes MongoDB (SB2/US17–24, US29, US43, US45, US46, US48–50).
 * The scoring rules themselves live in ./scoring.js and are pure.
 *
 * - getSuggestions(): ranked mentors for the learner's learning skills (the /matches page).
 * - processRequest(): run by the queue worker for each queued request. Direct requests
 *   get a score and a proposed time; automatic requests pick the best mentor or fail
 *   with a reason. Calling it twice for the same request changes nothing (idempotent).
 */
import {
  ACCOUNT_STATUS,
  NOTIFICATION_TYPES,
  REQUEST_EXPIRY_DAYS,
  REQUEST_MODES,
  REQUEST_STATUS,
  MATCH_FAILURE_REASONS,
  LIMITS,
} from '@skillbridge/shared';
import { MatchRequest, Skill, User } from '../../models/index.js';
import { runtime } from '../../config/runtime.js';
import { AppError } from '../../utils/AppError.js';
import { serializeCategory } from '../../utils/serializers.js';
import { notify } from '../notificationService.js';
import { evaluateCandidate, rankCandidates, explainNoMatch, failureFor } from './scoring.js';

const PERSON_FIELDS = 'name headline avatar timezone availability teachSkills learnSkills acceptingRequests status';
const DAY_MS = 86_400_000;

export const loadPerson = (userId) =>
  User.findById(userId)
    .select(PERSON_FIELDS)
    .populate('learnSkills.skill', 'name')
    .populate('teachSkills.skill', 'name')
    .lean();

/** Every other member who teaches the skill, whatever their status (needed to explain "no match"). */
const loadTeachers = (skillId, learnerId) =>
  User.find({ 'teachSkills.skill': skillId, _id: { $ne: learnerId } })
    .select(PERSON_FIELDS)
    .populate('learnSkills.skill', 'name')
    .lean();

const activeRequestMentors = async (learnerId, skillId) =>
  new Set(
    (
      await MatchRequest.find({ learner: learnerId, skill: skillId, active: true, mentor: { $ne: null } }).distinct(
        'mentor',
      )
    ).map(String),
  );

const card = (u) => ({
  id: String(u._id),
  name: u.name,
  headline: u.headline ?? '',
  avatarUrl: u.avatar?.url ?? null,
  timezone: u.timezone,
});

/** Scores every teacher of one skill for this learner. */
async function evaluateSkill(learner, skill, wantedLevel, now) {
  const teachers = await loadTeachers(skill._id, learner._id);
  return teachers.map((mentor) => ({
    mentor,
    ...evaluateCandidate({ learner, mentor, skillId: String(skill._id), skillName: skill.name, wantedLevel, now }),
  }));
}

/**
 * Ranked mentor suggestions (SB2/US17–23, US43, US46). Mentors already requested
 * are still shown, marked with the open request, so the learner understands why.
 */
export async function getSuggestions(learnerId, { skillId, limit = LIMITS.MATCH_SUGGESTIONS_MAX }, now = new Date()) {
  const learner = await loadPerson(learnerId);
  if (!learner) throw AppError.notFound('Account not found.');
  const learnEntries = learner.learnSkills.filter((l) => l.skill);
  const learnSkills = learnEntries.map((l) => ({
    id: String(l.skill._id),
    name: l.skill.name,
    preferredLevel: l.preferredLevel,
  }));
  const base = { learnSkills, hasAvailability: learner.availability.length > 0 };

  let targets;
  if (skillId) {
    const skill = await Skill.findById(skillId).select('name category').lean();
    if (!skill) throw AppError.notFound('That skill does not exist.');
    const entry = learnEntries.find((l) => String(l.skill._id) === String(skillId));
    targets = [{ skill, wantedLevel: entry?.preferredLevel ?? 'beginner' }];
  } else {
    if (!learnEntries.length) return { ...base, matches: [], reason: failureFor('NO_LEARN_SKILLS') };
    targets = learnEntries.map((l) => ({ skill: l.skill, wantedLevel: l.preferredLevel }));
  }

  const skillDocs = await Skill.find({ _id: { $in: targets.map((t) => t.skill._id) } })
    .populate('category', 'name slug icon description')
    .lean();
  const skillById = new Map(skillDocs.map((s) => [String(s._id), s]));

  const matches = [];
  let firstFailure = null;
  for (const { skill, wantedLevel } of targets) {
    const results = await evaluateSkill(learner, skill, wantedLevel, now);
    const requested = await MatchRequest.find({
      learner: learner._id,
      skill: skill._id,
      active: true,
      mentor: { $ne: null },
    })
      .select('mentor status')
      .lean();
    const openByMentor = new Map(requested.map((r) => [String(r.mentor), r]));
    const eligible = results.filter((r) => r.eligible);
    if (!eligible.length && !firstFailure) firstFailure = explainNoMatch(results, new Set(openByMentor.keys()));
    for (const r of eligible) {
      const open = openByMentor.get(String(r.mentor._id));
      const fullSkill = skillById.get(String(skill._id)) ?? skill;
      matches.push({
        mentor: card(r.mentor),
        skill: { id: String(skill._id), name: skill.name, category: serializeCategory(fullSkill.category) },
        wantedLevel,
        mentorLevel: r.mentorLevel,
        score: r.score,
        reasons: r.reasons,
        sharedMinutes: r.sharedMinutes,
        tzGapHours: r.tzGapHours,
        proposedSlot: r.proposedSlot,
        existingRequest: open ? { id: String(open._id), status: open.status } : null,
        _sort: r,
      });
    }
  }

  const ranked = rankCandidates(matches.map((m) => ({ ...m._sort, mentor: m.mentor, ref: m })))
    .map((r) => r.ref)
    .slice(0, limit)
    .map(({ _sort, ...m }) => m);
  return {
    ...base,
    matches: ranked,
    reason: ranked.length ? null : failureFor(firstFailure ?? 'NO_MENTORS_FOR_SKILL'),
  };
}

// ───────────────────────── queue processing ─────────────────────────

function pushHistory(request, status, by, note) {
  request.status = status;
  request.history.push({ status, by, at: new Date(), ...(note ? { note } : {}) });
}

async function failRequest(request, code, note) {
  request.failure = failureFor(code);
  pushHistory(request, REQUEST_STATUS.FAILED, 'system', note ?? request.failure.reason);
  await request.save();
  await notify(request.learner, {
    type: NOTIFICATION_TYPES.MATCH_FAILED,
    title: 'We could not complete your request',
    body: `${request.failure.reason} ${request.failure.nextStep}`,
    link: `/requests/${request._id}`,
    matchRequest: request._id,
  });
}

async function deliver(request, evaluation, now, { learner, mentor, skill }) {
  request.mentor = mentor._id;
  request.score = evaluation.score;
  request.reasons = evaluation.reasons;
  request.sharedMinutes = evaluation.sharedMinutes;
  request.proposedSlot = evaluation.proposedSlot;
  request.failure = null;
  request.deliveredAt = now;
  request.expiresAt = new Date(now.getTime() + REQUEST_EXPIRY_DAYS * DAY_MS);
  pushHistory(request, REQUEST_STATUS.PENDING, 'system');
  await request.save();

  await notify(mentor._id, {
    type: NOTIFICATION_TYPES.REQUEST_RECEIVED,
    title: `${learner.name} wants to learn ${skill.name} with you`,
    body: request.message ? `“${request.message.slice(0, 140)}”` : 'Open the request to accept or decline it.',
    link: `/requests/${request._id}`,
    matchRequest: request._id,
  });
  if (request.mode === REQUEST_MODES.AUTO) {
    await notify(learner._id, {
      type: NOTIFICATION_TYPES.MATCH_FOUND,
      title: `We matched you with ${mentor.name} for ${skill.name}`,
      body: `Match score ${evaluation.score.total}/100. Waiting for ${mentor.name} to accept.`,
      link: `/requests/${request._id}`,
      matchRequest: request._id,
    });
  }
}

/**
 * Processes one queued request (SB2/US49, US50 – simplified: runs inside the API process).
 * Throws only for unexpected errors, so the queue retries the message.
 */
export async function processRequest(requestId, now = new Date()) {
  const request = await MatchRequest.findById(requestId);
  if (!request || request.status !== REQUEST_STATUS.QUEUED) return { skipped: true };

  const rate = runtime().config.MATCH_FAILURE_RATE ?? 0;
  if (rate > 0 && Math.random() < rate) throw new Error('Simulated temporary matching failure (MATCH_FAILURE_RATE)');

  const [learner, skill] = await Promise.all([
    loadPerson(request.learner),
    Skill.findById(request.skill).select('name').lean(),
  ]);
  if (!learner || learner.status !== ACCOUNT_STATUS.ACTIVE || !skill) {
    pushHistory(request, REQUEST_STATUS.CANCELLED, 'system', 'The learner account or skill is no longer available');
    await request.save();
    return { status: request.status };
  }

  if (request.mode === REQUEST_MODES.DIRECT) {
    const mentor = await loadPerson(request.mentor);
    const evaluation = mentor
      ? evaluateCandidate({
          learner,
          mentor,
          skillId: String(skill._id),
          skillName: skill.name,
          wantedLevel: request.learnerLevel,
          now,
          requireLevel: false,
        })
      : { eligible: false, code: 'INACTIVE' };
    if (!evaluation.eligible) {
      await failRequest(request, 'MENTOR_UNAVAILABLE');
      return { status: request.status };
    }
    await deliver(request, evaluation, now, { learner, mentor, skill });
    return { status: request.status };
  }

  // Automatic matching: best eligible mentor who shares time and has no open request with us.
  const results = (await evaluateSkill(learner, skill, request.learnerLevel, now)).filter(Boolean);
  const requested = await activeRequestMentors(learner._id, skill._id);
  const usable = rankCandidates(
    results.filter((r) => r.eligible && r.sharedMinutes > 0 && !requested.has(String(r.mentor._id))),
  );
  for (const best of usable) {
    try {
      await deliver(request, best, now, { learner, mentor: best.mentor, skill });
      return { status: request.status };
    } catch (err) {
      if (err?.code !== 11000) throw err; // someone else created the same request meanwhile – try the next mentor
      request.mentor = null;
      request.status = REQUEST_STATUS.QUEUED;
      request.history.pop();
    }
  }
  const code = usable.length ? 'ALREADY_REQUESTED' : explainNoMatch(results, requested);
  await failRequest(request, code);
  return { status: request.status };
}

/** Called by the queue when a message failed too often (dead-letter). */
export async function onDeadMessage({ body, lastError }) {
  const request = await MatchRequest.findById(body?.requestId);
  if (!request || request.status !== REQUEST_STATUS.QUEUED) return;
  await failRequest(
    request,
    'PROCESSING_FAILED',
    `Gave up after repeated errors: ${lastError ?? 'unknown error'}`.slice(0, 300),
  );
}

export { MATCH_FAILURE_REASONS };
