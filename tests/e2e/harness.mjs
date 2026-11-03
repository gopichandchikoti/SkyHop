/**
 * Shared plumbing for the browser end-to-end suites (run.mjs and extra.mjs): launches an installed Chromium browser,
 * gives every test a fresh page with its own storage, and fails a test on any console error, page crash or failed request.
 *
 * Environment:
 *   SKYHOP_URL      base URL (default http://localhost:5605)
 *   SKYHOP_BROWSER  path to a Chromium-based executable (default: installed Edge, then Chrome)
 *   SKYHOP_PROD=1   production build (no dev state hook): skips the checks that need it
 *   SKYHOP_GREP     only run checks whose name matches this regular expression (case-insensitive)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const BASE = process.env.SKYHOP_URL ?? 'http://localhost:5605';
export const PROD = process.env.SKYHOP_PROD === '1';
const GREP = process.env.SKYHOP_GREP ? new RegExp(process.env.SKYHOP_GREP, 'i') : null;
export const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'output');
const require = createRequire(import.meta.url);
const AXE_SOURCE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
mkdirSync(OUT, { recursive: true });

const results = [];
let browser;

async function launch() {
  const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  const candidates = process.env.SKYHOP_BROWSER
    ? [{ executablePath: process.env.SKYHOP_BROWSER }]
    : [{ channel: 'msedge' }, { channel: 'chrome' }];
  for (const candidate of candidates) {
    try {
      return await chromium.launch({ headless: true, args, ...candidate });
    } catch {
      /* try the next browser */
    }
  }
  throw new Error('No Chromium-based browser found. Set SKYHOP_BROWSER to its executable path.');
}

export async function openBrowser() {
  console.log(`SkyHop end-to-end checks against ${BASE}${PROD ? ' (production build)' : ''}`);
  browser = await launch();
  console.log(`  browser: ${browser.version()}`);
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/**
 * Opens a fresh page (own storage) and fails the test on any console error or page crash.
 * options.context   extra browser-context options (viewport, touch, reduced motion ...)
 * options.seed      one or more { key, value } entries written to localStorage before the page loads
 * options.init      { fn, arg }: a function run in the page before any of its scripts
 * options.ignore    regular expressions for problems that are expected in this test
 */
async function withPage(options, body) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...options.context });
  const seeds = [].concat(options.seed ?? []);
  if (seeds.length) {
    await context.addInitScript((entries) => entries.forEach((e) => localStorage.setItem(e.key, e.value)), seeds);
  }
  if (options.init) await context.addInitScript(options.init.fn, options.init.arg);
  const page = await context.newPage();
  const problems = [];
  const expected = (text) => (options.ignore ?? []).some((pattern) => pattern.test(text));
  const note = (text) => {
    if (!expected(text)) problems.push(text);
  };
  page.on('console', (msg) => {
    if (msg.type() === 'error') note(`console: ${msg.text()}`);
  });
  page.on('pageerror', (error) => note(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => note(`request failed: ${request.url()}`));
  try {
    await page.goto(BASE, { waitUntil: 'load' });
    await body(page);
    assert(problems.length === 0, `browser reported problems:\n        ${problems.join('\n        ')}`);
  } finally {
    await context.close();
  }
}

/** flags: needsHook (uses window.__skyhop, dev server only), prodOnly (only meaningful on a production build). */
export async function test(name, options, body, { needsHook = false, prodOnly = false } = {}) {
  if (GREP && !GREP.test(name)) return;
  const skip = (needsHook && PROD) ? 'needs dev state hook' : (prodOnly && !PROD) ? 'needs a production build' : null;
  if (skip) {
    results.push({ name, status: 'skipped', note: skip });
    console.log(`  - ${name} (skipped: ${skip})`);
    return;
  }
  const started = Date.now();
  try {
    await withPage(options, body);
    results.push({ name, status: 'passed', ms: Date.now() - started });
    console.log(`  ✓ ${name}`);
  } catch (error) {
    results.push({ name, status: 'failed', error: String(error.message ?? error) });
    console.log(`  ✗ ${name}\n      ${String(error.message ?? error).replace(/\n/g, '\n      ')}`);
  }
}

export const snap = (page) => page.evaluate(() => window.__skyhop.snapshot());
export const waitPhase = (page, phase, timeout = 15000) =>
  page.waitForFunction((target) => window.__skyhop.snapshot().phase === target, phase, { timeout });
export const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

/** Plays like a person would: reads the world and presses Space through the real keyboard path. */
export const startBot = (page) =>
  page.evaluate(() => {
    const clear = 1.95 / 2 + 0.36;
    const rise = (9.2 * 9.2) / (2 * 32);
    let last = 0;
    const tick = (now) => {
      if (!window.__botOn) return;
      const s = window.__skyhop.snapshot();
      const pipe = s.pipes.find((p) => p.x + clear > 0);
      if (s.phase === 'playing' && pipe && now - last > 90 && s.birdY < pipe.centre - rise / 2 && s.birdVy < 1.5) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true }));
        last = now;
      }
      requestAnimationFrame(tick);
    };
    window.__botOn = true;
    requestAnimationFrame(tick);
  });

export async function runAxe(page, label) {
  await page.evaluate(AXE_SOURCE);
  const report = await page.evaluate(() =>
    window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }));
  const found = report.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) - ${v.help}`);
  assert(found.length === 0, `axe found accessibility violations on ${label}:\n        ${found.join('\n        ')}`);
}

export const SEED_ALL = {
  key: 'skyhop.v2.progress',
  value: JSON.stringify({ completed: [1, 2, 3, 4, 5, 6, 7, 8, 9], bestEndless: 14, lastLevel: 10 }),
};

export const SETTINGS_KEY = 'skyhop.v2.settings';
export const PROGRESS_KEY = 'skyhop.v2.progress';

/** Closes the browser, writes results.json and exits non-zero if anything failed. */
export async function finish() {
  await browser.close();
  const failed = results.filter((r) => r.status === 'failed');
  const passed = results.filter((r) => r.status === 'passed').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ base: BASE, prod: PROD, results }, null, 2));
  console.log(`\n${passed} passed, ${failed.length} failed, ${skipped} skipped. Screenshots: ${OUT}`);
  process.exit(failed.length > 0 ? 1 : 0);
}
