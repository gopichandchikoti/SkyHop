import { PHYSICS, WORLD } from '../../src/core/config';
import { gapCenter, type Pipe } from '../../src/core/pipes';
import type { GameSession } from '../../src/core/session';

/** Height gained by one flap: v^2 / (2g) with the PHYSICS constants. */
const RISE_PER_FLAP = PHYSICS.flapVelocity ** 2 / (2 * PHYSICS.gravity);
const CLEAR = WORLD.capWidth / 2 + WORLD.hitRadius;
const EDGE_MARGIN = 0.1;

interface Opening {
  centre: number;
  low: number;
  high: number;
}

/** Safe vertical band of a pipe's opening, widened for pipes that slide while the bird passes. */
function opening(pipe: Pipe, speed: number): Opening {
  const arrival = Math.max(0, (pipe.x - WORLD.birdX) / speed);
  const centre = gapCenter(pipe, arrival);
  const margin = WORLD.hitRadius + EDGE_MARGIN + pipe.amplitude * pipe.rate * 0.2;
  return { centre, low: centre - pipe.gap / 2 + margin, high: centre + pipe.gap / 2 - margin };
}

const mix = (from: number, to: number, t: number): number => from + (to - from) * t;
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/**
 * A competent but simple controller. It aims for the lower-middle of the next opening so a flap
 * cannot overshoot the top, and blends toward the following opening while leaving the current one,
 * so it never flaps upward just before a long drop.
 */
export function autopilotWantsFlap(session: GameSession): boolean {
  if (session.flow.phase === 'ready') return true;
  const [current, following] = session.pipes.filter((pipe) => pipe.x + CLEAR > WORLD.birdX);
  if (!current) return false;
  const here = opening(current, session.speed);
  let floor = here.centre - RISE_PER_FLAP / 2;
  if (following) {
    const progress = clamp((CLEAR - current.x) / (2 * CLEAR), 0, 1);
    floor = mix(floor, opening(following, session.speed).centre - RISE_PER_FLAP / 2, progress);
  }
  if (current.x <= CLEAR) floor = Math.max(here.low + 0.05, Math.min(floor, here.high - RISE_PER_FLAP - 0.05));
  return session.bird.y < floor && session.bird.vy < 1.5;
}

export interface BotResult {
  phase: string;
  score: number;
  seconds: number;
}

/** Drives a session with the autopilot until it leaves play or the time budget runs out. */
export function runBot(session: GameSession, maxSeconds: number, maxScore = Infinity): BotResult {
  let seconds = 0;
  while (seconds < maxSeconds && session.score < maxScore) {
    const { phase } = session.flow;
    if (phase !== 'ready' && phase !== 'playing') break;
    if (autopilotWantsFlap(session)) session.requestFlap();
    session.step(PHYSICS.step);
    seconds += PHYSICS.step;
  }
  return { phase: session.flow.phase, score: session.score, seconds };
}
