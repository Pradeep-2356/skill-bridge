/**
 * Sprint 2 – Discover page: suggestions, filters, sorting, counts, empty and error states
 * (SB2/US1–7, US35, US37, US39, US40).
 */
import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { renderApp, makeUser, CATEGORIES } from '../test/utils.jsx';
import { server, http, API, ok, fail } from '../test/server.js';

const me = makeUser();
const mentor = (over = {}) => ({
  id: 'u9',
  name: 'Ethan Brooks',
  headline: 'Full-stack developer',
  avatarUrl: null,
  timezone: 'America/New_York',
  tzGapHours: 10.5,
  matchedSkills: [{ id: 'k1', name: 'React', proficiency: 'advanced' }],
  otherSkills: [],
  teachSkillsCount: 1,
  availabilitySlots: 2,
  sharedMinutes: 90,
  acceptingRequests: true,
  ...over,
});

/** Records every search request so tests can check the query string. */
function searchSpy(respond = () => ok({ mentors: [mentor()] }, { page: 1, limit: 12, total: 1, totalPages: 1 })) {
  const calls = [];
  server.use(
    http.get(`${API}/categories`, () => ok({ categories: CATEGORIES })),
    http.get(`${API}/search/mentors`, ({ request }) => {
      const params = Object.fromEntries(new URL(request.url).searchParams);
      calls.push(params);
      return respond(params);
    }),
  );
  return calls;
}

