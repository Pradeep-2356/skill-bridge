import { describe, it, expect } from 'vitest';
import { buildConfig, durationToMs } from '../../src/config/env.js';
import { detectImageType } from '../../src/utils/imageType.js';
import { toPublicProfile, toPrivateUser, toAdminUserSummary } from '../../src/utils/serializers.js';
import { profileCompletion } from '../../src/services/dashboardService.js';

describe('configuration', () => {
  const base = { JWT_ACCESS_SECRET: 'x'.repeat(40) };

  it('refuses to start without a JWT secret', () => {
    expect(() => buildConfig({})).toThrowError(/JWT_ACCESS_SECRET/);
  });

  it('refuses a JWT secret shorter than 32 characters', () => {
    expect(() => buildConfig({ JWT_ACCESS_SECRET: 'short' })).toThrowError(/at least 32/);
  });

  it('applies sensible defaults', () => {
    const cfg = buildConfig(base);
    expect(cfg.PORT).toBe(5000);
    expect(cfg.ACCESS_TOKEN_TTL).toBe('15m');
    expect(cfg.REFRESH_TOKEN_TTL_DAYS).toBe(7);
    expect(cfg.cookieSecure).toBe(false);
    expect(cfg.clientOrigins).toEqual(['http://localhost:5173']);
  });

  it('turns on Secure cookies when HTTPS is enabled (SB1/US45)', () => {
    expect(buildConfig({ ...base, HTTPS: 'true' }).cookieSecure).toBe(true);
  });

  it('never enables test routes in production', () => {
    expect(buildConfig({ ...base, NODE_ENV: 'production', ENABLE_TEST_ROUTES: 'true' }).enableTestRoutes).toBe(false);
  });

  it('parses durations', () => {
    expect(durationToMs('15m')).toBe(900_000);
    expect(durationToMs('2h')).toBe(7_200_000);
    expect(() => durationToMs('soon')).toThrow();
  });
});

describe('detectImageType (SB1/US17)', () => {
  const pad = (bytes) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)]);

  it('recognises JPEG, PNG and WebP by their bytes', () => {
    expect(detectImageType(pad([0xff, 0xd8, 0xff, 0xe0]))?.ext).toBe('jpg');
    expect(detectImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext).toBe('png');
    expect(
      detectImageType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]))?.ext,
    ).toBe('webp');
  });

  it('rejects text pretending to be an image', () => {
    expect(detectImageType(Buffer.from('hello, I am really a text file'))).toBeNull();
    expect(detectImageType(Buffer.alloc(3))).toBeNull();
  });
});

describe('serializers (SB1/US31, US46)', () => {
  const user = {
    _id: '507f1f77bcf86cd799439011',
    email: 'priya@skillbridge.test',
    passwordHash: '$2b$12$secret',
    role: 'admin',
    status: 'active',
    tokenVersion: 4,
    lastLoginAt: new Date(),
    name: 'Priya',
    headline: 'React mentor',
    bio: 'Hi',
    timezone: 'Asia/Kolkata',
    availability: [
      { day: 2, start: '10:00', end: '11:00' },
      { day: 0, start: '09:00', end: '10:00' },
    ],
    teachSkills: [],
    learnSkills: [],
    learningInterests: [],
    createdAt: new Date('2026-01-01'),
  };

  it('public profile never contains private fields', () => {
    const profile = toPublicProfile(user);
    for (const key of ['email', 'passwordHash', 'role', 'status', 'tokenVersion', 'lastLoginAt']) {
      expect(profile).not.toHaveProperty(key);
    }
    expect(JSON.stringify(profile)).not.toContain('priya@skillbridge.test');
  });

  it('public profile sorts availability by day', () => {
    expect(toPublicProfile(user).availability.map((s) => s.day)).toEqual([0, 2]);
  });

  it('private view adds email and role but never the hash or token version', () => {
    const me = toPrivateUser(user);
    expect(me.email).toBe('priya@skillbridge.test');
    expect(me).not.toHaveProperty('passwordHash');
    expect(me).not.toHaveProperty('tokenVersion');
  });

  it('admin summary never contains the password hash', () => {
    expect(JSON.stringify(toAdminUserSummary(user))).not.toContain('$2b$');
  });
});

describe('profile completion (SB1/US35)', () => {
  it('is 0% for an empty profile and lists what is missing', () => {
    const result = profileCompletion({ teachSkills: [], learnSkills: [], availability: [], learningInterests: [] });
    expect(result.percent).toBe(0);
    expect(result.items.every((i) => !i.done)).toBe(true);
  });

  it('is 100% when every item is done', () => {
    const result = profileCompletion({
      avatar: { url: '/uploads/a.png' },
      headline: 'Teacher',
      bio: 'I love teaching people new things.',
      learningInterests: ['x'],
      teachSkills: [{}],
      learnSkills: [{}],
      availability: [{}],
    });
    expect(result).toMatchObject({ percent: 100, completed: 7, total: 7 });
  });

  it('does not count a very short bio', () => {
    const result = profileCompletion({ bio: 'Hi', teachSkills: [], learnSkills: [], availability: [] });
    expect(result.items.find((i) => i.id === 'bio').done).toBe(false);
  });
});
