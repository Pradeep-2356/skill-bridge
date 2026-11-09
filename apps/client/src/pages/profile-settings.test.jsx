import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp, makeUser, CATEGORIES, SKILL_REACT } from '../test/utils.jsx';
import { server, http, API, ok, fail } from '../test/server.js';

const me = makeUser({
  bio: 'I build web apps.',
  teachSkills: [{ id: 't1', skill: SKILL_REACT, proficiency: 'expert', yearsExperience: 6, description: '' }],
  learningInterests: [CATEGORIES[1]],
  availability: [{ day: 0, start: '18:00', end: '21:00' }],
});

describe('Profile (SB1/US16–19, US30, US31, US46)', () => {
  it('shows private details only on my own profile page', async () => {
    server.use(http.get(`${API}/users/me`, () => ok({ user: me })));
    renderApp('/profile', { user: me });
    expect(await screen.findByText('priya@skillbridge.test')).toBeInTheDocument();
    expect(screen.getByText(/expert · 6 yrs/i)).toBeInTheDocument();
    expect(screen.getByText('Music')).toBeInTheDocument();
  });

  it('previews the profile without email, role or status', async () => {
    const { email: _e, role: _r, status: _s, ...publicProfile } = me;
    server.use(http.get(`${API}/users/me/preview`, () => ok({ profile: publicProfile })));
    renderApp('/profile/preview', { user: me });
    expect(await screen.findByRole('heading', { name: 'Priya Sharma', level: 2 })).toBeInTheDocument();
    expect(screen.queryByText('priya@skillbridge.test')).not.toBeInTheDocument();
  });

  it('shows a friendly message for an unavailable public profile', async () => {
    server.use(http.get(`${API}/users/u404`, () => fail(404, 'NOT_FOUND', 'This profile is not available.')));
    renderApp('/users/u404', { user: me });
    expect(await screen.findByText('Profile not available')).toBeInTheDocument();
  });

  it('edits name, bio and interests and saves them', async () => {
    let body;
    server.use(
      http.get(`${API}/categories`, () => ok({ categories: CATEGORIES })),
      http.patch(`${API}/users/me`, async ({ request }) => {
        body = await request.json();
        return ok({ user: { ...me, ...body, learningInterests: CATEGORIES } });
      }),
      http.get(`${API}/users/me`, () => ok({ user: { ...me, ...body } })),
    );
    const { user, router } = renderApp('/profile/edit', { user: me });
    const name = await screen.findByLabelText(/full name/i);
    await user.clear(name);
    await user.type(name, 'Priya S.');
    const bio = screen.getByLabelText(/^bio/i);
    await user.clear(bio);
    await user.type(bio, 'I teach React to beginners.');
    await user.click(await screen.findByRole('button', { name: 'Web Development' }));
    expect(screen.getByRole('button', { name: 'Web Development' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/profile'));
    expect(body).toMatchObject({
      name: 'Priya S.',
      bio: 'I teach React to beginners.',
      learningInterests: [CATEGORIES[1].id, CATEGORIES[0].id],
    });
  });

  it('blocks saving when the name is too short (SB1/US41)', async () => {
    let called = false;
    server.use(
      http.get(`${API}/categories`, () => ok({ categories: CATEGORIES })),
      http.patch(`${API}/users/me`, () => ((called = true), ok({ user: me }))),
    );
    const { user } = renderApp('/profile/edit', { user: me });
    const name = await screen.findByLabelText(/full name/i);
    await user.clear(name);
    await user.type(name, 'P');
    await user.tab();
    expect(await screen.findByText('Name must be at least 2 characters', { selector: 'p' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save profile/i }));
    expect(called).toBe(false);
  });

  it('rejects a photo that is too large before uploading it (SB1/US17)', async () => {
    let uploaded = false;
    server.use(
      http.get(`${API}/categories`, () => ok({ categories: CATEGORIES })),
      http.put(`${API}/users/me/avatar`, () => ((uploaded = true), ok({ avatarUrl: '/uploads/x.png' }))),
    );
    const { user } = renderApp('/profile/edit', { user: me });
    const input = await screen.findByLabelText(/choose a profile photo/i);
    const big = new File([new Uint8Array(3 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    await user.upload(input, big);
    expect(await screen.findByText(/larger than 2 MB/i)).toBeInTheDocument();
    expect(uploaded).toBe(false);
  });

  it('uploads a valid photo and shows it', async () => {
    server.use(
      http.get(`${API}/categories`, () => ok({ categories: CATEGORIES })),
      http.put(`${API}/users/me/avatar`, () => ok({ avatarUrl: '/uploads/avatars/me.png' })),
    );
    const { user } = renderApp('/profile/edit', { user: me });
    const input = await screen.findByLabelText(/choose a profile photo/i);
    await user.upload(input, new File([new Uint8Array([137, 80, 78, 71])], 'me.png', { type: 'image/png' }));
    expect(await screen.findByText('Profile photo updated.')).toBeInTheDocument();
    expect(screen.getAllByAltText("Priya Sharma's profile photo")[0]).toHaveAttribute('src', '/uploads/avatars/me.png');
  });
});

describe('Account settings (SB1/US7, US32–34)', () => {
  it('changes the password and clears the form', async () => {
    let body;
    server.use(
      http.patch(`${API}/auth/password`, async ({ request }) => ((body = await request.json()), ok({ message: 'ok' }))),
    );
    const { user } = renderApp('/settings', { user: me });
    await user.type(await screen.findByLabelText(/^current password/i, { selector: 'input' }), 'Old!Passw0rd');
    await user.type(screen.getByLabelText(/^new password/i, { selector: 'input' }), 'N3w!Passw0rd');
    await user.type(screen.getByLabelText(/^confirm new password/i, { selector: 'input' }), 'N3w!Passw0rd');
    await user.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByText(/password changed/i)).toBeInTheDocument();
    expect(body).toEqual({
      currentPassword: 'Old!Passw0rd',
      newPassword: 'N3w!Passw0rd',
      confirmPassword: 'N3w!Passw0rd',
    });
    expect(screen.getByLabelText(/^current password/i, { selector: 'input' })).toHaveValue('');
  });

  it('shows "current password is incorrect" from the server on the right field', async () => {
    server.use(
      http.patch(`${API}/auth/password`, () =>
        fail(422, 'VALIDATION_ERROR', 'Fix', { fields: { currentPassword: 'Your current password is incorrect' } }),
      ),
    );
    const { user } = renderApp('/settings', { user: me });
    await user.type(await screen.findByLabelText(/^current password/i, { selector: 'input' }), 'Wrong!Pass1');
    await user.type(screen.getByLabelText(/^new password/i, { selector: 'input' }), 'N3w!Passw0rd');
    await user.type(screen.getByLabelText(/^confirm new password/i, { selector: 'input' }), 'N3w!Passw0rd');
    await user.click(screen.getByRole('button', { name: /update password/i }));
    expect(await screen.findByText('Your current password is incorrect', { selector: 'p' })).toBeInTheDocument();
  });

  it('only enables "Delete my account" after typing DELETE, then deletes and leaves (SB1/US33, US34)', async () => {
    let body;
    server.use(
      http.delete(
        `${API}/users/me`,
        async ({ request }) => ((body = await request.json()), new Response(null, { status: 204 })),
      ),
    );
    const { user, router } = renderApp('/settings', { user: me });
    await user.click(await screen.findByRole('button', { name: /^delete account$/i }));
    const dialog = await screen.findByRole('dialog', { name: /delete your account permanently/i });
    const confirm = within(dialog).getByRole('button', { name: /delete my account/i });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/your password/i, { selector: 'input' }), 'Str0ng!Pass');
    await user.type(within(dialog).getByLabelText(/type delete to confirm/i), 'delete');
    expect(confirm).toBeDisabled();
    await user.clear(within(dialog).getByLabelText(/type delete to confirm/i));
    await user.type(within(dialog).getByLabelText(/type delete to confirm/i), 'DELETE');
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(body).toEqual({ password: 'Str0ng!Pass', confirmText: 'DELETE' });
  });

  it('keeps the dialog open with an error when the password is wrong (SB1/US32)', async () => {
    server.use(
      http.post(`${API}/users/me/deactivate`, () =>
        fail(422, 'VALIDATION_ERROR', 'Fix', { fields: { password: 'Your password is incorrect' } }),
      ),
    );
    const { user } = renderApp('/settings', { user: me });
    await user.click(await screen.findByRole('button', { name: /^deactivate account$/i }));
    const dialog = await screen.findByRole('dialog', { name: /deactivate your account/i });
    await user.type(within(dialog).getByLabelText(/your password/i, { selector: 'input' }), 'wrong');
    await user.click(within(dialog).getByRole('button', { name: /^deactivate$/i }));
    expect(await within(dialog).findByText('Your password is incorrect')).toBeInTheDocument();
  });
});
