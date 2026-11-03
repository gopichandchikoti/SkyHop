import * as THREE from 'three';
import { PHYSICS, WORLD } from '../core/config';
import type { ThemeId } from '../core/levels';
import type { Phase } from '../core/phase';
import { gapCenter, type Pipe } from '../core/pipes';
import { createRng } from '../core/rng';
import type { SessionEvent } from '../core/session';
import type { SkinId } from '../core/skins';
import { BirdModel, type BirdMode } from './birdModel';
import { Particles, Rings } from './effects';
import { Environment } from './environment';
import { SKIN_PALETTES } from './themeData';
import { PipeLayer } from './pipeModels';
import { approach, clamp } from './spring';
import { Stage, type StageHandlers } from './stage';

export interface WorldFrame {
  phase: Phase;
  birdY: number;
  birdVy: number;
  pipes: readonly Pipe[];
  speed: number;
  alpha: number;
  scroll: number;
  time: number;
  dt: number;
  grounded: boolean;
  reducedMotion: boolean;
  revealPipes: boolean;
}

const CONFETTI = [0xffd23f, 0xff5c8a, 0x3be0a0, 0x4cc9f0, 0xffffff, 0xff9f1c];
const IDLE_PHASES: readonly Phase[] = ['menu', 'ready', 'levelComplete'];
const FROZEN_PHASES: readonly Phase[] = ['paused', 'countdown'];
const MENU_BIRD_OFFSET = 0.08;
const SHADOW_FADE_HEIGHT = 15;

