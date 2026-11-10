import { Monitor, Sun, Moon } from 'lucide-react';
import { Card } from '../../components/ui/index.js';
import { useTheme } from '../../context/ThemeContext.jsx';
import styles from './Theme.module.css';

const OPTIONS = [
  { value: 'system', label: 'System', hint: 'Match your device setting', icon: Monitor },
  { value: 'light', label: 'Light', hint: 'Bright background', icon: Sun },
  { value: 'dark', label: 'Dark', hint: 'Easier on the eyes at night', icon: Moon },
];

/** Settings → Appearance: choose System, Light or Dark (saved in this browser). */
export function AppearanceCard() {
  const { preference, theme, setPreference } = useTheme();
  return (
    <Card title="Appearance" subtitle={`Saved in this browser. Showing the ${theme} theme now.`}>
      <div role="radiogroup" aria-label="Theme" className={styles.options}>
        {OPTIONS.map(({ value, label, hint, icon: Icon }) => (
          <label key={value} className={styles.option} data-checked={preference === value}>
            <input
              type="radio"
              name="theme-preference"
              value={value}
              checked={preference === value}
              onChange={() => setPreference(value)}
              className="sr-only"
            />
            <Icon size={20} aria-hidden="true" />
            <span className={styles.optionLabel}>{label}</span>
            <span className={styles.optionHint}>{hint}</span>
          </label>
        ))}
      </div>
    </Card>
  );
}
