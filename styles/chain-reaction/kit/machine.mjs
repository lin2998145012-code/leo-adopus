// Builds the whole chain reaction from a brief: where every part stands,
// how it moves at every moment, every collision and roll for the sound, and
// where the camera looks. Shared by the film (browser) and the score (Node),
// so a clack in the audio lands on the frame where two parts touch.
//
// Units are meters and seconds. x runs along the machine (left to right),
// y is up, z points at the camera. Rolling parts have their axle along z.
//
// A link is one contraption. Each link receives the part that is rolling in
// from the left, continues it until it hits the link's first piece, runs its
// mechanism, and sends a new part rolling out to the right.

export const G = 9.81;

export const ASPECTS = {
  '16:9': [1920, 1080],
  '1:1': [1080, 1080],
  '4:5': [1080, 1350],
  '9:16': [1080, 1920],
};

const RATE = 240; // pose samples per second
const STEP = 1 / 960; // physics step

// ---------- tracks ----------

// A part's pose over time, sampled while it moves; before its first sample
// and after its last it holds still.
export class Track {
  constructor(pose) {
    this.ts = [];
    this.ps = [];
    this.rest = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, ...pose };
  }

  push(t, pose) {
    const p = { ...this.last(), ...pose };
    const n = this.ts.length;
    if (n && t <= this.ts[n - 1]) {
      this.ps[n - 1] = p;
      return;
    }
    this.ts.push(t);
    this.ps.push(p);
  }

  last() {
    return this.ps.length ? this.ps[this.ps.length - 1] : this.rest;
  }

  at(t) {
    const { ts, ps } = this;
    if (!ts.length || t <= ts[0]) return ps[0] ?? this.rest;
    if (t >= ts[ts.length - 1]) return ps[ps.length - 1];
    let lo = 0;
    let hi = ts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (ts[mid] <= t) lo = mid;
      else hi = mid;
    }
    const k = (t - ts[lo]) / (ts[hi] - ts[lo]);
    const a = ps[lo];
    const b = ps[hi];
    const out = {};
    for (const key in a) out[key] = typeof a[key] === 'number' ? a[key] + (b[key] - a[key]) * k : a[key];
    return out;
  }
}

// ---------- the machine being built ----------

class Machine {
  constructor() {
    this.parts = [];
    this.byId = new Map();
    this.surfaces = [[-1e4, 0, 1e4, 0]]; // the floor
    this.events = [];
    this.rolls = [];
    this.focusKeys = [];
  }

  // Adds a part. `kind` and `opts` say what to build; `pose` where it rests.
  part(id, kind, opts, pose) {
    const track = new Track(pose);
    const part = { id, kind, opts, track };
    this.parts.push(part);
    this.byId.set(id, part);
    return track;
  }

  surface(...segs) {
    for (const s of segs) this.surfaces.push(s);
  }

  // A polyline as surfaces: [[x, y], [x, y], ...].
  polyline(pts) {
    for (let i = 0; i + 1 < pts.length; i++) this.surfaces.push([...pts[i], ...pts[i + 1]]);
  }

  hit(t, x, strength, a, b = 'wood') {
    if (strength > 0.02) this.events.push({ t, x, type: 'hit', a, b, strength });
  }

  sound(t, x, type, extra = {}) {
    this.events.push({ t, x, type, ...extra });
  }

  focus(t, x, y, w) {
    this.focusKeys.push({ t, x, y, w });
  }
}

// ---------- a rolling disc on fixed surfaces ----------

function closest(px, py, [x1, y1, x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const k = len2 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2)) : 0;
  return [x1 + dx * k, y1 + dy * k];
}

