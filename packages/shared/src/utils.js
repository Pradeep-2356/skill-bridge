import { PASSWORD_RULES, SLOT_STEP_MINUTES } from './constants.js';

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

export const isObjectId = (value) => typeof value === 'string' && OBJECT_ID_RE.test(value);

/** True when the runtime knows this IANA time zone (aliases such as Asia/Calcutta included). */
export function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalises a skill name so equivalent spellings compare equal (SB2/US42 groundwork):
 * Unicode NFKC, lower-case, trimmed, inner whitespace collapsed.
 * "  Node.JS " → "node.js"
 */
export function normalizeSkillName(name) {
  return String(name ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Escapes RegExp metacharacters so user input is matched literally (SB1/US50). */
export function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Returns the ids of password rules that the password fails. */
export function failedPasswordRules(password = '') {
  return PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.id);
}

/**
 * 0–4 strength score used by the password meter.
 * 0 = empty, 1 = weak, 2 = fair, 3 = good, 4 = strong (all rules + 12 or more characters).
 */
export function passwordStrength(password = '') {
  if (!password) return 0;
  const passed = PASSWORD_RULES.length - failedPasswordRules(password).length;
  if (passed <= 2) return 1;
  if (passed === 3) return 2;
  if (passed === 4) return 3;
  return password.length >= 12 ? 4 : 3;
}

/** "09:30" → 570 */
export function timeToMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

/** 570 → "09:30" */
export function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const isOnSlotStep = (hhmm) => timeToMinutes(hhmm) % SLOT_STEP_MINUTES === 0;

/**
 * Finds overlapping slots on the same day (SB1/US28).
 * Returns pairs of indexes that overlap; touching slots (10:00–11:00, 11:00–12:00) do not overlap.
 */
export function findSlotOverlaps(slots = []) {
  const overlaps = [];
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      const a = slots[i];
      const b = slots[j];
      if (a.day !== b.day) continue;
      if (timeToMinutes(a.start) < timeToMinutes(b.end) && timeToMinutes(b.start) < timeToMinutes(a.end)) {
        overlaps.push([i, j]);
      }
    }
  }
  return overlaps;
}

/** Sorts slots by day then start time without mutating the input. */
export function sortSlots(slots = []) {
  return [...slots].sort((a, b) => a.day - b.day || timeToMinutes(a.start) - timeToMinutes(b.start));
}

/** Total weekly available minutes. */
export function totalAvailableMinutes(slots = []) {
  return slots.reduce((sum, s) => sum + (timeToMinutes(s.end) - timeToMinutes(s.start)), 0);
}

/**
 * Converts a Zod error into `{ field: message }`, keeping the first message per field.
 * Nested paths are joined with dots: `slots.2.end`.
 */
export function toFieldErrors(zodError) {
  const fields = {};
  for (const issue of zodError?.issues ?? []) {
    const key = issue.path.length ? issue.path.join('.') : '_form';
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}
