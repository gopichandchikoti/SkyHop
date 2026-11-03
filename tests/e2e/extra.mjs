/**
 * Mobile, resilience and persistence checks, run after the core flows in run.mjs. Same rules: real input, a real
 * browser, and any console error fails the test unless the test says it expects one.
 */
import { PROGRESS_KEY, SETTINGS_KEY, assert, shot, snap, test, waitPhase } from './harness.mjs';

const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const progress = (completed, bestEndless = 0) => ({
  key: PROGRESS_KEY, value: JSON.stringify({ completed, bestEndless, lastLevel: Math.min(10, completed.length + 1) }),
});
const stored = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);

async function mobileTests() {
  await test('phone: a touch tap starts the run and a second tap flaps the bird', { context: PHONE }, async (page) => {
    await page.getByRole('button', { name: /Play level 1/ }).waitFor();
    await page.touchscreen.tap(60, 420);
    await waitPhase(page, 'ready');
    await page.touchscreen.tap(60, 420);
    await waitPhase(page, 'playing');
    const flap = await snap(page);
    assert(flap.birdY > 7, `bird should be above its start height right after a flap, was ${flap.birdY}`);
  }, { needsHook: true });

  await test('switching away from the app pauses a run (window blur, as on Android)', {}, async (page) => {
    await page.getByRole('button', { name: /Play level 1/ }).click();
    await waitPhase(page, 'ready');
    await page.keyboard.press('Space');
    await waitPhase(page, 'playing');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await waitPhase(page, 'paused', 3000);
    await page.getByRole('heading', { name: 'Paused' }).waitFor();
    await page.getByRole('button', { name: 'Resume' }).click();
    await waitPhase(page, 'playing', 8000);
  }, { needsHook: true });

  await test('rotating the phone mid-game keeps the scene full-screen and playable', { context: PHONE }, async (page) => {
    await page.getByRole('button', { name: /Play level 1/ }).click();
    await waitPhase(page, 'ready');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(600);
    const canvas = await page.locator('canvas').evaluate((el) => ({
      w: el.clientWidth, h: el.clientHeight, aspect: el.width / el.height,
    }));
    assert(Math.abs(canvas.w - 844) <= 1 && Math.abs(canvas.h - 390) <= 1, `canvas is ${canvas.w}x${canvas.h} after rotating`);
    assert(Math.abs(canvas.aspect - 844 / 390) < 0.03, `drawing buffer was not resized (aspect ${canvas.aspect.toFixed(2)})`);
    assert((await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0, 'page overflows');
    assert((await snap(page)).phase === 'ready', 'rotating must not end or restart the run');
    await page.keyboard.press('Space');
    await waitPhase(page, 'playing');
    await shot(page, '12-phone-rotated');
  }, { needsHook: true });

  await test('prefers-reduced-motion is respected from the first frame', { context: { reducedMotion: 'reduce' } }, async (page) => {
    await page.getByRole('button', { name: /Play level 1/ }).waitFor();
    assert((await page.evaluate(() => document.documentElement.dataset.motion)) === 'reduced', 'motion should default to reduced');
    await page.getByRole('button', { name: 'Settings' }).click();
    const reduce = page.getByRole('switch', { name: /Reduce motion/ });
    assert((await reduce.getAttribute('aria-checked')) === 'true', 'the Reduce motion switch should start on');
  });
}

async function persistenceTests() {
  await test('a bird unlocked by progress can be chosen, and a locked one cannot', { seed: progress([1, 2, 3]) }, async (page) => {
    await page.getByRole('button', { name: 'Settings' }).click();
    const azure = page.getByRole('radio', { name: 'Azure' });
    const mint = page.getByRole('radio', { name: /Mint/ });
    assert((await azure.getAttribute('aria-disabled')) === null, 'Azure should be unlocked after level 3');
    assert((await mint.getAttribute('aria-disabled')) === 'true', 'Mint should still be locked');
    await mint.click({ force: true });
    assert((await page.getByRole('radio', { name: 'Coral' }).getAttribute('aria-checked')) === 'true', 'a locked bird was selected');
    await azure.click();
    assert((await azure.getAttribute('aria-checked')) === 'true', 'Azure was not selected');
    await page.reload();
    assert((await stored(page, SETTINGS_KEY))?.skin === 'azure', 'the chosen bird was not saved');
    await page.getByRole('button', { name: 'Settings' }).click();
    assert((await page.getByRole('radio', { name: 'Azure' }).getAttribute('aria-checked')) === 'true', 'Azure was not remembered');
  });

  await test('sound can be muted with M during play and stays muted after a reload', {}, async (page) => {
    await page.getByRole('button', { name: /Play level 1/ }).click();
    await page.getByRole('button', { name: 'Mute sound' }).waitFor();
    await page.keyboard.press('KeyM');
    await page.getByRole('button', { name: 'Turn sound on' }).waitFor();
    assert((await stored(page, SETTINGS_KEY))?.sfx === false, 'muting was not saved');
    await page.reload();
    await page.getByRole('button', { name: 'Turn sound on' }).waitFor();
  });

  await test('Reset progress asks twice, then wipes progress and relocks the levels', {
    seed: progress([1, 2, 3], 12),
  }, async (page) => {
    await page.getByRole('button', { name: /Play level 4/ }).waitFor();
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Reset progress' }).click();
    assert((await stored(page, PROGRESS_KEY)) !== null, 'progress must survive the first tap');
    await page.getByRole('button', { name: 'Tap again to erase all progress' }).click();
    await page.getByRole('button', { name: /Play level 1/ }).waitFor();
    assert((await stored(page, PROGRESS_KEY)) === null, 'progress was not erased');
    await page.getByRole('button', { name: 'Levels' }).click();
    assert((await page.locator('.level').nth(1).getAttribute('aria-disabled')) === 'true', 'level 2 should be locked again');
  });
}

async function resilienceTests() {
  await test('corrupted saved data is ignored instead of breaking the game', {
    init: {
      fn: () => {
        localStorage.setItem('skyhop.v2.settings', '{not json');
        localStorage.setItem('skyhop.v2.progress', '{"completed":"x","bestEndless":-5,"lastLevel":99}');
      },
    },
  }, async (page) => {
    await page.getByRole('button', { name: /Play level 1/ }).waitFor();
    await page.getByRole('button', { name: 'Levels' }).click();
    assert((await page.locator('.level').nth(1).getAttribute('aria-disabled')) === 'true', 'bad data must not unlock levels');
  });

  await test('blocked storage still plays, and the menu says progress cannot be saved', {
    init: {
      fn: () => Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('denied', 'SecurityError');
        },
      }),
    },
  }, async (page) => {
    await page.locator('.notice', { hasText: 'Progress cannot be saved' }).waitFor();
    await page.getByRole('button', { name: /Play level 1/ }).click();
    await page.locator('.hud').waitFor({ state: 'visible' });
  });

  await test('losing the WebGL context shows a reload screen, and restoring it clears it', {
    ignore: [/webgl/i, /context/i],
  }, async (page) => {
    await page.getByRole('button', { name: /Play level 1/ }).waitFor();
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
      window.__lose = gl.getExtension('WEBGL_lose_context');
      window.__lose.loseContext();
    });
    await page.getByRole('heading', { name: 'The sky is unavailable' }).waitFor();
    await page.getByRole('button', { name: 'Reload' }).waitFor();
    await page.evaluate(() => window.__lose.restoreContext());
    await page.getByRole('heading', { name: 'The sky is unavailable' }).waitFor({ state: 'detached' });
  });
}

