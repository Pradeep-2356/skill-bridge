/**
 * Constants shared by the SkillBridge client and server.
 * Keeping them in one place guarantees that the UI and the API agree on
 * levels, limits and error codes (SB1/US41, SB1/US44).
 */

export const ROLES = Object.freeze({ USER: 'user', ADMIN: 'admin' });

export const ACCOUNT_STATUS = Object.freeze({ ACTIVE: 'active', DEACTIVATED: 'deactivated' });

export const DEACTIVATED_BY = Object.freeze({ SELF: 'self', ADMIN: 'admin' });

/** Teaching proficiency (SB1/US25). `rank` is used for comparisons. */
export const PROFICIENCY_LEVELS = Object.freeze([
  { value: 'beginner', label: 'Beginner', rank: 1 },
  { value: 'intermediate', label: 'Intermediate', rank: 2 },
  { value: 'advanced', label: 'Advanced', rank: 3 },
  { value: 'expert', label: 'Expert', rank: 4 },
]);

/** The level a learner wants to be taught at (SB1/US26). */
export const LEARNING_LEVELS = Object.freeze([
  { value: 'beginner', label: 'Beginner', rank: 1 },
  { value: 'intermediate', label: 'Intermediate', rank: 2 },
  { value: 'advanced', label: 'Advanced', rank: 3 },
]);

export const PROFICIENCY_VALUES = PROFICIENCY_LEVELS.map((l) => l.value);
export const LEARNING_LEVEL_VALUES = LEARNING_LEVELS.map((l) => l.value);

/** Weekdays, Monday first (ISO order). Stored as 0–6 (SB1/US27). */
export const WEEKDAYS = Object.freeze([
  { value: 0, label: 'Monday', short: 'Mon' },
  { value: 1, label: 'Tuesday', short: 'Tue' },
  { value: 2, label: 'Wednesday', short: 'Wed' },
  { value: 3, label: 'Thursday', short: 'Thu' },
  { value: 4, label: 'Friday', short: 'Fri' },
  { value: 5, label: 'Saturday', short: 'Sat' },
  { value: 6, label: 'Sunday', short: 'Sun' },
]);

export const SLOT_STEP_MINUTES = 30;
export const SESSION_DURATION_MINUTES = 30;

export const SESSION_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

export const SESSION_SOURCE = Object.freeze({ DEMO: 'demo', MATCH: 'match' });

export const SKILL_STATUS = Object.freeze({ APPROVED: 'approved', PENDING: 'pending' });

export const LIMITS = Object.freeze({
  NAME_MIN: 2,
  NAME_MAX: 80,
  HEADLINE_MAX: 120,
  BIO_MAX: 1000,
  EMAIL_MAX: 254,
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 72,
  SKILL_DESCRIPTION_MAX: 300,
  LEARNING_GOAL_MAX: 300,
  YEARS_EXPERIENCE_MAX: 50,
  MAX_TEACH_SKILLS: 20,
  MAX_LEARN_SKILLS: 20,
  MAX_INTERESTS: 10,
  MAX_AVAILABILITY_SLOTS: 21,
  CUSTOM_SKILL_MIN: 2,
  CUSTOM_SKILL_MAX: 60,
  SEARCH_QUERY_MAX: 60,
  DEACTIVATION_REASON_MAX: 300,
  AVATAR_MAX_MB: 2,
  PAGE_SIZE_DEFAULT: 12,
  PAGE_SIZE_MAX: 50,
  // Sprint 2
  SEARCH_TERMS_MAX: 5,
  SUGGESTIONS_MAX: 8,
  SEARCH_CANDIDATES_MAX: 500,
  REQUEST_MESSAGE_MAX: 500,
  DECLINE_REASON_MAX: 300,
  MATCH_SUGGESTIONS_MAX: 10,
  CATEGORY_NAME_MIN: 2,
  CATEGORY_NAME_MAX: 50,
  CATEGORY_DESCRIPTION_MAX: 200,
});

export const AVATAR_MIME_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);

/** Error codes returned in `error.code` by the API. */
export const ERROR_CODES = Object.freeze({
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  FORBIDDEN: 'FORBIDDEN',
  ACCOUNT_DEACTIVATED: 'ACCOUNT_DEACTIVATED',
  NOT_FOUND: 'NOT_FOUND',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  SKILL_ALREADY_ADDED: 'SKILL_ALREADY_ADDED',
  SLOT_OVERLAP: 'SLOT_OVERLAP',
  RESET_TOKEN_INVALID: 'RESET_TOKEN_INVALID',
  CANNOT_DEACTIVATE_SELF: 'CANNOT_DEACTIVATE_SELF',
  LAST_ADMIN: 'LAST_ADMIN',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  CSRF_REJECTED: 'CSRF_REJECTED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  // Sprint 2
  SELF_REQUEST: 'SELF_REQUEST',
  SKILL_NOT_TAUGHT: 'SKILL_NOT_TAUGHT',
  MENTOR_UNAVAILABLE: 'MENTOR_UNAVAILABLE',
  MENTOR_NO_AVAILABILITY: 'MENTOR_NO_AVAILABILITY',
  DUPLICATE_REQUEST: 'DUPLICATE_REQUEST',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  CATEGORY_IN_USE: 'CATEGORY_IN_USE',
  NAME_TAKEN: 'NAME_TAKEN',
});

