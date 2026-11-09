import { describe, it, expect } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { renderApp, makeUser, CATEGORIES, SKILL_REACT, SKILL_GUITAR } from '../test/utils.jsx';
import { server, http, API, ok, fail } from '../test/server.js';
import { cellsToSlots, slotsToCells } from '../features/availability/AvailabilityGrid.jsx';

const me = makeUser();

function skillHandlers(state) {
  return [
    http.get(`${API}/users/me/skills`, () => ok(state)),
    http.get(`${API}/categories`, () => ok({ categories: CATEGORIES })),
    http.get(`${API}/skills`, ({ request }) => {
      const q = (new URL(request.url).searchParams.get('q') ?? '').toLowerCase();
      return ok({ skills: [SKILL_REACT, SKILL_GUITAR].filter((s) => s.name.toLowerCase().includes(q)) });
    }),
  ];
}

describe('Skills page (SB1/US20–26)', () => {
  it('adds a teaching skill chosen from the catalogue with a proficiency level', async () => {
    let body;
    server.use(
      ...skillHandlers({ teachSkills: [], learnSkills: [] }),
      http.post(`${API}/users/me/teach-skills`, async ({ request }) => {
        body = await request.json();
        return ok({
          entry: { id: 'e1', skill: SKILL_GUITAR, proficiency: body.proficiency, yearsExperience: 4, description: '' },
        });
      }),
    );
    const { user } = renderApp('/skills', { user: me });
    expect(await screen.findByText(/haven’t added any teaching skills/i)).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /add teaching skill/i })[0]);
    const dialog = await screen.findByRole('dialog', { name: /add a skill you can teach/i });
    await user.type(within(dialog).getByRole('combobox'), 'gui');
    await user.click(await within(dialog).findByRole('option', { name: /guitar/i }));
    await user.click(within(dialog).getByRole('radio', { name: /advanced/i }));
    await user.type(within(dialog).getByLabelText(/years of experience/i), '4');
    await user.click(within(dialog).getByRole('button', { name: 'Add skill' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(body).toEqual({ skillId: SKILL_GUITAR.id, proficiency: 'advanced', yearsExperience: 4, description: '' });
    expect(screen.getByRole('heading', { name: 'Guitar' })).toBeInTheDocument();
  });

  it('requires a skill and a level before saving', async () => {
    server.use(...skillHandlers({ teachSkills: [], learnSkills: [] }));
    const { user } = renderApp('/skills', { user: me });
    await user.click((await screen.findAllByRole('button', { name: /add teaching skill/i }))[0]);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Add skill' }));
    expect(await within(dialog).findByText('Choose a skill', { selector: 'p' })).toBeInTheDocument();
    expect(within(dialog).getByText('Choose a proficiency level', { selector: 'p' })).toBeInTheDocument();
  });

  it('offers to add a new skill that is not in the catalogue, asking for a category', async () => {
    let body;
    server.use(
      ...skillHandlers({ teachSkills: [], learnSkills: [] }),
      http.post(`${API}/users/me/learn-skills`, async ({ request }) => {
        body = await request.json();
        return ok({
          entry: {
            id: 'e2',
            skill: { id: 'x', name: 'Origami', status: 'pending', category: CATEGORIES[1] },
            preferredLevel: 'beginner',
            goal: '',
          },
        });
      }),
    );
    const { user } = renderApp('/skills?tab=learn', { user: me });
    await user.click((await screen.findAllByRole('button', { name: /add learning skill/i }))[0]);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('combobox'), 'Origami');
    await user.click(await within(dialog).findByRole('option', { name: /add “origami” as a new skill/i }));
    await user.selectOptions(within(dialog).getByLabelText(/category for the new skill/i), CATEGORIES[1].id);
    await user.click(within(dialog).getByRole('radio', { name: /beginner/i }));
    await user.click(within(dialog).getByRole('button', { name: 'Add skill' }));

    await waitFor(() =>
      expect(body).toMatchObject({ customName: 'Origami', categoryId: CATEGORIES[1].id, preferredLevel: 'beginner' }),
    );
    expect(await screen.findByText(/awaiting admin review/i)).toBeInTheDocument();
  });

  it('removes a skill only after confirmation (SB1/US23)', async () => {
    let deleted = false;
    server.use(
      ...skillHandlers({
        teachSkills: [{ id: 'e1', skill: SKILL_REACT, proficiency: 'expert', description: '' }],
        learnSkills: [],
      }),
      http.delete(`${API}/users/me/teach-skills/e1`, () => ((deleted = true), new Response(null, { status: 204 }))),
    );
    const { user } = renderApp('/skills', { user: me });
    await user.click(await screen.findByRole('button', { name: 'Remove React' }));
    const dialog = await screen.findByRole('dialog', { name: /remove react/i });
    expect(deleted).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: /remove skill/i }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'React' })).not.toBeInTheDocument());
    expect(deleted).toBe(true);
  });

  it('shows a duplicate-skill error from the server inside the dialog', async () => {
    server.use(
      ...skillHandlers({ teachSkills: [], learnSkills: [] }),
      http.post(`${API}/users/me/teach-skills`, () =>
        fail(409, 'SKILL_ALREADY_ADDED', 'React is already in your list.', {
          fields: { skillId: 'React is already in your list' },
        }),
      ),
    );
    const { user } = renderApp('/skills', { user: me });
    await user.click((await screen.findAllByRole('button', { name: /add teaching skill/i }))[0]);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('combobox'), 'rea');
    await user.click(await within(dialog).findByRole('option', { name: /react/i }));
    await user.click(within(dialog).getByRole('radio', { name: /expert/i }));
    await user.click(within(dialog).getByRole('button', { name: 'Add skill' }));
    // Shown next to the chosen skill and listed in the error summary.
    expect(await within(dialog).findByText('React is already in your list', { selector: 'p' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: /skill: react is already in your list/i })).toBeInTheDocument();
  });
});