async function contentTests() {
  await test('endless mode starts from the menu with its own label and no goal bar', {}, async (page) => {
    await page.getByRole('button', { name: 'Endless' }).click();
    await page.locator('.pill__label', { hasText: 'Endless' }).waitFor();
    await page.locator('.hint--play', { hasText: 'flap' }).waitFor();
    assert(await page.locator('.progress').isHidden(), 'endless mode has no level goal, so no progress bar');
  });

  await test('the page declares a title, a phone viewport and the theme colour', {}, async (page) => {
    assert((await page.title()) === 'SkyHop', `unexpected title ${await page.title()}`);
    assert(/viewport-fit=cover/.test(await page.locator('meta[name=viewport]').getAttribute('content')), 'viewport-fit=cover missing');
    assert((await page.locator('meta[name=theme-color]').getAttribute('content')) === '#7cc4ff', 'theme colour changed');
  });

  await test('the production bundle ships without the debug hook', {}, async (page) => {
    await page.getByRole('button', { name: /Play level 1/ }).waitFor();
    assert((await page.evaluate(() => typeof window.__skyhop)) === 'undefined', 'window.__skyhop must not exist in production');
  }, { prodOnly: true });
}

export async function runExtraTests() {
  await mobileTests();
  await persistenceTests();
  await resilienceTests();
  await contentTests();
}
