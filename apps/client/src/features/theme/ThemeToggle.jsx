import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.jsx';
import styles from './Theme.module.css';

/**
 * Sun/moon button that switches between light and dark from anywhere in the app.
 * Screen readers hear the new state ("Dark theme on") through a polite live region.
 */
export function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme();
  const [announcement, setAnnouncement] = useState('');
  const isDark = theme === 'dark';
  const next = isDark ? 'light' : 'dark';
  return (
    <>
      <button
        type="button"
        className={`${styles.toggle} ${className}`}
        onClick={() => {
          toggle();
          setAnnouncement(`${next === 'dark' ? 'Dark' : 'Light'} theme on`);
        }}
        aria-label={`Switch to ${next} theme`}
        title={`Switch to ${next} theme`}
        data-theme-state={theme}
      >
        <span className={styles.icon} key={theme}>
          {isDark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
        </span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </>
  );
}
