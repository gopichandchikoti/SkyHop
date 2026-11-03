import { describe, expect, it } from 'vitest';
import { LEVELS, LEVEL_COUNT, ENDLESS_STEP } from '../src/core/levels';
import { GameSession } from '../src/core/session';
import { runBot } from './helpers/autopilot';

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 17 + 1);

function clears(levelId: number, seed: number, assist: boolean): { ok: boolean; score: number } {
  const session = new GameSession({ seed: 1, assist });
  session.begin({ kind: 'level', levelId }, seed);
  const result = runBot(session, 240);
  return { ok: result.phase === 'levelComplete', score: result.score };
}

describe('fairness: an autopilot can clear every generated level', () => {
  for (const level of LEVELS) {
    it(`level ${level.id} "${level.name}" clears on ${SEEDS.length} seeds`, () => {
      const failures = SEEDS.map((seed) => ({ seed, ...clears(level.id, seed, false) })).filter((run) => !run.ok);
      expect(failures).toEqual([]);
    });
  }

  it('assist mode is at least as clearable on the hardest level', () => {
    const failures = SEEDS.map((seed) => ({ seed, ...clears(LEVEL_COUNT, seed, true) })).filter((run) => !run.ok);
    expect(failures).toEqual([]);
  });

  it('endless mode survives well past the last difficulty step', () => {
    const target = LEVEL_COUNT * ENDLESS_STEP + 40;
    for (const seed of SEEDS.slice(0, 15)) {
      const session = new GameSession({ seed: 1, assist: false });
      session.begin({ kind: 'endless' }, seed);
      const result = runBot(session, 900, target);
      expect(result.score, `seed ${seed}`).toBe(target);
    }
  });
});
