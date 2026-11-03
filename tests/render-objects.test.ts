// @vitest-environment jsdom
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { WORLD } from '../src/core/config';
import type { Pipe } from '../src/core/pipes';
import { createRng } from '../src/core/rng';
import { BirdModel } from '../src/render/birdModel';
import { Clouds } from '../src/render/clouds';
import { Particles, Rings } from '../src/render/effects';
import { Environment } from '../src/render/environment';
import type { EnvFrame } from '../src/render/envFrame';
import { ThemeState } from '../src/render/palette';
import { PipeLayer } from '../src/render/pipeModels';
import { Sky } from '../src/render/sky';
import { computeFraming } from '../src/render/stage';
import { Terrain } from '../src/render/terrain';
import { SKIN_PALETTES, THEMES } from '../src/render/themeData';
import { stubCanvas, stubCanvasUnavailable } from './helpers/canvas';

beforeAll(stubCanvas);

const frameFor = (overrides: Partial<EnvFrame> = {}): EnvFrame => ({
  scroll: 10, time: 2, dt: 0.016, aspect: 16 / 9, pixelRatio: 1, framing: computeFraming(16 / 9), ...overrides,
});

const pipe = (overrides: Partial<Pipe> = {}): Pipe => ({
  id: 0, x: 5, baseY: 7, gap: 4.5, amplitude: 0, rate: 0, phase: 0, age: 0, scored: false, ...overrides,
});

describe('BirdModel', () => {
  const idle = { y: 7, vy: 0, mode: 'idle' as const, time: 0, grounded: false };

  it('is sized from the world constants and follows the simulated height', () => {
    const bird = new BirdModel();
    bird.update(0.016, { ...idle, y: 9.5 });
    expect(bird.root.position.y).toBe(9.5);
    expect(bird.root.position.x).toBe(WORLD.birdX);
    expect(bird.root.scale.x).toBeCloseTo(WORLD.birdRadius / 0.42);
  });

  it('applies a skin to every coloured part', () => {
    const bird = new BirdModel();
    bird.setSkin('mint');
    const mint = new THREE.Color(SKIN_PALETTES.mint.body);
    let found = false;
    bird.root.traverse((node) => {
      const material = (node as THREE.Mesh).material;
      if (material instanceof THREE.MeshStandardMaterial && material.color.equals(mint)) found = true;
    });
    expect(found).toBe(true);
  });

  it('tilts nose up while climbing and nose down while falling', () => {
    const climbing = new BirdModel();
    const falling = new BirdModel();
    for (let i = 0; i < 40; i++) {
      climbing.update(0.016, { ...idle, mode: 'fly', vy: 9 });
      falling.update(0.016, { ...idle, mode: 'fly', vy: -14 });
    }
    expect(climbing.root.rotation.z).toBeGreaterThan(0.2);
    expect(falling.root.rotation.z).toBeLessThan(-0.8);
  });

  it('squashes and stretches on a flap, then settles', () => {
    const bird = new BirdModel();
    bird.update(0.016, { ...idle, mode: 'fly', vy: 5 });
    const rest = bird.root.children[0]?.scale.y ?? 1;
    bird.flap();
    bird.update(0.05, { ...idle, mode: 'fly', vy: 9 });
    expect(bird.root.children[0]?.scale.y).toBeGreaterThan(rest);
    for (let i = 0; i < 200; i++) bird.update(0.016, { ...idle, mode: 'fly', vy: 0, time: i * 0.016 });
    expect(bird.root.children[0]?.scale.y).toBeCloseTo(1, 1);
  });

  it('idles with a gentle flutter, blinks, and wags its head', () => {
    const bird = new BirdModel();
    const yaws = new Set<number>();
    for (let i = 0; i < 600; i++) {
      bird.update(0.016, { ...idle, time: i * 0.016 });
      yaws.add(Math.round((bird.root.children[0]?.rotation.y ?? 0) * 100));
    }
    expect(yaws.size).toBeGreaterThan(5);
  });

  it('tumbles after a pipe hit and lies face-down once it lands', () => {
    const bird = new BirdModel();
    bird.hit(true);
    let before = bird.root.rotation.z;
    bird.update(0.1, { ...idle, mode: 'dead', vy: -5 });
    expect(bird.root.rotation.z).not.toBe(before);
    before = bird.root.rotation.z;
    for (let i = 0; i < 120; i++) bird.update(0.016, { ...idle, mode: 'dead', vy: 0, grounded: true });
    expect(bird.root.rotation.z).toBeCloseTo(-1.15, 1);
    const crashedOnGround = new BirdModel();
    crashedOnGround.hit(false);
    for (let i = 0; i < 120; i++) crashedOnGround.update(0.016, { ...idle, mode: 'dead', grounded: true });
    expect(crashedOnGround.root.rotation.z).toBeCloseTo(-1.15, 1);
  });

  it('does a victory loop and can be reset', () => {
    const bird = new BirdModel();
    bird.celebrate();
    const angles: number[] = [];
    for (let i = 0; i < 70; i++) {
      bird.update(0.016, { ...idle, time: i * 0.016 });
      angles.push(bird.root.rotation.z);
    }
    expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(2);
    bird.reset();
    bird.update(0.016, idle);
    expect(Math.abs(bird.root.rotation.z)).toBeLessThan(0.2);
  });
});

