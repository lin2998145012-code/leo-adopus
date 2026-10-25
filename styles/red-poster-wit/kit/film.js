// The red-poster-wit film: a run of posters, each one witty line in white
// on a field of red with the brand's name small in the corner, cut on the
// bar line; a punchline can land a beat later. It closes on the name.
//
// URL parameters: brief=<url of brief.json>. Files named in the brief are
// resolved relative to the brief.
import { plan, typeset } from './plan.mjs';

const FONT = '"Playfair Display", serif';
const WHITE = '#ffffff';

const params = new URLSearchParams(location.search);
if (!params.has('brief')) throw new Error('Open this page with ?brief=<url of brief.json>');
const briefUrl = new URL(params.get('brief'), location.href);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

async function loadImage(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

// The logo as a pure white mark.
function whiteMark(img, h) {
  const w = Math.round((h * img.naturalWidth) / img.naturalHeight);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0, w, h);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = WHITE;
  g.fillRect(0, 0, w, h);
  return c;
}

function setFont(g, size) {
  g.font = `400 ${size}px ${FONT}`;
  g.letterSpacing = `${-size * 0.035}px`;
}

// Words of the setup and the punchline in order; '\n' forces a break.
function tokens(poster) {
  const out = [];
  const add = (text, punch) => {
    text.split(/(\n)/).forEach((part) => {
      if (part === '\n') out.push({ br: true });
      else part.split(/\s+/).filter(Boolean).forEach((w) => out.push({ text: w, punch }));
    });
  };
  add(poster.setup, false);
  // The punchline starts its own line, so nothing moves when it lands.
  if (poster.punch) {
    out.push({ br: true });
    add(poster.punch, true);
  }
  return out;
}

function wrap(g, toks, maxW) {
  const space = g.measureText(' ').width;
  const lines = [];
  let line = { words: [], width: 0 };
  for (const t of toks) {
    if (t.br) {
      lines.push(line);
      line = { words: [], width: 0 };
      continue;
    }
    const w = g.measureText(t.text).width;
    const next = line.words.length ? line.width + space + w : w;
    if (line.words.length && next > maxW) {
      lines.push(line);
      line = { words: [{ ...t, w }], width: w };
    } else {
      line.words.push({ ...t, w });
      line.width = next;
    }
  }
  if (line.words.length) lines.push(line);
  return { lines, space };
}

// The biggest size that fits the box, wrapped into lines of even length.
function fit(g, toks, boxW, boxH) {
  for (let size = boxH * 0.6; size > 12; size *= 0.97) {
    setFont(g, size);
    const lead = size * 0.9;
    let res = wrap(g, toks, boxW);
    if (res.lines.length * lead > boxH || res.lines.some((l) => l.width > boxW)) continue;
    // Narrow the measure as far as it goes without adding a line.
    let lo = boxW * 0.4;
    let hi = boxW;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      const r = wrap(g, toks, mid);
      if (r.lines.length === res.lines.length && r.lines.every((l) => l.width <= mid)) hi = mid;
      else lo = mid;
    }
    res = wrap(g, toks, hi);
    return { size, lead, ...res };
  }
  setFont(g, 12);
  return { size: 12, lead: 12, ...wrap(g, toks, boxW) };
}

async function load() {
  const brief = await (await fetch(briefUrl)).json();
  const p = plan(brief);
  await document.fonts.load(`400 40px ${FONT}`);
  const canvas = document.getElementById('film');
  canvas.width = p.width;
  canvas.height = p.height;
  const g = canvas.getContext('2d');
  const W = p.width;
  const H = p.height;
  const red = brief.color ?? '#f5170a';
  const name = typeset(brief.product?.name ?? 'Brand');
  const portrait = H > W;
  const brandSize = 0.033 * Math.sqrt(W * H);
  const margin = (portrait ? 0.055 : 0.038) * W;
  const logoImg = brief.product?.logo ? await loadImage(new URL(brief.product.logo, briefUrl)) : null;
  const logo = logoImg ? whiteMark(logoImg, Math.round(brandSize * 2.4)) : null;

  const layouts = p.posters.map((poster) => {
    const box = portrait ? [W * 0.84, H * 0.5] : [W * 0.9, H * 0.56];
    return fit(g, tokens(poster), ...box);
  });

  function drawBrand() {
    if (logo) {
      const h = brandSize * 1.2;
      const w = (h * logo.width) / logo.height;
      g.drawImage(logo, W - margin - w, H - margin * 0.9 - h, w, h);
      return;
    }
    setFont(g, brandSize);
    g.letterSpacing = '0px';
    g.fillStyle = WHITE;
    g.textAlign = 'right';
    g.textBaseline = 'alphabetic';
    g.fillText(name, W - margin, H - margin * 0.9 - brandSize * 0.12);
  }

  function drawPoster(i, t) {
    const poster = p.posters[i];
    const L = layouts[i];
    const local = t - poster.t;
    // A slow push, as if walking toward the billboard.
    const z = 1 + 0.018 * (local / poster.d);
    g.save();
    g.translate(W / 2, H * 0.49);
    g.scale(z, z);
    setFont(g, L.size);
    g.fillStyle = WHITE;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    const top = -(L.lines.length * L.lead) / 2;
    L.lines.forEach((line, li) => {
      let x = -line.width / 2;
      const y = top + (li + 0.78) * L.lead;
      for (const w of line.words) {
        const a = w.punch ? clamp((t - poster.punchAt) / 0.12, 0, 1) : 1;
        if (a > 0) {
          g.globalAlpha = a;
          g.fillText(w.text, x, y);
        }
        x += w.w + L.space;
      }
    });
    g.globalAlpha = 1;
    g.restore();
    drawBrand();
  }

  function drawEnd(t) {
    const k = clamp((t - p.end.t) / 0.25, 0, 1);
    g.globalAlpha = k;
    if (logo) {
      const h = Math.min(H * 0.16, W * 0.12);
      const w = Math.min(W * 0.7, (h * logo.width) / logo.height);
      g.drawImage(logo, W / 2 - w / 2, H * 0.46 - h / 2, w, (w * logo.height) / logo.width);
    } else {
      let size = Math.min(H * 0.17, W * 0.13);
      setFont(g, size);
      while (g.measureText(name).width > W * 0.8) setFont(g, (size *= 0.95));
      g.fillStyle = WHITE;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(name, W / 2, H * 0.47);
    }
    const tag = typeset(brief.end?.tagline ?? '');
    if (tag) {
      setFont(g, brandSize * 1.05);
      g.letterSpacing = '0px';
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillText(tag, W / 2, H * 0.47 + Math.min(H * 0.17, W * 0.13) * 0.75);
    }
    g.globalAlpha = 1;
  }

  function render(t) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = red;
    g.fillRect(0, 0, W, H);
    const i = p.posters.findIndex((q) => t >= q.t && t < q.t + q.d);
    if (i >= 0) drawPoster(i, t);
    else if (t >= p.end.t) drawEnd(t);
  }

  Object.assign(window.film, {
    width: W, height: H, fps: p.fps, duration: p.length,
    keyTimes: p.keyTimes, canvas, render,
  });
  render(0);
}

window.film = { ready: load() };
