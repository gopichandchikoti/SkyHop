import type { Sfx } from '../audio/sfx';
import { FIRST_MOVING_LEVEL, getLevel, type ThemeId } from '../core/levels';
import type { Phase } from '../core/phase';
import type { GameSession, SessionEvent } from '../core/session';
import { COPY } from '../ui/copy';
import type { GameOverView, LevelCompleteView, MenuView } from '../ui/types';
import type { Ui } from '../ui/ui';
import type { WorldPort } from './ports';
import type { Profile } from './profile';
import type { Scheduler } from './scheduler';
import type { ScrollTracker } from './scroll';

export const COUNTDOWN_SECONDS = 2.1;
const PANEL_DELAY = 1.15;
const HAPTIC_MS = 40;

export interface PresenterDeps {
  session: GameSession;
  profile: Profile;
  ui: Ui;
  sfx: Sfx;
  scroll: ScrollTracker;
  scheduler: Scheduler;
  world: () => WorldPort | null;
  vibrate?: (pattern: number) => void;
}

/** Turns game phases and events into what the player sees and hears: screens, HUD, sound and effects. */
export class PhasePresenter {
  private countdownLeft = 0;
  private countdownShown = '';

  constructor(private readonly d: PresenterDeps) {}

  menuView(): MenuView {
    const { profile } = this.d;
    return {
      nextLevel: profile.nextLevel, bestEndless: profile.progress.bestEndless, sfx: profile.settings.sfx,
      storageOk: profile.storageOk,
    };
  }

  onPhase(phase: Phase, previous: Phase): void {
    if (phase === 'menu') this.enterMenu();
    else if (phase === 'ready') this.enterReady(previous);
    else if (phase === 'playing') this.enterPlaying();
    else if (phase === 'paused') this.enterPaused();
    else if (phase === 'countdown') this.enterCountdown();
    else if (phase === 'dying') this.d.ui.hud.setHint(null);
    else if (phase === 'gameOver') this.showGameOver();
    else if (phase === 'levelComplete') this.enterComplete();
  }

  onEvent(event: SessionEvent): void {
    this.d.world()?.handle(event, this.d.profile.settings.reducedMotion);
    if (event.type === 'flap') this.d.sfx.play('flap');
    else if (event.type === 'score') this.onScore(event.score);
    else if (event.type === 'crash') this.onCrash();
    else if (event.type === 'levelUp') this.onLevelUp(event.level.id, event.level.name, event.level.theme);
    else if (event.type === 'complete') this.d.sfx.play('complete');
  }

  /** Drives the 3-2-1 shown after resuming. Uses real time so it keeps ticking while the world is frozen. */
  tickCountdown(dt: number): void {
    const { ui, sfx, session } = this.d;
    this.countdownLeft -= dt;
    if (this.countdownLeft <= 0) {
      ui.hud.showCountdown(null);
      sfx.play('go');
      session.flow.send('countdownDone');
      return;
    }
    const label = String(Math.ceil(this.countdownLeft / (COUNTDOWN_SECONDS / 3)));
    if (label === this.countdownShown) return;
    this.countdownShown = label;
    ui.hud.showCountdown(label);
    sfx.play('tick');
  }

  enterMenu(): void {
    const { ui, profile, scheduler } = this.d;
    scheduler.clear();
    this.d.world()?.reset();
    this.d.world()?.setTheme(profile.nextLevel.theme, false);
    ui.showMenu(this.menuView());
  }

  private enterReady(previous: Phase): void {
    const { ui, session, scroll, scheduler } = this.d;
    if (previous === 'countdown') {
      ui.hud.setHint(COPY.flapHint);
      return;
    }
    const { level, mode } = session;
    scheduler.clear();
    ui.closeModal(false);
    ui.clearBase();
    scroll.reset();
    this.d.world()?.reset();
    this.d.world()?.setTheme(level.theme, false);
    const label = mode.kind === 'endless' ? COPY.endlessLabel : COPY.levelLabel(level.id);
    ui.hud.setVisible(true);
    ui.hud.setLevel(label, level.name, session.goal);
    ui.hud.setHint(level.id === FIRST_MOVING_LEVEL ? COPY.slidingTip : COPY.flapHint);
    ui.hud.showBanner(label, level.name);
    ui.hud.announce(COPY.announceLevel(level.id, level.name));
    this.d.sfx.play('tick');
  }

  private enterPlaying(): void {
    this.d.ui.hud.setHint(null);
    this.d.ui.hud.hideBanner();
  }

  private enterPaused(): void {
    this.d.ui.showPause();
    this.d.ui.hud.announce(COPY.announcePaused);
  }

  private enterCountdown(): void {
    this.d.ui.closeModal(false);
    this.countdownLeft = COUNTDOWN_SECONDS;
    this.countdownShown = '';
  }

  private enterComplete(): void {
    const { session, profile, ui, scheduler } = this.d;
    const { level } = session;
    const newSkin = profile.completeLevel(level.id);
    ui.hud.announce(COPY.announceComplete(level.id));
    const view: LevelCompleteView = {
      level, next: profile.hasNextLevel(level.id) ? getLevel(level.id + 1) : null, newSkin,
    };
    scheduler.schedule(PANEL_DELAY, () => {
      if (session.flow.phase === 'levelComplete') ui.showLevelComplete(view);
    });
  }

  private showGameOver(): void {
    const { session, profile, ui } = this.d;
    const { mode, level, score } = session;
    const endless = mode.kind === 'endless';
    const isBest = endless ? profile.submitEndless(score) : false;
    const view: GameOverView = {
      endless, level, score, goal: session.goal, best: profile.progress.bestEndless, isBest,
    };
    ui.hud.announce(COPY.announceOver(score));
    ui.showGameOver(view);
  }

  private onScore(score: number): void {
    this.d.ui.hud.setScore(score, this.d.session.goal);
    this.d.sfx.play('score');
  }

  private onCrash(): void {
    this.d.sfx.play('hit');
    if (this.d.profile.settings.haptics) this.d.vibrate?.(HAPTIC_MS);
    this.d.ui.hud.setHint(null);
  }

  private onLevelUp(id: number, name: string, theme: ThemeId): void {
    const { ui, session } = this.d;
    this.d.world()?.setTheme(theme, false);
    ui.hud.setLevel(COPY.endlessLabel, name, null);
    ui.hud.setScore(session.score, null, false);
    const subtitle = id === FIRST_MOVING_LEVEL ? `${name} · ${COPY.slidingTip}` : name;
    ui.hud.showBanner(COPY.levelLabel(id), subtitle, 2400);
    this.d.sfx.play('levelUp');
  }
}
