// A tiny offline synthesizer for original film music. Writes 16-bit stereo
// WAV files from a code-defined arrangement, so demos never depend on
// licensed tracks.
import { writeFileSync } from 'node:fs';

export const RATE = 44100;

export class Mix {
  constructor(seconds) {
    this.length = Math.ceil(seconds * RATE);
    this.left = new Float32Array(this.length);
    this.right = new Float32Array(this.length);
  }

  // Add a mono signal fn(t, i) for `dur` seconds starting at `at`, panned
  // from -1 (left) to 1 (right).
  add(at, dur, fn, gain = 1, pan = 0) {
    const start = Math.max(0, Math.round(at * RATE));
    const end = Math.min(this.length, Math.round((at + dur) * RATE));
    const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
    const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
    for (let i = start; i < end; i++) {
      const v = fn((i - start) / RATE, i - start);
      this.left[i] += v * gl;
      this.right[i] += v * gr;
    }
  }

  // Soft-clip, normalize to `peak` and write a WAV file.
  write(path, { drive = 1.2, peak = 0.89, fadeOut = 0 } = {}) {
    let max = 0;
    for (const ch of [this.left, this.right]) {
      for (let i = 0; i < ch.length; i++) {
        ch[i] = Math.tanh(ch[i] * drive);
        max = Math.max(max, Math.abs(ch[i]));
      }
    }
    const fadeFrom = this.length - Math.round(fadeOut * RATE);
    const buf = Buffer.alloc(44 + this.length * 4);
    buf.write('RIFF', 0);
    buf.writeUInt32LE(36 + this.length * 4, 4);
    buf.write('WAVEfmt ', 8);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(2, 22);
    buf.writeUInt32LE(RATE, 24);
    buf.writeUInt32LE(RATE * 4, 28);
    buf.writeUInt16LE(4, 32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36);
    buf.writeUInt32LE(this.length * 4, 40);
    for (let i = 0; i < this.length; i++) {
      const fade = i > fadeFrom ? (this.length - i) / (this.length - fadeFrom) : 1;
      const k = (peak / (max || 1)) * fade;
      buf.writeInt16LE(Math.round(this.left[i] * k * 32767), 44 + i * 4);
      buf.writeInt16LE(Math.round(this.right[i] * k * 32767), 46 + i * 4);
    }
    writeFileSync(path, buf);
  }
}

// Deterministic noise so renders are repeatable.
export function noise(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 4294967296) * 2 - 1;
  };
}

export const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// ---------- instruments ----------

// Sine kick with a fast pitch drop from 155 Hz to 45 Hz and a short click.
export function kick(t) {
  const phase = 2 * Math.PI * (45 * t + (110 / 35) * (1 - Math.exp(-t * 35)));
  const click = t < 0.004 ? (1 - t / 0.004) * 0.5 : 0;
  return Math.sin(phase) * Math.exp(-t * 7) + click;
}

export function snare(seed) {
  const n = noise(seed);
  let lp = 0;
  return (t) => {
    const x = n();
    lp += (x - lp) * 0.35;
    const body = Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 30);
    return ((x - lp * 0.6) * Math.exp(-t * 16) + body * 0.6) * 0.9;
  };
}

export function hat(seed, decay) {
  const n = noise(seed);
  let lp = 0;
  return (t) => {
    const x = n();
    lp += (x - lp) * 0.5;
    return (x - lp) * Math.exp(-t * decay);
  };
}

export function crash(seed) {
  const n = noise(seed);
  let lp = 0;
  return (t) => {
    const x = n();
    lp += (x - lp) * 0.6;
    return (x - lp) * Math.exp(-t * 1.6) * 0.8;
  };
}

// Sawtooth bass through a one-pole low-pass filter.
export function bass(freq, dur, cutoff = 700) {
  let lp = 0;
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / RATE);
  return (t) => {
    const saw = 2 * ((t * freq) % 1) - 1;
    const sub = Math.sin(2 * Math.PI * freq * 0.5 * t) * 0.5;
    lp += (saw - lp) * a;
    const env = Math.min(1, t / 0.004) * (t > dur - 0.02 ? Math.max(0, (dur - t) / 0.02) : 1);
    return (lp + sub) * env;
  };
}

// Overdriven power chord: root, fifth and octave from detuned saws.
export function power(root, dur, detune = 0.004, decay = 3) {
  const freqs = [root, root * 1.5, root * 2];
  let lp = 0;
  return (t) => {
    let s = 0;
    for (const f of freqs) {
      for (const d of [-detune, detune]) s += 2 * ((t * f * (1 + d)) % 1) - 1;
    }
    const driven = Math.tanh(s * 0.9);
    lp += (driven - lp) * 0.32;
    const env = Math.min(1, t / 0.003) * Math.exp(-t * decay) * (t > dur - 0.015 ? Math.max(0, (dur - t) / 0.015) : 1);
    return lp * env;
  };
}
