// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { PerformanceGovernor, ratioSteps } from '../src/app/governor';
import { GameLoop } from '../src/app/loop';
import { Profile } from '../src/app/profile';
import { Scheduler } from '../src/app/scheduler';
import { ScrollTracker } from '../src/app/scroll';
import { Repository } from '../src/storage/repository';
import { BrokenStorage, MemoryStorage } from './helpers/memory-storage';

describe('ScrollTracker', () => {
  it('follows distance while playing and ignores backwards jitter', () => {
    const tracker = new ScrollTracker();
    tracker.advance({ dt: 0.016, phase: 'playing', distance: 1, ambientSpeed: 3 });
    tracker.advance({ dt: 0.016, phase: 'playing', distance: 2.5, ambientSpeed: 3 });
    tracker.advance({ dt: 0.016, phase: 'playing', distance: 2.4, ambientSpeed: 3 });
    expect(tracker.scroll).toBeCloseTo(2.5);
  });

  it('drifts on the menu and holds still elsewhere, while time keeps running', () => {
    const tracker = new ScrollTracker();
    tracker.advance({ dt: 1, phase: 'menu', distance: 0, ambientSpeed: 3 });
    expect(tracker.scroll).toBe(3);
    for (const phase of ['ready', 'dying', 'gameOver', 'levelComplete', 'paused'] as const) {
      tracker.advance({ dt: 1, phase, distance: 0, ambientSpeed: 3 });
    }
    expect(tracker.scroll).toBe(3);
    expect(tracker.time).toBe(6);
  });

  it('restarts distance accounting on reset', () => {
    const tracker = new ScrollTracker();
    tracker.advance({ dt: 0.1, phase: 'playing', distance: 5, ambientSpeed: 0 });
    tracker.reset();
    tracker.advance({ dt: 0.1, phase: 'playing', distance: 1, ambientSpeed: 0 });
    expect(tracker.scroll).toBe(6);
  });
});

describe('PerformanceGovernor', () => {
  it('builds descending resolution steps and caps the device ratio', () => {
    expect(ratioSteps(1)).toEqual([1, 0.75]);
    expect(ratioSteps(2)).toEqual([2, 1.5, 1, 0.75]);
    expect(ratioSteps(3.5)).toEqual([2, 1.5, 1, 0.75]);
    expect(ratioSteps(0.5)).toEqual([1, 0.75]);
  });

  function feed(governor: PerformanceGovernor, fps: number, seconds: number): Array<number | null> {
    const results: Array<number | null> = [];
    for (let i = 0; i < fps * seconds; i++) results.push(governor.sample(1 / fps));
    return results;
  }

  it('steps down on slow frames, after a warm-up, and never below the last step', () => {
    const governor = new PerformanceGovernor(2);
    expect(feed(governor, 60, 1).every((r) => r === null)).toBe(true);
    const changes = feed(governor, 25, 20).filter((r): r is number => r !== null);
    expect(changes).toEqual([1.5, 1, 0.75]);
    expect(governor.ratio).toBe(0.75);
  });

  it('leaves fast devices alone and ignores stalls', () => {
    const governor = new PerformanceGovernor(2);
    expect(feed(governor, 60, 10).every((r) => r === null)).toBe(true);
    expect(governor.ratio).toBe(2);
    expect(governor.sample(2)).toBeNull();
  });
});

