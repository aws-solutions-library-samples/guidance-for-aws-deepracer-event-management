/**
 * Admin E2E tests — operator/admin functionality verification.
 *
 * Only runs when test_e2e_admin=true is set in build.config.
 * Requires the admin test user to be provisioned (conditional in CDK).
 * Runs in a separate EnhancedE2ETests pipeline step.
 */

import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Browser, Page } from 'playwright';

const WEBSITE_URL = process.env.DREM_WEBSITE_URL;
const ADMIN_USERNAME = process.env.TEST_ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
const TIMEOUT_MS = 30_000;
const TEST_TIMEOUT_MS = 60_000;

async function login(page: Page, username: string, password: string) {
  await page.goto(WEBSITE_URL!, { timeout: TIMEOUT_MS });
  await page.waitForSelector('input[name="username"]', { timeout: TIMEOUT_MS });
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  const skipButton = await page.$('button:has-text("Skip"), [class*="skip"]');
  if (skipButton) {
    await skipButton.click();
    await page.waitForTimeout(3000);
  }
}

describe('Admin E2E — admin login + operator features', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ args: ['--no-sandbox'] });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('env vars are set', () => {
    expect(WEBSITE_URL).toBeTruthy();
    expect(ADMIN_USERNAME).toBeTruthy();
    expect(ADMIN_PASSWORD).toBeTruthy();
  });

  it('admin can log in', async () => {
    await login(page, ADMIN_USERNAME!, ADMIN_PASSWORD!);
    const url = page.url();
    expect(url).not.toContain('login');
  }, TEST_TIMEOUT_MS);

  it('admin sees operator navigation items', async () => {
    const pageContent = await page.content();
    expect(pageContent).toMatch(/operator|event|device|model/i);
  });

  it('user management page loads', async () => {
    await page.goto(`${WEBSITE_URL}/admin/user-management`, { timeout: TIMEOUT_MS });
    await page.waitForSelector('table, [class*="table"]', { timeout: TIMEOUT_MS });
    const table = await page.$('table, [class*="table"]');
    expect(table).not.toBeNull();
  }, TEST_TIMEOUT_MS);

  it('stats page renders', async () => {
    await page.goto(`${WEBSITE_URL}/stats`, { timeout: TIMEOUT_MS });
    await page.waitForSelector('canvas, [class*="chart"], [class*="stats"]', { timeout: TIMEOUT_MS });
    const chart = await page.$('canvas, [class*="chart"], [class*="stats"]');
    expect(chart).not.toBeNull();
  }, TEST_TIMEOUT_MS);
});
