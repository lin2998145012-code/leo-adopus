// Turns a search-box-story brief into a timeline: when every key is typed,
// when results load, where the pointer goes and when it clicks. Shared by the
// film (browser) and the score (Node), so keystrokes, clicks and key changes
// line up with the picture.

export const ASPECTS = {
  '16:9': [1920, 1080],
  '1:1': [1080, 1080],
  '4:5': [1080, 1350],
  '9:16': [1080, 1920],
};

// How much of the 1280×720 page each format shows at zoom 1.
export const VIEW = { '16:9': 1280, '1:1': 760, '4:5': 700, '9:16': 600 };

// Deterministic jitter so the typing rhythm is human but repeatable.
function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function plan(brief) {
  const aspect = ASPECTS[brief.aspect] ? brief.aspect : '16:9';
  const [width, height] = ASPECTS[aspect];
  const bpm = brief.music?.bpm ?? 100;
  const bar = 240 / bpm;
  const half = bar / 2;
  const sounds = [];
  const steps = [];
  let t = 0;

  (brief.steps ?? []).forEach((step, i) => {
    const rand = rng(i * 101 + 7);
    const speed = step.speed ?? 1;
    const query = String(step.query ?? '');
    const s = { ...step, index: i, query, start: t };
    // The first search starts on the home page; later ones clear the box
    // on the results page, unless the step asks for the home page.
    s.home = i === 0 || !!step.home;
    let k = s.home ? (i === 0 ? 1.1 : 0.7) : 0.25;
    if (!s.home) {
      s.select = k;
      s.clear = k + 0.3;
      sounds.push({ t: t + s.clear, type: 'key' });
      k = s.clear + 0.25;
    }
    s.keys = [];
    for (let c = 0; c < query.length; c++) {
      s.keys.push(k);
      sounds.push({ t: t + k, type: query[c] === ' ' ? 'space' : 'key' });
      let gap = (0.065 + rand() * 0.05) / speed;
      if (query[c] === ' ') gap += 0.09 / speed;
      if (step.pause && c + 1 === step.pause.at) gap += step.pause.seconds ?? 0.8;
      k += gap;
    }
    const typed = s.keys.length ? s.keys[s.keys.length - 1] : k;
    s.enter = typed + 0.45;
    sounds.push({ t: t + s.enter, type: 'enter' });
    s.loaded = s.enter + 0.3;
    const hasClick = step.click !== false && step.click !== null && (step.results?.length || step.answer?.type === 'site');
    s.clickIndex = hasClick ? Number(step.click ?? 0) : null;
    let end = s.loaded + 1.6;
    if (s.clickIndex !== null) {
      s.hoverAt = s.loaded + 1.0;
      s.clickAt = s.hoverAt + 0.55;
      sounds.push({ t: t + s.clickAt, type: 'click' });
      end = s.clickAt + 0.9;
    }
    end += step.hold ?? 0;
    // Steps last a whole number of half bars, so cuts fall on the beat.
    s.d = Math.ceil(end / half) * half;
    if (step.sfx) sounds.push({ t: t + (step.sfxAt ?? s.loaded), type: step.sfx });
    steps.push(s);
    t += s.d;
  });

  // Closing: an empty box with a blinking caret, then the tagline card.
  const blank = { start: t, d: bar };
  t += bar;
  const endCard = { t, d: Math.max(3, bar * 1.5) };
  t += endCard.d;

  const keyTimes = [
    ...steps.flatMap((s) => [
      +(s.start + (s.keys[Math.floor(s.keys.length * 0.7)] ?? s.enter)).toFixed(2),
      +(s.start + (s.clickAt ?? s.loaded + 1.2) - 0.1).toFixed(2),
    ]),
    +(endCard.t + endCard.d * 0.7).toFixed(2),
  ];
  return {
    aspect, width, height, fps: 30, bpm, bar, length: t,
    view: VIEW[aspect], steps, blank, endCard, sounds, keyTimes,
  };
}
