import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  resetPasswordSchema,
  profileUpdateSchema,
  teachSkillCreateSchema,
  learnSkillCreateSchema,
  availabilitySchema,
  deleteAccountSchema,
  mentorSearchQuerySchema,
  adminStatusSchema,
  failedPasswordRules,
  passwordStrength,
  normalizeSkillName,
  escapeRegex,
  findSlotOverlaps,
  isValidTimeZone,
  toFieldErrors,
  timeToMinutes,
  minutesToTime,
} from '../src/index.js';

const validRegistration = {
  name: 'Priya Sharma',
  email: 'Priya@Example.com ',
  password: 'Str0ng!Pass',
  confirmPassword: 'Str0ng!Pass',
  timezone: 'Asia/Kolkata',
};

describe('password rules (SB1/US2)', () => {
  it('accepts a password that meets every rule', () => {
    expect(failedPasswordRules('Str0ng!Pass')).toEqual([]);
  });

  it.each([
    ['short', 'Ab1!', ['length']],
    ['no uppercase', 'weakpass1!', ['upper']],
    ['no lowercase', 'WEAKPASS1!', ['lower']],
    ['no number', 'Weakpass!!', ['number']],
    ['no symbol', 'Weakpass12', ['symbol']],
  ])('rejects a password with %s', (_label, pw, expected) => {
    expect(failedPasswordRules(pw)).toEqual(expected);
  });

  it('rejects passwords longer than 72 characters (bcrypt limit)', () => {
    expect(failedPasswordRules(`Aa1!${'x'.repeat(69)}`)).toContain('length');
  });

  it('scores strength from 0 (empty) to 4 (strong)', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('abc')).toBe(1);
    expect(passwordStrength('Str0ng!Pa')).toBe(3);
    expect(passwordStrength('Str0ng!Passw0rd')).toBe(4);
  });
});

describe('registerSchema (SB1/US1, US8)', () => {
  it('normalises the email to lower case and trims it', () => {
    const result = registerSchema.parse(validRegistration);
    expect(result.email).toBe('priya@example.com');
  });

  it('reports a field error for each invalid field', () => {
    const result = registerSchema.safeParse({
      name: 'P',
      email: 'not-an-email',
      password: 'weak',
      confirmPassword: 'different',
    });
    expect(result.success).toBe(false);
    const fields = toFieldErrors(result.error);
    expect(fields.name).toMatch(/at least 2/);
    expect(fields.email).toBe('Enter a valid email address');
    expect(fields.password).toMatch(/Password needs/);
    expect(fields.confirmPassword).toBe('Passwords do not match');
  });

  it('rejects a password containing the email name part', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      email: 'priyasharma@example.com',
      password: 'Priyasharma1!',
      confirmPassword: 'Priyasharma1!',
    });
    expect(toFieldErrors(result.error).password).toMatch(/must not contain/);
  });

  it('asks for the confirmation when it is left empty', () => {
    const result = registerSchema.safeParse({ ...validRegistration, confirmPassword: '' });
    expect(toFieldErrors(result.error).confirmPassword).toBe('Please confirm your password');
  });

  it('reports cross-field problems together with field problems (all errors at once)', () => {
    const result = registerSchema.safeParse({ ...validRegistration, name: '', confirmPassword: 'Different1!' });
    const fields = toFieldErrors(result.error);
    expect(fields.name).toBeDefined();
    expect(fields.confirmPassword).toBe('Passwords do not match');
  });

  it('rejects an unknown time zone', () => {
    const result = registerSchema.safeParse({ ...validRegistration, timezone: 'Mars/Olympus' });
    expect(toFieldErrors(result.error).timezone).toBe('Choose a valid time zone');
  });
});

describe('login, reset and change password schemas', () => {
  it('requires a password on login', () => {
    const result = loginSchema.safeParse({ email: 'a@b.co', password: '' });
    expect(toFieldErrors(result.error).password).toBe('Password is required');
  });

  it('rejects a reset token that is too short', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'abc',
      password: 'Str0ng!Pass',
      confirmPassword: 'Str0ng!Pass',
    });
    expect(toFieldErrors(result.error).token).toBe('Reset link is invalid');
  });

  it('requires the new password to differ from the current one (SB1/US7)', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'Str0ng!Pass',
      newPassword: 'Str0ng!Pass',
      confirmPassword: 'Str0ng!Pass',
    });
    expect(toFieldErrors(result.error).newPassword).toMatch(/different/);
  });
});

