import { describe, expect, it, vi } from 'vitest';
import type { WorldPort } from '../src/app/ports';
import { COUNTDOWN_SECONDS, PhasePresenter } from '../src/app/presenter';
import { Profile } from '../src/app/profile';
import { Scheduler } from '../src/app/scheduler';
import { ScrollTracker } from '../src/app/scroll';
import type { Sfx } from '../src/audio/sfx';
import { FIRST_MOVING_LEVEL, LEVEL_COUNT, getLevel } from '../src/core/levels';
import { GameSession } from '../src/core/session';
import { PROGRESS_KEY, Repository } from '../src/storage/repository';
import { COPY } from '../src/ui/copy';
import type { Ui } from '../src/ui/ui';
import { MemoryStorage } from './helpers/memory-storage';

/** A presenter over the real session, profile and scheduler, with the screen, sound and world faked. */
function rig(completed: number[] = [], withVibrate = true) {
  const storage = new MemoryStorage();
  storage.setItem(PROGRESS_KEY, JSON.stringify({ completed, bestEndless: 0, lastLevel: 1 }));
  const profile = new Profile(new Repository(storage), true);
  const session = new GameSession({ seed: 1, assist: false });
  const scheduler = new Scheduler();
  const hud = {
    setHint: vi.fn(), setVisible: vi.fn(), setLevel: vi.fn(), showBanner: vi.fn(), hideBanner: vi.fn(),
    announce: vi.fn(), setScore: vi.fn(), showCountdown: vi.fn(),
  };
  const ui = {
    hud, showMenu: vi.fn(), closeModal: vi.fn(), clearBase: vi.fn(), showPause: vi.fn(), showGameOver: vi.fn(),
    showLevelComplete: vi.fn(),
  };
  const sfx = { play: vi.fn() };
  const world = { reset: vi.fn(), setTheme: vi.fn(), handle: vi.fn() };
  const vibrate = vi.fn();
  const presenter = new PhasePresenter({
    session, profile, ui: ui as unknown as Ui, sfx: sfx as unknown as Sfx, scroll: new ScrollTracker(), scheduler,
    world: () => world as unknown as WorldPort, vibrate: withVibrate ? vibrate : undefined,
  });
  return { presenter, session, profile, scheduler, hud, ui, sfx, world, vibrate, storage };
}

const lastCall = (mock: ReturnType<typeof vi.fn>): unknown[] | undefined => mock.mock.calls[mock.mock.calls.length - 1];

describe('get ready', () => {
  it('explains sliding pipes on the first level that has them, and the flap hint everywhere else', () => {
    const r = rig();
    r.session.begin({ kind: 'level', levelId: FIRST_MOVING_LEVEL });
    r.presenter.onPhase('ready', 'menu');
    expect(lastCall(r.hud.setHint)).toEqual([COPY.slidingTip]);

    r.session.begin({ kind: 'level', levelId: 1 });
    r.presenter.onPhase('ready', 'menu');
    expect(lastCall(r.hud.setHint)).toEqual([COPY.flapHint]);
  });

  it('labels the HUD for a campaign level and for endless', () => {
    const r = rig();
    r.session.begin({ kind: 'level', levelId: 3 });
    r.presenter.onPhase('ready', 'menu');
    expect(lastCall(r.hud.setLevel)).toEqual([COPY.levelLabel(3), 'High Noon', 12]);

    r.session.begin({ kind: 'endless' });
    r.presenter.onPhase('ready', 'menu');
    expect(lastCall(r.hud.setLevel)).toEqual([COPY.endlessLabel, 'First Light', null]);
  });

  it('only restores the hint when returning from a countdown, and does not reset the world', () => {
    const r = rig();
    r.session.begin({ kind: 'level', levelId: 1 });
    r.presenter.onPhase('ready', 'countdown');
    expect(lastCall(r.hud.setHint)).toEqual([COPY.flapHint]);
    expect(r.world.reset).not.toHaveBeenCalled();
    expect(r.ui.clearBase).not.toHaveBeenCalled();
  });
});

describe('crashing', () => {
  it('clears the hint as soon as the bird is dying', () => {
    const r = rig();
    r.presenter.onPhase('dying', 'playing');
    expect(lastCall(r.hud.setHint)).toEqual([null]);
  });

  it('plays the hit sound and buzzes only when vibration is on and available', () => {
    const r = rig();
    r.presenter.onEvent({ type: 'crash', cause: 'pipe' });
    expect(r.sfx.play).toHaveBeenCalledWith('hit');
    expect(r.vibrate).not.toHaveBeenCalled();

    r.profile.setSetting('haptics', true);
    r.presenter.onEvent({ type: 'crash', cause: 'ground' });
    expect(r.vibrate).toHaveBeenCalledWith(40);
  });

  it('does not fail on devices without vibration support', () => {
    const r = rig([], false);
    r.profile.setSetting('haptics', true);
    expect(() => r.presenter.onEvent({ type: 'crash', cause: 'pipe' })).not.toThrow();
  });
});