/** Password rules shown as a live checklist and enforced by the API (SB1/US2). */
export const PASSWORD_RULES = Object.freeze([
  { id: 'length', label: '8–72 characters', test: (pw) => pw.length >= 8 && pw.length <= 72 },
  { id: 'upper', label: 'An uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { id: 'lower', label: 'A lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { id: 'number', label: 'A number', test: (pw) => /\d/.test(pw) },
  { id: 'symbol', label: 'A symbol (e.g. ! @ # $)', test: (pw) => /[^A-Za-z0-9\s]/.test(pw) },
]);

// ───────────────────────── Sprint 2: discovery ─────────────────────────

/** Sort orders for mentor discovery (SB2/US3). */
export const SEARCH_SORTS = Object.freeze(['relevance', 'name', 'newest', 'availability']);

/** "Within N hours of my time zone" filter (SB2/US7, US21). */
export const TZ_COMPATIBLE_HOURS = 3;

// ───────────────────────── Sprint 2: learning requests ─────────────────────────

export const REQUEST_MODES = Object.freeze({ DIRECT: 'direct', AUTO: 'auto' });

/** Every state a learning (match) request can be in (SB2/US25). */
export const REQUEST_STATUS = Object.freeze({
  QUEUED: 'queued',
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  FAILED: 'failed',
});

/** States that block a second request between the same learner, mentor and skill (SB2/US24). */
export const ACTIVE_REQUEST_STATUSES = Object.freeze(['queued', 'pending', 'accepted']);

/** Tabs on the requests hub (SB2/US26–28). */
export const REQUEST_STATUS_GROUPS = Object.freeze({
  open: ['queued', 'pending'],
  pending: ['pending'],
  accepted: ['accepted'],
  closed: ['declined', 'cancelled', 'expired', 'failed'],
  all: ['queued', 'pending', 'accepted', 'declined', 'cancelled', 'expired', 'failed'],
});

/**
 * The request state machine (SB2/US25). `by` is who may make the change:
 * system = the matching worker or the expiry job.
 */
export const REQUEST_TRANSITIONS = Object.freeze([
  { from: 'queued', to: 'pending', by: 'system' },
  { from: 'queued', to: 'failed', by: 'system' },
  { from: 'queued', to: 'cancelled', by: 'learner' },
  { from: 'pending', to: 'accepted', by: 'mentor' },
  { from: 'pending', to: 'declined', by: 'mentor' },
  { from: 'pending', to: 'cancelled', by: 'learner' },
  { from: 'pending', to: 'expired', by: 'system' },
  { from: 'failed', to: 'queued', by: 'learner' },
  { from: 'expired', to: 'queued', by: 'learner' },
]);

/** Pending requests expire after this many days (SB2/US44). */
export const REQUEST_EXPIRY_DAYS = 7;

/** Proposed session times start at least this far ahead (SB2/US31). */
export const SLOT_LEAD_HOURS = 24;
export const SLOT_HORIZON_DAYS = 7;

/** Why matching found nobody, with the message and next step shown to the user (SB2/US46). */
export const MATCH_FAILURE_REASONS = Object.freeze({
  NO_MENTORS_FOR_SKILL: {
    message: 'Nobody on SkillBridge teaches this skill yet.',
    nextStep: 'Try a related skill, or check back later as new mentors join.',
  },
  NO_ACTIVE_MENTORS: {
    message: 'The mentors who teach this skill are not taking new requests right now.',
    nextStep: 'Try again in a few days, or pick a related skill.',
  },
  LEVEL_TOO_HIGH: {
    message: 'No mentor teaches this skill at the level you asked for.',
    nextStep: 'Lower your preferred level on the Skills page, or ask a mentor directly.',
  },
  NO_COMMON_AVAILABILITY: {
    message: 'No suitable mentor shares any free time with you.',
    nextStep: 'Add more hours on the Availability page, then retry.',
  },
  ALREADY_REQUESTED: {
    message: 'You already have an open request with every suitable mentor for this skill.',
    nextStep: 'Wait for a reply on the Requests page.',
  },
  NO_LEARN_SKILLS: {
    message: 'You have not added any skills you want to learn.',
    nextStep: 'Add a learning skill on the Skills page to get suggestions.',
  },
  MENTOR_UNAVAILABLE: {
    message: 'This mentor is no longer taking requests.',
    nextStep: 'Pick another mentor from your suggestions.',
  },
  PROCESSING_FAILED: {
    message: 'Something went wrong while we processed your request.',
    nextStep: 'Press Retry. Nothing was lost.',
  },
});

/** Score parts and their maximum points (SB2/US17–22). Total = 100. */
export const MATCH_WEIGHTS = Object.freeze({
  skill: 35,
  level: 20,
  levelEqual: 12,
  availability: 25,
  availabilityCapMinutes: 180,
  timezone: 10,
  exchange: 10,
});

// ───────────────────────── Sprint 2: notifications ─────────────────────────

export const NOTIFICATION_TYPES = Object.freeze({
  REQUEST_RECEIVED: 'request_received',
  REQUEST_ACCEPTED: 'request_accepted',
  REQUEST_DECLINED: 'request_declined',
  REQUEST_CANCELLED: 'request_cancelled',
  REQUEST_EXPIRED: 'request_expired',
  MATCH_FOUND: 'match_found',
  MATCH_CONFIRMED: 'match_confirmed',
  MATCH_FAILED: 'match_failed',
});

// ───────────────────────── Theme (additional requirement) ─────────────────────────

export const THEME_PREFERENCES = Object.freeze(['system', 'light', 'dark']);
export const THEME_STORAGE_KEY = 'sb-theme';
