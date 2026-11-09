import { Check } from 'lucide-react';
import { LIMITS } from '@skillbridge/shared';
import styles from './Profile.module.css';

/** Toggle buttons for broad learning interests (SB1/US19). */
export function InterestPicker({ categories, value = [], onChange, error }) {
  const atLimit = value.length >= LIMITS.MAX_INTERESTS;
  function toggle(id) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }
  return (
    <fieldset className={styles.interestFieldset} aria-describedby="interests-hint">
      <legend className={styles.interestLegend}>Learning interests</legend>
      <p id="interests-hint" className={styles.avatarHint}>
        Pick the areas you’d like to learn about ({value.length}/{LIMITS.MAX_INTERESTS} chosen).
      </p>
      <div className={styles.interestGrid} id="field-learningInterests">
        {categories.map((c) => {
          const on = value.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              disabled={!on && atLimit}
              className={`${styles.interestToggle} ${on ? styles.interestOn : ''}`}
              onClick={() => toggle(c.id)}
            >
              {on ? <Check size={14} aria-hidden="true" /> : null}
              {c.name}
            </button>
          );
        })}
      </div>
      {error ? <p className={styles.avatarError}>{error}</p> : null}
    </fieldset>
  );
}