// Simulates a disc of radius r (inertia factor k: 0.5 solid, 0.4 ball,
// ~0.8 ring) rolling, falling and bouncing on the machine's surfaces until
// `until(state)` is true or it stops. Records poses into `track`, rolling
// noise and impacts into the machine, and returns the final state.
function roll(m, track, s, o) {
  const { r, k = 0.5, e = 0.3, mu = 0.012, mat = 'steel', until, maxT = 12, motor, focusW } = o;
  const near = m.surfaces.filter((q) => Math.max(q[0], q[2]) > s.x - 4 && Math.min(q[0], q[2]) < s.x + 8);
  let { t, x, y, vx = 0, vy = 0, rz = 0 } = s;
  let w = 0;
  let still = 0;
  let rolling = null;
  const t0 = t;
  let n = 0;
  const z = s.z ?? track.last().z;
  for (;;) {
    let contact = false;
    let nx = 0;
    let ny = 1;
    for (const q of near) {
      const [cx, cy] = closest(x, y, q);
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (d >= r + 1e-5 || d === 0) continue;
      const ux = dx / d;
      const uy = dy / d;
      x += ux * (r - d);
      y += uy * (r - d);
      const vn = vx * ux + vy * uy;
      if (vn < -0.14) {
        m.hit(t, x, -vn * 0.7, mat, q.mat ?? (q[1] === 0 && q[3] === 0 ? 'floor' : 'wood'));
        vx -= (1 + e) * vn * ux;
        vy -= (1 + e) * vn * uy;
      } else if (vn < 0) {
        vx -= vn * ux;
        vy -= vn * uy;
      }
      contact = true;
      nx = ux;
      ny = uy;
    }
    if (contact) {
      const tx = ny;
      const ty = -nx;
      let vt = vx * tx + vy * ty;
      let at = (-G * ty) / (1 + k) - Math.sign(vt) * mu * G * ny;
      if (motor && x < motor.until) at = (motor.v * (1 + 0.18 * Math.sin((x - s.x) / r)) - vt) * 4;
      vt += at * STEP;
      const vn = vx * nx + vy * ny;
      vx = tx * vt + nx * Math.max(0, vn);
      vy = ty * vt + ny * Math.max(0, vn);
      w = (nx * vy - ny * vx) / r;
      still = Math.abs(vt) < 0.004 && Math.abs(ty) < 0.02 ? still + 1 : 0;
      if (!rolling) rolling = { mat, t0: t, x, v: [] };
    } else {
      vy -= G * STEP;
      if (rolling) {
        m.rolls.push(rolling);
        rolling = null;
      }
    }
    x += vx * STEP;
    y += vy * STEP;
    rz += w * STEP;
    t += STEP;
    if (n++ % 4 === 0) {
      track.push(t, { x, y, z, rz });
      if (rolling) rolling.v.push(Math.hypot(vx, vy));
      if (focusW && n % 32 === 1) m.focus(t, x, y, focusW);
    }
    const state = { t, x, y, z, vx, vy, rz, r };
    if ((until && until(state)) || still > 40 || t - t0 > maxT) {
      if (rolling) m.rolls.push(rolling);
      track.push(t, { x, y, z, rz });
      return state;
    }
  }
}

// Rolls the incoming part along the floor until it touches a vertical face
// at x = face of height h. Returns its final state; the part stops there.
function rollInto(m, inc, face, h, focusW) {
  const r = inc.r;
  const stopX = h >= r ? face - r : face - Math.sqrt(Math.max(0, r * r - (r - h) ** 2));
  const track = m.byId.get(inc.id).track;
  const s = roll(m, track, inc.state, { ...inc.phys, until: (q) => q.x >= stopX, focusW });
  const v = Math.max(Math.hypot(s.vx, s.vy), 0.15);
  m.hit(s.t, face, v, inc.phys.mat, 'steel');
  // A small recoil, then rest.
  track.push(s.t + 0.08, { x: s.x - Math.min(0.006, v * 0.01), rz: s.rz + 0.004 / r });
  return { ...s, v };
}

// ---------- small helpers ----------

const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function wedgePts(x, len, h, dir) {
  // dir 1 rises to the right, -1 falls to the right.
  return dir > 0 ? [[x, 0], [x + len, h], [x + len, 0]] : [[x, 0], [x, h], [x + len, 0]];
}

// A wedge ramp as a part and as surfaces.
function addWedge(m, id, x, len, h, dir, opts = {}) {
  m.part(id, 'wedge', { len, h, dir, depth: opts.depth ?? 0.14, mat: opts.mat ?? 'wood' }, { x, y: 0, z: opts.z ?? 0 });
  if (dir > 0) m.polyline([[x - 0.001, 0], [x + len, h], [x + len, 0]]);
  else m.polyline([[x, 0], [x, h], [x + len, 0.0005]]);
}

// A box as a part and as surfaces (left side, top, right side).
function addBlock(m, id, x, w, h, opts = {}) {
  m.part(id, 'block', { w, h, depth: opts.depth ?? 0.12, mat: opts.mat ?? 'wood' }, { x, y: 0, z: opts.z ?? 0 });
  if (opts.solid !== false) m.polyline([[x - w / 2, 0], [x - w / 2, h], [x + w / 2, h], [x + w / 2, 0]]);
}

// ---------- links ----------

const PHYS = {
  bearing: { r: 0.034, k: 0.75, e: 0.25, mat: 'steel' },
  hub: { r: 0.046, k: 0.55, e: 0.25, mat: 'steel' },
  gear: { r: 0.066, k: 0.55, e: 0.25, mat: 'steel' },
  ball: { r: 0.022, k: 0.4, e: 0.35, mat: 'steel' },
  wheel: { r: 0.3, k: 0.65, e: 0.15, mu: 0.02, mat: 'rubber' },
  muffler: { r: 0.075, k: 0.7, e: 0.2, mu: 0.016, mat: 'steel' },
};

