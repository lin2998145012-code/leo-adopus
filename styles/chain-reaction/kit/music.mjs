// The sound of the chain reaction, composed from the same plan as the
// picture: no music while the machine runs, only the parts — steel ringing
// on steel, wood knocking, rolling, gears ticking — in a quiet room. When
// the product comes to rest it chimes and starts a groove of its own.
import { Mix, RATE, bass, clap, hat, kick, midi, noise, snare } from '../../../core/audio/synth.mjs';
import { plan } from './machine.mjs';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// A struck steel part: a few inharmonic modes that ring and fade, and a
// short click on contact. `damp` > 1 when it hits something soft.
function ring(seed, f0, strength, damp) {
  const n = noise(seed);
  const ratios = [1, 2.32, 4.25, 6.63, 9.38];
  const amps = [1, 0.6, 0.38, 0.22, 0.12];
  const decays = [7, 11, 17, 25, 34].map((d) => d * damp);
  const phases = ratios.map(() => n() * Math.PI);
  let hp = 0;
  return (t) => {
    let s = 0;
    for (let i = 0; i < 5; i++) s += Math.sin(2 * Math.PI * f0 * ratios[i] * t + phases[i]) * amps[i] * Math.exp(-t * decays[i]);
    const x = n();
    hp += (x - hp) * 0.5;
    const click = (x - hp) * Math.exp(-t * 900) * 1.4;
    return (s * 0.35 + click) * strength;
  };
}

// Wood on wood or on the floor: a hollow knock.
function knock(seed, f0, strength) {
  const n = noise(seed);
  let lp = 0;
  return (t) => {
    const x = n();
    lp += (x - lp) * 0.25;
    const body = Math.sin(2 * Math.PI * f0 * t) * Math.exp(-t * 45) + Math.sin(2 * Math.PI * f0 * 2.7 * t) * 0.4 * Math.exp(-t * 70);
    return (body * 0.7 + lp * Math.exp(-t * 160) * 1.6) * strength;
  };
}

// Rubber: a low thud.
function thud(seed, strength) {
  const n = noise(seed);
  let lp = 0;
  return (t) => {
    lp += (n() - lp) * 0.06;
    return (Math.sin(2 * Math.PI * (70 + 40 * Math.exp(-t * 30)) * t) * Math.exp(-t * 18) + lp * 3 * Math.exp(-t * 25)) * strength;
  };
}

// A part rolling: filtered noise that follows its speed, with a flutter.
function rolling(seed, v, mat) {
  const n = noise(seed);
  let lp = 0;
  let lp2 = 0;
  let phase = 0;
  const heavy = mat === 'rubber' || mat === 'cart';
  return (t) => {
    const i = Math.min(v.length - 1, Math.floor(t * 240));
    const speed = v[i] ?? 0;
    const x = n();
    const a = heavy ? 0.02 : 0.06 + speed * 0.12;
    lp += (x - lp) * a;
    lp2 += (lp - lp2) * a;
    phase += (speed * (heavy ? 9 : 55)) / RATE;
    const flutter = 0.65 + 0.35 * Math.sin(2 * Math.PI * phase);
    const edge = Math.min(1, t / 0.03, (v.length / 240 - t) / 0.05);
    return (lp - lp2 * 0.6) * Math.min(1, speed * 2.2) * flutter * edge * (heavy ? 2.6 : 1.4);
  };
}

// Schroeder reverb for the room: parallel combs into series all-passes.
function reverb(inL, inR, outL, outR, wet) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356];
  const aps = [225, 556];
  for (const [src, dst, spread] of [[inL, outL, 0], [inR, outR, 23]]) {
    const acc = new Float32Array(src.length);
    for (const d0 of combs) {
      const d = d0 + spread;
      const buf = new Float32Array(d);
      let lp = 0;
      for (let i = 0, p = 0; i < src.length; i++, p = (p + 1) % d) {
        const y = buf[p];
        lp += (y - lp) * 0.35;
        buf[p] = src[i] + lp * 0.82;
        acc[i] += y;
      }
    }
    for (const d0 of aps) {
      const d = d0 + spread;
      const buf = new Float32Array(d);
      for (let i = 0, p = 0; i < acc.length; i++, p = (p + 1) % d) {
        const y = buf[p];
        const x = acc[i];
        buf[p] = x + y * 0.5;
        acc[i] = y - x * 0.5;
      }
    }
    for (let i = 0; i < src.length; i++) dst[i] += src[i] + acc[i] * (wet / combs.length);
  }
}

// A clavinet-like stab: a bright, quickly damped pulse.
function clav(freq, dur) {
  let lp = 0;
  return (t) => {
    const pulse = ((t * freq) % 1) < 0.3 ? 1 : -0.43;
    const cutoff = 600 + 5000 * Math.exp(-t * 22);
    lp += (pulse - lp) * (1 - Math.exp((-2 * Math.PI * cutoff) / RATE));
    const env = Math.min(1, t / 0.002) * Math.exp(-t * 9) * Math.min(1, Math.max(0, (dur - t) / 0.02));
    return lp * env;
  };
}

