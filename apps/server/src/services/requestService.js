/**
 * Learning request lifecycle (SB2/US12–16, US23–28, US30, US31, US44, US45).
 *
 * Every status change goes through `transition()`, which checks the state machine
 * in @skillbridge/shared and WHO is asking, so the API – not the UI – decides what
 * is allowed. Requests are created as `queued` and handed to the local queue; the
 * worker (matchingService.processRequest) turns them into `pending` or `failed`.
 */
import {
  ACCOUNT_STATUS,
  ERROR_CODES,
  NOTIFICATION_TYPES,
  REQUEST_MODES,
  REQUEST_STATUS,
  REQUEST_STATUS_GROUPS,
  SESSION_DURATION_MINUTES,
  SESSION_SOURCE,
  SESSION_STATUS,
  SLOT_LEAD_HOURS,
  canTransition,
  findTransition,
} from '@skillbridge/shared';
import mongoose from 'mongoose';
import { MatchRequest, Session, Skill, User } from '../models/index.js';
import { runtime } from '../config/runtime.js';
import { AppError } from '../utils/AppError.js';
import { pageMeta } from '../utils/respond.js';
import { serializeRequest, roleIn } from '../utils/requestSerializer.js';
import { notify } from './notificationService.js';
import { evaluateCandidate } from './matching/scoring.js';
import { loadPerson } from './matching/matchingService.js';

export const QUEUE_NAME = 'match-requests';

const POPULATE = [
  { path: 'learner', select: 'name headline avatar timezone' },
  { path: 'mentor', select: 'name headline avatar timezone' },
  { path: 'skill', select: 'name category', populate: { path: 'category', select: 'name slug icon description' } },
  { path: 'session', select: 'startsAt durationMinutes status' },
];

const invalidTransition = (from, to) =>
  AppError.conflict(
    ERROR_CODES.INVALID_TRANSITION,
    `A ${from} request cannot be ${to === 'queued' ? 'retried' : to}.`,
    {
      details: { from, to },
    },
  );

/** Applies one state-machine step after checking it is allowed for this actor. */
function transition(request, to, actor, note) {
  const from = request.status;
  if (!findTransition(from, to)) throw invalidTransition(from, to);
  if (!canTransition(from, to, actor)) throw AppError.forbidden('You cannot make that change to this request.');
  request.status = to;
  request.history.push({ status: to, by: actor, at: new Date(), ...(note ? { note } : {}) });
}

async function enqueue(request) {
  const { queue, worker } = runtime();
  await queue.send(QUEUE_NAME, { requestId: String(request._id) });
  worker?.kick();
}

async function loadSerialized(id, viewerId, viewerRole) {
  const doc = await MatchRequest.findById(id).populate(POPULATE).lean();
  return serializeRequest(doc, viewerId, viewerRole);
}

/** "Mon 16 Nov, 18:00 (Asia/Kolkata)" – shown in each person's own time zone (SB2/US31). */
export function formatInZone(date, timeZone = 'UTC') {
  const text = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return `${text} (${timeZone.replace(/_/g, ' ')})`;
}

const isDuplicateKey = (err) => err?.code === 11000;
const duplicateError = (existingId) =>
  AppError.conflict(
    ERROR_CODES.DUPLICATE_REQUEST,
    'You already have an open request with this mentor for this skill.',
    {
      details: existingId ? { requestId: String(existingId) } : undefined,
    },
  );

// ───────────────────────── expiry (SB2/US44) ─────────────────────────

/** Expires pending requests past their date. Run by the 60-second job and before reads. */
export async function expireStaleRequests(now = new Date(), extraFilter = {}) {
  const stale = await MatchRequest.find({ status: REQUEST_STATUS.PENDING, expiresAt: { $lte: now }, ...extraFilter })
    .populate('skill', 'name')
    .populate('learner', 'name')
    .populate('mentor', 'name');
  for (const r of stale) {
    transition(r, REQUEST_STATUS.EXPIRED, 'system', 'No reply within 7 days');
    await r.save();
    const skill = r.skill?.name ?? 'your skill';
    await notify(r.learner._id, {
      type: NOTIFICATION_TYPES.REQUEST_EXPIRED,
      title: `Your request to ${r.mentor?.name ?? 'a mentor'} expired`,
      body: `No reply came within 7 days for ${skill}. You can retry or choose another mentor.`,
      link: `/requests/${r._id}`,
      matchRequest: r._id,
    });
    await notify(r.mentor?._id, {
      type: NOTIFICATION_TYPES.REQUEST_EXPIRED,
      title: `${r.learner?.name ?? 'A learner'}'s request expired`,
      body: `The request to learn ${skill} was closed after 7 days without a reply.`,
      link: `/requests/${r._id}`,
      matchRequest: r._id,
    });
  }
  return stale.length;
}

// ───────────────────────── create (SB2/US12, US23, US24, US43) ─────────────────────────