function sendOut(m, id, kind, opts, state, phys, exitX, focusW) {
  const track = m.byId.get(id).track;
  const s = roll(m, track, state, { ...phys, until: (q) => q.x >= exitX, focusW });
  return { id, kind, r: phys.r, phys, state: s };
}

// 1. Opener: a bearing rolls along a shelf into a hub, the hub into a gear,
// and the gear drops off the end onto a ramp.
function opener(m, x0, t0) {
  const shelfY = 0.1;
  const len = 1.15;
  const slope = rad(1.4);
  const yAt = (x) => shelfY - (x - x0) * Math.tan(slope);
  m.part('o-shelf', 'board', { len: len / Math.cos(slope), thick: 0.018, depth: 0.12 }, { x: x0 + len / 2, y: yAt(x0 + len / 2), rz: -slope });
  m.surface([x0, yAt(x0), x0 + len, yAt(x0 + len)]);
  addBlock(m, 'o-leg1', x0 + 0.12, 0.08, yAt(x0 + 0.12) - 0.018, { solid: false, depth: 0.1 });
  addBlock(m, 'o-leg2', x0 + len - 0.16, 0.08, yAt(x0 + len - 0.16) - 0.018, { solid: false, depth: 0.1 });
  m.surface([x0 + len, yAt(x0 + len), x0 + len, 0]);

  const B = PHYS.bearing;
  const H = PHYS.hub;
  const Gr = PHYS.gear;
  const bx = x0 + 0.06;
  const hx = x0 + 0.55;
  const gx = x0 + 0.84;
  const tb = m.part('o-bearing', 'bearing', { r: B.r }, { x: bx, y: yAt(bx) + B.r, z: 0 });
  const th = m.part('o-hub', 'gear', { r: H.r, teeth: 30, thick: 0.02, hole: 0.55, mat: 'bright' }, { x: hx, y: yAt(hx) + H.r, z: 0 });
  const tg = m.part('o-gear', 'gear', { r: Gr.r, teeth: 34, thick: 0.02, hole: 0.4, spokes: 5 }, { x: gx, y: yAt(gx) + Gr.r, z: 0 });
  m.focus(t0, bx + 0.06, shelfY, 0.5);
  m.focus(t0 + 1.4, bx + 0.1, shelfY, 0.5);
  // The bearing sets off by itself.
  let s = roll(m, tb, { t: t0 + 0.9, x: bx, y: yAt(bx) + B.r, vx: 0.07 }, { ...B, mu: 0.003, until: (q) => q.x + B.r >= hx - H.r, focusW: 0.5 });
  m.hit(s.t, s.x + B.r, Math.hypot(s.vx, s.vy) * 1.4, 'steel', 'steel');
  s = roll(m, th, { t: s.t, x: hx, y: yAt(hx) + H.r, vx: Math.hypot(s.vx, s.vy) * 0.9 }, { ...H, mu: 0.003, until: (q) => q.x + H.r >= gx - Gr.r, focusW: 0.55 });
  m.hit(s.t, s.x + H.r, Math.hypot(s.vx, s.vy) * 1.4, 'steel', 'steel');
  // Off the end of the shelf onto a ramp.
  addWedge(m, 'o-ramp', x0 + len + 0.04, 0.55, 0.06, -1);
  return sendOut(m, 'o-gear', 'gear', {}, { t: s.t, x: gx, y: yAt(gx) + Gr.r, vx: Math.hypot(s.vx, s.vy) * 0.9 }, { ...Gr, mu: 0.02 }, x0 + len + 0.75, 1.1);
}

