/**
 * Sprint 2 user journeys (SB2): learner, mentor and matchmaking, plus the
 * application-wide dark theme. Runs against the real client, API, local queue
 * worker and the seeded skillbridge_e2e database.
 */
import { test, expect } from '@playwright/test';
import { login, logout, nav, uniqueEmail } from './helpers.js';

test.describe.configure({ mode: 'serial' });

/** Waits until the background worker has processed a queued request. */
async function waitForStatus(page, label) {
  await expect(async () => {
    const refresh = page.getByRole('button', { name: 'Refresh' });
    if (await refresh.isVisible()) await refresh.click();
    await expect(page.getByText(label).first()).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}

test('Journey 1 – a learner discovers a mentor with filters and sends a request (SB2/US1–12, US24–26, US39)', async ({
  page,
}) => {
  await login(page, 'arjun@skillbridge.test');
  await nav(page, 'Find mentors').click();
  await expect(page).toHaveURL(/\/discover$/);

  // Partial search with suggestions (SB2/US1, US2)
  const box = page.getByRole('combobox', { name: /skill to search for/i });
  await box.fill('rea');
  await page.getByRole('option', { name: /^React\b.*mentors?/ }).click();
  await expect(page).toHaveURL(/q=React/);
  await expect(page.getByRole('link', { name: 'Priya Sharma', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ethan Brooks', exact: true })).toBeVisible();

  // Filters (SB2/US5, US7, US39, US40)
  await page.getByLabel('Mentor level').selectOption('advanced');
  await page.getByLabel(/within 3 hours of my time zone/i).check();
  await expect(page.getByTestId('result-count')).toContainText('1 mentor');
  await expect(page.getByRole('link', { name: 'Ethan Brooks', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Applied filters')).toContainText('Advanced+');

  // Mentor profile (SB2/US8–11)
  await page.getByRole('link', { name: "View Priya Sharma's profile" }).click();
  await expect(page.getByRole('heading', { name: 'Priya Sharma', level: 2 })).toBeVisible();
  await expect(page.getByText('Priya can teach you')).toBeVisible();
  await expect(page.getByText(/you can teach priya/i)).toBeVisible();

  // Send a learning request (SB2/US12)
  await page.getByRole('button', { name: 'Request a session' }).click();
  const dialog = page.getByRole('dialog', { name: /request a session with priya/i });
  await expect(dialog.getByLabel(/skill/i)).toHaveValue(/.+/);
  await dialog.getByLabel(/message/i).fill('Hi Priya, I would like to learn React hooks.');
  await dialog.getByRole('button', { name: 'Send request' }).click();
  await expect(page).toHaveURL(/\/requests\/[a-f0-9]{24}$/);

  // The local queue worker delivers it (SB2/US25, US48–50 simplified)
  await waitForStatus(page, 'Waiting for reply');
  await expect(page.getByLabel(/match score \d+ out of 100/i)).toBeVisible();

  // Duplicate prevention: asking again opens the same request (SB2/US24)
  const url = page.url();
  await page.goBack();
  await page.getByRole('button', { name: 'Request a session' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Send request' }).click();
  await expect(page).toHaveURL(url);
  await expect(page.getByText(/already have an open request/i)).toBeVisible();

  // Sent requests list (SB2/US26)
  await nav(page, 'Requests').click();
  await page.getByRole('tab', { name: /sent/i }).click();
  await expect(page.getByRole('link', { name: 'Priya Sharma', exact: true })).toBeVisible();
  await logout(page);
});

test('Journey 2 – a mentor reviews, accepts and declines requests (SB2/US13–15, US27–29, US31)', async ({ page }) => {
  await login(page, 'priya@skillbridge.test');
  await expect(page.getByRole('button', { name: /notifications, \d+ unread/i })).toBeVisible();
  await nav(page, 'Requests').click();
  await expect(page).toHaveURL(/\/requests$/);

  // Review Meera's request and accept it
  const meera = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Meera Iyer', exact: true }) });
  await meera.getByRole('link', { name: /details/i }).click();
  await expect(page.getByText(/I know HTML and CSS/)).toBeVisible();
  await page.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByText(/accepted\. your session with meera iyer is booked/i)).toBeVisible();
  await expect(page.getByText('Accepted', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Session', { exact: true })).toBeVisible();

  // Decline Isla's request with a reason from the list
  await page.getByRole('link', { name: 'Back to requests' }).click();
  const isla = page.getByRole('listitem').filter({ has: page.getByRole('link', { name: 'Isla Morgan', exact: true }) });
  await isla.getByRole('button', { name: 'Decline' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/reason/i).fill('Fully booked this month');
  await dialog.getByRole('button', { name: 'Decline request' }).click();
  await expect(page.getByText('Request declined.')).toBeVisible();

  // Updated status
  await page.getByRole('button', { name: /closed/i }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Isla Morgan' })).toContainText('Declined');
  await page.getByRole('button', { name: /accepted/i }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Meera Iyer' })).toContainText('Accepted');
  await logout(page);

  // The learner is notified and sees the match (SB2/US27, US29)
  await login(page, 'meera@skillbridge.test');
  await page.getByRole('button', { name: /notifications, \d+ unread/i }).click();
  await expect(page.getByRole('dialog', { name: 'Recent notifications' })).toContainText('Priya Sharma accepted');
  await page.getByRole('link', { name: 'View all notifications' }).click();
  await expect(page).toHaveURL(/\/notifications$/);
  await nav(page, 'Requests').click();
  await page.getByRole('tab', { name: /sent/i }).click();
  await page.getByRole('button', { name: /accepted/i }).click();
  await expect(page.getByRole('link', { name: 'Priya Sharma', exact: true })).toBeVisible();
  await logout(page);
});

test.describe('Journey 3 – matchmaking', () => {
  test.use({ timezoneId: 'Asia/Kolkata' });

  test('a new learner gets ranked suggestions with reasons and sends a request (SB2/US17–23, US46)', async ({
    page,
  }) => {
    const password = 'Str0ng!Matcher';
    await page.goto('/register');
    await page.getByLabel('Full name').fill('Kiran Joshi');
    await page.getByLabel('Email').fill(uniqueEmail('kiran'));
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
    await page.getByLabel('Confirm password').fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // No learning skills yet → a reason instead of an empty page (SB2/US46)
    await nav(page, 'Suggested').click();
    await expect(page.getByText('You have not added any skills you want to learn.')).toBeVisible();

    // Add a learning skill and evening availability
    await nav(page, 'Skills').click();
    await page.getByRole('tab', { name: /I want to learn/ }).click();
    await page.getByRole('button', { name: 'Add learning skill' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('combobox').fill('react');
    await dialog.getByRole('option', { name: /^React/ }).click();
    await dialog.getByText('Beginner', { exact: true }).click();
    await dialog.getByRole('button', { name: 'Add skill' }).click();
    await nav(page, 'Availability').click();
    await page.getByRole('button', { name: 'Weekday evenings' }).click();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Your availability has been saved.')).toBeVisible();

    // Ranked suggestions with reasons (SB2/US17–22)
    await nav(page, 'Suggested').click();
    const list = page.getByRole('list', { name: 'Suggested mentors, best first' });
    const first = list.getByRole('listitem').first();
    await expect(first).toContainText('Priya Sharma');
    await expect(first.getByLabel(/match score \d+ out of 100/i)).toBeVisible();
    await expect(first).toContainText(/of shared free time each week/);
    await expect(page.getByText(/simplified matching/i)).toBeVisible();

    // View the profile, then request from the suggestion
    await first.getByRole('link', { name: 'View profile' }).click();
    await expect(page.getByRole('heading', { name: 'Priya Sharma', level: 2 })).toBeVisible();
    await expect(page.getByText(/a week in common/)).toBeVisible();
    await page.goBack();
    await page.getByRole('button', { name: 'Request Priya' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Send request' }).click();
    await waitForStatus(page, 'Waiting for reply');

    // The suggestion now shows the open request (SB2/US24)
    await nav(page, 'Suggested').click();
    await expect(page.getByText(/already requested · pending/i).first()).toBeVisible();

    // Automatic matching picks the best remaining mentor (SB2/US12, US22)
    await page.getByRole('button', { name: /match me automatically/i }).click();
    await expect(page).toHaveURL(/\/requests\/[a-f0-9]{24}$/);
    await expect(page.getByText('Auto-matched').first()).toBeVisible();
    await expect(async () => {
      await page.reload();
      await expect(page.getByText(/waiting for reply|no match/i).first()).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await logout(page);
  });
});

test('dark theme is applied everywhere, survives a refresh and works in dialogs', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await login(page, 'arjun@skillbridge.test');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  const bodyBg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(await bodyBg()).toBe('rgb(11, 17, 32)');

  for (const name of ['Find mentors', 'Suggested', 'Requests', 'Settings']) {
    await nav(page, name).click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
  }
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  expect(await bodyBg()).toBe('rgb(11, 17, 32)');

  // A dialog in dark mode uses the raised dark surface, not white
  await page.getByRole('button', { name: 'Deactivate account' }).click();
  const dialogBg = await page
    .getByRole('dialog')
    .evaluate((el) => getComputedStyle(el.closest('[role="dialog"]')).backgroundColor);
  expect(dialogBg).not.toBe('rgb(255, 255, 255)');
  await page.keyboard.press('Escape');

  // Switch back from Settings
  await page.getByRole('radio', { name: /light/i }).check({ force: true });
  await expect(html).toHaveAttribute('data-theme', 'light');
});
