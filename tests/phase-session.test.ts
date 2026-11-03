import { describe, expect, it } from 'vitest';
import { PHYSICS, WORLD } from '../src/core/config';
import { ASSIST_GAP_SCALE, getLevel } from '../src/core/levels';
import { PhaseMachine, type Phase } from '../src/core/phase';
import { GameSession, type SessionEvent } from '../src/core/session';

describe('PhaseMachine', () => {
  it('follows the legal path ready -> playing -> dying -> gameOver', () => {
    const flow = new PhaseMachine();
    flow.force('ready');
    expect(flow.send('flap')).toBe(true);
    expect(flow.send('crash')).toBe(true);
    expect(flow.send('settled')).toBe(true);
    expect(flow.phase).toBe('gameOver');
  });

  it('rejects illegal events without changing phase', () => {
    const flow = new PhaseMachine();
    expect(flow.send('flap')).toBe(false);
    flow.force('ready');
    expect(flow.send('crash')).toBe(false);
    expect(flow.send('complete')).toBe(false);
    expect(flow.phase).toBe('ready');
  });

  it('returns to where it was paused after a countdown', () => {
    const flow = new PhaseMachine();
    flow.force('playing');
    flow.send('pause');
    expect(flow.phase).toBe('paused');
    flow.send('resume');
    expect(flow.phase).toBe('countdown');
    flow.send('pause');
    flow.send('resume');
    flow.send('countdownDone');
    expect(flow.phase).toBe('playing');

    flow.force('ready');
    flow.send('pause');
    flow.send('resume');
    flow.send('countdownDone');
    expect(flow.phase).toBe('ready');
  });

  it('notifies listeners and supports unsubscribing', () => {
    const flow = new PhaseMachine();
    const seen: string[] = [];
    const off = flow.onChange((next, prev) => seen.push(`${prev}>${next}`));
    flow.force('ready');
    off();
    flow.send('flap');
    expect(seen).toEqual(['menu>ready']);
  });

  it('can quit to the menu from every active phase', () => {
    const phases: Phase[] = ['ready', 'countdown', 'playing', 'dying', 'levelComplete', 'gameOver', 'paused'];
    for (const phase of phases) {
      const flow = new PhaseMachine();
      flow.force(phase);
      expect(flow.send('quit'), phase).toBe(true);
      expect(flow.phase).toBe('menu');
    }
  });
});

function collect(session: GameSession): SessionEvent[] {
  const events: SessionEvent[] = [];
  session.on((event) => events.push(event));
  return events;
}

function run(session: GameSession, seconds: number, flapEvery = 0): void {
  const steps = Math.round(seconds / PHYSICS.step);
  for (let i = 0; i < steps; i++) {
    if (flapEvery > 0 && i % Math.round(flapEvery / PHYSICS.step) === 0) session.requestFlap();
    session.step(PHYSICS.step);
  }
}

