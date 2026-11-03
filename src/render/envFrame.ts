import type { Framing } from './stage';

export interface EnvFrame {
  scroll: number;
  time: number;
  dt: number;
  aspect: number;
  pixelRatio: number;
  framing: Framing;
}
