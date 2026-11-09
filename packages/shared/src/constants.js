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
});

/** Password rules shown as a live checklist and enforced by the API (SB1/US2). */
export const PASSWORD_RULES = Object.freeze([
  { id: 'length', label: '8–72 characters', test: (pw) => pw.length >= 8 && pw.length <= 72 },
  { id: 'upper', label: 'An uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { id: 'lower', label: 'A lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { id: 'number', label: 'A number', test: (pw) => /\d/.test(pw) },
  { id: 'symbol', label: 'A symbol (e.g. ! @ # $)', test: (pw) => /[^A-Za-z0-9\s]/.test(pw) },
]);
