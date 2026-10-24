// Silhouette dancer kit: turns motion-capture joint positions into a
// crisp black silhouette with hair, clothing and a white product with a cable.
// Coordinates are meters, Y up. The body is a smooth union of tapered
// capsules drawn on the GPU; cloth and the product are drawn with canvas 2D.

// ---------- vector helpers ----------
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const madd = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const lerp = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const ortho = (v, axis) => norm(sub(v, mul(axis, dot(v, axis))));

// ---------- motion ----------
export class Motion {
  constructor(data) {
    this.fps = data.fps;
    this.joints = data.joints;
    this.segments = data.segments;
  }

  // Pose at time t (seconds) relative to the segment's start. Negative times
  // reach into the pre-roll.
  pose(id, t) {
    const seg = this.segments[id];
    if (!seg) throw new Error(`Unknown motion segment: ${id}`);
    const n = seg.frames.length;
    const f = Math.min(n - 1.001, Math.max(0, (t + seg.preroll) * this.fps));
    const i = Math.floor(f);
    const k = f - i;
    const a = seg.frames[i];
    const b = seg.frames[i + 1];
    const pose = {};
    this.joints.forEach((name, j) => {
      const o = j * 3;
      pose[name] = [
        (a[o] + (b[o] - a[o]) * k) / 1000,
        (a[o + 1] + (b[o + 1] - a[o + 1]) * k) / 1000,
        (a[o + 2] + (b[o + 2] - a[o + 2]) * k) / 1000,
      ];
    });
    return pose;
  }

  span(id) {
    const seg = this.segments[id];
    return { preroll: seg.preroll, length: seg.frames.length / this.fps - seg.preroll };
  }
}

// ---------- body frames ----------
function bodyFrames(p) {
  const across = norm(sub(p.lclavicle, p.rclavicle));
  const up = norm(sub(p.lowerneck, p.lowerback));
  const fwd = norm(cross(across, up));
  const pAcross = norm(sub(p.lhipjoint, p.rhipjoint));
  const pUp = ortho(sub(p.lowerback, p.root), pAcross);
  const pFwd = norm(cross(pAcross, pUp));
  const hUp = norm(sub(p.head, p.upperneck));
  const hFwd = ortho(fwd, hUp);
  const hAcross = norm(cross(hUp, hFwd));
  const headC = madd(madd(p.upperneck, hUp, 0.1), hFwd, 0.015);
  return { across, up, fwd, pAcross, pUp, pFwd, hUp, hFwd, hAcross, headC };
}

// ---------- characters ----------
// Each character changes proportions, hair and clothing so every cut reads as
// a different dancer.
export const CHARACTERS = {
  pony: { hair: 'ponytail', top: 'fitted', bottom: 'skirt', shoes: 'flats', female: true, build: 0.95 },
  spike: { hair: 'spiky', top: 'tee', bottom: 'baggy', shoes: 'sneakers', female: false, build: 1.06 },
  afro: { hair: 'afro', top: 'fitted', bottom: 'flares', shoes: 'sneakers', female: true, build: 1 },
  cap: { hair: 'cap', top: 'tee', bottom: 'baggy', shoes: 'sneakers', female: false, build: 1.04 },
  bob: { hair: 'bob', top: 'fitted', bottom: 'shorts', shoes: 'sneakers', female: true, build: 0.97 },
};

// A tapered capsule between points a and b with radii ra and rb (meters).
// A capsule with a === b is a sphere. Under orthographic projection a
// capsule stays a capsule, which the GPU layer draws with smooth blending.
const C = (a, ra, b = a, rb = ra) => ({ a, b, ra, rb });
const S = (c, r) => ({ c, r });

