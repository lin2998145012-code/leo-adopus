// Original electro-rock score for a silhouette-dancers film, composed from
// the same plan as the shots: steady bars while dancers change, a snare roll
// into the last shot, and one big hit that rings out over the end card.
import { Mix, bass, crash, hat, kick, midi, power, snare } from '../../../core/audio/synth.mjs';
import { plan } from './plan.mjs';

// Chord roots per bar, cycling: E, E, G, A.
const PROGRESSION = [40, 40, 43, 45];

export function compose(brief, outPath) {
  const p = plan(brief);
  const beat = p.bar / 4;
  const mix = new Mix(p.length);
  const peak = p.shots[p.shots.length - 1].t;
  const buildFrom = p.shots[p.shots.length - 3].t;
  const bars = Math.round(p.endCard.t / p.bar);

  for (let b = 0; b < bars; b++) {
    const t0 = b * p.bar;
    const build = t0 >= buildFrom - 1e-6 && t0 < peak - 1e-6;
    const root = build ? 38 : t0 >= peak - 1e-6 ? 40 : PROGRESSION[b % PROGRESSION.length];
    for (let i = 0; i < 4; i++) {
      const tb = t0 + i * beat;
      mix.add(tb, 0.5, kick, 1.0);
      if (i === 1 || i === 3) mix.add(tb, 0.3, snare(b * 8 + i), 0.55);
      mix.add(tb + beat / 2, 0.25, hat(b * 16 + i, 9), 0.22, 0.3);
      mix.add(tb, 0.06, hat(b * 16 + i + 5, 60), 0.14, -0.3);
    }
    if (build) {
      // Snare roll that climbs into the peak.
      for (let i = 0; i < 16; i++) mix.add(t0 + i * (beat / 4), 0.12, snare(500 + b * 16 + i), 0.18 + i * 0.025, 0.1);
    }
    // Driving eighth-note bass.
    for (let e = 0; e < 8; e++) {
      const note = root - 12 + (e === 7 ? 7 : 0);
      mix.add(t0 + e * (beat / 2), beat / 2, bass(midi(note), beat / 2 - 0.01, build ? 500 + e * 120 : 750), 0.42);
    }
    // Guitar stabs: a syncopated rock rhythm on the root's power chord.
    for (const s of [0, 0.75, 1.5, 2, 2.75, 3.5]) {
      const dur = s === 3.5 ? beat / 2 : beat * 0.4;
      const f = midi(root + 12);
      mix.add(t0 + s * beat, dur, power(f, dur, 0.004), 0.3, -0.45);
      mix.add(t0 + s * beat, dur, power(f, dur, 0.0055), 0.3, 0.45);
    }
  }

  // Crashes on the peak and the end card; the end card's chord rings out.
  const end = p.endCard.t;
  const ring = p.length - end;
  mix.add(peak, 2, crash(901), 0.35);
  mix.add(end, ring, crash(902), 0.4);
  const endRoot = midi(40);
  mix.add(end, 0.6, kick, 1.1);
  mix.add(end, ring, bass(endRoot / 2, ring, 400), 0.45);
  mix.add(end, ring, power(endRoot * 2, ring, 0.004, 0.9), 0.32, -0.45);
  mix.add(end, ring, power(endRoot * 2, ring, 0.0055, 0.9), 0.32, 0.45);

  mix.write(outPath, { fadeOut: Math.min(1.2, ring * 0.4) });
}
