/**
 * Zod schemas shared by client forms and API validators.
 * The same rules run in the browser (instant feedback) and on the server
 * (the real gatekeeper), so messages are identical in both places (SB1/US8, US41).
 */
import { z } from 'zod';
import {
  LIMITS,
  PROFICIENCY_VALUES,
  LEARNING_LEVEL_VALUES,
  ACCOUNT_STATUS,
  ROLES,
  PASSWORD_RULES,
  SLOT_STEP_MINUTES,
  SEARCH_SORTS,
  REQUEST_MODES,
  REQUEST_STATUS_GROUPS,
  THEME_PREFERENCES,
} from './constants.js';
import { isObjectId, isValidTimeZone, timeToMinutes, findSlotOverlaps } from './utils.js';

// ───────────────────────── building blocks ─────────────────────────

export const objectIdSchema = z.string().refine(isObjectId, { error: 'Invalid id' });

export const emailSchema = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .min(1, { error: 'Email is required' })
  .max(LIMITS.EMAIL_MAX, { error: 'Email is too long' })
  .pipe(z.email({ error: 'Enter a valid email address' }));

export const nameSchema = z
  .string({ error: 'Name is required' })
  .trim()
  .min(LIMITS.NAME_MIN, { error: `Name must be at least ${LIMITS.NAME_MIN} characters` })
  .max(LIMITS.NAME_MAX, { error: `Name must be at most ${LIMITS.NAME_MAX} characters` });

/** Strong password: every rule in PASSWORD_RULES must pass (SB1/US2). */
export const passwordSchema = z
  .string({ error: 'Password is required' })
  .min(1, { error: 'Password is required' })
  .superRefine((pw, ctx) => {
    const failed = PASSWORD_RULES.filter((r) => !r.test(pw));
    if (failed.length) {
      ctx.addIssue({
        code: 'custom',
        message: `Password needs: ${failed.map((r) => r.label.toLowerCase()).join(', ')}`,
      });
    }
  });

export const timezoneSchema = z
  .string({ error: 'Time zone is required' })
  .refine(isValidTimeZone, { error: 'Choose a valid time zone' });