// Anatomy as capsules. Radii are meters before `build` scaling.
function bodyCapsules(p, f, ch, holding) {
  const k = ch.build;
  const caps = [];
  const cap = (a, ra, b = a, rb = ra) => caps.push(C(a, ra * k, b, rb * k));
  const tee = ch.top === 'tee';
  const pad = tee ? 0.016 : 0;
  const { headC, hUp, hFwd, up, fwd, across, pUp, pFwd, pAcross } = f;
  const at = (o, ...terms) => terms.reduce((v, [d, s]) => madd(v, d, s), o);

  // Head: skull, jaw, brow, nose and chin give a readable profile.
  caps.push(C(at(headC, [hFwd, -0.015]), 0.097));
  caps.push(C(at(headC, [hUp, 0.03], [hFwd, -0.02]), 0.09));
  caps.push(C(at(headC, [hFwd, 0.02], [hUp, -0.02]), 0.075, at(headC, [hFwd, 0.062], [hUp, -0.088]), 0.028));
  caps.push(C(at(headC, [hFwd, 0.068], [hUp, 0.045]), 0.034));
  caps.push(C(at(headC, [hFwd, 0.088], [hUp, 0.012]), 0.016, at(headC, [hFwd, 0.106], [hUp, -0.018]), 0.01));
  // Neck and trapezius.
  cap(p.lowerneck, 0.056, at(headC, [hUp, -0.055], [hFwd, -0.01]), 0.048);
  const shoulder = {
    l: madd(p.lclavicle, across, -0.015),
    r: madd(p.rclavicle, across, 0.015),
  };
  for (const s of ['l', 'r']) {
    cap(madd(p.lowerneck, up, 0.005), 0.05, madd(lerp(p.lowerneck, shoulder[s], 0.75), up, -0.005), 0.05 + pad);
  }

  // Torso: two columns per section give a wide front and a narrow side.
  const chestTop = lerp(p.thorax, p.lowerneck, 0.35);
  for (const side of [1, -1]) {
    const o = (v, w, d = 0) => madd(madd(v, across, side * w), fwd, d);
    cap(o(chestTop, 0.065, 0.005), 0.095 + pad, o(p.upperback, 0.055, 0.01), 0.092 + pad);
    cap(o(p.upperback, 0.045, 0.005), 0.088 + pad, madd(p.lowerback, pAcross, side * 0.045), 0.083 + pad);
    cap(madd(p.lowerback, pAcross, side * 0.05), 0.085, p[side > 0 ? 'lhipjoint' : 'rhipjoint'], 0.09);
    if (ch.female) cap(at(p.thorax, [fwd, 0.072], [up, -0.06], [across, side * 0.055]), 0.05);
    cap(at(p.root, [pFwd, -0.055], [pUp, -0.075], [pAcross, side * 0.055]), 0.075);
  }
  cap(madd(p.root, pFwd, -0.01), 0.105);

  // Arms and hands.
  for (const s of ['l', 'r']) {
    const sh = shoulder[s];
    const elbow = p[`${s}humerus`];
    const wrist = p[`${s}wrist`];
    const hand = p[`${s}hand`];
    cap(sh, 0.056 + pad);
    if (tee) cap(sh, 0.07, lerp(sh, elbow, 0.45), 0.06);
    cap(sh, 0.05, elbow, 0.037);
    const fore = lerp(elbow, wrist, 0.32);
    cap(elbow, 0.037, fore, 0.041);
    cap(fore, 0.041, wrist, 0.025);
    cap(wrist, 0.026, hand, 0.032);
    cap(lerp(wrist, hand, 0.4), 0.018, p[`${s}thumb`], 0.011);
    if (s === holding) {
      cap(hand, 0.03, p[`${s}fingers`], 0.02);
    } else {
      // Open hand: four fingers fanned out in the palm plane.
      const dir = norm(sub(p[`${s}fingers`], wrist));
      const thumb = sub(p[`${s}thumb`], hand);
      const spread = norm(sub(thumb, mul(dir, dot(thumb, dir))));
      [-0.28, -0.09, 0.1, 0.3].forEach((a, i) => {
        const base = madd(hand, spread, (i - 1.5) * 0.016);
        const d = norm(add(mul(dir, Math.cos(a)), mul(spread, Math.sin(a))));
        cap(base, 0.012, madd(base, d, [0.07, 0.082, 0.078, 0.064][i]), 0.008);
      });
    }
  }

  // Legs and feet.
  const thick = { skirt: 0, baggy: 0.028, flares: 0.01, shorts: 0.006 }[ch.bottom];
  const shoe = ch.shoes === 'sneakers' ? 0.012 : 0;
  for (const s of ['l', 'r']) {
    const hip = p[`${s}hipjoint`];
    const knee = p[`${s}femur`];
    const ankle = p[`${s}tibia`];
    const ball = p[`${s}foot`];
    const toe = p[`${s}toes`];
    cap(hip, 0.09 + thick, knee, 0.054 + thick);
    if (ch.bottom === 'shorts') cap(hip, 0.1, lerp(hip, knee, 0.5), 0.08);
    if (ch.bottom === 'baggy') {
      cap(knee, 0.078, madd(ankle, sub(ankle, knee), 0.05), 0.07);
    } else if (ch.bottom === 'flares') {
      cap(knee, 0.06, madd(ankle, sub(ankle, knee), 0.07), 0.085);
    } else {
      const calf = lerp(knee, ankle, 0.3);
      cap(knee, 0.049, calf, 0.056);
      cap(calf, 0.056, ankle, 0.031);
    }
    const footDir = norm(sub(toe, ankle));
    const heel = at(ankle, [footDir, -0.04], [pUp, -0.03]);
    cap(ankle, 0.038 + shoe, heel, 0.034 + shoe);
    cap(heel, 0.034 + shoe, ball, 0.032 + shoe);
    cap(ball, 0.03 + shoe, toe, 0.02 + shoe);
  }
  return caps;
}

