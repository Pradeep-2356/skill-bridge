/**
 * Sprint 2 – notifications, admin catalogue review and route protection
 * (SB2/US29, US42, US47).
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { Category, Notification, Skill, User } from '../../src/models/index.js';
import { notify } from '../../src/services/notificationService.js';
import { setupTestApp, resetDatabase, teardownTestApp } from '../helpers/testApp.js';
import { createUser, createCategory, createSkill, signedInUser } from '../helpers/factories.js';

let ctx;
beforeAll(async () => {
  ctx = await setupTestApp();
});
beforeEach(resetDatabase);
afterAll(() => teardownTestApp(ctx));

const ID = '507f1f77bcf86cd799439011';

describe('every Sprint 2 endpoint requires a signed-in user', () => {
  it.each([
    ['get', '/api/v1/skills/suggest?q=re'],
    ['get', `/api/v1/skills/${ID}/related`],
    ['get', `/api/v1/mentors/${ID}`],
    ['patch', '/api/v1/users/me/accepting-requests'],
    ['post', '/api/v1/match-requests'],
    ['get', '/api/v1/match-requests'],
    ['get', `/api/v1/match-requests/${ID}`],
    ['patch', `/api/v1/match-requests/${ID}/accept`],
    ['patch', `/api/v1/match-requests/${ID}/decline`],
    ['patch', `/api/v1/match-requests/${ID}/cancel`],
    ['post', `/api/v1/match-requests/${ID}/retry`],
    ['get', '/api/v1/matches/suggestions'],
    ['get', '/api/v1/notifications'],
    ['get', '/api/v1/notifications/unread-count'],
    ['post', '/api/v1/notifications/read-all'],
    ['patch', `/api/v1/notifications/${ID}/read`],
    ['get', '/api/v1/admin/categories'],
    ['post', '/api/v1/admin/categories'],
    ['patch', `/api/v1/admin/categories/${ID}`],
    ['delete', `/api/v1/admin/categories/${ID}`],
    ['get', '/api/v1/admin/skills'],
    ['patch', `/api/v1/admin/skills/${ID}`],
  ])('%s %s → 401', async (method, url) => {
    const res = await request(ctx.app)[method](url).set('Origin', 'http://localhost:5173');
    expect(res.status).toBe(401);
  });
});

describe('notifications (SB2/US29)', () => {
  async function inbox() {
    const me = await signedInUser(ctx.app);
    const other = await createUser();
    for (let i = 1; i <= 3; i += 1) {
      await notify(me.user._id, { type: 'request_received', title: `Request ${i}`, link: '/requests' });
    }
    await notify(other.user._id, { type: 'request_received', title: 'Not yours' });
    return { ...me, other: other.user };
  }

  it('lists my notifications newest first with an unread count', async () => {
    const { agent } = await inbox();
    const res = await agent.get('/api/v1/notifications');
    expect(res.body.data.notifications.map((n) => n.title)).toEqual(['Request 3', 'Request 2', 'Request 1']);
    expect(res.body.meta).toMatchObject({ total: 3, unreadCount: 3 });
    expect((await agent.get('/api/v1/notifications/unread-count')).body.data).toEqual({ unreadCount: 3 });
  });

  it('marks one or all as read, and filters unread', async () => {
    const { agent } = await inbox();
    const [newest] = (await agent.get('/api/v1/notifications')).body.data.notifications;
    const one = await agent.patch(`/api/v1/notifications/${newest.id}/read`);
    expect(one.body.data.notification).toMatchObject({ id: newest.id, read: true });
    const unread = await agent.get('/api/v1/notifications?unread=true');
    expect(unread.body.data.notifications.map((n) => n.title)).toEqual(['Request 2', 'Request 1']);
    expect((await agent.post('/api/v1/notifications/read-all')).body.data).toEqual({ updated: 2 });
    expect((await agent.get('/api/v1/notifications/unread-count')).body.data.unreadCount).toBe(0);
    expect((await agent.get('/api/v1/notifications')).body.data.notifications.every((n) => n.read)).toBe(true);
  });

  it('never shows or changes another member’s notifications', async () => {
    const { agent, other } = await inbox();
    const theirs = await Notification.findOne({ user: other._id });
    expect((await agent.patch(`/api/v1/notifications/${theirs._id}/read`)).status).toBe(404);
    expect((await Notification.findById(theirs._id)).readAt).toBeNull();
    expect((await agent.get('/api/v1/notifications')).body.data.notifications.map((n) => n.title)).not.toContain(
      'Not yours',
    );
  });

  it('pages through history', async () => {
    const { agent } = await inbox();
    const page2 = await agent.get('/api/v1/notifications?limit=2&page=2');
    expect(page2.body.data.notifications.map((n) => n.title)).toEqual(['Request 1']);
    expect(page2.body.meta).toMatchObject({ totalPages: 2, page: 2 });
  });
});

describe('admin catalogue review (SB2/US47, US42)', () => {
  async function catalogue() {
    const web = await createCategory({ name: 'Web', slug: 'web', order: 1 });
    const empty = await createCategory({ name: 'Empty', slug: 'empty', order: 2 });
    const react = await createSkill({ name: 'React', category: web._id });
    const { user: author } = await createUser({ name: 'Arjun', learningInterests: [empty._id] });
    const pending = await createSkill({
      name: 'Svelte Kit',
      category: web._id,
      status: 'pending',
      createdBy: author._id,
    });
    await User.updateOne(
      { _id: author._id },
      { $push: { teachSkills: { skill: pending._id, proficiency: 'advanced' } } },
    );
    await createUser({ teachSkills: [{ skill: react._id, proficiency: 'expert' }] });
    const admin = await signedInUser(ctx.app, { role: 'admin' });
    return { web, empty, react, pending, author, admin: admin.agent };
  }

  it('members cannot use it', async () => {
    await catalogue();
    const { agent } = await signedInUser(ctx.app);
    expect((await agent.get('/api/v1/admin/categories')).status).toBe(403);
    expect((await agent.post('/api/v1/admin/categories').send({ name: 'Hack' })).status).toBe(403);
    expect((await agent.get('/api/v1/admin/skills')).status).toBe(403);
  });

  it('lists categories with skill, pending and mentor counts', async () => {
    const { admin } = await catalogue();
    const res = await admin.get('/api/v1/admin/categories');
    expect(res.body.data.categories.map((c) => [c.name, c.skillCount, c.pendingCount, c.mentorCount])).toEqual([
      ['Web', 2, 1, 2],
      ['Empty', 0, 0, 0],
    ]);
  });

  it('creates, renames, hides and deletes categories with clear conflicts', async () => {
    const { admin, web, empty, author } = await catalogue();
    const created = await admin.post('/api/v1/admin/categories').send({ name: 'Cooking & Food', icon: 'chef-hat' });
    expect(created.status).toBe(201);
    expect(created.body.data.category).toMatchObject({
      name: 'Cooking & Food',
      slug: 'cooking-food',
      isActive: true,
      order: 3,
    });
    const dup = await admin.post('/api/v1/admin/categories').send({ name: 'web' });
    expect([dup.status, dup.body.error.code, dup.body.error.fields.name]).toEqual([
      409,
      'NAME_TAKEN',
      'A category with this name already exists',
    ]);

    const renamed = await admin
      .patch(`/api/v1/admin/categories/${web._id}`)
      .send({ name: 'Web development', isActive: false });
    expect(renamed.body.data.category).toMatchObject({ slug: 'web-development', isActive: false });
    const { agent: member } = await signedInUser(ctx.app);
    expect((await member.get('/api/v1/categories')).body.data.categories.map((c) => c.name)).not.toContain(
      'Web development',
    );

    const inUse = await admin.delete(`/api/v1/admin/categories/${web._id}`);
    expect([inUse.status, inUse.body.error.code]).toEqual([409, 'CATEGORY_IN_USE']);
    expect((await admin.delete(`/api/v1/admin/categories/${empty._id}`)).status).toBe(204);
    expect(await Category.findById(empty._id)).toBeNull();
    expect((await User.findById(author._id)).learningInterests).toEqual([]);
    expect(
      (await admin.patch(`/api/v1/admin/categories/${new mongoose.Types.ObjectId()}`).send({ name: 'X y' })).status,
    ).toBe(404);
  });

  it('reviews pending custom skills: approve, rename, re-categorise and add aliases', async () => {
    const { admin, pending, empty } = await catalogue();
    const list = await admin.get('/api/v1/admin/skills?status=pending');
    expect(list.body.data.skills).toEqual([
      expect.objectContaining({
        name: 'Svelte Kit',
        createdBy: expect.objectContaining({ name: 'Arjun' }),
        teachers: 1,
        learners: 0,
      }),
    ]);
    const res = await admin
      .patch(`/api/v1/admin/skills/${pending._id}`)
      .send({
        status: 'approved',
        name: 'SvelteKit',
        aliases: ['Svelte kit', 'sveltekit'],
        categoryId: String(empty._id),
      });
    expect(res.body.data.skill).toMatchObject({
      name: 'SvelteKit',
      status: 'approved',
      aliases: ['svelte kit', 'sveltekit'],
      category: { name: 'Empty' },
    });
    expect((await Skill.findById(pending._id)).normalizedName).toBe('sveltekit');
    expect((await admin.get('/api/v1/admin/skills?status=pending')).body.data.skills).toEqual([]);

    // Approved skills now appear in suggestions, found by their new alias (SB2/US42).
    const { agent } = await signedInUser(ctx.app);
    expect((await agent.get('/api/v1/skills/suggest?q=svelte%20kit')).body.data.skills.map((s) => s.name)).toEqual([
      'SvelteKit',
    ]);
  });

  it('refuses a rename that clashes with another skill', async () => {
    const { admin, pending } = await catalogue();
    const res = await admin.patch(`/api/v1/admin/skills/${pending._id}`).send({ name: 'REACT' });
    expect([res.status, res.body.error.code]).toEqual([409, 'NAME_TAKEN']);
    expect((await admin.patch(`/api/v1/admin/skills/${pending._id}`).send({})).status).toBe(422);
  });
});
