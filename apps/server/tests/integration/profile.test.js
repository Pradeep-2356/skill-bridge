import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { User } from '../../src/models/User.js';
import { setupTestApp, resetDatabase, teardownTestApp } from '../helpers/testApp.js';
import { signedInUser, createUser, createCategory, createSkill } from '../helpers/factories.js';

let ctx;
beforeAll(async () => {
  ctx = await setupTestApp();
});
afterAll(() => teardownTestApp(ctx));
beforeEach(async () => {
  await resetDatabase();
  await fs.rm(path.join(ctx.uploadDir, 'avatars'), { recursive: true, force: true });
});

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);

describe('my profile (SB1/US16, US18, US19, US29, US30)', () => {
  it('returns my full profile including private fields', async () => {
    const { agent, user } = await signedInUser(ctx.app, { headline: 'Hi' });
    const res = await agent.get('/api/v1/users/me');
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ id: String(user._id), email: user.email, role: 'user', headline: 'Hi' });
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('updates name, headline, bio, time zone and interests', async () => {
    const { agent } = await signedInUser(ctx.app);
    const cat = await createCategory({ name: 'Music', slug: 'music' });
    const res = await agent.patch('/api/v1/users/me').send({
      name: '  Priya S  ',
      headline: 'React mentor',
      bio: 'I teach React.',
      timezone: 'Europe/London',
      learningInterests: [String(cat._id)],
    });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({
      name: 'Priya S',
      headline: 'React mentor',
      bio: 'I teach React.',
      timezone: 'Europe/London',
    });
    expect(res.body.data.user.learningInterests).toEqual([expect.objectContaining({ name: 'Music' })]);
  });

  it('rejects an over-long bio and an unknown interest', async () => {
    const { agent } = await signedInUser(ctx.app);
    const long = await agent.patch('/api/v1/users/me').send({ bio: 'x'.repeat(1001) });
    expect(long.status).toBe(422);
    expect(long.body.error.fields.bio).toMatch(/1000/);
    const unknown = await agent.patch('/api/v1/users/me').send({ learningInterests: ['507f1f77bcf86cd799439011'] });
    expect(unknown.status).toBe(422);
    expect(unknown.body.error.fields.learningInterests).toBeDefined();
  });

  it('cannot change role, email or status through a profile update', async () => {
    const { agent, user } = await signedInUser(ctx.app);
    const res = await agent
      .patch('/api/v1/users/me')
      .send({ name: 'Still Me', role: 'admin', email: 'x@y.co', status: 'active' });
    expect(res.status).toBe(200);
    const stored = await User.findById(user._id);
    expect(stored.role).toBe('user');
    expect(stored.email).toBe(user.email);
  });
});

describe('profile photo (SB1/US17)', () => {
  it('uploads a PNG, serves it, and replaces the old file on a second upload', async () => {
    const { agent } = await signedInUser(ctx.app);
    const first = await agent
      .put('/api/v1/users/me/avatar')
      .attach('avatar', PNG, { filename: 'me.png', contentType: 'image/png' });
    expect(first.status).toBe(200);
    expect(first.body.data.avatarUrl).toMatch(/^\/uploads\/avatars\/[\w-]+\.png$/);

    const served = await request(ctx.app).get(first.body.data.avatarUrl);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');

    const second = await agent
      .put('/api/v1/users/me/avatar')
      .attach('avatar', PNG, { filename: 'me2.png', contentType: 'image/png' });
    const files = await fs.readdir(path.join(ctx.uploadDir, 'avatars'));
    expect(files).toEqual([path.basename(second.body.data.avatarUrl)]);
  });

  it('rejects a file over 2 MB with 413', async () => {
    const { agent } = await signedInUser(ctx.app);
    const big = Buffer.concat([PNG, Buffer.alloc(2.5 * 1024 * 1024)]);
    const res = await agent
      .put('/api/v1/users/me/avatar')
      .attach('avatar', big, { filename: 'big.png', contentType: 'image/png' });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('rejects a text file pretending to be a PNG with 415', async () => {
    const { agent } = await signedInUser(ctx.app);
    const res = await agent
      .put('/api/v1/users/me/avatar')
      .attach('avatar', Buffer.from('just some text, definitely not an image'), {
        filename: 'fake.png',
        contentType: 'image/png',
      });
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  it('rejects a disallowed type such as GIF with 415', async () => {
    const { agent } = await signedInUser(ctx.app);
    const res = await agent
      .put('/api/v1/users/me/avatar')
      .attach('avatar', Buffer.from('GIF89a........'), { filename: 'a.gif', contentType: 'image/gif' });
    expect(res.status).toBe(415);
  });

  it('removes the photo and its file', async () => {
    const { agent } = await signedInUser(ctx.app);
    const up = await agent
      .put('/api/v1/users/me/avatar')
      .attach('avatar', PNG, { filename: 'me.png', contentType: 'image/png' });
    expect(await fs.readdir(path.join(ctx.uploadDir, 'avatars'))).toEqual([path.basename(up.body.data.avatarUrl)]);
    const res = await agent.delete('/api/v1/users/me/avatar');
    expect(res.body.data.avatarUrl).toBeNull();
    expect(await fs.readdir(path.join(ctx.uploadDir, 'avatars'))).toEqual([]);
  });
});

describe('preview and other members’ profiles (SB1/US31, US46)', () => {
  it('preview shows my public fields only', async () => {
    const { agent } = await signedInUser(ctx.app, { headline: 'Mentor' });
    const res = await agent.get('/api/v1/users/me/preview');
    expect(res.status).toBe(200);
    expect(res.body.data.profile.headline).toBe('Mentor');
    for (const key of ['email', 'role', 'status', 'lastLoginAt', 'passwordHash', 'tokenVersion']) {
      expect(res.body.data.profile).not.toHaveProperty(key);
    }
  });

  it('another member sees public fields only, with skills populated', async () => {
    const skill = await createSkill({ name: 'React' });
    const { user: other } = await createUser({
      email: 'secret@skillbridge.test',
      teachSkills: [{ skill: skill._id, proficiency: 'expert' }],
    });
    const { agent } = await signedInUser(ctx.app);
    const res = await agent.get(`/api/v1/users/${other._id}`);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('secret@skillbridge.test');
    expect(res.body.data.profile.teachSkills[0]).toMatchObject({ proficiency: 'expert', skill: { name: 'React' } });
  });

  it('returns 404 for a deactivated or unknown member and 400 for a bad id', async () => {
    const { user: gone } = await createUser({ status: 'deactivated', deactivation: { by: 'self' } });
    const { agent } = await signedInUser(ctx.app);
    expect((await agent.get(`/api/v1/users/${gone._id}`)).status).toBe(404);
    expect((await agent.get('/api/v1/users/507f1f77bcf86cd799439011')).status).toBe(404);
    expect((await agent.get('/api/v1/users/not-an-id')).status).toBe(422);
  });
});
