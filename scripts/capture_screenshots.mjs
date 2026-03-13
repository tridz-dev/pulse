#!/usr/bin/env node
/**
 * Capture Pulse app screenshots for README.
 * Run once: npx playwright install chromium
 * Then: BASE_URL=http://processwise.localhost:8000 node scripts/capture_screenshots.mjs
 */
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.BASE_URL || 'http://processwise.localhost:8000';
const LOGIN_EMAIL = process.env.LOGIN_EMAIL || 'Administrator';
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || 'admin';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

const ROUTES = [
  { path: '/pulse', name: 'dashboard.png', waitMs: 3500 },
  { path: '/pulse/team', name: 'team.png', waitMs: 2500 },
  { path: '/pulse/team', name: 'team-levels-open.png', waitMs: 2500, afterNav: async (page) => { await page.getByRole('tab', { name: /all teams/i }).click().catch(() => {}); await page.waitForTimeout(1500); } },
  { path: '/pulse/operations', name: 'operations.png', waitMs: 3000 },
  { path: '/pulse/insights', name: 'insights.png', waitMs: 4500 },
  { path: '/pulse/insights', name: 'insights-drill.png', waitMs: 3500, afterNav: async (page) => { await page.locator('.recharts-bar-rectangle').first().click({ timeout: 6000 }).catch(() => {}); await page.waitForTimeout(2500); } },
  { path: '/pulse/operations', name: 'user-roles.png', waitMs: 2000 },
  { path: '/pulse/tasks', name: 'my-tasks.png', waitMs: 3000 },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  try {
    await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle', timeout: 20000 });
    await page.fill('input[type="email"], input[name="email"]', LOGIN_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', LOGIN_PASSWORD);
    await page.click('button[type="submit"], button:has-text("Login")');
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);

    const seen = new Set();
    for (const r of ROUTES) {
      const outPath = path.join(OUT_DIR, r.name);
      try {
        await page.goto(BASE_URL + r.path, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(r.waitMs || 2000);
        if (r.afterNav) await r.afterNav(page);
        await page.screenshot({ path: outPath, fullPage: false });
        console.log('Saved:', r.name);
      } catch (e) {
        console.warn('Skip', r.name, e.message);
      }
      seen.add(r.path);
    }
  } finally {
    await browser.close();
  }
  console.log('Screenshots written to', OUT_DIR);
}

main().catch((e) => { console.error(e); process.exit(1); });