describe('Discover page', () => {
  it('lists mentors with shared time, time-zone gap and a count before any search', async () => {
    searchSpy();
    renderApp('/discover', { user: me });
    const card = (await screen.findByRole('link', { name: 'Ethan Brooks' })).closest('li');
    expect(within(card).getByText(/10 h 30 min apart/)).toBeInTheDocument();
    expect(within(card).getByText(/1 h 30 min a week free at the same time as you/)).toBeInTheDocument();
    expect(screen.getByTestId('result-count')).toHaveTextContent('1 mentor');
  });

  it('shows skill suggestions while typing and searches the picked one with the keyboard', async () => {
    const calls = searchSpy();
    server.use(
      http.get(`${API}/skills/suggest`, ({ request }) => {
        const q = new URL(request.url).searchParams.get('q');
        return ok({
          skills: q.startsWith('rea')
            ? [
                { id: 's1', name: 'React', category: CATEGORIES[0], mentorCount: 4 },
                { id: 's2', name: 'React Native', category: CATEGORIES[0], mentorCount: 1 },
              ]
            : [],
        });
      }),
    );
    const { user, router } = renderApp('/discover', { user: me });
    const box = await screen.findByRole('combobox', { name: /skill to search for/i });
    await user.type(box, 'rea');
    const list = await screen.findByRole('listbox', { name: 'Skill suggestions' });
    expect(within(list).getByText('React Native')).toBeInTheDocument();
    expect(within(list).getByText(/web development · 4 mentors/i)).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await waitFor(() => expect(router.state.location.search).toBe('?q=React+Native'));
    await waitFor(() => expect(calls.at(-1).q).toBe('React Native'));
  });

  it('applies filters to the request and the URL, shows chips, and clears them all', async () => {
    const calls = searchSpy();
    const { user, router } = renderApp('/discover?q=react', { user: me });
    await screen.findByRole('link', { name: 'Ethan Brooks' });

    await user.selectOptions(screen.getByLabelText('Category'), CATEGORIES[0].id);
    await user.selectOptions(screen.getByLabelText('Mentor level'), 'advanced');
    await user.click(screen.getByRole('button', { name: 'Monday' }));
    await user.click(screen.getByRole('button', { name: 'Wednesday' }));
    await user.selectOptions(screen.getByLabelText('From'), '18:00');
    await user.selectOptions(screen.getByLabelText('To'), '21:00');
    await user.click(screen.getByLabelText(/within 3 hours of my time zone/i));

    await waitFor(() =>
      expect(calls.at(-1)).toMatchObject({
        q: 'react',
        category: CATEGORIES[0].id,
        proficiency: 'advanced',
        days: '0,2',
        from: '18:00',
        to: '21:00',
        tzCompatible: 'true',
        page: '1',
      }),
    );
    expect(screen.getByRole('button', { name: 'Monday' })).toHaveAttribute('aria-pressed', 'true');
    const chips = screen.getByLabelText('Applied filters');
    expect(within(chips).getByText('Web Development')).toBeInTheDocument();
    expect(within(chips).getByText('Advanced+')).toBeInTheDocument();
    expect(within(chips).getByText('Mon, Wed')).toBeInTheDocument();
    expect(within(chips).getByText('18:00–21:00')).toBeInTheDocument();

    await user.click(within(chips).getByRole('button', { name: 'Remove filter Advanced+' }));
    await waitFor(() => expect(calls.at(-1).proficiency).toBeUndefined());

    await user.click(within(chips).getByRole('button', { name: 'Clear all' }));
    await waitFor(() => expect(router.state.location.search).toBe('?q=react'));
    expect(screen.queryByLabelText('Applied filters')).not.toBeInTheDocument();
  });

  it('changes the sort order and pages through results', async () => {
    const calls = searchSpy(({ page }) =>
      ok(
        { mentors: [mentor({ id: `u${page}`, name: `Mentor ${page}` })] },
        { page: Number(page), limit: 12, total: 13, totalPages: 2 },
      ),
    );
    const { user } = renderApp('/discover', { user: me });
    await screen.findByRole('link', { name: 'Mentor 1' });
    await user.selectOptions(screen.getByLabelText('Sort results'), 'availability');
    await waitFor(() => expect(calls.at(-1).sort).toBe('availability'));
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(await screen.findByRole('link', { name: 'Mentor 2' })).toBeInTheDocument();
    expect(calls.at(-1)).toMatchObject({ sort: 'availability', page: '2' });
    expect(screen.getByTestId('result-count')).toHaveTextContent('13 mentors');
  });

  it('explains an empty filtered result and offers to clear filters (SB2/US35, US40)', async () => {
    searchSpy(({ proficiency }) =>
      proficiency
        ? ok({ mentors: [] }, { page: 1, limit: 12, total: 0, totalPages: 1, relatedSkills: [] })
        : ok({ mentors: [mentor()] }, { page: 1, limit: 12, total: 1, totalPages: 1 }),
    );
    const { user } = renderApp('/discover?q=react&proficiency=expert', { user: me });
    expect(await screen.findByText('No mentors match these filters')).toBeInTheDocument();
    // The filter panel and the empty state both offer it; use the one in the empty state.
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' }).at(-1));
    expect(await screen.findByRole('link', { name: 'Ethan Brooks' })).toBeInTheDocument();
  });

  it('suggests related skills when a search finds nothing', async () => {
    const calls = searchSpy(({ q }) =>
      q === 'Guitar'
        ? ok({ mentors: [mentor({ name: 'Zara' })] }, { page: 1, limit: 12, total: 1, totalPages: 1 })
        : ok(
            { mentors: [] },
            {
              page: 1,
              limit: 12,
              total: 0,
              totalPages: 1,
              relatedSkills: [{ id: 's9', name: 'Guitar', mentorCount: 2 }],
            },
          ),
    );
    const { user } = renderApp('/discover?q=ukulele', { user: me });
    expect(await screen.findByText('No mentors found for “ukulele”')).toBeInTheDocument();
    await user.click(within(screen.getByLabelText('Related skills')).getByRole('button', { name: 'Guitar' }));
    expect(await screen.findByRole('link', { name: 'Zara' })).toBeInTheDocument();
    expect(calls.at(-1).q).toBe('Guitar');
  });

  it('marks mentors who are not taking requests', async () => {
    searchSpy(() =>
      ok({ mentors: [mentor({ acceptingRequests: false })] }, { page: 1, limit: 12, total: 1, totalPages: 1 }),
    );
    renderApp('/discover', { user: me });
    expect(await screen.findByText('Not taking requests right now')).toBeInTheDocument();
  });

  it('shows an error with a working retry', async () => {
    let attempts = 0;
    searchSpy(() => {
      attempts += 1;
      return attempts === 1
        ? fail(500, 'INTERNAL_ERROR', 'Something went wrong on our side.')
        : ok({ mentors: [mentor()] }, { page: 1, limit: 12, total: 1, totalPages: 1 });
    });
    const { user } = renderApp('/discover', { user: me });
    expect(await screen.findByText('Something went wrong on our side.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('link', { name: 'Ethan Brooks' })).toBeInTheDocument();
  });
});
