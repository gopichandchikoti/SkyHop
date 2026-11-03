/**
 * Writes docs/skyhop-banner.svg: the bird flapping through scrolling pipes under drifting clouds. Pure SVG with CSS
 * animation (GitHub shows it animated inside README images), and it stops moving for people who prefer reduced motion.
 *
 *   npm run docs:banner
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BIRD, INK, SKY } from './bird-art.mjs';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'skyhop-banner.svg');
const PIPE = '#4ccd5e';
const PIPE_LIGHT = '#8af08c';

/** One pipe pair with the opening between y = 92 and y = 192, drawn at x = 0 and moved by CSS. */
function pipePair(className, startX) {
  const body = (y, height) =>
    `<rect x="0" y="${y}" width="72" height="${height}" rx="5" fill="${PIPE}" stroke="${INK}" stroke-width="4"/>` +
    `<rect x="10" y="${y}" width="9" height="${height}" fill="${PIPE_LIGHT}" opacity="0.7"/>`;
  const cap = (y) =>
    `<rect x="-8" y="${y}" width="88" height="24" rx="6" fill="${PIPE}" stroke="${INK}" stroke-width="4"/>`;
  return `<g class="${className}" style="transform:translateX(${startX}px)">` +
    `${body(-10, 102)}${cap(70)}${body(192, 100)}${cap(190)}</g>`;
}

const cloud = (className, x, y, scale) =>
  `<g class="cloud ${className}" style="transform:translate(${x}px,${y}px) scale(${scale})" fill="#fff" opacity="0.93">` +
  '<ellipse cx="0" cy="0" rx="46" ry="14"/><ellipse cx="22" cy="-12" rx="26" ry="18"/>' +
  '<ellipse cx="-20" cy="-8" rx="20" ry="14"/></g>';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 280" width="960" height="280" role="img"
  aria-labelledby="title desc">
  <title id="title">SkyHop</title>
  <desc id="desc">A coral bird flaps between green pipes under drifting clouds.</desc>
  <style>
    .cloud { animation: drift 38s linear infinite; }
    .c2 { animation-duration: 52s; animation-delay: -20s; }
    .c3 { animation-duration: 45s; animation-delay: -33s; }
    .pipes { animation: scroll 8s linear infinite; }
    .pipes2 { animation-delay: -4s; }
    .bob { animation: bob 1.7s ease-in-out infinite; }
    .wing { transform-origin: 40px 56px; animation: flap 0.46s ease-in-out infinite alternate; }
    @keyframes drift { from { translate: -260px 0; } to { translate: 1240px 0; } }
    @keyframes scroll { from { translate: 0 0; } to { translate: -1000px 0; } }
    @keyframes bob { 0%, 100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-9px) rotate(3deg); } }
    @keyframes flap { from { transform: rotate(10deg); } to { transform: rotate(-26deg); } }
    @media (prefers-reduced-motion: reduce) { .cloud, .pipes, .bob, .wing { animation: none; } }
  </style>
  <defs>
    <linearGradient id="bannerSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${SKY.top}"/><stop offset="1" stop-color="${SKY.bottom}"/>
    </linearGradient>
    <radialGradient id="bannerSun"><stop offset="0.4" stop-color="#fff6c8"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="960" height="280" fill="url(#bannerSky)"/>
  <circle cx="800" cy="70" r="70" fill="url(#bannerSun)"/><circle cx="800" cy="70" r="30" fill="#fff1b8"/>
  ${cloud('c1', 140, 60, 1)}${cloud('c2', 520, 40, 0.8)}${cloud('c3', 760, 120, 1.1)}
  <path d="M0 232 Q200 190 420 226 T960 214 V280 H0 Z" fill="#9bd6c6"/>
  <path d="M0 256 Q260 232 520 254 T960 248 V280 H0 Z" fill="#86e05a"/>
  ${pipePair('pipes', 560)}${pipePair('pipes pipes2', 560)}
  <g transform="translate(110 45) scale(1.7)"><g class="bob">${BIRD}</g></g>
</svg>
`;

writeFileSync(out, svg);
process.stdout.write(`Banner written to ${out}\n`);