const optionalText = (max, label) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} must be at most ${max} characters` });

/**
 * Zod 4 skips object-level checks when a field already failed. `ALWAYS` makes a
 * cross-field check run anyway, so the user sees every problem at once.
 */
const ALWAYS = { when: (payload) => typeof payload.value === 'object' && payload.value !== null };
const str = (v) => (typeof v === 'string' ? v : '');

/** Adds "passwords must match" + "must not contain the email name" checks. */
function withPasswordConfirmation(schema, { passwordKey = 'password', emailKey } = {}) {
  return schema.superRefine((data, ctx) => {
    const password = str(data[passwordKey]);
    const confirm = str(data.confirmPassword);
    if (confirm && password !== confirm) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match' });
    }
    if (emailKey && str(data[emailKey]) && password) {
      const local = str(data[emailKey]).trim().split('@')[0].toLowerCase();
      if (local.length >= 3 && password.toLowerCase().includes(local)) {
        ctx.addIssue({
          code: 'custom',
          path: [passwordKey],
          message: 'Password must not contain the name part of your email',
        });
      }
    }
  }, ALWAYS);
}

// ───────────────────────── auth (SB1/US1–9) ─────────────────────────

export const registerSchema = withPasswordConfirmation(
  z.object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z
      .string({ error: 'Please confirm your password' })
      .min(1, { error: 'Please confirm your password' }),
    timezone: timezoneSchema.optional(),
  }),
  { emailKey: 'email' },
);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'Password is required' }).min(1, { error: 'Password is required' }),
  reactivate: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = withPasswordConfirmation(
  z.object({
    token: z.string().trim().min(20, { error: 'Reset link is invalid' }).max(200),
    password: passwordSchema,
    confirmPassword: z
      .string({ error: 'Please confirm your password' })
      .min(1, { error: 'Please confirm your password' }),
  }),
);

export const changePasswordSchema = withPasswordConfirmation(
  z.object({
    currentPassword: z.string().min(1, { error: 'Enter your current password' }),
    newPassword: passwordSchema,
    confirmPassword: z
      .string({ error: 'Please confirm your new password' })
      .min(1, { error: 'Please confirm your new password' }),
  }),
  { passwordKey: 'newPassword' },
).superRefine((data, ctx) => {
  if (data.currentPassword && data.currentPassword === data.newPassword) {
    ctx.addIssue({
      code: 'custom',
      path: ['newPassword'],
      message: 'New password must be different from the current one',
    });
  }
}, ALWAYS);

// ───────────────────────── profile (SB1/US16–19, 29) ─────────────────────────

export const profileUpdateSchema = z
  .object({
    name: nameSchema.optional(),
    headline: optionalText(LIMITS.HEADLINE_MAX, 'Headline').optional(),
    bio: optionalText(LIMITS.BIO_MAX, 'Bio').optional(),
    timezone: timezoneSchema.optional(),
    learningInterests: z
      .array(objectIdSchema)
      .max(LIMITS.MAX_INTERESTS, { error: `Choose up to ${LIMITS.MAX_INTERESTS} interests` })
      .refine((ids) => new Set(ids).size === ids.length, { error: 'Interests must be unique' })
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { error: 'Nothing to update' });

// ───────────────────────── skills (SB1/US20–26) ─────────────────────────

const customSkillName = z
  .string()
  .trim()
  .min(LIMITS.CUSTOM_SKILL_MIN, { error: `Skill name must be at least ${LIMITS.CUSTOM_SKILL_MIN} characters` })
  .max(LIMITS.CUSTOM_SKILL_MAX, { error: `Skill name must be at most ${LIMITS.CUSTOM_SKILL_MAX} characters` });

/** Either an existing catalogue skill or a custom name + category. */
function skillReference(shape) {
  return z
    .object({
      skillId: objectIdSchema.optional(),
      customName: customSkillName.optional(),
      categoryId: objectIdSchema.optional(),
      ...shape,
    })
    .superRefine((data, ctx) => {
      if (!data.skillId && !data.customName) {
        ctx.addIssue({ code: 'custom', path: ['skillId'], message: 'Choose a skill' });
      }
      if (data.skillId && data.customName) {
        ctx.addIssue({ code: 'custom', path: ['customName'], message: 'Choose a skill or type a new one, not both' });
      }
      if (data.customName && !data.categoryId) {
        ctx.addIssue({ code: 'custom', path: ['categoryId'], message: 'Choose a category for the new skill' });
      }
    }, ALWAYS);
}

const proficiencySchema = z.enum(PROFICIENCY_VALUES, { error: 'Choose a proficiency level' });
const learningLevelSchema = z.enum(LEARNING_LEVEL_VALUES, { error: 'Choose a learning level' });
const yearsSchema = z.coerce
  .number({ error: 'Years must be a number' })
  .int({ error: 'Years must be a whole number' })
  .min(0, { error: 'Years cannot be negative' })
  .max(LIMITS.YEARS_EXPERIENCE_MAX, { error: `Years must be ${LIMITS.YEARS_EXPERIENCE_MAX} or less` });

export const teachSkillCreateSchema = skillReference({
  proficiency: proficiencySchema,
  yearsExperience: yearsSchema.optional(),
  description: optionalText(LIMITS.SKILL_DESCRIPTION_MAX, 'Description').optional(),
});

export const teachSkillUpdateSchema = z
  .object({
    proficiency: proficiencySchema.optional(),
    yearsExperience: yearsSchema.optional(),
    description: optionalText(LIMITS.SKILL_DESCRIPTION_MAX, 'Description').optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { error: 'Nothing to update' });

export const learnSkillCreateSchema = skillReference({
  preferredLevel: learningLevelSchema,
  goal: optionalText(LIMITS.LEARNING_GOAL_MAX, 'Goal').optional(),
});

export const learnSkillUpdateSchema = z
  .object({
    preferredLevel: learningLevelSchema.optional(),
    goal: optionalText(LIMITS.LEARNING_GOAL_MAX, 'Goal').optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { error: 'Nothing to update' });

export const skillCatalogQuerySchema = z.object({
  q: z.string().trim().max(LIMITS.SEARCH_QUERY_MAX).optional(),
  category: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ───────────────────────── availability (SB1/US27–29) ─────────────────────────

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const timeSchema = z
  .string()
  .regex(TIME_RE, { error: 'Use HH:mm time' })
  .refine((t) => timeToMinutes(t) % SLOT_STEP_MINUTES === 0, { error: 'Times must be on the hour or half hour' });
const endTimeSchema = z
  .string()
  .regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, { error: 'Use HH:mm time' })
  .refine((t) => timeToMinutes(t) % SLOT_STEP_MINUTES === 0, { error: 'Times must be on the hour or half hour' });

export const availabilitySlotSchema = z
  .object({
    day: z.coerce.number().int().min(0, { error: 'Choose a day' }).max(6, { error: 'Choose a day' }),
    start: timeSchema,
    end: endTimeSchema,
  })
  .refine((s) => timeToMinutes(s.start) < timeToMinutes(s.end), {
    error: 'End time must be after start time',
    path: ['end'],
  });

export const availabilitySchema = z
  .object({
    timezone: timezoneSchema,
    slots: z
      .array(availabilitySlotSchema)
      .max(LIMITS.MAX_AVAILABILITY_SLOTS, { error: `Add up to ${LIMITS.MAX_AVAILABILITY_SLOTS} time ranges` }),
  })
  .superRefine((data, ctx) => {
    for (const [, j] of findSlotOverlaps(data.slots)) {
      ctx.addIssue({
        code: 'custom',
        path: ['slots', j, 'start'],
        message: 'This range overlaps another range on the same day',
      });
    }
  });

// ───────────────────────── account (SB1/US32–34) ─────────────────────────

export const deactivateAccountSchema = z.object({
  password: z.string().min(1, { error: 'Enter your password to confirm' }),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, { error: 'Enter your password to confirm' }),
  confirmText: z.literal('DELETE', { error: 'Type DELETE to confirm' }),
});

// ───────────────────────── search (SB1/US50) ─────────────────────────

const pageSchema = z.coerce.number().int().min(1).default(1);
const limitSchema = z.coerce.number().int().min(1).max(LIMITS.PAGE_SIZE_MAX).default(LIMITS.PAGE_SIZE_DEFAULT);

const hhmm = z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, { error: 'Use a time like 18:30' });
const queryBoolean = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

/** "0,2,4" or ["0","2"] → [0, 2, 4] (Monday = 0). */
const daysParam = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v.join(',') : v).split(',').filter((d) => d.trim() !== ''))
  .pipe(z.array(z.coerce.number().int().min(0, { error: 'Unknown day' }).max(6, { error: 'Unknown day' })).max(7))
  .transform((days) => [...new Set(days)].sort());

const searchText = z
  .string()
  .trim()
  .max(LIMITS.SEARCH_QUERY_MAX, { error: `Search must be at most ${LIMITS.SEARCH_QUERY_MAX} characters` });

/**
 * Mentor discovery (SB1/US50, SB2/US1–7, US32–41). Every filter is optional:
 * with no `q` the endpoint lists all active mentors (mentor listing).
 */
export const mentorSearchQuerySchema = z
  .object({
    q: searchText.optional(),
    category: objectIdSchema.optional(),
    proficiency: z.enum(PROFICIENCY_VALUES, { error: 'Choose a level' }).optional(),
    days: daysParam.optional(),
    from: hhmm.optional(),
    to: hhmm.optional(),
    tzCompatible: queryBoolean.optional(),
    sort: z.enum(SEARCH_SORTS, { error: 'Unknown sort order' }).default('relevance'),
    page: pageSchema,
    limit: limitSchema,
  })
  .superRefine((data, ctx) => {
    if (data.from && data.to && timeToMinutes(data.to) <= timeToMinutes(data.from)) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'End time must be after start time' });
    }
  }, ALWAYS);

/** Search-box suggestions (SB2/US2, US41). */
export const skillSuggestQuerySchema = z.object({
  q: searchText.min(1, { error: 'Type at least one letter' }),
  limit: z.coerce.number().int().min(1).max(LIMITS.SUGGESTIONS_MAX).default(LIMITS.SUGGESTIONS_MAX),
});

export const sessionsQuerySchema = z.object({
  scope: z.enum(['upcoming', 'past']).default('upcoming'),
  page: pageSchema,
  limit: limitSchema,
});

// ───────────────────────── admin (SB1/US47–49) ─────────────────────────

export const adminUserQuerySchema = z.object({
  q: z.string().trim().max(LIMITS.SEARCH_QUERY_MAX).optional(),
  status: z.enum(Object.values(ACCOUNT_STATUS)).optional(),
  role: z.enum(Object.values(ROLES)).optional(),
  page: pageSchema,
  limit: limitSchema,
});

export const adminStatusSchema = z
  .object({
    status: z.enum(Object.values(ACCOUNT_STATUS), { error: 'Choose a status' }),
    reason: z.string().trim().max(LIMITS.DEACTIVATION_REASON_MAX).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === ACCOUNT_STATUS.DEACTIVATED && (!data.reason || data.reason.length < 5)) {
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Give a reason of at least 5 characters' });
    }
  }, ALWAYS);

// ───────────────────────── learning requests (SB2/US12–16, 25–28, 45) ─────────────────────────

const requestMessage = z
  .string()
  .trim()
  .max(LIMITS.REQUEST_MESSAGE_MAX, { error: `Message must be at most ${LIMITS.REQUEST_MESSAGE_MAX} characters` });

export const matchRequestCreateSchema = z
  .object({
    mode: z.enum(Object.values(REQUEST_MODES), { error: 'Choose how to find a mentor' }).default('direct'),
    mentorId: objectIdSchema.optional(),
    skillId: z.string({ error: 'Choose a skill' }).refine(isObjectId, { error: 'Choose a skill' }),
    message: requestMessage.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === 'direct' && !data.mentorId) {
      ctx.addIssue({ code: 'custom', path: ['mentorId'], message: 'Choose a mentor' });
    }
  }, ALWAYS);

export const matchRequestListQuerySchema = z.object({
  box: z.enum(['incoming', 'outgoing', 'all']).default('all'),
  status: z.enum(Object.keys(REQUEST_STATUS_GROUPS)).default('all'),
  page: pageSchema,
  limit: limitSchema,
});

export const declineRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(LIMITS.DECLINE_REASON_MAX, { error: `Reason must be at most ${LIMITS.DECLINE_REASON_MAX} characters` })
    .optional(),
});

export const matchSuggestionsQuerySchema = z.object({
  skillId: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(LIMITS.MATCH_SUGGESTIONS_MAX).default(LIMITS.MATCH_SUGGESTIONS_MAX),
});

export const acceptingRequestsSchema = z.object({
  acceptingRequests: z.boolean({ error: 'Choose on or off' }),
});

// ───────────────────────── notifications (SB2/US29) ─────────────────────────

export const notificationsQuerySchema = z.object({
  unread: queryBoolean.optional(),
  page: pageSchema,
  limit: limitSchema,
});

// ───────────────────────── admin catalogue (SB2/US47) ─────────────────────────

const categoryFields = {
  name: z
    .string({ error: 'Name is required' })
    .trim()
    .min(LIMITS.CATEGORY_NAME_MIN, { error: `Name must be at least ${LIMITS.CATEGORY_NAME_MIN} characters` })
    .max(LIMITS.CATEGORY_NAME_MAX, { error: `Name must be at most ${LIMITS.CATEGORY_NAME_MAX} characters` }),
  description: optionalText(LIMITS.CATEGORY_DESCRIPTION_MAX, 'Description').optional(),
  icon: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,40}$/, { error: 'Use an icon name such as "code"' })
    .optional(),
  isActive: z.boolean().optional(),
  order: z.coerce.number().int().min(0).max(999).optional(),
};

export const categoryCreateSchema = z.object(categoryFields);
export const categoryUpdateSchema = z
  .object({ ...categoryFields, name: categoryFields.name.optional() })
  .refine((d) => Object.keys(d).length > 0, { error: 'Nothing to update' });

export const adminSkillQuerySchema = z.object({
  status: z.enum(['pending', 'approved']).default('pending'),
  q: searchText.optional(),
  page: pageSchema,
  limit: limitSchema,
});

export const adminSkillUpdateSchema = z
  .object({
    status: z.enum(['pending', 'approved']).optional(),
    name: z.string().trim().min(1).max(60).optional(),
    categoryId: objectIdSchema.optional(),
    aliases: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { error: 'Nothing to update' });

// ───────────────────────── theme ─────────────────────────

export const themePreferenceSchema = z.enum(THEME_PREFERENCES);
