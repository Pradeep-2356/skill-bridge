import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { PasswordReset } from '../../src/models/PasswordReset.js';
import { User } from '../../src/models/User.js';
import { setupTestApp, resetDatabase, teardownTestApp } from '../helpers/testApp.js';
import { createUser, loginAgent, findCookie, DEFAULT_PASSWORD } from '../helpers/factories.js';

let ctx;
beforeAll(async () => {
  ctx = await setupTestApp();
});
afterAll(() => teardownTestApp(ctx));
beforeEach(async () => {
  await resetDatabase();
  ctx.mailer.clear();
});

const NEW_PASSWORD = 'N3w!Passw0rd';

/** Pulls the raw token out of the reset email, just as the user would click it. */
function tokenFromEmail(email) {
  const match = /reset-password\/([A-Za-z0-9_-]+)/.exec(email.text);
  return match?.[1];
}

async function requestReset(email) {
  return request(ctx.app).post('/api/v1/auth/forgot-password').send({ email });
}

describe('forgot password (SB1/US5)', () => {
  it('emails a single-use link and stores only its hash', async () => {
    const { user } = await createUser({ email: 'priya@skillbridge.test' });
    const res = await requestReset('Priya@skillbridge.test');
    expect(res.status).toBe(202);

    const email = ctx.mailer.latestTo('priya@skillbridge.test');
    expect(email.subject).toMatch(/reset your skillbridge password/i);
    expect(email.text).toContain('http://localhost:5173/reset-password/');
    const token = tokenFromEmail(email);
    expect(token).toHaveLength(43);

    const rows = await PasswordReset.find({ user: user._id }).lean();
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(rows[0].expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 60_000);
  });

  it('answers the same way for an unknown email and sends nothing', async () => {
    const res = await requestReset('ghost@skillbridge.test');
    expect(res.status).toBe(202);
    expect(res.body.data.message).toMatch(/if an account exists/i);
    expect(ctx.mailer.outbox).toHaveLength(0);
  });

  it('does not send a link to a deactivated account', async () => {
    await createUser({
      email: 'gone@skillbridge.test',
      status: 'deactivated',
      deactivation: { by: 'admin', reason: 'Spam' },
    });
    await requestReset('gone@skillbridge.test');
    expect(ctx.mailer.outbox).toHaveLength(0);
  });

  it('keeps only the newest link when asked twice', async () => {
    const { user } = await createUser({ email: 'priya@skillbridge.test' });
    await requestReset('priya@skillbridge.test');
    const first = tokenFromEmail(ctx.mailer.latestTo('priya@skillbridge.test'));
    await requestReset('priya@skillbridge.test');
    expect(await PasswordReset.countDocuments({ user: user._id })).toBe(1);
    const res = await request(ctx.app)
      .post('/api/v1/auth/reset-password')
      .send({ token: first, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(res.status).toBe(400);
  });
});

describe('reset password (SB1/US6)', () => {
  it('sets the new password, works once, and signs out every device', async () => {
    const { user } = await createUser({ email: 'priya@skillbridge.test' });
    const agent = await loginAgent(ctx.app, 'priya@skillbridge.test');
    await requestReset('priya@skillbridge.test');
    const token = tokenFromEmail(ctx.mailer.latestTo('priya@skillbridge.test'));

    const res = await request(ctx.app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(res.status).toBe(200);

    // Old password fails, new one works
    expect(
      (await request(ctx.app).post('/api/v1/auth/login').send({ email: user.email, password: DEFAULT_PASSWORD }))
        .status,
    ).toBe(401);
    expect(
      (await request(ctx.app).post('/api/v1/auth/login').send({ email: user.email, password: NEW_PASSWORD })).status,
    ).toBe(200);

    // The link cannot be used again
    const again = await request(ctx.app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'An0ther!Pass', confirmPassword: 'An0ther!Pass' });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('RESET_TOKEN_INVALID');

    // The session that existed before the reset no longer works
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    expect((await agent.post('/api/v1/auth/refresh')).status).toBe(401);

    // A confirmation email was sent
    expect(ctx.mailer.latestTo(user.email).subject).toMatch(/password was changed/i);
  });

  it('rejects an expired link', async () => {
    await createUser({ email: 'priya@skillbridge.test' });
    await requestReset('priya@skillbridge.test');
    const token = tokenFromEmail(ctx.mailer.latestTo('priya@skillbridge.test'));
    await PasswordReset.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await request(ctx.app)
      .post('/api/v1/auth/reset-password')
      .send({ token, password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(res.status).toBe(400);
  });

  it('rejects a weak new password with field errors', async () => {
    const res = await request(ctx.app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'x'.repeat(43), password: 'weak', confirmPassword: 'weak' });
    expect(res.status).toBe(422);
    expect(res.body.error.fields.password).toMatch(/password needs/i);
  });
});

describe('change password (SB1/US7)', () => {
  it('requires the current password', async () => {
    const { user } = await createUser();
    const agent = await loginAgent(ctx.app, user.email);
    const res = await agent
      .patch('/api/v1/auth/password')
      .send({ currentPassword: 'Wr0ng!Pass', newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(res.status).toBe(422);
    expect(res.body.error.fields.currentPassword).toMatch(/incorrect/);
  });

  it('changes the password, keeps this browser signed in and signs out other devices', async () => {
    const { user } = await createUser();
    const thisBrowser = await loginAgent(ctx.app, user.email);
    const otherDevice = await loginAgent(ctx.app, user.email);

    const res = await thisBrowser
      .patch('/api/v1/auth/password')
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    expect(res.status).toBe(200);
    expect(findCookie(res, 'sb_access')).not.toBeNull();

    expect((await thisBrowser.get('/api/v1/auth/me')).status).toBe(200);
    expect((await otherDevice.get('/api/v1/auth/me')).status).toBe(401);
    expect((await otherDevice.post('/api/v1/auth/refresh')).status).toBe(401);

    const stored = await User.findById(user._id).select('+passwordHash tokenVersion');
    expect(stored.tokenVersion).toBe(1);
  });
});