describe('GameLoop', () => {
  function fakeFrames() {
    let callback: FrameRequestCallback | null = null;
    const cancel = vi.fn();
    const request = vi.fn((cb: FrameRequestCallback) => {
      callback = cb;
      return 7;
    });
    return { request, cancel, fire: (t: number) => callback?.(t) };
  }

  it('reports elapsed seconds and starts with zero', () => {
    const frames = fakeFrames();
    const seen: number[] = [];
    const loop = new GameLoop((dt) => seen.push(dt), { request: frames.request, cancel: frames.cancel });
    loop.start();
    loop.start();
    expect(frames.request).toHaveBeenCalledTimes(1);
    frames.fire(1000);
    frames.fire(1016);
    expect(seen).toEqual([0, 0.016]);
    expect(loop.running).toBe(true);
  });

  it('stops cleanly', () => {
    const frames = fakeFrames();
    const loop = new GameLoop(() => undefined, { request: frames.request, cancel: frames.cancel });
    loop.stop();
    expect(frames.cancel).not.toHaveBeenCalled();
    loop.start();
    loop.stop();
    expect(frames.cancel).toHaveBeenCalledWith(7);
    expect(loop.running).toBe(false);
  });

  it('uses the browser frame scheduler by default', () => {
    const request = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(3);
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
    const loop = new GameLoop(() => undefined);
    loop.start();
    loop.stop();
    expect(request).toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledWith(3);
    request.mockRestore();
    cancel.mockRestore();
  });
});

describe('Profile', () => {
  const make = () => {
    const storage = new MemoryStorage();
    return { storage, profile: new Profile(new Repository(storage), true) };
  };

  it('starts fresh and persists setting changes', () => {
    const { storage, profile } = make();
    expect(profile.unlocked).toBe(1);
    expect(profile.nextLevel.id).toBe(1);
    profile.setSetting('assist', true);
    expect(new Profile(new Repository(storage), true).settings.assist).toBe(true);
  });

  it('reports the bird a completed level unlocks, once', () => {
    const { profile } = make();
    expect(profile.completeLevel(1)).toBeNull();
    expect(profile.completeLevel(3)).toBe('azure');
    expect(profile.completeLevel(3)).toBeNull();
    expect(profile.completed).toEqual([1, 3]);
    expect(profile.unlocked).toBe(4);
    expect(profile.hasNextLevel(9)).toBe(true);
    expect(profile.hasNextLevel(10)).toBe(false);
  });

  it('resets a locked bird back to the default after reading old data', () => {
    const storage = new MemoryStorage();
    storage.setItem('skyhop.v2.settings', JSON.stringify({ skin: 'gold' }));
    expect(new Profile(new Repository(storage), true).settings.skin).toBe('coral');
  });

  it('tracks endless bests and erases everything on reset', () => {
    const { profile } = make();
    expect(profile.submitEndless(9)).toBe(true);
    expect(profile.submitEndless(4)).toBe(false);
    profile.completeLevel(6);
    profile.setSetting('skin', 'mint');
    profile.reset();
    expect(profile.progress).toEqual({ completed: [], bestEndless: 0, lastLevel: 1 });
    expect(profile.settings.skin).toBe('coral');
  });

  it('flags failed saves when storage is unavailable', () => {
    const profile = new Profile(new Repository(new BrokenStorage()), false);
    expect(profile.saveFailed).toBe(false);
    profile.completeLevel(1);
    expect(profile.saveFailed).toBe(true);
    expect(profile.storageOk).toBe(false);
  });
});

describe('Scheduler', () => {
  it('runs tasks once their simulated time has elapsed, in order of due time', () => {
    const scheduler = new Scheduler();
    const order: string[] = [];
    scheduler.schedule(1, () => order.push('late'));
    scheduler.schedule(0.5, () => order.push('early'));
    scheduler.advance(0.4);
    expect(order).toEqual([]);
    scheduler.advance(0.2);
    expect(order).toEqual(['early']);
    scheduler.advance(1);
    scheduler.advance(1);
    expect(order).toEqual(['early', 'late']);
  });

  it('does not advance while time is frozen, and can be cleared', () => {
    const scheduler = new Scheduler();
    const run = vi.fn();
    scheduler.schedule(0.1, run);
    scheduler.advance(0);
    expect(run).not.toHaveBeenCalled();
    scheduler.clear();
    scheduler.advance(5);
    expect(run).not.toHaveBeenCalled();
  });

  it('allows a task to schedule another', () => {
    const scheduler = new Scheduler();
    const second = vi.fn();
    scheduler.schedule(0.1, () => scheduler.schedule(0.1, second));
    scheduler.advance(0.2);
    expect(second).not.toHaveBeenCalled();
    scheduler.advance(0.2);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
