import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { User, Session, Skill, RefreshToken } from '../../src/models/index.js';
import { setupTestApp, resetDatabase, teardownTestApp } from '../helpers/testApp.js';
import {
  signedInUser,
  createUser,
  createSkill,
  createSession,
  loginAgent,
  DEFAULT_PASSWORD,
} from '../helpers/factories.js';

let ctx;
beforeAll(async () => {
  ctx = await setupTestApp();
});
afterAll(() => teardownTestApp(ctx));
beforeEach(() => resetDatabase());

const DAY = 86_400_000;

describe('dashboard and sessions (SB1/US35–39)', () => {
  it('aggregates profile completion, skills, sessions and counts', async () => {
    const react = await createSkill({ name: 'React' });
    const { agent, user } = await signedInUser(ctx.app, {
      headline: 'Mentor',
      teachSkills: [{ skill: react._id, proficiency: 'expert' }],
    });
    const { user: other } = await createUser({ name: 'Arjun Mehta' });
    await createSession({
      learner: other._id,
      mentor: user._id,
      skill: react._id,
      startsAt: new Date(Date.now() + 2 * DAY),
    });
    await createSession({
      learner: other._id,
      mentor: user._id,
      skill: react._id,
      startsAt: new Date(Date.now() - 2 * DAY),
      status: 'completed',
    });

    const res = await agent.get('/api/v1/dashboard');
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.profileCompletion).toMatchObject({ completed: 2, total: 7, percent: 29 });
    expect(d.skills.teach[0].skill.name).toBe('React');
    expect(d.upcomingSessions).toHaveLength(1);
    expect(d.upcomingSessions[0]).toMatchObject({
      role: 'mentor',
      partner: { name: 'Arjun Mehta' },
      skill: { name: 'React' },
      durationMinutes: 30,
    });
    expect(d.recentActivity).toHaveLength(1);
    expect(d.counts).toMatchObject({ teachSkills: 1, learnSkills: 0, upcomingSessions: 1, completedSessions: 1 });
  });

  it('lists only my sessions, split into upcoming and past, with pagination', async () => {
    const skill = await createSkill();
    const { agent, user } = await signedInUser(ctx.app);
    const { user: a } = await createUser();
    const { user: b } = await createUser();
    for (let i = 1; i <= 3; i += 1) {
      await createSession({
        learner: user._id,
        mentor: a._id,
        skill: skill._id,
        startsAt: new Date(Date.now() + i * DAY),
      });
    }
    await createSession({ learner: a._id, mentor: b._id, skill: skill._id, startsAt: new Date(Date.now() + DAY) }); // not mine

    const page1 = await agent.get('/api/v1/sessions?scope=upcoming&limit=2&page=1');
    expect(page1.body.data.sessions).toHaveLength(2);
    expect(page1.body.meta).toMatchObject({ total: 3, totalPages: 2 });
    expect(new Date(page1.body.data.sessions[0].startsAt) < new Date(page1.body.data.sessions[1].startsAt)).toBe(true);

    const past = await agent.get('/api/v1/sessions?scope=past');
    expect(past.body.data.sessions).toEqual([]);
  });

  it('shows "former member" (partner null) when the other person deleted their account', async () => {
    const skill = await createSkill();
    const { agent, user } = await signedInUser(ctx.app);
    const { user: gone, password } = await createUser();
    await createSession({
      learner: user._id,
      mentor: gone._id,
      skill: skill._id,
      startsAt: new Date(Date.now() + DAY),
    });
    const goneAgent = await loginAgent(ctx.app, gone.email, password);
    await goneAgent.delete('/api/v1/users/me').send({ password, confirmText: 'DELETE' });
    const res = await agent.get('/api/v1/sessions');
    expect(res.body.data.sessions[0].partner).toBeNull();
  });
});

