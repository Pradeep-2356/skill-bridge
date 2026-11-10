import { Check, Info } from 'lucide-react';
import { MATCH_WEIGHTS } from '@skillbridge/shared';
import styles from './Matches.module.css';

const PARTS = [
  { key: 'skill', label: 'Skill fit', max: MATCH_WEIGHTS.skill },
  { key: 'level', label: 'Level fit', max: MATCH_WEIGHTS.level },
  { key: 'availability', label: 'Shared time', max: MATCH_WEIGHTS.availability },
  { key: 'timezone', label: 'Time zone', max: MATCH_WEIGHTS.timezone },
  { key: 'exchange', label: 'Skill swap', max: MATCH_WEIGHTS.exchange },
];

/** The score out of 100, how each rule contributed, and the reasons in words (SB2/US17–22). */
export function ScoreBreakdown({ score, reasons = [], notes = [], compact = false }) {
  return (
    <div className={`${styles.breakdown} ${compact ? styles.compact : ''}`}>
      <div className={styles.total} aria-label={`Match score ${score.total} out of 100`}>
        <span className={styles.totalValue}>{score.total}</span>
        <span className={styles.totalMax}>/100</span>
      </div>
      <dl className={styles.parts}>
        {PARTS.map((p) => (
          <div key={p.key} className={styles.part}>
            <dt>{p.label}</dt>
            <dd>
              <span className={styles.bar} aria-hidden="true">
                <span style={{ width: `${(100 * (score[p.key] ?? 0)) / p.max}%` }} />
              </span>
              <span className={styles.partValue}>
                {score[p.key] ?? 0}/{p.max}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      {reasons.length ? (
        <ul className={styles.reasons} aria-label="Why this match">
          {reasons.map((r) => (
            <li key={r}>
              <Check size={14} aria-hidden="true" /> {r}
            </li>
          ))}
        </ul>
      ) : null}
      {notes.length ? (
        <ul className={`${styles.reasons} ${styles.notes}`} aria-label="Things to know">
          {notes.map((n) => (
            <li key={n}>
              <Info size={14} aria-hidden="true" /> {n}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
