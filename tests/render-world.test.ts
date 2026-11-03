// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Phase } from '../src/core/phase';
import type { Pipe } from '../src/core/pipes';
import { BirdModel } from '../src/render/birdModel';
import { WorldView, type WorldFrame } from '../src/render/world';
import { stubCanvas } from './helpers/canvas';

vi.mock('../src/render/stage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/render/stage')>();
  const three = await import('three');
  class FakeStage {
    scene = new three.Scene();
    camera = new three.PerspectiveCamera();
    framing = actual.computeFraming(16 / 9);
    aspect = 16 / 9;
    resize = vi.fn();
    setPixelRatio = vi.fn();
    placeCamera = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
  }
  return { ...actual, Stage: FakeStage };
});

beforeAll(stubCanvas);

const pipe = (overrides: Partial<Pipe> = {}): Pipe => ({
  id: 0, x: 6, baseY: 7, gap: 4.5, amplitude: 0, rate: 0, phase: 0, age: 0, scored: false, ...overrides,
});

const frameFor = (phase: Phase, overrides: Partial<WorldFrame> = {}): WorldFrame => ({
  phase, birdY: 7, birdVy: 0, pipes: [pipe()], speed: 4, alpha: 0.5, scroll: 3, time: 1, dt: 0.016, grounded: false,
  reducedMotion: false, revealPipes: true, ...overrides,
});

function make() {
  const world = new WorldView(document.createElement('div'), { onContextLost: vi.fn(), onContextRestored: vi.fn() });
  const stage = world.stage as unknown as { render: ReturnType<typeof vi.fn>; placeCamera: ReturnType<typeof vi.fn>;
    setPixelRatio: ReturnType<typeof vi.fn>; resize: ReturnType<typeof vi.fn>; scene: import('three').Scene };
  const bird = (world as unknown as { bird: BirdModel }).bird;
  return { world, stage, bird };
}

const lastCall = (mock: ReturnType<typeof vi.fn>): number[] | undefined => mock.mock.calls[mock.mock.calls.length - 1];

describe('WorldView', () => {
  it('renders every phase without error and draws once per frame', () => {
    const { world, stage } = make();
    const phases: Phase[] = ['menu', 'ready', 'countdown', 'playing', 'dying', 'gameOver', 'levelComplete', 'paused'];
    for (const phase of phases) world.render(frameFor(phase));
    expect(stage.render).toHaveBeenCalledTimes(phases.length);
    expect(stage.placeCamera).toHaveBeenCalledTimes(phases.length);
  });

  it('floats the bird high on the menu and lowers it to the start height when a level begins', () => {
    const { world, bird } = make();
    for (let i = 0; i < 120; i++) world.render(frameFor('menu', { dt: 0.016, time: i * 0.016 }));
    const menuHeight = bird.root.position.y;
    for (let i = 0; i < 240; i++) world.render(frameFor('ready', { dt: 0.016, time: i * 0.016 }));
    expect(menuHeight).toBeGreaterThan(7.4);
    expect(bird.root.position.y).toBeLessThan(menuHeight);
    expect(bird.root.position.y).toBeCloseTo(7, 0);
  });

  it('shows the simulated height while playing and holds the last mode while paused', () => {
    const { world, bird } = make();
    world.render(frameFor('playing', { birdY: 9.25 }));
    expect(bird.root.position.y).toBe(9.25);
    world.render(frameFor('paused', { birdY: 9.25, dt: 0 }));
    expect(bird.root.position.y).toBe(9.25);
  });

  it('reveals pipes only once a run is set up', () => {
    const { world } = make();
    world.render(frameFor('menu', { revealPipes: false }));
    const layer = (world as unknown as { pipeLayer: { group: import('three').Group } }).pipeLayer;
    expect(layer.group.children.every((view) => !view.visible)).toBe(true);
    for (let i = 0; i < 60; i++) world.render(frameFor('ready'));
    expect(layer.group.children[0]?.visible).toBe(true);
    world.reset();
    world.render(frameFor('ready', { dt: 0 }));
    expect(layer.group.children[0]?.visible).toBe(false);
  });

  it('reacts to every game event', () => {
    const { world, stage } = make();
    world.render(frameFor('playing'));
    const events = [
      { type: 'flap' }, { type: 'score', score: 1, pipe: pipe({ x: 0 }) }, { type: 'crash', cause: 'pipe' },
      { type: 'crash', cause: 'ground' }, { type: 'complete', level: { id: 1 } }, { type: 'levelUp', level: { id: 2 } },
      { type: 'settled' },
    ] as const;
    for (const event of events) world.handle(event as never, false);
    world.handle({ type: 'crash', cause: 'pipe' }, true);
    world.handle({ type: 'complete', level: { id: 1 } } as never, true);
    world.render(frameFor('dying'));
    expect(stage.render).toHaveBeenCalled();
  });

  it('shakes the camera on a crash unless motion is reduced', () => {
    const shaken = make();
    shaken.world.render(frameFor('playing'));
    shaken.world.handle({ type: 'crash', cause: 'pipe' }, false);
    shaken.world.render(frameFor('dying', { time: 0.3 }));
    const [, shakeX = 0, shakeY = 0] = lastCall(shaken.stage.placeCamera) ?? [];
    expect(Math.abs(shakeX) + Math.abs(shakeY)).toBeGreaterThan(0.01);

    const calm = make();
    calm.world.render(frameFor('playing'));
    calm.world.handle({ type: 'crash', cause: 'pipe' }, true);
    calm.world.render(frameFor('dying', { time: 0.3, reducedMotion: true }));
    const [lift = 1, calmX = 1, calmY = 1] = lastCall(calm.stage.placeCamera) ?? [];
    for (const value of [lift, calmX, calmY]) expect(Math.abs(value)).toBeLessThan(1e-9);
  });

  it('forwards theme, skin, pixel ratio and resize', () => {
    const { world, stage } = make();
    world.setTheme('night', true);
    world.setSkin('gold');
    world.setPixelRatio(1.25);
    world.resize();
    expect(stage.setPixelRatio).toHaveBeenCalledWith(1.25);
    expect(stage.resize).toHaveBeenCalled();
  });
});