describe('keyword search (SB1/US50)', () => {
  async function world() {
    const react = await createSkill({ name: 'React', aliases: ['reactjs'] });
    const cpp = await createSkill({ name: 'C++', aliases: ['cpp'] });
    const { user: priya } = await createUser({
      name: 'Priya',
      teachSkills: [{ skill: react._id, proficiency: 'expert' }],
    });
    await createUser({
      name: 'Vikram',
      status: 'deactivated',
      deactivation: { by: 'admin', reason: 'spam' },
      teachSkills: [{ skill: react._id, proficiency: 'advanced' }],
    });
    await createUser({ name: 'Jack', teachSkills: [{ skill: cpp._id, proficiency: 'advanced' }] });
    await createUser({ name: 'Learner Only', learnSkills: [{ skill: react._id, preferredLevel: 'beginner' }] });
    return { react, priya };
  }

  it('finds active mentors case-insensitively and shows the matched skill and level', async () => {
    await world();
    const { agent } = await signedInUser(ctx.app);
    const res = await agent.get('/api/v1/search/mentors?q=REACT');
    expect(res.status).toBe(200);
    expect(res.body.data.mentors.map((m) => m.name)).toEqual(['Priya']);
    expect(res.body.data.mentors[0].matchedSkills).toEqual([
      expect.objectContaining({ name: 'React', proficiency: 'expert' }),
    ]);
    expect(res.body.meta).toMatchObject({ total: 1, query: 'REACT' });
    expect(res.body.data.mentors[0]).not.toHaveProperty('email');
  });

  it('never returns the person searching', async () => {
    const { react } = await world();
    const { agent } = await signedInUser(ctx.app, { teachSkills: [{ skill: react._id, proficiency: 'beginner' }] });
    const res = await agent.get('/api/v1/search/mentors?q=react');
    expect(res.body.data.mentors.map((m) => m.name)).toEqual(['Priya']);
  });

  it('treats regex characters literally', async () => {
    await world();
    const { agent } = await signedInUser(ctx.app);
    expect((await agent.get('/api/v1/search/mentors?q=c%2B%2B')).body.data.mentors.map((m) => m.name)).toEqual([
      'Jack',
    ]);
    expect((await agent.get('/api/v1/search/mentors?q=.*')).body.data.mentors).toEqual([]);
  });

  it('returns an empty list with total 0 when nothing matches', async () => {
    await world();
    const { agent } = await signedInUser(ctx.app);
    const res = await agent.get('/api/v1/search/mentors?q=underwater%20basket%20weaving');
    expect(res.body.data.mentors).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  it('rejects an empty or over-long query', async () => {
    const { agent } = await signedInUser(ctx.app);
    expect((await agent.get('/api/v1/search/mentors?q=%20%20')).status).toBe(422);
    expect((await agent.get(`/api/v1/search/mentors?q=${'x'.repeat(61)}`)).status).toBe(422);
  });
});

describe('deactivate and delete my account (SB1/US32–34)', () => {
  it('deactivates with the right password, signs me out and lets me come back by logging in', async () => {
    const { agent, user } = await signedInUser(ctx.app);
    expect((await agent.post('/api/v1/users/me/deactivate').send({ password: 'Wr0ng!Pass' })).status).toBe(422);

    const res = await agent.post('/api/v1/users/me/deactivate').send({ password: DEFAULT_PASSWORD });
    expect(res.status).toBe(200);
    expect((await agent.get('/api/v1/users/me')).status).toBe(401);

    const blocked = await request(ctx.app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: DEFAULT_PASSWORD });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.details).toEqual({ canReactivate: true });

    const back = await request(ctx.app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: DEFAULT_PASSWORD, reactivate: true });
    expect(back.status).toBe(200);
    expect((await User.findById(user._id)).status).toBe('active');
  });

  it('requires typing DELETE and the password, then removes the account and its tokens', async () => {
    const { agent, user } = await signedInUser(ctx.app);
    expect(
      (await agent.delete('/api/v1/users/me').send({ password: DEFAULT_PASSWORD, confirmText: 'delete' })).status,
    ).toBe(422);
    const res = await agent.delete('/api/v1/users/me').send({ password: DEFAULT_PASSWORD, confirmText: 'DELETE' });
    expect(res.status).toBe(204);
    expect(await User.findById(user._id)).toBeNull();
    expect(await RefreshToken.countDocuments({ user: user._id })).toBe(0);
    expect(
      (await request(ctx.app).post('/api/v1/auth/login').send({ email: user.email, password: DEFAULT_PASSWORD }))
        .status,
    ).toBe(401);
  });

  it('keeps a custom skill in the catalogue after its creator is deleted', async () => {
    const { agent, user } = await signedInUser(ctx.app);
    const cat = (await createSkill()).category;
    await agent
      .post('/api/v1/users/me/teach-skills')
      .send({ customName: 'Origami', categoryId: String(cat), proficiency: 'advanced' });
    await agent.delete('/api/v1/users/me').send({ password: DEFAULT_PASSWORD, confirmText: 'DELETE' });
    const skill = await Skill.findOne({ normalizedName: 'origami' });
    expect(skill.createdBy).toBeNull();
    expect(String(user._id)).toBeTruthy();
  });

  it('stops the only administrator from deleting their account', async () => {
    const { agent } = await signedInUser(ctx.app, { role: 'admin' });
    const res = await agent.delete('/api/v1/users/me').send({ password: DEFAULT_PASSWORD, confirmText: 'DELETE' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('LAST_ADMIN');
  });
});

describe('admin user management (SB1/US47–49)', () => {
  it('blocks normal users from every admin endpoint with 403', async () => {
    const { agent } = await signedInUser(ctx.app);
    const { user: target } = await createUser();
    expect((await agent.get('/api/v1/admin/users')).status).toBe(403);
    expect((await agent.get(`/api/v1/admin/users/${target._id}`)).status).toBe(403);
    expect(
      (
        await agent
          .patch(`/api/v1/admin/users/${target._id}/status`)
          .send({ status: 'deactivated', reason: 'Testing it' })
      ).status,
    ).toBe(403);
  });

  it('lists users newest first with search, filters, totals and no password hashes (SB1/US47)', async () => {
    const { agent } = await signedInUser(ctx.app, { role: 'admin', name: 'Asha Admin' });
    await createUser({ name: 'Priya Sharma', email: 'priya@skillbridge.test' });
    await createUser({ name: 'Old Account', status: 'deactivated', deactivation: { by: 'self' } });

    const all = await agent.get('/api/v1/admin/users');
    expect(all.status).toBe(200);
    expect(all.body.meta.totals).toEqual({ active: 2, deactivated: 1 });
    expect(all.body.data.users[0].name).toBe('Old Account');
    expect(JSON.stringify(all.body)).not.toMatch(/passwordHash|\$2[aby]\$/);

    expect((await agent.get('/api/v1/admin/users?q=PRIYA')).body.data.users.map((u) => u.email)).toEqual([
      'priya@skillbridge.test',
    ]);
    expect((await agent.get('/api/v1/admin/users?status=deactivated')).body.data.users).toHaveLength(1);
    expect((await agent.get('/api/v1/admin/users?role=admin')).body.data.users.map((u) => u.name)).toEqual([
      'Asha Admin',
    ]);
  });

  it('shows account details for troubleshooting (SB1/US49)', async () => {
    const skill = await createSkill({ name: 'React' });
    const { agent } = await signedInUser(ctx.app, { role: 'admin' });
    const { user } = await createUser({ name: 'Priya', teachSkills: [{ skill: skill._id, proficiency: 'expert' }] });
    await Session.create({ learner: user._id, mentor: null, skill: skill._id, startsAt: new Date() });
    const res = await agent.get(`/api/v1/admin/users/${user._id}`);
    expect(res.body.data.user).toMatchObject({
      name: 'Priya',
      email: user.email,
      teachSkillsCount: 1,
      sessionsCount: 1,
    });
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('deactivates an account with a reason: the user is signed out and cannot log in (SB1/US48)', async () => {
    const { agent } = await signedInUser(ctx.app, { role: 'admin' });
    const { user: target, password } = await createUser();
    const targetAgent = await loginAgent(ctx.app, target.email, password);

    expect((await agent.patch(`/api/v1/admin/users/${target._id}/status`).send({ status: 'deactivated' })).status).toBe(
      422,
    );
    const res = await agent
      .patch(`/api/v1/admin/users/${target._id}/status`)
      .send({ status: 'deactivated', reason: 'Spam messages' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.deactivation).toMatchObject({ by: 'admin', reason: 'Spam messages' });

    expect((await targetAgent.get('/api/v1/auth/me')).status).toBe(403);
    expect((await targetAgent.post('/api/v1/auth/refresh')).status).toBe(401);
    const login = await request(ctx.app)
      .post('/api/v1/auth/login')
      .send({ email: target.email, password, reactivate: true });
    expect(login.status).toBe(403);
    expect(login.body.error.details).toEqual({ canReactivate: false });

    const back = await agent.patch(`/api/v1/admin/users/${target._id}/status`).send({ status: 'active' });
    expect(back.body.data.user.status).toBe('active');
    expect((await request(ctx.app).post('/api/v1/auth/login').send({ email: target.email, password })).status).toBe(
      200,
    );
  });

  it('does not let an admin deactivate themselves', async () => {
    const { agent, user } = await signedInUser(ctx.app, { role: 'admin' });
    const res = await agent
      .patch(`/api/v1/admin/users/${user._id}/status`)
      .send({ status: 'deactivated', reason: 'Oops mistake' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_DEACTIVATE_SELF');
  });
});
