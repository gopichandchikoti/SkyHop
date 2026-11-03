import type { StorageLike } from '../../src/storage/repository';

export class MemoryStorage implements StorageLike {
  readonly data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

/** Storage that always throws, like a browser with storage blocked or full. */
export class BrokenStorage implements StorageLike {
  getItem(): string | null {
    throw new Error('blocked');
  }

  setItem(): void {
    throw new Error('quota');
  }

  removeItem(): void {
    throw new Error('blocked');
  }
}
