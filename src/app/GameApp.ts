import { Sfx } from '../audio/sfx';
import { FixedStepper } from '../core/clock';
import { PHYSICS } from '../core/config';
import type { Phase } from '../core/phase';
import { gapCenter } from '../core/pipes';
import { GameSession, type SessionMode } from '../core/session';
import type { SkinId } from '../core/skins';
import { InputController } from '../input/inputController';
import type { StageHandlers } from '../render/stage';
import type { WorldFrame } from '../render/world';
import { Repository, type Settings, type StorageLike } from '../storage/repository';
import { COPY } from '../ui/copy';
import { h } from '../ui/dom';
import type { UiActions } from '../ui/types';
import { Ui } from '../ui/ui';
import { PerformanceGovernor } from './governor';
import { GameLoop, type LoopDeps } from './loop';
import type { WorldPort } from './ports';
import { PhasePresenter } from './presenter';
import { Profile } from './profile';
import { Scheduler } from './scheduler';
import { ScrollTracker } from './scroll';

export type { WorldPort } from './ports';

export interface AppDeps {
  createWorld: (container: HTMLElement, handlers: StageHandlers) => WorldPort;
  storage: StorageLike | null;
  prefersReducedMotion?: boolean;
  devicePixelRatio?: number;
  seed?: number;
  sfx?: Sfx;
  loopDeps?: LoopDeps;
  vibrate?: (pattern: number) => void;
  reload?: () => void;
}

const AMBIENT_SPEED = 2.6;
const FROZEN: readonly Phase[] = ['paused', 'countdown'];

export interface AppSnapshot {
  phase: Phase;
  score: number;
  goal: number | null;
  level: number;
  birdY: number;
  birdVy: number;
  speed: number;
  pipes: Array<{ x: number; centre: number; gap: number; moving: boolean }>;
}

