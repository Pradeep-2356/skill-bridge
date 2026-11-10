/*
 * Runs before the page is drawn (loaded with a plain <script> in index.html), so the
 * right theme is applied on the very first paint – no flash of the wrong theme.
 * Kept as a separate file because the server's Content-Security-Policy blocks inline scripts.
 * Preference: localStorage "sb-theme" = "light" | "dark" | "system" (default "system").
 */
(function initTheme() {
  var preference = 'system';
  try {
    var saved = window.localStorage.getItem('sb-theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') preference = saved;
  } catch (e) {
    /* storage blocked (private mode): fall back to the system setting */
  }
  var prefersDark;
  try {
    prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (e) {
    prefersDark = false;
  }
  var theme = preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;
  var root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
})();
