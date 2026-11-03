import { PHYSICS } from './config';

/**
 * Converts variable frame times into a whole number of fixed simulation steps, so gameplay speed does
 * not depend on the display refresh rate. `alpha` is the leftover fraction for render interpolation.
 */
export class FixedStepper {
  private accumulator = 0;

  constructor(
    private readonly step: number = PHYSICS.step,
    private readonly maxFrame: number = PHYSICS.maxFrameDelta,
  ) {}

  /** Returns how many fixed steps to run for this frame. Long stalls (tab switch) are clamped. */
  advance(frameSeconds: number): number {
    this.accumulator += Math.min(Math.max(frameSeconds, 0), this.maxFrame);
    const steps = Math.floor(this.accumulator / this.step);
    this.accumulator -= steps * this.step;
    return steps;
  }

  get alpha(): number {
    return this.accumulator / this.step;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
