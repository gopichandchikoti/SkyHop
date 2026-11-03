import { describe, expect, it } from 'vitest';
import { birdHitsPipe, circleHitsRect, pipeRects } from '../src/core/collision';
import { WORLD } from '../src/core/config';
import { LEVELS, getLevel, pipeSpacing } from '../src/core/levels';
import { PipeField, gapCenter, type Pipe } from '../src/core/pipes';
import { createRng } from '../src/core/rng';

function makePipe(overrides: Partial<Pipe> = {}): Pipe {
  return {
    id: 0, x: 0, baseY: 7, gap: 4, amplitude: 0, rate: 0, phase: 0, age: 0, scored: false, ...overrides,
  };
}

describe('gapCenter', () => {
  it('is fixed for static pipes and oscillates for moving ones', () => {
    expect(gapCenter(makePipe())).toBe(7);
    const moving = makePipe({ amplitude: 1, rate: 2, phase: 0 });
    expect(gapCenter(moving)).toBeCloseTo(7);
    expect(gapCenter(moving, Math.PI / 4)).toBeCloseTo(8);
    expect(gapCenter({ ...moving, age: Math.PI / 4 })).toBeCloseTo(8);
  });
});

describe('collision', () => {
  it('tests circle vs rectangle including corners', () => {
    const rect = { x0: 0, y0: 0, x1: 2, y1: 2 };
    expect(circleHitsRect(1, 1, 0.1, rect)).toBe(true);
    expect(circleHitsRect(3, 1, 0.5, rect)).toBe(false);
    expect(circleHitsRect(2.3, 2.3, 0.5, rect)).toBe(true);
    expect(circleHitsRect(2.5, 2.5, 0.5, rect)).toBe(false);
  });

  it('lets the bird through the opening and hits above and below it', () => {
    const pipe = makePipe();
    expect(birdHitsPipe(7, pipe)).toBe(false);
    expect(birdHitsPipe(7 + 2 - WORLD.hitRadius - 0.01, pipe)).toBe(false);
    expect(birdHitsPipe(7 + 2 - WORLD.hitRadius + 0.05, pipe)).toBe(true);
    expect(birdHitsPipe(7 - 2 + WORLD.hitRadius - 0.05, pipe)).toBe(true);
    expect(birdHitsPipe(12, pipe)).toBe(true);
    expect(birdHitsPipe(1, pipe)).toBe(true);
  });

  it('ignores pipes that are not horizontally close and uses the wider cap', () => {
    expect(birdHitsPipe(1, makePipe({ x: 6 }))).toBe(false);
    const edge = WORLD.capWidth / 2 + WORLD.hitRadius - 0.02;
    expect(birdHitsPipe(7 + 2 + WORLD.capHeight / 2, makePipe({ x: edge }))).toBe(true);
    const bodyOnly = WORLD.pipeWidth / 2 + WORLD.hitRadius + 0.05;
    expect(birdHitsPipe(12, makePipe({ x: bodyOnly }))).toBe(false);
  });

  it('follows a sliding opening', () => {
    const pipe = makePipe({ amplitude: 1.5, rate: 1, phase: Math.PI / 2 });
    expect(pipeRects(pipe)).toHaveLength(4);
    expect(birdHitsPipe(8.5, pipe)).toBe(false);
    expect(birdHitsPipe(5.5, pipe)).toBe(true);
  });
});

describe('PipeField', () => {
  const level = getLevel(1);

  it('pre-spawns pipes a full spacing apart out to the spawn distance', () => {
    const field = new PipeField(createRng(1));
    field.reset(level, createRng(1));
    const xs = field.pipes.map((pipe) => pipe.x);
    expect(xs[0]).toBe(WORLD.firstPipeX);
    xs.slice(1).forEach((x, i) => expect(x - (xs[i] ?? 0)).toBeCloseTo(pipeSpacing(level), 6));
    expect(Math.max(...xs)).toBeLessThanOrEqual(WORLD.spawnX);
  });

  it('keeps every opening inside the playable band on every level', () => {
    for (const lvl of LEVELS) {
      const field = new PipeField(createRng(1));
      field.reset(lvl, createRng(lvl.id));
      for (let i = 0; i < 400; i++) {
        field.advance(0.05, lvl.speed);
        field.fill(lvl);
      }
      for (const pipe of field.pipes) {
        const low = gapCenter(pipe) - pipe.gap / 2;
        const high = gapCenter(pipe) + pipe.gap / 2;
        expect(low).toBeGreaterThanOrEqual(WORLD.groundTop + WORLD.gapMarginBottom - 1e-6);
        expect(high).toBeLessThanOrEqual(WORLD.ceiling - WORLD.gapMarginTop + 1e-6);
      }
    }
  });

  it('is reproducible for a seed and varies across seeds', () => {
    const layout = (seed: number) => {
      const field = new PipeField(createRng(0));
      field.reset(level, createRng(seed));
      return field.pipes.map((pipe) => pipe.baseY);
    };
    expect(layout(5)).toEqual(layout(5));
    expect(layout(5)).not.toEqual(layout(6));
  });

  it('moves, ages and despawns pipes and finds the next unscored one', () => {
    const field = new PipeField(createRng(1));
    field.reset(level, createRng(2));
    const first = field.pipes[0];
    const startX = first?.x ?? 0;
    field.advance(1, 4);
    expect(first?.x).toBeCloseTo(startX - 4);
    expect(first?.age).toBeCloseTo(1);
    expect(field.nextUnscored()).toBe(first);
    if (first) first.scored = true;
    expect(field.nextUnscored()).toBe(field.pipes[1]);
    field.advance((first?.x ?? 0) - WORLD.despawnX + 1, 1);
    expect(field.pipes.includes(first as Pipe)).toBe(false);
  });

  it('removes every expired pipe even after a very long step', () => {
    const field = new PipeField(createRng(1));
    field.reset(level, createRng(2));
    field.advance(100, 4);
    expect(field.pipes).toEqual([]);
    field.advance(0.1, 4);
    expect(field.pipes).toEqual([]);
  });

  it('still places a gap when the playable band is narrower than the opening', () => {
    const field = new PipeField(createRng(1));
    field.reset({ ...level, gap: 13, maxShift: 0 }, createRng(2));
    expect(field.pipes.length).toBeGreaterThan(0);
    for (const pipe of field.pipes) {
      expect(Number.isFinite(pipe.baseY)).toBe(true);
      expect(pipe.baseY).toBeGreaterThan(0);
      expect(pipe.baseY).toBeLessThan(WORLD.ceiling);
    }
  });

  it('does not make sliding pipes on early levels', () => {
    const field = new PipeField(createRng(1));
    field.reset(getLevel(4), createRng(9));
    expect(field.pipes.every((pipe) => pipe.amplitude === 0)).toBe(true);
    field.reset(getLevel(10), createRng(9));
    for (let i = 0; i < 300; i++) {
      field.advance(0.05, 6);
      field.fill(getLevel(10));
    }
    expect(field.pipes.some((pipe) => pipe.amplitude > 0)).toBe(true);
  });
});
