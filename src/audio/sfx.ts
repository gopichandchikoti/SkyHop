export type SfxName = 'flap' | 'score' | 'hit' | 'complete' | 'levelUp' | 'click' | 'tick' | 'go';

type ContextFactory = () => AudioContext | null;

const MASTER_GAIN = 0.7;

type LegacyWindow = Window & { webkitAudioContext?: typeof AudioContext };

function defaultFactory(): AudioContext | null {
  const Ctor = window.AudioContext ?? (window as LegacyWindow).webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

interface ToneSpec {
  from: number;
  to: number;
  seconds: number;
  type: OscillatorType;
  gain: number;
  delay?: number;
}

/**
 * Sound effects synthesised with the Web Audio API, so there are no audio files to license or download.
 * The context is created on the first user gesture, as browsers require.
 */
export class Sfx {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  constructor(
    private enabled = true,
    private readonly factory: ContextFactory = defaultFactory,
  ) {}

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Call from a user gesture (pointer or key) to create and resume the audio context. */
  unlock(): void {
    try {
      this.context ??= this.factory();
      if (!this.context) return;
      if (!this.master) {
        this.master = this.context.createGain();
        this.master.gain.value = MASTER_GAIN;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') void this.context.resume();
    } catch {
      this.context = null;
    }
  }

  play(name: SfxName): void {
    if (!this.enabled || !this.context || !this.master || this.context.state !== 'running') return;
    try {
      this.voices[name]();
    } catch {
      this.enabled = false;
    }
  }

  private readonly voices: Record<SfxName, () => void> = {
    flap: () => {
      this.tone({ from: 420, to: 700, seconds: 0.09, type: 'sine', gain: 0.13 });
      this.hiss(0.07, 1400, 0.05);
    },
    score: () => {
      this.tone({ from: 880, to: 880, seconds: 0.09, type: 'triangle', gain: 0.17 });
      this.tone({ from: 1318, to: 1318, seconds: 0.16, type: 'triangle', gain: 0.17, delay: 0.08 });
    },
    hit: () => {
      this.hiss(0.28, 500, 0.4);
      this.tone({ from: 190, to: 55, seconds: 0.28, type: 'square', gain: 0.2 });
    },
    complete: () => {
      [523, 659, 784, 1047].forEach((hz, i) => {
        this.tone({ from: hz, to: hz, seconds: 0.22, type: 'triangle', gain: 0.16, delay: i * 0.1 });
      });
    },
    levelUp: () => {
      this.tone({ from: 660, to: 660, seconds: 0.12, type: 'triangle', gain: 0.14 });
      this.tone({ from: 990, to: 990, seconds: 0.2, type: 'triangle', gain: 0.14, delay: 0.1 });
    },
    click: () => this.tone({ from: 620, to: 560, seconds: 0.05, type: 'sine', gain: 0.1 }),
    tick: () => this.tone({ from: 520, to: 520, seconds: 0.1, type: 'sine', gain: 0.12 }),
    go: () => this.tone({ from: 780, to: 1040, seconds: 0.22, type: 'triangle', gain: 0.15 }),
  };

  private tone(spec: ToneSpec): void {
    if (!this.context || !this.master) return;
    const { from, to, seconds, type, gain } = spec;
    const start = this.context.currentTime + (spec.delay ?? 0);
    const osc = this.context.createOscillator();
    const amp = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(amp).connect(this.master);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  private hiss(seconds: number, cutoff: number, gain: number): void {
    if (!this.context || !this.master) return;
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer(this.context);
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = cutoff;
    const amp = this.context.createGain();
    const start = this.context.currentTime;
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    source.connect(filter).connect(amp).connect(this.master);
    source.start(start);
    source.stop(start + seconds + 0.02);
  }

  private noiseBuffer(context: AudioContext): AudioBuffer {
    if (this.noise) return this.noise;
    const buffer = context.createBuffer(1, context.sampleRate / 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;
    return buffer;
  }
}
