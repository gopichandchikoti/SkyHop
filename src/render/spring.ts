/** Damped spring for squash-and-stretch and similar physical easing. Sub-steps keep it stable on slow frames. */
export class Spring {
  value: number;
  velocity = 0;

  constructor(
    initial = 0,
    private readonly stiffness = 220,
    private readonly damping = 13,
  ) {
    this.value = initial;
  }

  step(target: number, dt: number): number {
    const steps = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const accel = this.stiffness * (target - this.value) - this.damping * this.velocity;
      this.velocity += accel * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }

  kick(impulse: number): void {
    this.velocity += impulse;
  }

  reset(value = 0): void {
    this.value = value;
    this.velocity = 0;
  }
}

/** Frame-rate independent exponential approach: reaches ~63% of the way after 1/rate seconds. */
export function approach(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * dt);
}

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
export const mix = (from: number, to: number, t: number): number => from + (to - from) * t;
export const wrap = (value: number, length: number): number => ((value % length) + length) % length;
