import { describe, expect, it } from 'vitest';
import {
  PROGRESS_KEY, Repository, SETTINGS_KEY, defaultProgress, defaultSettings, recordCompletion, recordEndless,
  sanitizeProgress, sanitizeSettings, unlockedLevel,
} from '../src/storage/repository';
import { BrokenStorage, MemoryStorage } from './helpers/memory-storage';

describe('sanitizeSettings', () => {
  it('keeps valid values and falls back field by field', () => {
    const fallback = defaultSettings();
    const result = sanitizeSettings({ sfx: false, assist: 'yes', reducedMotion: true, haptics: 1, skin: 'azure' }, fallback);
    expect(result).toEqual({ sfx: false, assist: false, reducedMotion: true, haptics: false, skin: 'azure' });
  });

  it('rejects unknown skins and non-objects', () => {
    const fallback = defaultSettings();
    expect(sanitizeSettings({ skin: 'purple' }, fallback).skin).toBe('coral');
    expect(sanitizeSettings(null, fallback)).toBe(fallback);
    expect(sanitizeSettings([1, 2], fallback)).toBe(fallback);
    expect(sanitizeSettings('text', fallback)).toBe(fallback);
  });
});

describe('sanitizeProgress', () => {
  it('de-duplicates, sorts and bounds completed levels', () => {
    const result = sanitizeProgress({ completed: [3, 1, 3, 0, 11, 2.5, 'x', 2], bestEndless: 12, lastLevel: 4 });
    expect(result).toEqual({ completed: [1, 2, 3], bestEndless: 12, lastLevel: 4 });
  });

  it('repairs bad scores and shapes', () => {
    expect(sanitizeProgress({ completed: 'no', bestEndless: -3, lastLevel: 99 })).toEqual(defaultProgress());
    expect(sanitizeProgress({ bestEndless: 1e9 }).bestEndless).toBe(0);
    expect(sanitizeProgress(undefined)).toEqual(defaultProgress());
  });
});

describe('progress rules', () => {
  it('unlocks one level past the furthest completed', () => {
    expect(unlockedLevel(defaultProgress())).toBe(1);
    expect(unlockedLevel({ ...defaultProgress(), completed: [1, 2] })).toBe(3);
    expect(unlockedLevel({ ...defaultProgress(), completed: [10] })).toBe(10);
  });

  it('records completions once and moves the continue point', () => {
    const first = recordCompletion(defaultProgress(), 2);
    const again = recordCompletion(first, 2);
    expect(again.completed).toEqual([2]);
    expect(again.lastLevel).toBe(3);
    expect(recordCompletion(defaultProgress(), 10).lastLevel).toBe(10);
  });

  it('tracks the endless best', () => {
    const base = defaultProgress();
    expect(recordEndless(base, 0).isBest).toBe(false);
    const better = recordEndless(base, 12);
    expect(better.isBest).toBe(true);
    expect(better.progress.bestEndless).toBe(12);
    expect(recordEndless(better.progress, 7).isBest).toBe(false);
    expect(recordEndless(base, 5e6).progress.bestEndless).toBe(100000);
  });
});

describe('Repository', () => {
  it('round-trips settings and progress', () => {
    const storage = new MemoryStorage();
    const repo = new Repository(storage);
    expect(repo.saveSettings({ ...defaultSettings(), assist: true })).toBe(true);
    expect(repo.saveProgress({ completed: [1], bestEndless: 4, lastLevel: 2 })).toBe(true);
    const reloaded = new Repository(storage);
    expect(reloaded.loadSettings().assist).toBe(true);
    expect(reloaded.loadProgress()).toEqual({ completed: [1], bestEndless: 4, lastLevel: 2 });
  });

  it('uses the system motion preference only when nothing is saved', () => {
    expect(new Repository(new MemoryStorage(), true).loadSettings().reducedMotion).toBe(true);
    const storage = new MemoryStorage();
    storage.setItem(SETTINGS_KEY, JSON.stringify({ reducedMotion: false }));
    expect(new Repository(storage, true).loadSettings().reducedMotion).toBe(false);
  });

  it('survives corrupted JSON', () => {
    const storage = new MemoryStorage();
    storage.setItem(SETTINGS_KEY, '{not json');
    storage.setItem(PROGRESS_KEY, '[[[');
    const repo = new Repository(storage);
    expect(repo.loadSettings()).toEqual(defaultSettings());
    expect(repo.loadProgress()).toEqual(defaultProgress());
  });

  it('reports write failures instead of throwing', () => {
    const broken = new Repository(new BrokenStorage());
    expect(broken.loadSettings()).toEqual(defaultSettings());
    expect(broken.saveSettings(defaultSettings())).toBe(false);
    expect(broken.saveProgress(defaultProgress())).toBe(false);
    expect(broken.clearProgress()).toBe(false);
    const none = new Repository(null);
    expect(none.saveProgress(defaultProgress())).toBe(false);
    expect(none.clearProgress()).toBe(false);
    expect(none.loadProgress()).toEqual(defaultProgress());
  });

  it('clears only progress', () => {
    const storage = new MemoryStorage();
    const repo = new Repository(storage);
    repo.saveProgress({ completed: [1], bestEndless: 1, lastLevel: 2 });
    repo.saveSettings(defaultSettings());
    expect(repo.clearProgress()).toBe(true);
    expect(storage.getItem(PROGRESS_KEY)).toBeNull();
    expect(storage.getItem(SETTINGS_KEY)).not.toBeNull();
  });
});
