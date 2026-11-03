export type Phase =
  | 'menu'
  | 'ready'
  | 'countdown'
  | 'playing'
  | 'dying'
  | 'levelComplete'
  | 'gameOver'
  | 'paused';

export type PhaseEvent =
  | 'flap'
  | 'crash'
  | 'settled'
  | 'complete'
  | 'pause'
  | 'resume'
  | 'countdownDone'
  | 'quit';

/** Placeholder: after a countdown the game returns to wherever it was paused. */
const RESUME_TARGET = 'resume-target';
type Target = Phase | typeof RESUME_TARGET;

const TRANSITIONS: Record<Phase, Partial<Record<PhaseEvent, Target>>> = {
  menu: {},
  ready: { flap: 'playing', pause: 'paused', quit: 'menu' },
  countdown: { countdownDone: RESUME_TARGET, pause: 'paused', quit: 'menu' },
  playing: { crash: 'dying', complete: 'levelComplete', pause: 'paused', quit: 'menu' },
  dying: { settled: 'gameOver', quit: 'menu' },
  levelComplete: { quit: 'menu' },
  gameOver: { quit: 'menu' },
  paused: { resume: 'countdown', quit: 'menu' },
};

export type PhaseListener = (phase: Phase, previous: Phase) => void;

export class PhaseMachine {
  phase: Phase = 'menu';
  private pausedFrom: 'ready' | 'playing' = 'ready';
  private readonly listeners = new Set<PhaseListener>();

  onChange(listener: PhaseListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Applies an event if it is legal in the current phase. Returns whether the phase changed. */
  send(event: PhaseEvent): boolean {
    const target = TRANSITIONS[this.phase][event];
    if (!target) return false;
    if (event === 'pause' && (this.phase === 'ready' || this.phase === 'playing')) {
      this.pausedFrom = this.phase;
    }
    this.enter(target === RESUME_TARGET ? this.pausedFrom : target);
    return true;
  }

  /** Unconditional jump used when a new run begins. */
  force(phase: Phase): void {
    this.enter(phase);
  }

  private enter(next: Phase): void {
    const previous = this.phase;
    this.phase = next;
    this.listeners.forEach((listener) => listener(next, previous));
  }
}
