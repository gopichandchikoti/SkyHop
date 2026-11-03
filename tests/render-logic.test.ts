import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WORLD } from '../src/core/config';
import { LEVELS } from '../src/core/levels';
import { SKINS } from '../src/core/skins';
import { flapCurve, pitchFor } from '../src/render/birdModel';
import { worldYForApparent } from '../src/render/clouds';
import { ThemeState } from '../src/render/palette';
import { Spring, approach, clamp, mix, wrap } from '../src/render/spring';
import { computeFraming, FOV } from '../src/render/stage';
import { COLOR_KEYS, SCALAR_KEYS, SKIN_PALETTES, THEMES } from '../src/render/themeData';

describe('camera framing', () => {
  it('shows the whole play column on a wide screen with the bird centred', () => {
    const framing = computeFraming(16 / 9);
    expect(framing.visibleHeight).toBeCloseTo(15.8, 1);
    expect(framing.visibleWidth).toBeCloseTo(15.8 * (16 / 9), 1);
    expect(framing.camY).toBeCloseTo(6.7, 5);
    const birdScreenX = 0.5 - framing.camX / framing.visibleWidth;
    expect(birdScreenX).toBeCloseTo(0.5, 5);
    expect(framing.distance).toBeCloseTo(15.8 / 2 / Math.tan((FOV * Math.PI) / 360), 3);
  });

  it('pulls back and lifts the camera on tall phones so the ground stays at the bottom', () => {
    const wide = computeFraming(16 / 9);
    const phone = computeFraming(390 / 844);
    expect(phone.visibleWidth).toBeGreaterThanOrEqual(12.4);
    expect(phone.distance).toBeGreaterThan(wide.distance);
    expect(phone.camY).toBeGreaterThan(wide.camY);
    expect(phone.camY - phone.visibleHeight / 2).toBeCloseTo(-1.7, 1);
    expect(0.5 - phone.camX / phone.visibleWidth).toBeCloseTo(0.5, 5);
  });

  it('keeps pipes alive until they are off screen behind the centred bird', () => {
    const widest = computeFraming(100);
    expect(-WORLD.despawnX).toBeGreaterThan(widest.visibleWidth / 2 + WORLD.capWidth / 2);
  });

  it('clamps absurd aspect ratios', () => {
    expect(Number.isFinite(computeFraming(0).distance)).toBe(true);
    expect(computeFraming(0).visibleWidth).toBeGreaterThanOrEqual(12.4);
    expect(computeFraming(100).visibleWidth).toBeCloseTo(computeFraming(4).visibleWidth, 5);
  });
});

describe('math helpers', () => {
  it('clamp, mix and wrap', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(mix(2, 4, 0.5)).toBe(3);
    expect(wrap(-1, 10)).toBe(9);
    expect(wrap(23, 10)).toBe(3);
  });

  it('approach is frame-rate independent and exact at rest', () => {
    const once = approach(0, 10, 4, 1);
    let stepped = 0;
    for (let i = 0; i < 100; i++) stepped = approach(stepped, 10, 4, 0.01);
    expect(stepped).toBeCloseTo(once, 5);
    expect(approach(3, 3, 5, 0.1)).toBe(3);
    expect(approach(2, 9, 5, 0)).toBe(2);
  });

  it('spring settles on its target and can be kicked and reset', () => {
    const spring = new Spring(0, 220, 13);
    spring.kick(10);
    expect(spring.step(0, 0.02)).toBeGreaterThan(0);
    for (let i = 0; i < 200; i++) spring.step(0, 0.016);
    expect(Math.abs(spring.value)).toBeLessThan(1e-3);
    spring.step(1, 0.5);
    spring.reset(2);
    expect(spring.value).toBe(2);
    expect(spring.velocity).toBe(0);
  });

  it('spring stays stable on a very long frame', () => {
    const spring = new Spring(1);
    const value = spring.step(0, 1);
    expect(Number.isFinite(value)).toBe(true);
    expect(Math.abs(value)).toBeLessThan(1);
  });
});

describe('bird animation curves', () => {
  it('flaps up, strokes down, then recovers without jumps', () => {
    expect(flapCurve(0)).toBeCloseTo(-0.2);
    expect(flapCurve(0.28)).toBeCloseTo(-1.0, 2);
    expect(flapCurve(0.45)).toBeLessThan(flapCurve(0.62));
    expect(flapCurve(0.62)).toBeCloseTo(0.85, 2);
    expect(flapCurve(1)).toBeCloseTo(-0.15);
    expect(Math.abs(flapCurve(0.2799) - flapCurve(0.2801))).toBeLessThan(0.01);
    expect(Math.abs(flapCurve(0.6199) - flapCurve(0.6201))).toBeLessThan(0.01);
  });

  it('tilts the nose up when climbing and down when falling, within limits', () => {
    expect(pitchFor(8)).toBeCloseTo(0.4);
    expect(pitchFor(100)).toBe(0.5);
    expect(pitchFor(-8)).toBeCloseTo(-0.6);
    expect(pitchFor(-100)).toBe(-1.3);
    expect(pitchFor(0)).toBe(0);
  });
});

describe('backdrop maths and themes', () => {
  it('maps apparent heights to world heights at depth', () => {
    expect(worldYForApparent(9, 0)).toBeCloseTo(9);
    expect(worldYForApparent(9, -60)).toBeGreaterThan(worldYForApparent(9, -20));
    expect(worldYForApparent(6.8, -80)).toBeCloseTo(6.8);
  });

  it('defines a complete palette for every theme used by a level, and for every bird', () => {
    for (const level of LEVELS) {
      const theme = THEMES[level.theme];
      for (const key of COLOR_KEYS) expect(Number.isInteger(theme[key]), `${level.theme}.${key}`).toBe(true);
      for (const key of SCALAR_KEYS) expect(Number.isFinite(theme[key]), `${level.theme}.${key}`).toBe(true);
    }
    for (const skin of SKINS) expect(SKIN_PALETTES[skin.id].body).toBeGreaterThan(0);
  });

  it('snaps and glides between themes', () => {
    const state = new ThemeState(THEMES.meadow);
    expect(state.colors.skyTop.equals(new THREE.Color(THEMES.meadow.skyTop))).toBe(true);
    state.approach(THEMES.night, 1.6, 0.5);
    const partway = state.colors.skyTop.clone();
    expect(partway.equals(new THREE.Color(THEMES.night.skyTop))).toBe(false);
    expect(partway.equals(new THREE.Color(THEMES.meadow.skyTop))).toBe(false);
    expect(state.scalars.stars).toBeGreaterThan(0);
    expect(state.scalars.stars).toBeLessThan(1);
    for (let i = 0; i < 40; i++) state.approach(THEMES.night, 1.6, 0.25);
    expect(state.scalars.stars).toBeCloseTo(1, 3);
    state.snapTo(THEMES.aurora);
    expect(state.scalars.aurora).toBe(1);
    expect(state.colors.pipe.equals(new THREE.Color(THEMES.aurora.pipe))).toBe(true);
  });
});
