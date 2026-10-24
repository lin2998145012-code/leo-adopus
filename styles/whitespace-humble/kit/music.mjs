// A quiet cool-jazz trio for the whitespace-humble film: brushes and ride
// from the first frame, an upright bass walking in when the headline
// appears, vibraphone comping under the copy, and one held chord on the
// finished page. Original, composed from the same plan as the picture.
import { Mix, midi, noise } from '../../../core/audio/synth.mjs';
import { plan } from './plan.mjs';

// I–vi–ii–V in F: Fmaj7, Dm7, Gm7, C7.
const CHORDS = [
  { root: 41, tones: [53, 57, 60, 64] },
  { root: 38, tones: [50, 53, 57, 60] },
  { root: 43, tones: [55, 58, 62, 65] },
  { root: 36, tones: [52, 55, 58, 60] },
];
// Walking lines, one per chord: root, then approach the next root.
const WALKS = [
  [41, 45, 48, 49],
  [38, 41, 45, 42],
  [43, 46, 50, 47],
  [36, 40, 43, 40],
];

// Upright bass: a round pluck with a little string buzz.
function upright(freq, dur) {
  return (t) => {
    const env = Math.min(1, t / 0.006) * Math.exp(-t * 3.2) * Math.min(1, Math.max(0, (dur - t) / 0.04));
    const s = Math.sin(2 * Math.PI * freq * t) + 0.35 * Math.sin(4 * Math.PI * freq * t) * Math.exp(-t * 9) + 0.12 * Math.sin(6 * Math.PI * freq * t) * Math.exp(-t * 14);
    return s * env;
  };
}

// Vibraphone: sine bars with their bright overtone and a slow tremolo.
function vibes(freq, dur) {
  return (t) => {
    const trem = 0.78 + 0.22 * Math.sin(2 * Math.PI * 5.2 * t);
    const env = Math.min(1, t / 0.004) * Math.exp(-t * 1.1) * Math.min(1, Math.max(0, (dur - t) / 0.3));
    return (Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(2 * Math.PI * freq * 4 * t) * Math.exp(-t * 6)) * env * trem;
  };
}

// Ride cymbal: inharmonic partials over noise, a long shimmer.
function ride(seed) {
  const n = noise(seed);
  let hp = 0;
  const f = [3120, 4410, 5230, 6870];
  return (t) => {
    const x = n();
    hp += (x - hp) * 0.7;
    let s = 0;
    for (let i = 0; i < f.length; i++) s += Math.sin(2 * Math.PI * f[i] * t + i) * 0.18;
    return ((x - hp) * 0.6 + s) * Math.exp(-t * 4.5) * (0.4 + 0.6 * Math.exp(-t * 30));
  };
}

// Brush on the snare: a soft swish.
function brush(seed, dur) {
  const n = noise(seed);
  let lp = 0;
  let lp2 = 0;
  return (t) => {
    const x = n();
    lp += (x - lp) * 0.3;
    lp2 += (lp - lp2) * 0.3;
    const env = Math.sin(Math.PI * Math.min(1, t / dur)) ** 1.5;
    return (lp - lp2) * env;
  };
}

export function compose(brief, outPath) {
  const p = plan(brief);
  const mix = new Mix(p.length);
  const beat = p.bar / 4;
  const swing = beat * 0.66; // the "and" of a swung beat
  const bars = Math.ceil(p.length / p.bar);
  const end = p.holdFrom;
  for (let b = 0; b < bars; b++) {
    const t0 = b * p.bar;
    if (t0 >= end - 1e-6) break;
    const ch = CHORDS[b % 4];
    // Ride: ding, ding-a, ding, ding-a.
    for (let k = 0; k < 4; k++) {
      mix.add(t0 + k * beat, 1.2, ride(b * 8 + k), k % 2 ? 0.11 : 0.14, 0.35);
      if (k % 2) mix.add(t0 + k * beat + swing, 0.8, ride(b * 8 + k + 4), 0.08, 0.35);
    }
    // Brushes: a sweep every beat, a pat on 2 and 4.
    for (let k = 0; k < 4; k++) mix.add(t0 + k * beat, beat, brush(b * 4 + k, beat), k % 2 ? 0.26 : 0.17, -0.2);
    if (t0 >= p.headlineAt - 1e-6) {
      WALKS[b % 4].forEach((n, k) => mix.add(t0 + k * beat, beat * 0.95, upright(midi(n), beat * 0.95), 0.42, -0.05));
    }
    if (t0 >= p.bodyStart - 1e-6) {
      // Comp on the "and" of 1 and on 3.
      for (const at of [swing, beat * 2]) {
        ch.tones.forEach((n, i) => mix.add(t0 + at, beat * 1.6, vibes(midi(n + 12), beat * 1.6), 0.05, i % 2 ? 0.3 : -0.1));
      }
    }
  }
  // The held chord on the finished page.
  const fin = [53, 57, 60, 64, 67];
  fin.forEach((n, i) => mix.add(end + i * 0.03, p.length - end, vibes(midi(n + 12), p.length - end), 0.07, i % 2 ? 0.3 : -0.2));
  mix.add(end, p.length - end, upright(midi(41), p.length - end), 0.45);
  mix.add(end, 2.5, ride(999), 0.08, 0.35);
  mix.write(outPath, { drive: 1.05, peak: 0.85, fadeOut: 1.2 });
}