// 2. Dominoes: a row of steel plates falls in a wave and the last one
// knocks a ball off a post.
function dominoes(m, x0, inc) {
  const n = 11;
  const h = 0.16;
  const d = 0.088;
  const th = 0.006;
  const first = x0 + 0.15;
  const xs = Array.from({ length: n }, (_, i) => first + i * d);
  const tracks = xs.map((x, i) => m.part(`d-plate${i}`, 'plate', { w: 0.075, h, thick: th }, { x, y: 0, z: 0, rz: 0 }));
  const hitState = rollInto(m, inc, first - th / 2, h, 1.35);
  // The ball on a post, placed where the last plate's top passes at 58°.
  const B = PHYS.ball;
  const hitAngle = rad(66);
  const last = xs[n - 1];
  const ballX = last + h * Math.sin(hitAngle) + B.r * 1.05;
  const ballY = h * Math.cos(hitAngle);
  const postW = 0.026;
  addBlock(m, 'd-post', ballX + 0.004, postW, ballY - B.r, { depth: 0.04, mat: 'woodDark' });
  const tb = m.part('d-ball', 'ball', { r: B.r }, { x: ballX, y: ballY, z: 0 });
  const restAngle = Math.atan2(ballX - postW / 2 + 0.004 - last, ballY - B.r);

  // Each plate is an inverted pendulum about its right foot until it meets
  // the next; then it leans on it.
  const theta = new Array(n).fill(0);
  const omega = new Array(n).fill(0);
  const leaning = new Array(n).fill(false);
  omega[0] = clamp((1.6 * hitState.v) / h, 2.5, 7);
  let t = hitState.t;
  let ballHit = null;
  const contact = Math.asin(d / h);
  for (let step = 0; step < 4000 && !ballHit; step++) {
    for (let i = n - 1; i >= 0; i--) {
      if (leaning[i]) {
        theta[i] = theta[i + 1] + Math.asin(clamp((d * Math.cos(theta[i + 1])) / h, -1, 1));
        continue;
      }
      if (theta[i] === 0 && omega[i] === 0) continue;
      omega[i] += ((3 * G) / (2 * h)) * Math.sin(theta[i]) * STEP;
      theta[i] += omega[i] * STEP;
      if (i < n - 1 && theta[i] >= contact) {
        leaning[i] = true;
        omega[i + 1] = Math.max(omega[i + 1], omega[i] * 0.72);
        theta[i + 1] = Math.max(theta[i + 1], 0.001);
        m.hit(t, xs[i + 1], omega[i] * h * 0.6, 'steel', 'steel');
      }
      if (i === n - 1 && theta[i] >= hitAngle) {
        ballHit = { t, v: omega[i] * h };
        m.hit(t, ballX, omega[i] * h * 0.8, 'steel', 'steel');
      }
    }
    t += STEP;
    if (step % 4 === 0) {
      xs.forEach((x, i) => tracks[i].push(t, { x: x + th / 2 - (th / 2) * Math.cos(theta[i]), y: (th / 2) * Math.sin(theta[i]), rz: -theta[i] }));
      const lead = theta.findLastIndex((v) => v > 0);
      if (step % 32 === 0) m.focus(t, xs[Math.max(0, lead)], 0.1, 1.35);
    }
  }
  // The last plate settles on the post; the row settles behind it.
  const settle = 0.18;
  for (let j = 1; j <= 6; j++) {
    const k = j / 6;
    const lastA = hitAngle + (restAngle - hitAngle) * (1 - (1 - k) ** 2);
    const angles = new Array(n);
    angles[n - 1] = lastA;
    for (let i = n - 2; i >= 0; i--) angles[i] = angles[i + 1] + Math.asin(clamp((d * Math.cos(angles[i + 1])) / h, -1, 1));
    xs.forEach((x, i) => {
      const a = leaning[i] || i === n - 1 ? angles[i] : theta[i];
      tracks[i].push(ballHit.t + settle * k, { x: x + th / 2 - (th / 2) * Math.cos(a), y: (th / 2) * Math.sin(a), rz: -a });
    });
  }
  m.hit(ballHit.t + settle, last + 0.05, 0.25, 'steel', 'wood');
  addWedge(m, 'd-ramp', ballX + 0.1, 0.45, 0.035, -1);
  return sendOut(m, 'd-ball', 'ball', {}, { t: ballHit.t, x: ballX, y: ballY, vx: ballHit.v * 0.9, vy: ballHit.v * 0.1 }, { ...B, mu: 0.025 }, ballX + 0.75, 1.35);
}

