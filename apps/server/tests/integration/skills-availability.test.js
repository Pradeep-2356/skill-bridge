import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Skill } from '../../src/models/Skill.js';
import { User } from '../../src/models/User.js';
import { setupTestApp, resetDatabase, teardownTestApp } from '../helpers/testApp.js';
import { signedInUser, createCategory, createSkill } from '../helpers/factories.js';

let ctx;
beforeAll(async () => {
  ctx = await setupTestApp();
});
afterAll(() => teardownTestApp(ctx));
beforeEach(() => resetDatabase());

describe('catalogue (SB1/US19–22)', () => {
  it('lists active categories in order', async () => {
    await createCategory({ name: 'Music', slug: 'music', order: 2 });
    await createCategory({ name: 'Design', slug: 'design', order: 1 });
    await createCategory({ name: 'Hidden', slug: 'hidden', isActive: false });
    const { agent } = await signedInUser(ctx.app);
    const res = await agent.get('/api/v1/categories');
    expect(res.body.data.categories.map((c) => c.name)).toEqual(['Design', 'Music']);
  });

  it('finds catalogue skills by name or alias, names starting with the query first', async () => {
    const cat = await createCategory();
    await createSkill({ name: 'React', aliases: ['reactjs'], category: cat._id });
    await createSkill({ name: 'Preact', category: cat._id });
    await createSkill({ name: 'JavaScript', aliases: ['js'], category: cat._id });
    const { agent } = await signedInUser(ctx.app);
    const byName = await agent.get('/api/v1/skills?q=react');
    expect(byName.body.data.skills.map((s) => s.name)).toEqual(['React', 'Preact']);
    const byAlias = await agent.get('/api/v1/skills?q=JS');
    expect(byAlias.body.data.skills.map((s) => s.name)).toContain('JavaScript');
  });

  it("hides other people's pending custom skills", async () => {
    const cat = await createCategory();
    await createSkill({ name: 'Secret Craft', status: 'pending', category: cat._id });
    const { agent } = await signedInUser(ctx.app);
    const res = await agent.get('/api/v1/skills?q=secret');
    expect(res.body.data.skills).toEqual([]);
  });
});