export async function createRequest(learnerId, { mode, mentorId, skillId, message = '' }) {
  const [learner, skill] = await Promise.all([
    User.findById(learnerId).select('learnSkills status').lean(),
    Skill.findById(skillId).select('name').lean(),
  ]);
  if (!skill) throw AppError.validation({ skillId: 'That skill does not exist' });
  const learnEntry = learner.learnSkills.find((l) => String(l.skill) === String(skillId));

  if (mode === REQUEST_MODES.DIRECT) {
    if (String(mentorId) === String(learnerId)) {
      throw new AppError(422, ERROR_CODES.SELF_REQUEST, 'You cannot send a learning request to yourself.');
    }
    const mentor = await User.findOne({ _id: mentorId, status: ACCOUNT_STATUS.ACTIVE })
      .select('teachSkills acceptingRequests availability name')
      .lean();
    if (!mentor) throw AppError.notFound('This mentor is not available.');
    if (!mentor.teachSkills.some((t) => String(t.skill) === String(skillId))) {
      throw new AppError(422, ERROR_CODES.SKILL_NOT_TAUGHT, `${mentor.name} does not teach ${skill.name}.`, {
        fields: { skillId: `${mentor.name} does not teach this skill` },
      });
    }
    if (mentor.acceptingRequests === false) {
      throw new AppError(403, ERROR_CODES.MENTOR_UNAVAILABLE, `${mentor.name} is not taking new requests right now.`);
    }
    if (!mentor.availability?.length) {
      throw new AppError(
        422,
        ERROR_CODES.MENTOR_NO_AVAILABILITY,
        `${mentor.name} has not set any available times yet, so a session cannot be proposed.`,
      );
    }
  }

  // SB2/US24: one active request per mentor and skill; one active automatic request per skill.
  const existing = await MatchRequest.findOne({
    learner: learnerId,
    skill: skillId,
    active: true,
    ...(mode === REQUEST_MODES.DIRECT ? { mentor: mentorId } : { mode: REQUEST_MODES.AUTO }),
  }).select('_id');
  if (existing) throw duplicateError(existing._id);

  let request;
  try {
    request = await MatchRequest.create({
      learner: learnerId,
      mentor: mode === REQUEST_MODES.DIRECT ? mentorId : null,
      skill: skillId,
      mode,
      message,
      learnerLevel: learnEntry?.preferredLevel ?? 'beginner',
      status: REQUEST_STATUS.QUEUED,
      history: [{ status: REQUEST_STATUS.QUEUED, by: 'learner', at: new Date() }],
    });
  } catch (err) {
    if (isDuplicateKey(err)) throw duplicateError();
    throw err;
  }
  await enqueue(request);
  return loadSerialized(request._id, learnerId);
}

// ───────────────────────── read (SB2/US13, US26–28, US30, US31) ─────────────────────────

const oid = (v) => new mongoose.Types.ObjectId(String(v));
const incomingFilter = (userId) => ({ mentor: oid(userId), deliveredAt: { $ne: null } });
const boxFilter = (userId, box) => {
  if (box === 'incoming') return incomingFilter(userId);
  if (box === 'outgoing') return { learner: oid(userId) };
  return { $or: [{ learner: oid(userId) }, incomingFilter(userId)] };
};