// ---------- physics ----------
class Chain {
  constructor(points, segLen) {
    this.pos = points.map((q) => [...q]);
    this.prev = points.map((q) => [...q]);
    this.segLen = segLen;
  }

  step(dt, pins, colliders, gravity = 9.8, damping = 0.985) {
    const { pos, prev } = this;
    for (let i = 0; i < pos.length; i++) {
      const v = sub(pos[i], prev[i]);
      prev[i] = pos[i];
      pos[i] = add(add(pos[i], mul(v, damping)), [0, -gravity * dt * dt, 0]);
    }
    for (let it = 0; it < 12; it++) {
      for (const [i, q] of pins) pos[i] = [...q];
      for (let i = 0; i < pos.length - 1; i++) {
        if (pins.has(i) && pins.has(i + 1)) continue;
        const d = sub(pos[i + 1], pos[i]);
        const l = len(d) || 1e-6;
        const diff = (l - this.segLen[i]) / l;
        const wa = pins.has(i) ? 0 : pins.has(i + 1) ? 1 : 0.5;
        pos[i] = madd(pos[i], d, diff * wa);
        pos[i + 1] = madd(pos[i + 1], d, -diff * (1 - wa));
      }
      for (const c of colliders) {
        for (let i = 0; i < pos.length; i++) {
          if (pins.has(i)) continue;
          const d = sub(pos[i], c.c);
          const l = len(d);
          if (l < c.r) pos[i] = madd(c.c, d, c.r / (l || 1e-6));
        }
      }
    }
    for (const [i, q] of pins) pos[i] = [...q];
  }
}

function ring(center, a, b, ra, rb, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    out.push(add(add(center, mul(a, Math.cos(t) * ra)), mul(b, Math.sin(t) * rb)));
  }
  return out;
}

// Evenly spread directions on a sphere, for afro curls.
const CURLS = Array.from({ length: 26 }, (_, i) => {
  const y = 1 - (i / 25) * 1.5;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const a = i * 2.39996;
  return [Math.cos(a) * r, y, Math.sin(a) * r];
});

// ---------- dancer ----------
// One dancer for one shot: holds the physics state for hair, cloth and cable.
export class Dancer {
  // `hold` (0-1) blends the device hand toward a held-up pose in front of the
  // shoulder, so the product is shown off the way the style requires.
  constructor(motion, segment, character, hand = 'r', hold = 0.75) {
    this.motion = motion;
    this.segment = segment;
    this.ch = CHARACTERS[character];
    this.hand = hand;
    this.hold = hold;
    this.time = null;
  }

  pose(t) {
    const p = this.motion.pose(this.segment, t);
    return this.hold > 0 ? holdUp(p, this.hand, this.hold) : p;
  }

  // Attachment points for hair, cloth and product at time t.
  rig(t) {
    const p = this.pose(t);
    const f = bodyFrames(p);
    const at = (o, ...terms) => terms.reduce((v, [d, s]) => madd(v, d, s), o);
    const waist = ring(madd(p.lowerback, f.pUp, -0.03), f.pAcross, f.pFwd, 0.135, 0.105, 16);
    const tail = at(f.headC, [f.hFwd, -0.095], [f.hUp, 0.06]);
    const tailPins = [
      at(tail, [f.hFwd, -0.035], [f.hUp, -0.015]),
      at(tail, [f.hFwd, -0.03], [f.hUp, -0.03], [f.hAcross, 0.02]),
      at(tail, [f.hFwd, -0.03], [f.hUp, 0.0], [f.hAcross, -0.02]),
    ];
    const bobRoots = [0.09, -0.09, 0].map((a) => at(f.headC, [f.hAcross, a], [f.hFwd, a ? -0.01 : -0.085], [f.hUp, 0.01]));
    // Earbuds sit in both ears; the device sits in the palm of `hand`.
    const ear = (s) => at(f.headC, [f.hAcross, s * 0.094], [f.hFwd, -0.004], [f.hUp, -0.012]);
    const buds = { l: ear(1), r: ear(-1) };
    const palm = lerp(p[`${this.hand}hand`], p[`${this.hand}fingers`], 0.2);
    return { p, f, waist, tail, tailPins, bobRoots, buds, palm };
  }

  // The first two points of skirt strip i: on the waist, then flared out.
  stripPins(r, i) {
    const w = r.waist[i];
    const out = ortho(sub(w, r.p.lowerback), r.f.pUp);
    return [w, madd(madd(w, out, 0.05), r.f.pUp, -0.09)];
  }

