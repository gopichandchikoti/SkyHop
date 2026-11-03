/**
 * Real-browser end-to-end checks. Drives an installed Chromium browser (Edge or Chrome) with real
 * mouse, touch and keyboard input against a running SkyHop server.
 *
 *   npm run dev            # in one terminal (serves http://localhost:5605)
 *   npm run test:e2e       # in another
 *
 * This file holds the core flows; the mobile, resilience and persistence checks are in extra.mjs and the shared
 * plumbing (browser launch, per-test page, environment variables) is in harness.mjs.
 */
import { SEED_ALL, assert, finish, openBrowser, runAxe, shot, snap, startBot, test, waitPhase } from './harness.mjs';
import { runExtraTests } from './extra.mjs';

await openBrowser();
await test('menu loads, renders a 3D canvas and animates', {}, async (page) => {
  await page.getByRole('heading', { name: 'SkyHop' }).waitFor();
  await page.getByRole('button', { name: /Play level 1/ }).waitFor();
  assert((await page.locator('canvas').count()) === 1, 'expected exactly one WebGL canvas');
  const first = await page.screenshot();
  await page.waitForTimeout(900);
  const second = await page.screenshot();
  assert(first.length > 20000, 'first frame looks blank (screenshot is tiny)');
  assert(!first.equals(second), 'scene is static: sky and bird should be moving on the menu');
  await shot(page, '01-menu');
});

await test('menu passes automated WCAG 2.2 AA checks', {}, async (page) => {
  await page.getByRole('button', { name: /Play level 1/ }).waitFor();
  await runAxe(page, 'the menu');
});

await test('tapping the sky starts a level (no button needed)', {}, async (page) => {
  await page.mouse.click(180, 430);
  await page.locator('.pill__name', { hasText: 'First Light' }).waitFor();
  await page.waitForTimeout(2800); // the level banner shows for 2.2 s; wait it out so the screenshot shows the bird
  await shot(page, '02-ready');
});

await test('first flap starts the run and the bird really moves', {}, async (page) => {
  await page.mouse.click(180, 430);
  await waitPhase(page, 'ready');
  await page.keyboard.press('Space');
  await waitPhase(page, 'playing');
  await startBot(page); // keeps the bird alive so the measurements below cannot race a crash
  const heights = [];
  for (let i = 0; i < 4; i++) {
    heights.push((await snap(page)).birdY);
    await page.waitForTimeout(150);
  }
  assert(new Set(heights.map((y) => y.toFixed(2))).size > 1, `bird did not move: ${heights}`);
  const before = (await snap(page)).pipes[0].x;
  await page.waitForTimeout(500);
  const after = await snap(page);
  assert(after.phase === 'playing', `run ended early (phase ${after.phase}) before pipes could be measured`);
  assert(after.pipes[0].x < before - 1, `pipes are not scrolling toward the bird (${before} -> ${after.pipes[0].x})`);
}, { needsHook: true });

await test('clearing level 1 shows the completion screen and saves progress', {}, async (page) => {
  await page.mouse.click(180, 430);
  await waitPhase(page, 'ready');
  await page.keyboard.press('Space');
  await startBot(page);
  await page.getByRole('heading', { name: 'Level complete!' }).waitFor({ timeout: 120000 });
  await shot(page, '03-level-complete');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('skyhop.v2.progress') ?? '{}'));
  assert(Array.isArray(saved.completed) && saved.completed.includes(1), `progress not saved: ${JSON.stringify(saved)}`);
  await runAxe(page, 'the level complete dialog');
  await page.getByRole('button', { name: 'Next level' }).click();
  await page.locator('.pill__label', { hasText: 'Level 2' }).waitFor();
  await page.waitForTimeout(2500);
  await shot(page, '04-level-2');
}, { needsHook: true });

await test('crashing shows game over, and Try again restarts cleanly', {}, async (page) => {
  await page.getByRole('button', { name: /Play level 1/ }).click();
  await page.keyboard.press('Space');
  await page.getByRole('heading', { name: 'Crash!' }).waitFor({ timeout: 20000 });
  await shot(page, '05-game-over');
  await runAxe(page, 'the game over dialog');
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.locator('.hint--play', { hasText: 'flap' }).waitFor();
  assert((await page.locator('.score').innerText()) === '0', 'score did not reset');
});

