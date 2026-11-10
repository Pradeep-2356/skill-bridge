/**
 * Sprint 2 shared rules: search input, time-zone maths, request state machine, schemas.
 */
import { describe, it, expect } from 'vitest';
import {
  sanitizeSearchText,
  splitSearchTerms,
  skillMatchScore,
  normalizeSkillName,
  zoneOffsetMinutes,
  timeZoneGapHours,
  slotsToUtcIntervals,
  intersectIntervals,
  mergeIntervals,
  sharedWeeklyMinutes,
  convertSlots,
  windowToUtcIntervals,
  nextSlotIn,
  weekMinuteOf,
  findTransition,
  canTransition,
  isActiveStatus,
  isFinalStatus,
  allowedActions,
  REQUEST_TRANSITIONS,
  MATCH_WEIGHTS,
  mentorSearchQuerySchema,
  matchRequestCreateSchema,
  matchRequestListQuerySchema,
  declineRequestSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  adminSkillUpdateSchema,
  notificationsQuerySchema,
  themePreferenceSchema,
  toFieldErrors,
} from '../src/index.js';

const NOV = new Date('2026-11-10T12:00:00Z'); // London on GMT, New York on EST
const JUL = new Date('2026-07-01T12:00:00Z'); // London on BST, New York on EDT

describe('search input (SB2/US1, US38, US41, US42)', () => {
  it('removes control characters, quotes and text-search operators', () => {
    expect(sanitizeSearchText('  "React"\u0000  -vue  ')).toBe('React vue');
    expect(sanitizeSearchText('x'.repeat(100))).toHaveLength(60);
    expect(sanitizeSearchText(null)).toBe('');
  });

  it('splits several terms and normalises them', () => {
    expect(splitSearchTerms('React, VUE.js;  node  ')).toEqual(['react', 'vue.js', 'node']);
    expect(splitSearchTerms('python or java | go')).toEqual(['python', 'java', 'go']);
    expect(splitSearchTerms('react, React')).toEqual(['react']);
    expect(splitSearchTerms('.*, ++')).toEqual([]);
    expect(splitSearchTerms('a,b,c,d,e,f,g')).toHaveLength(5);
  });

  it('keeps meaningful symbols such as C++ and C#', () => {
    expect(splitSearchTerms('C++')).toEqual(['c++']);
    expect(splitSearchTerms('C#')).toEqual(['c#']);
  });

  it('scores exact > alias > prefix > word > contains', () => {
    const skill = { name: 'React Native', normalizedName: 'react native', aliases: ['rn'] };
    expect(skillMatchScore(skill, 'React Native')).toBe(100);
    expect(skillMatchScore(skill, 'RN')).toBe(90);
    expect(skillMatchScore(skill, 'rea')).toBe(70);
    expect(skillMatchScore(skill, 'nat')).toBe(45);
    expect(skillMatchScore(skill, 'tive')).toBe(35);
    expect(skillMatchScore(skill, 'vue')).toBe(0);
    expect(normalizeSkillName('  NODE.js ')).toBe('node.js');
  });
});