  legColliders(r) {
    const list = [{ c: r.p.root, r: 0.15 }];
    for (const s of ['l', 'r']) {
      const hip = r.p[`${s}hipjoint`];
      const knee = r.p[`${s}femur`];
      for (let k = 0; k <= 4; k++) list.push({ c: lerp(hip, knee, k / 4), r: 0.11 - k * 0.012 });
    }
    return list;
  }

  reset(t) {
    const r = this.rig(t);
    const hang = (root, n, seg) => {
      const pts = [];
      for (let i = 0; i < n; i++) pts.push(madd(root, [0, -1, 0], i * seg));
      return new Chain(pts, new Array(n - 1).fill(seg));
    };
    this.tails = r.tailPins.map((_, i) => hang(r.tail, i === 0 ? 12 : 9, 0.04));
    this.bob = r.bobRoots.map((root) => hang(root, 4, 0.045));
    this.skirt = this.ch.bottom === 'skirt'
      ? r.waist.map((_, i) => {
        const pts = this.stripPins(r, i);
        for (let k = 0; k < 3; k++) pts.push(madd(pts[pts.length - 1], [0, -1, 0], 0.09));
        return new Chain(pts, [len(sub(pts[1], pts[0])), 0.09, 0.09, 0.09]);
      })
      : null;
    // Earbud cable: one wire from each ear, joined at a splitter on the chest,
    // then a single wire with plenty of slack down to the device.
    const main = this.hand;
    const other = main === 'r' ? 'l' : 'r';
    const total = Math.max(1.3, len(sub(r.palm, r.buds[main])) * 1.4);
    const m = 34;
    const pts = [];
    for (let i = 0; i < m; i++) {
      const k = i / (m - 1);
      pts.push(madd(lerp(r.buds[main], r.palm, k), [0, -1, 0], Math.sin(k * Math.PI) * 0.18));
    }
    this.cable = new Chain(pts, new Array(m - 1).fill(total / (m - 1)));
    this.split = 10;
    const branchLen = (total / (m - 1)) * this.split * 1.05;
    const n = 11;
    const bpts = [];
    for (let i = 0; i < n; i++) bpts.push(lerp(r.buds[other], pts[this.split], i / (n - 1)));
    this.branch = new Chain(bpts, new Array(n - 1).fill(branchLen / (n - 1)));
    this.budSides = { main, other };
    this.time = t;
  }

  // Advance physics to time t. Rewinding resets and re-simulates from the
  // pre-roll so frames are deterministic in any render order.
  simulate(t) {
    const { preroll } = this.motion.span(this.segment);
    if (this.time === null || t < this.time) this.reset(-preroll);
    const dt = 1 / 240;
    while (this.time + dt <= t) {
      this.time += dt;
      const r = this.rig(this.time);
      if (this.ch.hair === 'ponytail') {
        const head = [{ c: r.f.headC, r: 0.12 }, { c: r.p.lowerneck, r: 0.08 }, { c: r.p.thorax, r: 0.13 }];
        this.tails[0].step(dt, new Map([[0, r.tail], [1, r.tailPins[0]]]), head, 14, 0.985);
      }
      if (this.ch.hair === 'bob') {
        const skull = [{ c: r.f.headC, r: 0.1 }];
        this.bob.forEach((chain, i) => chain.step(dt, new Map([[0, r.bobRoots[i]]]), skull, 9.8, 0.99));
      }
      if (this.skirt) {
        const legs = this.legColliders(r);
        this.skirt.forEach((strip, i) => {
          const [a, b] = this.stripPins(r, i);
          strip.step(dt, new Map([[0, a], [1, b]]), legs, 9.8, 0.985);
        });
      }
      const { main, other } = this.budSides;
      this.cable.step(dt, new Map([[0, r.buds[main]], [this.cable.pos.length - 1, r.palm]]), [], 9.8, 0.988);
      const last = this.branch.pos.length - 1;
      this.branch.step(dt, new Map([[0, r.buds[other]], [last, this.cable.pos[this.split]]]), [], 9.8, 0.988);
    }
  }

