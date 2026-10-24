// The search-box-story film: a story told only through searches. Queries are
// typed into a plain search page, autocomplete drops down, results load, the
// pointer hovers and clicks, and the camera leans in on every beat. It ends
// on an empty box and a one-line tagline.
//
// URL parameters: brief=<url of brief.json>. Files named in the brief are
// resolved relative to the brief.
import { plan } from './plan.mjs';

const UI = 'Arimo, Arial, sans-serif';
const MARK = '"Libre Baskerville", Georgia, serif';
const C = {
  link: '#2200C1',
  visited: '#551A8B',
  url: '#0E774A',
  text: '#000000',
  gray: '#767676',
  border: '#A5ACB2',
  bar: '#F0F7F9',
  barLine: '#6B90DA',
  red: '#CC0000',
  select: '#3399FF',
};
// Two page layouts: a desktop page for wide formats, and a phone page for
// tall ones, where a desktop page would leave most of the frame empty.
const LAYOUTS = {
  desktop: {
    mobile: false, pw: 1280, top: 132, colX: 156, colW: 600, bar: 92,
    home: { x: 340, y: 290, w: 600, h: 34 },
    res: { x: 156, y: 42, w: 520, h: 30 },
    mark: { home: [640, 252, 84, 'center'], res: [16, 66, 30, 'left'] },
  },
  mobile: {
    mobile: true, pw: 340, top: 172, colX: 12, colW: 316, bar: 132,
    home: { x: 14, y: 290, w: 312, h: 40 },
    res: { x: 10, y: 76, w: 320, h: 38 },
    mark: { home: [170, 250, 58, 'center'], res: [170, 58, 30, 'center'] },
  },
};
let L = LAYOUTS.desktop;
// Per format: page width visible while typing, on results, and on a click.
const VW = {
  '16:9': { layout: 'desktop', typing: 860, results: 1120, click: 920 },
  '1:1': { layout: 'desktop', typing: 620, results: 700, click: 640 },
  '4:5': { layout: 'mobile', typing: 340, results: 352, click: 346 },
  '9:16': { layout: 'mobile', typing: 340, results: 346, click: 344 },
};

const params = new URLSearchParams(location.search);
if (!params.has('brief')) throw new Error('Open this page with ?brief=<url of brief.json>');
const briefUrl = new URL(params.get('brief'), location.href);

// ---------- helpers ----------
const font = (size, weight = 400, family = UI, style = '') => `${style} ${weight} ${size}px ${family}`.trim();
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x) => {
  const k = clamp(x);
  return k * k * (3 - 2 * k);
};
const lerp = (a, b, k) => a + (b - a) * k;

