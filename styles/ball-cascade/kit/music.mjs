// A warm fingerpicked nylon-string guitar for the ball-cascade film, with a
// simple tune on top and a glockenspiel that comes in for the last shot.
// The guitar is a plucked-string model, so every note rings like a real
// one. Original, composed from the same plan as the picture; shots change
// on the bar line.
import { Mix, RATE, midi, noise } from '../../../core/audio/synth.mjs';
import { plan } from './plan.mjs';

// Karplus–Strong: a burst of noise in a short delay line, filtered as it
// circulates, sounds like a plucked string.
function string(freq, dur, seed, bright = 0.5) {
  const n = noise(seed);
  const len = Math.max(2, Math.round(RATE / freq));
  const buf = new Float32Array(len);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    lp += (n() - lp) * bright;
    buf[i] = lp;
  }
  let p = 0;
  let prev = 0;
  const total = Math.round(dur * RATE);
  return (t, i) => {
    if (i >= total) return 0;
    const cur = buf[p];
    buf[p] = (cur + prev) * 0.4985;
    prev = cur;
    p = (p + 1) % len;
    return cur * (i > total - 400 ? (total - i) / 400 : 1);
  };
}

function glock(freq) {
  return (t) => (Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(2 * Math.PI * freq * 2.76 * t) * Math.exp(-t * 8)) * Math.exp(-t * 2.2) * Math.min(1, t / 0.002);
}

// D – Bm – G – A, picked in eighth notes.
const CHORDS = [
  [50, 57, 62, 66, 69],
  [47, 54, 59, 62, 66],
  [43, 50, 55, 59, 62],
  [45, 52, 57, 61, 64],
];
const PATTERN = [0, 2, 3, 4, 1, 3, 2, 4];
const MELODY = [74, 73, 71, 69, 71, 69, 67, 66, 67, 69, 71, 74, 73, 71, 69, 73];

export function compose(brief, outPath) {
  const p = plan(brief);
  const mix = new Mix(p.length);
  const eighth = p.bar / 8;
  const bars = Math.ceil(p.length / p.bar);
  const last = p.shots[p.shots.length - 1];
  for (let b = 0; b < bars; b++) {
    const t0 = b * p.bar;
    const ch = CHORDS[b % 4];
    PATTERN.forEach((k, i) => {
      const swing = i % 2 ? eighth * 0.06 : 0;
      mix.add(t0 + i * eighth + swing, 2.2, string(midi(ch[k]), 2.2, b * 31 + i, k === 0 ? 0.35 : 0.55), k === 0 ? 0.5 : 0.32, k < 2 ? -0.25 : 0.25);
    });
    // A simple tune on top once the street is full.
    if (b >= 2) {
      mix.add(t0, 2.5, string(midi(MELODY[(b * 2) % 16]), 2.5, b * 7 + 1, 0.7), 0.34, 0.1);
      mix.add(t0 + eighth * 3, 2.5, string(midi(MELODY[(b * 2 + 1) % 16]), 2.5, b * 7 + 2, 0.7), 0.3, 0.1);
    }
    if (last && t0 >= last.t - 1e-6) {
      for (const k of [0, 3, 6]) mix.add(t0 + k * eighth, 1.5, glock(midi(ch[4] + 12)), 0.12, 0.3);
    }
  }
  mix.write(outPath, { drive: 1.1, peak: 0.88, fadeOut: 2.5 });
}
