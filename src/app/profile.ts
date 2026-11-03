import { LEVEL_COUNT, getLevel, type LevelDef } from '../core/levels';
import { DEFAULT_SKIN, SKINS, isSkinUnlocked, type SkinId } from '../core/skins';
import {
  Repository, recordCompletion, recordEndless, unlockedLevel, type Progress, type Settings,
} from '../storage/repository';

/** The player's persisted choices and progress, saved through the repository after every change. */
export class Profile {
  settings: Settings;
  progress: Progress;
  saveFailed = false;

  constructor(
    private readonly repository: Repository,
    readonly storageOk: boolean,
  ) {
    this.settings = repository.loadSettings();
    this.progress = repository.loadProgress();
    if (!isSkinUnlocked(this.settings.skin, this.progress.completed)) {
      this.settings = { ...this.settings, skin: DEFAULT_SKIN };
    }
  }

  get unlocked(): number {
    return unlockedLevel(this.progress);
  }

  get nextLevel(): LevelDef {
    return getLevel(this.unlocked);
  }

  get completed(): readonly number[] {
    return this.progress.completed;
  }

  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.settings = { ...this.settings, [key]: value };
    this.saveFailed = !this.repository.saveSettings(this.settings) || this.saveFailed;
  }

  /** Records a finished level and reports which bird, if any, it unlocked. */
  completeLevel(levelId: number): SkinId | null {
    const before = this.unlockedSkins();
    this.progress = recordCompletion(this.progress, levelId);
    this.saveFailed = !this.repository.saveProgress(this.progress) || this.saveFailed;
    return this.unlockedSkins().find((skin) => !before.includes(skin)) ?? null;
  }

  /** Returns true when the score beats the saved endless best. */
  submitEndless(score: number): boolean {
    const result = recordEndless(this.progress, score);
    this.progress = result.progress;
    if (result.isBest) this.saveFailed = !this.repository.saveProgress(this.progress) || this.saveFailed;
    return result.isBest;
  }

  reset(): void {
    this.repository.clearProgress();
    this.progress = { completed: [], bestEndless: 0, lastLevel: 1 };
    this.setSetting('skin', DEFAULT_SKIN);
  }

  hasNextLevel(levelId: number): boolean {
    return levelId < LEVEL_COUNT;
  }

  private unlockedSkins(): SkinId[] {
    return SKINS.filter((skin) => isSkinUnlocked(skin.id, this.progress.completed)).map((skin) => skin.id);
  }
}