describe('profile and skill schemas', () => {
  it('limits bio to 1000 characters (SB1/US18)', () => {
    const result = profileUpdateSchema.safeParse({ bio: 'x'.repeat(1001) });
    expect(toFieldErrors(result.error).bio).toMatch(/1000/);
  });

  it('rejects an empty profile update', () => {
    expect(profileUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('rejects duplicate learning interests (SB1/US19)', () => {
    const id = '507f1f77bcf86cd799439011';
    const result = profileUpdateSchema.safeParse({ learningInterests: [id, id] });
    expect(toFieldErrors(result.error).learningInterests).toBe('Interests must be unique');
  });

  it('requires a category for a custom teach skill (SB1/US20)', () => {
    const result = teachSkillCreateSchema.safeParse({ customName: 'Origami', proficiency: 'advanced' });
    expect(toFieldErrors(result.error).categoryId).toMatch(/category/);
  });

  it('reports a missing skill and a missing level at the same time', () => {
    const fields = toFieldErrors(teachSkillCreateSchema.safeParse({}).error);
    expect(fields).toMatchObject({ skillId: 'Choose a skill', proficiency: 'Choose a proficiency level' });
  });

  it('requires a valid proficiency level (SB1/US25)', () => {
    const result = teachSkillCreateSchema.safeParse({ skillId: '507f1f77bcf86cd799439011', proficiency: 'guru' });
    expect(toFieldErrors(result.error).proficiency).toBe('Choose a proficiency level');
  });

  it('accepts a learn skill with a preferred level (SB1/US26)', () => {
    const result = learnSkillCreateSchema.safeParse({
      skillId: '507f1f77bcf86cd799439011',
      preferredLevel: 'beginner',
    });
    expect(result.success).toBe(true);
  });
});

describe('availability (SB1/US27–29)', () => {
  const base = { timezone: 'Europe/London' };

  it('accepts non-overlapping ranges on 30-minute steps', () => {
    const result = availabilitySchema.safeParse({
      ...base,
      slots: [
        { day: 0, start: '09:00', end: '10:30' },
        { day: 0, start: '10:30', end: '12:00' },
        { day: 6, start: '18:00', end: '24:00' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects overlapping ranges on the same day', () => {
    const result = availabilitySchema.safeParse({
      ...base,
      slots: [
        { day: 2, start: '09:00', end: '11:00' },
        { day: 2, start: '10:00', end: '12:00' },
      ],
    });
    expect(toFieldErrors(result.error)['slots.1.start']).toMatch(/overlaps/);
  });

  it('rejects an end time before the start time', () => {
    const result = availabilitySchema.safeParse({ ...base, slots: [{ day: 1, start: '15:00', end: '14:00' }] });
    expect(toFieldErrors(result.error)['slots.0.end']).toBe('End time must be after start time');
  });

  it('rejects times that are not on the hour or half hour', () => {
    const result = availabilitySchema.safeParse({ ...base, slots: [{ day: 1, start: '09:15', end: '10:00' }] });
    expect(toFieldErrors(result.error)['slots.0.start']).toMatch(/half hour/);
  });

  it('finds overlaps but treats touching ranges as separate', () => {
    expect(
      findSlotOverlaps([
        { day: 0, start: '09:00', end: '10:00' },
        { day: 0, start: '10:00', end: '11:00' },
      ]),
    ).toEqual([]);
    expect(
      findSlotOverlaps([
        { day: 0, start: '09:00', end: '10:30' },
        { day: 0, start: '10:00', end: '11:00' },
      ]),
    ).toEqual([[0, 1]]);
  });

  it('converts between HH:mm and minutes', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(minutesToTime(570)).toBe('09:30');
  });

  it('validates IANA time zones including aliases', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('Asia/Calcutta')).toBe(true);
    expect(isValidTimeZone('Nowhere/City')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});

describe('search helpers (SB1/US50)', () => {
  it('normalises skill names', () => {
    expect(normalizeSkillName('  Node.JS   Basics ')).toBe('node.js basics');
  });

  it('escapes regex characters so input is matched literally', () => {
    const pattern = new RegExp(escapeRegex('c++ (.*)'), 'i');
    expect(pattern.test('C++ (.*) tips')).toBe(true);
    expect(pattern.test('c tips')).toBe(false);
  });

  it('requires a non-empty query and clamps page size', () => {
    expect(mentorSearchQuerySchema.safeParse({ q: '   ' }).success).toBe(false);
    expect(mentorSearchQuerySchema.parse({ q: 'react' })).toEqual({ q: 'react', page: 1, limit: 12 });
    expect(mentorSearchQuerySchema.safeParse({ q: 'react', limit: '500' }).success).toBe(false);
  });
});

describe('account and admin schemas', () => {
  it('requires typing DELETE to delete an account (SB1/US34)', () => {
    const result = deleteAccountSchema.safeParse({ password: 'x', confirmText: 'delete' });
    expect(toFieldErrors(result.error).confirmText).toBe('Type DELETE to confirm');
  });

  it('requires a reason when an admin deactivates a user (SB1/US48)', () => {
    expect(adminStatusSchema.safeParse({ status: 'deactivated' }).success).toBe(false);
    expect(adminStatusSchema.safeParse({ status: 'deactivated', reason: 'Spam messages' }).success).toBe(true);
    expect(adminStatusSchema.safeParse({ status: 'active' }).success).toBe(true);
  });
});
