import { useId } from 'react';
import styles from './Form.module.css';

/** Accessible on/off switch (role="switch"), used for settings such as accepting requests. */
export function Switch({ id, label, description, checked, onChange, disabled = false }) {
  const autoId = useId();
  const switchId = id ?? autoId;
  const descId = `${switchId}-desc`;
  return (
    <div className={styles.switchRow}>
      <div>
        <label htmlFor={switchId} className={styles.switchLabel}>
          {label}
        </label>
        {description ? (
          <p id={descId} className={styles.hint}>
            {description}
          </p>
        ) : null}
      </div>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? descId : undefined}
        className={styles.switch}
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.switchThumb} aria-hidden="true" />
      </button>
    </div>
  );
}
