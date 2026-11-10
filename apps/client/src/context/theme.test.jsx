/**
 * Dark / light theme (Sprint 2 additional requirement): system detection, switching,
 * persistence, the no-flash init script, route consistency, settings, and token contrast.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { screen, waitFor } from '@testing-library/react';
import { renderApp, makeUser, emptyDashboard } from '../test/utils.jsx';
import { server, http, API, ok } from '../test/server.js';
import { resolveTheme } from './ThemeContext.jsx';

const here = path.dirname(fileURLToPath(import.meta.url));
const me = makeUser();
const root = document.documentElement;

/** Fakes the operating-system colour preference. */
function mockSystem(dark) {
  const listeners = new Set();
  const media = {
    matches: dark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_e, fn) => listeners.add(fn),
    removeEventListener: (_e, fn) => listeners.delete(fn),
  };
  window.matchMedia = vi.fn((query) =>
    query.includes('prefers-color-scheme')
      ? media
      : { matches: false, addEventListener() {}, removeEventListener() {} },
  );
  return {
    change(next) {
      media.matches = next;
      listeners.forEach((fn) => fn({ matches: next }));
    },
  };
}

beforeEach(() => {
  window.localStorage.clear();
  root.removeAttribute('data-theme');
  server.use(http.get(`${API}/dashboard`, () => ok(emptyDashboard(me))));
});
afterEach(() => {
  delete window.matchMedia;
});