  hairCapsules(r) {
    const { f } = r;
    const at = (o, ...terms) => terms.reduce((v, [d, s]) => madd(v, d, s), o);
    const caps = [];
    const chainCaps = (pts, w0, w1) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const k0 = i / (pts.length - 1);
        const k1 = (i + 1) / (pts.length - 1);
        caps.push(C(pts[i], w0 + (w1 - w0) * k0, pts[i + 1], w0 + (w1 - w0) * k1));
      }
    };
    if (this.ch.hair === 'ponytail') {
      caps.push(C(at(f.headC, [f.hUp, 0.018], [f.hFwd, -0.018]), 0.106));
      caps.push(C(r.tail, 0.032));
      // Loose strands trail the main tail with small offsets, so the tail
      // stays one shape instead of splitting apart.
      const main = this.tails[0].pos;
      chainCaps(main, 0.034, 0.006);
      for (const [o, w] of [[0.018, 0.016], [-0.016, 0.014]]) {
        const side = norm(cross(sub(main[main.length - 1], main[0]), f.hFwd));
        chainCaps(main.map((q, i) => madd(q, side, o * (i / main.length) * 1.6)), w, 0.003);
      }
    } else if (this.ch.hair === 'bob') {
      caps.push(C(at(f.headC, [f.hUp, 0.025], [f.hFwd, -0.02]), 0.113));
      caps.push(C(at(f.headC, [f.hUp, 0.06], [f.hFwd, 0.045]), 0.062));
      for (const chain of this.bob) chainCaps(chain.pos, 0.055, 0.03);
    } else if (this.ch.hair === 'afro') {
      const c = at(f.headC, [f.hUp, 0.05], [f.hFwd, -0.03]);
      caps.push(C(c, 0.13));
      for (const [x, y, z] of CURLS) {
        const dir = add(add(mul(f.hAcross, x), mul(f.hUp, y)), mul(f.hFwd, z));
        if (y < -0.35 || (z > 0.55 && y < 0.3)) continue; // keep the face clear
        caps.push(C(madd(c, dir, 0.125), 0.055));
      }
    } else if (this.ch.hair === 'cap') {
      caps.push(C(at(f.headC, [f.hUp, 0.03], [f.hFwd, -0.01]), 0.106));
      for (const w of [-0.045, 0, 0.045]) {
        caps.push(C(at(f.headC, [f.hUp, 0.055], [f.hFwd, 0.07], [f.hAcross, w]), 0.016,
          at(f.headC, [f.hUp, 0.045], [f.hFwd, 0.175], [f.hAcross, w * 0.8]), 0.01));
      }
    } else if (this.ch.hair === 'spiky') {
      caps.push(C(at(f.headC, [f.hUp, 0.02], [f.hFwd, -0.012]), 0.104));
      const tufts = [
        [0.95, 0.3, 0], [0.95, 0, 0.3], [0.95, 0, -0.3], [0.8, -0.5, 0.1], [0.75, -0.55, -0.25],
        [0.6, 0.65, 0.3], [0.6, 0.6, -0.35], [0.5, -0.8, 0], [0.85, 0.5, 0], [0.7, 0.2, 0.6], [0.7, 0.2, -0.6],
      ];
      for (const [u, fw, ac] of tufts) {
        const dir = norm(add(add(mul(f.hUp, u), mul(f.hFwd, fw)), mul(f.hAcross, ac)));
        caps.push(C(madd(f.headC, dir, 0.075), 0.035, madd(f.headC, dir, 0.17), 0.004));
      }
    }
    return caps;
  }

  // Draw the dancer with camera `cam` onto 2D context `g`, using `layer` to
  // render the smooth body silhouette on the GPU. `look` holds the colors
  // and the product: { figure, product, line: 'earbuds' | 'none',
  // device: white image canvas or null, deviceSize: height in meters }.
  draw(g, cam, t, look, layer) {
    const colors = look;
    cam.at(t);
    this.simulate(t);
    const r = this.rig(t);
    const { f } = r;
    const caps = [...bodyCapsules(r.p, f, this.ch, this.hand), ...this.hairCapsules(r)];

    // Wires and earbuds are hidden where they pass behind the head or torso.
    const anchors = [f.headC, r.p.thorax, r.p.root];
    const isBehind = (q) => {
      let near = anchors[0];
      for (const a of anchors) if (len(sub(a, q)) < len(sub(near, q))) near = a;
      return cam.depth(q) < cam.depth(near) - 0.04;
    };
    const runs = (pts, hidden) => {
      const behind = pts.map(isBehind);
      const out = [];
      let run = null;
      pts.forEach((q, i) => {
        const on = behind[i] === hidden || (i > 0 && behind[i - 1] === hidden);
        if (on) (run ??= []).push(cam.project(q));
        else if (run) out.push(run), (run = null);
      });
      if (run) out.push(run);
      return out.filter((x) => x.length > 1);
    };
    const wires = [this.cable.pos, this.branch.pos];
    const budBehind = (q) => cam.depth(q) < cam.depth(f.headC) - 0.02;
    const drawWires = (hidden) => {
      if (look.line === 'none') return;
      g.lineWidth = Math.max(2, cam.px(0.0042));
      for (const w of wires) for (const run of runs(w, hidden)) strokePath(g, run, true);
      for (const q of Object.values(r.buds)) {
        if (budBehind(q) === hidden) fillCircle(g, cam.project(q), cam.px(0.014));
      }
    };

    // Back to front: hidden wires, body, cloth, then wires and device.
    g.fillStyle = colors.product;
    g.strokeStyle = colors.product;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    drawWires(true);
    layer.draw(caps.map((c) => {
      const [ax, ay] = cam.project(c.a);
      const [bx, by] = cam.project(c.b);
      return [ax, ay, bx, by, cam.px(c.ra), cam.px(c.rb)];
    }), colors.figure, cam.px(0.02));
    g.drawImage(layer.canvas, 0, 0);
    g.fillStyle = colors.figure;
    if (this.skirt) {
      // Panels between neighboring strips keep the hem soft and uneven.
      const strips = this.skirt.map((s) => s.pos);
      // Stroking with round joins softens the panel corners.
      g.strokeStyle = colors.figure;
      g.lineJoin = 'round';
      g.lineWidth = cam.px(0.03);
      for (let i = 0; i < strips.length; i++) {
        const next = strips[(i + 1) % strips.length];
        const panel = hull([...strips[i], ...next].map((q) => cam.project(q)));
        fillPoly(g, panel);
        g.beginPath();
        panel.forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        g.stroke();
      }
      fillHull(g, cam, r.waist.map((q) => S(q, 0.02)));
    }

    g.fillStyle = colors.product;
    g.strokeStyle = colors.product;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    drawWires(false);
    drawDevice(g, cam, r.p, this.hand, r.palm, look.device, look.deviceSize ?? 0.092, look.deviceTilt ?? 1);
  }
}

