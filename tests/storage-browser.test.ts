// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { safeStorage } from '../src/storage/repository';

describe('safeStorage', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns localStorage when it works and leaves no probe behind', () => {
    const storage = safeStorage();
    expect(storage).toBe(window.localStorage);
    expect(window.localStorage.getItem('__skyhop_probe__')).toBeNull();
  });

  it('returns null when storage is blocked or full', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(safeStorage()).toBeNull();
  });
});
