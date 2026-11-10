/**
 * Sprint 2 – advanced skill and mentor discovery against a real MongoDB
 * (SB2/US1–7, US32–42).
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Skill } from '../../src/models/index.js';
import { setupTestApp, resetDatabase, teardownTestApp } from '../helpers/testApp.js';
import { createUser, createCategory, createSkill, signedInUser } from '../helpers/factories.js';

let ctx;
beforeAll(async () => {
  ctx = await setupTestApp();
});
beforeEach(resetDatabase);
afterAll(() => teardownTestApp(ctx));

const evenings = [0, 1, 2, 3, 4].map((day) => ({ day, start: '18:00', end: '21:00' }));
const mornings = [5, 6].map((day) => ({ day, start: '09:00', end: '12:00' }));

/** A small world: two categories, five skills, five mentors in three time zones. */
async function world() {
  const web = await createCategory({ name: 'Web development', slug: 'web' });
  const music = await createCategory({ name: 'Music', slug: 'music' });
  const react = await createSkill({
    name: 'React',
    aliases: ['reactjs', 'react.js'],
    category: web._id,
    description: 'Component-based UI library',
  });
  const reactNative = await createSkill({ name: 'React Native', category: web._id });
  const js = await createSkill({ name: 'JavaScript', aliases: ['js', 'ecmascript'], category: web._id });
  const vue = await createSkill({ name: 'Vue.js', aliases: ['vue'], category: web._id });
  const guitar = await createSkill({ name: 'Guitar', category: music._id, description: 'Acoustic and electric' });
  const teach = (skill, proficiency) => ({ skill: skill._id, proficiency });

  const priya = (
    await createUser({
      name: 'Priya',
      timezone: 'Asia/Kolkata',
      headline: 'React lead',
      bio: 'Ten years of UI work.',
      availability: evenings,
      teachSkills: [teach(react, 'expert'), teach(js, 'advanced')],
    })
  ).user;
  const ethan = (
    await createUser({
      name: 'Ethan',
      timezone: 'America/New_York',
      availability: mornings,
      teachSkills: [teach(reactNative, 'intermediate'), teach(vue, 'advanced')],
    })
  ).user;
  const zara = (
    await createUser({
      name: 'Zara',
      timezone: 'Asia/Kolkata',
      availability: mornings,
      teachSkills: [teach(react, 'beginner'), teach(guitar, 'expert')],
    })
  ).user;
  const paused = (
    await createUser({
      name: 'Omar',
      timezone: 'Asia/Dubai',
      acceptingRequests: false,
      availability: evenings,
      teachSkills: [teach(js, 'expert')],
    })
  ).user;
  await createUser({
    name: 'Vikram',
    status: 'deactivated',
    deactivation: { by: 'admin', reason: 'spam' },
    teachSkills: [teach(react, 'expert')],
  });
  return { web, music, react, reactNative, js, vue, guitar, priya, ethan, zara, paused };
}

const names = (res) => res.body.data.mentors.map((m) => m.name);

