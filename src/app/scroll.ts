import type { Phase } from '../core/phase';

/** Only the menu drifts on its own: in-run scenes hold still until the player flaps. */
const AMBIENT_PHASES: readonly Phase[] = ['menu'];

export interface ScrollFrame {
  dt: number;
  phase: Phase;
  /** Distance travelled this run, already extrapolated to the render time. */
  distance: number;
  ambientSpeed: number;
}

/**
 * Tracks how far the backdrop has scrolled. It follows the real distance while playing, drifts gently on
 * menus so the sky is never static, and holds still when crashed or paused.
 */
export class ScrollTracker {
  scroll = 0;
  time = 0;
  private lastDistance = 0;

  reset(): void {
    this.lastDistance = 0;
  }

  advance(frame: ScrollFrame): void {
    this.time += frame.dt;
    if (frame.phase === 'playing') {
      this.scroll += Math.max(0, frame.distance - this.lastDistance);
      this.lastDistance = frame.distance;
    } else if (AMBIENT_PHASES.includes(frame.phase)) {
      this.scroll += frame.ambientSpeed * frame.dt;
    }
  }
}