// Two-bone IK: move the device arm toward a pose in front of the shoulder,
// keeping a share of the captured motion. Hand joints follow the wrist.
function holdUp(p, hand, weight) {
  const f = bodyFrames(p);
  const out = hand === 'l' ? 1 : -1;
  const shoulder = p[`${hand}clavicle`];
  const elbow0 = p[`${hand}humerus`];
  const wrist0 = p[`${hand}wrist`];
  const l1 = len(sub(elbow0, shoulder));
  const l2 = len(sub(wrist0, elbow0));
  const want = add(add(add(shoulder, mul(f.fwd, 0.14)), mul(f.across, out * 0.24)), mul(f.up, 0.06));
  const target = lerp(wrist0, want, weight);
  const toT = sub(target, shoulder);
  const d = Math.min(l1 + l2 - 1e-3, Math.max(Math.abs(l1 - l2) + 1e-3, len(toT)));
  const dir = norm(toT);
  const hint = ortho(add(mul(f.up, -0.8), mul(f.across, out * 0.6)), dir);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const elbow = add(add(shoulder, mul(dir, a)), mul(hint, h));
  const wrist = add(shoulder, mul(dir, d));
  // Hand points along the forearm, angled up to show the device.
  const fore = norm(add(norm(sub(wrist, elbow)), mul(f.up, 0.6)));
  const q = { ...p };
  q[`${hand}humerus`] = elbow;
  q[`${hand}radius`] = lerp(elbow, wrist, 0.9);
  q[`${hand}wrist`] = wrist;
  q[`${hand}hand`] = madd(wrist, fore, 0.06);
  q[`${hand}fingers`] = madd(wrist, fore, 0.12);
  q[`${hand}thumb`] = madd(madd(wrist, fore, 0.06), f.fwd, 0.03);
  return q;
}

// The device, held along the forearm: the user's product as a white image,
// or a white pebble when there is none. `size` is its height in meters;
// `tilt` (0-1) is how far it follows the forearm away from upright.
function drawDevice(g, cam, p, hand, palm, image, size, tilt) {
  const [cx, cy] = cam.project(palm);
  const [wx, wy] = cam.project(p[`${hand}humerus`]);
  const [fx, fy] = cam.project(p[`${hand}fingers`]);
  let ux = fx - wx;
  let uy = fy - wy;
  const l = Math.hypot(ux, uy);
  if (l < 1e-3) [ux, uy] = [0, -1];
  else [ux, uy] = [ux / l, uy / l];
  g.save();
  g.translate(cx, cy);
  // Rotate so the top of the device points along the forearm, eased
  // toward upright by `tilt`.
  let angle = Math.atan2(uy, ux) + Math.PI / 2;
  angle = Math.atan2(Math.sin(angle), Math.cos(angle)) * tilt;
  g.rotate(angle);
  const h = cam.px(size);
  if (image) {
    const w = (h * image.width) / image.height;
    g.drawImage(image, -w / 2, -h / 2, w, h);
  } else {
    const w = h * 0.63;
    g.beginPath();
    g.roundRect(-w / 2, -h / 2, w, h, h * 0.22);
    g.fill();
  }
  g.restore();
}