await test('pause freezes the world, resume counts down and continues', {}, async (page) => {
  await page.getByRole('button', { name: /Play level 1/ }).click();
  await waitPhase(page, 'ready');
  await page.keyboard.press('Space');
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await page.getByRole('heading', { name: 'Paused' }).waitFor();
  await shot(page, '06-paused');
  const frozen = await snap(page);
  await page.waitForTimeout(700);
  const later = await snap(page);
  assert(later.birdY === frozen.birdY && later.pipes[0].x === frozen.pipes[0].x, 'world kept moving while paused');
  await page.getByRole('button', { name: 'Resume' }).click();
  await page.locator('.countdown').waitFor({ state: 'visible' });
  await waitPhase(page, 'playing', 8000);
}, { needsHook: true });

await test('hiding the tab pauses the game automatically', {}, async (page) => {
  await page.getByRole('button', { name: /Play level 1/ }).click();
  await waitPhase(page, 'ready');
  await page.keyboard.press('Space');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await waitPhase(page, 'paused', 3000);
}, { needsHook: true });

await test('level select locks unfinished levels and Escape closes it', {}, async (page) => {
  await page.getByRole('button', { name: 'Levels' }).click();
  const tiles = page.locator('.level');
  assert((await tiles.count()) === 10, 'expected 10 level tiles');
  assert((await tiles.nth(0).getAttribute('aria-disabled')) === null, 'level 1 should be playable');
  assert((await tiles.nth(1).getAttribute('aria-disabled')) === 'true', 'level 2 should start locked');
  await shot(page, '07-levels');
  await runAxe(page, 'the level select dialog');
  await tiles.nth(1).click({ force: true });
  assert((await page.locator('.hud').isHidden()), 'clicking a locked level must not start it');
  await page.keyboard.press('Escape');
  await page.locator('.level').first().waitFor({ state: 'detached' });
});

await test('settings persist across reloads', {}, async (page) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  const assist = page.getByRole('switch', { name: /Assist mode/ });
  assert((await assist.getAttribute('aria-checked')) === 'false', 'assist should start off');
  await assist.click();
  assert((await assist.getAttribute('aria-checked')) === 'true', 'switch did not toggle');
  await shot(page, '08-settings');
  await runAxe(page, 'the settings dialog');
  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).click();
  assert((await page.getByRole('switch', { name: /Assist mode/ }).getAttribute('aria-checked')) === 'true',
    'assist mode was not remembered');
});

await test('works from the keyboard alone', {}, async (page) => {
  const play = page.getByRole('button', { name: /Play level 1/ });
  await play.waitFor();
  assert(await play.evaluate((el) => document.activeElement === el), 'Play should hold focus on load');
  await page.keyboard.press('Enter');
  await page.locator('.hud').waitFor({ state: 'visible' });
  await page.keyboard.press('Space');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Resume' }).waitFor();
  await page.keyboard.press('Tab');
  assert(await page.evaluate(() => document.activeElement?.closest('[role=dialog]') !== null),
    'focus escaped the pause dialog');
});

await test('phone: touch to start, tap to flap, no overflow at 320px', {
  context: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
}, async (page) => {
  await page.getByRole('button', { name: /Play level 1/ }).waitFor();
  await shot(page, '09-phone-menu');
  await page.touchscreen.tap(60, 420);
  await page.locator('.hud').waitFor({ state: 'visible' });
  await page.touchscreen.tap(60, 420);
  await page.waitForTimeout(600);
  await shot(page, '10-phone-play');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflow <= 0, `page overflows horizontally by ${overflow}px at 320px`);
});

await test('short landscape phone keeps every control on screen', {
  context: { viewport: { width: 568, height: 320 }, hasTouch: true, isMobile: true },
}, async (page) => {
  await page.getByRole('button', { name: /Play level 1/ }).waitFor();
  await shot(page, '11-landscape-menu');
  const boxes = await page.locator('.menu .btn').evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect()).map((r) => ({ top: r.top, bottom: r.bottom, left: r.left, right: r.right })));
  assert(boxes.length >= 4, 'menu buttons missing');
  for (const box of boxes) {
    assert(box.top >= 0 && box.bottom <= 320 && box.left >= 0 && box.right <= 568, `button off-screen: ${JSON.stringify(box)}`);
  }
});

await test('every sky theme renders (gallery)', { seed: SEED_ALL }, async (page) => {
  const themes = [[1, 'meadow'], [2, 'noon'], [4, 'golden-hour'], [6, 'dusk'], [8, 'night'], [10, 'aurora']];
  for (const [level, name] of themes) {
    await page.getByRole('button', { name: 'Levels' }).click();
    await page.locator('.level').nth(level - 1).click();
    await page.locator('.hint--play').waitFor({ state: 'visible' });
    await page.waitForTimeout(3600);
    await shot(page, `theme-${String(level).padStart(2, '0')}-${name}`);
    if (level < 10) {
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Main menu' }).click();
    }
  }
});

await runExtraTests();
await finish();
