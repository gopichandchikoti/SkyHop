import type { ThemeId } from '../core/levels';
import type { SessionEvent } from '../core/session';
import type { SkinId } from '../core/skins';
import type { WorldFrame } from '../render/world';

/** What the app needs from the 3D renderer, so tests can substitute a fake without WebGL. */
export interface WorldPort {
  setTheme(id: ThemeId, instant: boolean): void;
  setSkin(skin: SkinId): void;
  setPixelRatio(ratio: number): void;
  reset(): void;
  resize(): void;
  handle(event: SessionEvent, reducedMotion: boolean): void;
  render(frame: WorldFrame): void;
}
