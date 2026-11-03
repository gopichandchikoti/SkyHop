# ADR-0001: Three.js for a 3D tap-to-fly game, and a "sticker arcade" visual direction

* **Status:** accepted
* **Date:** 2026-11-02
* **Deciders:** project owner (requested a 3D bird, levels and modern animation); implemented by the coding agent

## Context

The repository held a 56-line Phaser 2D stub: one white rectangle, no pipes, no sky, no scrolling, and a dev server on a
different port from the one requested. The owner asked for the "exact" flappy-style game with:

* a bird that flies, pipes above and below the gap, a scrolling sky;
* multiple levels, each harder than the last;
* a **3D bird** and the most modern animation we can justify;
* "tap to start" in any browser, running on `http://localhost:5605`.

`SPEC.md` named Phaser 3. Where the SPEC and an explicit request conflict, the request wins, and the conflict must be
visible. The stack change below is that conflict, made visible.

## Decision

Render the game with **Three.js** (WebGL). Keep everything else in the existing toolchain: TypeScript, Vite, Vitest and
Capacitor. Remove Phaser.

Game rules live in a separate pure-TypeScript core (fixed-step physics, seeded RNG, state machine), exactly as the SPEC's
architecture section asks, so the renderer is replaceable and the rules are unit-testable.

### Alternatives considered

| Option | Why not |
|---|---|
| Keep Phaser, fake 3D with shaded sprites | A bird drawn as sprites cannot rotate, tilt or squash convincingly in 3D, and every angle needs its own art. The request was for a 3D bird. |
| Phaser + a Three.js layer | Two render stacks and two loops for one scene, for no gain. The stub used almost none of Phaser. |
| Babylon.js / PlayCanvas | Larger, with editors and engines we do not need for one scene. Three.js is smaller and I can reason about it directly. |
| CSS 3D transforms | Poor lighting, no real depth, awkward at 60 fps. |

### Consequences

* (+) A real 3D bird (outline hull, lit materials, flap, squash and stretch, tilt) and natural parallax from a perspective
  camera. All art is procedural, so there are no asset files or licenses to track.
* (+) A pure core means 100% branch and line coverage across `src/core` and a bot that shows every level is clearable.
* (−) Three.js makes up most of the ~158 kB gzipped bundle, more than a minimal 2D canvas game would ship.
* (−) WebGL is required. Failure to create a context shows a clear error screen instead of a blank page.
* Exit strategy: because rules and rendering are separated by the `WorldPort` interface, swapping the renderer
  means re-implementing `WorldView` only.

## Design research (checked 2026-11-02)

The rulebook asks for a verified reference matrix. I fetched each site on this date; where a fetch returned little, that
is recorded. Nothing was copied from any of them.

| Reference | What I could observe | Verdict |
|---|---|---|
| godly.website | Redirects (301) to recent.design | Follow the redirect |
| recent.design | A mixed feed: poster series, 3D and distorted imagery, interaction micro-demos, serif display type. No usage terms on the page. | Inspiration for bold type and playful 3D only |
| realtimecolors.com | Five colour roles (text, background, primary, secondary, accent), AA/AAA contrast markers, advice to keep palettes small and follow 60-30-10 | **Adopted**: small semantic token set, with contrast checked by `axe-core` |
| fontshare.com | Pages returned only the tagline; licence terms could not be read | **Not used.** I will not rely on a licence I could not verify |
| @fontsource Fredoka (npm) | SIL OFL 1.1, self-hosted woff2, no external requests | **Used** for the UI face |
| motion.dev | Spring physics, vanilla JS usable from ~3.2 kB; the page says nothing on reduced motion | Not added. A 20-line damped spring (`render/spring.ts`) covers squash-and-stretch with no dependency and honors the reduce-motion setting |
| lenis.dev | Smooth *scrolling* | **Rejected**: the game has no scrolling page, so there is nothing to smooth |
| 21st.dev, ui.watermelon.sh | React + Tailwind component registries; no licence stated on the pages | Not used: wrong stack, and licences unverifiable |
| React Spring | Not fetched | Not applicable (no React) |
| Modulify, Motionin, Landdding, 60fps, Footer, Thinking Orbs, Paper Shaders, Archify, OmniRoute | Names appear without a verifiable canonical URL | **Not researched, and not relied on.** I did not invent findings about them |
| Flappy-style mechanics (Seeles guide) | Qualitative: big gaps and slow scroll first, then faster, then gentle moving obstacles with a cue; cap difficulty; reject unreachable layouts. No published original constants | **Adopted** as the level curve; all numbers are my own and tuned by simulation |

## Visual direction

Two directions were compared:

* **A. Sticker arcade (chosen).** A soft, lit 3D world with a dark-navy outline motif that runs from the bird's outline hull
  into chunky, pressable, outlined UI buttons and a rounded display face. Warm, readable, friendly, and it works in
  portrait and landscape.
* **B. Neon night minimal.** Dark, glowing and flat. Rejected: it makes the day-to-night level progression (a core part of
  "levels get harder") a smaller change, and glow-heavy UI is harder to keep accessible.

Six sky themes (meadow, noon, golden hour, dusk, night, aurora) are blended smoothly between levels. The bird, pipes and
UI keep their identity while the light changes.

Original art only: the bird, pipes and every effect are new, and nothing is taken from any existing game's sprites,
sounds or layouts (as `SPEC.md` requires).

## Falsifiable hypothesis and result

*Hypothesis:* "A simple autopilot can clear every generated level on every seed; if some layout is impossible, it will fail."

*Result:* It failed at first, which exposed two real problems: downward gap jumps were uncapped (gravity-limited), and the
first bot was too naive. The generator now caps both up and down jumps, and the bot looks ahead. Final check: 200 seeds ×
10 levels × normal and assist mode = **4,000 level runs, 0 failures**; the repository test runs 60 seeds per level.

## Risks and follow-ups

* Feel and sound have not been judged by a person. Physics constants are in `src/core/config.ts`.
* Android packaging is configured but unbuilt; Capacitor 8.x should be adopted at that milestone.
