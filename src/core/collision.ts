import { WORLD } from './config';
import { gapCenter, type Pipe } from './pipes';

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const FAR = 1000;

export function circleHitsRect(cx: number, cy: number, radius: number, rect: Rect): boolean {
  const nearestX = Math.min(rect.x1, Math.max(rect.x0, cx));
  const nearestY = Math.min(rect.y1, Math.max(rect.y0, cy));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

/** The four solid parts of a pipe pair: body and wider cap, above and below the opening. */
export function pipeRects(pipe: Pipe): Rect[] {
  const centre = gapCenter(pipe);
  const bottomEdge = centre - pipe.gap / 2;
  const topEdge = centre + pipe.gap / 2;
  const body = WORLD.pipeWidth / 2;
  const cap = WORLD.capWidth / 2;
  const capH = WORLD.capHeight;
  return [
    { x0: pipe.x - body, x1: pipe.x + body, y0: -FAR, y1: bottomEdge - capH },
    { x0: pipe.x - cap, x1: pipe.x + cap, y0: bottomEdge - capH, y1: bottomEdge },
    { x0: pipe.x - cap, x1: pipe.x + cap, y0: topEdge, y1: topEdge + capH },
    { x0: pipe.x - body, x1: pipe.x + body, y0: topEdge + capH, y1: FAR },
  ];
}

export function birdHitsPipe(birdY: number, pipe: Pipe): boolean {
  if (Math.abs(pipe.x - WORLD.birdX) > WORLD.capWidth / 2 + WORLD.hitRadius) return false;
  return pipeRects(pipe).some((rect) => circleHitsRect(WORLD.birdX, birdY, WORLD.hitRadius, rect));
}
