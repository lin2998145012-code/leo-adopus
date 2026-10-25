// Turns a ball-cascade brief into shots on the bar line: which view of the
// hill each shot shows and when the tagline and name appear. Shared by the
// film (browser) and the music (Node).

export const ASPECTS = {
  '16:9': [1920, 1080],
  '1:1': [1080, 1080],
  '4:5': [1080, 1350],
  '9:16': [1080, 1920],
};

// How many bars each kind of shot lasts by default.
const BARS = { wide: 3, low: 2, detail: 2, downhill: 2, close: 2, product: 4 };
export const SHOTS = Object.keys(BARS);
export const DEFAULT_SHOTS = ['wide', 'low', 'detail', 'downhill', 'close', 'product'];

export function plan(brief) {
  const aspect = ASPECTS[brief.aspect] ? brief.aspect : '16:9';
  const [width, height] = ASPECTS[aspect];
  const bpm = brief.music?.bpm ?? 92;
  const bar = 240 / bpm;
  const shots = [];
  let t = 0;
  (brief.shots ?? DEFAULT_SHOTS).forEach((s, i) => {
    const kind = typeof s === 'string' ? s : s.kind;
    if (!BARS[kind]) return;
    const d = (typeof s === 'object' && s.bars ? s.bars : BARS[kind]) * bar;
    shots.push({ kind, t, d, index: i, seed: 101 + i * 37 });
    t += d;
  });
  const last = shots[shots.length - 1];
  const taglineAt = last ? last.t + bar * 1 : t;
  const nameAt = last ? last.t + bar * 2 : t;
  const length = t;
  const keyTimes = shots.map((s) => +(s.t + s.d * 0.6).toFixed(2));
  if (last) keyTimes[keyTimes.length - 1] = +(length - 0.5).toFixed(2);
  return { aspect, width, height, fps: 30, bpm, bar, length, shots, taglineAt, nameAt, keyTimes, slowmo: brief.slowmo ?? 0.3 };
}
