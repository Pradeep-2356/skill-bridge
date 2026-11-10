/**
 * Sprint 1 main user journey (Stage 3 testing strategy):
 * Register → Login → Dashboard → Update profile → Add skills → Search → Logout.
 * Runs in Chromium, Firefox and WebKit to cover desktop browsers (SB1/US40).
 */
import { test, expect } from '@playwright/test';
import { uniqueEmail, logout, nav, DEMO_PASSWORD } from './helpers.js';

test('a new member registers, builds a profile, finds a mentor and logs out', async ({ page }) => {
  const email = uniqueEmail('neha');
  const password = 'Str0ng!Journey';

  // Register (SB1/US1, US2, US15) – validation first (SB1/US8)
  await page.goto('/');
  await page.getByRole('link', { name: 'Get started free' }).click();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('alert').first()).toContainText('Please fix');

  await page.getByLabel('Full name').fill('Neha Verma');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  // Dashboard (SB1/US35)
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Neha');
  await expect(page.getByRole('img', { name: /profile 0% complete/i })).toBeVisible();

  // Update profile (SB1/US16, US18)
  await nav(page, 'My profile').click();
  await page.getByRole('link', { name: 'Edit profile', exact: true }).click();
  await page.getByLabel('Headline').fill('Data student who loves music');
  await page.getByLabel('Bio').fill('Final-year student. I play the guitar and want to learn React for my projects.');
  await page.getByRole('button', { name: 'Music' }).click();
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText('Data student who loves music')).toBeVisible();

  // Add a teaching skill (SB1/US20, US25)
  await nav(page, 'Skills').click();
  await page.getByRole('button', { name: 'Add teaching skill' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox').fill('guit');
  await dialog.getByRole('option', { name: /Guitar/ }).click();
  await dialog.getByText('Advanced', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Add skill' }).click();
  await expect(page.getByRole('heading', { name: 'Guitar' })).toBeVisible();

  // Add a learning skill (SB1/US22, US26)
  await page.getByRole('tab', { name: /I want to learn/ }).click();
  await page.getByRole('button', { name: 'Add learning skill' }).first().click();
  await dialog.getByRole('combobox').fill('react');
  await dialog.getByRole('option', { name: /^React/ }).click();
  await dialog.getByText('Beginner', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Add skill' }).click();
  await expect(page.getByRole('heading', { name: 'React' })).toBeVisible();

  // Availability (SB1/US27–29)
  await nav(page, 'Availability').click();
  await page.getByRole('button', { name: 'Weekday evenings' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Your availability has been saved.')).toBeVisible();

  // Search for a mentor (SB1/US50) and open a profile (SB1/US46)
  await page.getByLabel('Search skills or mentors').fill('react');
  await page.keyboard.press('Enter');
  // Sprint 2 moved search to /discover (the old /search address still redirects).
  await expect(page).toHaveURL(/\/discover\?q=react/);
  await expect(page.getByTestId('result-count')).toContainText('for “react”');
  await expect(page.getByRole('link', { name: 'Priya Sharma', exact: true })).toBeVisible();
  await expect(page.getByText('Vikram Shah')).toHaveCount(0); // deactivated by an admin
  await page.getByRole('link', { name: "View Priya Sharma's profile" }).click();
  await expect(page.getByRole('heading', { name: 'Priya Sharma', level: 2 })).toBeVisible();
  await expect(page.getByText('priya@skillbridge.test')).toHaveCount(0); // private (SB1/US46)

  // Dashboard now reflects the work (SB1/US36)
  await nav(page, 'Dashboard').click();
  await expect(page.getByText('Guitar').first()).toBeVisible();

  // Logout (SB1/US4) – protected pages are closed afterwards (SB1/US13)
  await logout(page);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);

  // Log back in with the new account (SB1/US3)
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(DEMO_PASSWORD).toBeTruthy();
});