describe('PipeLayer', () => {
  const theme = new ThemeState(THEMES.meadow);
  const timing = { shiftX: 0.5, lookAhead: 0.01, time: 1, revealAge: 5 };
  const views = (layer: PipeLayer) => layer.group.children as THREE.Group[];

  it('places the pipe pair around the opening, and shifts with render time', () => {
    const layer = new PipeLayer();
    layer.sync([pipe()], timing, theme);
    const [view] = views(layer);
    expect(view?.visible).toBe(true);
    expect(view?.position.x).toBeCloseTo(4.5);
    const [bottomBody, bottomCap, topBody, topCap] = view?.children ?? [];
    expect(bottomCap?.position.y).toBeCloseTo(7 - 2.25 - WORLD.capHeight / 2);
    expect(topCap?.position.y).toBeCloseTo(7 + 2.25 + WORLD.capHeight / 2);
    expect(bottomBody?.scale.y).toBeGreaterThan(1);
    expect(topBody?.scale.y).toBeGreaterThan(1);
  });

  it('tints sliding pipes differently from fixed ones', () => {
    const layer = new PipeLayer();
    layer.sync([pipe(), pipe({ id: 1, amplitude: 1, rate: 1 })], timing, theme);
    const [fixed, sliding] = views(layer);
    const materialOf = (view?: THREE.Group) => (view?.children[0] as THREE.Mesh).material;
    expect(materialOf(fixed)).not.toBe(materialOf(sliding));
  });

  it('keeps sliding pipes in step with their look-ahead', () => {
    const layer = new PipeLayer();
    const moving = pipe({ amplitude: 1.5, rate: 1, phase: 0 });
    layer.sync([moving], { ...timing, lookAhead: 0 }, theme);
    const flat = (views(layer)[0]?.children[1] as THREE.Mesh).position.y;
    layer.sync([moving], { ...timing, lookAhead: Math.PI / 2 }, theme);
    expect((views(layer)[0]?.children[1] as THREE.Mesh).position.y).toBeGreaterThan(flat + 1);
  });

  it('hides pipes before they are revealed and extra views when pipes despawn', () => {
    const layer = new PipeLayer();
    layer.sync([pipe(), pipe({ id: 1, x: 12 })], { ...timing, revealAge: 0 }, theme);
    expect(views(layer).every((view) => !view.visible)).toBe(true);
    layer.sync([pipe(), pipe({ id: 1, x: 12 })], { ...timing, revealAge: 0.1 }, theme);
    const [near, far] = views(layer);
    expect(near?.visible).toBe(true);
    expect(far?.visible).toBe(false);
    layer.sync([pipe()], timing, theme);
    expect(views(layer)[1]?.visible).toBe(false);
  });

  it('copes with a missing canvas when building the sheen texture', () => {
    stubCanvasUnavailable();
    expect(() => new PipeLayer()).not.toThrow();
    stubCanvas();
  });
});

