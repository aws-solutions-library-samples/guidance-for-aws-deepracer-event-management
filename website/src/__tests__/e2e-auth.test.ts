/**
 * Authenticated E2E Tests — "can a user log in and use the app?"
 *
 * Runs against the live CloudFront URL using Cognito test users created
 * by the E2eTestUsers CDK construct. Credentials are injected via env vars
 * from Secrets Manager in the PostDeploy pipeline step.
 */

import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Browser, Page } from 'playwright';

const WEBSITE_URL = process.env.DREM_WEBSITE_URL;
const RACER_USERNAME = process.env.TEST_RACER_USERNAME;
const RACER_PASSWORD = process.env.TEST_RACER_PASSWORD;
const ADMIN_USERNAME = process.env.TEST_ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD;
const TIMEOUT_MS = 30_000;

async function login(page: Page, username: string, password: string) {
  await page.goto(WEBSITE_URL!, { timeout: TIMEOUT_MS });
  await page.waitForSelector('[name="username"], input[autocomplete="username"]', { timeout: TIMEOUT_MS });
  await page.fill('[name="username"], input[autocomplete="username"]', username);
  await page.fill('[name="password"], input[autocomplete="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-testid="side-navigation"], nav', { timeout: TIMEOUT_MS });
}

describe('Authenticated E2E — racer login', () => {
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
  });

  it('authenticated page renders navigation', async () => {
    const nav = await page.$('nav, [class*="side-nav"], [class*="Navigation"]');
    expect(nav).not.toBeNull();
  });

  it('models page is accessible', async () => {
    await page.goto(`${WEBSITE_URL}/models/view`, { timeout: TIMEOUT_MS });
    await page.waitForSelector('h1, [class*="header"]', { timeout: TIMEOUT_MS });
    const heading = await page.textContent('h1, [class*="header"]');
    expect(heading).toBeTruthy();
  });
});

describe('Authenticated E2E — admin login', () => {
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
    expect(ADMIN_USERNAME).toBeTruthy();
    expect(ADMIN_PASSWORD).toBeTruthy();
  });

  it('admin can log in', async () => {
    await login(page, ADMIN_USERNAME!, ADMIN_PASSWORD!);
    const url = page.url();
    expect(url).not.toContain('login');
  });

  it('admin sees operator navigation items', async () => {
    const pageContent = await page.content();
    expect(pageContent).toMatch(/operator|event|device|model/i);
  });

  it('user management page loads', async () => {
    await page.goto(`${WEBSITE_URL}/admin/user-management`, { timeout: TIMEOUT_MS });
    await page.waitForSelector('table, [class*="table"]', { timeout: TIMEOUT_MS });
    const table = await page.$('table, [class*="table"]');
    expect(table).not.toBeNull();
  });

  it('stats page renders', async () => {
    await page.goto(`${WEBSITE_URL}/stats`, { timeout: TIMEOUT_MS });
    await page.waitForSelector('canvas, [class*="chart"], [class*="stats"]', { timeout: TIMEOUT_MS });
    const chart = await page.$('canvas, [class*="chart"], [class*="stats"]');
    expect(chart).not.toBeNull();
  });
});
