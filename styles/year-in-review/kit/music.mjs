// Original bright electro-pop for a year-in-review film, composed from the
// same plan as the cards: a soft intro, a four-on-the-floor groove while the
// cards play, a whoosh into every card change, and a ringing last chord.
import { Mix, bass, clap, crash, hat, kick, midi, noise, pad, pluck } from '../../../core/audio/synth.mjs';
import { plan } from './plan.mjs';

// I–V–vi–IV in D major, one chord per bar.
const CHORDS = [
  [62, 66, 69],
  [57, 61, 64],
  [59, 62, 66],
  [55, 59, 62],
];

// Filtered noise that rises into the next card.
function whoosh(seed, dur) {
  const n = noise(seed);
  let lp = 0;
  return (t) => {
    const k = t / dur;
    const a = 0.02 + 0.5 * k * k;
    lp += (n() - lp) * a;
    return lp * k * k * (1 - Math.max(0, (t - dur + 0.02) / 0.02));
  };
}

export function compose(brief, outPath) {
  const p = plan(brief);
  const beat = p.bar / 4;
  const mix = new Mix(p.length);
  const first = p.cards[0];
  const last = p.cards[p.cards.length - 1];
  const bars = Math.round(p.length / p.bar);

  for (let b = 0; b < bars; b++) {
    const t0 = b * p.bar;
    const chord = CHORDS[b % CHORDS.length];
    const intro = t0 < first.t + first.d - 1e-6;
    const outro = t0 >= last.t - 1e-6;
    mix.add(t0, p.bar, pad(chord.map((n) => midi(n - 12)), p.bar), intro ? 0.34 : 0.16);
    // Sixteenth-note pluck arpeggio over the chord.
    for (let s = 0; s < 16; s++) {
      const note = chord[[0, 1, 2, 1, 2, 0, 1, 2][s % 8]] + (s % 8 >= 4 ? 12 : 0);
      mix.add(t0 + s * (beat / 4), beat / 2, pluck(midi(note), beat / 2, intro ? 2600 : 4200), intro ? 0.24 : 0.13, s % 2 ? 0.35 : -0.35);
    }
    if (intro) {
      for (let i = 0; i < 4; i++) mix.add(t0 + i * beat + beat / 2, 0.2, hat(b * 8 + i, 18), 0.12, 0.2);
      continue;
    }
    for (let i = 0; i < 4; i++) {
      const tb = t0 + i * beat;
      if (!outro || i === 0) mix.add(tb, 0.5, kick, 0.95);
      if (i === 1 || i === 3) mix.add(tb, 0.3, clap(b * 4 + i), 0.5);
      mix.add(tb + beat / 2, 0.25, hat(b * 16 + i, 10), 0.2, 0.25);
      mix.add(tb, 0.05, hat(b * 16 + i + 9, 70), 0.1, -0.25);
    }
    // Pumping octave bass on the root.
    for (let e = 0; e < 8; e++) {
      const note = chord[0] - 24 + (e % 2 ? 12 : 0);
      mix.add(t0 + e * (beat / 2), beat / 2 - 0.02, bass(midi(note), beat / 2 - 0.03, 900), outro ? 0.25 : 0.4);
    }
  }

  // A whoosh into every card change, and a crash on the cut.
  for (const c of p.cards.slice(1)) {
    mix.add(c.t - beat, beat, whoosh(c.index * 97, beat), 0.35);
    mix.add(c.t, 1.2, crash(300 + c.index), 0.12);
  }

  // The tonic chord swells under the closing card and fades with it.
  mix.add(last.t, last.d, pad(CHORDS[0].map((n) => midi(n)), last.d, 0.05), 0.2);
  mix.write(outPath, { fadeOut: Math.min(1.6, last.d * 0.45) });
}
