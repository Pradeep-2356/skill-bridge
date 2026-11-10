/**
 * Search input helpers shared by the discovery API and the Discover page
 * (SB2/US1, US32, US38, US41, US42).
 */
import { LIMITS } from './constants.js';
import { normalizeSkillName } from './utils.js';

/**
 * Makes raw search text safe and predictable (SB2/US38):
 * removes control characters and characters with special meaning in MongoDB
 * text search (quotes, leading minus), collapses spaces and caps the length.
 */
export function sanitizeSearchText(raw) {
  return (
    String(raw ?? '')
      .normalize('NFKC')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/["“”`]/g, ' ')
      .replace(/(^|\s)-+/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, LIMITS.SEARCH_QUERY_MAX)
  );
}

/**
 * Splits a query into separate skill terms (SB2/US41):
 * "react, vue" → ["react", "vue"]; "python or java" → ["python", "java"].
 * Terms are normalised (SB2/US42) and duplicates removed; at most 5 terms.
 */
export function splitSearchTerms(raw) {
  const text = sanitizeSearchText(raw);
  if (!text) return [];
  const parts = text
    .split(/\s*(?:,|;|\||\/|\bor\b|\+(?=\s))\s*/i)
    .map(normalizeSkillName)
    .filter((t) => t.length > 0 && /[\p{L}\p{N}]/u.test(t));
  return [...new Set(parts)].slice(0, LIMITS.SEARCH_TERMS_MAX);
}

/**
 * How well a skill matches one term (SB2/US3). Higher is better:
 * 100 exact name · 90 exact alias · 70 name starts with term · 60 alias starts with term
 * · 45 a word in the name starts with the term · 35 contains · 0 no match.
 */
export function skillMatchScore(skill, term) {
  const t = normalizeSkillName(term);
  if (!t) return 0;
  const name = skill.normalizedName ?? normalizeSkillName(skill.name);
  const aliases = skill.aliases ?? [];
  if (name === t) return 100;
  if (aliases.includes(t)) return 90;
  if (name.startsWith(t)) return 70;
  if (aliases.some((a) => a.startsWith(t))) return 60;
  if (name.split(/[\s./+-]+/).some((w) => w.startsWith(t))) return 45;
  if (name.includes(t) || aliases.some((a) => a.includes(t))) return 35;
  return 0;
}