// 3. Seesaw: the part rolls up a plank to the pivot, the plank tips, and
// the part rolls down the other side.
function seesaw(m, x0, inc) {
  const half = 0.34;
  const thick = 0.018;
  const P = inc.phys;
  const v0 = Math.max(0.25, Math.hypot(inc.state.vx, inc.state.vy));
  const vf = 0.07;
  // Tilt the plank so the part only just reaches the pivot.
  const sin = clamp((((v0 * v0 - vf * vf) / (2 * half)) - (P.mu ?? 0.012) * G) * ((1 + P.k) / G), Math.sin(rad(2.5)), Math.sin(rad(13)));
  const beta = Math.asin(sin);
  const left = x0 + 0.1;
  const ax = left + half * Math.cos(beta);
  const ay = half * Math.sin(beta);
  const plankPose = (b) => ({ x: ax, y: ay, rz: b });
  const tp = m.part('s-plank', 'board', { len: half * 2, thick, depth: 0.12 }, { ...plankPose(beta), z: 0 });
  m.part('s-pivot', 'pivot', { h: ay - thick, w: 0.09, depth: 0.1, mat: 'dark' }, { x: ax, y: 0, z: 0 });
  // Up the plank (top face as a surface), to the pivot.
  const up = [left - 0.02, 0, ax, ay];
  m.surface(up);
  const track = m.byId.get(inc.id).track;
  let s = roll(m, track, inc.state, { ...P, until: (q) => q.x >= ax - 0.004, focusW: 1.25 });
  m.surfaces.splice(m.surfaces.indexOf(up), 1);
  // Balance: the plank hesitates, then tips from +beta to -beta while the
  // part creeps over the pivot.
  const wait = 0.45;
  const tipT = 0.85;
  // The part creeps a few centimeters over the pivot, however fast it came.
  const creep = Math.min(0.05, 0.02 + Math.hypot(s.vx, s.vy) * 0.03);
  let along = 0;
  for (let j = 0; j <= 90; j++) {
    const k = j / 90;
    const kt = Math.max(0, (k * (wait + tipT) - wait) / tipT);
    const b = beta * Math.cos(Math.PI * kt * kt) + (kt === 0 ? -Math.sin(k * 24) * 0.002 * k : 0);
    along = creep * k * k;
    const ca = Math.cos(b);
    const sa = Math.sin(b);
    tp.push(s.t + (wait + tipT) * k, plankPose(b));
    track.push(s.t + (wait + tipT) * k, { x: ax + along * ca - P.r * sa, y: ay + along * sa + P.r * ca, rz: s.rz - along / P.r });
  }
  m.hit(s.t + wait + tipT, ax + half, 0.7, 'wood', 'floor');
  m.focus(s.t + wait + tipT, ax + 0.1, 0.1, 1.25);
  const right = ax + half * Math.cos(beta);
  m.surface([ax - 0.05, ay + 0.05 * Math.sin(beta), right, 0.0005]);
  const ca = Math.cos(-beta);
  const sa = Math.sin(-beta);
  const start = { t: s.t + wait + tipT, x: ax + along * ca - P.r * sa, y: ay + along * sa + P.r * ca, vx: 0.08 * ca, vy: 0.08 * sa, rz: s.rz - along / P.r };
  return sendOut(m, inc.id, inc.kind, {}, start, { ...P, mu: 0.025 }, right + 0.45, 1.2);
}

// 4. Gear train: the part strikes a lever on the first gear, three meshed
// gears turn on a wooden board, and an arm on the last knocks a ball off a
// shelf.
function gearbox(m, x0, inc) {
  const mod = 0.004;
  const N = [30, 18, 40];
  const rp = N.map((n) => (mod * n) / 2);
  const c1 = [x0 + 0.22, 0.19];
  const a12 = rad(28);
  const a23 = rad(-18);
  const c2 = [c1[0] + (rp[0] + rp[1]) * Math.cos(a12), c1[1] + (rp[0] + rp[1]) * Math.sin(a12)];
  const c3 = [c2[0] + (rp[1] + rp[2]) * Math.cos(a23), c2[1] + (rp[1] + rp[2]) * Math.sin(a23)];
  const gz = -0.04;
  // Tooth phases so the teeth mesh (see gear(): tooth centers at 0.47 of a
  // pitch, gaps at ~0).
  const pitch = N.map((n) => (Math.PI * 2) / n);
  const ph1 = a12 - 0.47 * pitch[0];
  // Meshing gears' phase fractions at the contact point add up to 1.44.
  const frac = (v) => v - Math.floor(v);
  const ph2 = a12 + Math.PI - 0.97 * pitch[1];
  const ph3 = a23 + Math.PI - (1.44 - frac((a23 - ph2) / pitch[1])) * pitch[2];
  const boardW = c3[0] - c1[0] + rp[2] + rp[0] + 0.16;
  m.part('g-board', 'panel', { w: boardW, h: 0.46, thick: 0.018 }, { x: c1[0] - rp[0] - 0.08 + boardW / 2, y: 0, z: gz - 0.03 });
  m.part('g-foot', 'block', { w: boardW, h: 0.03, depth: 0.1, mat: 'woodDark' }, { x: c1[0] - rp[0] - 0.08 + boardW / 2, y: 0, z: gz - 0.05 });
  const t1 = m.part('g-gear1', 'gear', { module: mod, teeth: N[0], thick: 0.016, hole: 0.3, spokes: 6 }, { x: c1[0], y: c1[1], z: gz, rz: ph1 });
  const t2 = m.part('g-gear2', 'gear', { module: mod, teeth: N[1], thick: 0.016, hole: 0.4, mat: 'bright' }, { x: c2[0], y: c2[1], z: gz, rz: ph2 });
  const t3 = m.part('g-gear3', 'gear', { module: mod, teeth: N[2], thick: 0.016, hole: 0.25, spokes: 4 }, { x: c3[0], y: c3[1], z: gz, rz: ph3 });
  const leverLen = c1[1] - 0.03;
  const tl = m.part('g-lever', 'lever', { len: leverLen, z0: gz, z1: 0.012 }, { x: c1[0], y: c1[1], z: gz, rz: 0 });
  // The arm on gear 3 and the ball it knocks off the shelf.
  const B = PHYS.ball;
  const armLen = rp[2] + 0.05;
  const hitA = rad(-62);
  const arm0 = hitA - rad(70);
  const ta = m.part('g-arm', 'arm', { len: armLen, z0: gz, z1: 0.012 }, { x: c3[0], y: c3[1], z: gz, rz: arm0 });
  const tip = [c3[0] + armLen * Math.cos(hitA), c3[1] + armLen * Math.sin(hitA)];
  const dir = [-Math.sin(hitA), Math.cos(hitA)];
  const ball = [tip[0] + dir[0] * (B.r + 0.007), tip[1] + dir[1] * (B.r + 0.007)];
  const shelfTop = ball[1] - B.r;
  addBlock(m, 'g-shelf', ball[0] - 0.01, 0.05, shelfTop, { depth: 0.05, mat: 'woodDark' });
  const tb = m.part('g-ball', 'ball', { r: B.r }, { x: ball[0], y: ball[1], z: 0 });

  const hit = rollInto(m, inc, c1[0] - 0.008, 0.06, 1.1);
  // The gears turn quickly at first, then slow to a stop; the arm meets
  // the ball on the way.
  const turn = rad(100) * (N[2] / N[0]);
  const dur = 2.2;
  const turnAt = (k) => turn * (1 - (1 - k) ** 2.2);
  let ballT = 0;
  for (let j = 0; j <= 160; j++) {
    const k = j / 160;
    const t = hit.t + dur * k;
    const f = turnAt(k);
    t1.push(t, { rz: ph1 + f });
    tl.push(t, { rz: f });
    t2.push(t, { rz: ph2 - f * (N[0] / N[1]) });
    const f3 = f * (N[0] / N[2]);
    t3.push(t, { rz: ph3 + f3 });
    ta.push(t, { rz: arm0 + f3 });
    if (!ballT && arm0 + f3 >= hitA) ballT = t;
    if (j % 8 === 0) m.focus(t, c2[0], 0.2, 1.0);
    if (j % 4 === 0 && k < 0.85) m.sound(t, c2[0], 'tick', { strength: 0.5 * (1 - k) });
  }
  m.hit(hit.t, c1[0], hit.v, inc.phys.mat, 'steel');
  m.hit(ballT, ball[0], 0.6, 'steel', 'steel');
  addWedge(m, 'g-ramp', ball[0] + 0.015, 0.55, shelfTop - 0.012, -1);
  const kick = 0.45;
  return sendOut(m, 'g-ball', 'ball', {}, { t: ballT, x: ball[0], y: ball[1], vx: dir[0] * kick, vy: dir[1] * kick }, { ...B, mu: 0.03 }, ball[0] + 0.85, 1.0);
}

