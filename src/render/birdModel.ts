import * as THREE from 'three';
import { WORLD } from '../core/config';
import type { SkinId } from '../core/skins';
import { applySkin, buildBird, createMaterials, type BirdParts } from './birdParts';
import { Spring, approach, clamp, mix } from './spring';

export type BirdMode = 'idle' | 'fly' | 'dead';

export interface BirdPose {
  y: number;
  vy: number;
  mode: BirdMode;
  time: number;
  grounded: boolean;
}

const MODEL_RADIUS = 0.42;
const FLAP_DURATION = 0.3;
const IDLE_FLAP_PERIOD = 0.62;
const LOOP_DURATION = 0.9;
const REST_YAW = -0.3;

const easeOut = (t: number): number => 1 - (1 - t) ** 3;
const easeInOut = (t: number): number => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/** Wing angle in radians over one flap: quick lift, powerful down-stroke, relaxed recovery. */
export function flapCurve(t: number): number {
  if (t < 0.28) return mix(-0.2, -1.0, easeOut(t / 0.28));
  if (t < 0.62) return mix(-1.0, 0.85, easeInOut((t - 0.28) / 0.34));
  return mix(0.85, -0.15, easeOut(Math.min(1, (t - 0.62) / 0.38)));
}

export function pitchFor(vy: number): number {
  return vy > 0 ? Math.min(vy * 0.05, 0.5) : Math.max(vy * 0.075, -1.3);
}

export class BirdModel {
  readonly root = new THREE.Group();
  private readonly parts: BirdParts;
  private readonly stretch = new Spring(0, 260, 11);
  private flapAge = 10;
  private pitch = 0;
  private spin = 0;
  private loop = 0;
  private blink = 3;
  private wasGrounded = false;

  constructor() {
    this.parts = buildBird(createMaterials());
    this.root.add(this.parts.rig);
    this.root.position.z = 0.2;
    this.root.scale.setScalar(WORLD.birdRadius / MODEL_RADIUS);
    this.root.traverse((node) => {
      node.frustumCulled = false;
    });
  }

  setSkin(skin: SkinId): void {
    applySkin(this.parts.materials, skin);
  }

  flap(): void {
    this.flapAge = 0;
    this.stretch.kick(14);
  }

  hit(fromPipe: boolean): void {
    this.stretch.kick(-16);
    this.spin = fromPipe ? 9 : 0;
    this.wasGrounded = !fromPipe;
  }

  celebrate(): void {
    this.loop = 1;
    this.stretch.kick(12);
  }

  reset(): void {
    this.pitch = 0;
    this.spin = 0;
    this.loop = 0;
    this.flapAge = 10;
    this.wasGrounded = false;
    this.stretch.reset();
  }

  update(dt: number, pose: BirdPose): void {
    this.root.position.set(WORLD.birdX, pose.y, 0.2);
    this.updateWings(dt, pose);
    this.updateBody(dt, pose);
    this.updateFace(dt, pose);
  }

  private updateWings(dt: number, pose: BirdPose): void {
    this.flapAge += dt;
    if (pose.mode === 'idle' && this.flapAge > IDLE_FLAP_PERIOD) this.flapAge = 0;
    const angle = this.wingAngle(pose);
    for (const wing of this.parts.wings) wing.rotation.z = angle;
    this.parts.tail.rotation.z = Math.sin(pose.time * 5) * 0.05 + (pose.mode === 'fly' ? -pose.vy * 0.012 : 0);
    this.parts.crest.rotation.z = clamp(pose.vy * 0.03, -0.3, 0.3);
  }

  private wingAngle(pose: BirdPose): number {
    if (pose.mode === 'dead') return 0.95;
    const t = this.flapAge / FLAP_DURATION;
    if (t < 1) return flapCurve(t);
    if (pose.mode === 'idle') return -0.2;
    return pose.vy < -3 ? -0.55 + Math.sin(pose.time * 30) * 0.12 : -0.15;
  }

  private updateBody(dt: number, pose: BirdPose): void {
    const stretch = this.stretch.step(0, dt);
    this.parts.rig.scale.set(1 - stretch * 0.28, 1 + stretch * 0.55, 1);
    this.updatePitch(dt, pose);
    const sway = pose.mode === 'idle' ? Math.sin(pose.time * 1.3) * 0.45 : Math.sin(pose.time * 3) * 0.06;
    this.parts.rig.rotation.y = REST_YAW + sway;
    this.root.rotation.z = this.pitch - this.loopAngle(dt);
  }

  private updatePitch(dt: number, pose: BirdPose): void {
    if (pose.mode === 'dead') {
      this.updateDeadPitch(dt, pose);
      return;
    }
    this.spin = 0;
    const target = pose.mode === 'idle' ? Math.sin(pose.time * 2) * 0.06 : pitchFor(pose.vy);
    this.pitch = approach(this.pitch, target, pose.vy > 0 ? 22 : 7, dt);
  }

  private updateDeadPitch(dt: number, pose: BirdPose): void {
    if (pose.grounded && !this.wasGrounded) {
      this.wasGrounded = true;
      this.spin = 0;
      this.stretch.kick(-10);
    }
    if (this.wasGrounded) {
      this.pitch = approach(this.pitch, -1.15, 9, dt);
      return;
    }
    this.pitch += this.spin * dt;
    this.spin = approach(this.spin, 0, 1.2, dt);
  }

  private loopAngle(dt: number): number {
    if (this.loop <= 0) return 0;
    this.loop = Math.max(0, this.loop - dt / LOOP_DURATION);
    return easeInOut(1 - this.loop) * Math.PI * 2;
  }

  private updateFace(dt: number, pose: BirdPose): void {
    this.blink -= dt;
    if (this.blink < -0.12) this.blink = 2.2 + Math.random() * 2.5;
    const closed = pose.mode === 'dead' || this.blink < 0;
    const openness = approach(this.parts.eyes[0]?.scale.y ?? 1, closed ? 0.12 : 1, 40, dt);
    for (const eye of this.parts.eyes) eye.scale.y = openness;
  }
}
