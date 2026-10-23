// Demo film for the silhouette-dancers style: a 15-second spot for
// fictional earbuds, "adopus". Cuts land on the downbeat of a 120 BPM track;
// every cut changes the dancer, the move and the color.
import { Dancer, Motion, SilhouetteLayer, fitCamera } from './silhouette.js';

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;

// Sampled from the original campaign's backgrounds.
const COLORS = {
  lime: '#8DBF1F',
  pink: '#E0609A',
  orange: '#F7941D',
  cyan: '#03B5F0',
  yellow: '#F4C832',
  violet: '#9468B0',
};
const FIGURE = '#050505';
const PRODUCT = '#FFFFFF';

// t: start (s), d: duration (s), seg: motion segment, at: offset into the
// segment (s), yaw: camera angle (rad), char: dancer, hand: hand with the
// device, framing: 'full' | 'knee' | 'mid', x: horizontal placement,
// followY: share of vertical motion the camera follows, hold: arm IK weight.
const SHOTS = [
  { t: 0, d: 2, seg: 'groove', at: 0, yaw: -0.8, char: 'afro', hand: 'r', color: 'lime', framing: 'knee', x: 0.45 },
  { t: 2, d: 2, seg: 'jumps', at: 0, yaw: -2.4, char: 'bob', hand: 'l', color: 'pink', framing: 'knee', fill: 1.05, x: 0.55, followY: 0.7 },
  { t: 4, d: 2, seg: 'pump', at: 0, yaw: 0, char: 'cap', hand: 'r', color: 'cyan', framing: 'knee', x: 0.55 },
  { t: 6, d: 2, seg: 'spin', at: 0, yaw: -1.6, char: 'pony', hand: 'r', color: 'yellow', framing: 'knee', x: 0.5 },
  { t: 8, d: 1, seg: 'freeze', at: 0, yaw: 0.6, char: 'spike', hand: 'r', color: 'orange', fill: 0.95, hold: 0 },
  { t: 9, d: 1, seg: 'sway', at: 0, yaw: 0.3, char: 'bob', hand: 'r', color: 'pink', framing: 'mid', fill: 0.9, x: 0.45 },
  { t: 10, d: 2, seg: 'leap', at: 0, yaw: 1.6, char: 'pony', hand: 'r', color: 'violet', fill: 0.95 },
];
const END_CARD = { t: 12, d: 3, color: 'violet' };
const DURATION = 15;

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('film');
canvas.width = WIDTH;
canvas.height = HEIGHT;
const g = canvas.getContext('2d');
const layer = new SilhouetteLayer(WIDTH, HEIGHT);

async function load() {
  const motionUrl = params.get('motion') ?? './motion.json';
  const motion = new Motion(await (await fetch(motionUrl)).json());
  let shots = SHOTS;
  let duration = DURATION;
  let endCard = END_CARD;
  if (params.has('preview')) {
    const seg = params.get('preview');
    const d = motion.span(seg).length;
    shots = [{
      t: 0, d, seg, at: 0,
      yaw: Number(params.get('yaw') ?? 0),
      mirror: params.get('mirror') === '1',
      char: params.get('char') ?? 'pony',
      hand: params.get('hand') ?? 'r',
      color: params.get('color') ?? 'lime',
      framing: params.get('framing') ?? 'full',
      x: Number(params.get('x') ?? 0.5),
    }];
    duration = d;
    endCard = null;
  }
  for (const s of shots) {
    s.dancer = new Dancer(motion, s.seg, s.char, s.hand, s.hold ?? 0.75);
    s.camera = fitCamera(motion, s.seg, s.at, s.at + s.d, {
      yaw: s.yaw, mirror: s.mirror, width: WIDTH, height: HEIGHT,
      fill: s.fill ?? (s.framing === 'full' || !s.framing ? 0.9 : 1.12), framing: s.framing, x: s.x, followY: s.followY ?? 0,
      top: s.char === 'afro' ? 0.3 : 0.16,
    });
  }
  await document.fonts.load('600 64px Inter');
  await document.fonts.load('400 64px Inter');
  return { shots, duration, endCard };
}

// End card: the product (earbuds wired to the player) above the name.
function drawEndCard(card, t) {
  g.fillStyle = COLORS[card.color];
  g.fillRect(0, 0, WIDTH, HEIGHT);
  const fade = (delay) => {
    const k = Math.min(1, Math.max(0, (t - card.t - delay) / 0.4));
    return 1 - (1 - k) ** 3;
  };
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2 - 110 + (1 - fade(0)) * 24;
  g.globalAlpha = fade(0);
  g.strokeStyle = PRODUCT;
  g.fillStyle = PRODUCT;
  g.lineCap = 'round';
  g.lineWidth = 5;
  const split = [cx, cy - 20];
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + side * 72, cy - 150);
    g.bezierCurveTo(cx + side * 80, cy - 90, cx + side * 10, cy - 70, split[0], split[1]);
    g.stroke();
    g.beginPath();
    g.arc(cx + side * 72, cy - 158, 15, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath();
  g.moveTo(split[0], split[1]);
  g.bezierCurveTo(cx - 6, cy + 10, cx + 6, cy + 10, cx, cy + 30);
  g.stroke();
  g.beginPath();
  g.roundRect(cx - 48, cy + 30, 96, 150, 32);
  g.fill();
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = '600 120px Inter';
  g.fillText('adopus', cx, cy + 330);
  g.globalAlpha = fade(0.5);
  g.font = '400 44px Inter';
  g.fillText('Move like nobody’s listening.', cx, cy + 400);
  g.globalAlpha = 1;
}

const ready = load().then((state) => {
  window.film.duration = state.duration;
  window.film.render = (t) => {
    if (state.endCard && t >= state.endCard.t) {
      drawEndCard(state.endCard, t);
      return;
    }
    const shot = state.shots.find((s) => t >= s.t && t < s.t + s.d) ?? state.shots[state.shots.length - 1];
    g.fillStyle = COLORS[shot.color] ?? shot.color;
    g.fillRect(0, 0, WIDTH, HEIGHT);
    shot.dancer.draw(g, shot.camera, shot.at + (t - shot.t), { figure: FIGURE, product: PRODUCT }, layer);
  };
});

window.film = {
  width: WIDTH,
  height: HEIGHT,
  fps: FPS,
  duration: DURATION,
  canvas,
  ready,
  render: () => {},
};