// 5. Uphill: a weighted wheel, nudged, rolls up a ramp by itself, over the
// top and down the far side.
function uphill(m, x0, inc) {
  const W = { ...PHYS.wheel, mu: 0.01 };
  const wx = x0 + 0.15 + W.r;
  const tw = m.part('u-wheel', 'wheel', { r: W.r, width: 0.2 }, { x: wx, y: W.r, z: 0 });
  const hit = rollInto(m, inc, wx - W.r, W.r, 1.3);
  const up = 0.95;
  const rise = 0.16;
  const top = 0.35;
  const down = 0.55;
  const r0 = wx + 0.35;
  m.part('u-up', 'wedge', { len: up, h: rise, dir: 1, depth: 0.3 }, { x: r0, y: 0, z: 0 });
  m.part('u-top', 'block', { w: top, h: rise, depth: 0.3 }, { x: r0 + up + top / 2, y: 0, z: 0 });
  m.part('u-down', 'wedge', { len: down, h: rise, dir: -1, depth: 0.3 }, { x: r0 + up + top, y: 0, z: 0 });
  m.polyline([[r0, 0], [r0 + up, rise], [r0 + up + top, rise], [r0 + up + top + down, 0.0005]]);
  const track = tw;
  const s = roll(m, track, { t: hit.t, x: wx, y: W.r, vx: 0.05 }, {
    ...W, motor: { v: 0.36, until: r0 + up + top + 0.02 }, until: (q) => q.x >= r0 + up + top + down + 1.0, focusW: 1.8,
  });
  return { id: 'u-wheel', kind: 'wheel', r: W.r, phys: W, state: s };
}