describe('time-zone maths (SB2/US6, US7, US11, US19–21, US31)', () => {
  it('reads zone offsets including daylight saving', () => {
    expect(zoneOffsetMinutes('Asia/Kolkata', NOV)).toBe(330);
    expect(zoneOffsetMinutes('America/New_York', NOV)).toBe(-300);
    expect(zoneOffsetMinutes('America/New_York', JUL)).toBe(-240);
    expect(zoneOffsetMinutes('Asia/Kathmandu', NOV)).toBe(345);
  });

  it('measures time-zone gaps round the clock', () => {
    expect(timeZoneGapHours('Asia/Kolkata', 'Europe/London', NOV)).toBe(5.5);
    expect(timeZoneGapHours('Pacific/Kiritimati', 'Pacific/Honolulu', NOV)).toBe(0);
    expect(timeZoneGapHours('Asia/Tokyo', 'America/Los_Angeles', NOV)).toBe(7);
  });

  it('converts weekly slots to UTC and wraps across the end of the week', () => {
    expect(slotsToUtcIntervals([{ day: 0, start: '18:00', end: '21:00' }], 'Asia/Kolkata', NOV)).toEqual([[750, 930]]);
    // Monday 02:00–04:00 in Kolkata = Sunday 20:30–22:30 UTC
    expect(slotsToUtcIntervals([{ day: 0, start: '02:00', end: '04:00' }], 'Asia/Kolkata', NOV)).toEqual([
      [9870, 9990],
    ]);
    // Sunday 22:00–24:00 in New York = Monday 03:00–05:00 UTC
    expect(slotsToUtcIntervals([{ day: 6, start: '22:00', end: '24:00' }], 'America/New_York', NOV)).toEqual([
      [180, 300],
    ]);
  });

  it('merges and intersects intervals', () => {
    expect(
      mergeIntervals([
        [10, 20],
        [15, 30],
        [40, 50],
        [30, 35],
      ]),
    ).toEqual([
      [10, 35],
      [40, 50],
    ]);
    expect(
      intersectIntervals(
        [
          [0, 100],
          [200, 300],
        ],
        [[50, 250]],
      ),
    ).toEqual([
      [50, 100],
      [200, 250],
    ]);
  });

  it('computes shared weekly minutes between two people in different zones', () => {
    const kolkata = [{ day: 0, start: '18:00', end: '21:00' }];
    const london = [{ day: 0, start: '13:00', end: '15:00' }]; // = 18:30–20:30 Kolkata
    expect(sharedWeeklyMinutes(kolkata, 'Asia/Kolkata', london, 'Europe/London', NOV)).toBe(120);
    expect(sharedWeeklyMinutes(kolkata, 'Asia/Kolkata', [], 'Europe/London', NOV)).toBe(0);
  });

  it('shows another person’s slots in my own zone, split at midnight', () => {
    expect(convertSlots([{ day: 0, start: '18:00', end: '21:00' }], 'Asia/Kolkata', 'Europe/London', NOV)).toEqual([
      { day: 0, start: '12:30', end: '15:30' },
    ]);
    expect(convertSlots([{ day: 0, start: '22:00', end: '24:00' }], 'Europe/London', 'Asia/Tokyo', NOV)).toEqual([
      { day: 1, start: '07:00', end: '09:00' },
    ]);
    expect(convertSlots([{ day: 2, start: '20:00', end: '23:00' }], 'UTC', 'Asia/Kolkata', NOV)).toEqual([
      { day: 3, start: '01:30', end: '04:30' },
    ]);
    expect(convertSlots([{ day: 2, start: '17:00', end: '20:00' }], 'UTC', 'Asia/Kolkata', NOV)).toEqual([
      { day: 2, start: '22:30', end: '24:00' },
      { day: 3, start: '00:00', end: '01:30' },
    ]);
  });

  it('builds a search window from days and times in the searcher’s zone', () => {
    expect(windowToUtcIntervals({ days: [0], from: '09:00', to: '10:00' }, 'UTC', NOV)).toEqual([[540, 600]]);
    expect(windowToUtcIntervals({ days: [0] }, 'UTC', NOV)).toEqual([[0, 1440]]);
    expect(windowToUtcIntervals({ from: '10:00', to: '09:00' }, 'UTC', NOV)).toEqual([]);
  });

  it('finds the earliest shared 30-minute slot at least 24 h ahead (SB2/US31)', () => {
    expect(weekMinuteOf(new Date('2026-11-09T00:30:00Z'))).toBe(30); // a Monday
    const intervals = slotsToUtcIntervals([{ day: 0, start: '18:00', end: '21:00' }], 'Asia/Kolkata', NOV);
    // Now = Tuesday 12:00 UTC → next Monday 12:30 UTC
    expect(nextSlotIn(intervals, { now: NOV })).toEqual({
      startsAt: new Date('2026-11-16T12:30:00Z'),
      endsAt: new Date('2026-11-16T13:00:00Z'),
    });
    // Too soon: Monday 13:00 UTC is only 1 h away, so the next week is used
    expect(nextSlotIn(intervals, { now: new Date('2026-11-16T12:00:00Z') }).startsAt).toEqual(
      new Date('2026-11-23T12:30:00Z'),
    );
    expect(nextSlotIn([], { now: NOV })).toBeNull();
    expect(nextSlotIn(intervals, { now: NOV, horizonDays: 2 })).toBeNull();
  });
});

