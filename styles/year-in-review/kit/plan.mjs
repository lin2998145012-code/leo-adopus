// Turns a year-in-review brief into timed cards. Shared by the film
// (browser) and the music (Node), so every card change lands on a bar line.

export const ASPECTS = {
  '9:16': [1080, 1920],
  '4:5': [1080, 1350],
  '1:1': [1080, 1080],
  '16:9': [1920, 1080],
};

// Clashing color sets: background, text, and two accents.
export const SCHEMES = {
  purple: { bg: '#4100F4', fg: '#FFFFFF', a: '#CDF564', b: '#FF6AE6' },
  lime: { bg: '#CDF564', fg: '#141414', a: '#4100F4', b: '#FF4632' },
  red: { bg: '#FF4632', fg: '#FFFFFF', a: '#F7E61B', b: '#3BE8B0' },
  mint: { bg: '#3BE8B0', fg: '#141414', a: '#FF4632', b: '#4100F4' },
  pink: { bg: '#FF8AD8', fg: '#141414', a: '#F7E61B', b: '#4100F4' },
  yellow: { bg: '#F7E61B', fg: '#141414', a: '#FF4632', b: '#4100F4' },
  black: { bg: '#141414', fg: '#FFFFFF', a: '#CDF564', b: '#FF6AE6' },
};
const ORDER = ['purple', 'lime', 'red', 'mint', 'pink', 'yellow', 'black'];

// Default length of each card type, in bars.
const BARS = { intro: 2, statement: 2, number: 3, list: 2, persona: 2, summary: 2, outro: 2 };

export function plan(brief) {
  const [width, height] = ASPECTS[brief.aspect ?? '9:16'] ?? ASPECTS['9:16'];
  const bpm = brief.music?.bpm ?? 120;
  const bar = 240 / bpm;
  const schemes = (brief.palette?.length ? brief.palette : ORDER).map((s) =>
    typeof s === 'string' ? SCHEMES[s] ?? SCHEMES.purple : s
  );
  let t = 0;
  let last = null;
  const cards = (brief.cards ?? []).map((c, i) => {
    const d = (c.bars ?? BARS[c.type] ?? 2) * bar;
    // Neighbors never share a background.
    let scheme = c.scheme ? SCHEMES[c.scheme] ?? c.scheme : schemes[i % schemes.length];
    if (last && scheme.bg === last.bg) scheme = schemes[(i + 1) % schemes.length];
    last = scheme;
    const card = { ...c, index: i, t, d, scheme };
    t += d;
    return card;
  });
  const length = t;
  const keyTimes = cards.map((c) => +(c.t + c.d * 0.7).toFixed(2));
  return { width, height, fps: 30, bpm, bar, length, cards, keyTimes };
}
