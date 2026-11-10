import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp, makeUser, emptyDashboard } from '../test/utils.jsx';
import { server, http, API, ok, fail } from '../test/server.js';

const me = makeUser();
const upcoming = {
  id: 's1',
  startsAt: '2030-01-10T13:00:00.000Z',
  endsAt: '2030-01-10T13:30:00.000Z',
  durationMinutes: 30,
  status: 'scheduled',
  source: 'demo',
  role: 'mentor',
  partner: { id: 'u2', name: 'Arjun Mehta', headline: '', avatarUrl: null },
  skill: { id: 'k1', name: 'React' },
};

describe('Dashboard (SB1/US35–39)', () => {
  it('shows a loading state, then the user’s skills, sessions and profile progress', async () => {
    let release;
    const data = {
      ...emptyDashboard(me),
      profileCompletion: { ...emptyDashboard(me).profileCompletion, percent: 50 },
      skills: {
        teach: [{ id: 't1', skill: { id: 'k1', name: 'React' }, proficiency: 'expert' }],
        learn: [{ id: 'l1', skill: { id: 'k2', name: 'Python' }, preferredLevel: 'beginner' }],
      },
      upcomingSessions: [upcoming],
      counts: { teachSkills: 1, learnSkills: 1, upcomingSessions: 1, completedSessions: 0, availabilitySlots: 2 },
    };
    server.use(http.get(`${API}/dashboard`, () => new Promise((r) => (release = () => r(ok(data))))));
    renderApp('/dashboard', { user: me });

    expect(await screen.findByLabelText(/loading your dashboard/i)).toBeInTheDocument();
    await waitFor(() => expect(release).toBeTypeOf('function')); // request has reached the mock API
    release();
    expect(await screen.findByRole('img', { name: /profile 50% complete/i })).toBeInTheDocument();
    const sessions = screen.getByRole('heading', { name: 'Upcoming sessions' }).closest('section');
    expect(within(sessions).getByText('React')).toBeInTheDocument();
    expect(within(sessions).getByRole('link', { name: 'Arjun Mehta' })).toHaveAttribute('href', '/users/u2');
    expect(within(sessions).getByText('Demo')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
  });

  it('shows empty states with a next step for a brand-new user', async () => {
    server.use(http.get(`${API}/dashboard`, () => ok(emptyDashboard(me))));
    renderApp('/dashboard', { user: me });
    expect(await screen.findByText('No sessions scheduled')).toBeInTheDocument();
    // Both the checklist item and the "My skills" card point to the teach tab.
    const links = screen.getAllByRole('link', { name: /add a skill you can teach/i });
    expect(links).toHaveLength(2);
    links.forEach((link) => expect(link).toHaveAttribute('href', '/skills?tab=teach'));
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
  });

  it('shows an error with a working retry button (SB1/US42)', async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/dashboard`, () => {
        calls += 1;
        return calls === 1 ? fail(500, 'INTERNAL_ERROR', 'Something went wrong on our side.') : ok(emptyDashboard(me));
      }),
    );
    const { user } = renderApp('/dashboard', { user: me });
    expect(await screen.findByText('Something went wrong on our side.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByText('No sessions scheduled')).toBeInTheDocument();
  });
});

describe('Sessions page (SB1/US37, US38)', () => {
  it('switches between upcoming and past sessions', async () => {
    const scopes = [];
    server.use(
      http.get(`${API}/sessions`, ({ request }) => {
        const scope = new URL(request.url).searchParams.get('scope');
        scopes.push(scope);
        const sessions = scope === 'past' ? [] : [upcoming];
        return ok({ sessions }, { page: 1, limit: 10, total: sessions.length, totalPages: 1 });
      }),
    );
    const { user } = renderApp('/sessions', { user: me });
    expect(await screen.findByText('React')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /past/i }));
    expect(await screen.findByText('No past sessions yet')).toBeInTheDocument();
    expect(scopes).toEqual(['upcoming', 'past']);
  });
});

describe('Search page (SB1/US50)', () => {
  const mentor = {
    id: 'u9',
    name: 'Ethan Brooks',
    headline: 'Full-stack developer',
    avatarUrl: null,
    timezone: 'America/New_York',
    matchedSkills: [{ id: 'k1', name: 'React', proficiency: 'advanced' }],
    otherSkills: ['Node.js'],
    teachSkillsCount: 2,
    availabilitySlots: 3,
  };

  it('forwards the old /search address to Discover and lists mentors (SB2 mentor listing)', async () => {
    server.use(
      http.get(`${API}/search/mentors`, () =>
        ok({ mentors: [mentor] }, { page: 1, limit: 12, total: 1, totalPages: 1 }),
      ),
    );
    const { router } = renderApp('/search?q=react', { user: me });
    await waitFor(() => expect(router.state.location.pathname).toBe('/discover'));
    expect(router.state.location.search).toBe('?q=react');
    expect(await screen.findByRole('link', { name: 'Ethan Brooks' })).toBeInTheDocument();
  });

  it('searches, puts the query in the URL and shows mentor cards with a count', async () => {
    let query;
    server.use(
      http.get(`${API}/search/mentors`, ({ request }) => {
        query = new URL(request.url).searchParams.get('q');
        return ok({ mentors: [mentor] }, { page: 1, limit: 12, total: 1, totalPages: 1, query });
      }),
    );
    const { user, router } = renderApp('/discover', { user: me });
    await user.type(await screen.findByLabelText(/skill to search for/i), 'React');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByRole('link', { name: 'Ethan Brooks' })).toHaveAttribute('href', '/users/u9');
    expect(screen.getByTestId('result-count')).toHaveTextContent('1 mentor for “React”');
    expect(router.state.location.search).toBe('?q=React');
    expect(query).toBe('React');
    expect(screen.getByText(/also teaches node\.js/i)).toBeInTheDocument();
  });

  it('explains when nothing matches', async () => {
    server.use(
      http.get(`${API}/search/mentors`, () => ok({ mentors: [] }, { page: 1, limit: 12, total: 0, totalPages: 1 })),
    );
    renderApp('/discover?q=underwater%20basket', { user: me });
    expect(await screen.findByText('No mentors found for “underwater basket”')).toBeInTheDocument();
  });

  it('the top-bar search box opens the Discover page (SB1/US39)', async () => {
    server.use(
      http.get(`${API}/dashboard`, () => ok(emptyDashboard(me))),
      http.get(`${API}/search/mentors`, () =>
        ok({ mentors: [mentor] }, { page: 1, limit: 12, total: 1, totalPages: 1 }),
      ),
    );
    const { user, router } = renderApp('/dashboard', { user: me });
    const box = await screen.findByLabelText('Search skills or mentors');
    await user.type(box, 'react{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/discover'));
    expect(await screen.findByRole('link', { name: 'Ethan Brooks' })).toBeInTheDocument();
  });
});
