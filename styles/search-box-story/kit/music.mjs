// Original score for a search-box-story film: a driving piano anthem that
// builds search by search and steps up a key at the time jumps, under the
// clicks of the keyboard and mouse and a few sound effects.
import { Mix, midi, noise } from '../../../core/audio/synth.mjs';
import { plan } from './plan.mjs';

// Piano: decaying harmonics with slight stretch, plus a soft hammer.
function piano(freq, dur, vel = 1) {
  const partials = [1, 2.002, 3.006, 4.012, 5.02, 6.03];
  const n = noise(Math.round(freq * 13));
  return (t) => {
    let s = 0;
    partials.forEach((m, i) => {
      s += Math.sin(2 * Math.PI * freq * m * t) * (1 / (i + 1) ** 1.4) * Math.exp(-t * (1.6 + i * 1.1 + freq / 900));
    });
    const hammer = t < 0.01 ? n() * (1 - t / 0.01) * 0.25 : 0;
    const release = t > dur - 0.08 ? Math.max(0, (dur - t) / 0.08) : 1;
    return (s * 0.55 + hammer) * vel * release;
  };
}

// A key click: a bright tick and a low knock, a little different each time.
function keyClick(seed, kind) {
  const n = noise(seed);
  const pitch = kind === 'space' ? 0.55 : kind === 'enter' ? 0.75 : 0.9 + (seed % 7) * 0.03;
  let lp = 0;
  return (t) => {
    const x = n();
    lp += (x - lp) * 0.3;
    const tick = (x - lp) * Math.exp(-t * 900 * pitch);
    const knock = Math.sin(2 * Math.PI * 180 * pitch * t) * Math.exp(-t * 120);
    return tick * 0.7 + knock * (kind === 'key' ? 0.25 : 0.45);
  };
}

function mouseClick(seed) {
  const n = noise(seed);
  return (t) => {
    const env = Math.exp(-t * 1400) + (t > 0.07 ? Math.exp(-(t - 0.07) * 1600) * 0.6 : 0);
    return n() * env * 0.8;
  };
}

// Struck bells: inharmonic partials with long decays.
function bell(freq) {
  const ratios = [0.5, 1, 1.183, 1.506, 2, 2.74, 3.0];
  return (t) => ratios.reduce((s, r, i) => s + Math.sin(2 * Math.PI * freq * r * t) * Math.exp(-t * (0.6 + i * 0.5)) / (i + 1), 0) * 0.6;
}

// A jet passing: filtered noise that swells and fades.
function airplane(dur) {
  const n = noise(4242);
  let lp = 0;
  return (t) => {
    const k = t / dur;
    lp += (n() - lp) * (0.02 + 0.05 * Math.sin(Math.PI * k));
    return lp * Math.sin(Math.PI * Math.min(1, Math.max(0, k))) * 3;
  };
}

// I–V–vi–IV, as semitones above the key's root.
const PROGRESSION = [
  [0, 4, 7],
  [7, 11, 14],
  [9, 12, 16],
  [5, 9, 12],
];

export function compose(brief, outPath) {
  const p = plan(brief);
  const mix = new Mix(p.length);
  const beat = p.bar / 4;
  const n = p.steps.length;
  // Key changes: where steps ask for a jump, or at about 40% and 75%.
  const jumps = p.steps.filter((s) => s.jump).map((s) => s.start);
  if (!jumps.length && n >= 4) jumps.push(p.steps[Math.round(n * 0.4)].start, p.steps[Math.round(n * 0.75)].start);
  const keyAt = (t) => 48 + 2 * jumps.filter((j) => t >= j - 1e-6).length;
  const last = p.steps[n - 1];
  // Intensity grows step by step, drops for the last search, then resolves.
  const level = (t) => {
    if (t >= last.start) return 0.35;
    const i = p.steps.findIndex((s) => t >= s.start && t < s.start + s.d);
    return 0.45 + 0.55 * (i / Math.max(1, n - 2));
  };

  const bars = Math.floor(p.blank.start / p.bar);
  for (let b = 0; b < bars; b++) {
    const t0 = b * p.bar;
    const chord = PROGRESSION[b % 4];
    for (let e = 0; e < 8; e++) {
      const t = t0 + e * (beat / 2);
      const key = keyAt(t);
      const lv = level(t);
      const sparse = lv < 0.5;
      // Right hand: repeated eighth-note chords, or single notes when sparse.
      const notes = sparse ? (e % 2 ? [] : [chord[e % 3]]) : chord;
      for (const note of notes) {
        mix.add(t, beat * 0.9, piano(midi(key + 12 + note), beat * 0.9, (e % 2 ? 0.55 : 0.8) * lv), 0.18, (note % 5) * 0.08 - 0.15);
      }
      // Left hand: root octaves on beats 1 and 3, more as it builds.
      if (e === 0 || e === 4 || (lv > 0.75 && e % 2 === 0)) {
        mix.add(t, beat * 2, piano(midi(key - 12 + chord[0]), beat * 2, 0.9 * lv), 0.3, -0.1);
        if (lv > 0.6) mix.add(t, beat * 2, piano(midi(key + chord[0]), beat * 2, 0.6 * lv), 0.22, -0.05);
      }
    }
  }
  // Blank box and end card: one chord that rings out.
  const endKey = keyAt(p.blank.start);
  for (const note of [0, 7, 12, 16, 19]) {
    mix.add(p.blank.start, p.length - p.blank.start, piano(midi(endKey + note), p.length - p.blank.start, 0.7), 0.2);
  }

  for (const s of p.sounds) {
    const seed = Math.round(s.t * 1000);
    if (s.type === 'key' || s.type === 'space' || s.type === 'enter') {
      mix.add(s.t, 0.08, keyClick(seed, s.type), s.type === 'enter' ? 0.5 : 0.32, 0.15);
    } else if (s.type === 'click') {
      mix.add(s.t, 0.12, mouseClick(seed), 0.35, 0.2);
    } else if (s.type === 'bells') {
      for (let i = 0; i < 3; i++) mix.add(s.t + i * 0.9, 4, bell(midi(endKey + 24 - i * 5)), 0.22);
    } else if (s.type === 'chime') {
      for (let i = 0; i < 3; i++) mix.add(s.t + i * 0.12, 1.5, bell(midi(keyAt(s.t) + 36 + [0, 4, 7][i])), 0.08);
    } else if (s.type === 'airplane') {
      mix.add(s.t, 3.5, airplane(3.5), 0.35);
    }
  }
  mix.write(outPath, { fadeOut: 1.5, drive: 1.05 });
}