describe('request state machine (SB2/US25)', () => {
  it('lists exactly nine allowed transitions', () => {
    expect(REQUEST_TRANSITIONS).toHaveLength(9);
    expect(findTransition('pending', 'accepted')).toEqual({ from: 'pending', to: 'accepted', by: 'mentor' });
    expect(findTransition('accepted', 'cancelled')).toBeNull();
  });

  it('checks who may make each change', () => {
    expect(canTransition('pending', 'accepted', 'mentor')).toBe(true);
    expect(canTransition('pending', 'accepted', 'learner')).toBe(false);
    expect(canTransition('queued', 'cancelled', 'learner')).toBe(true);
    expect(canTransition('declined', 'queued', 'learner')).toBe(false);
    expect(canTransition('expired', 'queued', 'learner')).toBe(true);
    expect(canTransition('pending', 'expired', 'system')).toBe(true);
  });

  it('knows active and final statuses', () => {
    expect(['queued', 'pending', 'accepted'].every(isActiveStatus)).toBe(true);
    expect(isActiveStatus('failed')).toBe(false);
    expect(['accepted', 'declined', 'cancelled'].every(isFinalStatus)).toBe(true);
    expect(isFinalStatus('failed')).toBe(false);
  });

  it('works out the buttons each participant sees', () => {
    expect(allowedActions('pending', 'mentor')).toEqual({
      canAccept: true,
      canDecline: true,
      canCancel: false,
      canRetry: false,
    });
    expect(allowedActions('pending', 'learner')).toEqual({
      canAccept: false,
      canDecline: false,
      canCancel: true,
      canRetry: false,
    });
    expect(allowedActions('failed', 'learner').canRetry).toBe(true);
    expect(Object.values(allowedActions('accepted', 'mentor')).some(Boolean)).toBe(false);
  });

  it('match weights add up to 100', () => {
    const { skill, level, availability, timezone, exchange } = MATCH_WEIGHTS;
    expect(skill + level + availability + timezone + exchange).toBe(100);
  });
});

describe('Sprint 2 schemas', () => {
  it('parses discovery filters from the query string', () => {
    const data = mentorSearchQuerySchema.parse({ days: '4,0,0', tzCompatible: '1', limit: '20' });
    expect(data).toMatchObject({ days: [0, 4], tzCompatible: true, sort: 'relevance', page: 1, limit: 20 });
    const bad = mentorSearchQuerySchema.safeParse({ from: '10:00', to: '09:30', limit: '51', days: '7' });
    expect(Object.keys(toFieldErrors(bad.error)).sort()).toEqual(['days.0', 'limit', 'to']);
  });

  it('validates a new learning request', () => {
    expect(matchRequestCreateSchema.parse({ skillId: 'a'.repeat(24), mentorId: 'b'.repeat(24) }).mode).toBe('direct');
    expect(matchRequestCreateSchema.safeParse({ mode: 'auto', skillId: 'a'.repeat(24) }).success).toBe(true);
    const bad = matchRequestCreateSchema.safeParse({ mode: 'direct', skillId: 'nope', message: 'x'.repeat(501) });
    expect(toFieldErrors(bad.error)).toEqual({
      skillId: 'Choose a skill',
      message: 'Message must be at most 500 characters',
      mentorId: 'Choose a mentor',
    });
  });

  it('validates list, decline, notification, category, skill-review and theme inputs', () => {
    expect(matchRequestListQuerySchema.parse({})).toMatchObject({ box: 'all', status: 'all' });
    expect(matchRequestListQuerySchema.safeParse({ status: 'weird' }).success).toBe(false);
    expect(declineRequestSchema.safeParse({ reason: 'x'.repeat(301) }).success).toBe(false);
    expect(notificationsQuerySchema.parse({ unread: 'true' }).unread).toBe(true);
    expect(categoryCreateSchema.safeParse({ name: 'A' }).success).toBe(false);
    expect(categoryCreateSchema.parse({ name: ' Languages ', icon: 'globe' }).name).toBe('Languages');
    expect(categoryUpdateSchema.safeParse({}).success).toBe(false);
    expect(adminSkillUpdateSchema.safeParse({ status: 'approved' }).success).toBe(true);
    expect(themePreferenceSchema.safeParse('dark').success).toBe(true);
    expect(themePreferenceSchema.safeParse('purple').success).toBe(false);
  });
});
