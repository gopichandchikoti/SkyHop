// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLevel } from '../src/core/levels';
import { autopilotWantsFlap } from './helpers/autopilot';
import { MemoryStorage } from './helpers/memory-storage';

import { setup, type Rig } from './helpers/app-rig';

const press = (code: string): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
};

const button = (text: string): HTMLElement => {
  const found = Array.from(document.querySelectorAll<HTMLElement>('button')).find((b) =>
    (b.textContent ?? '').includes(text) || (b.getAttribute('aria-label') ?? '').includes(text));
  if (!found) throw new Error(`no button "${text}"`);
  return found;
};

const lastRender = () => {
  const calls = rig.world.render.mock.calls;
  return calls[calls.length - 1]?.[0];
};

const heading = (): string => document.querySelector('[role=dialog] h2')?.textContent ?? '';

function runFrames(rig: Rig, seconds: number, bot = false): void {
  const count = Math.round(seconds * 60);
  for (let i = 0; i < count; i++) {
    if (bot && rig.app.session.flow.phase === 'playing' && autopilotWantsFlap(rig.app.session)) press('Space');
    rig.frames.tick(1 / 60);
  }
}

function runUntil(rig: Rig, done: () => boolean, maxSeconds: number, bot = true): void {
  for (let i = 0; i < maxSeconds * 60 && !done(); i++) {
    if (bot && rig.app.session.flow.phase === 'playing' && autopilotWantsFlap(rig.app.session)) press('Space');
    rig.frames.tick(1 / 60);
  }
}

let rig: Rig;
beforeEach(() => {
  rig = setup();
});
afterEach(() => {
  rig.app.destroy();
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  delete (window as unknown as { ResizeObserver?: unknown }).ResizeObserver;
});

describe('start-up and menu', () => {
  it('shows the menu over a running 3D world', () => {
    expect(document.querySelector('h1')?.textContent).toBe('SkyHop');
    expect(rig.app.session.flow.phase).toBe('menu');
    expect(rig.world.setTheme).toHaveBeenCalledWith('meadow', true);
    expect(rig.world.setSkin).toHaveBeenCalledWith('coral');
    expect(rig.world.render).toHaveBeenCalled();
    expect(rig.frames.running).toBe(true);
    expect(document.documentElement.dataset['motion']).toBe('full');
  });

  it('starts level 1 on a tap or Space anywhere', () => {
    press('Space');
    expect(rig.app.session.flow.phase).toBe('ready');
    expect(rig.app.session.mode).toEqual({ kind: 'level', levelId: 1 });
    expect(rig.sfx.unlock).toHaveBeenCalled();
    expect((document.querySelector('.hud') as HTMLElement).hidden).toBe(false);
    expect(document.querySelector('.pill__name')?.textContent).toBe('First Light');
    expect(document.querySelector('.hint--play')?.textContent).toContain('flap');
    expect(rig.world.reset).toHaveBeenCalled();
  });

  it('starts from the Play button too, and never behind an open dialog', () => {
    button('Levels').click();
    expect(heading()).toBe('Choose a level');
    press('Space');
    expect(rig.app.session.flow.phase).toBe('menu');
    press('Escape');
    expect(document.querySelector('[role=dialog]')).toBeNull();
    button('Play level 1').click();
    expect(rig.app.session.flow.phase).toBe('ready');
  });

  it('exposes a state snapshot for debugging and tests', () => {
    expect(rig.app.snapshot().pipes).toEqual([]);
    press('Space');
    const snap = rig.app.snapshot();
    expect(snap.phase).toBe('ready');
    expect(snap.level).toBe(1);
    expect(snap.pipes.length).toBeGreaterThan(0);
    expect(snap.pipes[0]).toEqual(expect.objectContaining({ moving: false }));
  });
});

