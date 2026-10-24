// Turns a whitespace-humble brief into a timeline: when the product appears,
// when the page is revealed, when every word of the body copy is set, and
// when the camera pulls back to the finished page. Shared by the film
// (browser) and the music (Node). Big moments land on bar lines.

export const ASPECTS = {
  '4:5': [1080, 1350],
  '1:1': [1080, 1080],
  '9:16': [1080, 1920],
  '16:9': [1920, 1080],
};

// Paragraphs of words. The body may be one string with blank lines between
// paragraphs, or an array of paragraphs.
export function paragraphs(body) {
  const list = Array.isArray(body) ? body : String(body ?? '').split(/\n\s*\n/);
  return list.map((p) => String(p).trim().split(/\s+/).filter(Boolean)).filter((p) => p.length);
}

export function plan(brief) {
  const aspect = ASPECTS[brief.aspect] ? brief.aspect : '4:5';
  const [width, height] = ASPECTS[aspect];
  const bpm = brief.music?.bpm ?? 112;
  const bar = 240 / bpm;
  const pace = brief.pace ?? 8; // words per second while the copy is set

  const paras = paragraphs(brief.body);
  const signoff = String(brief.signoff ?? '').trim().split(/\s+/).filter(Boolean);
  // Every word with the moment it is set; a breath at each paragraph end.
  const words = [];
  const productIn = 0.4;
  const reveal = bar * 1.5;
  const headlineAt = bar * 2;
  let t = bar * 3;
  const bodyStart = t;
  paras.forEach((p, pi) => {
    p.forEach((w, wi) => {
      words.push({ text: w, para: pi, index: wi, t });
      t += 1 / pace;
    });
    t += 0.22;
  });
  signoff.forEach((w, wi) => {
    words.push({ text: w, para: paras.length, index: wi, t, signoff: true });
    t += 1.6 / pace;
  });
  const bodyEnd = t;
  const logoAt = bodyEnd + 0.35;
  // Pull back to the whole page on the next bar line.
  const pullback = Math.ceil((logoAt + 0.4) / bar) * bar;
  const holdFrom = pullback + bar * 0.75;
  const length = holdFrom + Math.max(2.5, (brief.end?.hold ?? 3.5));

  const keyTimes = [
    productIn + 1.6,
    headlineAt + 1.0,
    bodyStart + (bodyEnd - bodyStart) * 0.25,
    bodyStart + (bodyEnd - bodyStart) * 0.75,
    length - 0.5,
  ].map((v) => +v.toFixed(2));

  return {
    aspect, width, height, fps: 30, bpm, bar, length,
    productIn, reveal, headlineAt, bodyStart, bodyEnd, logoAt, pullback, holdFrom,
    words, paragraphs: paras.length, keyTimes,
  };
}