/** Wires the rules, 3D world, UI, input, audio and storage together and runs the frame loop. */
export class GameApp {
  readonly session: GameSession;
  readonly profile: Profile;
  private readonly ui: Ui;
  private readonly sfx: Sfx;
  private readonly input: InputController;
  private readonly loop: GameLoop;
  private readonly stepper = new FixedStepper();
  private readonly scroll = new ScrollTracker();
  private readonly scheduler = new Scheduler();
  private readonly governor: PerformanceGovernor;
  private readonly presenter: PhasePresenter;
  private readonly stage: HTMLElement;
  private world: WorldPort | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    root: HTMLElement,
    private readonly deps: AppDeps,
  ) {
    this.profile = new Profile(new Repository(deps.storage, deps.prefersReducedMotion ?? false), deps.storage !== null);
    this.session = new GameSession({ seed: deps.seed ?? Date.now(), assist: this.profile.settings.assist });
    this.sfx = deps.sfx ?? new Sfx(this.profile.settings.sfx);
    this.governor = new PerformanceGovernor(deps.devicePixelRatio ?? 1);
    this.stage = h('div', { id: 'stage' });
    root.prepend(this.stage);
    this.ui = new Ui(root, this.actions);
    this.ui.onOpen = (kind) => (kind === 'levels' ? this.openLevels() : this.openSettings());
    this.presenter = new PhasePresenter({
      session: this.session, profile: this.profile, ui: this.ui, sfx: this.sfx, scroll: this.scroll,
      scheduler: this.scheduler, world: () => this.world, vibrate: deps.vibrate,
    });
    this.input = new InputController(root, {
      primary: () => this.onPrimary(),
      pause: () => this.onPauseKey(),
      toggleSound: () => this.actions.toggleSound(),
    });
    this.loop = new GameLoop((dt) => this.frame(dt), deps.loopDeps);
  }

  start(): void {
    this.applyMotionPreference();
    this.session.on((event) => this.presenter.onEvent(event));
    this.session.flow.onChange((phase, previous) => {
      this.stepper.reset();
      this.presenter.onPhase(phase, previous);
    });
    this.ui.hud.setSound(this.profile.settings.sfx);
    if (!this.createWorld()) return;
    this.world?.setTheme(this.profile.nextLevel.theme, true);
    this.presenter.enterMenu();
    this.input.attach();
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.autoPause);
    this.observeResize();
    this.loop.start();
  }

  destroy(): void {
    this.loop.stop();
    this.input.detach();
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.autoPause);
    this.resizeObserver?.disconnect();
  }

  snapshot(): AppSnapshot {
    const { bird, level } = this.session;
    return {
      phase: this.session.flow.phase, score: this.session.score, goal: this.session.goal, level: level.id,
      birdY: bird.y, birdVy: bird.vy, speed: this.session.speed,
      pipes: this.session.pipes.map((pipe) => ({
        x: pipe.x, centre: gapCenter(pipe), gap: pipe.gap, moving: pipe.amplitude > 0,
      })),
    };
  }

  private createWorld(): boolean {
    try {
      this.world = this.deps.createWorld(this.stage, {
        onContextLost: () => {
          this.loop.stop();
          this.ui.showError(COPY.errorLost);
        },
        onContextRestored: () => {
          this.ui.closeModal(false);
          this.loop.start();
        },
      });
      this.world.setPixelRatio(this.governor.ratio);
      this.world.setSkin(this.profile.settings.skin);
      return true;
    } catch {
      this.ui.showError(COPY.errorWebgl);
      return false;
    }
  }

  private readonly actions: UiActions = {
    playLevel: (id) => this.begin({ kind: 'level', levelId: Math.min(id, this.profile.unlocked) }),
    playEndless: () => this.begin({ kind: 'endless' }),
    retry: () => this.begin(this.session.mode),
    nextLevel: () => this.begin({ kind: 'level', levelId: this.session.level.id + 1 }),
    toMenu: () => this.session.quit(),
    pause: () => this.session.flow.send('pause'),
    resume: () => this.session.flow.send('resume'),
    restartLevel: () => this.begin(this.session.mode),
    toggleSound: () => this.actions.setSetting('sfx', !this.profile.settings.sfx),
    setSetting: (key, value) => this.applySetting(key, value),
    resetProgress: () => this.resetProgress(),
    reload: () => (this.deps.reload ?? (() => window.location.reload()))(),
    clicked: () => {
      this.sfx.unlock();
      this.sfx.play('click');
    },
  };

  private begin(mode: SessionMode): void {
    this.sfx.unlock();
    this.session.assist = this.profile.settings.assist;
    this.session.begin(mode);
  }

  private onPrimary(): void {
    this.sfx.unlock();
    const phase = this.session.flow.phase;
    if (phase === 'menu' && !this.ui.modalOpen) this.begin({ kind: 'level', levelId: this.profile.unlocked });
    else if (phase === 'ready' || phase === 'playing') this.session.requestFlap();
  }

  private onPauseKey(): void {
    const phase = this.session.flow.phase;
    if (this.ui.modalOpen && phase === 'menu') this.ui.closeModal(true);
    else if (phase === 'paused') this.session.flow.send('resume');
    else this.session.flow.send('pause');
  }

  private readonly autoPause = (): void => {
    this.session.flow.send('pause');
  };

  private readonly onVisibility = (): void => {
    if (document.hidden) this.autoPause();
  };

  private applySetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.profile.setSetting(key, value);
    if (key === 'sfx') this.applySound(Boolean(value));
    if (key === 'assist') this.session.assist = Boolean(value);
    if (key === 'reducedMotion') this.applyMotionPreference();
    if (key === 'skin') this.world?.setSkin(value as SkinId);
  }

  private applySound(on: boolean): void {
    this.sfx.setEnabled(on);
    this.ui.hud.setSound(on);
    if (this.ui.currentMenu) this.ui.refreshMenu(this.presenter.menuView());
    if (on) this.actions.clicked();
  }

  private applyMotionPreference(): void {
    document.documentElement.dataset['motion'] = this.profile.settings.reducedMotion ? 'reduced' : 'full';
  }

  private resetProgress(): void {
    this.profile.reset();
    this.world?.setSkin(this.profile.settings.skin);
    this.ui.closeModal(true);
    this.ui.refreshMenu(this.presenter.menuView());
    this.ui.hud.announce(COPY.progressErased);
  }

  private openLevels(): void {
    this.ui.openLevels({ unlocked: this.profile.unlocked, completed: this.profile.completed });
  }

  private openSettings(): void {
    this.ui.openSettings({ settings: this.profile.settings, completed: this.profile.completed });
  }

  private observeResize(): void {
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', () => this.world?.resize());
      return;
    }
    this.resizeObserver = new ResizeObserver(() => this.world?.resize());
    this.resizeObserver.observe(this.stage);
  }

  private frame(rawDt: number): void {
    const world = this.world;
    if (!world) return;
    const ratio = this.governor.sample(rawDt);
    if (ratio !== null) world.setPixelRatio(ratio);
    const phase = this.session.flow.phase;
    const dt = Math.min(rawDt, PHYSICS.maxFrameDelta);
    const simDt = FROZEN.includes(phase) ? 0 : dt;
    if (phase === 'countdown') this.presenter.tickCountdown(dt);
    this.scheduler.advance(simDt);
    const steps = this.stepper.advance(simDt);
    for (let i = 0; i < steps; i++) this.session.step(PHYSICS.step);
    world.render(this.buildFrame(simDt));
  }

  private buildFrame(dt: number): WorldFrame {
    const { session } = this;
    const phase = session.flow.phase;
    const playing = phase === 'playing';
    const alpha = playing ? this.stepper.alpha : 0;
    const distance = session.distance + (playing ? session.speed * alpha * PHYSICS.step : 0);
    this.scroll.advance({ dt, phase, distance, ambientSpeed: AMBIENT_SPEED });
    const { bird } = session;
    return {
      phase, birdY: playing ? bird.prevY + (bird.y - bird.prevY) * alpha : bird.y, birdVy: bird.vy,
      pipes: session.pipes, speed: session.speed, alpha, scroll: this.scroll.scroll, time: this.scroll.time, dt,
      grounded: bird.touchingGround, reducedMotion: this.profile.settings.reducedMotion,
      revealPipes: phase !== 'menu',
    };
  }
}
