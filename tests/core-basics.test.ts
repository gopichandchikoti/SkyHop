import { describe, expect, it } from 'vitest';
import { BirdBody } from '../src/core/bird';
import { FixedStepper } from '../src/core/clock';
import { PHYSICS, WORLD } from '../src/core/config';
import {
  ENDLESS_STEP, LEVELS, LEVEL_COUNT, endlessLevel, getLevel, pipeSpacing,
} from '../src/core/levels';
import { createRng } from '../src/core/rng';
import { DEFAULT_SKIN, SKINS, isSkinId, isSkinUnlocked } from '../src/core/skins';

describe('rng', () => {
  it('is deterministic per seed and differs between seeds', () => {
    const a = createRng(7);
    const b = createRng(7);
    const seq = (r: ReturnType<typeof createRng>) => Array.from({ length: 5 }, () => r.next());
    expect(seq(a)).toEqual(seq(b));
    expect(seq(createRng(8))).not.toEqual(seq(createRng(7)));
  });

  it('keeps range and chance within bounds', () => {
    const rng = createRng(3);
    for (let i = 0; i < 500; i++) {
      const value = rng.range(2, 5);
      expect(value).toBeGreaterThanOrEqual(2);
      expect(value).toBeLessThan(5);
    }
    expect(createRng(1).chance(0)).toBe(false);
    expect(createRng(1).chance(1)).toBe(true);
  });
});

describe('levels', () => {
  it('defines ten levels that get strictly harder', () => {
    expect(LEVELS).toHaveLength(LEVEL_COUNT);
    LEVELS.slice(1).forEach((next, i) => {
      const prev = getLevel(i + 1);
      expect(next.speed).toBeGreaterThan(prev.speed);
      expect(next.gap).toBeLessThan(prev.gap);
      expect(next.interval).toBeLessThan(prev.interval);
      expect(next.maxShift).toBeGreaterThan(prev.maxShift);
      expect(next.goal).toBeGreaterThanOrEqual(prev.goal);
    });
  });

  it('introduces sliding pipes only from level 5', () => {
    expect(LEVELS.slice(0, 4).every((level) => level.movingChance === 0)).toBe(true);
    expect(LEVELS.slice(4).every((level) => level.movingChance > 0 && level.moveAmplitude > 0)).toBe(true);
  });

  it('clamps level lookups and walks the curve in endless mode', () => {
    expect(getLevel(-5).id).toBe(1);
    expect(getLevel(99).id).toBe(LEVEL_COUNT);
    expect(getLevel(3.9).id).toBe(3);
    expect(getLevel(Number.NaN).id).toBe(1);
    expect(endlessLevel(0).id).toBe(1);
    expect(endlessLevel(ENDLESS_STEP).id).toBe(2);
    expect(endlessLevel(10_000).id).toBe(LEVEL_COUNT);
    expect(endlessLevel(-4).id).toBe(1);
  });

  it('keeps spacing playable on every level', () => {
    for (const level of LEVELS) {
      expect(pipeSpacing(level)).toBeGreaterThan(WORLD.capWidth * 3);
      expect(level.gap).toBeGreaterThan(WORLD.hitRadius * 2 * 4);
    }
  });
});

describe('bird physics', () => {
  it('falls under gravity and flaps upward', () => {
    const bird = new BirdBody();
    bird.step(0.1);
    expect(bird.vy).toBeLessThan(0);
    expect(bird.y).toBeLessThan(WORLD.startY);
    bird.flap();
    expect(bird.vy).toBe(PHYSICS.flapVelocity);
  });

  it('rises about v^2/2g after one flap', () => {
    const bird = new BirdBody();
    bird.flap();
    let peak = bird.y;
    for (let i = 0; i < 240; i++) {
      bird.step(PHYSICS.step);
      peak = Math.max(peak, bird.y);
    }
    const expected = PHYSICS.flapVelocity ** 2 / (2 * PHYSICS.gravity);
    expect(peak - WORLD.startY).toBeCloseTo(expected, 1);
  });

  it('limits fall speed and stops softly at the ceiling', () => {
    const bird = new BirdBody();
    for (let i = 0; i < 600; i++) bird.step(PHYSICS.step);
    expect(bird.vy).toBe(-PHYSICS.maxFallSpeed);
    bird.reset(WORLD.ceiling - 0.1);
    bird.flap();
    bird.step(0.1);
    expect(bird.y).toBeCloseTo(WORLD.ceiling - WORLD.hitRadius);
    expect(bird.vy).toBeLessThanOrEqual(0);
  });

  it('detects and settles on the ground', () => {
    const bird = new BirdBody();
    bird.reset(WORLD.hitRadius);
    expect(bird.touchingGround).toBe(true);
    bird.reset(5);
    expect(bird.touchingGround).toBe(false);
    bird.settleOnGround();
    expect(bird.y).toBeCloseTo(WORLD.groundTop + WORLD.hitRadius, 6);
    expect(bird.touchingGround).toBe(true);
    expect(bird.vy).toBe(0);
  });
});

describe('fixed stepper', () => {
  it.each([30, 60, 90, 120, 144, 240])('runs the same number of steps over 10s at %i Hz', (hz) => {
    const stepper = new FixedStepper();
    let steps = 0;
    for (let frame = 0; frame < hz * 10; frame++) steps += stepper.advance(1 / hz);
    expect(Math.abs(steps - 10 / PHYSICS.step)).toBeLessThanOrEqual(2);
  });

  it('clamps long stalls, ignores negative time and exposes alpha', () => {
    const stepper = new FixedStepper(0.01, 0.05);
    expect(stepper.advance(5)).toBe(5);
    expect(stepper.advance(-1)).toBe(0);
    stepper.advance(0.015);
    expect(stepper.alpha).toBeCloseTo(0.5, 5);
    stepper.reset();
    expect(stepper.alpha).toBe(0);
  });
});

describe('skins', () => {
  it('always unlocks the default and gates others by completed levels', () => {
    expect(isSkinUnlocked(DEFAULT_SKIN, [])).toBe(true);
    expect(isSkinUnlocked('azure', [1, 2])).toBe(false);
    expect(isSkinUnlocked('azure', [1, 2, 3])).toBe(true);
    expect(isSkinUnlocked('gold', [10])).toBe(true);
    expect(isSkinUnlocked('nope' as never, [10])).toBe(false);
  });

  it('validates skin ids', () => {
    expect(SKINS.every((skin) => isSkinId(skin.id))).toBe(true);
    expect(isSkinId('purple')).toBe(false);
    expect(isSkinId(4)).toBe(false);
  });
});
