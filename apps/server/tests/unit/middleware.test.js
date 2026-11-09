import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { z } from 'zod';

vi.mock('../../src/models/User.js', () => ({ User: { findById: vi.fn() } }));

const { User } = await import('../../src/models/User.js');
const { buildConfig } = await import('../../src/config/env.js');
const { setRuntime } = await import('../../src/config/runtime.js');
const { signAccessToken } = await import('../../src/services/tokenService.js');
const { authenticate, authorize } = await import('../../src/middleware/authenticate.js');
const { validate } = await import('../../src/middleware/validate.js');
const { originCheck } = await import('../../src/middleware/originCheck.js');
const { errorHandler } = await import('../../src/middleware/errorHandler.js');
const { AppError } = await import('../../src/utils/AppError.js');

const userId = '507f1f77bcf86cd799439011';

function mockUser(doc) {
  User.findById.mockReturnValue({ select: () => ({ lean: async () => doc }) });
}

function reqWithToken(token) {
  return { cookies: token ? { sb_access: token } : {} };
}

beforeAll(() => setRuntime({ config: buildConfig(process.env) }));
beforeEach(() => User.findById.mockReset());

describe('authenticate (SB1/US13)', () => {
  it('rejects a request without the access cookie', async () => {
    await expect(authenticate(reqWithToken(null), {}, vi.fn())).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });
  });

  it('rejects a garbage token', async () => {
    await expect(authenticate(reqWithToken('not.a.jwt'), {}, vi.fn())).rejects.toMatchObject({ status: 401 });
  });

  it('accepts a valid token for an active user and sets req.user', async () => {
    mockUser({ _id: userId, role: 'user', status: 'active', tokenVersion: 0 });
    const req = reqWithToken(signAccessToken({ _id: userId, role: 'user', tokenVersion: 0 }));
    const next = vi.fn();
    await authenticate(req, {}, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual({ id: userId, role: 'user' });
  });

  it('blocks a deactivated user even with a valid token (SB1/US48)', async () => {
    mockUser({ _id: userId, role: 'user', status: 'deactivated', tokenVersion: 0 });
    const req = reqWithToken(signAccessToken({ _id: userId, role: 'user', tokenVersion: 0 }));
    await expect(authenticate(req, {}, vi.fn())).rejects.toMatchObject({ status: 403, code: 'ACCOUNT_DEACTIVATED' });
  });

  it('rejects a token issued before a password change', async () => {
    mockUser({ _id: userId, role: 'user', status: 'active', tokenVersion: 2 });
    const req = reqWithToken(signAccessToken({ _id: userId, role: 'user', tokenVersion: 1 }));
    await expect(authenticate(req, {}, vi.fn())).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a token for a deleted user', async () => {
    mockUser(null);
    const req = reqWithToken(signAccessToken({ _id: userId, role: 'user', tokenVersion: 0 }));
    await expect(authenticate(req, {}, vi.fn())).rejects.toMatchObject({ status: 401 });
  });
});

describe('authorize (SB1/US47)', () => {
  it('lets an admin through', () => {
    const next = vi.fn();
    authorize('admin')({ user: { id: userId, role: 'admin' } }, {}, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('blocks a normal user with 403', () => {
    expect(() => authorize('admin')({ user: { id: userId, role: 'user' } }, {}, vi.fn())).toThrowError(
      expect.objectContaining({ status: 403, code: 'FORBIDDEN' }),
    );
  });
});

describe('validate', () => {
  const schema = z.object({ name: z.string().trim().min(2, { error: 'Too short' }), age: z.coerce.number() });

  it('stores parsed values on req.validated', () => {
    const req = { body: { name: '  Ann ', age: '30' } };
    validate({ body: schema })(req, {}, vi.fn());
    expect(req.validated.body).toEqual({ name: 'Ann', age: 30 });
  });

  it('throws 422 with field messages', () => {
    expect(() => validate({ body: schema })({ body: { name: 'A', age: 1 } }, {}, vi.fn())).toThrowError(
      expect.objectContaining({ status: 422, fields: { name: 'Too short' } }),
    );
  });
});

describe('originCheck (CSRF defence)', () => {
  const check = originCheck(['http://localhost:5173']);
  const req = (method, origin) => ({
    method,
    protocol: 'http',
    get: (h) => ({ origin, host: 'localhost:5000' })[h.toLowerCase()],
  });

  it('allows safe methods from anywhere', () => {
    const next = vi.fn();
    check(req('GET', 'https://evil.example'), {}, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows writes from the app origin and from the API itself', () => {
    const next = vi.fn();
    check(req('POST', 'http://localhost:5173'), {}, next);
    check(req('POST', 'http://localhost:5000'), {}, next);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('blocks writes from another website', () => {
    expect(() => check(req('POST', 'https://evil.example'), {}, vi.fn())).toThrowError(
      expect.objectContaining({ status: 403, code: 'CSRF_REJECTED' }),
    );
  });
});

describe('errorHandler (SB1/US42)', () => {
  function run(err) {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    errorHandler(err, { method: 'GET', originalUrl: '/x' }, res, vi.fn());
    return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
  }

  it('returns AppErrors as they are, with fields', () => {
    const { status, body } = run(AppError.validation({ email: 'Bad' }));
    expect(status).toBe(422);
    expect(body).toEqual({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: expect.any(String), fields: { email: 'Bad' } },
    });
  });

  it('maps a duplicate email to 409 EMAIL_TAKEN', () => {
    const { status, body } = run(Object.assign(new Error('dup'), { code: 11000, keyPattern: { email: 1 } }));
    expect(status).toBe(409);
    expect(body.error.code).toBe('EMAIL_TAKEN');
  });

  it('maps malformed JSON to 400', () => {
    expect(run(Object.assign(new Error('x'), { type: 'entity.parse.failed' })).status).toBe(400);
  });

  it('hides unexpected errors behind a generic 500 message', () => {
    const { status, body } = run(new Error('database password is hunter2'));
    expect(status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).not.toContain('hunter2');
  });
});
