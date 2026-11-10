/**
 * Sprint 2 unit tests: matching rules, ranking, search sorting, the worker and
 * the request serializer (SB2/US3, US17–25, US43, US46, US49).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  levelPoints,
  availabilityPoints,
  timezonePoints,
  evaluateCandidate,
  rankCandidates,
  explainNoMatch,
  failureFor,
  describeMinutes,
  exchangeSkills,
} from '../../src/services/matching/scoring.js';
import { relevanceScore, sortMentors } from '../../src/services/searchService.js';
import { createMatchWorker } from '../../src/workers/matchWorker.js';
import { serializeRequest, roleIn } from '../../src/utils/requestSerializer.js';

const NOW = new Date('2026-11-10T12:00:00Z');
const evenings = [0, 1, 2, 3, 4].map((day) => ({ day, start: '18:00', end: '21:00' }));
const learner = {
  _id: 'L',
  name: 'Arjun',
  timezone: 'Asia/Kolkata',
  availability: evenings,
  teachSkills: [{ skill: 'python', proficiency: 'advanced' }],
};
const mentor = (over = {}) => ({
  _id: 'M',
  name: 'Priya',
  status: 'active',
  timezone: 'Asia/Kolkata',
  availability: evenings,
  teachSkills: [{ skill: 'react', proficiency: 'expert' }],
  learnSkills: [{ skill: { _id: 'python', name: 'Python' }, preferredLevel: 'beginner' }],
  ...over,
});
const evaluate = (m, extra = {}) =>
  evaluateCandidate({
    learner,
    mentor: m,
    skillId: 'react',
    skillName: 'React',
    wantedLevel: 'beginner',
    now: NOW,
    ...extra,
  });

describe('score parts (SB2/US17–21)', () => {
  it('level: above 20, equal 12, below null', () => {
    expect(levelPoints('expert', 'beginner')).toBe(20);
    expect(levelPoints('intermediate', 'intermediate')).toBe(12);
    expect(levelPoints('beginner', 'advanced')).toBeNull();
  });

  it('shared time scales to 25 points and caps at 3 hours', () => {
    expect([0, 36, 90, 180, 900].map(availabilityPoints)).toEqual([0, 5, 13, 25, 25]);
  });

  it('time-zone gap bands', () => {
    expect([0, 3, 3.5, 6, 9, 9.5, 12].map(timezonePoints)).toEqual([10, 10, 6, 6, 3, 0, 0]);
  });

  it('formats minutes', () => {
    expect([45, 60, 210].map(describeMinutes)).toEqual(['45 min', '1 h', '3 h 30 min']);
  });

  it('finds skills the mentor wants that the learner teaches (SB2/US18)', () => {
    expect(exchangeSkills(learner, mentor()).map((l) => l.skill.name)).toEqual(['Python']);
    expect(exchangeSkills({ teachSkills: [] }, mentor())).toEqual([]);
  });
});

describe('evaluateCandidate (SB2/US17–23, US43)', () => {
  it('scores a perfect match at 100 with reasons and a proposed shared slot', () => {
    const r = evaluate(mentor());
    expect(r.eligible).toBe(true);
    expect(r.score).toEqual({ skill: 35, level: 20, availability: 25, timezone: 10, exchange: 10, total: 100 });
    expect(r.reasons).toEqual([
      'Teaches React at Expert level (above the beginner level you want)',
      '15 h of shared free time each week',
      'Same time zone',
      'Wants to learn Python, which you teach – you could swap skills',
    ]);
    expect(r.proposedSlot).toEqual({
      startsAt: new Date('2026-11-11T12:30:00Z'),
      endsAt: new Date('2026-11-11T13:00:00Z'),
      shared: true,
    });
  });

  it('excludes self, non-teachers, inactive, paused, timeless and under-levelled mentors', () => {
    expect(evaluate({ ...mentor(), _id: 'L' }).code).toBe('SELF');
    expect(evaluate(mentor({ teachSkills: [] })).code).toBe('NOT_TEACHING');
    expect(evaluate(mentor({ status: 'deactivated' })).code).toBe('INACTIVE');
    expect(evaluate(mentor({ acceptingRequests: false })).code).toBe('NOT_ACCEPTING');
    expect(evaluate(mentor({ availability: [] })).code).toBe('NO_AVAILABILITY');
    expect(
      evaluate(mentor({ teachSkills: [{ skill: 'react', proficiency: 'beginner' }] }), { wantedLevel: 'advanced' })
        .code,
    ).toBe('LEVEL_TOO_LOW');
  });

  it('direct requests may skip the level rule and fall back to the mentor’s own next slot', () => {
    const m = mentor({
      timezone: 'America/New_York',
      availability: [{ day: 5, start: '09:00', end: '10:00' }],
      teachSkills: [{ skill: 'react', proficiency: 'beginner' }],
    });
    const r = evaluate(m, { wantedLevel: 'advanced', requireLevel: false });
    expect(r.eligible).toBe(true);
    expect(r.score.level).toBe(0);
    expect(r.reasons[0]).toContain('below the advanced level');
    expect(r.reasons[1]).toBe('No overlapping free time yet');
    expect(r.reasons[2]).toBe('10 h 30 min time difference');
    expect(r.proposedSlot).toMatchObject({ shared: false, startsAt: new Date('2026-11-14T14:00:00Z') });
  });
});

describe('ranking and no-match reasons (SB2/US22, US46)', () => {
  const c = (name, total, sharedMinutes, id = name) => ({ mentor: { _id: id, name }, score: { total }, sharedMinutes });

  it('orders by score, then shared time, then name, deterministically', () => {
    const ranked = rankCandidates([c('Zed', 80, 60), c('Amy', 80, 60), c('Bob', 80, 120), c('Cat', 90, 0)]);
    expect(ranked.map((r) => r.mentor.name)).toEqual(['Cat', 'Bob', 'Amy', 'Zed']);
  });

  it('explains the most useful reason in order', () => {
    expect(explainNoMatch([{ code: 'NOT_TEACHING' }])).toBe('NO_MENTORS_FOR_SKILL');
    expect(explainNoMatch([{ code: 'NOT_ACCEPTING' }, { code: 'INACTIVE' }])).toBe('NO_ACTIVE_MENTORS');
    expect(explainNoMatch([{ code: 'LEVEL_TOO_LOW' }])).toBe('LEVEL_TOO_HIGH');
    const a = { eligible: true, mentor: { _id: 'a' }, sharedMinutes: 60 };
    const b = { eligible: true, mentor: { _id: 'b' }, sharedMinutes: 0 };
    expect(explainNoMatch([a], new Set(['a']))).toBe('ALREADY_REQUESTED');
    expect(explainNoMatch([a, b], new Set(['a']))).toBe('ALREADY_REQUESTED');
    expect(explainNoMatch([b])).toBe('NO_COMMON_AVAILABILITY');
  });

  it('turns a code into a message and next step', () => {
    expect(failureFor('NO_COMMON_AVAILABILITY')).toEqual({
      code: 'NO_COMMON_AVAILABILITY',
      reason: 'No suitable mentor shares any free time with you.',
      nextStep: 'Add more hours on the Availability page, then retry.',
    });
    expect(failureFor('UNKNOWN').reason).toMatch(/something went wrong/i);
  });
});

describe('search ranking helpers (SB2/US3)', () => {
  it('relevance rewards match quality, level, shared time and openness', () => {
    const base = { matchScore: 70, bestRank: 4, sharedMinutes: 180, acceptingRequests: true, hasProfile: true };
    expect(relevanceScore(base)).toBe(70 + 20 + 10 + 5 + 2);
    expect(relevanceScore({ ...base, acceptingRequests: false })).toBe(102);
    expect(relevanceScore({})).toBe(5);
  });

  it('sorts by each order with a name tie-break', () => {
    const items = [
      { id: '1', name: 'Bea', relevance: 50, memberSince: '2026-01-01', sharedMinutes: 0 },
      { id: '2', name: 'Ada', relevance: 50, memberSince: '2026-03-01', sharedMinutes: 90 },
      { id: '3', name: 'Cy', relevance: 80, memberSince: '2026-02-01', sharedMinutes: 30 },
    ];
    const names = (sort) => sortMentors(items, sort).map((i) => i.name);
    expect(names('relevance')).toEqual(['Cy', 'Ada', 'Bea']);
    expect(names('name')).toEqual(['Ada', 'Bea', 'Cy']);
    expect(names('newest')).toEqual(['Ada', 'Cy', 'Bea']);
    expect(names('availability')).toEqual(['Ada', 'Cy', 'Bea']);
    expect(names('unknown')).toEqual(names('relevance'));
  });
});

describe('match worker (SB2/US49)', () => {
  function fakeQueue(messages) {
    const removed = [];
    const released = [];
    return {
      removed,
      released,
      async receive() {
        return messages.splice(0, 5);
      },
      async remove(id) {
        removed.push(id);
      },
      async release(id, err) {
        released.push([id, err.message]);
      },
    };
  }

  it('removes processed messages and releases failed ones for a retry', async () => {
    const queue = fakeQueue([
      { id: 'a', body: { requestId: 1 }, receiveCount: 1 },
      { id: 'b', body: { requestId: 2 }, receiveCount: 1 },
    ]);
    const processMessage = vi.fn(async (body) => {
      if (body.requestId === 2) throw new Error('boom');
    });
    const worker = createMatchWorker({ queue, queueName: 'q', processMessage, expire: vi.fn() });
    expect(await worker.drain()).toBe(2);
    expect(queue.removed).toEqual(['a']);
    expect(queue.released).toEqual([['b', 'boom']]);
  });

  it('only kicks and runs timers after start, and stops cleanly', async () => {
    vi.useFakeTimers();
    const queue = fakeQueue([]);
    const expire = vi.fn(async () => 0);
    const worker = createMatchWorker({
      queue,
      queueName: 'q',
      processMessage: vi.fn(),
      expire,
      intervalMs: 1000,
      expiryIntervalMs: 5000,
    });
    worker.kick();
    expect(worker.started).toBe(false);
    worker.start();
    await vi.advanceTimersByTimeAsync(5000);
    expect(expire).toHaveBeenCalledTimes(1);
    worker.stop();
    await vi.advanceTimersByTimeAsync(10000);
    expect(expire).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe('request serializer (SB2/US25, US30)', () => {
  const doc = {
    _id: 'R1',
    learner: { _id: 'L', name: 'Arjun', timezone: 'Asia/Kolkata', email: 'secret@x.test' },
    mentor: { _id: 'M', name: 'Priya', timezone: 'Asia/Kolkata' },
    skill: { _id: 'S', name: 'React', category: { _id: 'C', name: 'Tech', slug: 'tech' } },
    status: 'pending',
    mode: 'direct',
    history: [{ status: 'queued', by: 'learner', at: NOW }],
  };

  it('works out the viewer role', () => {
    expect(roleIn(doc, 'L')).toBe('learner');
    expect(roleIn(doc, 'M')).toBe('mentor');
    expect(roleIn(doc, 'X', 'admin')).toBe('admin');
    expect(roleIn(doc, 'X', 'user')).toBeNull();
  });

  it('shows the other person as partner, offers the right actions and never leaks email', () => {
    const asMentor = serializeRequest(doc, 'M');
    expect(asMentor.partner.name).toBe('Arjun');
    expect(asMentor.actions).toEqual({ canAccept: true, canDecline: true, canCancel: false, canRetry: false });
    expect(JSON.stringify(asMentor)).not.toContain('secret@x.test');
    expect(serializeRequest(doc, 'L').partner.name).toBe('Priya');
    expect(serializeRequest(doc, 'X', 'admin').actions).toEqual({
      canAccept: false,
      canDecline: false,
      canCancel: false,
      canRetry: false,
    });
  });
});
