// The whitespace-humble film: a black-and-white magazine page. A vast gray
// studio photograph with the product small in its upper left, a short
// self-deprecating headline under it, and three columns of honest body
// copy ending in the logo. The camera starts on the empty field, reveals the
// page, reads the copy as it is set, and pulls back to the finished ad.
//
// URL parameters: brief=<url of brief.json>. Files named in the brief are
// resolved relative to the brief.
import { paragraphs, plan } from './plan.mjs';

const FONT = 'Jost, sans-serif';
const INK = '#1b1b1a';
const PAPER = '#fbfbf8';

const params = new URLSearchParams(location.search);
if (!params.has('brief')) throw new Error('Open this page with ?brief=<url of brief.json>');
const briefUrl = new URL(params.get('brief'), location.href);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (k) => {
  const x = clamp(k, 0, 1);
  return x * x * (3 - 2 * x);
};
const ease2 = (k) => ease(ease(k));

async function loadImage(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

// The image in black and white, a touch of contrast, like a halftone print.
function grayscale(img, maxH = 1400) {
  const h = Math.min(maxH, img.naturalHeight || maxH);
  const w = Math.round((h * img.naturalWidth) / img.naturalHeight);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.filter = 'grayscale(1) contrast(1.12) brightness(0.97)';
  g.drawImage(img, 0, 0, w, h);
  return c;
}

// Film grain tile.
function grainTile(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const d = g.createImageData(size, size);
  let s = 12345;
  for (let i = 0; i < d.data.length; i += 4) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const v = (s >>> 24) & 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  return c;
}

// ---------- layout ----------

function layout(g, p, brief, img) {
  const W = p.width;
  const H = p.height;
  // The page is designed on a portrait magazine page `u` wide.
  const u = Math.min(W, H * 0.79);
  const textW = u * 0.76;
  const left = (W - textW) / 2;
  const gap = u * 0.03;
  const colW = (textW - gap * 2) / 3;
  const fs = u * 0.0148;
  const lh = fs * 1.34;
  const hs = u * 0.052;
  const logoS = lh * 3.4;

  // Flow the paragraphs and sign-off into lines, three columns, with room
  // for the logo at the foot of the last.
  g.font = `400 ${fs}px ${FONT}`;
  const space = g.measureText(' ').width;
  const paras = paragraphs(brief.body);
  const signoff = String(brief.signoff ?? '').trim().split(/\s+/).filter(Boolean);
  const blocks = [...paras.map((ws) => ({ ws })), ...(signoff.length ? [{ ws: signoff, signoff: true }] : [])];
  let wordIndex = 0;
  const flat = blocks.map((b) => b.ws.map((w) => ({ text: w, w: g.measureText(w).width, i: wordIndex++, signoff: b.signoff })));

  function flow(rows) {
    const slots = [];
    for (let c = 0; c < 3; c++) {
      for (let r = 0; r < rows; r++) {
        const nearLogo = c === 2 && r >= rows - 3;
        slots.push({ c, r, width: nearLogo ? colW - logoS - gap * 0.5 : colW });
      }
    }
    const lines = [];
    let si = 0;
    for (const words of flat) {
      let line = null;
      for (const w of words) {
        if (!line || line.width + space + w.w > slots[line.slot].width) {
          if (line) lines.push(line);
          if (si >= slots.length) return null;
          line = { slot: si++, width: 0, words: [] };
          w.x = 0;
          line.width = w.w;
        } else {
          w.x = line.width + space;
          line.width += space + w.w;
        }
        line.words.push(w);
      }
      if (line) lines.push(line);
    }
    return { lines, slots };
  }
  // The fewest rows that hold everything: two full columns and the rest.
  let rows = 4;
  let res = null;
  while (!(res = flow(rows))) rows++;

  const bottom = H - u * 0.045;
  const bodyTop = bottom - rows * lh;
  const headBase = bodyTop - u * 0.036;
  const photoBottom = headBase - hs * 0.72 - u * 0.045;
  const words = [];
  for (const line of res.lines) {
    const s = res.slots[line.slot];
    const x0 = left + s.c * (colW + gap);
    const y = bodyTop + (s.r + 1) * lh - lh * 0.28;
    for (const w of line.words) words[w.i] = { ...w, x: x0 + w.x, y, col: s.c, colX: x0 + colW / 2 };
  }

  // The product: small, in the upper left of the field, with the area of
  // a car one sixth of the page wide.
  const ratio = img ? img.width / img.height : 2.2;
  const area = (u * 0.17) ** 2 * 0.45 * (brief.product?.scale ?? 1) ** 2;
  const ph = Math.sqrt(area / ratio);
  const pw = ph * ratio;
  const px = Math.min(left + textW * 0.25, W * 0.31) - pw / 2;
  const py = photoBottom * 0.36 - ph / 2;

  return {
    W, H, u, left, textW, colW, gap, fs, lh, hs, rows, bodyTop, headBase, photoBottom, words, logoS,
    logo: { x: left + 2 * (colW + gap) + colW - logoS, y: bodyTop + (rows - 3) * lh + lh * 0.1 },
    product: { x: px, y: py, w: pw, h: ph },
  };
}

// ---------- drawing ----------

function drawPhoto(g, L, grain, frame) {
  const { W, photoBottom: B, product: P } = L;
  // Seamless gray backdrop, brighter where the light falls.
  g.fillStyle = '#d4d4d1';
  g.fillRect(0, 0, W, B);
  const cx = P.x + P.w / 2;
  const cy = P.y + P.h;
  const glow = g.createRadialGradient(cx + W * 0.1, cy, 0, cx + W * 0.1, cy, Math.max(W, B) * 0.9);
  glow.addColorStop(0, 'rgba(236,236,233,0.9)');
  glow.addColorStop(1, 'rgba(236,236,233,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, B);
  const fall = g.createLinearGradient(0, 0, 0, B);
  fall.addColorStop(0, 'rgba(120,120,118,0.16)');
  fall.addColorStop(0.35, 'rgba(120,120,118,0)');
  fall.addColorStop(1, 'rgba(255,255,255,0.08)');
  g.fillStyle = fall;
  g.fillRect(0, 0, W, B);
  g.save();
  g.beginPath();
  g.rect(0, 0, W, B);
  g.clip();
  g.globalAlpha = 0.07;
  g.globalCompositeOperation = 'overlay';
  const o = (frame * 73) % 256;
  g.translate(-o, -((frame * 131) % 256));
  g.fillStyle = g.createPattern(grain, 'repeat');
  g.fillRect(0, 0, W + 512, B + 512);
  g.restore();
}

function drawProduct(g, L, img, alpha) {
  if (alpha <= 0) return;
  const P = L.product;
  g.save();
  g.globalAlpha = alpha;
  // Soft shadow on the floor of the set.
  const sx = P.x + P.w / 2;
  const sy = P.y + P.h - P.h * 0.02;
  g.translate(sx, sy);
  g.scale(1, 0.1);
  const sh = g.createRadialGradient(0, 0, 0, 0, 0, P.w * 0.6);
  sh.addColorStop(0, 'rgba(30,30,30,0.55)');
  sh.addColorStop(0.6, 'rgba(30,30,30,0.2)');
  sh.addColorStop(1, 'rgba(30,30,30,0)');
  g.fillStyle = sh;
  g.fillRect(-P.w, -P.w, P.w * 2, P.w * 2);
  g.restore();
  g.save();
  g.globalAlpha = alpha;
  if (img) g.drawImage(img, P.x, P.y, P.w, P.h);
  g.restore();
}

function drawLogo(g, x, y, s, logo, name) {
  if (logo) {
    const h = s;
    const w = Math.min(s * 2.2, (h * logo.width) / logo.height);
    g.drawImage(logo, x + s - w, y, w, (w * logo.height) / logo.width);
    return;
  }
  // A plain round badge with the initial.
  g.strokeStyle = INK;
  g.lineWidth = s * 0.06;
  g.beginPath();
  g.arc(x + s / 2, y + s / 2, s * 0.45, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = INK;
  g.font = `600 ${s * 0.5}px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(name.slice(0, 1).toUpperCase(), x + s / 2, y + s * 0.53);
}

// ---------- film ----------

async function load() {
  const brief = await (await fetch(briefUrl)).json();
  const p = plan(brief);
  await document.fonts.load(`400 20px ${FONT}`);
  await document.fonts.load(`600 20px ${FONT}`);
  const product = brief.product ?? {};
  const raw = product.image ? await loadImage(new URL(product.image, briefUrl)) : null;
  const img = raw ? (product.color ? raw : grayscale(raw)) : null;
  const logoRaw = product.logo ? await loadImage(new URL(product.logo, briefUrl)) : null;
  const logo = logoRaw ? grayscale(logoRaw, 600) : null;
  const name = String(product.name ?? 'Product');
  const headline = String(brief.headline ?? `${name}.`);
  const legal = String(brief.legal ?? '');

  const canvas = document.getElementById('film');
  canvas.width = p.width;
  canvas.height = p.height;
  const g = canvas.getContext('2d');
  const L = layout(g, p, brief, img);
  const grain = grainTile();

  // Camera keyframes: the empty field, the whole page, then reading.
  const field = { z: p.height / L.photoBottom, x: p.width / 2, y: L.photoBottom / 2 };
  const page = { z: 1, x: p.width / 2, y: p.height / 2 };
  const zRead = clamp(p.width / (L.colW * 1.9), 1.6, 3);
  // The reading target follows the word being set, smoothed.
  const n = Math.ceil(p.length * p.fps) + 1;
  const tx = [];
  let wi = 0;
  for (let i = 0; i < n; i++) {
    const t = i / p.fps;
    while (wi + 1 < p.words.length && p.words[wi + 1].t <= t) wi++;
    const w = L.words[wi] ?? L.words[0];
    tx.push(w ? w.colX : page.x);
  }
  const smooth = (a, sigma) => a.map((_, i) => {
    let s = 0;
    let k = 0;
    for (let j = -sigma * 3; j <= sigma * 3; j++) {
      const v = a[clamp(i + j, 0, a.length - 1)];
      const wgt = Math.exp(-((j / sigma) ** 2) / 2);
      s += v * wgt;
      k += wgt;
    }
    return s / k;
  });
  const sx = smooth(tx, Math.round(p.fps * 0.6));
  const readAt = (t) => {
    const i = clamp(Math.round(t * p.fps), 0, n - 1);
    const hw = p.width / zRead / 2;
    const hh = p.height / zRead / 2;
    // Read across at the height of the copy, headline in view; below the
    // page is more paper, so the copy can sit mid-frame.
    const yRead = (L.headBase - L.hs + L.bodyTop + L.rows * L.lh) / 2;
    return { z: zRead, x: clamp(sx[i], hw, p.width - hw), y: clamp(yRead, hh, p.height) };
  };
  // Zoom geometrically; the center may lead (kc > kz) or follow the zoom.
  const mix = (a, b, kz, kc = kz) => ({
    z: a.z * (b.z / a.z) ** kz,
    x: a.x + (b.x - a.x) * kc,
    y: a.y + (b.y - a.y) * kc,
  });
  const camAt = (t) => {
    if (t < p.reveal) return { ...field, z: field.z * (1 + 0.015 * t) };
    if (t < p.bodyStart - 0.35) return mix({ ...field, z: field.z * (1 + 0.015 * p.reveal) }, page, ease2((t - p.reveal) / 1.5));
    if (t < p.pullback) {
      const k = (t - (p.bodyStart - 0.35)) / 1.1;
      return mix(page, readAt(t), ease2(k), ease2(k * 1.5));
    }
    const k = (t - p.pullback) / (p.holdFrom - p.pullback);
    return mix(readAt(p.pullback), page, ease2(k * 1.3), ease2(k));
  };

  function render(t) {
    const frame = Math.round(t * p.fps);
    const c = camAt(t);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = PAPER;
    g.fillRect(0, 0, p.width, p.height);
    g.setTransform(c.z, 0, 0, c.z, p.width / 2 - c.x * c.z, p.height / 2 - c.y * c.z);

    drawPhoto(g, L, grain, frame);
    drawProduct(g, L, img, ease((t - p.productIn) / 0.9));

    // Headline.
    const ha = ease((t - p.headlineAt) / 0.5);
    if (ha > 0) {
      g.globalAlpha = ha;
      g.fillStyle = INK;
      g.font = `600 ${L.hs}px ${FONT}`;
      g.letterSpacing = `${-L.hs * 0.01}px`;
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillText(headline, p.width / 2, L.headBase);
      g.letterSpacing = '0px';
      g.globalAlpha = 1;
    }
    // Body copy, word by word.
    g.font = `400 ${L.fs}px ${FONT}`;
    g.textAlign = 'left';
    g.fillStyle = INK;
    L.words.forEach((w, i) => {
      const a = ease((t - (p.words[i]?.t ?? 0)) / 0.12);
      if (a <= 0) return;
      g.globalAlpha = a;
      g.fillText(w.text, w.x, w.y);
    });
    g.globalAlpha = 1;
    // Logo and the small print.
    const la = ease((t - p.logoAt) / 0.5);
    if (la > 0) {
      g.globalAlpha = la;
      drawLogo(g, L.logo.x, L.logo.y, L.logoS, logo, name);
      if (legal) {
        g.font = `400 ${L.fs * 0.55}px ${FONT}`;
        g.textAlign = 'right';
        g.fillStyle = INK;
        g.fillText(legal, L.left + L.textW, L.bodyTop - L.lh * 0.35);
      }
      g.globalAlpha = 1;
    }
  }

  Object.assign(window.film, {
    width: p.width, height: p.height, fps: p.fps, duration: p.length,
    keyTimes: p.keyTimes, canvas, render,
  });
  render(0);
}

window.film = { ready: load() };
