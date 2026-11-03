import type { LevelDef } from '../core/levels';
import type { SkinId } from '../core/skins';
import type { Settings } from '../storage/repository';

export interface UiActions {
  playLevel(levelId: number): void;
  playEndless(): void;
  retry(): void;
  nextLevel(): void;
  toMenu(): void;
  pause(): void;
  resume(): void;
  restartLevel(): void;
  toggleSound(): void;
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void;
  resetProgress(): void;
  reload(): void;
  /** Called after UI sound cues so the app can unlock audio and play a click. */
  clicked(): void;
}

export interface MenuView {
  nextLevel: LevelDef;
  bestEndless: number;
  sfx: boolean;
  storageOk: boolean;
}

export interface LevelsView {
  unlocked: number;
  completed: readonly number[];
}

export interface SettingsView {
  settings: Settings;
  completed: readonly number[];
}

export interface GameOverView {
  endless: boolean;
  level: LevelDef;
  score: number;
  goal: number | null;
  best: number;
  isBest: boolean;
}

export interface LevelCompleteView {
  level: LevelDef;
  next: LevelDef | null;
  newSkin: SkinId | null;
}
