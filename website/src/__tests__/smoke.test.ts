/**
 * Smoke Tests — "did the site render?"
 *
 * Runs against the live CloudFront URL (DREM_WEBSITE_URL env var).
 * Designed to run in the post-deploy pipeline stage and later as a
 * CloudWatch Synthetics Canary (same Playwright API, different runner).
 */

import { chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Browser, Page } from 'playwright';

const WEBSITE_URL = process.env.DREM_WEBSITE_URL;
const TIMEOUT_MS = 30_000;

describe('DREM smoke tests', () => {
    let browser: Browser;
    let page: Page;

    beforeAll(async () => {
        browser = await chromium.launch({ args: ['--no-sandbox'] });
        page = await browser.newPage();
    });

    afterAll(async () => {
        await browser.close();
    });

    it('DREM_WEBSITE_URL env var is set', () => {
        expect(WEBSITE_URL).toBeTruthy();
    });

    it('main page returns HTTP 200', async () => {
        const response = await page.goto(WEBSITE_URL!, { timeout: TIMEOUT_MS });
        expect(response?.status()).toBe(200);
    });

    it('page title contains DREM', async () => {
        const title = await page.title();
        expect(title).toMatch(/deepracer|drem/i);
    });

    it('page renders a root element', async () => {
        const root = await page.$('#root');
        expect(root).not.toBeNull();
    });
});
