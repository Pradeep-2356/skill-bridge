import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp, makeUser, SKILL_REACT } from '../../test/utils.jsx';
import { server, http, API, ok } from '../../test/server.js';

const admin = makeUser({ id: 'admin1', role: 'admin', name: 'Asha Admin' });
const member = {
  id: 'u1',
  name: 'Jacob Turner',
  email: 'jacob@skillbridge.test',
  role: 'user',
  status: 'active',
  avatarUrl: null,
  teachSkillsCount: 1,
  learnSkillsCount: 0,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-02T10:00:00.000Z',
  lastLoginAt: null,
  headline: 'Finance nerd',
  bio: '',
  timezone: 'America/New_York',
  deactivation: null,
  teachSkills: [{ id: 't1', skill: SKILL_REACT, proficiency: 'advanced' }],
  learnSkills: [],
  availabilitySlots: 2,
  sessionsCount: 0,
};

describe('Admin user management (SB1/US47–49)', () => {
  it('filters the user list by search text and status', async () => {
    const queries = [];
    server.use(
      http.get(`${API}/admin/users`, ({ request }) => {
        queries.push(Object.fromEntries(new URL(request.url).searchParams));
        return ok(
          { users: [member] },
          { page: 1, limit: 15, total: 1, totalPages: 1, totals: { active: 1, deactivated: 0 } },
        );
      }),
    );
    const { user } = renderApp('/admin/users', { user: admin });
    expect(await screen.findByRole('link', { name: 'Jacob Turner' })).toHaveAttribute('href', '/admin/users/u1');
    await user.type(screen.getByLabelText('Search by name or email'), 'jac');
    await user.selectOptions(screen.getByLabelText('Status'), 'active');
    await waitFor(() => expect(queries.at(-1)).toMatchObject({ q: 'jac', status: 'active' }));
  });

  it('requires a reason, then deactivates the account and shows the new status (SB1/US48, US49)', async () => {
    let body;
    server.use(
      http.get(`${API}/admin/users/u1`, () => ok({ user: member })),
      http.patch(`${API}/admin/users/u1/status`, async ({ request }) => {
        body = await request.json();
        return ok({
          user: {
            ...member,
            status: 'deactivated',
            deactivation: { by: 'admin', reason: body.reason, at: '2026-11-09T10:00:00.000Z' },
          },
        });
      }),
    );
    const { user } = renderApp('/admin/users/u1', { user: admin });
    expect(await screen.findByText('jacob@skillbridge.test')).toBeInTheDocument();
    expect(screen.getByText('Finance nerd')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Deactivate account' }));
    const dialog = await screen.findByRole('dialog', { name: /deactivate jacob turner/i });
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    expect(await within(dialog).findByText('Give a reason of at least 5 characters')).toBeInTheDocument();
    expect(body).toBeUndefined();

    await user.type(within(dialog).getByLabelText(/reason/i), 'Spam reported by members');
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    expect(await screen.findByText('Deactivated by an administrator')).toBeInTheDocument();
    expect(body).toEqual({ status: 'deactivated', reason: 'Spam reported by members' });
    expect(screen.getByRole('button', { name: 'Reactivate account' })).toBeInTheDocument();
  });

  it('does not offer to deactivate the admin’s own account', async () => {
    server.use(
      http.get(`${API}/admin/users/admin1`, () =>
        ok({ user: { ...member, id: 'admin1', name: 'Asha Admin', role: 'admin' } }),
      ),
    );
    renderApp('/admin/users/admin1', { user: admin });
    expect(await screen.findByText('This is your account')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deactivate account' })).not.toBeInTheDocument();
  });
});
