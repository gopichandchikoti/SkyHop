# SkyHop — Original Tap-to-Fly Game for Browser & Android

**Type:** Agent-ready application development specification  
**Companion:** `UNIVERSAL_APPLICATION_AGENT_RULEBOOK.md`  
**Objective:** Build a real, installable or deployable product, not a static prototype.

Create an original **tap-to-fly side-scrolling arcade game**, mechanically inspired by simple obstacle-dodging games. It must run in desktop/mobile browsers and be packaged as an **Android APK**. Do not copy Flappy Bird's name, sprite art, sound effects, exact level layouts or branding. Use original artwork and gameplay tuning.

## A. Agent execution contract and universal standards

**Read the user's `UNIVERSAL_APPLICATION_AGENT_RULEBOOK.md` first**, then this application specification. The universal rulebook governs design research (including approved sites such as Godly, recent.design, 21st.dev, Realtime Colors, Fontshare, Lenis, Motion, React Spring and component references), accessibility, secure engineering, coding style, testing, observability, documentation, and honest verification. **Do not copy or embed the universal rulebook**; keep it as a separate source of truth. Where this document narrows the platform, deliverable or technology, follow this specification. Where instructions conflict, explain the conflict and request a decision rather than silently weakening safety, licensing, quality or acceptance criteria.

Before implementation: inspect the repository and installed tools; preserve user changes; write a short plan, acceptance criteria, architecture decision record (ADR), and one falsifiable hypothesis plus a focused executable check. Research at least three suitable design references if browsing is available; record actual URLs, date checked, suitability, licensing, and a unique original visual direction. If unavailable, record the limitation and proceed with a defensible design—not a claim of verified research. Avoid fake metrics, nonfunctional buttons, template dashboards, stock-only content and generic AI-looking layouts. Use real behavior and authentic states.

**Code gates (policy):** 120-character maximum source lines; cognitive complexity <=15, cyclomatic complexity <=10, control nesting <=3, functions target <=50 logical lines, files target <=300 lines and split before 400; <=3% new-code duplication; >=90% coverage for lines/branches/functions/statements where measurable, >=95% for critical security or financial/state-transition modules. Enforce with appropriate platform tools and document exceptions; coverage alone does not prove correctness. No hard-coded secrets, unchecked async work, broad suppression, dead code or silent errors. Run formatting, lint/static analysis, type checks where applicable, focused tests, full tests, build, security/dependency checks, and real runtime/UI checks. Report exact commands, results and skipped checks. Do not claim success without execution.

**Accessibility and performance:** WCAG 2.2 AA target for applicable UIs; semantic controls, keyboard, screen-reader labels, visible focus, reduced motion, responsive layouts, touch targets, loading/empty/error/retry/success states, and practical performance budgets. For games, make accessibility options relevant to gameplay (rebindable controls, contrast, audio toggles, pause and reduced effects). Use animation libraries only when justified; smooth scrolling (e.g. Lenis) is not appropriate for every product and must not disrupt native scrolling or accessibility.

**Engineering:** keep UI, domain rules, infrastructure, adapters and persistence separate; validate all external inputs; least-privilege authorization when accounts exist; dependency/secret scanning; structured privacy-safe logs and correlation IDs where networked; secure default configuration; migrations, backups and rollback where persistent server data exists. Test edge cases and failure recovery. Never ship development mocks as production integrations. Do not commit, push, delete unrelated work or perform destructive migrations without explicit approval.

**Standard deliverables:** runnable source, README with exact setup commands, architecture rationale and diagram, relevant API/data contracts, tests and coverage configuration, CI pipeline, sample assets/seed data clearly marked, security/privacy notes, packaging/build instructions, troubleshooting, and a short demonstration checklist. Work in vertical milestones; each milestone must be usable and verified before expanding scope.


## B. Stack and why
- **Game:** TypeScript + Phaser 3 (verify current supported version before install), 2D renderer, deterministic game state machine and responsive viewport. Phaser is suitable for fast 2D browser game loops, collisions and input.
- **Browser build:** Vite, static deploy, keyboard/mouse/touch. **Android:** Capacitor wrapper with Android Studio/SDK/JDK/Gradle for APK build; Android WebView performance and safe-area testing. VS Code/Cursor can edit all code, but Android SDK/JDK/build tools are still required to produce an APK. A physical Android phone is strongly recommended for testing.
- **Persistence:** local storage/IndexedDB for settings, high score, unlocks. No backend needed for MVP. Optional leaderboard later requires server-side score validation and anti-cheat design.

## C. Gameplay specification
- Player controls a distinct original character (e.g. paper glider, robot, comet) with one-tap impulse and gravity. Obstacles move left at increasing speed; procedural gaps have fair min/max constraints; score increments only on passing a valid obstacle pair.
- States: BOOT -> MENU -> COUNTDOWN -> PLAYING -> HIT/DEATH -> RESULTS -> RESTART; PAUSED state on visibility loss, incoming call, app background or user pause. Never let an invisible browser tab keep progressing the game.
- Controls: Space/ArrowUp/tap to flap, Escape/P to pause, accessible buttons in menus. Provide muted audio by default until interaction where platform requires; music/sound controls and haptics opt-in.
- Modes: classic endless, practice with generous gaps, optional timed challenge. Progressive difficulty with a documented curve, seeded PRNG for reproducible tests, no impossible obstacle combinations.
- Progression: local high scores, achievements, unlockable cosmetic skins, game-over replay. Avoid dark-pattern ads or intrusive permissions.

## D. Art and UX
- Create an original art direction (e.g. illustrated paper-cut skies or minimalist neon aviation), sprite atlas, background parallax, UI typography and sound pack with valid licenses. Research polished arcade game references for feel, not copying.
- 60 FPS target on midrange devices where possible, fixed-step physics with delta-time handling, asset preloading, memory management, device-pixel-ratio cap, landscape/portrait strategy (portrait primary), safe areas and accessibility settings.
- Use Phaser tweens for score, death and transitions; avoid adding Lenis or a full React framework to the gameplay canvas without a product need. Menu may use HTML overlays if it improves accessibility.

## E. Architecture
```text
Input adapters (touch / keyboard / pointer)
        v
Game state machine -> Fixed-step physics -> Collision/scoring
        |                   |
        +---> Scene renderer / audio / effects
        +---> Settings & high-score repository
        +---> Platform bridge (web / Capacitor Android)
```
Separate physics and obstacle generation from rendering for unit tests. Keep score server-authoritative only if multiplayer/leaderboards are added.

## F. Build phases
1. Repo + Phaser/Vite scaffolding, original assets placeholder-to-final plan, tests and design ADR.
2. Complete browser gameplay: flap, gravity, obstacles, scoring, collisions, restart, pause, real persistence.
3. Difficulty, sound, visual polish, touch controls, accessible menu and performance profiling.
4. Capacitor Android project; configure package ID, icons, portrait orientation, safe areas; produce installable debug APK and install/test on device.
5. Release signing via user-controlled keystore, reproducible release APK/AAB instructions, privacy and store compliance if distribution is requested. Never include private signing keys in Git.

## G. Verification
- Verify collision boundaries, scoring once per obstacle, restart resets, pause/resume, speed independence across 30/60/120 Hz, browser resize, backgrounding, sound toggles and saved scores.
- Browser: desktop Chrome/Firefox/Edge and mobile Chrome; Android: actual device touch, back button, orientation, resume and sustained 15-minute play.
- Deliver playable hosted/static browser build instructions, APK generated on Windows with SDK installed, screenshots, controls, build commands and actual performance measurements. Do not claim APK exists until built.
