// A dry, clever little score for the red posters: plucked strings walking
// in D minor, a wood block ticking on two and four, a soft piano chord on
// every cut and a pluck where each punchline lands. Original, composed
// from the same plan as the picture.
import { Mix, midi, noise } from '../../../core/audio/synth.mjs';
import { plan } from './plan.mjs';

// Dm, Bb, Gm, A: one chord per bar.
const CHORDS = [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]];
const LINES = [[38, 45, 41, 45], [34, 41, 38, 41], [31, 38, 34, 38], [33, 40, 37, 40]];

// Pizzicato: a short, woody pluck.
function pizz(freq) {
  return (t) => {
    const env = Math.min(1, t / 0.003) * Math.exp(-t * 9);
    return (Math.sin(2 * Math.PI * freq * t) + 0.5 * Math.sin(4 * Math.PI * freq * t) * Math.exp(-t * 20) + 0.2 * Math.sin(6 * Math.PI * freq * t) * Math.exp(-t * 30)) * env;
  };
}

// Felt piano: soft partials and a slow fade.
function piano(freq, dur) {
  return (t) => {
    const env = Math.min(1, t / 0.008) * Math.exp(-t * 1.6) * Math.min(1, Math.max(0, (dur - t) / 0.2));
    let s = 0;
    for (const [k, a] of [[1, 1], [2, 0.35], [3, 0.12], [4, 0.06]]) s += Math.sin(2 * Math.PI * freq * k * t) * a * Math.exp(-t * k * 0.8);
    return s * env;
  };
}

function woodblock(seed) {
  const n = noise(seed);
  return (t) => (Math.sin(2 * Math.PI * 1150 * t) * 0.8 + n() * 0.25) * Math.exp(-t * 55);
}

export function compose(brief, outPath) {
  const p = plan(brief);
  const mix = new Mix(p.length);
  const bars = Math.round(p.length / p.bar);
  for (let b = 0; b < bars; b++) {
    const t0 = b * p.bar;
    const ending = t0 >= p.end.t - 1e-6;
    LINES[b % 4].forEach((n, k) => mix.add(t0 + k * p.beat, 0.6, pizz(midi(n)), ending ? 0.25 : 0.4, -0.1));
    if (!ending) {
      for (const k of [1, 3]) mix.add(t0 + k * p.beat, 0.12, woodblock(b * 4 + k), 0.12, 0.4);
      // Upper strings answer on the "and" of four.
      CHORDS[b % 4].forEach((n, i) => mix.add(t0 + p.beat * 3.5, 0.4, pizz(midi(n + 12)), 0.08, i - 1));
    }
  }
  for (const poster of p.posters) {
    const ch = CHORDS[Math.round(poster.t / p.bar) % 4];
    ch.forEach((n, i) => mix.add(poster.t, Math.min(poster.d, 3), piano(midi(n + 12), Math.min(poster.d, 3)), 0.12, i - 1));
    if (poster.punchAt) mix.add(poster.punchAt, 0.6, pizz(midi(ch[2] + 24)), 0.22, 0.2);
  }
  // A last chord on the name: D major.
  [50, 54, 57, 62].forEach((n, i) => mix.add(p.end.t, p.end.d, piano(midi(n + 12), p.end.d), 0.16, i * 0.5 - 0.75));
  mix.add(p.end.t, p.end.d, pizz(midi(38)), 0.45);
  mix.write(outPath, { drive: 1.05, peak: 0.85, fadeOut: 0.8 });
}
