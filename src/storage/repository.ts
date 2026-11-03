import { LEVEL_COUNT } from '../core/levels';
import { DEFAULT_SKIN, isSkinId, type SkinId } from '../core/skins';

export interface Settings {
  sfx: boolean;
  assist: boolean;
  reducedMotion: boolean;
  haptics: boolean;
  skin: SkinId;
}

export interface Progress {
  completed: number[];
  bestEndless: number;
  lastLevel: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SETTINGS_KEY = 'skyhop.v2.settings';
export const PROGRESS_KEY = 'skyhop.v2.progress';
const MAX_SCORE = 100_000;

export const defaultSettings = (reducedMotion = false): Settings => ({
  sfx: true, assist: false, reducedMotion, haptics: false, skin: DEFAULT_SKIN,
});

export const defaultProgress = (): Progress => ({ completed: [], bestEndless: 0, lastLevel: 1 });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const boolOr = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);

function intInRange(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  return value >= min && value <= max ? value : null;
}

export function sanitizeSettings(raw: unknown, fallback: Settings): Settings {
  if (!isRecord(raw)) return fallback;
  return {
    sfx: boolOr(raw['sfx'], fallback.sfx),
    assist: boolOr(raw['assist'], fallback.assist),
    reducedMotion: boolOr(raw['reducedMotion'], fallback.reducedMotion),
    haptics: boolOr(raw['haptics'], fallback.haptics),
    skin: isSkinId(raw['skin']) ? raw['skin'] : fallback.skin,
  };
}

export function sanitizeProgress(raw: unknown): Progress {
  if (!isRecord(raw)) return defaultProgress();
  const list = Array.isArray(raw['completed']) ? raw['completed'] : [];
  const completed = [...new Set(list.map((id) => intInRange(id, 1, LEVEL_COUNT)))]
    .filter((id): id is number => id !== null)
    .sort((a, b) => a - b);
  return {
    completed,
    bestEndless: intInRange(raw['bestEndless'], 0, MAX_SCORE) ?? 0,
    lastLevel: intInRange(raw['lastLevel'], 1, LEVEL_COUNT) ?? 1,
  };
}

/** Highest level the player may start: one past the furthest completed level. */
export function unlockedLevel(progress: Progress): number {
  const furthest = progress.completed.length > 0 ? Math.max(...progress.completed) : 0;
  return Math.min(LEVEL_COUNT, furthest + 1);
}

export function recordCompletion(progress: Progress, levelId: number): Progress {
  const completed = progress.completed.includes(levelId) ? progress.completed : [...progress.completed, levelId];
  return { ...progress, completed: completed.sort((a, b) => a - b), lastLevel: Math.min(LEVEL_COUNT, levelId + 1) };
}

export function recordEndless(progress: Progress, score: number): { progress: Progress; isBest: boolean } {
  const isBest = score > progress.bestEndless;
  return { progress: isBest ? { ...progress, bestEndless: Math.min(score, MAX_SCORE) } : progress, isBest };
}

/** Returns usable storage or null when it is blocked (private windows, strict privacy settings). */
export function safeStorage(): StorageLike | null {
  try {
    const probe = '__skyhop_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Settings and progress persistence. Every read is validated; every write failure is reported, never thrown. */
export class Repository {
  constructor(
    private readonly storage: StorageLike | null,
    private readonly prefersReducedMotion = false,
  ) {}

  loadSettings(): Settings {
    return sanitizeSettings(this.read(SETTINGS_KEY), defaultSettings(this.prefersReducedMotion));
  }

  loadProgress(): Progress {
    return sanitizeProgress(this.read(PROGRESS_KEY));
  }

  saveSettings(settings: Settings): boolean {
    return this.write(SETTINGS_KEY, settings);
  }

  saveProgress(progress: Progress): boolean {
    return this.write(PROGRESS_KEY, progress);
  }

  clearProgress(): boolean {
    try {
      this.storage?.removeItem(PROGRESS_KEY);
      return this.storage !== null;
    } catch {
      return false;
    }
  }

  private read(key: string): unknown {
    try {
      const text = this.storage?.getItem(key);
      return text ? (JSON.parse(text) as unknown) : null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown): boolean {
    try {
      if (!this.storage) return false;
      this.storage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
}
