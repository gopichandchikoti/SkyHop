export interface LoopDeps {
  request: (callback: FrameRequestCallback) => number;
  cancel: (handle: number) => void;
}

const browserDeps = (): LoopDeps => ({
  request: (callback) => window.requestAnimationFrame(callback),
  cancel: (handle) => window.cancelAnimationFrame(handle),
});

/** requestAnimationFrame driver that reports the elapsed seconds since the previous frame. */
export class GameLoop {
  private handle: number | null = null;
  private last = 0;

  constructor(
    private readonly onFrame: (dtSeconds: number) => void,
    private readonly deps: LoopDeps = browserDeps(),
  ) {}

  get running(): boolean {
    return this.handle !== null;
  }

  start(): void {
    if (this.handle !== null) return;
    this.last = 0;
    this.handle = this.deps.request(this.tick);
  }

  stop(): void {
    if (this.handle !== null) this.deps.cancel(this.handle);
    this.handle = null;
  }

  private readonly tick = (nowMs: number): void => {
    const dt = this.last === 0 ? 0 : (nowMs - this.last) / 1000;
    this.last = nowMs;
    this.handle = this.deps.request(this.tick);
    this.onFrame(dt);
  };
}
