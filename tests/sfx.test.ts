// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { Sfx, type SfxName } from '../src/audio/sfx';

const NAMES: SfxName[] = ['flap', 'score', 'hit', 'complete', 'levelUp', 'click', 'tick', 'go'];

function fakeContext(state: AudioContextState = 'running') {
  const counts = { oscillators: 0, noise: 0 };
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const chain = <T extends object>(node: T) => ({ ...node, connect: (next: unknown) => next });
  const context = {
    currentTime: 0,
    sampleRate: 8000,
    state,
    destination: { connect: vi.fn() },
    resume: vi.fn(() => Promise.resolve()),
    createGain: () => chain({ gain: param() }),
    createOscillator: () => {
      counts.oscillators += 1;
      return chain({ type: 'sine', frequency: param(), start: vi.fn(), stop: vi.fn() });
    },
    createBufferSource: () => {
      counts.noise += 1;
      return chain({ buffer: null, start: vi.fn(), stop: vi.fn() });
    },
    createBiquadFilter: () => chain({ type: 'bandpass', frequency: { value: 0 } }),
    createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
  };
  return { context: context as unknown as AudioContext, counts, raw: context };
}

describe('Sfx', () => {
  it('stays silent until unlocked and when disabled', () => {
    const { context, counts } = fakeContext();
    const sfx = new Sfx(true, () => context);
    sfx.play('flap');
    expect(counts.oscillators).toBe(0);
    sfx.unlock();
    sfx.setEnabled(false);
    sfx.play('flap');
    expect(counts.oscillators).toBe(0);
  });

  it('plays every named cue once unlocked', () => {
    const { context, counts } = fakeContext();
    const sfx = new Sfx(true, () => context);
    sfx.unlock();
    for (const name of NAMES) sfx.play(name);
    expect(counts.oscillators).toBeGreaterThanOrEqual(NAMES.length);
    expect(counts.noise).toBeGreaterThanOrEqual(2);
  });

  it('resumes a suspended context but does not play until it is running', () => {
    const { context, counts, raw } = fakeContext('suspended');
    const sfx = new Sfx(true, () => context);
    sfx.unlock();
    expect(raw.resume).toHaveBeenCalled();
    sfx.play('score');
    expect(counts.oscillators).toBe(0);
  });

  it('creates the context only once', () => {
    const { context } = fakeContext();
    const factory = vi.fn(() => context);
    const sfx = new Sfx(true, factory);
    sfx.unlock();
    sfx.unlock();
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('degrades quietly when audio is unsupported or fails', () => {
    const unsupported = new Sfx(true, () => null);
    expect(() => {
      unsupported.unlock();
      unsupported.play('hit');
    }).not.toThrow();
    const exploding = new Sfx(true, () => {
      throw new Error('no audio');
    });
    expect(() => exploding.unlock()).not.toThrow();
    exploding.play('hit');
  });

  it('turns itself off if a voice throws', () => {
    const { context, raw } = fakeContext();
    const sfx = new Sfx(true, () => context);
    sfx.unlock();
    raw.createOscillator = () => {
      throw new Error('boom');
    };
    expect(() => sfx.play('click')).not.toThrow();
    const created = vi.fn();
    raw.createOscillator = created;
    sfx.play('click');
    expect(created).not.toHaveBeenCalled();
  });

  it('falls back to the prefixed constructor and to none', () => {
    const w = window as unknown as { AudioContext?: unknown; webkitAudioContext?: unknown };
    const saved = { a: w.AudioContext, b: w.webkitAudioContext };
    w.AudioContext = undefined;
    w.webkitAudioContext = undefined;
    expect(() => new Sfx().unlock()).not.toThrow();
    const created = vi.fn();
    w.webkitAudioContext = function Fake(this: unknown) {
      created();
      return fakeContext().context;
    };
    new Sfx().unlock();
    expect(created).toHaveBeenCalled();
    w.AudioContext = saved.a;
    w.webkitAudioContext = saved.b;
  });
});
