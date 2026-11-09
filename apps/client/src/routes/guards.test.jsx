import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderApp, makeUser, emptyDashboard } from '../test/utils.jsx';
import { server, http, API, ok } from '../test/server.js';
import { safeNext } from './guards.jsx';

describe('route guards (SB1/US10, US13, US47)', () => {
  it('sends a guest from a protected page to Login, remembering where they were going', async () => {
    const { router } = renderApp('/skills?tab=learn');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent('/skills?tab=learn')}`);
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });

  it('keeps a signed-in user on protected pages across navigation', async () => {
    const me = makeUser();
    server.use(http.get(`${API}/dashboard`, () => ok(emptyDashboard(me))));
    const { router, user } = renderApp('/dashboard', { user: me });
    expect(await screen.findByRole('heading', { name: /priya/i, level: 1 })).toBeInTheDocument();

    server.use(
      http.get(`${API}/sessions`, () => ok({ sessions: [] }, { page: 1, limit: 10, total: 0, totalPages: 1 })),
    );
    await user.click(screen.getByRole('link', { name: 'Sessions' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/sessions'));
    expect(await screen.findByRole('heading', { name: 'Sessions', level: 1 })).toBeInTheDocument();
  });

  it('redirects a signed-in user away from the login page', async () => {
    const me = makeUser();
    server.use(http.get(`${API}/dashboard`, () => ok(emptyDashboard(me))));
    const { router } = renderApp('/login', { user: me });
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });

  it('shows "Administrators only" to a normal user on admin pages', async () => {
    renderApp('/admin/users', { user: makeUser() });
    expect(await screen.findByText('Administrators only')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /manage users/i })).not.toBeInTheDocument();
  });

  it('shows the admin user list and the admin menu item to an admin', async () => {
    const admin = makeUser({ role: 'admin', name: 'Asha Admin' });
    server.use(
      http.get(`${API}/admin/users`, () =>
        ok(
          { users: [{ ...admin, teachSkillsCount: 0, learnSkillsCount: 0, lastLoginAt: null }] },
          { page: 1, limit: 15, total: 1, totalPages: 1, totals: { active: 1, deactivated: 0 } },
        ),
      ),
    );
    renderApp('/admin/users', { user: admin });
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /manage users/i })).toBeInTheDocument();
  });

  it('only accepts internal redirect targets', () => {
    expect(safeNext('/skills')).toBe('/skills');
    expect(safeNext('//evil.example')).toBeNull();
    expect(safeNext('https://evil.example')).toBeNull();
    expect(safeNext(null)).toBeNull();
  });
});