describe('teach and learn skills (SB1/US20–26)', () => {
  it('adds several teaching skills with proficiency and lists them (SB1/US20, US21, US25)', async () => {
    const react = await createSkill({ name: 'React' });
    const node = await createSkill({ name: 'Node.js' });
    const { agent } = await signedInUser(ctx.app);
    const a = await agent
      .post('/api/v1/users/me/teach-skills')
      .send({ skillId: String(react._id), proficiency: 'expert', yearsExperience: 5, description: 'Hooks' });
    const b = await agent
      .post('/api/v1/users/me/teach-skills')
      .send({ skillId: String(node._id), proficiency: 'advanced' });
    expect(a.status).toBe(201);
    expect(a.body.data.entry).toMatchObject({
      proficiency: 'expert',
      yearsExperience: 5,
      description: 'Hooks',
      skill: { name: 'React' },
    });
    expect(b.status).toBe(201);
    const list = await agent.get('/api/v1/users/me/skills');
    expect(list.body.data.teachSkills.map((t) => t.skill.name)).toEqual(['React', 'Node.js']);
  });

  it('adds several learning skills with a preferred level (SB1/US22, US26)', async () => {
    const py = await createSkill({ name: 'Python' });
    const { agent } = await signedInUser(ctx.app);
    const res = await agent
      .post('/api/v1/users/me/learn-skills')
      .send({ skillId: String(py._id), preferredLevel: 'beginner', goal: 'Automate reports' });
    expect(res.status).toBe(201);
    expect(res.body.data.entry).toMatchObject({ preferredLevel: 'beginner', goal: 'Automate reports' });
  });

  it('rejects the same skill twice with 409', async () => {
    const react = await createSkill({ name: 'React' });
    const { agent } = await signedInUser(ctx.app);
    await agent.post('/api/v1/users/me/teach-skills').send({ skillId: String(react._id), proficiency: 'expert' });
    const dup = await agent
      .post('/api/v1/users/me/teach-skills')
      .send({ skillId: String(react._id), proficiency: 'beginner' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('SKILL_ALREADY_ADDED');
  });

  it('creates a pending custom skill, and reuses an existing skill typed with different spacing or case', async () => {
    const cat = await createCategory();
    await createSkill({ name: 'Node.js', aliases: ['nodejs'], category: cat._id });
    const { agent, user } = await signedInUser(ctx.app);

    const custom = await agent
      .post('/api/v1/users/me/teach-skills')
      .send({ customName: 'Origami', categoryId: String(cat._id), proficiency: 'advanced' });
    expect(custom.status).toBe(201);
    expect(custom.body.data.entry.skill).toMatchObject({ name: 'Origami', status: 'pending' });
    const created = await Skill.findOne({ normalizedName: 'origami' });
    expect(String(created.createdBy)).toBe(String(user._id));

    const reused = await agent
      .post('/api/v1/users/me/learn-skills')
      .send({ customName: '  NODEJS ', categoryId: String(cat._id), preferredLevel: 'beginner' });
    expect(reused.body.data.entry.skill.name).toBe('Node.js');
    expect(await Skill.countDocuments()).toBe(2);
  });

  it('edits and removes a skill entry (SB1/US23, US24)', async () => {
    const react = await createSkill({ name: 'React' });
    const { agent } = await signedInUser(ctx.app);
    const { body } = await agent
      .post('/api/v1/users/me/teach-skills')
      .send({ skillId: String(react._id), proficiency: 'beginner' });
    const id = body.data.entry.id;

    const edited = await agent
      .patch(`/api/v1/users/me/teach-skills/${id}`)
      .send({ proficiency: 'advanced', description: 'Now advanced' });
    expect(edited.body.data.entry).toMatchObject({ proficiency: 'advanced', description: 'Now advanced' });

    expect((await agent.delete(`/api/v1/users/me/teach-skills/${id}`)).status).toBe(204);
    expect((await agent.delete(`/api/v1/users/me/teach-skills/${id}`)).status).toBe(404);
  });

  it("cannot edit or delete another user's skill entry", async () => {
    const react = await createSkill({ name: 'React' });
    const owner = await signedInUser(ctx.app);
    const { body } = await owner.agent
      .post('/api/v1/users/me/teach-skills')
      .send({ skillId: String(react._id), proficiency: 'expert' });
    const intruder = await signedInUser(ctx.app);
    const res = await intruder.agent
      .patch(`/api/v1/users/me/teach-skills/${body.data.entry.id}`)
      .send({ proficiency: 'beginner' });
    expect(res.status).toBe(404);
    const stored = await User.findById(owner.user._id);
    expect(stored.teachSkills[0].proficiency).toBe('expert');
  });

  it('limits each list to 20 skills', async () => {
    const cat = await createCategory();
    const skills = await Skill.insertMany(
      Array.from({ length: 21 }, (_, i) => ({ name: `Skill ${i}`, normalizedName: `skill ${i}`, category: cat._id })),
    );
    const { agent, user } = await signedInUser(ctx.app);
    await User.updateOne(
      { _id: user._id },
      { $set: { teachSkills: skills.slice(0, 20).map((s) => ({ skill: s._id, proficiency: 'beginner' })) } },
    );
    const res = await agent
      .post('/api/v1/users/me/teach-skills')
      .send({ skillId: String(skills[20]._id), proficiency: 'beginner' });
    expect(res.status).toBe(422);
    expect(res.body.error.fields._form).toMatch(/up to 20/);
  });

  it('validates levels and required fields', async () => {
    const { agent } = await signedInUser(ctx.app);
    const res = await agent.post('/api/v1/users/me/teach-skills').send({ proficiency: 'guru' });
    expect(res.status).toBe(422);
    expect(res.body.error.fields).toMatchObject({
      skillId: 'Choose a skill',
      proficiency: 'Choose a proficiency level',
    });
  });
});

describe('availability and time zone (SB1/US27–29)', () => {
  it('saves weekly ranges sorted by day and time together with the time zone', async () => {
    const { agent } = await signedInUser(ctx.app);
    const res = await agent.put('/api/v1/users/me/availability').send({
      timezone: 'America/New_York',
      slots: [
        { day: 4, start: '18:00', end: '20:00' },
        { day: 0, start: '09:00', end: '10:30' },
        { day: 0, start: '07:00', end: '08:00' },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      timezone: 'America/New_York',
      slots: [
        { day: 0, start: '07:00', end: '08:00' },
        { day: 0, start: '09:00', end: '10:30' },
        { day: 4, start: '18:00', end: '20:00' },
      ],
    });
    expect((await agent.get('/api/v1/users/me/availability')).body.data.slots).toHaveLength(3);
  });

  it('rejects overlapping ranges, bad times and unknown zones', async () => {
    const { agent } = await signedInUser(ctx.app);
    const overlap = await agent.put('/api/v1/users/me/availability').send({
      timezone: 'UTC',
      slots: [
        { day: 1, start: '09:00', end: '11:00' },
        { day: 1, start: '10:30', end: '12:00' },
      ],
    });
    expect(overlap.status).toBe(422);
    expect(overlap.body.error.fields['slots.1.start']).toMatch(/overlaps/);

    const offStep = await agent
      .put('/api/v1/users/me/availability')
      .send({ timezone: 'UTC', slots: [{ day: 1, start: '09:10', end: '10:00' }] });
    expect(offStep.status).toBe(422);

    const zone = await agent.put('/api/v1/users/me/availability').send({ timezone: 'Mars/Base', slots: [] });
    expect(zone.body.error.fields.timezone).toBe('Choose a valid time zone');
  });

  it('allows clearing all availability', async () => {
    const { agent } = await signedInUser(ctx.app, { availability: [{ day: 0, start: '09:00', end: '10:00' }] });
    const res = await agent.put('/api/v1/users/me/availability').send({ timezone: 'UTC', slots: [] });
    expect(res.body.data.slots).toEqual([]);
  });
});
