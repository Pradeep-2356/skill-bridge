/**
 * Sprint 2 – learning requests, the local queue, matching and mentor profiles
 * against a real Express app and MongoDB (SB2/US8–31, US43–46, US48–50).
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import mongoose from 'mongoose';
import { MatchRequest, Notification, QueueMessage, Session, Skill } from '../../src/models/index.js';
import { processRequest } from '../../src/services/matching/matchingService.js';
import { setupTestApp, resetDatabase, teardownTestApp } from '../helpers/testApp.js';
import { createUser, createCategory, createSkill, loginAgent, signedInUser } from '../helpers/factories.js';

let ctx;
beforeAll(async () => {
  ctx = await setupTestApp();
});
beforeEach(resetDatabase);
afterAll(() => teardownTestApp(ctx));

const drain = (now) => ctx.app.locals.runtime.worker.drain({ now });
const evenings = [0, 1, 2, 3, 4].map((day) => ({ day, start: '18:00', end: '21:00' }));
const mornings = [5, 6].map((day) => ({ day, start: '09:00', end: '12:00' }));

async function world() {
  const cat = await createCategory({ name: 'Tech', slug: 'tech' });
  const react = await createSkill({ name: 'React', category: cat._id });
  const python = await createSkill({ name: 'Python', category: cat._id });
  const rust = await createSkill({ name: 'Rust', category: cat._id });
  const t = (skill, proficiency) => ({ skill: skill._id, proficiency });
  const l = (skill, preferredLevel) => ({ skill: skill._id, preferredLevel });

  const priya = (
    await createUser({
      name: 'Priya',
      timezone: 'Asia/Kolkata',
      availability: evenings,
      teachSkills: [t(react, 'expert')],
      learnSkills: [l(python, 'beginner')],
    })
  ).user;
  const zara = (
    await createUser({
      name: 'Zara',
      timezone: 'Asia/Kolkata',
      availability: mornings,
      teachSkills: [t(react, 'beginner')],
    })
  ).user;
  const ethan = (
    await createUser({
      name: 'Ethan',
      timezone: 'America/New_York',
      availability: mornings,
      teachSkills: [t(react, 'advanced')],
    })
  ).user;
  const omar = (
    await createUser({
      name: 'Omar',
      timezone: 'Asia/Kolkata',
      acceptingRequests: false,
      availability: evenings,
      teachSkills: [t(react, 'expert')],
    })
  ).user;
  const vikram = (
    await createUser({
      name: 'Vikram',
      status: 'deactivated',
      deactivation: { by: 'admin', reason: 'spam' },
      availability: evenings,
      teachSkills: [t(react, 'expert')],
    })
  ).user;
  const noTime = (await createUser({ name: 'Nora', timezone: 'Asia/Kolkata', teachSkills: [t(rust, 'expert')] })).user;
  const arjun = await signedInUser(ctx.app, {
    name: 'Arjun',
    timezone: 'Asia/Kolkata',
    availability: evenings,
    teachSkills: [t(python, 'advanced')],
    learnSkills: [l(react, 'beginner')],
  });
  return { react, python, rust, priya, zara, ethan, omar, vikram, noTime, arjun };
}

const asUser = (user) => loginAgent(ctx.app, user.email);

describe('sending a direct learning request (SB2/US12, US13, US23, US24, US43)', () => {
  it('queues the request, then the worker scores it, proposes a time and tells the mentor', async () => {
    const w = await world();
    const res = await w.arjun.agent
      .post('/api/v1/match-requests')
      .send({ mentorId: String(w.priya._id), skillId: String(w.react._id), message: 'Hi Priya!' });
    expect(res.status).toBe(202);
    expect(res.body.data.request).toMatchObject({
      status: 'queued',
      mode: 'direct',
      role: 'learner',
      message: 'Hi Priya!',
    });
    expect(await QueueMessage.countDocuments()).toBe(1);

    await drain();
    const detail = await w.arjun.agent.get(`/api/v1/match-requests/${res.body.data.request.id}`);
    expect(detail.body.data.request).toMatchObject({
      status: 'pending',
      partner: { name: 'Priya' },
      score: { skill: 35, level: 20, availability: 25, timezone: 10, exchange: 10, total: 100 },
      actions: { canCancel: true, canAccept: false },
    });
    expect(detail.body.data.request.reasons[0]).toBe(
      'Teaches React at Expert level (above the beginner level you want)',
    );
    expect(detail.body.data.request.proposedSlot).toMatchObject({ shared: true });
    expect(detail.body.data.request.history.map((h) => h.status)).toEqual(['queued', 'pending']);
    expect(await QueueMessage.countDocuments()).toBe(0);

    const mentor = await asUser(w.priya);
    const incoming = await mentor.get('/api/v1/match-requests?box=incoming&status=open');
    expect(incoming.body.data.requests.map((r) => r.learner.name)).toEqual(['Arjun']);
    expect(incoming.body.meta.counts).toMatchObject({ open: 1, pending: 1, accepted: 0, closed: 0 });
    const notes = await mentor.get('/api/v1/notifications');
    expect(notes.body.data.notifications[0]).toMatchObject({ type: 'request_received', read: false });
    expect(notes.body.data.notifications[0].title).toBe('Arjun wants to learn React with you');
  });

  it('rejects requests to yourself, for untaught skills, to paused, unavailable or deactivated mentors', async () => {
    const w = await world();
    const send = (body) => w.arjun.agent.post('/api/v1/match-requests').send(body);
    const self = await send({ mentorId: String(w.arjun.user._id), skillId: String(w.python._id) });
    expect([self.status, self.body.error.code]).toEqual([422, 'SELF_REQUEST']);
    const untaught = await send({ mentorId: String(w.priya._id), skillId: String(w.python._id) });
    expect([untaught.status, untaught.body.error.code]).toEqual([422, 'SKILL_NOT_TAUGHT']);
    const paused = await send({ mentorId: String(w.omar._id), skillId: String(w.react._id) });
    expect([paused.status, paused.body.error.code]).toEqual([403, 'MENTOR_UNAVAILABLE']);
    const noTime = await send({ mentorId: String(w.noTime._id), skillId: String(w.rust._id) });
    expect([noTime.status, noTime.body.error.code]).toEqual([422, 'MENTOR_NO_AVAILABILITY']);
    expect((await send({ mentorId: String(w.vikram._id), skillId: String(w.react._id) })).status).toBe(404);
    expect((await send({ mentorId: 'nope', skillId: String(w.react._id) })).status).toBe(422);
    expect(await MatchRequest.countDocuments()).toBe(0);
  });

  it('prevents a second active request for the same mentor and skill (SB2/US24)', async () => {
    const w = await world();
    const body = { mentorId: String(w.priya._id), skillId: String(w.react._id) };
    const first = await w.arjun.agent.post('/api/v1/match-requests').send(body);
    const second = await w.arjun.agent.post('/api/v1/match-requests').send(body);
    expect(second.status).toBe(409);
    expect(second.body.error).toMatchObject({
      code: 'DUPLICATE_REQUEST',
      details: { requestId: first.body.data.request.id },
    });
    // The database index enforces the same rule even if the service check were skipped.
    await expect(
      MatchRequest.create({ learner: w.arjun.user._id, mentor: w.priya._id, skill: w.react._id, mode: 'direct' }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it('a mentor can pause and resume new requests (SB2/US43)', async () => {
    const w = await world();
    const mentor = await asUser(w.priya);
    const off = await mentor.patch('/api/v1/users/me/accepting-requests').send({ acceptingRequests: false });
    expect(off.body.data).toEqual({ acceptingRequests: false });
    expect((await mentor.get('/api/v1/users/me')).body.data.user.acceptingRequests).toBe(false);
    const blocked = await w.arjun.agent
      .post('/api/v1/match-requests')
      .send({ mentorId: String(w.priya._id), skillId: String(w.react._id) });
    expect(blocked.status).toBe(403);
    await mentor.patch('/api/v1/users/me/accepting-requests').send({ acceptingRequests: true });
    const ok = await w.arjun.agent
      .post('/api/v1/match-requests')
      .send({ mentorId: String(w.priya._id), skillId: String(w.react._id) });
    expect(ok.status).toBe(202);
    expect((await mentor.patch('/api/v1/users/me/accepting-requests').send({ acceptingRequests: 'no' })).status).toBe(
      422,
    );
  });
});

async function pendingRequest(w) {
  const res = await w.arjun.agent
    .post('/api/v1/match-requests')
    .send({ mentorId: String(w.priya._id), skillId: String(w.react._id) });
  await drain();
  return res.body.data.request.id;
}

describe('replying to a request (SB2/US14, US15, US25, US27, US31)', () => {
  it('the mentor accepts: a real session is booked and both people are told', async () => {
    const w = await world();
    const id = await pendingRequest(w);
    expect((await w.arjun.agent.patch(`/api/v1/match-requests/${id}/accept`)).status).toBe(403);

    const mentor = await asUser(w.priya);
    const res = await mentor.patch(`/api/v1/match-requests/${id}/accept`);
    expect(res.status).toBe(200);
    expect(res.body.data.request).toMatchObject({ status: 'accepted', role: 'mentor', actions: { canAccept: false } });
    expect(res.body.data.session).toMatchObject({ durationMinutes: 30, status: 'scheduled' });
    const session = await Session.findById(res.body.data.session.id).lean();
    expect(session).toMatchObject({ source: 'match' });
    expect(String(session.matchRequest)).toBe(id);
    expect(new Date(session.startsAt).getTime()).toBeGreaterThan(Date.now() + 23 * 3600_000);

    const upcoming = await w.arjun.agent.get('/api/v1/sessions?scope=upcoming');
    expect(upcoming.body.data.sessions.map((s) => s.partner?.name)).toContain('Priya');
    const learnerNotes = (await w.arjun.agent.get('/api/v1/notifications')).body.data.notifications;
    expect(learnerNotes[0]).toMatchObject({ type: 'request_accepted', title: 'Priya accepted – you have a match!' });
    expect(learnerNotes[0].body).toMatch(/\(Asia\/Kolkata\)\.$/);

    const again = await mentor.patch(`/api/v1/match-requests/${id}/accept`);
    expect([again.status, again.body.error.code]).toEqual([409, 'INVALID_TRANSITION']);
    const accepted = await w.arjun.agent.get('/api/v1/match-requests?box=outgoing&status=accepted');
    expect(accepted.body.data.requests).toHaveLength(1);
  });

  it('the mentor declines with a reason; the learner sees it and cannot cancel afterwards', async () => {
    const w = await world();
    const id = await pendingRequest(w);
    const mentor = await asUser(w.priya);
    const res = await mentor.patch(`/api/v1/match-requests/${id}/decline`).send({ reason: 'Fully booked this month' });
    expect(res.body.data.request).toMatchObject({ status: 'declined', declineReason: 'Fully booked this month' });
    const note = (await w.arjun.agent.get('/api/v1/notifications')).body.data.notifications[0];
    expect(note).toMatchObject({ type: 'request_declined', body: 'Reason: Fully booked this month' });
    const cancel = await w.arjun.agent.patch(`/api/v1/match-requests/${id}/cancel`);
    expect(cancel.status).toBe(409);
    const closed = await w.arjun.agent.get('/api/v1/match-requests?box=outgoing&status=closed');
    expect(closed.body.data.requests.map((r) => r.status)).toEqual(['declined']);
  });

  it('the learner cancels a pending request and the mentor is told; strangers cannot see it', async () => {
    const w = await world();
    const id = await pendingRequest(w);
    const mentor = await asUser(w.priya);
    expect((await mentor.patch(`/api/v1/match-requests/${id}/cancel`)).status).toBe(403);
    const res = await w.arjun.agent.patch(`/api/v1/match-requests/${id}/cancel`);
    expect(res.body.data.request.status).toBe('cancelled');
    expect((await mentor.get('/api/v1/notifications')).body.data.notifications[0].type).toBe('request_cancelled');

    const stranger = await asUser(w.zara);
    expect((await stranger.get(`/api/v1/match-requests/${id}`)).status).toBe(403);
    expect((await stranger.patch(`/api/v1/match-requests/${id}/decline`).send({})).status).toBe(403);
    expect((await stranger.get(`/api/v1/match-requests/${new mongoose.Types.ObjectId()}`)).status).toBe(404);
  });

  it('a queued request is hidden from the mentor until the worker delivers it', async () => {
    const w = await world();
    const res = await w.arjun.agent
      .post('/api/v1/match-requests')
      .send({ mentorId: String(w.priya._id), skillId: String(w.react._id) });
    const mentor = await asUser(w.priya);
    expect((await mentor.get('/api/v1/match-requests?box=incoming')).body.data.requests).toEqual([]);
    expect((await mentor.get(`/api/v1/match-requests/${res.body.data.request.id}`)).status).toBe(403);
    const cancel = await w.arjun.agent.patch(`/api/v1/match-requests/${res.body.data.request.id}/cancel`);
    expect(cancel.body.data.request.status).toBe('cancelled');
    await drain();
    expect((await MatchRequest.findById(res.body.data.request.id)).status).toBe('cancelled');
    expect(await Notification.countDocuments({ user: w.priya._id })).toBe(0);
  });
});

describe('expiry and retry (SB2/US28, US44, US45)', () => {
  it('expires a pending request after 7 days, tells both people, and lets the learner retry', async () => {
    const w = await world();
    const id = await pendingRequest(w);
    const doc = await MatchRequest.findById(id);
    expect(doc.expiresAt.getTime() - doc.deliveredAt.getTime()).toBe(7 * 86_400_000);
    await MatchRequest.updateOne({ _id: id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await w.arjun.agent.get(`/api/v1/match-requests/${id}`);
    expect(res.body.data.request).toMatchObject({ status: 'expired', actions: { canRetry: true } });
    expect((await Notification.find({ type: 'request_expired' })).length).toBe(2);

    const retry = await w.arjun.agent.post(`/api/v1/match-requests/${id}/retry`);
    expect(retry.status).toBe(202);
    expect(retry.body.data.request).toMatchObject({ status: 'queued', attempts: 2 });
    await drain();
    expect((await MatchRequest.findById(id)).status).toBe('pending');
    expect((await w.arjun.agent.post(`/api/v1/match-requests/${id}/retry`)).status).toBe(409);
  });

  it('marks a request failed after repeated processing errors (dead letter) and it can be retried', async () => {
    const w = await world();
    const res = await w.arjun.agent
      .post('/api/v1/match-requests')
      .send({ mentorId: String(w.priya._id), skillId: String(w.react._id) });
    const id = res.body.data.request.id;
    // Simulate a temporary database failure during every processing attempt.
    const spy = vi.spyOn(Skill, 'findById').mockImplementation(() => {
      throw new Error('Database temporarily unavailable');
    });
    await drain(new Date());
    spy.mockRestore();
    const message = await QueueMessage.findOne().lean();
    expect(message).toMatchObject({ status: 'dead', receiveCount: 4, lastError: 'Database temporarily unavailable' });

    const failed = await w.arjun.agent.get(`/api/v1/match-requests/${id}`);
    expect(failed.body.data.request).toMatchObject({ status: 'failed', failure: { code: 'PROCESSING_FAILED' } });
    expect((await w.arjun.agent.get('/api/v1/notifications')).body.data.notifications[0].type).toBe('match_failed');
    await w.arjun.agent.post(`/api/v1/match-requests/${id}/retry`);
    await drain();
    expect((await MatchRequest.findById(id)).status).toBe('pending');
  });

  it('processing is idempotent: running the same request twice changes nothing', async () => {
    const w = await world();
    const id = await pendingRequest(w);
    const before = await MatchRequest.findById(id).lean();
    expect(await processRequest(id)).toEqual({ skipped: true });
    const after = await MatchRequest.findById(id).lean();
    expect(after.history).toHaveLength(before.history.length);
  });
});

describe('automatic matching (SB2/US17–24, US42, US43, US46)', () => {
  it('picks the best mentor who shares free time and tells the learner', async () => {
    const w = await world();
    const res = await w.arjun.agent.post('/api/v1/match-requests').send({ mode: 'auto', skillId: String(w.react._id) });
    expect(res.body.data.request.mentor).toBeNull();
    await drain();
    const detail = (await w.arjun.agent.get(`/api/v1/match-requests/${res.body.data.request.id}`)).body.data.request;
    // Omar (paused) and Vikram (deactivated) are never picked; Zara and Ethan share no evenings.
    expect(detail).toMatchObject({ status: 'pending', mentor: { name: 'Priya' }, score: { total: 100 } });
    const kinds = (await w.arjun.agent.get('/api/v1/notifications')).body.data.notifications.map((n) => n.type);
    expect(kinds).toContain('match_found');

    const second = await w.arjun.agent
      .post('/api/v1/match-requests')
      .send({ mode: 'auto', skillId: String(w.react._id) });
    expect(second.status).toBe(409);
  });

  it('explains why nobody could be matched', async () => {
    const w = await world();
    const haskell = await createSkill({ name: 'Haskell' });
    const cases = [
      { learner: {}, skill: haskell, code: 'NO_MENTORS_FOR_SKILL' },
      { learner: {}, skill: w.rust, code: 'NO_ACTIVE_MENTORS' },
      {
        learner: { learnSkills: [{ skill: w.react._id, preferredLevel: 'advanced' }], availability: mornings },
        skill: w.react,
        code: 'NO_COMMON_AVAILABILITY',
      },
    ];
    for (const c of cases) {
      const { agent } = await signedInUser(ctx.app, { timezone: 'Asia/Kolkata', availability: evenings, ...c.learner });
      const res = await agent.post('/api/v1/match-requests').send({ mode: 'auto', skillId: String(c.skill._id) });
      await drain();
      const detail = (await agent.get(`/api/v1/match-requests/${res.body.data.request.id}`)).body.data.request;
      expect(detail.status, c.code).toBe('failed');
      expect(detail.failure.code).toBe(c.code);
      expect(detail.failure.nextStep).toBeTruthy();
    }
  });

  it('reports LEVEL_TOO_HIGH and ALREADY_REQUESTED', async () => {
    const w = await world();
    const { agent: expertSeeker } = await signedInUser(ctx.app, {
      timezone: 'Asia/Kolkata',
      availability: mornings,
      learnSkills: [{ skill: w.react._id, preferredLevel: 'advanced' }],
    });
    // Zara (beginner) is the only weekend mentor in Kolkata; Ethan is advanced = equal level, so he still qualifies.
    // Make the level impossible by pausing Ethan and Priya.
    await (await asUser(w.ethan)).patch('/api/v1/users/me/accepting-requests').send({ acceptingRequests: false });
    await (await asUser(w.priya)).patch('/api/v1/users/me/accepting-requests').send({ acceptingRequests: false });
    const a = await expertSeeker.post('/api/v1/match-requests').send({ mode: 'auto', skillId: String(w.react._id) });
    await drain();
    expect((await MatchRequest.findById(a.body.data.request.id)).failure.code).toBe('LEVEL_TOO_HIGH');

    await (await asUser(w.priya)).patch('/api/v1/users/me/accepting-requests').send({ acceptingRequests: true });
    await w.arjun.agent
      .post('/api/v1/match-requests')
      .send({ mentorId: String(w.priya._id), skillId: String(w.react._id) });
    await drain();
    const auto = await w.arjun.agent
      .post('/api/v1/match-requests')
      .send({ mode: 'auto', skillId: String(w.react._id) });
    await drain();
    expect((await MatchRequest.findById(auto.body.data.request.id)).failure.code).toBe('ALREADY_REQUESTED');
  });
});

describe('match suggestions (SB2/US17–23, US46)', () => {
  it('ranks mentors with a score breakdown and reasons, never the learner, paused or deactivated people', async () => {
    const w = await world();
    const res = await w.arjun.agent.get('/api/v1/matches/suggestions');
    expect(res.status).toBe(200);
    const { matches, learnSkills, hasAvailability } = res.body.data;
    expect(learnSkills.map((s) => s.name)).toEqual(['React']);
    expect(hasAvailability).toBe(true);
    // Zara (equal level, same zone: 35+12+0+10 = 57) edges out Ethan (higher level, 10.5 h away: 35+20+0+0 = 55).
    expect(matches.map((m) => m.mentor.name)).toEqual(['Priya', 'Zara', 'Ethan']);
    expect(matches[0]).toMatchObject({
      skill: { name: 'React' },
      score: { total: 100, exchange: 10 },
      sharedMinutes: 900,
    });
    expect(matches[0].reasons).toContain('Wants to learn Python, which you teach – you could swap skills');
    expect(matches[1].score).toMatchObject({ level: 12, availability: 0, timezone: 10, total: 57 });
    expect(matches[2].score).toMatchObject({ level: 20, availability: 0, timezone: 0, total: 55 });
    expect(matches.every((m) => m.existingRequest === null)).toBe(true);
  });

  it('marks mentors already requested and filters by skill', async () => {
    const w = await world();
    await pendingRequest(w);
    const res = await w.arjun.agent.get(`/api/v1/matches/suggestions?skillId=${w.react._id}&limit=1`);
    expect(res.body.data.matches).toHaveLength(1);
    expect(res.body.data.matches[0].existingRequest).toMatchObject({ status: 'pending' });
    expect((await w.arjun.agent.get('/api/v1/matches/suggestions?limit=11')).status).toBe(422);
  });

  it('returns a reason instead of an empty list', async () => {
    const w = await world();
    const { agent } = await signedInUser(ctx.app);
    const none = await agent.get('/api/v1/matches/suggestions');
    expect(none.body.data).toMatchObject({ matches: [], reason: { code: 'NO_LEARN_SKILLS' } });
    const rust = await agent.get(`/api/v1/matches/suggestions?skillId=${w.rust._id}`);
    expect(rust.body.data.reason.code).toBe('NO_ACTIVE_MENTORS');
  });
});

describe('mentor profile (SB2/US8–11, US30)', () => {
  it('shows skills, availability in both zones, shared time, swap hints and open requests', async () => {
    const w = await world();
    const { agent } = await signedInUser(ctx.app, {
      timezone: 'Europe/London',
      availability: [{ day: 0, start: '13:00', end: '15:00' }],
      teachSkills: [{ skill: w.python._id, proficiency: 'expert' }],
      learnSkills: [{ skill: w.react._id, preferredLevel: 'beginner' }],
    });
    await agent.post('/api/v1/match-requests').send({ mentorId: String(w.priya._id), skillId: String(w.react._id) });
    const res = await agent.get(`/api/v1/mentors/${w.priya._id}`);
    expect(res.status).toBe(200);
    const { profile, availability, exchange, openRequests, isSelf } = res.body.data;
    expect(profile).toMatchObject({ name: 'Priya', acceptingRequests: true });
    expect(profile).not.toHaveProperty('email');
    expect(isSelf).toBe(false);
    expect(availability).toMatchObject({
      mentorTimezone: 'Asia/Kolkata',
      viewerTimezone: 'Europe/London',
      tzGapHours: 5.5,
    });
    expect(availability.inMentorZone[0]).toEqual({ day: 0, start: '18:00', end: '21:00' });
    expect(availability.inViewerZone[0]).toEqual({ day: 0, start: '12:30', end: '15:30' });
    expect(availability.sharedInViewerZone).toEqual([{ day: 0, start: '13:00', end: '15:00' }]);
    expect(availability.sharedMinutes).toBe(120);
    expect(availability.nextSharedSlot).toBeTruthy();
    expect(exchange.theyCanTeachYou.map((e) => e.skill.name)).toEqual(['React']);
    expect(exchange.youCanTeachThem.map((e) => e.skill.name)).toEqual(['Python']);
    expect(openRequests).toEqual([
      expect.objectContaining({ status: 'queued', skill: expect.objectContaining({ name: 'React' }) }),
    ]);
  });

  it('hides deactivated members and flags your own profile', async () => {
    const w = await world();
    expect((await w.arjun.agent.get(`/api/v1/mentors/${w.vikram._id}`)).status).toBe(404);
    expect((await w.arjun.agent.get(`/api/v1/mentors/${w.arjun.user._id}`)).body.data.isSelf).toBe(true);
  });
});
