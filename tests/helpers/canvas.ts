import { vi } from 'vitest';

/** jsdom has no 2D canvas. Give procedural textures a recording stand-in so scene code can run. */
export function stubCanvas(): void {
  const gradient = { addColorStop: vi.fn() };
  const context = {
    fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), fill: vi.fn(),
    createLinearGradient: vi.fn(() => gradient), fillStyle: '',
  };
  HTMLCanvasElement.prototype.getContext = vi.fn(() => context) as never;
}

/** For the "canvas unavailable" branch of texture helpers. */
export function stubCanvasUnavailable(): void {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
}
