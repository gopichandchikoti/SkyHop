export type ThemeId = 'meadow' | 'noon' | 'goldenHour' | 'dusk' | 'night' | 'aurora';

export interface LevelDef {
  id: number;
  name: string;
  theme: ThemeId;
  /** Pipes to pass to finish the level. */
  goal: number;
  /** Pipe scroll speed in units per second. */
  speed: number;
  /** Vertical opening between the top and bottom pipe. */
  gap: number;
  /** Seconds between consecutive pipes (spacing = speed * interval). */
  interval: number;
  /** Largest vertical change between consecutive gap centres. */
  maxShift: number;
  /** Probability that a pipe slides up and down. */
  movingChance: number;
  moveAmplitude: number;
  /** Oscillation rate in radians per second. */
  moveRate: number;
}

export const ENDLESS_STEP = 6;
const FIRST_MOVING_INDEX = 4;
/** The first campaign level where some pipes slide up and down. */
export const FIRST_MOVING_LEVEL = FIRST_MOVING_INDEX + 1;

interface LevelSpec {
  name: string;
  theme: ThemeId;
}

const SPECS: readonly LevelSpec[] = [
  { name: 'First Light', theme: 'meadow' },
  { name: 'Cloud Nine', theme: 'noon' },
  { name: 'High Noon', theme: 'noon' },
  { name: 'Golden Hour', theme: 'goldenHour' },
  { name: 'Amber Drift', theme: 'goldenHour' },
  { name: 'Rose Dusk', theme: 'dusk' },
  { name: 'Violet Hour', theme: 'dusk' },
  { name: 'Moonrise', theme: 'night' },
  { name: 'Starfall', theme: 'night' },
  { name: 'Aurora', theme: 'aurora' },
];

export const LEVEL_COUNT = SPECS.length;

/**
 * Difficulty curve, with i = id - 1:
 *   speed    4.20 -> 6.72 u/s   (+0.28 per level)
 *   gap      4.60 -> 2.98 u     (-0.18 per level)
 *   interval 1.75 -> 1.12 s     (-0.07 per level)
 *   maxShift 2.2  -> 6.25 u     (+0.45 per level)
 *   moving pipes appear from level 5 and slide faster and further each level
 */
function buildLevel(spec: LevelSpec, index: number): LevelDef {
  const moving = index >= FIRST_MOVING_INDEX;
  const extra = Math.max(0, index - FIRST_MOVING_INDEX);
  return {
    id: index + 1,
    name: spec.name,
    theme: spec.theme,
    goal: Math.min(24, 8 + 2 * index),
    speed: 4.2 + 0.28 * index,
    gap: 4.6 - 0.18 * index,
    interval: 1.75 - 0.07 * index,
    maxShift: 2.2 + 0.45 * index,
    movingChance: moving ? Math.min(0.8, 0.3 + 0.1 * extra) : 0,
    moveAmplitude: moving ? 0.6 + 0.1 * extra : 0,
    moveRate: moving ? 1.1 + 0.1 * extra : 0,
  };
}

export const LEVELS: readonly LevelDef[] = SPECS.map(buildLevel);

const FIRST_LEVEL: LevelDef = buildLevel({ name: 'First Light', theme: 'meadow' }, 0);

/** Out-of-range and non-numeric ids resolve to the nearest valid level (NaN falls back to level 1). */
export function getLevel(id: number): LevelDef {
  const clamped = Math.min(LEVEL_COUNT, Math.max(1, Math.floor(id)));
  return LEVELS[clamped - 1] ?? FIRST_LEVEL;
}

/** Endless mode walks the same curve one step every ENDLESS_STEP pipes, then holds the final level. */
export function endlessLevel(pipesPassed: number): LevelDef {
  return getLevel(1 + Math.floor(Math.max(0, pipesPassed) / ENDLESS_STEP));
}

export function pipeSpacing(level: LevelDef): number {
  return level.speed * level.interval;
}

/** Assist mode widens every opening so the game is approachable for newer players. */
export const ASSIST_GAP_SCALE = 1.25;