describe('Availability (SB1/US27–29)', () => {
  it('converts between grid cells and merged time ranges', () => {
    const slots = [
      { day: 0, start: '09:00', end: '10:30' },
      { day: 6, start: '23:00', end: '24:00' },
    ];
    expect(cellsToSlots(slotsToCells(slots))).toEqual(slots);
    const cells = new Set(['2:20', '2:21', '2:23']);
    expect(cellsToSlots(cells)).toEqual([
      { day: 2, start: '10:00', end: '11:00' },
      { day: 2, start: '11:30', end: '12:00' },
    ]);
  });

  it('marks half hours with the keyboard and saves the schedule with the time zone', async () => {
    let saved;
    server.use(
      http.get(`${API}/users/me/availability`, () => ok({ timezone: 'Asia/Kolkata', slots: [] })),
      http.put(`${API}/users/me/availability`, async ({ request }) => {
        saved = await request.json();
        return ok(saved);
      }),
    );
    const { user } = renderApp('/availability', { user: me });
    const cell = await screen.findByRole('gridcell', { name: /monday 09:00 to 09:30, not available/i });
    cell.focus();
    await user.keyboard(' ');
    await user.keyboard('{ArrowDown} ');
    expect(screen.getByRole('gridcell', { name: /monday 09:30 to 10:00, available/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('09:00–10:00')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() =>
      expect(saved).toEqual({ timezone: 'Asia/Kolkata', slots: [{ day: 0, start: '09:00', end: '10:00' }] }),
    );
    expect(await screen.findByText('Your availability has been saved.')).toBeInTheDocument();
  });

  it('paints a range by dragging across cells', async () => {
    server.use(http.get(`${API}/users/me/availability`, () => ok({ timezone: 'Asia/Kolkata', slots: [] })));
    renderApp('/availability', { user: me });
    const start = await screen.findByRole('gridcell', { name: /tuesday 18:00 to 18:30/i });
    fireEvent.pointerDown(start);
    fireEvent.pointerEnter(screen.getByRole('gridcell', { name: /tuesday 18:30 to 19:00/i }));
    fireEvent.pointerEnter(screen.getByRole('gridcell', { name: /tuesday 19:00 to 19:30/i }));
    fireEvent.pointerUp(window);
    expect(screen.getByText('18:00–19:30')).toBeInTheDocument();
  });

  it('adds a preset and can clear everything', async () => {
    server.use(http.get(`${API}/users/me/availability`, () => ok({ timezone: 'Asia/Kolkata', slots: [] })));
    const { user } = renderApp('/availability', { user: me });
    await user.click(await screen.findByRole('button', { name: /weekend mornings/i }));
    expect(screen.getByText('2 time ranges')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /clear all/i }));
    expect(screen.getByText(/no times selected yet/i)).toBeInTheDocument();
  });
});
