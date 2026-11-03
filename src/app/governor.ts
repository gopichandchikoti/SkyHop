const WINDOW_SECONDS = 1.5;
const WARMUP_SECONDS = 1.2;
const LOW_FPS = 42;
const MIN_RATIO = 0.75;
const MAX_FRAME = 0.25;

/** Builds the resolution steps from the device ratio down to MIN_RATIO. */
export function ratioSteps(deviceRatio: number): number[] {
  const start = Math.min(Math.max(deviceRatio, 1), 2);
  const steps = [start, start * 0.75, 1, MIN_RATIO].filter((ratio) => ratio <= start && ratio >= MIN_RATIO);
  return [...new Set(steps.map((ratio) => Math.round(ratio * 100) / 100))].sort((a, b) => b - a);
}

/**
 * Lowers render resolution when frames come slowly, so weak GPUs keep a steady frame rate instead of
 * stuttering. It only ever steps down, which avoids visible oscillation.
 */
export class PerformanceGovernor {
  private readonly steps: number[];
  private index = 0;
  private frames = 0;
  private seconds = 0;
  private warmup = WARMUP_SECONDS;

  constructor(deviceRatio: number) {
    this.steps = ratioSteps(deviceRatio);
  }

  get ratio(): number {
    return this.steps[this.index] ?? 1;
  }

  /** Feed each frame's duration. Returns the new pixel ratio when it changes, otherwise null. */
  sample(frameSeconds: number): number | null {
    if (frameSeconds > MAX_FRAME) {
      this.frames = 0;
      this.seconds = 0;
      return null;
    }
    if (this.warmup > 0) {
      this.warmup -= frameSeconds;
      return null;
    }
    this.frames += 1;
    this.seconds += frameSeconds;
    if (this.seconds < WINDOW_SECONDS) return null;
    const fps = this.frames / this.seconds;
    this.frames = 0;
    this.seconds = 0;
    if (fps >= LOW_FPS || this.index >= this.steps.length - 1) return null;
    this.index += 1;
    return this.ratio;
  }
}
