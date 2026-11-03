/**
 * Renders the SkyHop launcher icons from the shared bird art in bird-art.mjs:
 *   - legacy square and round icons (Android 7.x and launchers that ignore adaptive icons),
 *   - the adaptive icon as two layers, bird and sky, which launchers move against each other (parallax) on touch,
 *   - a 512 px preview for the README.
 *
 *   npm run android:icons
 *
 * Android launcher icons cannot animate; the animated parts are the launch splash
 * (res/drawable/splash_bird_animated.xml) and the README banner (npm run docs:banner). It drives the installed Edge or
 * Chrome through playwright-core, so there is no image library to install. Set SKYHOP_BROWSER to a Chromium executable
 * if neither browser is found.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BIRD, SKY, SKY_SCENE } from './bird-art.mjs';

const { chromium } = createRequire(import.meta.url)('playwright-core');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const res = join(root, 'android', 'app', 'src', 'main', 'res');

/** Legacy icon size and adaptive-layer size (px) for each Android density bucket. */
const DENSITIES = [
  { name: 'mdpi', legacy: 48, layer: 108 },
  { name: 'hdpi', legacy: 72, layer: 162 },
  { name: 'xhdpi', legacy: 96, layer: 216 },
  { name: 'xxhdpi', legacy: 144, layer: 324 },
  { name: 'xxxhdpi', legacy: 192, layer: 432 },
];

const LEGACY_VIEWBOX = '10 10 88 88';
const CLIPS = {
  // The legacy icons crop the canvas to 10..98, so the rounded shapes are sized to that crop.
  round: '<circle cx="54" cy="54" r="44"/>',
  square: '<rect x="10" y="10" width="88" height="88" rx="20"/>',
};

/** @param {'foreground' | 'sky' | 'square' | 'round'} shape */
function iconSvg(shape) {
  const layer = shape === 'foreground' || shape === 'sky';
  const viewBox = layer ? '0 0 108 108' : LEGACY_VIEWBOX;
  let body = BIRD;
  if (shape === 'sky') body = SKY_SCENE;
  else if (!layer) body = `<clipPath id="shape">${CLIPS[shape]}</clipPath><g clip-path="url(#shape)">${SKY_SCENE}</g>${BIRD}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%">${body}</svg>`;
}

async function launch() {
  const candidates = process.env.SKYHOP_BROWSER
    ? [{ executablePath: process.env.SKYHOP_BROWSER }]
    : [{ channel: 'msedge' }, { channel: 'chrome' }];
  for (const candidate of candidates) {
    try {
      return await chromium.launch({ headless: true, ...candidate });
    } catch {
      /* try the next browser */
    }
  }
  throw new Error('No Chromium-based browser found. Set SKYHOP_BROWSER to its executable path.');
}

async function render(page, svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${svg}`);
  await page.screenshot({ path: file, omitBackground: true });
}

const browser = await launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const d of DENSITIES) {
  const dir = join(res, `mipmap-${d.name}`);
  mkdirSync(dir, { recursive: true });
  await render(page, iconSvg('square'), d.legacy, join(dir, 'ic_launcher.png'));
  await render(page, iconSvg('round'), d.legacy, join(dir, 'ic_launcher_round.png'));
  await render(page, iconSvg('foreground'), d.layer, join(dir, 'ic_launcher_foreground.png'));
  await render(page, iconSvg('sky'), d.layer, join(dir, 'ic_launcher_sky.png'));
}
const preview = join(root, 'docs', 'screenshots', 'app-icon.png');
await render(page, iconSvg('square'), 512, preview);
// The splash screen and the launch window use the sky colour; the adaptive icon uses the sky layer above.
writeFileSync(
  join(res, 'values', 'ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${SKY.top}</color>\n</resources>\n`,
);
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_sky"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
  writeFileSync(join(res, 'mipmap-anydpi-v26', name), adaptive);
}
await browser.close();
process.stdout.write(`Icons written to ${res}\nPreview: ${preview}\n`);
