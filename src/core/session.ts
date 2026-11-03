import { BirdBody } from './bird';
import { birdHitsPipe } from './collision';
import { PHYSICS, WORLD } from './config';
import { ASSIST_GAP_SCALE, endlessLevel, getLevel, type LevelDef } from './levels';
import { PhaseMachine } from './phase';
import { PipeField, type Pipe } from './pipes';
import { createRng, type Rng } from './rng';

export type SessionMode = { kind: 'level'; levelId: number } | { kind: 'endless' };
export type CrashCause = 'pipe' | 'ground';

export type SessionEvent =
  | { type: 'flap' }
  | { type: 'score'; score: number; pipe: Pipe }
  | { type: 'levelUp'; level: LevelDef }
  | { type: 'complete'; level: LevelDef }
  | { type: 'crash'; cause: CrashCause }
  | { type: 'settled' };

export type SessionListener = (event: SessionEvent) => void;

export interface SessionOptions {
  seed: number;
  assist: boolean;
}

/** Headless game rules: no rendering or browser APIs, so it runs identically in tests and in play. */
export class GameSession {
  readonly bird = new BirdBody();
  readonly flow = new PhaseMachine();
  readonly field = new PipeField(createRng(0));
  mode: SessionMode = { kind: 'level', levelId: 1 };
  level: LevelDef = getLevel(1);
  score = 0;
  speed = getLevel(1).speed;
  distance = 0;
  elapsed = 0;
  crashCause: CrashCause | null = null;
  assist: boolean;
  private active: LevelDef = getLevel(1);
  private pendingFlap = false;
  private settleTimer = 0;
  private readonly seeds: Rng;
  private readonly listeners = new Set<SessionListener>();

  constructor(options: SessionOptions) {
    this.assist = options.assist;
    this.seeds = createRng(options.seed);
  }

  on(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Starts (or restarts) a run in the ready phase. Pass a seed to replay an exact layout. */
  begin(mode: SessionMode, seed?: number): void {
    this.mode = mode;
    this.setLevel(mode.kind === 'level' ? getLevel(mode.levelId) : endlessLevel(0));
    this.score = 0;
    this.distance = 0;
    this.elapsed = 0;
    this.speed = this.level.speed;
    this.crashCause = null;
    this.pendingFlap = false;
    this.settleTimer = 0;
    this.bird.reset();
    this.field.reset(this.active, createRng(seed ?? Math.floor(this.seeds.next() * 4294967296)));
    this.flow.force('ready');
  }

  quit(): void {
    this.flow.send('quit');
  }

  /** Records a flap request; it is applied on the next fixed step so input is never lost between frames. */
  requestFlap(): void {
    const { phase } = this.flow;
    if (phase === 'ready' || phase === 'playing') this.pendingFlap = true;
  }

  get pipes(): readonly Pipe[] {
    return this.field.pipes;
  }

  get goal(): number | null {
    return this.mode.kind === 'level' ? this.level.goal : null;
  }

  step(dt: number): void {
    const { phase } = this.flow;
    if (phase === 'ready') this.stepReady();
    else if (phase === 'playing') this.stepPlaying(dt);
    else if (phase === 'dying') this.stepDying(dt);
  }

  private stepReady(): void {
    if (!this.pendingFlap) return;
    this.flow.send('flap');
    this.applyFlap();
  }

  private stepPlaying(dt: number): void {
    if (this.pendingFlap) this.applyFlap();
    this.speed = this.easeToward(this.speed, this.level.speed, PHYSICS.speedEasing * dt);
    this.bird.step(dt);
    this.field.advance(dt, this.speed);
    this.field.fill(this.active);
    this.distance += this.speed * dt;
    this.elapsed += dt;
    if (this.detectCrash()) return;
    this.detectScore();
  }

  private stepDying(dt: number): void {
    this.bird.step(dt);
    if (this.bird.touchingGround) this.bird.settleOnGround();
    this.settleTimer += dt;
    if (this.settleTimer >= PHYSICS.settleDelay && this.flow.send('settled')) this.emit({ type: 'settled' });
  }

  private applyFlap(): void {
    this.pendingFlap = false;
    this.bird.flap();
    this.emit({ type: 'flap' });
  }

  private detectCrash(): boolean {
    let cause: CrashCause | null = null;
    if (this.bird.touchingGround) cause = 'ground';
    else if (this.pipes.some((pipe) => birdHitsPipe(this.bird.y, pipe))) cause = 'pipe';
    if (!cause) return false;
    this.crashCause = cause;
    this.flow.send('crash');
    if (cause === 'ground') this.bird.settleOnGround();
    else this.bird.vy = PHYSICS.crashPopVelocity;
    this.emit({ type: 'crash', cause });
    return true;
  }

  private detectScore(): void {
    const pipe = this.field.nextUnscored();
    if (!pipe || pipe.x > WORLD.birdX) return;
    pipe.scored = true;
    this.score += 1;
    this.emit({ type: 'score', score: this.score, pipe });
    if (this.mode.kind === 'level') this.checkLevelComplete();
    else this.checkEndlessProgress();
  }

  private checkLevelComplete(): void {
    if (this.score < this.level.goal) return;
    this.bird.vy = 0;
    this.flow.send('complete');
    this.emit({ type: 'complete', level: this.level });
  }

  private checkEndlessProgress(): void {
    const next = endlessLevel(this.score);
    if (next.id === this.level.id) return;
    this.setLevel(next);
    this.emit({ type: 'levelUp', level: next });
  }

  private setLevel(level: LevelDef): void {
    this.level = level;
    const gap = this.assist ? level.gap * ASSIST_GAP_SCALE : level.gap;
    this.active = { ...level, gap };
  }

  private easeToward(value: number, target: number, maxDelta: number): number {
    return value + Math.max(-maxDelta, Math.min(maxDelta, target - value));
  }

  private emit(event: SessionEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }
}