// ---------- GPU silhouette layer ----------
const MAX_CAPS = 160;
const FRAG = `#version 300 es
precision highp float;
uniform int uCount;
uniform vec4 uSeg[${MAX_CAPS}];
uniform vec2 uRad[${MAX_CAPS}];
uniform float uK;
uniform float uHeight;
uniform vec3 uColor;
out vec4 outColor;
float cro(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }
// Signed distance to a tapered capsule (Inigo Quilez, "uneven capsule").
float sdCapsule(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pb = b - a;
  float h = dot(pb, pb);
  float d = ra - rb;
  if (h <= d * d + 1e-3) return min(length(p - a) - ra, length(p - b) - rb);
  p -= a;
  vec2 q = vec2(dot(p, vec2(pb.y, -pb.x)), dot(p, pb)) / h;
  q.x = abs(q.x);
  vec2 c = vec2(sqrt(h - d * d), d);
  float k = cro(c, q);
  float m = dot(c, q);
  float n = dot(q, q);
  if (k < 0.0) return sqrt(h * n) - ra;
  if (k > c.x) return sqrt(h * (n + 1.0 - 2.0 * q.y)) - rb;
  return m - ra;
}
float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, uHeight - gl_FragCoord.y);
  float d = 1e9;
  for (int i = 0; i < ${MAX_CAPS}; i++) {
    if (i >= uCount) break;
    d = smin(d, sdCapsule(p, uSeg[i].xy, uSeg[i].zw, uRad[i].x, uRad[i].y), uK);
  }
  float a = clamp(0.5 - d, 0.0, 1.0);
  outColor = vec4(uColor * a, a);
}`;