describe('GameSession', () => {
  it('starts in ready, hovers until the first flap, then plays', () => {
    const session = new GameSession({ seed: 1, assist: false });
    session.begin({ kind: 'level', levelId: 1 }, 5);
    expect(session.flow.phase).toBe('ready');
    run(session, 1);
    expect(session.bird.y).toBe(WORLD.startY);
    expect(session.elapsed).toBe(0);
    session.requestFlap();
    session.step(PHYSICS.step);
    expect(session.flow.phase).toBe('playing');
    expect(session.bird.vy).toBeGreaterThan(0);
  });

  it('ignores flaps outside ready or playing', () => {
    const session = new GameSession({ seed: 1, assist: false });
    session.requestFlap();
    session.step(PHYSICS.step);
    expect(session.flow.phase).toBe('menu');
    session.begin({ kind: 'endless' }, 1);
    session.flow.force('paused');
    session.requestFlap();
    session.step(PHYSICS.step);
    expect(session.bird.vy).toBe(0);
  });

  it('crashes into the ground and lands in game over after the settle delay', () => {
    const session = new GameSession({ seed: 1, assist: false });
    const events = collect(session);
    session.begin({ kind: 'level', levelId: 1 }, 5);
    session.requestFlap();
    run(session, 3);
    expect(session.crashCause).toBe('ground');
    expect(session.flow.phase).toBe('gameOver');
    expect(session.bird.y).toBeCloseTo(WORLD.groundTop + WORLD.hitRadius, 6);
    expect(events.map((e) => e.type)).toEqual(['flap', 'crash', 'settled']);
  });

  it('crashes into a pipe, pops up and then falls', () => {
    const session = new GameSession({ seed: 1, assist: false });
    session.begin({ kind: 'level', levelId: 1 }, 5);
    const first = session.pipes[0];
    if (first) first.baseY = 11;
    session.requestFlap();
    for (let i = 0; i < 4000 && session.flow.phase === 'ready'; i++) session.step(PHYSICS.step);
    run(session, 4.5, 0.28);
    expect(['dying', 'gameOver']).toContain(session.flow.phase);
    expect(session.crashCause).toBe('pipe');
  });

  it('scores each pipe exactly once and tracks distance', () => {
    const session = new GameSession({ seed: 1, assist: false });
    const events = collect(session);
    session.begin({ kind: 'level', levelId: 1 }, 5);
    session.bird.reset(WORLD.startY);
    session.flow.force('playing');
    const pipe = session.pipes[0];
    if (pipe) {
      pipe.baseY = WORLD.startY;
      pipe.x = 0.05;
    }
    for (let i = 0; i < 12; i++) {
      session.bird.vy = 0;
      session.step(PHYSICS.step);
    }
    const scores = events.filter((e) => e.type === 'score');
    expect(scores).toHaveLength(1);
    expect(session.score).toBe(1);
    expect(session.distance).toBeGreaterThan(0);
    expect(session.goal).toBe(getLevel(1).goal);
  });

  it('completes a level when the goal is reached', () => {
    const session = new GameSession({ seed: 1, assist: false });
    const events = collect(session);
    session.begin({ kind: 'level', levelId: 1 }, 5);
    session.flow.force('playing');
    session.score = getLevel(1).goal - 1;
    const pipe = session.pipes[0];
    if (pipe) {
      pipe.baseY = WORLD.startY;
      pipe.x = 0;
    }
    session.bird.vy = 0;
    session.step(PHYSICS.step);
    expect(session.flow.phase).toBe('levelComplete');
    expect(events.some((e) => e.type === 'complete')).toBe(true);
  });

  it('raises difficulty in endless mode without ever completing', () => {
    const session = new GameSession({ seed: 1, assist: false });
    const events = collect(session);
    session.begin({ kind: 'endless' }, 5);
    expect(session.goal).toBeNull();
    session.flow.force('playing');
    session.score = 5;
    const pipe = session.pipes[0];
    if (pipe) {
      pipe.baseY = WORLD.startY;
      pipe.x = 0;
    }
    session.bird.vy = 0;
    session.step(PHYSICS.step);
    expect(session.level.id).toBe(2);
    expect(events.some((e) => e.type === 'levelUp')).toBe(true);
    expect(events.some((e) => e.type === 'complete')).toBe(false);
  });

  it('eases the scroll speed toward the level speed', () => {
    const session = new GameSession({ seed: 1, assist: false });
    session.begin({ kind: 'endless' }, 5);
    session.flow.force('playing');
    session.level = getLevel(4);
    const before = session.speed;
    session.bird.vy = 5;
    session.step(0.1);
    expect(session.speed).toBeGreaterThan(before);
    expect(session.speed).toBeLessThan(getLevel(4).speed);
  });

  it('widens gaps in assist mode and replays identical layouts for a seed', () => {
    const plain = new GameSession({ seed: 1, assist: false });
    const assisted = new GameSession({ seed: 1, assist: true });
    plain.begin({ kind: 'level', levelId: 3 }, 77);
    assisted.begin({ kind: 'level', levelId: 3 }, 77);
    expect(assisted.pipes[0]?.gap).toBeCloseTo((plain.pipes[0]?.gap ?? 0) * ASSIST_GAP_SCALE);
    const again = new GameSession({ seed: 1, assist: false });
    again.begin({ kind: 'level', levelId: 3 }, 77);
    expect(again.pipes.map((p) => p.baseY)).toEqual(plain.pipes.map((p) => p.baseY));
  });

  it('draws fresh layouts from its own seed sequence and can quit', () => {
    const session = new GameSession({ seed: 9, assist: false });
    session.begin({ kind: 'level', levelId: 2 });
    const first = session.pipes.map((p) => p.baseY);
    session.begin({ kind: 'level', levelId: 2 });
    expect(session.pipes.map((p) => p.baseY)).not.toEqual(first);
    session.quit();
    expect(session.flow.phase).toBe('menu');
  });

  it('does not simulate while paused or counting down', () => {
    const session = new GameSession({ seed: 1, assist: false });
    session.begin({ kind: 'level', levelId: 1 }, 3);
    session.requestFlap();
    run(session, 0.2);
    session.flow.send('pause');
    const y = session.bird.y;
    run(session, 2);
    expect(session.bird.y).toBe(y);
    session.flow.send('resume');
    run(session, 1);
    expect(session.bird.y).toBe(y);
  });
});