describe('endless level-ups', () => {
  it('shows the new level with a theme change, and adds the sliding-pipe tip on level 5 only', () => {
    const r = rig();
    r.presenter.onEvent({ type: 'levelUp', level: getLevel(FIRST_MOVING_LEVEL) });
    const level5 = getLevel(FIRST_MOVING_LEVEL);
    expect(lastCall(r.hud.showBanner)).toEqual([COPY.levelLabel(5), `${level5.name} · ${COPY.slidingTip}`, 2400]);
    expect(r.world.setTheme).toHaveBeenCalledWith(level5.theme, false);
    expect(r.sfx.play).toHaveBeenCalledWith('levelUp');

    r.presenter.onEvent({ type: 'levelUp', level: getLevel(3) });
    expect(lastCall(r.hud.showBanner)).toEqual([COPY.levelLabel(3), getLevel(3).name, 2400]);
    expect(lastCall(r.hud.setLevel)).toEqual([COPY.endlessLabel, getLevel(3).name, null]);
  });
});

describe('level complete', () => {
  it('waits a moment, then shows the next level and any bird that was just unlocked', () => {
    const r = rig([1, 2]);
    r.session.begin({ kind: 'level', levelId: 3 });
    r.session.flow.force('levelComplete');
    r.presenter.onPhase('levelComplete', 'playing');
    expect(r.hud.announce).toHaveBeenCalledWith(COPY.announceComplete(3));

    r.scheduler.advance(0.5);
    expect(r.ui.showLevelComplete).not.toHaveBeenCalled();
    r.scheduler.advance(1);
    expect(r.ui.showLevelComplete).toHaveBeenCalledTimes(1);
    expect(lastCall(r.ui.showLevelComplete)?.[0]).toEqual({ level: getLevel(3), next: getLevel(4), newSkin: 'azure' });
    expect(r.profile.completed).toContain(3);
  });

  it('has no next level after the last one, and unlocks the final bird', () => {
    const r = rig([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    r.session.begin({ kind: 'level', levelId: LEVEL_COUNT });
    r.session.flow.force('levelComplete');
    r.presenter.onPhase('levelComplete', 'playing');
    r.scheduler.advance(2);
    expect(lastCall(r.ui.showLevelComplete)?.[0]).toEqual({ level: getLevel(LEVEL_COUNT), next: null, newSkin: 'gold' });
  });

  it('never shows the panel if the player has already left the level-complete screen', () => {
    const r = rig();
    r.session.begin({ kind: 'level', levelId: 1 });
    r.session.flow.force('levelComplete');
    r.presenter.onPhase('levelComplete', 'playing');
    r.session.quit();
    r.scheduler.advance(2);
    expect(r.ui.showLevelComplete).not.toHaveBeenCalled();
  });

  it('cancels a pending panel when the menu is shown again', () => {
    const r = rig();
    r.session.begin({ kind: 'level', levelId: 1 });
    r.session.flow.force('levelComplete');
    r.presenter.onPhase('levelComplete', 'playing');
    r.presenter.enterMenu();
    r.session.flow.force('levelComplete');
    r.scheduler.advance(2);
    expect(r.ui.showLevelComplete).not.toHaveBeenCalled();
  });
});

describe('game over', () => {
  it('records an endless best once, and does not call a lower score a best', () => {
    const r = rig();
    r.session.begin({ kind: 'endless' });
    r.session.score = 9;
    r.presenter.onPhase('gameOver', 'dying');
    expect(lastCall(r.ui.showGameOver)?.[0]).toMatchObject({ endless: true, score: 9, best: 9, isBest: true });
    expect(JSON.parse(r.storage.getItem(PROGRESS_KEY) ?? '{}').bestEndless).toBe(9);

    r.session.score = 4;
    r.presenter.onPhase('gameOver', 'dying');
    expect(lastCall(r.ui.showGameOver)?.[0]).toMatchObject({ score: 4, best: 9, isBest: false });
  });

  it('never touches the endless best after a campaign run', () => {
    const r = rig();
    r.session.begin({ kind: 'level', levelId: 2 });
    r.session.score = 5;
    r.presenter.onPhase('gameOver', 'dying');
    expect(lastCall(r.ui.showGameOver)?.[0]).toMatchObject({ endless: false, goal: 10, best: 0, isBest: false });
  });
});

describe('the 3-2-1 after resuming', () => {
  it('counts down once per number, then says go and continues the run', () => {
    const r = rig();
    r.session.begin({ kind: 'level', levelId: 1 });
    r.session.flow.send('pause');
    r.session.flow.send('resume');
    expect(r.session.flow.phase).toBe('countdown');
    r.presenter.onPhase('countdown', 'paused');

    r.presenter.tickCountdown(0.1);
    r.presenter.tickCountdown(0.1);
    r.presenter.tickCountdown(0.7);
    r.presenter.tickCountdown(0.7);
    expect(r.hud.showCountdown.mock.calls.map((call) => call[0])).toEqual(['3', '2', '1']);
    expect(r.sfx.play.mock.calls.filter((call) => call[0] === 'tick')).toHaveLength(3);

    r.presenter.tickCountdown(COUNTDOWN_SECONDS);
    expect(lastCall(r.hud.showCountdown)).toEqual([null]);
    expect(r.sfx.play).toHaveBeenCalledWith('go');
    expect(r.session.flow.phase).toBe('ready');
  });
});