function hash(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function wrapWords(g, words, maxW) {
  const lines = [[]];
  let w = 0;
  for (const word of words) {
    g.font = word.bold ? font(13, 700) : font(13);
    const ww = g.measureText(`${word.text} `).width;
    if (w + ww > maxW && lines[lines.length - 1].length) {
      lines.push([]);
      w = 0;
    }
    lines[lines.length - 1].push({ ...word, w: ww });
    w += ww;
  }
  return lines;
}

// Snippet words, with the query's words in bold.
function snippetWords(text, query) {
  const terms = new Set(query.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  return String(text ?? '').split(/\s+/).filter(Boolean).map((t) => ({
    text: t,
    bold: terms.has(t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')),
  }));
}

function autoSuggest(query) {
  return [query, `${query} tips`, `${query} examples`, `${query} for beginners`];
}

function autoResults(query) {
  const title = query.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const slug = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return [
    { title: `${title} - The Complete Guide`, url: `www.guides.com/${slug}`, text: `Everything you need to know about ${query}, with tips from people who have done it.` },
    { title: `${title}? Here's what worked for me`, url: `www.forum.net/t/${slug}`, text: `I asked about ${query} last year. These are the answers that actually helped.` },
    { title: `10 things to know about ${query}`, url: `www.dailyhow.com/${slug}`, text: `Short answers to the most common questions about ${query}.` },
  ];
}

// ---------- layout of a results page ----------
// Returns the blocks of the page with their positions, so drawing and the
// pointer's targets agree.
function layoutResults(g, step) {
  const blocks = [];
  let y = L.top;
  const a = step.answer;
  if (a?.type === 'didyoumean') {
    blocks.push({ kind: 'didyoumean', y, h: 34, a });
    y += 34;
  }
  if (a && a.type !== 'didyoumean') {
    const h = { translate: 118, flight: 92, map: L.mobile ? 316 : 196, card: 96, site: L.mobile ? 166 : 150 }[a.type] ?? 96;
    blocks.push({ kind: a.type, y, h, a, link: a.type === 'site' || a.type === 'flight' });
    y += h + 18;
  }
  // Results the brief gives come first; related ones fill the page to four.
  const given = step.results ?? [];
  const results = [...given, ...autoResults(step.query).slice(0, Math.max(0, 4 - given.length))];
  results.slice(0, 6).forEach((r, i) => {
    const lines = wrapWords(g, snippetWords(r.text, step.query), L.colW);
    const h = 22 + Math.min(2, lines.length) * 16 + 20;
    blocks.push({ kind: 'result', y, h, r, lines: lines.slice(0, 2), index: i, link: true });
    y += h + 14;
  });
  return blocks;
}

// The block a step clicks: the site answer, or result number `clickIndex`.
function clickTarget(step, blocks) {
  if (step.clickIndex === null) return null;
  if (step.answer?.type === 'site' && step.click === undefined) return blocks.find((b) => b.kind === 'site');
  return blocks.filter((b) => b.kind === 'result')[step.clickIndex] ?? blocks.find((b) => b.link);
}

// ---------- drawing ----------
function underline(g, x, y, w, color) {
  g.fillStyle = color;
  g.fillRect(x, y + 2, w, 1);
}

function topLinks(g, engine) {
  g.font = font(13);
  g.textBaseline = 'alphabetic';
  let x = 12;
  const tabs = engine.tabs ?? ['Web', 'Images', 'Videos', 'Maps', 'News', 'Shopping', 'more ▾'];
  (L.mobile ? tabs.slice(0, 4) : tabs).forEach((tab, i) => {
    g.font = i === 0 ? font(13, 700) : font(13);
    g.fillStyle = i === 0 ? C.text : C.link;
    g.fillText(tab, x, 20);
    const w = g.measureText(tab).width;
    if (i) underline(g, x, 20, w, C.link);
    x += w + 12;
  });
  g.font = font(13);
  g.fillStyle = C.link;
  g.textAlign = 'right';
  g.fillText('Sign in', L.pw - 14, 20);
  underline(g, L.pw - 14 - g.measureText('Sign in').width, 20, g.measureText('Sign in').width, C.link);
  g.textAlign = 'left';
  g.fillStyle = '#C9D7F1';
  g.fillRect(0, 26, L.pw, 1);
}

function button(g, label, x, y) {
  g.font = font(13);
  const w = g.measureText(label).width + 22;
  const grad = g.createLinearGradient(0, y, 0, y + 26);
  grad.addColorStop(0, '#FDFDFD');
  grad.addColorStop(1, '#E6E6E6');
  g.fillStyle = grad;
  g.fillRect(x, y, w, 26);
  g.strokeStyle = '#B6B6B6';
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, 25);
  g.fillStyle = C.text;
  g.fillText(label, x + 11, y + 17);
  return w;
}

// The text field with typed text, an optional selection and a caret.
function field(g, box, text, { selected = false, caret = false, size = 17 }) {
  g.fillStyle = '#FFFFFF';
  g.fillRect(box.x, box.y, box.w, box.h);
  g.strokeStyle = C.border;
  g.lineWidth = 1;
  g.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
  g.fillStyle = '#7E7E7E';
  g.fillRect(box.x, box.y, box.w, 1);
  g.font = font(size);
  const tx = box.x + 7;
  const ty = box.y + box.h / 2 + size * 0.35;
  const w = g.measureText(text).width;
  if (selected && text) {
    g.fillStyle = C.select;
    g.fillRect(tx - 1, box.y + 5, w + 2, box.h - 10);
    g.fillStyle = '#FFFFFF';
  } else g.fillStyle = C.text;
  g.fillText(text, tx, ty);
  if (caret) {
    g.fillStyle = C.text;
    g.fillRect(tx + w + 1, box.y + 6, 1.2, box.h - 12);
  }
  return tx + w;
}

function dropdown(g, box, typed, suggestions) {
  const list = suggestions.filter((s) => s.toLowerCase().startsWith(typed.toLowerCase()) && s.length > typed.length).slice(0, 6);
  if (!typed || !list.length) return;
  const rowH = 24;
  const y0 = box.y + box.h;
  g.fillStyle = '#FFFFFF';
  g.fillRect(box.x, y0, box.w, list.length * rowH + 6);
  g.strokeStyle = '#7E7E7E';
  g.strokeRect(box.x + 0.5, y0 + 0.5, box.w - 1, list.length * rowH + 5);
  g.save();
  g.beginPath();
  g.rect(box.x, y0, box.w - 4, list.length * rowH + 6);
  g.clip();
  list.forEach((s, i) => {
    const y = y0 + 18 + i * rowH;
    g.font = font(16);
    g.fillStyle = C.text;
    g.fillText(s.slice(0, typed.length), box.x + 7, y);
    const w = g.measureText(s.slice(0, typed.length)).width;
    g.font = font(16, 700);
    g.fillText(s.slice(typed.length), box.x + 7 + w, y);
    if (L.mobile) return;
    g.font = font(12);
    g.fillStyle = '#008000';
    g.textAlign = 'right';
    const n = (hash(s) % 9000000) + 120000;
    g.fillText(`${n.toLocaleString('en-US')} results`, box.x + box.w - 8, y);
    g.textAlign = 'left';
  });
  g.restore();
}

function wordmark(g, engine, x, y, size, align = 'center') {
  g.font = font(size, 700, MARK);
  g.fillStyle = engine.color ?? '#3C4043';
  g.textAlign = align;
  g.fillText(engine.name ?? 'Search', x, y);
  g.textAlign = 'left';
}

function drawHome(g, st, engine) {
  topLinks(g, engine);
  const [mx, my, ms, ma] = L.mark.home;
  wordmark(g, engine, mx, my, ms, ma);
  const end = field(g, L.home, st.text, st);
  const labels = engine.buttons ?? ['Search', 'Surprise me'];
  g.font = font(13);
  const ws = labels.map((l) => g.measureText(l).width + 22);
  let x = L.pw / 2 - (ws[0] + ws[1] + 8) / 2;
  const by = L.home.y + L.home.h + 20;
  button(g, labels[0], x, by);
  x += ws[0] + 8;
  button(g, labels[1], x, by);
  if (st.dropdown) dropdown(g, L.home, st.text, st.suggest);
  return end;
}

function planeIcon(g, x, y) {
  g.fillStyle = '#5A6E8C';
  g.beginPath();
  g.moveTo(x, y + 8);
  g.lineTo(x + 26, y + 6);
  g.lineTo(x + 30, y + 9);
  g.lineTo(x + 26, y + 12);
  g.lineTo(x, y + 10);
  g.closePath();
  g.fill();
  g.fillRect(x + 12, y, 4, 18);
  g.fillRect(x + 2, y + 4, 3, 10);
}

function drawMap(g, x, y, w, h, seed, pins) {
  g.fillStyle = '#EAE6DD';
  g.fillRect(x, y, w, h);
  let s = seed;
  const rand = () => ((s = (s * 1103515245 + 12345) >>> 0) % 1000) / 1000;
  g.fillStyle = '#B9D3F0';
  g.beginPath();
  g.moveTo(x, y + h * 0.65);
  g.bezierCurveTo(x + w * 0.3, y + h * 0.5, x + w * 0.6, y + h * 0.85, x + w, y + h * 0.6);
  g.lineTo(x + w, y + h * 0.72);
  g.bezierCurveTo(x + w * 0.6, y + h * 0.97, x + w * 0.3, y + h * 0.62, x, y + h * 0.77);
  g.closePath();
  g.fill();
  g.strokeStyle = '#FFFFFF';
  for (let i = 0; i < 9; i++) {
    g.lineWidth = i % 3 ? 2 : 4;
    g.beginPath();
    if (i % 2) {
      const yy = y + rand() * h;
      g.moveTo(x, yy);
      g.lineTo(x + w, yy + (rand() - 0.5) * 40);
    } else {
      const xx = x + rand() * w;
      g.moveTo(xx, y);
      g.lineTo(xx + (rand() - 0.5) * 50, y + h);
    }
    g.stroke();
  }
  g.strokeStyle = '#C8C8C8';
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  pins.forEach((label, i) => {
    const px = x + w * (0.25 + 0.25 * i + rand() * 0.1);
    const py = y + h * (0.25 + rand() * 0.35);
    g.fillStyle = '#E74C3C';
    g.beginPath();
    g.arc(px, py - 10, 8, Math.PI, 0);
    g.lineTo(px, py);
    g.closePath();
    g.fill();
    g.fillStyle = '#FFFFFF';
    g.font = font(10, 700);
    g.textAlign = 'center';
    g.fillText(label, px, py - 7);
    g.textAlign = 'left';
  });
}

// An underlined link, shortened with an ellipsis to fit `maxW`.
function titleLink(g, text, x, y, size, color, maxW = Infinity) {
  g.font = font(size);
  g.fillStyle = color;
  if (g.measureText(text).width > maxW) {
    while (text.length > 1 && g.measureText(`${text}…`).width > maxW) text = text.slice(0, -1);
    text = `${text.trimEnd()}…`;
  }
  g.fillText(text, x, y);
  const w = g.measureText(text).width;
  underline(g, x, y, w, color);
  return w;
}

function drawBlock(g, b, step, state) {
  const x = L.colX;
  const clicked = state.clicked === b;
  const color = clicked ? C.visited : C.link;
  const a = b.a;
  if (b.kind === 'didyoumean') {
    g.font = font(16);
    g.fillStyle = C.red;
    g.fillText('Did you mean:', x, b.y + 18);
    const w = g.measureText('Did you mean: ').width;
    g.font = font(16, 700, UI, 'italic');
    g.fillStyle = C.link;
    g.fillText(a.text, x + w, b.y + 18);
    underline(g, x + w, b.y + 18, g.measureText(a.text).width, C.link);
  } else if (b.kind === 'translate') {
    g.strokeStyle = '#E5E5E5';
    g.strokeRect(x + 0.5, b.y + 0.5, L.colW, b.h);
    g.font = font(13);
    g.fillStyle = C.gray;
    g.fillText(`Translation: ${a.fromLang ?? 'French'} » ${a.toLang ?? 'English'}`, x + 12, b.y + 22);
    g.font = font(18);
    g.fillStyle = C.text;
    g.fillText(a.from ?? '', x + 12, b.y + 56);
    g.font = font(24, 700);
    g.fillText(a.to ?? '', x + 12, b.y + 96);
  } else if (b.kind === 'flight') {
    planeIcon(g, x, b.y + 30);
    titleLink(g, `Track status of ${a.code} from ${a.from} to ${a.to}`, x + 44, b.y + 18, 16, color, L.colW - 44);
    g.font = font(13);
    g.fillStyle = C.text;
    g.fillText(`${a.date ?? ''} - ${a.status ?? 'On schedule'}`, x + 44, b.y + 40);
    g.fillText(`Departure: ${a.depart ?? ''}   Arrival: ${a.arrive ?? ''}`, x + 44, b.y + 58);
    g.fillStyle = C.url;
    g.fillText(a.url ?? 'www.flightstatus.com', x + 44, b.y + 76);
  } else if (b.kind === 'map') {
    titleLink(g, a.title ?? `Local results for ${step.query}`, x, b.y + 16, 16, color, L.colW);
    const mw = L.mobile ? L.colW : 300;
    drawMap(g, x, b.y + 28, mw, 160, hash(step.query), (a.places ?? []).slice(0, 3).map((_, i) => 'ABC'[i]));
    // Places sit beside the map on desktop and under it on a phone.
    const lx = L.mobile ? x : x + 318;
    const ly = L.mobile ? b.y + 214 : b.y + 52;
    const lh = L.mobile ? 34 : 46;
    (a.places ?? []).slice(0, 3).forEach((p, i) => {
      g.font = font(13, 700);
      g.fillStyle = '#E74C3C';
      g.fillText('ABC'[i], lx, ly + i * lh);
      titleLink(g, p, lx + 16, ly + i * lh, 13, C.link);
      g.font = font(12);
      g.fillStyle = C.gray;
      g.fillText(`${(hash(p) % 40) / 10 + 1} km · ★★★★☆`, lx + 16, ly + 15 + i * lh);
    });
  } else if (b.kind === 'card') {
    g.fillStyle = '#F7F7F7';
    g.fillRect(x, b.y, L.colW, b.h);
    g.font = font(18, 700);
    g.fillStyle = C.text;
    g.fillText(a.title ?? '', x + 12, b.y + 30);
    g.font = font(14);
    wrapWords(g, String(a.text ?? '').split(/\s+/).map((t) => ({ text: t })), L.colW - 24).slice(0, 3).forEach((line, i) => {
      g.fillText(line.map((w) => w.text).join(' '), x + 12, b.y + 56 + i * 18);
    });
  } else if (b.kind === 'site') {
    titleLink(g, a.title ?? '', x, b.y + 20, 18, color, L.colW);
    g.font = font(13);
    g.fillStyle = C.text;
    const lines = wrapWords(g, String(a.text ?? '').split(/\s+/).map((t) => ({ text: t })), L.colW).slice(0, 2);
    lines.forEach((line, i) => g.fillText(line.map((w) => w.text).join(' '), x, b.y + 42 + i * 16));
    const dy = (lines.length - 1) * 16;
    g.fillStyle = C.url;
    g.fillText(a.url ?? '', x, b.y + 60 + dy);
    (a.links ?? []).slice(0, 4).forEach((l, i) => {
      titleLink(g, l, x + 24 + (i % 2) * (L.mobile ? 150 : 260), b.y + 92 + dy + Math.floor(i / 2) * 26, 14, C.link);
    });
  } else if (b.kind === 'result') {
    const r = b.r;
    titleLink(g, r.title ?? '', x, b.y + 16, 16, color, L.colW);
    b.lines.forEach((line, i) => {
      let lx = x;
      for (const w of line) {
        g.font = w.bold ? font(13, 700) : font(13);
        g.fillStyle = C.text;
        g.fillText(w.text, lx, b.y + 36 + i * 16);
        lx += w.w;
      }
    });
    const uy = b.y + 36 + b.lines.length * 16;
    g.font = font(13);
    g.fillStyle = C.url;
    g.fillText(r.url ?? '', x, uy);
    const uw = g.measureText(`${r.url ?? ''} - `).width;
    g.fillStyle = C.gray;
    g.fillText('-', x + uw - g.measureText('- ').width, uy);
    titleLink(g, 'Cached', x + uw, uy, 13, '#7777CC');
  }
}

function drawResults(g, st, step, engine, blocks) {
  topLinks(g, engine);
  const [mx, my, ms, ma] = L.mark.res;
  wordmark(g, engine, mx, my, ms, ma);
  const end = field(g, L.res, st.text, { ...st, size: 16 });
  if (!L.mobile) button(g, (engine.buttons ?? ['Search'])[0], L.res.x + L.res.w + 8, L.res.y + 2);
  // Results bar.
  g.fillStyle = C.bar;
  g.fillRect(0, L.bar, L.pw, 24);
  g.fillStyle = C.barLine;
  g.fillRect(0, L.bar, L.pw, 1);
  g.font = font(13, 700);
  g.fillStyle = C.text;
  g.fillText('Web', 12, L.bar + 17);
  g.font = font(13);
  g.textAlign = 'right';
  const total = (step.count ?? (hash(step.query) % 9000000) + 41000).toLocaleString('en-US');
  const summary = L.mobile
    ? `About ${total} results`
    : `Results 1 - 10 of about ${total} for ${step.query}. (0.${(hash(step.query) % 40) + 11} seconds)`;
  g.fillText(summary, L.pw - 12, L.bar + 17);
  g.textAlign = 'left';
  if (st.showResults) for (const b of blocks) drawBlock(g, b, step, st);
  if (st.dropdown) dropdown(g, L.res, st.text, st.suggest);
  return end;
}

function pointer(g, x, y, pressed) {
  g.save();
  g.translate(x, y);
  const s = pressed ? 0.92 : 1;
  g.scale(s, s);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, 17);
  g.lineTo(4.5, 13);
  g.lineTo(7.5, 20);
  g.lineTo(10.5, 18.8);
  g.lineTo(7.5, 12);
  g.lineTo(13, 12);
  g.closePath();
  g.fillStyle = '#FFFFFF';
  g.fill();
  g.strokeStyle = '#000000';
  g.lineWidth = 1.1;
  g.lineJoin = 'round';
  g.stroke();
  g.restore();
}

// ---------- film ----------
async function load() {
  const brief = await (await fetch(briefUrl)).json();
  const p = plan(brief);
  const engine = { name: 'Search', ...(brief.engine ?? {}) };
  const canvas = document.getElementById('film');
  canvas.width = p.width;
  canvas.height = p.height;
  const g = canvas.getContext('2d');
  await Promise.all([font(16), font(16, 700), font(16, 700, UI, 'italic'), font(40, 700, MARK)].map((f) => document.fonts.load(f)));
  let logo = null;
  if (brief.product?.logo) {
    logo = new Image();
    logo.src = new URL(brief.product.logo, briefUrl);
    await logo.decode();
  }
  const vw = VW[p.aspect];
  L = LAYOUTS[vw.layout];
  const blocksByStep = p.steps.map((s) => layoutResults(g, s));

  // Camera: center (x, y) in page units and visible page width.
  // On the results page the camera keeps the wordmark in view.
  const typingCam = (box, caretX, drop) => {
    if (L.mobile) return { x: L.pw / 2, y: box.y + (drop ? 120 : 60), w: vw.typing };
    const w = vw.typing * (box === L.res ? 1.12 : 1);
    let cx = w >= box.w + 60 ? box.x + box.w / 2 : clamp(caretX + 60, box.x + w / 2 - 20, box.x + box.w - w / 2 + 20);
    if (box === L.res) cx = Math.min(cx, Math.max(w / 2 - 6, caretX - w / 2 + 120));
    return { x: cx, y: box.y + (drop ? 70 : 30), w };
  };
  const resultsCam = () => {
    const w = vw.results;
    const h = (w * p.height) / p.width;
    if (L.mobile) return { x: L.pw / 2, y: h / 2, w };
    return { x: Math.max(w / 2 - 10, L.colX + L.colW / 2 - (p.aspect === '16:9' ? 0 : 40)), y: Math.max(h / 2 - 4, 260), w };
  };
  const focusCam = (b) => {
    const w = vw.click;
    if (L.mobile) return { x: L.pw / 2, y: b.y + b.h / 2 + 60, w };
    return { x: w / 2 - 6, y: b.y + b.h / 2 + 20, w };
  };
  const blend = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k) });

  const stateAt = (t) => {
    if (t >= p.endCard.t) return { end: true, t: t - p.endCard.t };
    if (t >= p.blank.start) {
      const caret = Math.floor((t - p.blank.start) / 0.53) % 2 === 0;
      return { page: 'home', text: '', caret, cam: typingCam(L.home, L.home.x, false) };
    }
    const s = p.steps.find((x) => t >= x.start && t < x.start + x.d) ?? p.steps[p.steps.length - 1];
    const tl = t - s.start;
    const blocks = blocksByStep[s.index];
    const prev = p.steps[s.index - 1];
    const count = s.keys.filter((k) => k <= tl).length;
    const typing = tl < s.loaded;
    // Before typing on a results page, the old query is still in the box.
    let text = s.query.slice(0, count);
    let selected = false;
    if (!s.home && prev && tl < s.clear) {
      text = prev.query;
      selected = tl >= s.select;
    }
    const page = s.home && tl < s.loaded ? 'home' : 'results';
    const box = page === 'home' ? L.home : L.res;
    const drop = typing && count > 0 && tl < s.enter + 0.05;
    const caretBlink = Math.floor(tl / 0.53) % 2 === 0;
    const caret = typing && (tl < (s.keys[0] ?? 0) ? caretBlink : true);
    const showResults = page === 'results' && (tl >= s.loaded || !!prev);
    const shownStep = tl >= s.loaded ? s : prev ?? s;
    const shownBlocks = tl >= s.loaded ? blocks : prev ? blocksByStep[prev.index] : [];
    const target = clickTarget(s, blocks);
    // Camera keyframes: lean on the box while typing, pull back when
    // results load, then push in on what gets clicked.
    let cam;
    g.font = font(page === 'home' ? 17 : 16);
    const caretX = box.x + 7 + g.measureText(text).width;
    const tc = typingCam(box, caretX, drop);
    if (tl < s.loaded) cam = tc;
    else {
      const rc = resultsCam();
      cam = blend(tc, rc, smooth((tl - s.loaded) / 0.7));
      if (target && s.hoverAt) cam = blend(cam, focusCam(target), smooth((tl - (s.hoverAt - 0.5)) / 0.8));
      else if (s.answer && s.answer.type !== 'didyoumean') cam = blend(cam, focusCam(blocks.find((b) => b.kind === s.answer.type)), smooth((tl - s.loaded - 0.6) / 0.8));
    }
    // Pointer: rests below the box, travels to the target, clicks.
    const rest = { x: box.x + box.w - 40, y: box.y + box.h + 120 };
    let px = rest.x;
    let py = rest.y;
    let hover = null;
    let clicked = null;
    if (target && s.hoverAt && tl >= s.loaded) {
      const tx = L.colX + 40;
      const ty = target.y + 12;
      const k = smooth((tl - s.loaded - 0.25) / (s.hoverAt - s.loaded - 0.25));
      px = lerp(rest.x, tx, k);
      py = lerp(rest.y, ty, k) - Math.sin(k * Math.PI) * 40;
      if (tl >= s.hoverAt - 0.05) hover = target;
      if (tl >= s.clickAt) clicked = target;
    }
    return {
      page, step: shownStep, blocks: shownBlocks, text, selected, caret, dropdown: drop,
      suggest: s.suggest ?? autoSuggest(s.query), showResults, cam, px, py, hover, clicked,
      pressed: s.clickAt && tl >= s.clickAt && tl < s.clickAt + 0.12,
    };
  };

  const render = (t) => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, p.width, p.height);
    const st = stateAt(t);
    if (st.end) {
      drawEndCard(g, p, brief, logo, st.t);
      return;
    }
    const scale = p.width / st.cam.w;
    // Never show space above the top of the page.
    st.cam.y = Math.max(st.cam.y, p.height / scale / 2 - 6);
    g.setTransform(scale, 0, 0, scale, p.width / 2 - st.cam.x * scale, p.height / 2 - st.cam.y * scale);
    g.textBaseline = 'alphabetic';
    if (st.page === 'home') drawHome(g, st, engine);
    else drawResults(g, st, st.step, engine, st.blocks);
    pointer(g, st.px, st.py, st.pressed);
    g.setTransform(1, 0, 0, 1, 0, 0);
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

// End card: the tagline alone, then the product's name or logo.
function drawEndCard(g, p, brief, logo, t) {
  const W = p.width;
  const H = p.height;
  const unit = Math.min(W, H) / 1080;
  const fade = (start) => smooth((t - start) / 0.5);
  g.textAlign = 'center';
  g.globalAlpha = fade(0.15);
  g.fillStyle = '#333333';
  g.font = font(64 * unit, 400);
  g.fillText(brief.end?.tagline ?? '', W / 2, H / 2 - 10 * unit);
  g.globalAlpha = fade(1.0);
  if (logo) {
    const h = 90 * unit;
    const w = (h * logo.naturalWidth) / logo.naturalHeight;
    g.drawImage(logo, W / 2 - w / 2, H / 2 + 50 * unit, w, h);
  } else {
    g.font = font(52 * unit, 700);
    g.fillStyle = '#111111';
    g.fillText(brief.product?.name ?? '', W / 2, H / 2 + 110 * unit);
  }
  g.globalAlpha = 1;
  g.textAlign = 'left';
}

window.film = { ready: load() };
