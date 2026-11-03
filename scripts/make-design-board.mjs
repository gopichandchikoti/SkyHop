/**
 * Writes docs/design-system.svg: the UI colour tokens, the six sky themes, the four bird palettes and the sticker-style
 * button, read straight from src/ui/styles.css and src/render/themeData.ts so the picture cannot drift from the game.
 *
 *   npm run docs:design
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8').replace(/\r\n/g, '\n');
const themeSource = read('src', 'render', 'themeData.ts');
const cssSource = read('src', 'ui', 'styles.css');
const hex = (n) => `#${n}`;
const FONT = "Fredoka, 'Segoe UI', system-ui, sans-serif";

/** { name: { key: '#rrggbb' } } for every `name: { key: 0xrrggbb, ... }` block between two markers. */
function parseBlocks(startMarker, endMarker) {
  const start = themeSource.indexOf(startMarker);
  const end = themeSource.indexOf(endMarker, start);
  const section = `${themeSource.slice(start, end === -1 ? undefined : end)}\n`;
  const blocks = {};
  for (const match of section.matchAll(/^\s{2}(\w+): \{([\s\S]*?)\},?\n/gm)) {
    blocks[match[1]] = Object.fromEntries(
      Array.from(match[2].matchAll(/(\w+): 0x([0-9a-fA-F]{6})/g), (m) => [m[1], hex(m[2].toLowerCase())]),
    );
  }
  return blocks;
}

const themes = parseBlocks('export const THEMES', 'export interface SkinPalette');
const skins = parseBlocks('export const SKIN_PALETTES', '\n};\n');
const rootBlock = /:root\s*\{([\s\S]*?)\n\}/.exec(cssSource)?.[1] ?? '';
const TOKEN = /--([\w-]+):\s*(#[0-9a-fA-F]{3,6});/g;
const tokens = Array.from(rootBlock.matchAll(TOKEN), (m) => ({ name: m[1], value: m[2] }));
const INK = tokens.find((t) => t.name === 'ink')?.value ?? '#1b1f3b';
const PAPER = tokens.find((t) => t.name === 'paper')?.value ?? '#fffaf0';

/** SVG text; `attrs` carries the size and any extra attributes, which keeps the helper within four parameters. */
const text = (x, y, content, attrs) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" fill="${INK}" ${attrs}>${content}</text>`;
const LABEL = 'font-size="15" font-weight="600"';
const NOTE = 'font-size="15" opacity="0.7"';

function tokenRow() {
  return tokens.map((t, i) => {
    const x = 40 + i * 128;
    return `<rect x="${x}" y="96" width="112" height="64" rx="12" fill="${t.value}" stroke="${INK}" stroke-width="3"/>` +
      text(x, 184, `--${t.name}`, LABEL) + text(x, 204, t.value, 'font-size="14" opacity="0.7"');
  }).join('');
}

function themeRow() {
  return Object.entries(themes).map(([name, colours], i) => {
    const x = 40 + i * 150;
    return `<defs><linearGradient id="t-${name}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${colours.skyTop}"/>` +
      `<stop offset="1" stop-color="${colours.skyHorizon}"/></linearGradient></defs>` +
      `<rect x="${x}" y="272" width="134" height="150" rx="14" fill="url(#t-${name})" stroke="${INK}" stroke-width="3"/>` +
      `<path d="M${x} 392 Q${x + 60} 368 ${x + 134} 388 V408 Q${x + 134} 422 ${x + 120} 422 H${x + 14} Q${x} 422 ${x} 408 Z" fill="${colours.grassA}"/>` +
      `<rect x="${x + 52}" y="330" width="30" height="62" rx="4" fill="${colours.pipe}" stroke="${INK}" stroke-width="3"/>` +
      `<circle cx="${x + 108}" cy="298" r="10" fill="${colours.sun}"/>` +
      text(x, 446, name, LABEL);
  }).join('');
}

function birdRow() {
  return Object.entries(skins).map(([name, c], i) => {
    const x = 50 + i * 160;
    return `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round">` +
      `<circle cx="${x + 40}" cy="578" r="36" fill="${c.body}"/><ellipse cx="${x + 36}" cy="592" rx="20" ry="11" fill="${c.belly}" stroke="none"/>` +
      `<path d="M${x + 14} 574 C${x + 20} 560 ${x + 44} 562 ${x + 46} 580 C${x + 38} 592 ${x + 20} 590 ${x + 14} 574 Z" fill="${c.wing}"/>` +
      `<path d="M${x + 36} 546 L${x + 33} 532 L${x + 41} 541 L${x + 45} 530 L${x + 47} 546 Z" fill="${c.accent}" stroke-width="2.5"/>` +
      `<path d="M${x + 74} 574 L${x + 94} 580 L${x + 74} 588 Z" fill="${c.beak}"/>` +
      `<circle cx="${x + 52}" cy="566" r="10" fill="#fff" stroke-width="2.5"/><circle cx="${x + 55}" cy="566" r="4.5" fill="#14172b" stroke="none"/></g>` +
      text(x, 640, name, LABEL);
  }).join('');
}

const button = `<g transform="translate(690 520)">
  <rect x="0" y="6" width="230" height="62" rx="18" fill="${INK}"/>
  <rect x="0" y="0" width="230" height="62" rx="18" fill="#ffd23f" stroke="${INK}" stroke-width="3.5"/>
  ${text(115, 40, 'Play level 1', 'font-size="24" text-anchor="middle" font-weight="700"')}
  <rect x="0" y="92" width="108" height="50" rx="16" fill="${INK}" transform="translate(0 5)"/>
  <rect x="0" y="92" width="108" height="50" rx="16" fill="${PAPER}" stroke="${INK}" stroke-width="3"/>
  ${text(54, 124, 'Levels', 'font-size="18" text-anchor="middle" font-weight="600"')}
</g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 680" width="960" height="680" role="img"
  aria-labelledby="t d"><title id="t">SkyHop design system</title>
  <desc id="d">UI colour tokens, six sky themes, four bird palettes and the sticker-style buttons.</desc>
  <rect width="960" height="680" fill="${PAPER}"/>
  ${text(40, 52, 'SkyHop design system: sticker arcade', 'font-size="30" font-weight="700"')}
  ${text(40, 80, 'UI tokens (src/ui/styles.css)', NOTE)}
  ${tokenRow()}
  ${text(40, 252, 'Sky themes, one per group of levels (src/render/themeData.ts)', NOTE)}
  ${themeRow()}
  ${text(40, 500, 'Birds, unlocked by completing levels 3, 6 and 10', NOTE)}
  ${birdRow()}
  ${text(690, 500, 'Chunky outlined, pressable buttons', NOTE)}
  ${button}
</svg>
`;

writeFileSync(join(root, 'docs', 'design-system.svg'), svg);
process.stdout.write(`Design board written: ${tokens.length} tokens, ${Object.keys(themes).length} themes, ${Object.keys(skins).length} birds\n`);