describe('a run', () => {
  it('waits for the first flap, then scrolls and scores like the real game', () => {
    press('Space');
    runFrames(rig, 1);
    expect(rig.app.session.flow.phase).toBe('ready');
    expect(rig.app.session.bird.y).toBe(7);
    press('Space');
    runFrames(rig, 0.3);
    expect(rig.app.session.flow.phase).toBe('playing');
    expect(rig.sfx.play).toHaveBeenCalledWith('flap');
    expect(document.querySelector('.hint--play')?.hasAttribute('hidden')).toBe(true);
    const last = lastRender();
    expect(last.phase).toBe('playing');
    expect(last.scroll).toBeGreaterThan(0);
    expect(last.revealPipes).toBe(true);
  });

  it('clears level 1 with an autopilot, saves progress and offers the next level', () => {
    press('Space');
    press('Space');
    runUntil(rig, () => rig.app.session.flow.phase === 'levelComplete', 60);
    expect(rig.app.session.score).toBe(getLevel(1).goal);
    expect(document.querySelector('.score')?.textContent).toBe(String(getLevel(1).goal));
    runFrames(rig, 1.5);
    expect(heading()).toBe('Level complete!');
    expect(rig.sfx.play).toHaveBeenCalledWith('score');
    expect(rig.sfx.play).toHaveBeenCalledWith('complete');
    expect(rig.app.profile.completed).toEqual([1]);
    expect(JSON.parse(rig.storage?.getItem('skyhop.v2.progress') ?? '{}').completed).toEqual([1]);

    button('Next level').click();
    expect(rig.app.session.mode).toEqual({ kind: 'level', levelId: 2 });
    expect(document.querySelector('.pill__label')?.textContent).toBe('Level 2');
    expect(rig.world.setTheme).toHaveBeenCalledWith('noon', false);
  });

  it('crashes, shows game over and restarts cleanly', () => {
    press('Space');
    press('Space');
    runFrames(rig, 4);
    expect(rig.app.session.flow.phase).toBe('gameOver');
    expect(heading()).toBe('Crash!');
    expect(rig.sfx.play).toHaveBeenCalledWith('hit');
    expect(rig.world.handle).toHaveBeenCalledWith(expect.objectContaining({ type: 'crash' }), false);
    press('Space');
    expect(rig.app.session.flow.phase).toBe('gameOver');
    button('Try again').click();
    expect(rig.app.session.flow.phase).toBe('ready');
    expect(document.querySelector('[role=dialog]')).toBeNull();
    expect(document.querySelector('.score')?.textContent).toBe('0');
  });

  it('can return to the menu from game over', () => {
    press('Space');
    press('Space');
    runFrames(rig, 4);
    button('Main menu').click();
    expect(rig.app.session.flow.phase).toBe('menu');
    expect(document.querySelector('.menu')).not.toBeNull();
    expect(rig.world.setTheme).toHaveBeenLastCalledWith('meadow', false);
  });

  it('vibrates on a crash only when the player opted in', () => {
    press('Space');
    press('Space');
    runFrames(rig, 4);
    expect(rig.vibrate).not.toHaveBeenCalled();
    button('Main menu').click();
    button('Settings').click();
    (document.querySelector('[aria-labelledby="sw-vibration"]') as HTMLElement).click();
    press('Escape');
    press('Space');
    press('Space');
    runFrames(rig, 4);
    expect(rig.vibrate).toHaveBeenCalledWith(40);
  });
});