// The groove the product plays: 98 bpm, a dry break, a walking bass and
// clav stabs on the offbeats, in E minor.
function groove(mix, at, end, p) {
  const bpm = 98;
  const beat = 60 / bpm;
  const bar = beat * 4;
  const bassLine = [[0, 40, 0.35], [0.75, 40, 0.2], [1.5, 43, 0.3], [2, 45, 0.3], [2.75, 47, 0.2], [3.25, 45, 0.25], [3.5, 43, 0.3]];
  const chords = [[64, 67, 71, 74], [62, 66, 69, 72]];
  let b = 0;
  for (let t0 = at; t0 < end; t0 += bar, b++) {
    const open = Math.min(1, (t0 - at) / (bar * 2));
    const g = (0.6 + 0.4 * open) * 0.72;
    for (const k of [0, 1.75, 2.5]) mix.add(t0 + k * beat, 0.5, kick, 0.9 * g);
    for (const k of [1, 3]) mix.add(t0 + k * beat, 0.4, snare(b * 7 + k), 0.5 * g);
    if (b % 2 === 1) mix.add(t0 + 3.75 * beat, 0.3, clap(b), 0.25 * g);
    for (let i = 0; i < 8; i++) {
      const swing = i % 2 ? beat * 0.08 : 0;
      mix.add(t0 + i * beat * 0.5 + swing, 0.12, hat(b * 31 + i, i % 2 ? 60 : 38), (i % 2 ? 0.12 : 0.18) * g, 0.3);
    }
    for (const [k, n, d] of bassLine) mix.add(t0 + k * beat, d * beat * 2, bass(midi(n - (b % 4 === 3 && k > 2 ? 2 : 0)), d * beat * 2, 500 + 500 * open), 0.32);
    const chord = chords[b % 2];
    for (const k of [0.5, 1.5, 2.25, 3.5]) {
      chord.forEach((n, i) => mix.add(t0 + k * beat, beat * 0.35, clav(midi(n), beat * 0.35), 0.045 * open, i % 2 ? 0.25 : -0.25));
    }
  }
}

export function compose(brief, outPath) {
  const p = plan(brief);
  const room = new Mix(p.length);
  const camX = (t) => p.camera.x[clamp(Math.round(t * p.fps), 0, p.camera.x.length - 1)];
  const camW = (t) => p.camera.w[clamp(Math.round(t * p.fps), 0, p.camera.w.length - 1)];
  const pan = (t, x) => clamp((x - camX(t)) / (camW(t) * 0.7), -0.8, 0.8);
  // Quieter as parts move away from the camera's view.
  const near = (t, x) => 1 / (1 + Math.max(0, Math.abs(x - camX(t)) - camW(t) * 0.5) * 1.5);

  p.events.forEach((e, i) => {
    const seed = i * 97 + 13;
    const g = near(e.t, e.x);
    const at = pan(e.t, e.x);
    if (e.type === 'hit') {
      const s = Math.min(1.2, e.strength) * g;
      const soft = ['wood', 'floor'].includes(e.b);
      if (e.a === 'rubber' || e.b === 'rubber') room.add(e.t, 0.5, thud(seed, s * 1.2), 0.9, at);
      else if (e.a === 'wood') room.add(e.t, 0.3, knock(seed, 180 + (i % 5) * 30, s), 0.8, at);
      else {
        const f0 = 1500 + ((i * 7919) % 1700);
        room.add(e.t, soft ? 0.35 : 1.2, ring(seed, soft ? f0 * 0.7 : f0, s, soft ? 3.5 : 1), soft ? 0.7 : 0.55, at);
        if (soft) room.add(e.t, 0.25, knock(seed + 1, e.b === 'floor' ? 150 : 260, s * 0.8), 0.7, at);
      }
    } else if (e.type === 'tick') {
      room.add(e.t, 0.08, ring(seed, 4200 + (i % 3) * 600, e.strength * 0.5 * g, 6), 0.4, at);
    } else if (e.type === 'chirp') {
      for (const [k, n] of [[0, 88], [0.13, 95]]) {
        room.add(e.t + k, 0.5, (t) => Math.sin(2 * Math.PI * midi(n) * t) * Math.exp(-t * 7) * Math.min(1, t / 0.004), 0.16, at);
      }
    }
  });
  p.rolls.forEach((r, i) => {
    const dur = r.v.length / 240;
    if (dur < 0.05) return;
    const x = r.x ?? camX(r.t0);
    room.add(r.t0, dur, rolling(i * 53 + 5, r.v, r.mat), 0.3 * near(r.t0, x), pan(r.t0, x));
  });

  // Room tone under everything.
  const air = noise(4242);
  let lp = 0;
  room.add(0, p.length, () => {
    lp += (air() - lp) * 0.02;
    return lp * 0.08;
  }, 1);

  const out = new Mix(p.length);
  reverb(room.left, room.right, out.left, out.right, 0.55);
  groove(out, p.musicAt, p.length, p);
  out.write(outPath, { drive: 1.1, peak: 0.89, fadeOut: 1.6 });
}