export class WorldView {
  readonly stage: Stage;
  private readonly environment: Environment;
  private readonly bird = new BirdModel();
  private readonly pipeLayer = new PipeLayer();
  private readonly particles = new Particles();
  private readonly rings = new Rings();
  private readonly shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 28),
    new THREE.MeshBasicMaterial({ color: 0x0b1020, transparent: true, opacity: 0.3, depthWrite: false, fog: false }),
  );
  private readonly random = createRng(2024);
  private mode: BirdMode = 'idle';
  private idleY: number = WORLD.startY;
  private lastBirdY: number = WORLD.startY;
  private skinColour: number = SKIN_PALETTES.coral.body;
  private cameraLift = 0;
  private shake = 0;
  private pixelRatio = 1;
  private revealAge = 0;

  constructor(container: HTMLElement, handlers: StageHandlers) {
    this.stage = new Stage(container, handlers);
    this.environment = new Environment(this.stage.scene, createRng(77));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 1;
    this.stage.scene.add(this.pipeLayer.group, this.shadow, this.bird.root, this.particles.mesh, this.rings.group);
  }

  setTheme(id: ThemeId, instant: boolean): void {
    this.environment.setTheme(id, instant);
  }

  setSkin(skin: SkinId): void {
    this.bird.setSkin(skin);
    this.skinColour = SKIN_PALETTES[skin].body;
  }

  resize(): void {
    this.stage.resize();
  }

  setPixelRatio(ratio: number): void {
    this.pixelRatio = ratio;
    this.stage.setPixelRatio(ratio);
  }

  /** Clears transient effects when a new run begins. */
  reset(): void {
    this.bird.reset();
    this.particles.clear();
    this.revealAge = 0;
    this.shake = 0;
    this.idleY = this.lastBirdY;
  }

  handle(event: SessionEvent, reducedMotion: boolean): void {
    if (event.type === 'flap') this.onFlap();
    else if (event.type === 'score') this.onScore(event.pipe);
    else if (event.type === 'crash') this.onCrash(event.cause === 'pipe', reducedMotion);
    else if (event.type === 'complete') this.onComplete(reducedMotion);
    else if (event.type === 'levelUp') this.rings.pulse(0, this.lastBirdY, 0xffffff, 3.2);
  }

  render(frame: WorldFrame): void {
    const { dt } = frame;
    this.lastBirdY = frame.birdY;
    this.mode = this.resolveMode(frame.phase);
    this.bird.update(dt, {
      y: this.birdHeight(frame),
      vy: frame.birdVy,
      mode: this.mode,
      time: frame.time,
      grounded: frame.grounded,
    });
    this.updateShadow(this.bird.root.position.y);
    const playing = frame.phase === 'playing';
    const shiftX = playing ? frame.speed * frame.alpha * PHYSICS.step : 0;
    this.revealAge = frame.revealPipes ? this.revealAge + dt : 0;
    this.pipeLayer.sync(
      frame.pipes,
      { shiftX, lookAhead: frame.alpha * PHYSICS.step, time: frame.time, revealAge: this.revealAge },
      this.environment.theme,
    );
    this.environment.update({
      scroll: frame.scroll,
      time: frame.time,
      dt,
      aspect: this.stage.aspect,
      pixelRatio: this.pixelRatio,
      framing: this.stage.framing,
    });
    this.particles.update(dt);
    this.rings.update(dt);
    this.moveCamera(frame);
    this.stage.render();
  }

  /** A soft blob on the grass: it widens and fades as the bird climbs, which sells the 3D depth. */
  private updateShadow(birdY: number): void {
    const height = clamp(birdY / SHADOW_FADE_HEIGHT, 0, 1);
    this.shadow.position.set(WORLD.birdX, 0.03, 0.2);
    this.shadow.scale.set(1.35 + height * 0.9, 0.55 + height * 0.3, 1);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.34 * (1 - height * 0.85);
  }

  private resolveMode(phase: Phase): BirdMode {
    if (FROZEN_PHASES.includes(phase)) return this.mode;
    if (IDLE_PHASES.includes(phase)) return 'idle';
    return phase === 'playing' ? 'fly' : 'dead';
  }

  private birdHeight(frame: WorldFrame): number {
    if (this.mode !== 'idle') {
      this.idleY = frame.birdY;
      return frame.birdY;
    }
    this.idleY = approach(this.idleY, this.restingHeight(frame.phase), 3, frame.dt);
    return this.idleY + Math.sin(frame.time * 3) * 0.22;
  }

  /** On the menu the bird floats in the clear band between the title and the buttons. */
  private restingHeight(phase: Phase): number {
    if (phase !== 'menu') return WORLD.startY;
    const { camY, visibleHeight } = this.stage.framing;
    return camY + visibleHeight * MENU_BIRD_OFFSET;
  }

  private moveCamera(frame: WorldFrame): void {
    const follow = (frame.birdY - WORLD.startY) * 0.09;
    this.cameraLift = approach(this.cameraLift, frame.reducedMotion ? 0 : follow, 4, frame.dt);
    this.shake = approach(this.shake, 0, 7, frame.dt);
    const shakeX = Math.sin(frame.time * 63) * this.shake;
    const shakeY = Math.cos(frame.time * 71) * this.shake;
    this.stage.placeCamera(this.cameraLift, shakeX, shakeY);
  }

  private onFlap(): void {
    this.bird.flap();
    for (let i = 0; i < 4; i++) {
      this.particles.emit({
        x: WORLD.birdX - 0.35, y: this.lastBirdY - 0.15 + this.random.range(-0.15, 0.15),
        vx: -this.random.range(1.5, 4), vy: this.random.range(-1.2, 0.6), life: 0.45,
        size: this.random.range(0.2, 0.38), color: 0xffffff, drag: 2.2,
      });
    }
  }

  private onScore(pipe: Pipe): void {
    this.rings.pulse(pipe.x, gapCenter(pipe), 0xfff3a0, pipe.gap * 0.62);
    for (let i = 0; i < 8; i++) {
      const angle = this.random.range(0, Math.PI * 2);
      const speed = this.random.range(2, 5);
      this.particles.emit({
        x: pipe.x, y: gapCenter(pipe), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0.6, size: this.random.range(0.14, 0.26), color: 0xffe066, drag: 3,
      });
    }
  }

  private onCrash(fromPipe: boolean, reducedMotion: boolean): void {
    this.bird.hit(fromPipe);
    if (!reducedMotion) this.shake = 0.55;
    for (let i = 0; i < (reducedMotion ? 6 : 16); i++) {
      this.particles.emit({
        x: WORLD.birdX, y: this.lastBirdY, z: 0.5, vx: this.random.range(-5, 5), vy: this.random.range(1.5, 7),
        vz: this.random.range(-1, 2), life: this.random.range(0.7, 1.2), size: this.random.range(0.14, 0.3),
        color: i % 3 === 0 ? 0xffffff : this.skinColour, gravity: 14, drag: 0.8,
      });
    }
  }

  private onComplete(reducedMotion: boolean): void {
    this.bird.celebrate();
    this.rings.pulse(0, this.lastBirdY, 0xffffff, 4);
    for (let i = 0; i < (reducedMotion ? 20 : 90); i++) {
      this.particles.emit({
        x: WORLD.birdX + this.random.range(-1, 1), y: this.lastBirdY, z: this.random.range(0.2, 1.2),
        vx: this.random.range(-6, 10), vy: this.random.range(3, 11), life: this.random.range(1.4, 2.4),
        size: this.random.range(0.16, 0.3), color: CONFETTI[i % CONFETTI.length] ?? 0xffffff, gravity: 9, drag: 0.4,
      });
    }
  }
}
