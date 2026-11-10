/**
 * Sprint 2 component tests: mentor profile + request form, requests hub and detail,
 * suggested mentors, notifications, mentoring switch and admin catalogue
 * (SB2/US8–16, US17–31, US43, US45–47).
 */
import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp, makeUser, emptyDashboard, SKILL_REACT, SKILL_GUITAR, CATEGORIES } from '../test/utils.jsx';
import { server, http, API, ok, fail } from '../test/server.js';

const me = makeUser({ id: 'me1', name: 'Arjun Mehta', timezone: 'Asia/Kolkata' });
const P1 = '650000000000000000000001';
const priya = { id: P1, name: 'Priya Sharma', headline: 'React lead', avatarUrl: null, timezone: 'Asia/Kolkata' };
const FUTURE = '2026-12-01T12:30:00.000Z';

const mentorView = (over = {}) => ({
  profile: {
    ...priya,
    bio: 'Ten years of UI work.',
    learningInterests: [],
    teachSkills: [
      { id: 't1', skill: SKILL_REACT, proficiency: 'expert' },
      { id: 't2', skill: SKILL_GUITAR, proficiency: 'intermediate' },
    ],
    learnSkills: [],
    availability: [{ day: 0, start: '18:00', end: '21:00' }],
    memberSince: '2026-01-01T00:00:00.000Z',
    acceptingRequests: true,
  },
  isSelf: false,
  availability: {
    mentorTimezone: 'Asia/Kolkata',
    viewerTimezone: 'Europe/London',
    tzGapHours: 5.5,
    inMentorZone: [{ day: 0, start: '18:00', end: '21:00' }],
    inViewerZone: [{ day: 0, start: '12:30', end: '15:30' }],
    sharedInViewerZone: [{ day: 0, start: '13:00', end: '15:00' }],
    sharedMinutes: 120,
    nextSharedSlot: { startsAt: FUTURE, endsAt: FUTURE },
    nextMentorSlot: null,
  },
  exchange: {
    theyCanTeachYou: [{ skill: SKILL_GUITAR, proficiency: 'intermediate' }],
    youCanTeachThem: [{ skill: { id: 's9', name: 'Python' }, preferredLevel: 'beginner' }],
  },
  openRequests: [],
  ...over,
});

const request = (over = {}) => ({
  id: 'r1',
  mode: 'direct',
  status: 'pending',
  role: 'mentor',
  learner: { id: 'me1', name: 'Arjun Mehta', headline: '', avatarUrl: null, timezone: 'Asia/Kolkata' },
  mentor: priya,
  partner: { id: 'me1', name: 'Arjun Mehta', headline: '', avatarUrl: null, timezone: 'Asia/Kolkata' },
  skill: { id: SKILL_REACT.id, name: 'React', category: CATEGORIES[0] },
  learnerLevel: 'beginner',
  message: 'Please help with hooks',
  score: { skill: 35, level: 20, availability: 25, timezone: 10, exchange: 0, total: 90 },
  reasons: ['Teaches React at Expert level (above the beginner level you want)', '15 h of shared free time each week'],
  sharedMinutes: 900,
  proposedSlot: { startsAt: FUTURE, endsAt: FUTURE, shared: true },
  failure: null,
  declineReason: '',
  history: [
    { status: 'queued', by: 'learner', at: '2026-11-10T10:00:00.000Z', note: '' },
    { status: 'pending', by: 'system', at: '2026-11-10T10:00:01.000Z', note: '' },
  ],
  attempts: 1,
  expiresAt: '2026-11-17T10:00:00.000Z',
  session: null,
  createdAt: '2026-11-10T10:00:00.000Z',
  updatedAt: '2026-11-10T10:00:01.000Z',
  actions: { canAccept: true, canDecline: true, canCancel: false, canRetry: false },
  ...over,
});
const counts = { open: 1, pending: 1, accepted: 0, closed: 0, all: 1 };