// 6. Pendulum: a brake disc hangs from a stand; the part knocks it, it
// swings out and sends a silencer rolling.
function pendulum(m, x0, inc) {
  const D = { r: 0.12 };
  const L = 0.62;
  const restY = D.r + 0.03;
  const bx = x0 + 0.12 + Math.max(inc.r, 0.1);
  const py = restY + L;
  const standZ = -0.26;
  m.part('p-stand', 'stand', { h: py + 0.04, reach: -standZ, base: 0.22 }, { x: bx, y: 0, z: standZ });
  const tc = m.part('p-cord', 'cord', { len: L - D.r * 0.55 }, { x: bx, y: py, z: 0, rz: 0 });
  const td = m.part('p-disc', 'disc', { r: D.r }, { x: bx, y: restY, z: 0 });
  const M = PHYS.muffler;
  const hitA = rad(32);
  const hb = [bx + L * Math.sin(hitA), py - L * Math.cos(hitA)];
  const dy = hb[1] - M.r;
  const mx = hb[0] + Math.sqrt(Math.max(0.001, (D.r + M.r) ** 2 - dy * dy));
  const tm = m.part('p-muffler', 'muffler', { len: 0.42, r: M.r }, { x: mx, y: M.r, z: 0 });
  const face = bx - Math.sqrt(Math.max(0, (D.r + inc.r) ** 2 - (inc.r - restY) ** 2)) + inc.r;
  const hit = rollInto(m, inc, face, inc.r * 2, 1.6);
  let phi = 0;
  // Struck hard enough to reach the silencer with speed to spare.
  const need = Math.sqrt((2 * G * (1 - Math.cos(hitA + rad(14)))) / L);
  let w = clamp((hit.v * 1.3) / L, need, 3.4);
  let t = hit.t;
  let struck = null;
  for (let step = 0; t < hit.t + 6; step++) {
    w += (-(G / L) * Math.sin(phi) - w * 0.25) * STEP;
    phi += w * STEP;
    if (!struck && phi >= hitA) {
      struck = { t, v: w * L };
      w = -w * 0.35;
      m.hit(t, mx, struck.v, 'steel', 'steel');
    }
    t += STEP;
    if (step % 4 === 0) {
      const x = bx + L * Math.sin(phi);
      const y = py - L * Math.cos(phi);
      td.push(t, { x, y, rz: -phi });
      tc.push(t, { rz: phi });
      if (!struck && step % 32 === 0) m.focus(t, x, 0.3, 1.5);
    }
    if (struck && t > struck.t + 4) break;
  }
  const n = [(mx - hb[0]) / (D.r + M.r), (M.r - hb[1]) / (D.r + M.r)];
  return sendOut(m, 'p-muffler', 'muffler', {}, { t: struck.t, x: mx, y: M.r, vx: Math.max(0.3, struck.v * 0.9 * n[0]), vy: 0 }, M, mx + 0.6, 1.4);
}

// 7. Finale: the part bumps a low cart carrying the product; the cart rolls
// to a stop under the banner.
function finale(m, x0, inc, product) {
  const deck = { w: Math.max(0.42, product.width * 1.25), h: 0.055, y: 0.075 };
  const travel = 1.5;
  const cx0 = x0 + 0.2 + deck.w / 2;
  const stopX = cx0 + travel;
  const tc = m.part('f-cart', 'cart', { w: deck.w, depth: 0.32, deckY: deck.y, deckH: deck.h }, { x: cx0, y: 0, z: 0 });
  const tp = m.part('f-product', 'product', { w: product.width, h: product.height }, { x: cx0, y: deck.y + deck.h, z: 0 });
  m.part('f-banner', 'banner', { w: product.bannerW, h: product.bannerH }, { x: stopX, y: deck.y + deck.h + product.height + 0.12 + product.bannerH / 2, z: -0.12 });
  const hit = rollInto(m, inc, cx0 - deck.w / 2, deck.y + deck.h, 1.6);
  const v0 = clamp(hit.v * 1.2, 0.6, 0.9);
  const a = (v0 * v0) / (2 * travel);
  const dur = v0 / a;
  for (let j = 0; j <= 240; j++) {
    const k = j / 240;
    const t = hit.t + dur * k;
    const tau = dur * k;
    const x = cx0 + v0 * tau - 0.5 * a * tau * tau;
    tc.push(t, { x });
    tp.push(t, { x });
    if (j % 12 === 0) m.focus(t, x, product.frameY, product.frameW);
  }
  m.rolls.push({ mat: 'cart', t0: hit.t, x: cx0 + travel / 2, v: Array.from({ length: Math.round(dur * RATE) }, (_, i) => v0 - a * (i / RATE)) });
  const stopT = hit.t + dur;
  m.focus(stopT, stopX, product.frameY, product.frameW);
  m.focus(stopT + 6, stopX, product.frameY, product.frameW);
  return { stopT, stopX };
}

const LINKS = { dominoes, seesaw, gearbox, uphill, pendulum };

