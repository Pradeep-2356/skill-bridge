import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { THEME_PREFERENCES, THEME_STORAGE_KEY } from '@skillbridge/shared';

/**
 * Light / dark theme (Sprint 2 additional requirement).
 * - preference: 'system' (default on first visit), 'light' or 'dark' – saved in localStorage.
 * - theme: what is actually shown ('light' | 'dark'); for 'system' it follows the OS setting live.
 * The theme is applied as <html data-theme="…">; every colour comes from tokens.css.
 * public/theme-init.js does the same before React loads, so there is no flash on refresh.
 */
const ThemeContext = createContext(null);

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function readStoredPreference() {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_PREFERENCES.includes(value) ? value : 'system';
  } catch {
    return 'system';
  }
}

function systemPrefersDark() {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

export const resolveTheme = (preference, prefersDark) =>
  preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;

function applyTheme(theme, { animate }) {
  const root = document.documentElement;
  if (animate && !window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
    root.classList.add('theme-transition');
    window.setTimeout(() => root.classList.remove('theme-transition'), 250);
  }
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0B1120' : '#4F46E5');
}

export function ThemeProvider({ children }) {
  const [preference, setPreferenceState] = useState(readStoredPreference);
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);
  const theme = resolveTheme(preference, prefersDark);

  // Follow the operating-system setting while the preference is "system".
  useEffect(() => {
    let media;
    try {
      media = window.matchMedia(DARK_QUERY);
    } catch {
      return undefined;
    }
    const onChange = (e) => setPrefersDark(e.matches);
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  // First render: no animation (theme-init.js already applied it). Later changes: animate.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    applyTheme(theme, { animate: mounted });
    setMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  const setPreference = useCallback((next) => {
    if (!THEME_PREFERENCES.includes(next)) return;
    setPreferenceState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* storage blocked: the choice still applies for this visit */
    }
  }, []);

  const toggle = useCallback(() => setPreference(theme === 'dark' ? 'light' : 'dark'), [theme, setPreference]);

  const value = useMemo(
    () => ({ preference, theme, setPreference, toggle }),
    [preference, theme, setPreference, toggle],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
