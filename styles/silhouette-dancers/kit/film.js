// The silhouette-dancers film, driven by a brief: dancers cut on the
// downbeat, each cut changes the dancer, the move and the color, and an end
// card shows the product and its name.
//
// URL parameters: brief=<url of brief.json>. Files named in the brief are
// resolved relative to the brief.
import { plan } from './plan.mjs';
import { Dancer, Motion, SilhouetteLayer, fitCamera } from './silhouette.js';

const FIGURE = '#050505';
const WHITE = '#FFFFFF';

const params = new URLSearchParams(location.search);
if (!params.has('brief')) throw new Error('Open this page with ?brief=<url of brief.json>');
const briefUrl = new URL(params.get('brief'), location.href);

// The product image as a pure white silhouette, so any PNG or SVG with a
// transparent background works.
async function whiteImage(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const h = 720;
  const w = Math.round((h * img.naturalWidth) / img.naturalHeight);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0, w, h);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = WHITE;
  x.fillRect(0, 0, w, h);
  return c;
}

async function load() {
  const brief = await (await fetch(briefUrl)).json();
  const p = plan(brief);
  const canvas = document.getElementById('film');
  canvas.width = p.width;
  canvas.height = p.height;
  const g = canvas.getContext('2d');
  const layer = new SilhouetteLayer(p.width, p.height);
  const motion = new Motion(await (await fetch(new URL('./motion.json', import.meta.url))).json());
  const product = brief.product ?? {};
  const device = product.image ? await whiteImage(new URL(product.image, briefUrl)) : null;
  const look = {
    figure: FIGURE,
    product: WHITE,
    line: product.line ?? 'earbuds',
    device,
    deviceSize: product.size ?? 0.092,
    deviceTilt: product.tilt ?? (product.image ? 0.35 : 1),
  };
  for (const s of p.shots) {
    s.dancer = new Dancer(motion, s.seg, s.char, s.hand, s.hold ?? 0.75);
    s.camera = fitCamera(motion, s.seg, s.at, s.at + s.d, {
      yaw: s.yaw,
      mirror: s.mirror,
      width: p.width,
      height: p.height,
      fill: s.fill ?? (s.framing === 'full' || !s.framing ? 0.9 : 1.12),
      framing: s.framing,
      x: s.x,
      followY: s.followY ?? 0,
      top: s.char === 'afro' ? 0.3 : 0.16,
    });
  }
  await document.fonts.load('600 64px Inter');
  await document.fonts.load('400 64px Inter');

  const render = (t) => {
    if (t >= p.endCard.t) {
      drawEndCard(g, p, product, look, t);
      return;
    }
    const shot = p.shots.find((s) => t >= s.t && t < s.t + s.d) ?? p.shots[p.shots.length - 1];
    g.fillStyle = shot.color;
    g.fillRect(0, 0, p.width, p.height);
    shot.dancer.draw(g, shot.camera, shot.at + (t - shot.t), look, layer);
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

// Largest font size, up to `max`, that fits `text` in `width`.
function fit(g, text, weight, max, width) {
  g.font = `${weight} ${max}px Inter`;
  const size = Math.min(max, (max * width) / g.measureText(text).width);
  g.font = `${weight} ${Math.floor(size)}px Inter`;
  return size;
}

// End card: the product in white above the name and tagline.
function drawEndCard(g, p, product, look, t) {
  const { width: W, height: H } = p;
  const card = p.endCard;
  g.fillStyle = card.color;
  g.fillRect(0, 0, W, H);
  const fade = (delay) => {
    const k = Math.min(1, Math.max(0, (t - card.t - delay) / 0.4));
    return 1 - (1 - k) ** 3;
  };
  const unit = Math.min(W, H) / 1080;
  const cx = W / 2;
  const cy = H / 2 - 110 * unit + (1 - fade(0)) * 24 * unit;
  g.globalAlpha = fade(0);
  g.strokeStyle = WHITE;
  g.fillStyle = WHITE;
  g.lineCap = 'round';
  if (look.device) {
    const h = 300 * unit;
    const w = (h * look.device.width) / look.device.height;
    g.drawImage(look.device, cx - w / 2, cy + 180 * unit - h, w, h);
  } else {
    const u = unit;
    if (look.line !== 'none') {
      g.lineWidth = 5 * u;
      for (const side of [-1, 1]) {
        g.beginPath();
        g.moveTo(cx + side * 72 * u, cy - 150 * u);
        g.bezierCurveTo(cx + side * 80 * u, cy - 90 * u, cx + side * 10 * u, cy - 70 * u, cx, cy - 20 * u);
        g.stroke();
        g.beginPath();
        g.arc(cx + side * 72 * u, cy - 158 * u, 15 * u, 0, Math.PI * 2);
        g.fill();
      }
      g.beginPath();
      g.moveTo(cx, cy - 20 * u);
      g.bezierCurveTo(cx - 6 * u, cy + 10 * u, cx + 6 * u, cy + 10 * u, cx, cy + 30 * u);
      g.stroke();
    }
    g.beginPath();
    g.roundRect(cx - 48 * u, cy + 30 * u, 96 * u, 150 * u, 32 * u);
    g.fill();
  }
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  fit(g, product.name ?? '', 600, 120 * unit, W * 0.82);
  g.fillText(product.name ?? '', cx, cy + 330 * unit);
  g.globalAlpha = fade(0.5);
  fit(g, product.tagline ?? '', 400, 44 * unit, W * 0.86);
  g.fillText(product.tagline ?? '', cx, cy + 400 * unit);
  g.globalAlpha = 1;
}

window.film = { ready: load() };