describe('pause', () => {
  function startRun(): void {
    press('Space');
    press('Space');
    runFrames(rig, 0.3);
  }

  it('freezes everything, then counts down and resumes', () => {
    startRun();
    press('Escape');
    expect(heading()).toBe('Paused');
    const frozen = rig.app.snapshot();
    runFrames(rig, 1);
    expect(rig.app.snapshot().birdY).toBe(frozen.birdY);
    expect(rig.app.snapshot().pipes[0]?.x).toBe(frozen.pipes[0]?.x);
    expect(lastRender().dt).toBe(0);

    button('Resume').click();
    expect(rig.app.session.flow.phase).toBe('countdown');
    runFrames(rig, 0.2);
    expect((document.querySelector('.countdown') as HTMLElement).textContent).toBe('3');
    runFrames(rig, 2.5);
    expect(rig.app.session.flow.phase).toBe('playing');
    expect((document.querySelector('.countdown') as HTMLElement).hidden).toBe(true);
    expect(rig.sfx.play).toHaveBeenCalledWith('go');
  });

  it('toggles with Escape and restarts or quits from the dialog', () => {
    startRun();
    press('Escape');
    press('Escape');
    expect(rig.app.session.flow.phase).toBe('countdown');
    press('Escape');
    expect(rig.app.session.flow.phase).toBe('paused');
    button('Restart level').click();
    expect(rig.app.session.flow.phase).toBe('ready');
    press('Escape');
    button('Main menu').click();
    expect(rig.app.session.flow.phase).toBe('menu');
  });

  it('can be paused before the first flap and returns to Get Ready', () => {
    press('Space');
    press('Escape');
    expect(heading()).toBe('Paused');
    button('Resume').click();
    runFrames(rig, 2.5);
    expect(rig.app.session.flow.phase).toBe('ready');
    expect(document.querySelector('.hint--play')?.hasAttribute('hidden')).toBe(false);
    expect(document.querySelector('.hint--play')?.textContent).toContain('flap');
  });

  it('pauses by itself when the tab is hidden or the window loses focus', () => {
    startRun();
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(rig.app.session.flow.phase).toBe('paused');
    button('Resume').click();
    runFrames(rig, 2.5);
    expect(rig.app.session.flow.phase).toBe('playing');
    window.dispatchEvent(new Event('blur'));
    expect(rig.app.session.flow.phase).toBe('paused');
  });

  it('does not pause from the menu, and ignores visibility changes that hide nothing', () => {
    window.dispatchEvent(new Event('blur'));
    expect(rig.app.session.flow.phase).toBe('menu');
    press('Space');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(rig.app.session.flow.phase).toBe('ready');
  });
});

describe('level select and progress', () => {
  it('only starts unlocked levels', () => {
    button('Levels').click();
    const tiles = document.querySelectorAll<HTMLElement>('.level');
    tiles[4]?.click();
    expect(rig.app.session.flow.phase).toBe('menu');
    tiles[0]?.click();
    expect(rig.app.session.mode).toEqual({ kind: 'level', levelId: 1 });
  });

  it('offers the next level on the Play button after progress is made', () => {
    rig.app.destroy();
    const storage = new MemoryStorage();
    storage.setItem('skyhop.v2.progress', JSON.stringify({ completed: [1, 2, 3], bestEndless: 8, lastLevel: 4 }));
    rig = setup({}, storage);
    expect(button('Play level 4')).toBeTruthy();
    expect(document.querySelector('.btn__sub')?.textContent).toBe('Best 8');
    press('Space');
    expect(rig.app.session.mode).toEqual({ kind: 'level', levelId: 4 });
    expect(rig.world.setTheme).toHaveBeenCalledWith('goldenHour', false);
  });

  it('keeps working when storage is unavailable and says so', () => {
    rig.app.destroy();
    rig = setup({}, null);
    expect(document.querySelector('.notice')).not.toBeNull();
    press('Space');
    press('Space');
    runUntil(rig, () => rig.app.session.flow.phase === 'levelComplete', 60);
    expect(rig.app.profile.saveFailed).toBe(true);
    expect(rig.app.profile.completed).toEqual([1]);
  });
});

describe('settings', () => {
  const open = (): void => button('Settings').click();
  const toggle = (id: string): HTMLElement => document.querySelector(`[aria-labelledby="${id}"]`) as HTMLElement;

  it('turns sound off and back on from the menu button, the HUD and the M key', () => {
    button('Mute sound').click();
    expect(rig.sfx.setEnabled).toHaveBeenLastCalledWith(false);
    expect(button('Turn sound on')).toBeTruthy();
    press('KeyM');
    expect(rig.sfx.setEnabled).toHaveBeenLastCalledWith(true);
    expect(JSON.parse(rig.storage?.getItem('skyhop.v2.settings') ?? '{}').sfx).toBe(true);
    press('Space');
    (document.querySelector('.hud [aria-pressed]') as HTMLElement).click();
    expect(rig.sfx.setEnabled).toHaveBeenLastCalledWith(false);
  });

  it('applies assist mode to the next run', () => {
    open();
    toggle('sw-assist-mode').click();
    press('Escape');
    press('Space');
    expect(rig.app.session.assist).toBe(true);
    expect(rig.app.session.pipes[0]?.gap).toBeCloseTo(getLevel(1).gap * 1.25);
  });

  it('applies reduced motion immediately and passes it to the world', () => {
    open();
    toggle('sw-reduce-motion').click();
    expect(document.documentElement.dataset['motion']).toBe('reduced');
    press('Escape');
    runFrames(rig, 0.1);
    expect(lastRender().reducedMotion).toBe(true);
  });

  it('changes bird skin once unlocked and refuses locked ones', () => {
    open();
    const skins = document.querySelectorAll<HTMLElement>('.skin');
    skins[1]?.click();
    expect(rig.world.setSkin).not.toHaveBeenLastCalledWith('azure');
    expect(rig.app.profile.settings.skin).toBe('coral');
    rig.app.profile.completeLevel(3);
    press('Escape');
    open();
    document.querySelectorAll<HTMLElement>('.skin')[1]?.click();
    expect(rig.world.setSkin).toHaveBeenLastCalledWith('azure');
    expect(rig.app.profile.settings.skin).toBe('azure');
  });

  it('erases progress after a double confirmation', () => {
    rig.app.profile.completeLevel(2);
    rig.app.profile.submitEndless(5);
    open();
    const reset = document.querySelector('.btn--danger') as HTMLElement;
    reset.click();
    expect(rig.app.profile.completed).toEqual([2]);
    reset.click();
    expect(rig.app.profile.completed).toEqual([]);
    expect(rig.app.profile.progress.bestEndless).toBe(0);
    expect(document.querySelector('[role=dialog]')).toBeNull();
    expect(button('Play level 1')).toBeTruthy();
  });
});

