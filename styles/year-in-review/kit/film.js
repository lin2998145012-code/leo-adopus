// The year-in-review film: a run of vertical story cards that tell a brand's
// year in big numbers, top-5 lists and bold statements, with bouncy shapes
// and clashing colors. Cards change on the bar line of the music.
//
// URL parameters: brief=<url of brief.json>. Files named in the brief are
// resolved relative to the brief.
import { plan } from './plan.mjs';
import { checkerBand, clamp, easeBack, easeOut, pixelBlob, ribbon, ribbonPath, scallop, starburst } from './shapes.js';

// Stories are drawn at 1080×1920 and placed into the output frame.
const SW = 1080;
const SH = 1920;
const FONT = '"DM Sans", sans-serif';
const IRIDESCENT = ['#FF6AE6', '#F7E61B', '#3BE8B0', '#4100F4', '#FF6AE6'];

const params = new URLSearchParams(location.search);
if (!params.has('brief')) throw new Error('Open this page with ?brief=<url of brief.json>');
const briefUrl = new URL(params.get('brief'), location.href);

// ---------- helpers ----------
const font = (weight, size) => `${weight} ${Math.round(size)}px ${FONT}`;

function luminance(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ink = (bg) => (luminance(bg) > 0.4 ? '#141414' : '#FFFFFF');

function wrap(g, text, maxW) {
  const lines = [];
  for (const para of String(text ?? '').split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && g.measureText(next).width > maxW) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

// Largest size up to `max` at which `text` wraps into `maxLines` lines.
function fitText(g, text, weight, max, maxW, maxLines) {
  let size = max;
  let lines;
  for (; size > 20; size *= 0.94) {
    g.font = font(weight, size);
    lines = wrap(g, text, maxW);
    if (lines.length <= maxLines && lines.every((l) => g.measureText(l).width <= maxW)) break;
  }
  return { size, lines };
}

// Lines slide up and fade in one after another, starting at `start`.
function revealLines(g, lines, x, y, lh, t, start, color, align = 'center') {
  g.textAlign = align;
  g.textBaseline = 'alphabetic';
  lines.forEach((line, i) => {
    const k = easeOut((t - start - i * 0.08) / 0.4);
    if (k <= 0) return;
    g.globalAlpha = k;
    g.fillStyle = color;
    g.fillText(line, x, y + i * lh + (1 - k) * 60);
  });
  g.globalAlpha = 1;
}

function formatNumber(v, locale) {
  return new Intl.NumberFormat(locale ?? 'en-US').format(Math.round(v));
}

// The logo as a white mask, tinted to any color on demand.
const tints = new Map();
function tinted(mask, color) {
  const key = color;
  if (!tints.has(key)) {
    const c = document.createElement('canvas');
    c.width = mask.width;
    c.height = mask.height;
    const x = c.getContext('2d');
    x.drawImage(mask, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    tints.set(key, c);
  }
  return tints.get(key);
}

async function loadImage(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

async function whiteMask(url) {
  const img = await loadImage(url);
  const h = 256;
  const c = document.createElement('canvas');
  c.width = Math.round((h * img.naturalWidth) / img.naturalHeight);
  c.height = h;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0, c.width, h);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#FFFFFF';
  x.fillRect(0, 0, c.width, h);
  return c;
}

// ---------- chrome: progress bars, logo, share button ----------
function drawChrome(g, p, card, tl, assets, brief) {
  const { fg } = card.scheme;
  const n = p.cards.length;
  const gap = 10;
  const x0 = 28;
  const w = (SW - x0 * 2 - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (w + gap);
    g.globalAlpha = 0.35;
    g.fillStyle = fg;
    g.beginPath();
    g.roundRect(x, 34, w, 7, 4);
    g.fill();
    g.globalAlpha = 1;
    const k = i < card.index ? 1 : i > card.index ? 0 : clamp(tl / card.d);
    if (k > 0) {
      g.beginPath();
      g.roundRect(x, 34, w * k, 7, 4);
      g.fill();
    }
  }
  if (assets.logo) {
    const h = 58;
    const img = tinted(assets.logo, fg);
    g.drawImage(img, 36, 76, (h * img.width) / img.height, h);
  } else {
    g.fillStyle = fg;
    g.font = font(700, 44);
    g.textAlign = 'left';
    g.fillText(brief.product?.name ?? '', 36, 122);
  }
  if (['number', 'list', 'persona', 'summary'].includes(card.type)) {
    const k = easeOut((tl - 0.8) / 0.4);
    if (k > 0) {
      g.globalAlpha = k;
      const bw = 380;
      const bh = 78;
      const bx = SW / 2 - bw / 2;
      const by = SH - 150 + (1 - k) * 30;
      g.fillStyle = '#FFFFFF';
      g.beginPath();
      g.roundRect(bx, by, bw, bh, bh / 2);
      g.fill();
      // Share icon: an arrow out of a box.
      g.strokeStyle = '#141414';
      g.lineWidth = 4;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      const ix = bx + 54;
      const iy = by + bh / 2;
      g.beginPath();
      g.moveTo(ix - 12, iy - 2);
      g.lineTo(ix - 12, iy + 14);
      g.lineTo(ix + 12, iy + 14);
      g.lineTo(ix + 12, iy - 2);
      g.moveTo(ix, iy + 4);
      g.lineTo(ix, iy - 18);
      g.moveTo(ix - 8, iy - 10);
      g.lineTo(ix, iy - 18);
      g.lineTo(ix + 8, iy - 10);
      g.stroke();
      g.fillStyle = '#141414';
      g.font = font(700, 34);
      g.textAlign = 'left';
      g.fillText(brief.shareText ?? 'Share this story', bx + 92, by + bh / 2 + 12);
      g.globalAlpha = 1;
    }
  }
}

// ---------- cards ----------
const CARDS = {
  intro(g, c, tl, p, assets, brief) {
    const { bg, fg, a, b } = c.scheme;
    const band = 120 * easeOut(tl / 0.5);
    checkerBand(g, 150 - 120 + band, 120, SW, tl * 140, [a, bg]);
    checkerBand(g, SH - 150 - band, 120, SW, -tl * 140, [b, bg]);
    pixelBlob(g, SW - 60, 1180, 150, 22, 9, (tl - 0.4) / 0.8, [b, fg]);
    const pop = easeBack(tl / 0.9);
    starburst(g, SW / 2, 860, 470 * pop, 14, 0.78, tl * 0.25, a);
    scallop(g, SW / 2, 860, 330 * easeBack((tl - 0.15) / 0.9), 9, 0.16, -tl * 0.35, b);
    g.save();
    g.translate(SW / 2, 860);
    const s = easeBack((tl - 0.3) / 0.7);
    g.scale(s, s);
    g.fillStyle = ink(b);
    g.textAlign = 'center';
    g.font = font(900, 250);
    g.fillText(String(brief.year ?? ''), 0, 88);
    g.restore();
    g.font = font(700, 92);
    const { size, lines } = fitText(g, c.title ?? '', 700, 96, 900, 3);
    g.font = font(700, size);
    revealLines(g, lines, SW / 2, 1460, size * 1.08, tl, 0.6, fg);
    if (c.text) {
      g.font = font(500, 44);
      revealLines(g, wrap(g, c.text, 880), SW / 2, 1460 + lines.length * size * 1.08 + 40, 56, tl, 0.9, fg);
    }
  },

  statement(g, c, tl, p) {
    const { fg } = c.scheme;
    ribbon(g, ribbonPath(c.index * 7 + 1, -200, 180, SW + 200, 640, 3), 120, easeOut(tl / 1.4), IRIDESCENT);
    ribbon(g, ribbonPath(c.index * 7 + 3, -200, 1300, SW + 200, 1760, 2), 120, easeOut((tl - 0.3) / 1.4), [...IRIDESCENT].reverse());
    const { size, lines } = fitText(g, c.title ?? '', 700, 104, 900, 5);
    const lh = size * 1.08;
    const sub = c.text ? (g.font = font(500, 46), wrap(g, c.text, 860)) : [];
    const total = lines.length * lh + (sub.length ? 40 + sub.length * 58 : 0);
    const y0 = SH / 2 - total / 2 + size * 0.8;
    g.font = font(700, size);
    revealLines(g, lines, SW / 2, y0, lh, tl, 0.2, fg);
    g.font = font(500, 46);
    revealLines(g, sub, SW / 2, y0 + lines.length * lh + 40, 58, tl, 0.6, fg);
  },

  number(g, c, tl, p, assets, brief) {
    const { bg, fg, a, b } = c.scheme;
    const value = Number(c.value ?? 0);
    const counted = value * easeOut(Math.min(1, tl / 1.4) ** 0.6);
    const text = `${c.prefix ?? ''}${formatNumber(counted, brief.locale)}${c.suffix ?? ''}`;
    const finalText = `${c.prefix ?? ''}${formatNumber(value, brief.locale)}${c.suffix ?? ''}`;
    g.font = font(900, 240);
    const size = Math.min(260, (240 * 960) / g.measureText(finalText).width);
    const split = c.d * 0.42;
    if (tl < split) {
      g.font = font(700, 54);
      revealLines(g, wrap(g, c.label ?? '', 900), SW / 2, 560, 66, tl, 0.1, fg);
      g.save();
      g.translate(SW / 2, SH / 2 + size * 0.35);
      const s = easeBack(tl / 0.6);
      g.scale(s, s);
      g.font = font(900, size);
      g.textAlign = 'center';
      g.fillStyle = fg;
      g.fillText(text, 0, 0);
      g.restore();
      return;
    }
    // The number repeats in rows that fill the screen, sliding in turn.
    const t2 = tl - split;
    const rowH = size * 0.92;
    const rows = Math.ceil(SH / rowH) + 1;
    const colors = [fg, a, b, fg];
    g.font = font(900, size);
    g.textAlign = 'center';
    for (let r = 0; r < rows; r++) {
      const k = easeOut((t2 - r * 0.035) / 0.35);
      if (k <= 0) continue;
      const dir = r % 2 ? 1 : -1;
      const x = SW / 2 + dir * ((1 - k) * SW + t2 * 60);
      g.fillStyle = colors[r % colors.length];
      g.fillText(finalText, x, r * rowH + rowH * 0.85);
    }
    // A box with the label and the line below, like a caption card.
    const kb = easeBack((t2 - 0.5) / 0.5);
    if (kb > 0) {
      const lines = (g.font = font(500, 44), wrap(g, c.text ?? '', 780));
      const bh = 120 + 70 + lines.length * 56;
      const by = SH - 330 - bh;
      g.save();
      g.translate(SW / 2, by + bh / 2);
      g.scale(kb, kb);
      g.fillStyle = bg;
      g.beginPath();
      g.roundRect(-450, -bh / 2, 900, bh, 36);
      g.fill();
      g.fillStyle = fg;
      g.textAlign = 'center';
      g.font = font(700, 52);
      g.fillText(c.label ?? '', 0, -bh / 2 + 100);
      g.font = font(500, 44);
      lines.forEach((l, i) => g.fillText(l, 0, -bh / 2 + 180 + i * 56));
      g.restore();
    }
  },

  list(g, c, tl, p, assets) {
    const { bg, fg, a, b } = c.scheme;
    scallop(g, SW - 40, SH - 260, 300 * easeBack((tl - 0.2) / 0.8), 8, 0.2, tl * 0.4, b);
    g.font = font(700, 86);
    const { size, lines } = fitText(g, c.title ?? '', 700, 92, 960, 2);
    g.font = font(700, size);
    revealLines(g, lines, 60, 300, size * 1.05, tl, 0.1, fg, 'left');
    const items = (c.items ?? []).slice(0, 5).map((it) => (typeof it === 'string' ? { title: it } : it));
    const top = 300 + lines.length * size * 1.05 + 70;
    const rowH = Math.min(230, (SH - 260 - top) / Math.max(1, items.length));
    items.forEach((it, i) => {
      const k = easeBack((tl - 0.4 - i * 0.12) / 0.55);
      if (k <= 0) return;
      const y = top + i * rowH;
      g.save();
      g.translate((1 - k) * 700, 0);
      g.fillStyle = a;
      g.font = font(900, 104);
      g.textAlign = 'left';
      g.fillText(String(i + 1), 60, y + rowH * 0.62);
      const tx = 180;
      const ts = rowH * 0.78;
      const img = assets.items[c.index]?.[i];
      if (img) {
        g.save();
        g.beginPath();
        g.roundRect(tx, y + (rowH - ts) / 2 - 10, ts, ts, 10);
        g.clip();
        const s = Math.max(ts / img.width, ts / img.height);
        g.drawImage(img, tx + ts / 2 - (img.width * s) / 2, y + rowH / 2 - 10 - (img.height * s) / 2, img.width * s, img.height * s);
        g.restore();
      } else {
        // A small shape tile stands in for cover art.
        g.fillStyle = [b, fg, a][i % 3] === bg ? fg : [b, fg, a][i % 3];
        g.beginPath();
        g.roundRect(tx, y + (rowH - ts) / 2 - 10, ts, ts, 10);
        g.fill();
        const shapeColor = ink(g.fillStyle) === '#141414' ? bg : a;
        if (i % 2) starburst(g, tx + ts / 2, y + rowH / 2 - 10, ts * 0.36, 10, 0.7, tl * 0.8, shapeColor);
        else scallop(g, tx + ts / 2, y + rowH / 2 - 10, ts * 0.36, 6, 0.25, -tl * 0.8, shapeColor);
      }
      const x = tx + ts + 34;
      const maxW = SW - x - 50;
      g.fillStyle = fg;
      const tf = fitText(g, it.title ?? '', 700, 56, maxW, 1);
      g.font = font(700, tf.size);
      g.fillText(tf.lines[0] ?? '', x, y + rowH * (it.sub ? 0.45 : 0.58));
      if (it.sub) {
        g.globalAlpha = 0.75;
        const sf = fitText(g, it.sub, 500, 38, maxW, 1);
        g.font = font(500, sf.size);
        g.fillText(sf.lines[0] ?? '', x, y + rowH * 0.45 + 52);
        g.globalAlpha = 1;
      }
      g.restore();
    });
  },

  persona(g, c, tl, p) {
    const { bg, fg, a, b } = c.scheme;
    g.font = font(700, 52);
    revealLines(g, wrap(g, c.kicker ?? '', 900), SW / 2, 270, 62, tl, 0.05, fg);
    const k = easeBack((tl - 0.25) / 0.7);
    if (k > 0) {
      g.save();
      g.translate(SW / 2, 950);
      g.rotate(Math.sin(tl * 2.2) * 0.03 - 0.04);
      g.scale(k, k);
      g.fillStyle = b;
      g.beginPath();
      g.roundRect(-370, -500, 740, 1000, 44);
      g.fill();
      g.fillStyle = a;
      g.beginPath();
      g.roundRect(-340, -470, 680, 940, 32);
      g.fill();
      pixelBlob(g, 0, -120, 250, 28, c.index * 13 + 5, (tl - 0.5) / 1.2, [b, bg, fg]);
      const cardInk = ink(a);
      const tf = fitText(g, c.title ?? '', 900, 92, 600, 2);
      g.font = font(900, tf.size);
      g.fillStyle = cardInk;
      g.textAlign = 'center';
      tf.lines.forEach((l, i) => g.fillText(l, 0, 280 + i * tf.size * 1.02));
      g.restore();
    }
    g.font = font(500, 44);
    revealLines(g, wrap(g, c.text ?? '', 880), SW / 2, 1560, 56, tl, 1.0, fg);
  },

  summary(g, c, tl, p, assets, brief) {
    const { bg, fg, a, b } = c.scheme;
    const k = easeBack(tl / 0.7);
    starburst(g, 120, 260, 190 * easeBack((tl - 0.3) / 0.6), 12, 0.72, tl * 0.5, b);
    scallop(g, SW - 90, SH - 320, 220 * easeBack((tl - 0.45) / 0.6), 7, 0.22, -tl * 0.5, b);
    g.save();
    g.translate(SW / 2, SH / 2 - 40);
    g.scale(k, k);
    g.rotate(-0.025);
    const pw = 900;
    const ph = 1300;
    g.fillStyle = a;
    g.beginPath();
    g.roundRect(-pw / 2, -ph / 2, pw, ph, 40);
    g.fill();
    const tc = ink(a);
    g.fillStyle = tc;
    g.textAlign = 'left';
    const x0 = -pw / 2 + 60;
    g.font = font(900, 76);
    g.fillText(c.title ?? `${brief.product?.name ?? ''} ${brief.year ?? ''}`, x0, -ph / 2 + 130);
    // Left column: a top-5 list.
    const list = c.list ?? {};
    g.font = font(700, 40);
    g.globalAlpha = 0.8;
    g.fillText(list.title ?? '', x0, -ph / 2 + 240);
    g.globalAlpha = 1;
    (list.items ?? []).slice(0, 5).forEach((it, i) => {
      const title = typeof it === 'string' ? it : it.title;
      g.font = font(700, 40);
      const tf = fitText(g, `${i + 1}  ${title}`, 700, 42, pw / 2 - 40, 1);
      g.font = font(700, tf.size);
      g.fillText(tf.lines[0], x0, -ph / 2 + 310 + i * 64);
    });
    // Right column: headline stats.
    const xr = 40;
    (c.stats ?? []).slice(0, 3).forEach((s, i) => {
      const y = -ph / 2 + 240 + i * 190;
      g.globalAlpha = 0.8;
      g.font = font(700, 40);
      g.fillText(s.label ?? '', xr, y);
      g.globalAlpha = 1;
      const tf = fitText(g, String(s.value ?? ''), 900, 104, pw / 2 - 80, 1);
      g.font = font(900, tf.size);
      g.fillText(tf.lines[0], xr, y + 110);
    });
    // Bottom band: a pixel blob and the call to action.
    pixelBlob(g, 0, ph / 2 - 330, 200, 24, 77, (tl - 0.5) / 1.0, [bg, b, fg]);
    g.fillStyle = tc;
    g.textAlign = 'center';
    g.font = font(700, 46);
    g.fillText(c.cta ?? brief.product?.url ?? '', 0, ph / 2 - 70);
    g.restore();
  },

  outro(g, c, tl, p, assets, brief) {
    const { bg, fg, a, b } = c.scheme;
    const band = 120 * easeOut(tl / 0.5);
    checkerBand(g, 150 - 120 + band, 120, SW, tl * 140, [b, bg]);
    checkerBand(g, SH - 150 - band, 120, SW, -tl * 140, [a, bg]);
    starburst(g, SW / 2, SH / 2 - 120, 560 * easeBack(tl / 0.9), 18, 0.86, tl * 0.25, a);
    scallop(g, SW / 2, SH / 2 - 120, 430 * easeBack((tl - 0.2) / 0.8), 10, 0.12, -tl * 0.3, b);
    const tf = fitText(g, c.title ?? '', 900, 104, 680, 4);
    g.font = font(900, tf.size);
    const lh = tf.size * 1.02;
    revealLines(g, tf.lines, SW / 2, SH / 2 - 120 - ((tf.lines.length - 1) * lh) / 2 + tf.size * 0.35, lh, tl, 0.4, ink(b));
    const cta = c.cta ?? brief.product?.url;
    if (cta) {
      const k = easeBack((tl - 0.9) / 0.5);
      if (k > 0) {
        g.save();
        g.translate(SW / 2, SH - 420);
        g.scale(k, k);
        g.font = font(700, 50);
        const w = g.measureText(cta).width + 100;
        g.fillStyle = fg;
        g.beginPath();
        g.roundRect(-w / 2, -50, w, 100, 50);
        g.fill();
        g.fillStyle = bg;
        g.textAlign = 'center';
        g.fillText(cta, 0, 18);
        g.restore();
      }
    }
  },
};

// ---------- film ----------
async function load() {
  const brief = await (await fetch(briefUrl)).json();
  const p = plan(brief);
  const canvas = document.getElementById('film');
  canvas.width = p.width;
  canvas.height = p.height;
  const g = canvas.getContext('2d');
  const story = document.createElement('canvas');
  story.width = SW;
  story.height = SH;
  const sg = story.getContext('2d');
  const assets = { logo: null, items: {} };
  if (brief.product?.logo) assets.logo = await whiteMask(new URL(brief.product.logo, briefUrl));
  for (const card of p.cards) {
    if (card.type !== 'list') continue;
    assets.items[card.index] = await Promise.all((card.items ?? []).map((it) =>
      typeof it === 'object' && it.image ? loadImage(new URL(it.image, briefUrl)) : null
    ));
  }
  await document.fonts.load(font(900, 64));
  await document.fonts.load(font(700, 64));
  await document.fonts.load(font(500, 64));

  const drawStory = (t) => {
    const card = p.cards.find((c) => t >= c.t && t < c.t + c.d) ?? p.cards[p.cards.length - 1];
    const tl = t - card.t;
    sg.save();
    sg.fillStyle = card.scheme.bg;
    sg.fillRect(0, 0, SW, SH);
    // A small bounce on every cut.
    const pop = 1 + 0.04 * (1 - easeOut(tl / 0.25));
    sg.translate(SW / 2, SH / 2);
    sg.scale(pop, pop);
    sg.translate(-SW / 2, -SH / 2);
    CARDS[card.type]?.(sg, card, tl, p, assets, brief);
    sg.restore();
    drawChrome(sg, p, card, tl, assets, brief);
    return card;
  };

  const render = (t) => {
    const card = drawStory(t);
    if (p.width === SW && p.height === SH) {
      g.drawImage(story, 0, 0);
      return;
    }
    // Other formats show the story on a phone over a contrasting backdrop.
    const { a, b } = card.scheme;
    g.fillStyle = a;
    g.fillRect(0, 0, p.width, p.height);
    const tl = t - card.t;
    starburst(g, p.width * 0.12, p.height * 0.2, p.height * 0.32, 12, 0.75, tl * 0.2, b);
    scallop(g, p.width * 0.88, p.height * 0.85, p.height * 0.36, 8, 0.18, -tl * 0.2, b);
    const h = p.height * 0.9;
    const w = (h * SW) / SH;
    const x = (p.width - w) / 2;
    const y = (p.height - h) / 2;
    const r = h * 0.045;
    g.fillStyle = '#0B0B0B';
    g.beginPath();
    g.roundRect(x - 14, y - 14, w + 28, h + 28, r + 14);
    g.fill();
    g.save();
    g.beginPath();
    g.roundRect(x, y, w, h, r);
    g.clip();
    g.drawImage(story, x, y, w, h);
    g.restore();
  };

  Object.assign(window.film, {
    width: p.width,
    height: p.height,
    fps: p.fps,
    duration: p.length,
    keyTimes: p.keyTimes,
    canvas,
    render,
  });
}

window.film = { ready: load() };