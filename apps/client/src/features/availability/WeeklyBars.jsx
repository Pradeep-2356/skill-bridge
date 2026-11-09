import { WEEKDAYS, timeToMinutes } from '@skillbridge/shared';
import { summariseSlots } from '../../utils/format.js';
import styles from './Availability.module.css';

/**
 * Read-only weekly availability: one 24-hour track per day with filled ranges.
 * A text list is included for screen readers (colour is never the only cue).
 */
export function WeeklyBars({ slots = [], timezone }) {
  const summary = summariseSlots(slots);
  return (
    <div className={styles.bars}>
      <div className={styles.barScale} aria-hidden="true">
        <span />
        <div className={styles.barScaleTicks}>
          {['00', '06', '12', '18', '24'].map((h) => (
            <span key={h}>{h}:00</span>
          ))}
        </div>
      </div>
      {WEEKDAYS.map((d) => {
        const daySlots = slots.filter((s) => s.day === d.value);
        return (
          <div key={d.value} className={styles.barRow} aria-hidden="true">
            <span className={styles.barDay}>{d.short}</span>
            <div className={styles.barTrack}>
              {daySlots.map((s) => {
                const start = timeToMinutes(s.start);
                const end = timeToMinutes(s.end);
                return (
                  <span
                    key={`${s.start}-${s.end}`}
                    className={styles.barFill}
                    style={{ left: `${(start / 1440) * 100}%`, width: `${((end - start) / 1440) * 100}%` }}
                    title={`${d.label} ${s.start}–${s.end}`}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
      <ul className="sr-only">
        {summary.length === 0 ? <li>No availability set</li> : null}
        {summary.map((d) => (
          <li key={d.day}>
            {d.label}: {d.ranges.join(', ')}
          </li>
        ))}
      </ul>
      {timezone ? <p className={styles.barNote}>Times shown in {timezone.replace(/_/g, ' ')}</p> : null}
    </div>
  );
}
