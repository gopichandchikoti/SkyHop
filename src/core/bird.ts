import { PHYSICS, WORLD } from './config';

const GROUND_EPSILON = 1e-6;

export class BirdBody {
  y: number = WORLD.startY;
  prevY: number = WORLD.startY;
  vy = 0;

  reset(y: number = WORLD.startY): void {
    this.y = y;
    this.prevY = y;
    this.vy = 0;
  }

  flap(): void {
    this.vy = PHYSICS.flapVelocity;
  }

  /** Semi-implicit Euler: velocity first, then position. The ceiling is a soft stop, not a hazard. */
  step(dt: number): void {
    this.prevY = this.y;
    this.vy = Math.max(-PHYSICS.maxFallSpeed, this.vy - PHYSICS.gravity * dt);
    this.y += this.vy * dt;
    const top = WORLD.ceiling - WORLD.hitRadius;
    if (this.y > top) {
      this.y = top;
      this.vy = Math.min(this.vy, 0);
    }
  }

  get touchingGround(): boolean {
    return this.y - WORLD.hitRadius <= WORLD.groundTop + GROUND_EPSILON;
  }

  /** Rests the bird at the same height the crash is detected at, so it cannot sink and snap back. */
  settleOnGround(): void {
    this.y = WORLD.groundTop + WORLD.hitRadius;
    this.vy = 0;
  }
}