// Renders a smooth union of capsules into its own canvas.
export class SilhouetteLayer {
  constructor(width, height) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    const gl = this.canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true });
    this.gl = gl;
    const shader = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, `#version 300 es
in vec2 pos; void main() { gl_Position = vec4(pos, 0.0, 1.0); }`));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = Object.fromEntries(['uCount', 'uSeg', 'uRad', 'uK', 'uHeight', 'uColor'].map((n) => [n, gl.getUniformLocation(prog, n)]));
    gl.uniform1f(this.u.uHeight, height);
  }

  // caps: [ax, ay, bx, by, ra, rb] in pixels. k: blend radius in pixels.
  draw(caps, color, k) {
    const { gl, u } = this;
    if (caps.length > MAX_CAPS) throw new Error(`Too many capsules: ${caps.length}`);
    const seg = new Float32Array(MAX_CAPS * 4);
    const rad = new Float32Array(MAX_CAPS * 2);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    caps.forEach(([ax, ay, bx, by, ra, rb], i) => {
      seg.set([ax, ay, bx, by], i * 4);
      rad.set([ra, rb], i * 2);
      const r = Math.max(ra, rb) + k;
      x0 = Math.min(x0, ax - r, bx - r);
      y0 = Math.min(y0, ay - r, by - r);
      x1 = Math.max(x1, ax + r, bx + r);
      y1 = Math.max(y1, ay + r, by + r);
    });
    const hex = Number.parseInt(color.slice(1), 16);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.SCISSOR_TEST);
    const H = this.canvas.height;
    const sx = Math.max(0, Math.floor(x0));
    const sy = Math.max(0, Math.floor(H - y1));
    gl.scissor(sx, sy, Math.max(0, Math.ceil(x1) - sx), Math.max(0, Math.ceil(H - y0) - sy));
    gl.uniform1i(u.uCount, caps.length);
    gl.uniform4fv(u.uSeg, seg);
    gl.uniform2fv(u.uRad, rad);
    gl.uniform1f(u.uK, k);
    gl.uniform3f(u.uColor, ((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.finish();
  }
}

// ---------- camera and 2D drawing ----------
export class Camera {
  constructor({ yaw = 0, center = [0, 0, 0], scale = 400, ox = 960, oy = 540, mirror = false, track = null }) {
    this.cos = Math.cos(yaw);
    this.sin = Math.sin(yaw);
    this.center = center;
    this.scale = scale;
    this.ox = ox;
    this.oy = oy;
    this.flip = mirror ? -1 : 1;
    this.track = track;
    this.shift = 0;
    this.shiftY = 0;
  }

  // Follow the dancer sideways. On a flat background the move is invisible,
  // so traveling steps stay large and centered.
  at(t) {
    if (this.track) [this.shift, this.shiftY] = this.track(t);
    return this;
  }

  // Horizontal screen position before scaling, in meters.
  screenX(v) {
    const dx = v[0] - this.center[0];
    const dz = v[2] - this.center[2];
    return (dx * this.cos - dz * this.sin) * this.flip;
  }

  project(v) {
    return [
      this.ox + (this.screenX(v) - this.shift) * this.scale,
      this.oy - (v[1] - this.center[1] - this.shiftY) * this.scale,
    ];
  }

  depth(v) {
    const dx = v[0] - this.center[0];
    const dz = v[2] - this.center[2];
    return dx * this.sin + dz * this.cos;
  }

  px(meters) {
    return meters * this.scale;
  }
}

function hull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const crossZ = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const q of pts) {
    while (lower.length >= 2 && crossZ(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const q = pts[i];
    while (upper.length >= 2 && crossZ(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

function fillHull(g, cam, spheres) {
  const pts = [];
  for (const s of spheres) {
    const [x, y] = cam.project(s.c);
    const r = cam.px(s.r);
    const n = r > 60 ? 40 : 24;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    }
  }
  fillPoly(g, hull(pts));
}

function fillPoly(g, pts) {
  if (pts.length < 3) return;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fill();
}

function strokePath(g, pts, smooth = false) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  if (smooth) {
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const last = pts[pts.length - 1];
    g.lineTo(last[0], last[1]);
  } else {
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  }
  g.stroke();
}

function fillCircle(g, [x, y], r) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

const LOWER = ['ltibia', 'lfoot', 'ltoes', 'rtibia', 'rfoot', 'rtoes'];
const UPPER = ['root', 'thorax', 'lowerneck', 'upperneck', 'head', 'lclavicle', 'rclavicle',
  'lhumerus', 'rhumerus', 'lradius', 'rradius', 'lhand', 'rhand', 'lfingers', 'rfingers'];

// Fit a camera for a whole shot. `framing` is 'full' (head to toe, always in
// frame), 'knee' (knees up) or 'mid' (waist up); in the last two the body
// below is cropped by the frame. `x` places the dancer across the width.
export function fitCamera(motion, segment, from, to, {
  yaw = 0, mirror = false, width, height, fill = 0.86, framing = 'full', follow = 0.85, followY = 0, x = 0.5, top = 0.28,
}) {
  const probe = new Camera({ yaw, mirror });
  // Smoothed horizontal path of the pelvis, used to follow the dancer.
  const step = 1 / 60;
  const t0 = from - 0.6;
  const rawX = [];
  const rawY = [];
  for (let t = t0; t <= to + 0.6; t += step) {
    const root = motion.pose(segment, t).root;
    rawX.push(probe.screenX(root));
    rawY.push(root[1]);
  }
  const smoothed = (raw, seconds) => {
    const half = Math.round(seconds / step);
    return raw.map((_, i) => {
      let sum = 0, n = 0;
      for (let j = Math.max(0, i - half); j <= Math.min(raw.length - 1, i + half); j++) {
        sum += raw[j];
        n++;
      }
      return sum / n;
    });
  };
  const sx = smoothed(rawX, 0.35);
  const sy = smoothed(rawY, 0.25);
  const meanY = sy.reduce((a, b) => a + b, 0) / sy.length;
  // Horizontal follow, plus optional partial vertical follow that shrinks
  // the height a jump needs while keeping some of its lift.
  const track = (t) => {
    const f = Math.min(sx.length - 1.001, Math.max(0, (t - t0) / step));
    const i = Math.floor(f);
    const k = f - i;
    return [
      (sx[i] + (sx[i + 1] - sx[i]) * k) * follow,
      (sy[i] + (sy[i + 1] - sy[i]) * k - meanY) * followY,
    ];
  };

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let t = from; t <= to; t += 1 / 30) {
    const p = motion.pose(segment, t);
    const [shift, shiftY] = track(t);
    const names = framing === 'mid' ? UPPER
      : framing === 'knee' ? Object.keys(p).filter((n) => !LOWER.includes(n))
        : Object.keys(p);
    for (const name of names) {
      const x = probe.screenX(p[name]) - shift;
      const y = -(p[name][1] - shiftY);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  // Leave room for hair, hands and cloth beyond the joints.
  minX -= 0.2; maxX += 0.2; minY -= top;
  maxY += framing === 'full' ? 0.07 : 0;
  const scale = Math.min((height * fill) / (maxY - minY), (width * 0.86) / (maxX - minX));
  const cx = (minX + maxX) / 2;
  const cy = framing === 'full' ? (minY + maxY) / 2 : minY + (height * 0.5) / scale;
  return new Camera({
    yaw,
    mirror,
    scale,
    ox: width * x - cx * scale,
    oy: height / 2 - cy * scale,
    track,
  });
}
