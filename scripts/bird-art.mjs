/**
 * The SkyHop bird and sky as SVG fragments on a 108 x 108 canvas, shared by the launcher icons, the animated README
 * banner and (hand-converted) the Android splash vector in android/app/src/main/res/drawable/splash_bird.xml.
 *
 * Colours come from the game itself: SKIN_PALETTES.coral and the bird parts in src/render. Everything important stays
 * inside the 66 px adaptive-icon safe zone (21..87).
 */
export const INK = '#1b1f3b';
export const SKY = { top: '#5fb2ff', bottom: '#c9ecff' };

const BODY = '#ff7a59';
const BELLY = '#ffe0c2';
const WING = '#ff5c3a';
const TEAL = '#2ec4b6';
const BEAK = '#ffb703';
const CHEEK = '#ff8fa3';

/** The bird, centred near (53, 56). The wing group is named so the banner can flap it. */
export const BIRD = `
  <g stroke="${INK}" stroke-linejoin="round" stroke-linecap="round">
    <defs>
      <linearGradient id="tail" gradientUnits="userSpaceOnUse" x1="19" y1="0" x2="34" y2="0">
        <stop offset="0.42" stop-color="${TEAL}"/><stop offset="0.42" stop-color="${WING}"/>
      </linearGradient>
    </defs>
    <path d="M50 35 L47 24 L53 31 L55 22 L58 32 L62 25 L61 37 Z" fill="${TEAL}" stroke-width="2.6"/>
    <path d="M34 49 L22 43 L27 53 L20 57 L27 61 L22 70 L34 64 Z" fill="url(#tail)" stroke-width="3"/>
    <circle cx="53" cy="56" r="23" fill="${BODY}" stroke-width="3.5"/>
    <ellipse cx="51" cy="65" rx="12" ry="6.5" fill="${BELLY}" stroke="none"/>
    <g class="wing"><path d="M36 54 C40 44 56 46 58 58 C52 66 40 66 36 54 Z" fill="${WING}" stroke-width="3"/></g>
    <circle cx="67" cy="60" r="3.6" fill="${CHEEK}" stroke="none" opacity="0.9"/>
    <circle cx="63" cy="49" r="7.5" fill="#fff" stroke-width="2.5"/>
    <circle cx="65.5" cy="49" r="3.4" fill="#14172b" stroke="none"/>
    <path d="M74 55 L88 59 L74 64 Z" fill="${BEAK}" stroke-width="3"/>
  </g>`;

const CLOUDS = `
  <g fill="#fff" opacity="0.94">
    <ellipse cx="25" cy="84" rx="14" ry="5"/><ellipse cx="33" cy="80" rx="8" ry="6"/>
    <ellipse cx="86" cy="40" rx="10" ry="4"/><ellipse cx="80" cy="37" rx="6" ry="4.5"/>
  </g>`;

/** Sky, sun, clouds and two meadow hills. Full bleed, so it also works as the adaptive-icon background layer. */
export const SKY_SCENE = `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${SKY.top}"/><stop offset="1" stop-color="${SKY.bottom}"/>
    </linearGradient>
    <radialGradient id="sun"><stop offset="0.4" stop-color="#fff6c8"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="108" height="108" fill="url(#sky)"/>
  <circle cx="84" cy="24" r="17" fill="url(#sun)"/><circle cx="84" cy="24" r="8" fill="#fff1b8"/>
  ${CLOUDS}
  <path d="M0 94 Q28 82 58 92 T108 88 V108 H0 Z" fill="#9bd6c6"/>
  <path d="M0 101 Q40 90 80 100 T108 98 V108 H0 Z" fill="#86e05a"/>`;
