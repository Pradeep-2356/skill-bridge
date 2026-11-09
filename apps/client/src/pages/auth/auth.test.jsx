import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp, makeUser, emptyDashboard } from '../../test/utils.jsx';
import { server, http, API, ok, fail } from '../../test/server.js';

describe('Register page (SB1/US1, US2, US8, US9, US15)', () => {
  it('shows a message for every invalid field and does not call the API', async () => {
    let called = false;
    server.use(http.post(`${API}/auth/register`, () => ((called = true), ok({}))));
    const { user } = renderApp('/register');
    await user.click(await screen.findByRole('button', { name: /create account/i }));

    const summary = await screen.findByRole('alert');
    expect(summary).toHaveTextContent(/please fix 4 problems/i);
    expect(screen.getByLabelText(/full name/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute('aria-invalid', 'true');
    expect(called).toBe(false);
    await waitFor(() => expect(summary).toHaveFocus());
  });

  it('updates the password checklist as the user types', async () => {
    const { user } = renderApp('/register');
    const password = await screen.findByLabelText(/^password/i, { selector: 'input' });
    await user.type(password, 'abc');
    expect(screen.getByText(/password strength: weak/i)).toBeInTheDocument();
    await user.clear(password);
    await user.type(password, 'Str0ng!Passw0rd');
    expect(screen.getByText(/password strength: strong/i)).toBeInTheDocument();
    expect(screen.getByText('A symbol (e.g. ! @ # $)').closest('li')).toHaveTextContent('done');
  });

  it('shows the server’s "email already registered" error on the email field (SB1/US9)', async () => {
    server.use(
      http.post(`${API}/auth/register`, () =>
        fail(409, 'EMAIL_TAKEN', 'An account with this email already exists.', {
          fields: { email: 'An account with this email already exists. Try logging in instead.' },
        }),
      ),
    );
    const { user } = renderApp('/register');
    await user.type(await screen.findByLabelText(/full name/i), 'Arjun Mehta');
    await user.type(screen.getByLabelText(/^email/i), 'arjun@skillbridge.test');
    await user.type(screen.getByLabelText(/^password/i, { selector: 'input' }), 'Str0ng!Pass');
    await user.type(screen.getByLabelText(/confirm password/i, { selector: 'input' }), 'Str0ng!Pass');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText(/try logging in instead/i, { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByLabelText(/^email/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('creates the account and opens the dashboard', async () => {
    const created = makeUser({ name: 'Arjun Mehta' });
    let body;
    server.use(
      http.post(`${API}/auth/register`, async ({ request }) => {
        body = await request.json();
        return ok({ user: created });
      }),
      http.get(`${API}/dashboard`, () => ok(emptyDashboard(created))),
    );
    const { user, router } = renderApp('/register');
    await user.type(await screen.findByLabelText(/full name/i), 'Arjun Mehta');
    await user.type(screen.getByLabelText(/^email/i), 'arjun@skillbridge.test');
    await user.type(screen.getByLabelText(/^password/i, { selector: 'input' }), 'Str0ng!Pass');
    await user.type(screen.getByLabelText(/confirm password/i, { selector: 'input' }), 'Str0ng!Pass');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(body).toMatchObject({ name: 'Arjun Mehta', email: 'arjun@skillbridge.test', timezone: expect.any(String) });
    expect(await screen.findByText(/welcome, arjun/i)).toBeInTheDocument();
  });
});

describe('Login page (SB1/US3, US32)', () => {
  it('shows the server error message for wrong credentials', async () => {
    server.use(
      http.post(`${API}/auth/login`, () => fail(401, 'INVALID_CREDENTIALS', 'The email or password is incorrect.')),
    );
    const { user } = renderApp('/login');
    await user.type(await screen.findByLabelText(/^email/i), 'priya@skillbridge.test');
    await user.type(screen.getByLabelText(/^password/i, { selector: 'input' }), 'wrong');
    await user.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText('The email or password is incorrect.')).toBeInTheDocument();
  });

  it('disables the button while logging in, then returns to the page in ?next=', async () => {
    const me = makeUser();
    let release;
    server.use(
      http.post(`${API}/auth/login`, () => new Promise((resolve) => (release = () => resolve(ok({ user: me }))))),
      http.get(`${API}/sessions`, () => ok({ sessions: [] }, { page: 1, limit: 10, total: 0, totalPages: 1 })),
    );
    const { user, router } = renderApp('/login?next=%2Fsessions');
    await user.type(await screen.findByLabelText(/^email/i), me.email);
    await user.type(screen.getByLabelText(/^password/i, { selector: 'input' }), 'Str0ng!Pass');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /log in/i })).toBeDisabled());
    release();
    await waitFor(() => expect(router.state.location.pathname).toBe('/sessions'));
  });

  it('offers to reactivate a self-deactivated account and retries with reactivate: true', async () => {
    const me = makeUser();
    const bodies = [];
    server.use(
      http.post(`${API}/auth/login`, async ({ request }) => {
        const body = await request.json();
        bodies.push(body);
        return body.reactivate
          ? ok({ user: me })
          : fail(403, 'ACCOUNT_DEACTIVATED', 'You deactivated this account.', { details: { canReactivate: true } });
      }),
      http.get(`${API}/dashboard`, () => ok(emptyDashboard(me))),
    );
    const { user, router } = renderApp('/login');
    await user.type(await screen.findByLabelText(/^email/i), me.email);
    await user.type(screen.getByLabelText(/^password/i, { selector: 'input' }), 'Str0ng!Pass');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    const dialog = await screen.findByRole('dialog', { name: /reactivate your account/i });
    await user.click(within(dialog).getByRole('button', { name: /reactivate and log in/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(bodies.map((b) => Boolean(b.reactivate))).toEqual([false, true]);
  });
});

describe('Password recovery (SB1/US5, US6)', () => {
  it('confirms that a reset link was sent', async () => {
    server.use(http.post(`${API}/auth/forgot-password`, () => ok({ message: 'sent' })));
    const { user } = renderApp('/forgot-password');
    await user.type(await screen.findByLabelText(/^email/i), 'priya@skillbridge.test');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByRole('heading', { name: /check your inbox/i })).toBeInTheDocument();
    expect(screen.getByText('priya@skillbridge.test')).toBeInTheDocument();
  });

  it('explains when a reset link has expired', async () => {
    server.use(
      http.post(`${API}/auth/reset-password`, () =>
        fail(400, 'RESET_TOKEN_INVALID', 'This reset link is invalid or has expired.'),
      ),
    );
    const { user } = renderApp('/reset-password/abcdefghijklmnopqrstuvwxyz0123456789');
    await user.type(await screen.findByLabelText(/^new password/i, { selector: 'input' }), 'N3w!Password');
    await user.type(screen.getByLabelText(/confirm new password/i, { selector: 'input' }), 'N3w!Password');
    await user.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByRole('heading', { name: /this link has expired/i })).toBeInTheDocument();
  });

  it('sends the user to log in after a successful reset', async () => {
    server.use(http.post(`${API}/auth/reset-password`, () => ok({ message: 'ok' })));
    const { user, router } = renderApp('/reset-password/abcdefghijklmnopqrstuvwxyz0123456789');
    await user.type(await screen.findByLabelText(/^new password/i, { selector: 'input' }), 'N3w!Password');
    await user.type(screen.getByLabelText(/confirm new password/i, { selector: 'input' }), 'N3w!Password');
    await user.click(screen.getByRole('button', { name: /update password/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(await screen.findByText(/log in with your new password/i)).toBeInTheDocument();
  });
});