export async function listRequests(userId, { box, status, page, limit }, now = new Date()) {
  await expireStaleRequests(now, { $or: [{ learner: userId }, { mentor: userId }] });
  const base = boxFilter(userId, box);
  const filter = { ...base, status: { $in: REQUEST_STATUS_GROUPS[status] } };
  const [docs, total, grouped] = await Promise.all([
    MatchRequest.find(filter)
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(POPULATE)
      .lean(),
    MatchRequest.countDocuments(filter),
    MatchRequest.aggregate([{ $match: base }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  const byStatus = Object.fromEntries(grouped.map((g) => [g._id, g.count]));
  const counts = Object.fromEntries(
    Object.entries(REQUEST_STATUS_GROUPS).map(([group, statuses]) => [
      group,
      statuses.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0),
    ]),
  );
  return {
    items: docs.map((d) => serializeRequest(d, userId)),
    meta: { ...pageMeta({ page, limit, total }), box, status, counts },
  };
}

/** Loads a request the viewer may see: its learner, its mentor (once delivered) or an admin. */
async function loadForViewer(id, viewerId, viewerRole) {
  const request = await MatchRequest.findById(id);
  if (!request) throw AppError.notFound('This request does not exist.');
  const role = roleIn(request, viewerId, viewerRole);
  const mentorBeforeDelivery = role === 'mentor' && !request.deliveredAt;
  if (!role || mentorBeforeDelivery) throw AppError.forbidden('This request belongs to other members.');
  return { request, role };
}

export async function getRequest(viewerId, viewerRole, id, now = new Date()) {
  await expireStaleRequests(now, { _id: id });
  await loadForViewer(id, viewerId, viewerRole);
  return loadSerialized(id, viewerId, viewerRole);
}

// ───────────────────────── mentor actions (SB2/US14, US15, US31) ─────────────────────────

/** Uses the proposed time if it is still ahead, otherwise finds the next one. */
async function sessionTime(request, now) {
  const slot = request.proposedSlot;
  if (slot?.startsAt && slot.startsAt.getTime() > now.getTime() + 3600_000) return slot.startsAt;
  const [learner, mentor] = await Promise.all([loadPerson(request.learner), loadPerson(request.mentor)]);
  const evaluation = evaluateCandidate({
    learner,
    mentor,
    skillId: String(request.skill),
    wantedLevel: request.learnerLevel,
    now,
    requireLevel: false,
  });
  if (evaluation.proposedSlot) return evaluation.proposedSlot.startsAt;
  // Last resort: the next half hour a day from now; both people can rearrange it in Sprint 3 booking.
  const step = 30 * 60_000;
  return new Date(Math.ceil((now.getTime() + SLOT_LEAD_HOURS * 3600_000) / step) * step);
}

export async function acceptRequest(mentorId, id, now = new Date()) {
  await expireStaleRequests(now, { _id: id });
  const { request, role } = await loadForViewer(id, mentorId);
  if (role !== 'mentor') throw AppError.forbidden('Only the mentor can accept this request.');
  transition(request, REQUEST_STATUS.ACCEPTED, 'mentor');

  const startsAt = await sessionTime(request, now);
  const session = await Session.create({
    learner: request.learner,
    mentor: request.mentor,
    skill: request.skill,
    startsAt,
    durationMinutes: SESSION_DURATION_MINUTES,
    status: SESSION_STATUS.SCHEDULED,
    source: SESSION_SOURCE.MATCH,
    matchRequest: request._id,
  });
  request.session = session._id;
  request.proposedSlot = {
    startsAt,
    endsAt: new Date(startsAt.getTime() + SESSION_DURATION_MINUTES * 60_000),
    shared: request.proposedSlot?.shared ?? false,
  };
  await request.save();

  const result = await loadSerialized(id, mentorId);
  await notify(request.learner, {
    type: NOTIFICATION_TYPES.REQUEST_ACCEPTED,
    title: `${result.mentor.name} accepted – you have a match!`,
    body: `Your ${result.skill.name} session is booked for ${formatInZone(startsAt, result.learner.timezone)}.`,
    link: `/requests/${id}`,
    matchRequest: request._id,
  });
  await notify(request.mentor, {
    type: NOTIFICATION_TYPES.MATCH_CONFIRMED,
    title: `You're matched with ${result.learner.name}`,
    body: `${result.skill.name} session booked for ${formatInZone(startsAt, result.mentor.timezone)}.`,
    link: `/requests/${id}`,
    matchRequest: request._id,
  });
  return { request: result, session: result.session };
}

export async function declineRequest(mentorId, id, { reason = '' } = {}, now = new Date()) {
  await expireStaleRequests(now, { _id: id });
  const { request, role } = await loadForViewer(id, mentorId);
  if (role !== 'mentor') throw AppError.forbidden('Only the mentor can decline this request.');
  transition(request, REQUEST_STATUS.DECLINED, 'mentor', reason || undefined);
  request.declineReason = reason;
  await request.save();
  const result = await loadSerialized(id, mentorId);
  await notify(request.learner, {
    type: NOTIFICATION_TYPES.REQUEST_DECLINED,
    title: `${result.mentor.name} declined your ${result.skill.name} request`,
    body: reason ? `Reason: ${reason}` : 'You can send a request to another mentor from Discover or Matches.',
    link: `/requests/${id}`,
    matchRequest: request._id,
  });
  return result;
}

// ───────────────────────── learner actions (SB2/US16, US45) ─────────────────────────

export async function cancelRequest(learnerId, id, now = new Date()) {
  await expireStaleRequests(now, { _id: id });
  const { request, role } = await loadForViewer(id, learnerId);
  if (role !== 'learner') throw AppError.forbidden('Only the learner can cancel this request.');
  const wasDelivered = request.status === REQUEST_STATUS.PENDING;
  transition(request, REQUEST_STATUS.CANCELLED, 'learner');
  await request.save();
  const result = await loadSerialized(id, learnerId);
  if (wasDelivered) {
    await notify(request.mentor, {
      type: NOTIFICATION_TYPES.REQUEST_CANCELLED,
      title: `${result.learner.name} cancelled their request`,
      body: `The request to learn ${result.skill.name} was withdrawn.`,
      link: `/requests/${id}`,
      matchRequest: request._id,
    });
  }
  return result;
}

export async function retryRequest(learnerId, id, now = new Date()) {
  await expireStaleRequests(now, { _id: id });
  const { request, role } = await loadForViewer(id, learnerId);
  if (role !== 'learner') throw AppError.forbidden('Only the learner can retry this request.');
  transition(request, REQUEST_STATUS.QUEUED, 'learner', `Retry ${request.attempts + 1}`);
  request.attempts += 1;
  request.failure = null;
  request.expiresAt = null;
  request.deliveredAt = null;
  request.score = null;
  request.reasons = [];
  request.notes = [];
  request.proposedSlot = null;
  if (request.mode === REQUEST_MODES.AUTO) request.mentor = null;
  try {
    await request.save();
  } catch (err) {
    if (isDuplicateKey(err)) throw duplicateError();
    throw err;
  }
  await enqueue(request);
  return loadSerialized(id, learnerId);
}
