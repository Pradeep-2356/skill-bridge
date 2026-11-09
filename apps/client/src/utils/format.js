/** Date, time and time-zone helpers. All dates come from the API in UTC. */
import { WEEKDAYS } from '@skillbridge/shared';

export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** True when two zone names are the same zone (e.g. Asia/Kolkata and its alias Asia/Calcutta). */
export function sameTimeZone(a, b) {
  if (a === b) return true;
  try {
    const canon = (z) => new Intl.DateTimeFormat('en-US', { timeZone: z }).resolvedOptions().timeZone;
    return canon(a) === canon(b);
  } catch {
    return false;
  }
}

/** "GMT+5:30" style offset for a zone at a given moment. */
export function zoneOffsetLabel(timeZone, at = new Date()) {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName');
    return part?.value === 'GMT' ? 'GMT+0' : (part?.value ?? '');
  } catch {
    return '';
  }
}

let cachedZones = null;
/** All IANA zones grouped by region for the time-zone picker (SB1/US29). */
export function timeZoneGroups() {
  if (cachedZones) return cachedZones;
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC'];
  const groups = new Map();
  for (const zone of zones) {
    const region = zone.includes('/') ? zone.split('/')[0] : 'Other';
    if (!groups.has(region)) groups.set(region, []);
    groups.get(region).push({ value: zone, label: `${zone.replace(/_/g, ' ')} (${zoneOffsetLabel(zone)})` });
  }
  if (!zones.includes('UTC'))
    groups.set('Other', [...(groups.get('Other') ?? []), { value: 'UTC', label: 'UTC (GMT+0)' }]);
  cachedZones = [...groups.entries()].map(([label, options]) => ({ label, options }));
  return cachedZones;
}

export function formatDate(value, timeZone, opts = {}) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone, ...opts }).format(new Date(value));
}

export function formatDateTime(value, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(value));
}

export function formatTime(value, timeZone) {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(value));
}

/** "in 3 days", "2 hours ago" */
export function relativeTime(value, now = new Date()) {
  const diff = new Date(value).getTime() - now.getTime();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units = [
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === 'minute') return rtf.format(Math.round(diff / ms), unit);
  }
  return '';
}

export function greeting(timeZone, now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(now));
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export const dayName = (day, short = false) => (short ? WEEKDAYS[day]?.short : WEEKDAYS[day]?.label) ?? '';

/** "Mon 09:00–12:00" summary lines for a weekly schedule. */
export function summariseSlots(slots = []) {
  const byDay = new Map();
  for (const s of slots) {
    if (!byDay.has(s.day)) byDay.set(s.day, []);
    byDay.get(s.day).push(`${s.start}–${s.end}`);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, ranges]) => ({ day, label: dayName(day), ranges }));
}

export function pluralise(count, word, plural = `${word}s`) {
  return `${count} ${count === 1 ? word : plural}`;
}
