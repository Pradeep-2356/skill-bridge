import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { User } from '../../src/models/User.js';
import { RefreshToken } from '../../src/models/RefreshToken.js';
import { setupTestApp, resetDatabase, teardownTestApp } from '../helpers/testApp.js';
import { createUser, loginAgent, findCookie, DEFAULT_PASSWORD } from '../helpers/factories.js';

let ctx;
beforeAll(async () => {
  ctx = await setupTestApp();
});
afterAll(() => teardownTestApp(ctx));
beforeEach(() => resetDatabase());

const registration = {
  name: 'Arjun Mehta',
  email: 'Arjun@SkillBridge.test',
  password: 'Str0ng!Pass',
  confirmPassword: 'Str0ng!Pass',
  timezone: 'Asia/Kolkata',
};

describe('POST /auth/register (SB1/US1, US2, US8, US9, US14)', () => {
  it('creates the account, logs the user in and stores only a bcrypt hash', async () => {
    const res = await request(ctx.app).post('/api/v1/auth/register').send(registration);
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({
      name: 'Arjun Mehta',
      email: 'arjun@skillbridge.test',
      role: 'user',
      status: 'active',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);

    const stored = await User.findOne({ email: 'arjun@skillbridge.test' }).select('+passwordHash');
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(stored.passwordHash).not.toContain('Str0ng!Pass');
    expect(stored.timezone).toBe('Asia/Kolkata');
  });

  it('sets HttpOnly cookies: access (Lax, path /) and refresh (Strict, auth path only)', async () => {
    const res = await request(ctx.app).post('/api/v1/auth/register').send(registration);
    const access = findCookie(res, 'sb_access');
    const refresh = findCookie(res, 'sb_refresh');
    expect(access.attrs).toEqual(expect.arrayContaining(['httponly', 'samesite=lax', 'path=/']));
    expect(refresh.attrs).toEqual(expect.arrayContaining(['httponly', 'samesite=strict', 'path=/api/v1/auth']));
  });

  it('rejects an email that is already registered, in any letter case (409)', async () => {
    await createUser({ email: 'arjun@skillbridge.test' });
    const res = await request(ctx.app).post('/api/v1/auth/register').send(registration);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
    expect(res.body.error.fields.email).toMatch(/already exists/);
  });

  it('returns 422 with a message for every invalid field', async () => {
    const res = await request(ctx.app)
      .post('/api/v1/auth/register')
      .send({ name: 'A', email: 'nope', password: 'weak', confirmPassword: 'other' });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.fields).sort()).toEqual(['confirmPassword', 'email', 'name', 'password']);
    expect(await User.countDocuments()).toBe(0);
  });

  it('ignores an attempt to register as admin', async () => {
    const res = await request(ctx.app)
      .post('/api/v1/auth/register')
      .send({ ...registration, role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('user');
  });
});

describe('POST /auth/login (SB1/US3)', () => {
  it('logs in with the right password and records the login time', async () => {
    const { user } = await createUser({ email: 'priya@skillbridge.test' });
    const res = await request(ctx.app)
      .post('/api/v1/auth/login')
      .send({ email: 'PRIYA@skillbridge.test', password: DEFAULT_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(String(user._id));
    expect(findCookie(res, 'sb_access')).not.toBeNull();
    expect((await User.findById(user._id)).lastLoginAt).toBeInstanceOf(Date);
  });

  it('gives the same 401 message for a wrong password and an unknown email', async () => {
    await createUser({ email: 'priya@skillbridge.test' });
    const wrong = await request(ctx.app)
      .post('/api/v1/auth/login')
      .send({ email: 'priya@skillbridge.test', password: 'Wr0ng!Pass' });
    const unknown = await request(ctx.app)
      .post('/api/v1/auth/login')
      .send({ email: 'ghost@skillbridge.test', password: 'Wr0ng!Pass' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toEqual(unknown.body.error);
    expect(findCookie(wrong, 'sb_access')).toBeNull();
  });

  it('returns 422 when fields are missing', async () => {
    const res = await request(ctx.app).post('/api/v1/auth/login').send({});
    expect(res.status).toBe(422);
    expect(res.body.error.fields).toHaveProperty('email');
  });
});

describe('staying signed in and protected endpoints (SB1/US10, US11, US13)', () => {
  it('GET /auth/me returns the user when the cookie is present', async () => {
    const { user } = await createUser();
    const agent = await loginAgent(ctx.app, user.email);
    const res = await agent.get('/api/v1/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(user.email);
  });

  const protectedRoutes = [
    ['get', '/api/v1/auth/me'],
    ['patch', '/api/v1/auth/password'],
    ['get', '/api/v1/users/me'],
    ['patch', '/api/v1/users/me'],
    ['put', '/api/v1/users/me/avatar'],
    ['delete', '/api/v1/users/me/avatar'],
    ['get', '/api/v1/users/me/preview'],
    ['post', '/api/v1/users/me/deactivate'],
    ['delete', '/api/v1/users/me'],
    ['get', '/api/v1/users/507f1f77bcf86cd799439011'],
    ['get', '/api/v1/categories'],
    ['get', '/api/v1/skills'],
    ['get', '/api/v1/users/me/skills'],
    ['post', '/api/v1/users/me/teach-skills'],
    ['patch', '/api/v1/users/me/teach-skills/507f1f77bcf86cd799439011'],
    ['delete', '/api/v1/users/me/teach-skills/507f1f77bcf86cd799439011'],
    ['post', '/api/v1/users/me/learn-skills'],
    ['patch', '/api/v1/users/me/learn-skills/507f1f77bcf86cd799439011'],
    ['delete', '/api/v1/users/me/learn-skills/507f1f77bcf86cd799439011'],
    ['get', '/api/v1/users/me/availability'],
    ['put', '/api/v1/users/me/availability'],
    ['get', '/api/v1/dashboard'],
    ['get', '/api/v1/sessions'],
    ['get', '/api/v1/search/mentors?q=react'],
    ['get', '/api/v1/admin/users'],
    ['get', '/api/v1/admin/users/507f1f77bcf86cd799439011'],
    ['patch', '/api/v1/admin/users/507f1f77bcf86cd799439011/status'],
  ];

  it.each(protectedRoutes)('%s %s returns 401 without a login cookie', async (method, url) => {
    const res = await request(ctx.app)[method](url);
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, error: { code: 'UNAUTHENTICATED' } });
  });

  it('rejects a forged access cookie', async () => {
    const res = await request(ctx.app)
      .get('/api/v1/users/me')
      .set('Cookie', 'sb_access=eyJhbGciOiJIUzI1NiJ9.e30.forged');
    expect(res.status).toBe(401);
  });
});

describe('refresh token rotation (SB1/US10, US12)', () => {
  async function loginAndGetRefresh() {
    const { user } = await createUser();
    const res = await request(ctx.app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: DEFAULT_PASSWORD });
    return { user, refresh: findCookie(res, 'sb_refresh').value };
  }

  it('swaps a refresh token for a new pair', async () => {
    const { refresh } = await loginAndGetRefresh();
    const res = await request(ctx.app).post('/api/v1/auth/refresh').set('Cookie', `sb_refresh=${refresh}`);
    expect(res.status).toBe(200);
    const next = findCookie(res, 'sb_refresh').value;
    expect(next).not.toBe(refresh);
    expect(findCookie(res, 'sb_access')).not.toBeNull();
  });

  it('refuses to use the same refresh token twice and then revokes the whole login', async () => {
    const { refresh } = await loginAndGetRefresh();
    const first = await request(ctx.app).post('/api/v1/auth/refresh').set('Cookie', `sb_refresh=${refresh}`);
    const rotated = findCookie(first, 'sb_refresh').value;

    const reuse = await request(ctx.app).post('/api/v1/auth/refresh').set('Cookie', `sb_refresh=${refresh}`);
    expect(reuse.status).toBe(401);

    // The token issued by the legitimate rotation is now revoked too.
    const afterReuse = await request(ctx.app).post('/api/v1/auth/refresh').set('Cookie', `sb_refresh=${rotated}`);
    expect(afterReuse.status).toBe(401);
  });

  it('returns 401 and clears cookies when no refresh token is sent', async () => {
    const res = await request(ctx.app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
    expect(findCookie(res, 'sb_access').value).toBe('');
  });

  it('stores only hashes of refresh tokens', async () => {
    const { refresh } = await loginAndGetRefresh();
    const rows = await RefreshToken.find().lean();
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(refresh);
  });
});

describe('POST /auth/logout (SB1/US4)', () => {
  it('revokes the refresh token and clears both cookies', async () => {
    const { user } = await createUser();
    const agent = await loginAgent(ctx.app, user.email);
    const res = await agent.post('/api/v1/auth/logout');
    expect(res.status).toBe(204);
    expect(findCookie(res, 'sb_access').value).toBe('');
    expect(findCookie(res, 'sb_refresh').value).toBe('');

    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    expect(await RefreshToken.countDocuments({ revokedAt: null })).toBe(0);
  });
});

describe('platform basics', () => {
  it('GET /health reports the database as up', async () => {
    const res = await request(ctx.app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'ok', db: 'up' });
  });

  it('blocks a write request from another website (CSRF)', async () => {
    const res = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'a@b.co', password: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_REJECTED');
  });

  it('answers malformed JSON with 400', async () => {
    const res = await request(ctx.app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('sends security headers', async () => {
    const res = await request(ctx.app).get('/api/v1/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("default-src 'self'");
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('returns 404 JSON for an unknown API path', async () => {
    const res = await request(ctx.app).get('/api/not-a-route');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