describe('searching (SB2/US1, US3, US32, US41, US42)', () => {
  it('matches partial skill names and ranks the closest, most experienced mentors first', async () => {
    await world();
    const { agent } = await signedInUser(ctx.app, { timezone: 'Asia/Kolkata', availability: evenings });
    const res = await agent.get('/api/v1/search/mentors?q=rea');
    expect(res.status).toBe(200);
    // All three match "rea" by prefix; then level and shared time decide:
    // Priya (expert, shares 15 h) > Ethan (React Native, intermediate) > Zara (React, beginner)
    expect(names(res)).toEqual(['Priya', 'Ethan', 'Zara']);
    expect(res.body.data.mentors[0]).toMatchObject({ sharedMinutes: 900, acceptingRequests: true, tzGapHours: 0 });
    expect(res.body.data.mentors[0].relevance).toBeGreaterThan(res.body.data.mentors[1].relevance);
  });

  it('is case-insensitive and normalises spacing and aliases', async () => {
    await world();
    const { agent } = await signedInUser(ctx.app);
    for (const q of ['REACTJS', '  react.JS  ', 'React']) {
      const res = await agent.get(`/api/v1/search/mentors?q=${encodeURIComponent(q)}`);
      expect(names(res)).toEqual(expect.arrayContaining(['Priya', 'Zara']));
    }
  });

  it('accepts several terms separated by commas or "or"', async () => {
    await world();
    const { agent } = await signedInUser(ctx.app);
    const res = await agent.get('/api/v1/search/mentors?q=vue%2C%20guitar');
    expect(names(res).sort()).toEqual(['Ethan', 'Zara']);
    expect(res.body.meta.terms).toEqual(['vue', 'guitar']);
    const or = await agent.get('/api/v1/search/mentors?q=vue%20or%20guitar');
    expect(names(or).sort()).toEqual(['Ethan', 'Zara']);
  });

  it('uses the text index to find single words inside a longer phrase (SB2/US33)', async () => {
    await world();
    const { agent } = await signedInUser(ctx.app);
    const res = await agent.get('/api/v1/search/mentors?q=acoustic%20lessons');
    expect(names(res)).toEqual(['Zara']);
    const indexes = await Skill.collection.indexes();
    expect(indexes.find((i) => i.name === 'skill_text')).toBeTruthy();
  });

  it('lists every active mentor when there is no query, and never the searcher', async () => {
    const w = await world();
    const { agent } = await signedInUser(ctx.app);
    const res = await agent.get('/api/v1/search/mentors');
    expect(names(res).sort()).toEqual(['Ethan', 'Omar', 'Priya', 'Zara']);
    const self = await (await import('../helpers/factories.js')).loginAgent(ctx.app, w.priya.email);
    expect(names(await self.get('/api/v1/search/mentors'))).not.toContain('Priya');
  });

  it('marks mentors who are not taking requests instead of hiding them', async () => {
    await world();
    const { agent } = await signedInUser(ctx.app);
    const res = await agent.get('/api/v1/search/mentors?q=javascript');
    expect(res.body.data.mentors.find((m) => m.name === 'Omar').acceptingRequests).toBe(false);
  });
});

describe('filters (SB2/US4–7, US40)', () => {
  it('filters by category', async () => {
    const w = await world();
    const { agent } = await signedInUser(ctx.app);
    const res = await agent.get(`/api/v1/search/mentors?category=${w.music._id}`);
    expect(names(res)).toEqual(['Zara']);
    expect(res.body.data.mentors[0].matchedSkills.map((s) => s.name)).toEqual(['Guitar']);
    expect(res.body.meta.appliedFilters).toEqual({ category: String(w.music._id) });
  });

  it('filters by minimum proficiency', async () => {
    await world();
    const { agent } = await signedInUser(ctx.app);
    const res = await agent.get('/api/v1/search/mentors?q=react&proficiency=advanced');
    expect(names(res)).toEqual(['Priya']);
  });

  it('filters by availability in the searcher’s own time zone', async () => {
    await world();
    // Searcher in London asks for weekday 12:30–15:30 London time = 18:00–21:00 in Kolkata (November, GMT).
    const { agent } = await signedInUser(ctx.app, { timezone: 'Europe/London' });
    const res = await agent.get('/api/v1/search/mentors?days=0,1,2&from=12:30&to=15:30');
    expect(names(res).sort()).toEqual(['Omar', 'Priya']);
    expect(res.body.data.mentors.every((m) => m.windowMinutes >= 30)).toBe(true);
    const weekend = await agent.get('/api/v1/search/mentors?days=5,6');
    expect(names(weekend).sort()).toEqual(['Ethan', 'Zara']);
  });

  it('filters by time-zone compatibility (within 3 hours)', async () => {
    await world();
    const { agent } = await signedInUser(ctx.app, { timezone: 'Asia/Kolkata' });
    const res = await agent.get('/api/v1/search/mentors?tzCompatible=true');
    expect(names(res).sort()).toEqual(['Omar', 'Priya', 'Zara']);
  });

  it('returns the full list again when filters are cleared', async () => {
    await world();
    const { agent } = await signedInUser(ctx.app);
    const filtered = await agent.get('/api/v1/search/mentors?q=react&proficiency=expert');
    const cleared = await agent.get('/api/v1/search/mentors?q=react');
    expect(filtered.body.meta.total).toBe(1);
    expect(cleared.body.meta.total).toBe(3);
    expect(cleared.body.meta.appliedFilters).toEqual({});
  });

  it('rejects invalid filter values with field errors', async () => {
    await world();
    const { agent } = await signedInUser(ctx.app);
    const res = await agent.get('/api/v1/search/mentors?days=9&from=21:00&to=18:00&proficiency=guru&sort=random');
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.fields).sort()).toEqual(['days.0', 'proficiency', 'sort', 'to']);
  });
});

