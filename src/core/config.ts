/** World units: 1 unit is roughly one bird-body diameter. +y is up, the bird sits at x = 0. */
export const WORLD = {
  groundTop: 0,
  ceiling: 14,
  birdX: 0,
  startY: 7,
  birdRadius: 0.5,
  hitRadius: 0.36,
  pipeWidth: 1.5,
  capWidth: 1.95,
  capHeight: 0.65,
  firstPipeX: 12,
  spawnX: 34,
  /** The bird is centred, so pipes must outlive the widest view (about 32 units each side) before despawning. */
  despawnX: -34,
  gapMarginBottom: 1.4,
  gapMarginTop: 1.0,
} as const;

/** Fixed-step physics so gameplay is identical at 30, 60, 120 or 144 Hz displays. */
export const PHYSICS = {
  step: 1 / 120,
  gravity: 32,
  flapVelocity: 9.2,
  maxFallSpeed: 17,
  maxFrameDelta: 0.1,
  crashPopVelocity: 3.2,
  settleDelay: 0.7,
  speedEasing: 3,
} as const;

/** Upward speed (u/s) a human can sustain comfortably; used to reject unreachable pipe layouts. */
export const COMFORT_CLIMB = 3;

/** Share of the free-fall time between two pipes that a generated drop may use. Leaves room to react. */
export const FALL_COMFORT = 0.6;
