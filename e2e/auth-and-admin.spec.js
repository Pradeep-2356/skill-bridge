import { test, expect } from '@playwright/test';
import { login, logout, nav, DEMO_PASSWORD } from './helpers.js';

test.describe('authentication', () => {
  test('wrong password shows a clear message and does not sign in (SB1/US3, US42)', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('priya@skillbridge.test');
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('Wrong!Passw0rd');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('The email or password is incorrect.')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('stays signed in when the short-lived access cookie is gone (SB1/US10, US12)', async ({ page, context }) => {
    await login(page, 'arjun@skillbridge.test');
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'sb_access')?.httpOnly).toBe(true);
    expect(cookies.find((c) => c.name === 'sb_refresh')?.httpOnly).toBe(true);

    // Simulate the 15-minute access token expiring.
    await context.clearCookies({ name: 'sb_access' });
    await page.goto('/sessions');
    await expect(page.getByRole('heading', { name: 'Sessions', level: 1 })).toBeVisible();
    expect((await context.cookies()).some((c) => c.name === 'sb_access')).toBe(true);
  });

  test('password reset by email, end to end (SB1/US5, US6)', async ({ page, request }) => {
    const email = 'grace@skillbridge.test';
    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();

    const res = await request.get(`/api/test/emails/latest?to=${encodeURIComponent(email)}`);
    const { data } = await res.json();
    const link = /http:\/\/localhost:\d+(\/reset-password\/[\w-]+)/.exec(data.email.text)[1];

    await page.goto(link);
    await page.getByRole('textbox', { name: 'New password', exact: true }).fill('Fresh!Passw0rd');
    await page.getByLabel('Confirm new password').fill('Fresh!Passw0rd');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page).toHaveURL(/\/login\?reset=success/);

    await login(page, email, 'Fresh!Passw0rd');

    // The same link no longer works.
    await logout(page);
    await page.goto(link);
    await page.getByRole('textbox', { name: 'New password', exact: true }).fill('Another!Passw0rd');
    await page.getByLabel('Confirm new password').fill('Another!Passw0rd');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByRole('heading', { name: 'This link has expired' })).toBeVisible();
  });
});

test.describe('administration (SB1/US47–49)', () => {
  test('a member cannot open the admin area', async ({ page }) => {
    await login(page, 'arjun@skillbridge.test');
    await page.goto('/admin/users');
    await expect(page.getByText('Administrators only')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Manage users' })).toHaveCount(0);
  });

  test('an admin deactivates an account, which then cannot log in, and reactivates it', async ({ page, browser }) => {
    await login(page, 'admin@skillbridge.test');
    await nav(page, 'Manage users').click();
    await page.getByLabel('Search by name or email').fill('jacob');
    await page.getByRole('link', { name: 'Jacob Turner' }).click();
    await expect(page.getByText('jacob@skillbridge.test').first()).toBeVisible();

    await page.getByRole('button', { name: 'Deactivate account' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Deactivate' }).click();
    await expect(page.getByRole('dialog').getByText('Give a reason of at least 5 characters')).toBeVisible();
    await page.getByLabel(/Reason/).fill('Spam reported by several members');
    await page.getByRole('dialog').getByRole('button', { name: 'Deactivate' }).click();
    await expect(page.getByText('Deactivated by an administrator')).toBeVisible();

    // The member is now locked out.
    const other = await browser.newPage();
    await other.goto('/login');
    await other.getByLabel('Email').fill('jacob@skillbridge.test');
    await other.getByRole('textbox', { name: 'Password', exact: true }).fill(DEMO_PASSWORD);
    await other.getByRole('button', { name: 'Log in' }).click();
    await expect(other.getByText(/deactivated by an administrator/i)).toBeVisible();
    await other.close();

    // Put things back for the next run.
    await page.getByRole('button', { name: 'Reactivate account' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reactivate' }).click();
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible();
  });
});

test.describe('responsive layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('works on a phone-sized screen with a slide-out menu (SB1/US40, US44)', async ({ page }) => {
    await login(page, 'priya@skillbridge.test');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    await page.getByRole('button', { name: 'Open menu' }).click();
    await nav(page, 'Skills').click();
    await expect(page).toHaveURL(/\/skills$/);
    await expect(page.getByRole('heading', { name: 'Skills', level: 1 })).toBeVisible();
  });
});
