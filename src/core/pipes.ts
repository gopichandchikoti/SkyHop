import { COMFORT_CLIMB, FALL_COMFORT, PHYSICS, WORLD } from './config';
import { pipeSpacing, type LevelDef } from './levels';
import type { Rng } from './rng';

export interface Pipe {
  id: number;
  x: number;
  baseY: number;
  gap: number;
  amplitude: number;
  rate: number;
  phase: number;
  age: number;
  scored: boolean;
}

/** Vertical centre of the opening, optionally projected `lookAhead` seconds into the future. */
export function gapCenter(pipe: Pipe, lookAhead = 0): number {
  if (pipe.amplitude === 0) return pipe.baseY;
  return pipe.baseY + pipe.amplitude * Math.sin(pipe.rate * (pipe.age + lookAhead) + pipe.phase);
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export class PipeField {
  pipes: Pipe[] = [];
  private nextId = 0;
  private lastBase: number = WORLD.startY;
  private lastAmplitude = 0;

  constructor(private rng: Rng) {}

  reset(level: LevelDef, rng: Rng): void {
    this.rng = rng;
    this.pipes = [];
    this.nextId = 0;
    this.lastBase = WORLD.startY;
    this.lastAmplitude = 0;
    this.fill(level);
  }

  /** Keeps pipes spawned out to WORLD.spawnX, always a full spacing behind the previous one. */
  fill(level: LevelDef): void {
    const spacing = pipeSpacing(level);
    const last = this.pipes[this.pipes.length - 1];
    let x = last ? last.x + spacing : WORLD.firstPipeX;
    while (x <= WORLD.spawnX) {
      this.pipes.push(this.spawn(level, x));
      x += spacing;
    }
  }

  advance(dt: number, speed: number): void {
    for (const pipe of this.pipes) {
      pipe.x -= speed * dt;
      pipe.age += dt;
    }
    const alive = this.pipes.findIndex((pipe) => pipe.x >= WORLD.despawnX);
    if (alive !== 0) this.pipes.splice(0, alive === -1 ? this.pipes.length : alive);
  }

  nextUnscored(): Pipe | undefined {
    return this.pipes.find((pipe) => !pipe.scored);
  }

  private spawn(level: LevelDef, x: number): Pipe {
    const moving = level.movingChance > 0 && this.rng.chance(level.movingChance);
    const amplitude = moving ? level.moveAmplitude : 0;
    const baseY = this.pickCenter(level, amplitude);
    this.lastBase = baseY;
    this.lastAmplitude = amplitude;
    return {
      id: this.nextId++,
      x,
      baseY,
      gap: level.gap,
      amplitude,
      rate: level.moveRate,
      phase: this.rng.range(0, Math.PI * 2),
      age: 0,
      scored: false,
    };
  }

  /**
   * Picks the next gap centre inside the playable band. Moves are capped by what a player can do
   * between two pipes: climbing is limited by flap rate, and dropping by gravity (there is no
   * downward thrust), so no generated layout is physically unreachable.
   */
  private pickCenter(level: LevelDef, amplitude: number): number {
    const half = level.gap / 2;
    const min = WORLD.groundTop + WORLD.gapMarginBottom + half + amplitude;
    const max = WORLD.ceiling - WORLD.gapMarginTop - half - amplitude;
    const { up, down } = this.reach(level, amplitude);
    const lo = Math.max(min, this.lastBase - down);
    const hi = Math.min(max, this.lastBase + up);
    if (lo > hi) return clamp((lo + hi) / 2, min, max);
    return this.rng.range(lo, hi);
  }

  private reach(level: LevelDef, amplitude: number): { up: number; down: number } {
    const slack = (level.gap - 2 * WORLD.hitRadius) / 2;
    const wobble = this.lastAmplitude + amplitude;
    const clearance = WORLD.capWidth + 2 * WORLD.hitRadius;
    const travel = Math.max(0, (pipeSpacing(level) - clearance) / level.speed);
    const fall = 0.5 * PHYSICS.gravity * (FALL_COMFORT * travel) ** 2;
    const climb = COMFORT_CLIMB * level.interval * 0.8;
    return {
      up: Math.min(level.maxShift, Math.max(0, climb + slack - wobble)),
      down: Math.min(level.maxShift, Math.max(0, fall + slack - wobble)),
    };
  }
}
