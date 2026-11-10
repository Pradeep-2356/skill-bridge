import { X } from 'lucide-react';
import { PROFICIENCY_LEVELS, WEEKDAYS, TZ_COMPATIBLE_HOURS } from '@skillbridge/shared';
import { Select, Checkbox, Button } from '../../components/ui/index.js';
import { HALF_HOURS } from '../../utils/format.js';
import styles from './Discover.module.css';

export const EMPTY_FILTERS = { category: '', proficiency: '', days: [], from: '', to: '', tzCompatible: false };

export const hasFilters = (f) =>
  Boolean(f.category || f.proficiency || f.days.length || f.from || f.to || f.tzCompatible);

const levelLabel = (v) => PROFICIENCY_LEVELS.find((l) => l.value === v)?.label ?? v;

/**
 * Discovery filters (SB2/US4–7). Every change is applied immediately and kept
 * in the URL, so a filtered list can be bookmarked or shared.
 */
export function FilterPanel({ filters, categories, onChange, onClear, id = 'filters' }) {
  const set = (patch) => onChange({ ...filters, ...patch });
  const toggleDay = (day) =>
    set({ days: filters.days.includes(day) ? filters.days.filter((d) => d !== day) : [...filters.days, day].sort() });

  return (
    <section className={styles.filters} aria-labelledby={`${id}-title`} id={id}>
      <div className={styles.filtersHead}>
        <h2 id={`${id}-title`} className={styles.filtersTitle}>
          Filters
        </h2>
        {hasFilters(filters) ? (
          <Button variant="link" size="sm" onClick={onClear}>
            Clear filters
          </Button>
        ) : null}
      </div>

      <Select
        id={`${id}-category`}
        label="Category"
        value={filters.category}
        onChange={(e) => set({ category: e.target.value })}
        placeholder="All categories"
        options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
      />

      <Select
        id={`${id}-level`}
        label="Mentor level"
        hint="Shows mentors at this level or above"
        value={filters.proficiency}
        onChange={(e) => set({ proficiency: e.target.value })}
        placeholder="Any level"
        options={PROFICIENCY_LEVELS.map((l) => ({ value: l.value, label: `${l.label} or above` }))}
      />

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Available on</legend>
        <div className={styles.dayChips}>
          {WEEKDAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              className={styles.dayChip}
              aria-pressed={filters.days.includes(d.value)}
              aria-label={d.label}
              onClick={() => toggleDay(d.value)}
            >
              {d.short}
            </button>
          ))}
        </div>
        <div className={styles.timeRow}>
          <Select
            id={`${id}-from`}
            label="From"
            value={filters.from}
            onChange={(e) => set({ from: e.target.value })}
            placeholder="Any time"
            options={HALF_HOURS.slice(0, -1).map((t) => ({ value: t, label: t }))}
          />
          <Select
            id={`${id}-to`}
            label="To"
            value={filters.to}
            onChange={(e) => set({ to: e.target.value })}
            placeholder="Any time"
            options={HALF_HOURS.slice(1).map((t) => ({
              value: t,
              label: t,
              disabled: Boolean(filters.from) && t <= filters.from,
            }))}
          />
        </div>
        <p className={styles.filterHint}>Times are in your own time zone.</p>
      </fieldset>

      <Checkbox
        id={`${id}-tz`}
        label={`Within ${TZ_COMPATIBLE_HOURS} hours of my time zone`}
        checked={filters.tzCompatible}
        onChange={(e) => set({ tzCompatible: e.target.checked })}
      />
    </section>
  );
}

/** Removable chips for every applied filter, plus "Clear all" (SB2/US40). */
export function ActiveFilters({ filters, categories, onChange, onClear }) {
  if (!hasFilters(filters)) return null;
  const chips = [];
  if (filters.category) {
    const name = categories?.find((c) => c.id === filters.category)?.name ?? 'Category';
    chips.push({ key: 'category', label: name, clear: { category: '' } });
  }
  if (filters.proficiency) {
    chips.push({ key: 'level', label: `${levelLabel(filters.proficiency)}+`, clear: { proficiency: '' } });
  }
  if (filters.days.length) {
    const label = filters.days.map((d) => WEEKDAYS[d]?.short).join(', ');
    chips.push({ key: 'days', label, clear: { days: [] } });
  }
  if (filters.from || filters.to) {
    chips.push({
      key: 'time',
      label: `${filters.from || '00:00'}–${filters.to || '24:00'}`,
      clear: { from: '', to: '' },
    });
  }
  if (filters.tzCompatible) {
    chips.push({ key: 'tz', label: `±${TZ_COMPATIBLE_HOURS} h time zone`, clear: { tzCompatible: false } });
  }
  return (
    <div className={styles.activeFilters} aria-label="Applied filters">
      {chips.map((c) => (
        <span key={c.key} className={styles.activeChip}>
          {c.label}
          <button
            type="button"
            aria-label={`Remove filter ${c.label}`}
            onClick={() => onChange({ ...filters, ...c.clear })}
          >
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}
      <Button variant="link" size="sm" onClick={onClear}>
        Clear all
      </Button>
    </div>
  );
}
