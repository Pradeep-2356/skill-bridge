import { expect } from '@playwright/test';

export const DEMO_PASSWORD = 'Demo@1234';

export async function login(page, email, password = DEMO_PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function logout(page) {
  await page.getByRole('button', { name: /account menu/i }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

/** A fresh email per run so the journey can be repeated without a reset. */
export const uniqueEmail = (prefix) => `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e4)}@skillbridge.test`;

/** A link in the sidebar's main navigation, matched by its exact name. */
export const nav = (page, name) =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true });