describe('sorting, counts, paging and limits (SB2/US3, US36, US37, US39)', () => {
  it('sorts by name, newest and shared availability', async () => {
    await world();
    const { agent } = await signedInUser(ctx.app, { timezone: 'Asia/Kolkata', availability: mornings });
    expect(names(await agent.get('/api/v1/search/mentors?sort=name'))).toEqual(['Ethan', 'Omar', 'Priya', 'Zara']);
    expect(names(await agent.get('/api/v1/search/mentors?sort=newest'))[0]).toBe('Omar');
    expect(names(await agent.get('/api/v1/search/mentors?sort=availability'))[0]).toBe('Zara');
  });

  it('paginates with a total count and caps the page size at 50', async () => {
    await world();
    const { agent } = await signedInUser(ctx.app);
    const first = await agent.get('/api/v1/search/mentors?sort=name&limit=2&page=1');
    const second = await agent.get('/api/v1/search/mentors?sort=name&limit=2&page=2');
    expect(names(first)).toEqual(['Ethan', 'Omar']);
    expect(names(second)).toEqual(['Priya', 'Zara']);
    expect(first.body.meta).toMatchObject({ total: 4, totalPages: 2, page: 1, limit: 2 });
    expect((await agent.get('/api/v1/search/mentors?limit=51')).status).toBe(422);
  });
});

describe('empty results and unsafe input (SB2/US35, US38)', () => {
  it('returns related skill ideas when nothing matches', async () => {
    await world();
    const { agent } = await signedInUser(ctx.app);
    const res = await agent.get('/api/v1/search/mentors?q=reactive%20programming%20zzz');
    expect(res.body.meta.total).toBe(0);
    expect(res.body.meta.relatedSkills.map((s) => s.name)).toContain('React');
    expect(res.body.meta.relatedSkills[0]).toHaveProperty('mentorCount');
  });

  it('handles operators, quotes and control characters safely', async () => {
    await world();
    const { agent } = await signedInUser(ctx.app);
    // Express 5's simple query parser never builds objects, so "q[$ne]" is just an unknown key.
    const operator = await agent.get('/api/v1/search/mentors?q[$ne]=x');
    expect(operator.status).toBe(200);
    expect(operator.body.meta.query).toBe('');
    expect((await agent.get('/api/v1/search/mentors?q=a&q=b')).status).toBe(422);
    const quoted = await agent.get(`/api/v1/search/mentors?q=${encodeURIComponent('"react" -guitar\u0000')}`);
    expect(quoted.status).toBe(200);
    expect(names(quoted)).toEqual(expect.arrayContaining(['Priya']));
    expect((await agent.get('/api/v1/search/mentors?q=%24where')).body.data.mentors).toEqual([]);
  });
});

describe('suggestions and related skills (SB2/US2)', () => {
  it('suggests approved skills, best match first, with mentor counts', async () => {
    const w = await world();
    await createSkill({ name: 'Reaction chemistry', status: 'pending', category: w.web._id });
    const { agent } = await signedInUser(ctx.app);
    const res = await agent.get('/api/v1/skills/suggest?q=rea');
    expect(res.status).toBe(200);
    expect(res.body.data.skills.map((s) => s.name)).toEqual(['React', 'React Native']);
    expect(res.body.data.skills[0]).toMatchObject({ mentorCount: 2, category: { name: 'Web development' } });
    expect((await agent.get('/api/v1/skills/suggest?q=js')).body.data.skills[0].name).toBe('JavaScript');
    expect((await agent.get('/api/v1/skills/suggest')).status).toBe(422);
  });

  it('lists related skills from the same category', async () => {
    const w = await world();
    const { agent } = await signedInUser(ctx.app);
    const res = await agent.get(`/api/v1/skills/${w.react._id}/related`);
    expect(res.body.data.skills.map((s) => s.name)).toEqual(['JavaScript', 'React Native', 'Vue.js']);
    expect((await agent.get(`/api/v1/skills/${new mongoose.Types.ObjectId()}/related`)).status).toBe(404);
  });

  it('requires a signed-in user', async () => {
    const request = (await import('supertest')).default;
    expect((await request(ctx.app).get('/api/v1/skills/suggest?q=re')).status).toBe(401);
  });
});
