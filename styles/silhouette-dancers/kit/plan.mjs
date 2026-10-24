// Turns a brief into a timed shot list. Shared by the film (browser) and the
// music (Node), so cuts and downbeats always agree.

// Backgrounds sampled from the original campaign.
export const PALETTE = {
  lime: '#8DBF1F',
  pink: '#E0609A',
  cyan: '#03B5F0',
  yellow: '#F4C832',
  orange: '#F7941D',
  violet: '#9468B0',
};

export const ASPECTS = {
  '16:9': [1920, 1080],
  '9:16': [1080, 1920],
  '1:1': [1080, 1080],
  '4:5': [1080, 1350],
};

// Moves from the motion library with the camera settings that read best.
// yaw: camera angle (rad); framing: 'full' | 'knee' | 'mid'; x: horizontal
// placement; followY: share of vertical motion the camera follows; hold:
// how strongly the device arm is raised (0 keeps the captured arm).
export const MOVES = {
  groove: { yaw: -0.8, framing: 'knee', x: 0.45 },
  jumps: { yaw: -2.4, framing: 'knee', fill: 1.05, x: 0.55, followY: 0.7 },
  pump: { yaw: 0, framing: 'knee', x: 0.55 },
  spin: { yaw: -1.6, framing: 'knee' },
  groove2: { yaw: 0.8, framing: 'knee', x: 0.55 },
  lambada: { yaw: 0, framing: 'knee', x: 0.5 },
  pump2: { yaw: -1.6, framing: 'knee', x: 0.5 },
  spin2: { yaw: -2.4, framing: 'knee' },
  freeze: { yaw: 0.6, fill: 0.95, hold: 0 },
  sway: { yaw: 0.3, framing: 'mid', fill: 0.9, x: 0.45 },
  leap: { yaw: 1.6, fill: 0.95 },
};

// Regular bars cycle through these; repeats are mirrored. Skirts only go on
// moves that never turn upside down.
const ROTATION = [
  ['groove', 'afro', 'r'],
  ['jumps', 'bob', 'l'],
  ['pump', 'cap', 'r'],
  ['spin', 'pony', 'r'],
  ['groove2', 'cap', 'l'],
  ['lambada', 'afro', 'r'],
  ['pump2', 'bob', 'r'],
  ['spin2', 'pony', 'l'],
];
// The build (two half-length cuts) and the peak that close every film.
const BUILD = [['freeze', 'spike', 'r'], ['sway', 'bob', 'r']];
const PEAK = ['leap', 'pony', 'r'];

export function plan(brief) {
  const [width, height] = ASPECTS[brief.aspect ?? '16:9'] ?? ASPECTS['16:9'];
  const vertical = height > width;
  const length = brief.length ?? 15;
  const bpm = brief.music?.bpm ?? 120;
  const offset = brief.music?.offset ?? 0;
  const bar = 240 / bpm;
  // One shot per bar; two bars per shot when the tempo is fast.
  const shotLen = bar < 1.5 ? bar * 2 : bar;
  const count = Math.max(3, Math.floor((length - offset - 2.5) / shotLen));
  const colors = paletteFrom(brief.palette);

  let shots;
  if (brief.shots) {
    shots = brief.shots.map((s) => ({ ...MOVES[s.seg], ...s }));
  } else {
    shots = [];
    const regular = count - 2;
    for (let i = 0; i < regular; i++) {
      const [seg, char, hand] = ROTATION[i % ROTATION.length];
      const repeat = Math.floor(i / ROTATION.length) % 2 === 1;
      shots.push({ seg, char, hand: repeat ? flip(hand) : hand, mirror: repeat, d: shotLen });
    }
    for (const [seg, char, hand] of BUILD) shots.push({ seg, char, hand, d: shotLen / 2 });
    shots.push({ seg: PEAK[0], char: PEAK[1], hand: PEAK[2], d: shotLen });
    let t = offset;
    shots.forEach((s, i) => {
      s.t = i === 0 ? 0 : t;
      s.d = i === 0 ? s.d + offset : s.d;
      t += i === 0 ? s.d - offset : s.d;
      Object.assign(s, { ...MOVES[s.seg], ...s }, { at: 0 });
      s.color = colors[i % colors.length];
    });
  }
  for (const s of shots) {
    s.at ??= 0;
    if (vertical) s.x = 0.5;
  }
  const last = shots[shots.length - 1];
  const endCard = { t: last.t + last.d, d: length - (last.t + last.d), color: brief.endColor ?? last.color };
  const keyTimes = [...shots.map((s) => +(s.t + s.d * 0.55).toFixed(2)), +(endCard.t + Math.min(1.5, endCard.d * 0.6)).toFixed(2)];
  return { width, height, fps: 30, length, bpm, bar, offset, shotLen, shots, endCard, keyTimes };
}

function flip(hand) {
  return hand === 'r' ? 'l' : 'r';
}

// Colors as palette names or hex values. Neighbors never repeat.
function paletteFrom(list) {
  const names = list?.length ? list : Object.keys(PALETTE);
  return names.map((c) => PALETTE[c] ?? c);
}
