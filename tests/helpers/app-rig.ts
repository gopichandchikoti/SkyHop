import { vi, type Mock } from 'vitest';
import { GameApp, type AppDeps, type WorldPort } from '../../src/app/GameApp';
import type { Sfx } from '../../src/audio/sfx';
import type { StageHandlers } from '../../src/render/stage';
import type { StorageLike } from '../../src/storage/repository';
import { MemoryStorage } from './memory-storage';

// A GameApp wired to a fake 3D world, a hand-cranked frame loop and fake sound, shared by the app-level tests.

export type FakeWorld = { [K in keyof WorldPort]: Mock };

export function fakeWorld(): FakeWorld {
  return {
    setTheme: vi.fn(), setSkin: vi.fn(), setPixelRatio: vi.fn(), reset: vi.fn(), resize: vi.fn(), handle: vi.fn(),
    render: vi.fn(),
  };
}

export function manualFrames() {
  let callback: FrameRequestCallback | null = null;
  let now = 1000;
  return {
    deps: {
      request: (cb: FrameRequestCallback) => {
        callback = cb;
        return 1;
      },
      cancel: vi.fn(() => {
        callback = null;
      }),
    },
    tick: (seconds = 1 / 60) => {
      now += seconds * 1000;
      callback?.(now);
    },
    get running() {
      return callback !== null;
    },
  };
}

export interface Rig {
  app: GameApp;
  world: FakeWorld;
  storage: StorageLike | null;
  frames: ReturnType<typeof manualFrames>;
  sfx: { unlock: Mock; play: Mock; setEnabled: Mock };
  vibrate: Mock;
  reload: Mock;
  handlers: StageHandlers | null;
}

export function setup(overrides: Partial<AppDeps> = {}, storage: StorageLike | null = new MemoryStorage()): Rig {
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.getElementById('app') as HTMLElement;
  const world = fakeWorld();
  const frames = manualFrames();
  const sfx = { unlock: vi.fn(), play: vi.fn(), setEnabled: vi.fn() };
  const vibrate = vi.fn();
  const reload = vi.fn();
  const rig = { world, storage, frames, sfx, vibrate, reload, handlers: null } as unknown as Rig;
  rig.app = new GameApp(root, {
    createWorld: (_container, handlers) => {
      rig.handlers = handlers;
      return world;
    },
    storage, loopDeps: frames.deps, seed: 7, sfx: sfx as unknown as Sfx, devicePixelRatio: 2, vibrate, reload,
    ...overrides,
  });
  rig.app.start();
  frames.tick(0);
  return rig;
}
