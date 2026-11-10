/**
 * Learning-request state machine helpers (SB2/US25). Used by the API to enforce
 * transitions and by the UI to decide which buttons to show.
 */
import { REQUEST_TRANSITIONS, ACTIVE_REQUEST_STATUSES } from './constants.js';

/** The transition rule from → to, or null when the change is not allowed. */
export function findTransition(from, to) {
  return REQUEST_TRANSITIONS.find((t) => t.from === from && t.to === to) ?? null;
}

/** True when `actor` ('learner' | 'mentor' | 'system') may move a request from → to. */
export function canTransition(from, to, actor) {
  const rule = findTransition(from, to);
  return Boolean(rule && rule.by === actor);
}

export const isActiveStatus = (status) => ACTIVE_REQUEST_STATUSES.includes(status);

/** Statuses with no way out (accepted, declined, cancelled). */
export const isFinalStatus = (status) => !REQUEST_TRANSITIONS.some((t) => t.from === status);

/** Buttons a participant may use for a request in this status. */
export function allowedActions(status, role) {
  return {
    canAccept: role === 'mentor' && canTransition(status, 'accepted', 'mentor'),
    canDecline: role === 'mentor' && canTransition(status, 'declined', 'mentor'),
    canCancel: role === 'learner' && canTransition(status, 'cancelled', 'learner'),
    canRetry: role === 'learner' && canTransition(status, 'queued', 'learner'),
  };
}
