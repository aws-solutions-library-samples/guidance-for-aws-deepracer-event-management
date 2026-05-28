/**
 * Authenticated smoke test — "can a racer log in?"
 *
 * Always runs in PostDeployTests. Validates that the deployed site
 * renders the login form and a standard (racer) user can authenticate.
 */

import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Browser, Page } from 'playwright';

const WEBSITE_URL = process.env.DREM_WEBSITE_URL;
const RACER_USERNAME = process.env.TEST_RACER_USERNAME;
const RACER_PASSWORD = process.env.TEST_RACER_PASSWORD;
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

describe('Authenticated smoke — racer login', () => {
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
    expect(RACER_USERNAME).toBeTruthy();
    expect(RACER_PASSWORD).toBeTruthy();
  });

  it('racer can log in', async () => {
    await login(page, RACER_USERNAME!, RACER_PASSWORD!);
    const url = page.url();
    expect(url).not.toContain('login');
  }, TEST_TIMEOUT_MS);

  it('authenticated page renders navigation', async () => {
    const nav = await page.$('nav, [class*="side-nav"], [class*="Navigation"]');
    expect(nav).not.toBeNull();
  });

  it('models page is accessible', async () => {
    await page.goto(`${WEBSITE_URL}/models/view`, { timeout: TIMEOUT_MS });
    await page.waitForTimeout(5000);
    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    expect(bodyText.toLowerCase()).toMatch(/model/i);
  }, TEST_TIMEOUT_MS);
});
