import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ToastProvider } from '../context/ToastContext.jsx';
import { routes } from '../routes/routes.jsx';
import { server, http, API, ok, fail } from './server.js';

export function makeUser(overrides = {}) {
  return {
    id: '507f1f77bcf86cd799439011',
    name: 'Priya Sharma',
    email: 'priya@skillbridge.test',
    role: 'user',
    status: 'active',
    headline: 'Frontend developer',
    bio: '',
    avatarUrl: null,
    timezone: 'Asia/Kolkata',
    learningInterests: [],
    teachSkills: [],
    learnSkills: [],
    availability: [],
    memberSince: '2026-09-01T00:00:00.000Z',
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

export const CATEGORIES = [
  { id: 'c00000000000000000000001', name: 'Web Development', slug: 'web-development', icon: 'code' },
  { id: 'c00000000000000000000002', name: 'Music', slug: 'music', icon: 'music' },
];

export const SKILL_REACT = {
  id: 'a00000000000000000000001',
  name: 'React',
  status: 'approved',
  category: CATEGORIES[0],
};
export const SKILL_GUITAR = {
  id: 'a00000000000000000000002',
  name: 'Guitar',
  status: 'approved',
  category: CATEGORIES[1],
};

/** Signs the test in as `user` (or as a guest when user is null). */
export function mockSession(user) {
  server.use(
    http.get(`${API}/auth/me`, () =>
      user ? ok({ user }) : fail(401, 'UNAUTHENTICATED', 'Please log in to continue.'),
    ),
    http.post(`${API}/auth/refresh`, () =>
      user ? ok({ user }) : fail(401, 'UNAUTHENTICATED', 'Please log in to continue.'),
    ),
  );
}

/** Renders the real route tree at `path`. Returns the router so tests can check the URL. */
export function renderApp(path = '/', { user = null } = {}) {
  mockSession(user);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const ui = render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  );
  return { ...ui, router, user: userEvent.setup() };
}

export const emptyDashboard = (user) => ({
  user: { id: user.id, name: user.name, avatarUrl: null, timezone: user.timezone },
  profileCompletion: {
    percent: 0,
    completed: 0,
    total: 2,
    items: [
      { id: 'photo', label: 'Add a profile photo', done: false, link: '/profile/edit' },
      { id: 'teach', label: 'Add a skill you can teach', done: false, link: '/skills?tab=teach' },
    ],
  },
  skills: { teach: [], learn: [] },
  upcomingSessions: [],
  recentActivity: [],
  counts: { teachSkills: 0, learnSkills: 0, upcomingSessions: 0, completedSessions: 0, availabilitySlots: 0 },
});
