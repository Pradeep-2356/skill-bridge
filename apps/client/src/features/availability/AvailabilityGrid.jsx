import { useEffect, useMemo, useRef, useState } from 'react';
import { WEEKDAYS, SLOT_STEP_MINUTES, minutesToTime, timeToMinutes } from '@skillbridge/shared';
import styles from './Availability.module.css';

const CELLS_PER_DAY = 1440 / SLOT_STEP_MINUTES; // 48 half-hours

/** slots → Set of "day:index" keys */
export function slotsToCells(slots = []) {
  const cells = new Set();
  for (const s of slots) {
    for (let m = timeToMinutes(s.start); m < timeToMinutes(s.end); m += SLOT_STEP_MINUTES) {
      cells.add(`${s.day}:${m / SLOT_STEP_MINUTES}`);
    }
  }
  return cells;
}

/** Set of cells → merged ranges, e.g. 09:00, 09:30, 10:00 → 09:00–10:30 */
export function cellsToSlots(cells) {
  const slots = [];
  for (let day = 0; day < 7; day += 1) {
    let runStart = null;
    for (let i = 0; i <= CELLS_PER_DAY; i += 1) {
      const on = i < CELLS_PER_DAY && cells.has(`${day}:${i}`);
      if (on && runStart === null) runStart = i;
      if (!on && runStart !== null) {
        slots.push({
          day,
          start: minutesToTime(runStart * SLOT_STEP_MINUTES),
          end: minutesToTime(i * SLOT_STEP_MINUTES),
        });
        runStart = null;
      }
    }
  }
  return slots;
}

/**
 * Weekly availability editor (SB1/US27, US28).
 * Click or drag to paint half-hour cells. Keyboard: arrow keys move, Space toggles.
 */
export function AvailabilityGrid({ slots, onChange, showAllHours = false }) {
  const cells = useMemo(() => slotsToCells(slots), [slots]);
  const [focus, setFocus] = useState({ day: 0, index: 18 }); // Monday 09:00
  const drag = useRef(null);
  const gridRef = useRef(null);
  const firstIndex = showAllHours ? 0 : 12; // 06:00
  const lastIndex = showAllHours ? CELLS_PER_DAY - 1 : 45; // 23:00 row (22:30–23:00 is index 45)
  const rows = [];
  for (let i = firstIndex; i <= lastIndex; i += 1) rows.push(i);

  useEffect(() => {
    const end = () => {
      drag.current = null;
    };
    window.addEventListener('pointerup', end);
    return () => window.removeEventListener('pointerup', end);
  }, []);

  function apply(day, index, mode) {
    const key = `${day}:${index}`;
    const next = new Set(cells);
    if (mode === 'add') next.add(key);
    else next.delete(key);
    if (next.size !== cells.size) onChange(cellsToSlots(next));
  }

  function onPointerDown(e, day, index) {
    e.preventDefault();
    const mode = cells.has(`${day}:${index}`) ? 'remove' : 'add';
    drag.current = { mode, cells: new Set(cells) };
    setFocus({ day, index });
    apply(day, index, mode);
  }

  function onPointerEnter(day, index) {
    if (!drag.current) return;
    apply(day, index, drag.current.mode);
  }

  function moveFocus(day, index) {
    const d = Math.min(6, Math.max(0, day));
    const i = Math.min(lastIndex, Math.max(firstIndex, index));
    setFocus({ day: d, index: i });
    // Focus right away (not on the next frame) so a quick "ArrowDown, Space" toggles the new cell.
    gridRef.current?.querySelector(`[data-cell="${d}:${i}"]`)?.focus();
  }

  function onKeyDown(e, day, index) {
    const map = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
    if (map[e.key]) {
      e.preventDefault();
      moveFocus(day + map[e.key][0], index + map[e.key][1]);
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      apply(day, index, cells.has(`${day}:${index}`) ? 'remove' : 'add');
    }
  }

  // Keep the focused cell inside the visible hours when the range changes.
  const focusIndex = Math.min(lastIndex, Math.max(firstIndex, focus.index));

  return (
    <div
      ref={gridRef}
      className={styles.grid}
      role="grid"
      aria-label="Weekly availability. Use arrow keys to move and Space to mark a half hour as available."
      aria-rowcount={rows.length + 1}
      aria-colcount={8}
    >
      <div role="row" className={styles.gridRow}>
        <span role="columnheader" className={styles.corner}>
          <span className="sr-only">Time</span>
        </span>
        {WEEKDAYS.map((d) => (
          <span key={d.value} role="columnheader" className={styles.dayHeader}>
            <abbr title={d.label}>{d.short}</abbr>
          </span>
        ))}
      </div>
      {rows.map((index) => {
        const time = minutesToTime(index * SLOT_STEP_MINUTES);
        const end = minutesToTime((index + 1) * SLOT_STEP_MINUTES);
        const onHour = index % 2 === 0;
        return (
          <div key={index} role="row" className={`${styles.gridRow} ${onHour ? styles.hourRow : ''}`}>
            <span role="rowheader" className={styles.timeLabel}>
              {onHour ? time : <span className="sr-only">{time}</span>}
            </span>
            {WEEKDAYS.map((d) => {
              const on = cells.has(`${d.value}:${index}`);
              const isFocus = focus.day === d.value && focusIndex === index;
              return (
                <div
                  key={d.value}
                  role="gridcell"
                  data-cell={`${d.value}:${index}`}
                  aria-selected={on}
                  aria-label={`${d.label} ${time} to ${end}, ${on ? 'available' : 'not available'}`}
                  tabIndex={isFocus ? 0 : -1}
                  className={`${styles.cell} ${on ? styles.cellOn : ''}`}
                  onPointerDown={(e) => onPointerDown(e, d.value, index)}
                  onPointerEnter={() => onPointerEnter(d.value, index)}
                  onKeyDown={(e) => onKeyDown(e, d.value, index)}
                  onFocus={() => setFocus({ day: d.value, index })}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