// Spare parts standing about between the machine and the wall, as on a
// real set: springs, nuts, valves, bearings lying flat.
function props(m, x0, x1) {
  let s = 977;
  const r = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const kinds = [
    ['spring', { r: 0.028, len: 0.11, coils: 7 }, { rx: 0 }],
    ['nut', { r: 0.02, thick: 0.014 }, { rx: Math.PI / 2, y: 0.007 }],
    ['valve', { len: 0.11 }, { rz: Math.PI / 2, y: 0.017 }],
    ['bearing', { r: 0.04 }, { rx: Math.PI / 2, y: 0.008 }],
    ['spring', { r: 0.02, len: 0.16, coils: 9 }, { rx: 0 }],
    ['gear', { r: 0.05, teeth: 26, thick: 0.016, hole: 0.4 }, { rx: Math.PI / 2, y: 0.008 }],
  ];
  let i = 0;
  for (let x = x0 + 0.4; x < x1; x += 0.7 + r() * 0.9) {
    const [kind, opts, pose] = kinds[i++ % kinds.length];
    const z = -0.42 - r() * 0.35;
    m.part(`prop${i}`, kind, opts, { x, y: 0, z, ry: r() * Math.PI, ...pose });
  }
}
export const DEFAULT_LINKS = ['dominoes', 'seesaw', 'gearbox', 'uphill', 'pendulum'];

// ---------- the plan ----------

// Gaussian smoothing over uniformly sampled values.
function smooth(values, sigma) {
  const n = values.length;
  const rads = Math.ceil(sigma * 3);
  const kernel = Array.from({ length: rads * 2 + 1 }, (_, i) => Math.exp(-(((i - rads) / sigma) ** 2) / 2));
  return values.map((_, i) => {
    let s = 0;
    let w = 0;
    for (let j = -rads; j <= rads; j++) {
      const v = values[clamp(i + j, 0, n - 1)];
      s += v * kernel[j + rads];
      w += kernel[j + rads];
    }
    return s / w;
  });
}

export function plan(brief) {
  const aspect = ASPECTS[brief.aspect] ? brief.aspect : '16:9';
  const [width, height] = ASPECTS[aspect];
  const fps = 30;
  const p = brief.product ?? {};
  const ratio = p.ratio ?? 1; // image width / height, filled in by the film
  const ph = p.size ?? 0.4;
  const product = {
    height: ph,
    width: ph * ratio,
    bannerW: Math.max(0.5, ph * ratio * 1.3),
    bannerH: Math.max(0.16, ph * 0.4),
  };
  // The last frame holds the cart, the product and the banner.
  const bannerTop = 0.13 + ph + 0.12 + product.bannerH;
  product.frameY = bannerTop * 0.5;
  product.frameW = Math.max(1.1, product.bannerW * 1.9, bannerTop * 1.2 * (width / height));

  const m = new Machine();
  const names = (brief.links ?? DEFAULT_LINKS).filter((n) => LINKS[n]);
  let out = opener(m, 0, 0);
  for (const name of names) out = LINKS[name](m, out.state.x, out);
  const end = finale(m, out.state.x, out, product);
  props(m, -0.5, end.stopX - 0.9);

  // Holds on the product, then the end card.
  const musicAt = end.stopT + 0.7;
  m.sound(end.stopT + 0.35, end.stopX, 'chirp');
  const whiteAt = musicAt + (brief.end?.hold ?? 2.6);
  const cardT = whiteAt + 0.8;
  const length = cardT + (brief.end?.seconds ?? 3.4);

  // Camera: follow the action, always moving right, with a smooth dolly.
  const keys = m.focusKeys.sort((a, b) => a.t - b.t);
  const nT = Math.ceil(length * fps) + 1;
  const fx = [];
  const fy = [];
  const fw = [];
  let ki = 0;
  for (let i = 0; i < nT; i++) {
    const t = i / fps;
    while (ki + 1 < keys.length && keys[ki + 1].t <= t) ki++;
    const a = keys[ki];
    const b = keys[Math.min(ki + 1, keys.length - 1)];
    const k = b.t > a.t ? clamp((t - a.t) / (b.t - a.t), 0, 1) : 0;
    fx.push(Math.max(fx[i - 1] ?? -1e9, a.x + (b.x - a.x) * k));
    fy.push(a.y + (b.y - a.y) * k);
    fw.push(a.w + (b.w - a.w) * k);
  }
  const camera = { x: smooth(fx, fps * 1.1), y: smooth(fy, fps * 1.5), w: smooth(fw, fps * 1.8) };

  // Storyboard frames: the start of each link and the finale.
  const keyTimes = [1.2];
  const linkStarts = [];
  for (const id of ['d-plate0', 's-plank', 'g-gear1', 'u-wheel', 'p-disc', 'f-cart']) {
    const part = m.byId.get(id);
    if (part?.track.ts.length) linkStarts.push(part.track.ts[0] + 0.5);
  }
  keyTimes.push(...linkStarts, whiteAt - 0.5, cardT + 1.5);

  return {
    aspect, width, height, fps, length,
    parts: m.parts, events: m.events.sort((a, b) => a.t - b.t), rolls: m.rolls,
    camera, product, musicAt, whiteAt, cardT, stopX: end.stopX,
    keyTimes: keyTimes.map((t) => +t.toFixed(2)),
  };
}
