// Turns a red-poster-wit brief into a run of posters: each line held long
// enough to read, cut on the bar line, with an optional punchline that
// lands on beat three. Shared by the film (browser) and the music (Node).

export const ASPECTS = {
  '2:1': [1920, 960],
  '16:9': [1920, 1080],
  '1:1': [1080, 1080],
  '4:5': [1080, 1350],
  '9:16': [1080, 1920],
};

// Typographer's quotes and a real ellipsis.
export function typeset(text) {
  return String(text ?? '')
    .replace(/\.\.\./g, '…')
    .replace(/(^|[\s(\[“])'/g, '$1‘')
    .replace(/'/g, '’')
    .replace(/(^|[\s(\[‘])"/g, '$1“')
    .replace(/"/g, '”');
}

// A poster line may be "setup | punchline": the punchline arrives a beat
// later.
export function splitLine(line) {
  const [setup, punch] = typeset(line).split('|').map((s) => s.trim());
  return { setup, punch: punch ?? '' };
}

export function plan(brief) {
  const aspect = ASPECTS[brief.aspect] ? brief.aspect : '16:9';
  const [width, height] = ASPECTS[aspect];
  const bpm = brief.music?.bpm ?? 96;
  const bar = 240 / bpm;
  const beat = bar / 4;
  const posters = [];
  let t = 0;
  for (const raw of brief.posters ?? []) {
    const line = typeof raw === 'string' ? raw : raw.line;
    const { setup, punch } = splitLine(line);
    const words = `${setup} ${punch}`.trim().split(/\s+/).length;
    // Reading time: about three words a second, plus a beat to enjoy it.
    const read = words / 3 + (punch ? 1.8 : 1.2);
    const bars = Math.max(1, Math.ceil((read + (punch ? beat * 2 : 0)) / bar));
    const d = (typeof raw === 'object' && raw.bars ? raw.bars : bars) * bar;
    posters.push({ setup, punch, t, d, punchAt: punch ? t + beat * 2 : null });
    t += d;
  }
  const end = { t, d: bar * 2 };
  t += end.d;
  const keyTimes = [...posters.map((p) => p.t + p.d - 0.4), end.t + end.d - 0.4].map((v) => +v.toFixed(2));
  return { aspect, width, height, fps: 30, bpm, bar, beat, length: t, posters, end, keyTimes };
}