describe('theme', () => {
  it('follows the system preference on the first visit, including live changes', async () => {
    const system = mockSystem(true);
    renderApp('/dashboard', { user: me });
    await screen.findByText(/good (morning|afternoon|evening)/i);
    expect(root.dataset.theme).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
    expect(window.localStorage.getItem('sb-theme')).toBeNull();
    system.change(false);
    await waitFor(() => expect(root.dataset.theme).toBe('light'));
  });

  it('switches light → dark → light from the top bar and remembers the choice', async () => {
    mockSystem(false);
    const { user } = renderApp('/dashboard', { user: me });
    const toggle = await screen.findByRole('button', { name: 'Switch to dark theme' });
    expect(root.dataset.theme).toBe('light');
    await user.click(toggle);
    expect(root.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('sb-theme')).toBe('dark');
    expect(screen.getByText('Dark theme on')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Switch to light theme' }));
    expect(root.dataset.theme).toBe('light');
    expect(window.localStorage.getItem('sb-theme')).toBe('light');
  });

  it('keeps a manual choice after a refresh even when the system says otherwise', async () => {
    mockSystem(false);
    window.localStorage.setItem('sb-theme', 'dark');
    const first = renderApp('/dashboard', { user: me });
    await screen.findByRole('button', { name: 'Switch to light theme' });
    expect(root.dataset.theme).toBe('dark');
    first.unmount();
    renderApp('/dashboard', { user: me }); // a "refresh"
    await screen.findByRole('button', { name: 'Switch to light theme' });
    expect(root.dataset.theme).toBe('dark');
  });

  it('stays the same while moving between pages', async () => {
    mockSystem(false);
    window.localStorage.setItem('sb-theme', 'dark');
    server.use(
      http.get(`${API}/search/mentors`, () => ok({ mentors: [] }, { page: 1, limit: 12, total: 0, totalPages: 1 })),
    );
    const { user, router } = renderApp('/dashboard', { user: me });
    await screen.findByRole('button', { name: 'Switch to light theme' });
    await user.click(screen.getAllByRole('link', { name: 'Find mentors' })[0]);
    await waitFor(() => expect(router.state.location.pathname).toBe('/discover'));
    expect(root.dataset.theme).toBe('dark');
    await router.navigate('/settings');
    expect(await screen.findByText('Appearance')).toBeInTheDocument();
    expect(root.dataset.theme).toBe('dark');
  });

  it('offers System, Light and Dark in Settings', async () => {
    const system = mockSystem(true);
    window.localStorage.setItem('sb-theme', 'light');
    const { user } = renderApp('/settings', { user: me });
    const light = await screen.findByRole('radio', { name: /light/i });
    expect(light).toBeChecked();
    await user.click(screen.getByRole('radio', { name: /system/i }));
    expect(window.localStorage.getItem('sb-theme')).toBe('system');
    expect(root.dataset.theme).toBe('dark');
    system.change(false);
    await waitFor(() => expect(root.dataset.theme).toBe('light'));
    await user.click(screen.getByRole('radio', { name: /dark/i }));
    expect(root.dataset.theme).toBe('dark');
  });

  it('works on the login page and inside dialogs', async () => {
    mockSystem(false);
    const { user } = renderApp('/login', { user: null });
    await user.click(await screen.findByRole('button', { name: 'Switch to dark theme' }));
    expect(root.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('sb-theme')).toBe('dark');
  });

  it('survives blocked storage', async () => {
    mockSystem(true);
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { user } = renderApp('/dashboard', { user: me });
    await user.click(await screen.findByRole('button', { name: 'Switch to light theme' }));
    expect(root.dataset.theme).toBe('light');
    getItem.mockRestore();
    setItem.mockRestore();
  });

  it('resolves the shown theme from the preference', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('no-flash init script (public/theme-init.js)', () => {
  const script = fs.readFileSync(path.resolve(here, '../../public/theme-init.js'), 'utf8');
  const run = () => new Function(script)();

  it.each([
    ['dark', false, 'dark'],
    ['light', true, 'light'],
    ['system', true, 'dark'],
    [null, false, 'light'],
    ['purple', true, 'dark'],
  ])('saved %s with system dark=%s → %s', (saved, systemDark, expected) => {
    mockSystem(systemDark);
    if (saved) window.localStorage.setItem('sb-theme', saved);
    run();
    expect(root.getAttribute('data-theme')).toBe(expected);
    expect(root.style.colorScheme).toBe(expected);
  });

  it('is loaded before the app in index.html', () => {
    const html = fs.readFileSync(path.resolve(here, '../../index.html'), 'utf8');
    expect(html.indexOf('/theme-init.js')).toBeGreaterThan(-1);
    expect(html.indexOf('/theme-init.js')).toBeLessThan(html.indexOf('/src/main.jsx'));
  });
});

describe('design tokens', () => {
  const css = fs.readFileSync(path.resolve(here, '../styles/tokens.css'), 'utf8');
  const block = (selector) => {
    const start = css.indexOf(`${selector} {`);
    return css.slice(start, css.indexOf('\n}', start));
  };
  const vars = (text) =>
    Object.fromEntries([...text.matchAll(/(--color-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const light = vars(block(':root'));
  const dark = vars(block(":root[data-theme='dark']"));

  it('gives every light colour token a dark value', () => {
    const missing = Object.keys(light).filter((k) => !(k in dark) && k !== '--color-text-inverse');
    expect(missing).toEqual([]);
  });

  it('keeps important text readable (WCAG AA 4.5:1) in the dark theme', () => {
    const lum = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
      const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => {
      const [x, y] = [lum(dark[a]), lum(dark[b])].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const pairs = [
      ['--color-text', '--color-bg'],
      ['--color-text', '--color-surface'],
      ['--color-text-secondary', '--color-surface-muted'],
      ['--color-text-muted', '--color-surface'],
      ['--color-text-muted', '--color-surface-muted'],
      ['--color-primary', '--color-surface'],
      ['--color-on-primary', '--color-primary'],
      ['--color-on-danger', '--color-danger'],
      ['--color-primary-active', '--color-primary-tint'],
      ['--color-teach', '--color-teach-tint'],
      ['--color-learn', '--color-learn-tint'],
      ['--color-success', '--color-success-tint'],
      ['--color-danger', '--color-danger-tint'],
      ['--color-warning', '--color-warning-tint'],
      ['--color-pending', '--color-pending-tint'],
    ];
    for (const [fg, bg] of pairs) expect(ratio(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  it('does not use pure black as the dark background', () => {
    expect(dark['--color-bg']).not.toBe('#000000');
    expect(dark['--color-surface']).not.toBe(dark['--color-bg']);
  });
});
