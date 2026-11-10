/**
 * Shapes a learning request for the API (SB2/US25–31). The viewer's role decides
 * which actions are offered; people are shown through the public person card only.
 */
import { allowedActions } from '@skillbridge/shared';
import { serializeCategory } from './serializers.js';

const id = (v) => (v ? String(v._id ?? v) : null);

export function requestPerson(user) {
  if (!user || !user._id) return null;
  return {
    id: id(user),
    name: user.name,
    headline: user.headline ?? '',
    avatarUrl: user.avatar?.url ?? null,
    timezone: user.timezone ?? 'UTC',
  };
}

/** 'learner' | 'mentor' | 'admin' | null */
export function roleIn(request, viewerId, viewerRole) {
  if (id(request.learner) === String(viewerId)) return 'learner';
  if (request.mentor && id(request.mentor) === String(viewerId)) return 'mentor';
  if (viewerRole === 'admin') return 'admin';
  return null;
}

export function serializeRequest(r, viewerId, viewerRole) {
  const role = roleIn(r, viewerId, viewerRole);
  const learner = requestPerson(r.learner);
  const mentor = requestPerson(r.mentor);
  return {
    id: id(r),
    mode: r.mode,
    status: r.status,
    role,
    learner,
    mentor,
    partner: role === 'mentor' ? learner : mentor,
    skill: r.skill?._id ? { id: id(r.skill), name: r.skill.name, category: serializeCategory(r.skill.category) } : null,
    learnerLevel: r.learnerLevel,
    message: r.message ?? '',
    score: r.score ?? null,
    reasons: r.reasons ?? [],
    notes: r.notes ?? [],
    sharedMinutes: r.sharedMinutes ?? 0,
    proposedSlot: r.proposedSlot?.startsAt ? r.proposedSlot : null,
    failure: r.failure?.code ? r.failure : null,
    declineReason: r.declineReason ?? '',
    history: (r.history ?? []).map((h) => ({ status: h.status, at: h.at, by: h.by, note: h.note ?? '' })),
    attempts: r.attempts ?? 1,
    expiresAt: r.expiresAt ?? null,
    session: r.session?._id
      ? {
          id: id(r.session),
          startsAt: r.session.startsAt,
          durationMinutes: r.session.durationMinutes,
          status: r.session.status,
        }
      : null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    actions: allowedActions(r.status, role),
  };
}
