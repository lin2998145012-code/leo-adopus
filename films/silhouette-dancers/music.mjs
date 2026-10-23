// Original 15-second electro-rock track for the silhouette-dancers demo.
// 120 BPM, 4/4. Cuts in film.js land on the downbeats defined here.
//
//   node films/silhouette-dancers/music.mjs out/silhouette-dancers.wav
import { Mix, bass, crash, hat, kick, midi, power, snare } from '../../core/audio/synth.mjs';

const BPM = 120;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const LENGTH = 15;
const mix = new Mix(LENGTH);

// One chord root per bar: E, E, G, A, D/E (build), E (peak), E (end card).
const roots = [40, 40, 43, 45, 38, 40];

for (let bar = 0; bar < 6; bar++) {
  const t0 = bar * BAR;
  const build = bar === 4;
  for (let b = 0; b < 4; b++) {
    const tb = t0 + b * BEAT;
    mix.add(tb, 0.5, kick, 1.0);
    if (b === 1 || b === 3) mix.add(tb, 0.3, snare(bar * 8 + b), 0.55);
    mix.add(tb + BEAT / 2, 0.25, hat(bar * 16 + b, 9), 0.22, 0.3);
    mix.add(tb, 0.06, hat(bar * 16 + b + 5, 60), 0.14, -0.3);
  }
  if (build) {
    // Snare roll that climbs into the peak.
    for (let i = 0; i < 16; i++) {
      mix.add(t0 + i * (BEAT / 4), 0.12, snare(500 + i), 0.18 + i * 0.025, 0.1);
    }
  }
  // Driving eighth-note bass.
  for (let e = 0; e < 8; e++) {
    const note = roots[bar] - 12 + (e === 7 ? 7 : 0);
    mix.add(t0 + e * (BEAT / 2), BEAT / 2, bass(midi(note), BEAT / 2 - 0.01, build ? 500 + e * 120 : 750), 0.42);
  }
  // Guitar stabs: a syncopated rock rhythm on the root's power chord.
  const stabs = [0, 0.75, 1.5, 2, 2.75, 3.5];
  for (const s of stabs) {
    const dur = s === 3.5 ? BEAT / 2 : BEAT * 0.4;
    const f = midi(roots[bar] + 12);
    mix.add(t0 + s * BEAT, dur, power(f, dur, 0.004), 0.3, -0.45);
    mix.add(t0 + s * BEAT, dur, power(f, dur, 0.0055), 0.3, 0.45);
  }
}

// Crashes on the peak and the end card.
mix.add(5 * BAR, 2, crash(901), 0.35);
mix.add(6 * BAR, 3, crash(902), 0.4);

// End card: one big hit that rings out.
const endRoot = midi(40);
mix.add(6 * BAR, 0.6, kick, 1.1);
mix.add(6 * BAR, 3, bass(endRoot / 2, 3, 400), 0.45);
mix.add(6 * BAR, 3, power(endRoot * 2, 3, 0.004, 0.9), 0.32, -0.45);
mix.add(6 * BAR, 3, power(endRoot * 2, 3, 0.0055, 0.9), 0.32, 0.45);

mix.write(process.argv[2] ?? 'out/silhouette-dancers.wav', { fadeOut: 1.2 });