describe('effects', () => {
  const scaleAt = (particles: Particles, index: number): number => {
    const matrix = new THREE.Matrix4();
    particles.mesh.getMatrixAt(index, matrix);
    return matrix.elements[0] ?? 0;
  };

  it('emits, moves and expires particles', () => {
    const particles = new Particles();
    particles.emit({ x: 1, y: 2, vx: 3, vy: 4, life: 0.5, size: 1, color: 0xff0000, gravity: 10, drag: 1 });
    particles.update(0.1);
    const matrix = new THREE.Matrix4();
    particles.mesh.getMatrixAt(0, matrix);
    const position = new THREE.Vector3().setFromMatrixPosition(matrix);
    expect(position.x).toBeGreaterThan(1);
    expect(scaleAt(particles, 0)).toBeGreaterThan(0);
    particles.update(1);
    expect(scaleAt(particles, 0)).toBe(0);
  });

  it('recycles its pool when more particles are emitted than it holds', () => {
    const particles = new Particles();
    for (let i = 0; i < 500; i++) particles.emit({ x: i, y: 0, vx: 0, vy: 0, life: 1, size: 1, color: 0xffffff });
    particles.update(0.01);
    expect(scaleAt(particles, 0)).toBeGreaterThan(0);
    particles.clear();
    expect(scaleAt(particles, 0)).toBe(0);
    expect(scaleAt(particles, 100)).toBe(0);
  });

  it('pulses a ring outward and fades it away', () => {
    const rings = new Rings(2);
    rings.pulse(3, 5, 0xffffff, 4);
    rings.pulse(4, 5, 0xffffff, 4);
    rings.pulse(5, 5, 0xffffff, 4);
    const first = rings.group.children[0] as THREE.Mesh;
    expect(first.visible).toBe(true);
    rings.update(0.2);
    const midScale = first.scale.x;
    expect(midScale).toBeGreaterThan(1);
    expect((first.material as THREE.MeshBasicMaterial).opacity).toBeGreaterThan(0);
    rings.update(1);
    expect(rings.group.children.every((ring) => !ring.visible)).toBe(true);
    rings.update(0.1);
  });
});

describe('backdrop', () => {
  const theme = new ThemeState(THEMES.meadow);

  it('keeps clouds wrapped around the camera and drifting with the scroll', () => {
    const clouds = new Clouds(createRng(1));
    const frame = frameFor();
    clouds.update(theme, frame);
    const before = clouds.group.children.map((cloud) => cloud.position.x);
    expect(clouds.group.children).toHaveLength(13);
    for (const x of before) expect(Math.abs(x - frame.framing.camX)).toBeLessThan(400);
    clouds.update(theme, frameFor({ scroll: 11 }));
    const after = clouds.group.children.map((cloud) => cloud.position.x);
    expect(after.some((x, i) => x < (before[i] ?? 0))).toBe(true);
  });

  it('scrolls hills, ground and bushes with the world', () => {
    const terrain = new Terrain(createRng(2));
    terrain.update(theme, 4, 10);
    const hills = terrain.group.children.slice(0, 3).map((hill) => hill.position.x);
    terrain.update(theme, 4, 12);
    const moved = terrain.group.children.slice(0, 3).map((hill) => hill.position.x);
    expect(moved.every((x, i) => x !== hills[i])).toBe(true);
    expect(terrain.group.children).toHaveLength(6);
  });

  it('builds the sky and shows stars only on starry themes', () => {
    const sky = new Sky(() => 0.5);
    sky.resize(1.5, 2);
    sky.update(new ThemeState(THEMES.meadow), 1);
    expect(sky.stars.visible).toBe(false);
    sky.update(new ThemeState(THEMES.aurora), 1);
    expect(sky.stars.visible).toBe(true);
    const uniforms = (sky.dome.material as THREE.ShaderMaterial).uniforms;
    expect(uniforms['uAurora']?.value).toBe(1);
    expect(uniforms['uAspect']?.value).toBe(1.5);
  });

  it('blends the whole environment toward a new theme', () => {
    const scene = new THREE.Scene();
    const environment = new Environment(scene, createRng(3));
    expect(scene.fog).not.toBeNull();
    environment.setTheme('night', true);
    environment.update(frameFor());
    const fog = scene.fog as THREE.Fog;
    expect(fog.color.equals(new THREE.Color(THEMES.night.skyHorizon))).toBe(true);
    environment.setTheme('dusk', false);
    environment.update(frameFor({ dt: 0.1 }));
    expect(fog.color.equals(new THREE.Color(THEMES.night.skyHorizon))).toBe(false);
    expect(fog.color.equals(new THREE.Color(THEMES.dusk.skyHorizon))).toBe(false);
  });

  it('tolerates a missing canvas when painting ground textures', () => {
    stubCanvasUnavailable();
    expect(() => new Terrain(createRng(4))).not.toThrow();
    stubCanvas();
  });
});
