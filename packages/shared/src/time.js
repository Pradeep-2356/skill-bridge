/**
 * Time-zone maths for weekly availability (SB2/US6, US7, US11, US19–21, US31).
 *
 * Availability is stored as weekly ranges in each member's own zone
 * ({ day: 0 = Monday, start: '18:00', end: '21:00' }). To compare two people we
 * turn their ranges into "week minutes" in UTC: 0 = Monday 00:00 UTC,
 * 10080 = the next Monday. Uses only the built-in Intl API (no extra library).
 *
 * Simplification (documented): each zone's offset is taken at one reference
 * moment, so an overlap that crosses a daylight-saving change can be an hour off.
 */
import { SLOT_STEP_MINUTES, SESSION_DURATION_MINUTES } from './constants.js';
import { timeToMinutes, minutesToTime } from './utils.js';

export const WEEK_MINUTES = 7 * 24 * 60;
const DAY = 24 * 60;

const formatterCache = new Map();
function partsFormatter(timeZone) {
  if (!formatterCache.has(timeZone)) {
    formatterCache.set(
      timeZone,
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    );
  }
  return formatterCache.get(timeZone);
}

/** Minutes the zone is ahead of UTC at `date` (Asia/Kolkata → 330, America/New_York → -300 or -240). */
export function zoneOffsetMinutes(timeZone, date = new Date()) {
  const parts = Object.fromEntries(
    partsFormatter(timeZone || 'UTC')
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, Number(p.value)]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/**
 * Practical gap between two zones in hours, measured round the clock:
 * UTC+14 and UTC-10 are 24 h apart on paper but only 0 h apart in local clock time.
 */
export function timeZoneGapHours(tzA, tzB, date = new Date()) {
  const diff = Math.abs(zoneOffsetMinutes(tzA, date) - zoneOffsetMinutes(tzB, date)) % DAY;
  return Math.min(diff, DAY - diff) / 60;
}

const mod = (n, m) => ((n % m) + m) % m;

/** Splits [start, end) that may run past the end of the week into in-range pieces. */
function wrap(start, end) {
  const s = mod(start, WEEK_MINUTES);
  const length = end - start;
  if (length <= 0) return [];
  if (length >= WEEK_MINUTES) return [[0, WEEK_MINUTES]];
  const e = s + length;
  return e <= WEEK_MINUTES
    ? [[s, e]]
    : [
        [s, WEEK_MINUTES],
        [0, e - WEEK_MINUTES],
      ];
}

/** Sorts and merges touching or overlapping intervals. */
export function mergeIntervals(intervals) {
  const sorted = [...intervals].filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [s, e] of sorted) {
    const last = out.at(-1);
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

/** Weekly slots in `timeZone` → merged UTC week-minute intervals. */
export function slotsToUtcIntervals(slots = [], timeZone = 'UTC', date = new Date()) {
  const offset = zoneOffsetMinutes(timeZone, date);
  const pieces = slots.flatMap(({ day, start, end }) => {
    const s = day * DAY + timeToMinutes(start) - offset;
    const e = day * DAY + timeToMinutes(end) - offset;
    return wrap(s, e);
  });
  return mergeIntervals(pieces);
}

/** Overlapping parts of two interval lists. */
export function intersectIntervals(a = [], b = []) {
  const out = [];
  for (const [as, ae] of a) {
    for (const [bs, be] of b) {
      const s = Math.max(as, bs);
      const e = Math.min(ae, be);
      if (e > s) out.push([s, e]);
    }
  }
  return mergeIntervals(out);
}

export const totalIntervalMinutes = (intervals = []) => intervals.reduce((sum, [s, e]) => sum + (e - s), 0);

/** Minutes per week that two people are both free (SB2/US19, US20). */
export function sharedWeeklyMinutes(slotsA, tzA, slotsB, tzB, date = new Date()) {
  return totalIntervalMinutes(
    intersectIntervals(slotsToUtcIntervals(slotsA, tzA, date), slotsToUtcIntervals(slotsB, tzB, date)),
  );
}

/** UTC week intervals → weekly slots in another zone, split at midnight (for "your time" views, SB2/US11). */
export function intervalsToSlots(intervals = [], timeZone = 'UTC', date = new Date()) {
  const offset = zoneOffsetMinutes(timeZone, date);
  const local = mergeIntervals(intervals.flatMap(([s, e]) => wrap(s + offset, e + offset)));
  const slots = [];
  for (const [s, e] of local) {
    let cursor = s;
    while (cursor < e) {
      const dayIndex = Math.floor(cursor / DAY);
      const dayEnd = (dayIndex + 1) * DAY;
      const pieceEnd = Math.min(e, dayEnd);
      slots.push({
        day: dayIndex,
        start: minutesToTime(cursor - dayIndex * DAY),
        end: pieceEnd - dayIndex * DAY === DAY ? '24:00' : minutesToTime(pieceEnd - dayIndex * DAY),
      });
      cursor = pieceEnd;
    }
  }
  return slots;
}

/** Converts weekly slots from one zone to another. */
export function convertSlots(slots, fromTz, toTz, date = new Date()) {
  return intervalsToSlots(slotsToUtcIntervals(slots, fromTz, date), toTz, date);
}

/** Week minute (0 = Monday 00:00 UTC) of an absolute moment. */
export function weekMinuteOf(date) {
  const d = new Date(date);
  return mod(d.getUTCDay() - 1, 7) * DAY + d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Builds the viewer's wanted window (days × from–to in their zone) as UTC intervals (SB2/US6). */
export function windowToUtcIntervals({ days, from, to }, timeZone, date = new Date()) {
  const dayList = days?.length ? days : [0, 1, 2, 3, 4, 5, 6];
  const start = from ?? '00:00';
  const end = to ?? '24:00';
  if (timeToMinutes(end) <= timeToMinutes(start)) return [];
  return slotsToUtcIntervals(
    dayList.map((day) => ({ day, start, end })),
    timeZone,
    date,
  );
}

/**
 * Earliest 30-minute block inside `intervals` that starts at least `leadHours`
 * from now and within `horizonDays` (SB2/US31). Returns { startsAt, endsAt } or null.
 */
export function nextSlotIn(intervals, { now = new Date(), leadHours = 24, horizonDays = 7 } = {}) {
  if (!intervals?.length) return null;
  const step = SLOT_STEP_MINUTES * 60000;
  const duration = SESSION_DURATION_MINUTES;
  const earliest = Math.ceil((now.getTime() + leadHours * 3600000) / step) * step;
  const latest = now.getTime() + (leadHours + horizonDays * 24) * 3600000;
  for (let t = earliest; t <= latest; t += step) {
    const wm = weekMinuteOf(t);
    const fits = intervals.some(([s, e]) => wm >= s && wm + duration <= e);
    if (fits) return { startsAt: new Date(t), endsAt: new Date(t + duration * 60000) };
  }
  return null;
}