describe('mentor profile and learning request (SB2/US8–12, US30, US31)', () => {
  it('shows exchange hints, availability in both zones, and sends a request', async () => {
    let sent;
    server.use(
      http.get(`${API}/mentors/${P1}`, () => ok(mentorView())),
      http.post(`${API}/match-requests`, async ({ request: req }) => {
        sent = await req.json();
        return ok({ request: request({ id: 'r9', status: 'queued', role: 'learner' }) });
      }),
      http.get(`${API}/match-requests/r9`, () =>
        ok({ request: request({ id: 'r9', status: 'queued', role: 'learner' }) }),
      ),
    );
    const { user, router } = renderApp(`/users/${P1}`, { user: me });
    expect(await screen.findByText('Priya can teach you')).toBeInTheDocument();
    expect(screen.getByText(/you can teach priya/i)).toBeInTheDocument();
    expect(screen.getByText('5 h 30 min apart')).toBeInTheDocument();
    expect(screen.getByText('2 h a week in common')).toBeInTheDocument();
    expect(screen.getByText(/times shown in europe\/london/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Priya’s time' }));
    expect(screen.getByText(/times shown in asia\/kolkata/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Request a session' }));
    const dialog = await screen.findByRole('dialog', { name: 'Request a session with Priya Sharma' });
    // The skill the learner wants (Guitar) is pre-selected.
    expect(within(dialog).getByLabelText(/skill/i)).toHaveValue(SKILL_GUITAR.id);
    expect(within(dialog).getByText(/suggested first session/i)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/message/i), 'Hi!');
    await user.click(within(dialog).getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/requests/r9'));
    expect(sent).toEqual({ mode: 'direct', mentorId: P1, skillId: SKILL_GUITAR.id, message: 'Hi!' });
    expect(await screen.findByText(/matching in progress/i)).toBeInTheDocument();
  });

  it('opens the existing request instead of sending a duplicate (SB2/US24)', async () => {
    server.use(
      http.get(`${API}/mentors/${P1}`, () => ok(mentorView())),
      http.post(`${API}/match-requests`, () =>
        fail(409, 'DUPLICATE_REQUEST', 'You already have an open request.', { details: { requestId: 'r1' } }),
      ),
      http.get(`${API}/match-requests/r1`, () => ok({ request: request({ role: 'learner' }) })),
    );
    const { user, router } = renderApp(`/users/${P1}`, { user: me });
    await user.click(await screen.findByRole('button', { name: 'Request a session' }));
    await user.click(screen.getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/requests/r1'));
    expect(await screen.findByText(/already have an open request/i)).toBeInTheDocument();
  });

  it('disables requests for mentors who are paused and shows open requests', async () => {
    server.use(
      http.get(`${API}/mentors/${P1}`, () =>
        ok(
          mentorView({
            profile: { ...mentorView().profile, acceptingRequests: false },
            openRequests: [{ id: 'r1', status: 'pending', skill: { id: 's1', name: 'React' } }],
          }),
        ),
      ),
    );
    renderApp(`/users/${P1}`, { user: me });
    expect(await screen.findByRole('button', { name: 'Request a session' })).toBeDisabled();
    expect(screen.getByText('Not taking requests right now')).toBeInTheDocument();
    expect(screen.getByText('React: Waiting for reply')).toBeInTheDocument();
  });
});

describe('requests hub (SB2/US13–16, US26–28, US45)', () => {
  it('lists received requests with counts and lets the mentor accept', async () => {
    let accepted = false;
    server.use(
      http.get(`${API}/match-requests`, ({ request: req }) => {
        const box = new URL(req.url).searchParams.get('box');
        const items = box === 'incoming' && !accepted ? [request()] : [];
        return ok({ requests: items }, { page: 1, limit: 10, total: items.length, totalPages: 1, counts });
      }),
      http.patch(`${API}/match-requests/r1/accept`, () => {
        accepted = true;
        return ok({ request: request({ status: 'accepted' }), session: { id: 's1', startsAt: FUTURE } });
      }),
    );
    const { user } = renderApp('/requests', { user: me });
    const row = (await screen.findByRole('link', { name: 'Arjun Mehta' })).closest('li');
    expect(within(row).getByText('Waiting for reply')).toBeInTheDocument();
    expect(within(row).getByText('“Please help with hooks”')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open\s*1/i })).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(row).getByRole('button', { name: 'Accept' }));
    expect(await screen.findByText(/accepted\. your session with arjun mehta is booked/i)).toBeInTheDocument();
    expect(await screen.findByText('No requests waiting for you')).toBeInTheDocument();
  });

  it('declines with a reason through a confirmation dialog', async () => {
    let body;
    server.use(
      http.get(`${API}/match-requests`, () =>
        ok({ requests: [request()] }, { page: 1, limit: 10, total: 1, totalPages: 1, counts }),
      ),
      http.patch(`${API}/match-requests/r1/decline`, async ({ request: req }) => {
        body = await req.json();
        return ok({ request: request({ status: 'declined' }) });
      }),
    );
    const { user } = renderApp('/requests', { user: me });
    await user.click(await screen.findByRole('button', { name: 'Decline' }));
    const dialog = screen.getByRole('dialog', { name: /decline arjun mehta's request/i });
    await user.type(within(dialog).getByLabelText(/reason/i), 'Busy this month');
    await user.click(within(dialog).getByRole('button', { name: 'Decline request' }));
    await waitFor(() => expect(body).toEqual({ reason: 'Busy this month' }));
  });

  it('shows sent requests with cancel and retry, and switches folders and status', async () => {
    const calls = [];
    const sent = [
      request({
        id: 'r2',
        role: 'learner',
        partner: priya,
        actions: { canAccept: false, canDecline: false, canCancel: true, canRetry: false },
      }),
      request({
        id: 'r3',
        role: 'learner',
        mode: 'auto',
        status: 'failed',
        partner: null,
        mentor: null,
        failure: {
          code: 'NO_COMMON_AVAILABILITY',
          reason: 'No suitable mentor shares any free time with you.',
          nextStep: 'Add more hours.',
        },
        actions: { canAccept: false, canDecline: false, canCancel: false, canRetry: true },
      }),
    ];
    let retried = false;
    server.use(
      http.get(`${API}/match-requests`, ({ request: req }) => {
        const params = Object.fromEntries(new URL(req.url).searchParams);
        calls.push(params);
        const items = params.box === 'outgoing' ? sent : [];
        return ok(
          { requests: items },
          { page: 1, limit: 10, total: items.length, totalPages: 1, counts: { ...counts, closed: 1 } },
        );
      }),
      http.post(`${API}/match-requests/r3/retry`, () => {
        retried = true;
        return ok({ request: { ...sent[1], status: 'queued' } });
      }),
    );
    const { user, router } = renderApp('/requests', { user: me });
    await user.click(await screen.findByRole('tab', { name: /sent/i }));
    await waitFor(() => expect(router.state.location.search).toBe('?box=outgoing&status=open'));
    expect(await screen.findByText('Finding a mentor…')).toBeInTheDocument();
    expect(screen.getByText('No suitable mentor shares any free time with you.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel request' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(retried).toBe(true));
    await user.click(screen.getByRole('button', { name: /closed/i }));
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ box: 'outgoing', status: 'closed' }));
  });

  it('shows the full request with score breakdown, reasons, times and history', async () => {
    server.use(
      http.get(`${API}/match-requests/r1`, () =>
        ok({
          request: request({
            status: 'accepted',
            role: 'learner',
            partner: priya,
            session: { id: 's1', startsAt: FUTURE, durationMinutes: 30, status: 'scheduled' },
            actions: { canAccept: false, canDecline: false, canCancel: false, canRetry: false },
            history: [
              ...request().history,
              { status: 'accepted', by: 'mentor', at: '2026-11-10T11:00:00.000Z', note: '' },
            ],
          }),
        }),
      ),
    );
    renderApp('/requests/r1', { user: me });
    expect(await screen.findByLabelText('Match score 90 out of 100')).toBeInTheDocument();
    expect(screen.getByText('20/20')).toBeInTheDocument();
    expect(screen.getByText('15 h of shared free time each week')).toBeInTheDocument();
    const history = screen.getByRole('list', { name: 'Status history' });
    expect(within(history).getAllByRole('listitem')).toHaveLength(3);
    expect(within(history).getByText(/by the mentor/)).toBeInTheDocument();
    expect(screen.getByText('Session')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Priya Sharma' })).toHaveAttribute('href', `/users/${P1}`);
  });

  it('explains when a request belongs to someone else', async () => {
    server.use(
      http.get(`${API}/match-requests/r5`, () => fail(403, 'FORBIDDEN', 'This request belongs to other members.')),
    );
    renderApp('/requests/r5', { user: me });
    expect(await screen.findByText('Request not available')).toBeInTheDocument();
  });
});

describe('suggested mentors (SB2/US17–22, US46)', () => {
  const suggestion = {
    mentor: priya,
    skill: { id: SKILL_REACT.id, name: 'React', category: CATEGORIES[0] },
    wantedLevel: 'beginner',
    mentorLevel: 'expert',
    score: { skill: 35, level: 20, availability: 25, timezone: 10, exchange: 10, total: 100 },
    reasons: ['Wants to learn Python, which you teach – you could swap skills'],
    sharedMinutes: 900,
    tzGapHours: 0,
    proposedSlot: { startsAt: FUTURE, endsAt: FUTURE, shared: true },
    existingRequest: null,
  };

  it('ranks mentors with reasons, filters by skill and starts automatic matching', async () => {
    const calls = [];
    let auto;
    server.use(
      http.get(`${API}/matches/suggestions`, ({ request: req }) => {
        calls.push(Object.fromEntries(new URL(req.url).searchParams));
        return ok({
          learnSkills: [
            { id: SKILL_REACT.id, name: 'React', preferredLevel: 'beginner' },
            { id: SKILL_GUITAR.id, name: 'Guitar', preferredLevel: 'beginner' },
          ],
          hasAvailability: true,
          matches: [
            suggestion,
            {
              ...suggestion,
              mentor: { ...priya, id: 'p2', name: 'Zara Khan' },
              existingRequest: { id: 'r7', status: 'pending' },
            },
          ],
          reason: null,
        });
      }),
      http.post(`${API}/match-requests`, async ({ request: req }) => {
        auto = await req.json();
        return ok({ request: request({ id: 'r8', role: 'learner', status: 'queued' }) });
      }),
      http.get(`${API}/match-requests/r8`, () =>
        ok({ request: request({ id: 'r8', role: 'learner', status: 'queued' }) }),
      ),
    );
    const { user, router } = renderApp('/matches', { user: me });
    const list = await screen.findByRole('list', { name: 'Suggested mentors, best first' });
    expect(within(list).getAllByRole('listitem', { name: undefined }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Wants to learn Python, which you teach – you could swap skills')).toHaveLength(2);
    expect(screen.getByText(/simplified matching/i)).toBeInTheDocument();
    expect(screen.getByText('Already requested · pending')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request Priya' })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Skill to learn'), SKILL_GUITAR.id);
    await waitFor(() => expect(calls.at(-1)).toEqual({ skillId: SKILL_GUITAR.id }));
    await user.click(screen.getByRole('button', { name: 'Match me automatically' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/requests/r8'));
    expect(auto).toEqual({ mode: 'auto', skillId: SKILL_GUITAR.id });
  });

  it('shows the reason and next step when there are no suggestions', async () => {
    server.use(
      http.get(`${API}/matches/suggestions`, () =>
        ok({
          learnSkills: [],
          hasAvailability: false,
          matches: [],
          reason: {
            code: 'NO_LEARN_SKILLS',
            reason: 'You have not added any skills you want to learn.',
            nextStep: 'Add a learning skill on the Skills page to get suggestions.',
          },
        }),
      ),
    );
    renderApp('/matches', { user: me });
    expect(await screen.findByText('You have not added any skills you want to learn.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a learning skill' })).toHaveAttribute('href', '/skills?tab=learn');
  });
});

describe('notifications (SB2/US29)', () => {
  const note = (over = {}) => ({
    id: 'n1',
    type: 'request_received',
    title: 'Arjun wants to learn React with you',
    body: 'Open the request to accept or decline it.',
    link: '/requests/r1',
    read: false,
    createdAt: new Date().toISOString(),
    ...over,
  });

  it('the bell shows the unread count, lists recent items and marks all as read', async () => {
    let unread = 2;
    let markedAll = false;
    server.use(
      http.get(`${API}/dashboard`, () => ok(emptyDashboard(me))),
      http.get(`${API}/notifications/unread-count`, () => ok({ unreadCount: unread })),
      http.get(`${API}/notifications`, () =>
        ok(
          { notifications: [note(), note({ id: 'n2', type: 'request_accepted', title: 'Priya accepted' })] },
          { page: 1, limit: 6, total: 2, totalPages: 1, unreadCount: unread },
        ),
      ),
      http.post(`${API}/notifications/read-all`, () => {
        markedAll = true;
        unread = 0;
        return ok({ updated: 2 });
      }),
    );
    const { user } = renderApp('/dashboard', { user: me });
    const bell = await screen.findByRole('button', { name: 'Notifications, 2 unread' });
    await user.click(bell);
    const panel = await screen.findByRole('dialog', { name: 'Recent notifications' });
    expect(await within(panel).findByText('Priya accepted')).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: /mark all as read/i }));
    await waitFor(() => expect(markedAll).toBe(true));
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('opening a notification marks it read and follows its link', async () => {
    let read = false;
    server.use(
      http.get(`${API}/notifications`, () =>
        ok({ notifications: [note()] }, { page: 1, limit: 15, total: 1, totalPages: 1, unreadCount: 1 }),
      ),
      http.patch(`${API}/notifications/n1/read`, () => {
        read = true;
        return ok({ notification: note({ read: true }) });
      }),
      http.get(`${API}/match-requests/r1`, () => ok({ request: request() })),
    );
    const { user, router } = renderApp('/notifications', { user: me });
    await user.click((await screen.findByText('Arjun wants to learn React with you')).closest('button'));
    await waitFor(() => expect(router.state.location.pathname).toBe('/requests/r1'));
    expect(read).toBe(true);
  });

  it('filters unread and shows an empty state', async () => {
    server.use(
      http.get(`${API}/notifications`, ({ request: req }) =>
        new URL(req.url).searchParams.get('unread')
          ? ok({ notifications: [] }, { page: 1, limit: 15, total: 0, totalPages: 1, unreadCount: 0 })
          : ok(
              { notifications: [note({ read: true })] },
              { page: 1, limit: 15, total: 1, totalPages: 1, unreadCount: 0 },
            ),
      ),
    );
    const { user } = renderApp('/notifications', { user: me });
    expect(await screen.findByText('Arjun wants to learn React with you')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /unread/i }));
    expect(await screen.findByText('No unread notifications')).toBeInTheDocument();
  });
});

describe('mentoring switch (SB2/US43)', () => {
  it('pauses new requests from Settings', async () => {
    let body;
    server.use(
      http.patch(`${API}/users/me/accepting-requests`, async ({ request: req }) => {
        body = await req.json();
        return ok({ acceptingRequests: false });
      }),
    );
    const { user } = renderApp('/settings', { user: { ...me, acceptingRequests: true } });
    const toggle = await screen.findByRole('switch', { name: 'Accept new learning requests' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await user.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
    expect(body).toEqual({ acceptingRequests: false });
    expect(await screen.findByText(/new requests are paused/i)).toBeInTheDocument();
  });
});

describe('admin catalogue (SB2/US47)', () => {
  const admin = makeUser({ role: 'admin', name: 'Asha Admin' });
  const pendingSkill = {
    id: 'k1',
    name: 'Svelte Kit',
    status: 'pending',
    aliases: [],
    category: CATEGORIES[0],
    createdBy: { id: 'u5', name: 'Arjun' },
    teachers: 1,
    learners: 0,
    createdAt: new Date().toISOString(),
  };
  const adminCategories = CATEGORIES.map((c, i) => ({
    ...c,
    isActive: true,
    order: i,
    skillCount: 3 - i,
    pendingCount: 1 - i,
    mentorCount: 2,
    description: '',
  }));

  it('approves a pending skill and edits a category', async () => {
    let approved;
    let created;
    server.use(
      http.get(`${API}/admin/categories`, () => ok({ categories: adminCategories })),
      http.get(`${API}/admin/skills`, () =>
        ok({ skills: approved ? [] : [pendingSkill] }, { page: 1, limit: 20, total: approved ? 0 : 1, totalPages: 1 }),
      ),
      http.patch(`${API}/admin/skills/k1`, async ({ request: req }) => {
        approved = await req.json();
        return ok({ skill: { ...pendingSkill, status: 'approved' } });
      }),
      http.post(`${API}/admin/categories`, async ({ request: req }) => {
        created = await req.json();
        return ok({ category: { ...adminCategories[0], id: 'c9', name: created.name } });
      }),
    );
    const { user } = renderApp('/admin/catalog', { user: admin });
    expect(await screen.findByText('Svelte Kit')).toBeInTheDocument();
    expect(screen.getByText('1 teach · 0 learn')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(approved).toEqual({ status: 'approved' }));
    expect(await screen.findByText('No skills waiting for review')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /categories/i }));
    expect(await screen.findByText('Web Development')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New category' }));
    const dialog = screen.getByRole('dialog', { name: 'New category' });
    await user.type(within(dialog).getByLabelText(/name/i), 'Cooking');
    await user.click(within(dialog).getByRole('button', { name: 'Create category' }));
    await waitFor(() => expect(created).toMatchObject({ name: 'Cooking', icon: 'tag' }));
  });

  it('is hidden from members', async () => {
    renderApp('/admin/catalog', { user: me });
    expect(await screen.findByText(/administrators only/i)).toBeInTheDocument();
  });
});