describe('endless mode', () => {
  it('ramps up, levels up with a banner and records a new best on a crash', () => {
    button('Endless').click();
    expect(document.querySelector('.pill__label')?.textContent).toBe('Endless');
    expect((document.querySelector('.progress') as HTMLElement).hidden).toBe(true);
    press('Space');
    runUntil(rig, () => rig.app.session.score >= 7, 90);
    expect(rig.app.session.score).toBeGreaterThanOrEqual(7);
    expect(rig.world.setTheme).toHaveBeenCalledWith('noon', false);
    expect(rig.sfx.play).toHaveBeenCalledWith('levelUp');
    expect(document.querySelector('.banner')?.textContent).toContain('Level 2');
    runFrames(rig, 6);
    expect(heading()).toBe('Crash!');
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('New best!');
    expect(rig.app.profile.progress.bestEndless).toBeGreaterThanOrEqual(7);
  });
});

describe('failure handling', () => {
  it('shows an error instead of a blank page when 3D graphics cannot start', () => {
    rig.app.destroy();
    rig = setup({
      createWorld: () => {
        throw new Error('no webgl');
      },
    });
    expect(heading()).toBe('The sky is unavailable');
    expect(rig.frames.running).toBe(false);
    press('Space');
    expect(rig.app.session.flow.phase).toBe('menu');
    button('Reload').click();
    expect(rig.reload).toHaveBeenCalled();
  });

  it('pauses rendering when the graphics context is lost and resumes on restore', () => {
    rig.handlers?.onContextLost();
    expect(heading()).toBe('The sky is unavailable');
    expect(rig.frames.running).toBe(false);
    rig.handlers?.onContextRestored();
    expect(document.querySelector('[role=dialog]')).toBeNull();
    expect(rig.frames.running).toBe(true);
  });

  it('falls back to a window resize listener without ResizeObserver, and uses it when present', () => {
    window.dispatchEvent(new Event('resize'));
    expect(rig.world.resize).toHaveBeenCalledTimes(1);
    rig.app.destroy();
    let notify: () => void = () => undefined;
    const observe = vi.fn();
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      constructor(callback: () => void) {
        notify = callback;
      }
      observe = observe;
      disconnect = vi.fn();
    };
    rig = setup();
    expect(observe).toHaveBeenCalled();
    notify();
    expect(rig.world.resize).toHaveBeenCalled();
  });

  it('lowers render resolution when frames are slow', () => {
    for (let i = 0; i < 160; i++) rig.frames.tick(0.04);
    expect(rig.world.setPixelRatio).toHaveBeenCalledWith(2);
    expect(rig.world.setPixelRatio).toHaveBeenCalledWith(1.5);
  });

  it('stops responding after destroy', () => {
    rig.app.destroy();
    press('Space');
    expect(rig.app.session.flow.phase).toBe('menu');
    expect(rig.frames.running).toBe(false);
  });
});
