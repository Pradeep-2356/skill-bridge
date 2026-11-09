/** Read-only session lists (SB1/US37–39). Sessions are created by the seed script in Sprint 1. */
import { SESSION_STATUS } from '@skillbridge/shared';
import { Session } from '../models/Session.js';
import { toPersonCard } from '../utils/serializers.js';
import { pageMeta } from '../utils/respond.js';

const PERSON_FIELDS = 'name headline avatar';

export function serializeSession(session, viewerId) {
  const viewer = String(viewerId);
  const isLearner = session.learner && String(session.learner._id ?? session.learner) === viewer;
  const partner = isLearner ? session.mentor : session.learner;
  const startsAt = new Date(session.startsAt);
  return {
    id: String(session._id),
    startsAt,
    endsAt: new Date(startsAt.getTime() + session.durationMinutes * 60_000),
    durationMinutes: session.durationMinutes,
    status: session.status,
    source: session.source,
    role: isLearner ? 'learner' : 'mentor',
    partner: toPersonCard(partner),
    skill: session.skill ? { id: String(session.skill._id), name: session.skill.name } : null,
  };
}

function scopeFilter(userId, scope, now = new Date()) {
  const mine = { $or: [{ learner: userId }, { mentor: userId }] };
  if (scope === 'upcoming') {
    return { ...mine, startsAt: { $gte: now }, status: SESSION_STATUS.SCHEDULED };
  }
  return { ...mine, $and: [{ $or: [{ startsAt: { $lt: now } }, { status: { $ne: SESSION_STATUS.SCHEDULED } }] }] };
}

export async function listSessions(userId, { scope, page, limit }, now = new Date()) {
  const filter = scopeFilter(userId, scope, now);
  const sort = scope === 'upcoming' ? { startsAt: 1 } : { startsAt: -1 };
  const [items, total] = await Promise.all([
    Session.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('learner', PERSON_FIELDS)
      .populate('mentor', PERSON_FIELDS)
      .populate('skill', 'name')
      .lean(),
    Session.countDocuments(filter),
  ]);
  return { items: items.map((s) => serializeSession(s, userId)), meta: pageMeta({ page, limit, total }) };
}

export async function countSessions(userId, scope, now = new Date()) {
  return Session.countDocuments(scopeFilter(userId, scope, now));
}
