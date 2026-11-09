import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { buildConfig } from '../../src/config/env.js';
import { setRuntime } from '../../src/config/runtime.js';
import { signAccessToken, verifyAccessToken } from '../../src/services/tokenService.js';
import { hashPassword, verifyPassword, verifyAgainstDummy } from '../../src/services/passwordService.js';
import { generateOpaqueToken, hashToken } from '../../src/utils/crypto.js';

const config = buildConfig(process.env);
const user = { _id: '507f1f77bcf86cd799439011', role: 'user', tokenVersion: 3 };

beforeAll(() => setRuntime({ config }));
afterEach(() => vi.useRealTimers());

describe('access tokens (SB1/US11, US12)', () => {
  it('signs a JWT with subject, role and token version', () => {
    const payload = verifyAccessToken(signAccessToken(user));
    expect(payload.sub).toBe(user._id);
    expect(payload.role).toBe('user');
    expect(payload.tv).toBe(3);
    expect(payload.iss).toBe('skillbridge');
  });

  it('expires after the configured 15 minutes', () => {
    const payload = verifyAccessToken(signAccessToken(user));
    expect(payload.exp - payload.iat).toBe(15 * 60);
  });

  it('rejects an expired token with TOKEN_EXPIRED', () => {
    vi.useFakeTimers();
    const token = signAccessToken(user);
    vi.advanceTimersByTime(16 * 60 * 1000);
    expect(() => verifyAccessToken(token)).toThrowError(
      expect.objectContaining({ status: 401, code: 'TOKEN_EXPIRED' }),
    );
  });

  it('rejects a token signed with another secret', () => {
    const forged = jwt.sign({ role: 'admin', tv: 0 }, 'some-other-secret-that-is-long-enough!!', {
      subject: user._id,
      issuer: 'skillbridge',
      audience: 'skillbridge-web',
    });
    expect(() => verifyAccessToken(forged)).toThrowError(expect.objectContaining({ code: 'UNAUTHENTICATED' }));
  });

  it('rejects a token whose payload was edited', () => {
    const [header, , signature] = signAccessToken(user).split('.');
    const edited = Buffer.from(JSON.stringify({ sub: user._id, role: 'admin', tv: 3 })).toString('base64url');
    expect(() => verifyAccessToken(`${header}.${edited}.${signature}`)).toThrowError(
      expect.objectContaining({ code: 'UNAUTHENTICATED' }),
    );
  });

  it('rejects a token using the "none" algorithm', () => {
    const unsigned = jwt.sign({ role: 'admin', tv: 0 }, '', {
      algorithm: 'none',
      subject: user._id,
      issuer: 'skillbridge',
      audience: 'skillbridge-web',
    });
    expect(() => verifyAccessToken(unsigned)).toThrowError(expect.objectContaining({ code: 'UNAUTHENTICATED' }));
  });
});

describe('opaque tokens', () => {
  it('generates long random URL-safe tokens', () => {
    const a = generateOpaqueToken();
    const b = generateOpaqueToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('stores only a SHA-256 hash, never the token itself', () => {
    const token = generateOpaqueToken();
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(token)).not.toContain(token);
    expect(hashToken(token)).toBe(hashToken(token));
  });
});

describe('password hashing (SB1/US14)', () => {
  it('never stores the plain password', async () => {
    const hash = await hashPassword('Str0ng!Pass');
    expect(hash).not.toContain('Str0ng!Pass');
    expect(hash).toMatch(/^\$2[aby]\$04\$/); // bcrypt, cost 4 in tests
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('Str0ng!Pass');
    expect(await verifyPassword('Str0ng!Pass', hash)).toBe(true);
    expect(await verifyPassword('str0ng!pass', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('salts each hash so equal passwords give different hashes', async () => {
    expect(await hashPassword('Str0ng!Pass')).not.toBe(await hashPassword('Str0ng!Pass'));
  });

  it('dummy verification always fails (used for unknown emails)', async () => {
    expect(await verifyAgainstDummy('anything')).toBe(false);
  });
});
