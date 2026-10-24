// The parts the machine is built from: machined steel gears, bearings,
// valves, springs and wheels, and the plywood ramps and blocks that carry
// them. Everything is made from code, in meters, with rolling parts' axles
// along z so they roll along x.
import * as THREE from 'three';

// ---------- textures ----------

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

// Long-grain plywood or pine for ramps, boards and blocks.
function woodTexture(seed, base = [178, 128, 78]) {
  const [c, g] = canvas(512, 512);
  const r = rng(seed);
  g.fillStyle = `rgb(${base})`;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 160; i++) {
    const y = r() * 512;
    const dark = r() * 0.22;
    g.strokeStyle = `rgba(${90 + r() * 30},${55 + r() * 20},${25},${dark})`;
    g.lineWidth = 0.5 + r() * 1.6;
    g.beginPath();
    for (let x = 0; x <= 512; x += 16) {
      const yy = y + Math.sin(x / (120 + i * 3) + i) * 1.6 + (r() - 0.5) * 0.4;
      x === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy);
    }
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// Brushed metal: fine streaks that break up reflections.
function brushedTexture(seed) {
  const [c, g] = canvas(256, 256);
  const r = rng(seed);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const v = 110 + r() * 50;
    g.fillStyle = `rgba(${v},${v},${v},0.35)`;
    g.fillRect(r() * 256, r() * 256, 10 + r() * 80, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---------- materials ----------

export function materials(accent = '#c8261e') {
  const brushed = brushedTexture(3);
  const steel = (color, roughness) => new THREE.MeshStandardMaterial({
    color, metalness: 1, roughness, roughnessMap: brushed,
  });
  return {
    steel: steel('#a4a6a8', 0.36),
    bright: steel('#cfd0d1', 0.24),
    dark: steel('#66696c', 0.4),
    black: new THREE.MeshStandardMaterial({ color: '#202123', metalness: 0.6, roughness: 0.45 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#161616', metalness: 0, roughness: 0.82 }),
    paint: new THREE.MeshPhysicalMaterial({ color: accent, metalness: 0.1, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
    wood: new THREE.MeshStandardMaterial({ map: woodTexture(7), roughness: 0.6, metalness: 0, envMapIntensity: 0.45 }),
    woodDark: new THREE.MeshStandardMaterial({ map: woodTexture(11, [128, 86, 54]), roughness: 0.55, metalness: 0, envMapIntensity: 0.45 }),
    cord: new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.7 }),
    cloth: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.95, side: THREE.DoubleSide }),
  };
}

// ---------- shapes ----------

function circlePath(r, n = 48, hole = true) {
  const p = new THREE.Path();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2 * (hole ? -1 : 1);
    i === 0 ? p.moveTo(Math.cos(a) * r, Math.sin(a) * r) : p.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return p;
}

function extrude(shape, depth, bevel = 0.0015) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 2, curveSegments: 24,
  });
  geo.translate(0, 0, -depth / 2 + bevel);
  geo.computeVertexNormals();
  return geo;
}

function lathe(profile, segments = 48) {
  const geo = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), segments);
  geo.rotateX(Math.PI / 2); // axle along z
  return geo;
}

function mesh(geo, mat) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------- parts ----------

// A spur gear. Teeth are trapezoids on the root circle.
export function gear(M, { r = 0.06, module, teeth = 24, thick = 0.018, hole = 0.35, spokes = 0, mat = 'dark' } = {}) {
  const shape = new THREE.Shape();
  if (module) r = (module * teeth) / 2 + module;
  const depth = module ? module * 2.25 : Math.min(0.012, r * 0.16);
  const root = r - depth;
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const step = (Math.PI * 2) / teeth;
    const pts = [
      [root, a0],
      [root, a0 + step * 0.18],
      [r, a0 + step * 0.32],
      [r, a0 + step * 0.62],
      [root, a0 + step * 0.76],
    ];
    for (const [rr, a] of pts) {
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      i === 0 && rr === root && a === a0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
    }
  }
  shape.closePath();
  shape.holes.push(circlePath(r * hole * 0.5, 32));
  if (spokes) {
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      const c = new THREE.Path();
      const rin = r * hole * 0.5 + r * 0.12;
      const rout = root - r * 0.12;
      const w = Math.PI / spokes * 0.62;
      c.moveTo(Math.cos(a - w) * rin, Math.sin(a - w) * rin);
      c.absarc(0, 0, rin, a - w, a + w, false);
      c.absarc(0, 0, rout, a + w, a - w, true);
      c.closePath();
      shape.holes.push(c);
    }
  }
  const g = new THREE.Group();
  g.add(mesh(extrude(shape, thick), M[mat]));
  // A raised hub on both faces.
  const hub = lathe([[r * hole * 0.5, -thick * 0.85], [r * hole * 0.95, -thick * 0.85], [r * hole * 0.95, thick * 0.85], [r * hole * 0.5, thick * 0.85]], 32);
  g.add(mesh(hub, M.bright));
  return g;
}

// A ball bearing seen from the side: outer race, shield, inner race.
export function bearing(M, { r = 0.035, thick = 0.016 } = {}) {
  const g = new THREE.Group();
  const ring = (ro, ri, t, mat) => {
    const s = new THREE.Shape();
    s.absarc(0, 0, ro, 0, Math.PI * 2, false);
    s.holes.push(circlePath(ri, 48));
    return mesh(extrude(s, t, 0.001), mat);
  };
  g.add(ring(r, r * 0.8, thick, M.bright));
  g.add(ring(r * 0.8, r * 0.55, thick * 0.86, M.black));
  g.add(ring(r * 0.55, r * 0.36, thick, M.bright));
  return g;
}

// A road wheel: rubber tire with tread grooves and a five-spoke alloy.
export function wheel(M, { r = 0.3, width = 0.2, spokes = 5 } = {}) {
  const g = new THREE.Group();
  const rimR = r * 0.62;
  const hw = width / 2;
  const tire = [];
  const n = 14;
  tire.push([rimR, -hw * 0.9]);
  tire.push([rimR + (r - rimR) * 0.5, -hw]);
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI;
    tire.push([r - (r - rimR) * 0.18 * (1 - Math.cos(a)) + 0, Math.sin(a) * hw * 0.98]);
  }
  tire.push([rimR + (r - rimR) * 0.5, hw]);
  tire.push([rimR, hw * 0.9]);
  g.add(mesh(lathe(tire, 72), M.rubber));
  // Barrel inside the tire.
  g.add(mesh(lathe([[rimR, -hw * 0.9], [rimR * 0.98, -hw * 0.8], [rimR * 0.98, hw * 0.8], [rimR, hw * 0.9]], 64), M.steel));
  // Spoke face.
  const face = new THREE.Shape();
  face.absarc(0, 0, rimR * 1.02, 0, Math.PI * 2, false);
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2 + Math.PI / 2 + Math.PI / spokes;
    const w = (Math.PI / spokes) * 0.62;
    const rin = rimR * 0.3;
    const rout = rimR * 0.86;
    const c = new THREE.Path();
    c.moveTo(Math.cos(a) * rin, Math.sin(a) * rin);
    c.absarc(0, 0, rout, a - w, a + w, false);
    c.lineTo(Math.cos(a) * rin, Math.sin(a) * rin);
    c.closePath();
    face.holes.push(c);
  }
  const spokeFace = mesh(extrude(face, width * 0.16, 0.004), M.bright);
  spokeFace.position.z = hw * 0.55;
  g.add(spokeFace);
  const back = spokeFace.clone();
  back.position.z = -hw * 0.55;
  g.add(back);
  g.add(mesh(lathe([[0, hw * 0.62], [rimR * 0.18, hw * 0.62], [rimR * 0.2, hw * 0.75], [0, hw * 0.78]], 32), M.dark));
  return g;
}

// An engine valve: a long stem with a flared head.
export function valve(M, { len = 0.11, head = 0.017 } = {}) {
  const s = 0.0028;
  const profile = [[0, 0], [head, 0], [head, 0.002], [head * 0.7, 0.006], [s * 1.6, 0.016], [s, 0.024], [s, len - 0.006], [s * 0.8, len - 0.005], [s * 0.8, len - 0.002], [s, len - 0.001], [0, len]];
  const geo = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 32);
  return mesh(geo, M.bright); // along +y from the head
}

// A coil spring along +y.
export function spring(M, { r = 0.03, len = 0.12, coils = 7, wire = 0.0035 } = {}) {
  const geo = springGeometry(r, len, coils, wire);
  const m = mesh(geo, M.paint);
  m.userData.spring = { r, len, coils, wire };
  return m;
}

export function springGeometry(r, len, coils, wire) {
  const pts = [];
  const n = coils * 24;
  for (let i = 0; i <= n; i++) {
    const a = (i / 24) * Math.PI * 2;
    const k = i / n;
    // Closed ends: the first and last turn are flat.
    const y = k < 1 / coils ? wire : k > 1 - 1 / coils ? len - wire : wire + ((k - 1 / coils) / (1 - 2 / coils)) * (len - wire * 2);
    pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, wire, 8, false);
}

// A hexagon nut with a threaded hole, axle along z.
export function nut(M, { r = 0.016, thick = 0.012 } = {}) {
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    i === 0 ? s.moveTo(Math.cos(a) * r, Math.sin(a) * r) : s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  s.holes.push(circlePath(r * 0.52, 24));
  return mesh(extrude(s, thick, 0.0012), M.bright);
}

export function ball(M, { r = 0.02, mat = 'bright' } = {}) {
  return mesh(new THREE.SphereGeometry(r, 32, 20), M[mat]);
}

// A cylinder lying along x (shafts, pistons) or standing along y.
export function rod(M, { r = 0.006, len = 0.3, axis = 'x', mat = 'steel' } = {}) {
  const geo = new THREE.CylinderGeometry(r, r, len, 20);
  if (axis === 'x') geo.rotateZ(Math.PI / 2);
  if (axis === 'z') geo.rotateX(Math.PI / 2);
  return mesh(geo, M[mat]);
}

// A brake disc: a flat rotor with a raised hat, axle along z.
export function disc(M, { r = 0.13, thick = 0.022 } = {}) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.absarc(0, 0, r, 0, Math.PI * 2, false);
  s.holes.push(circlePath(r * 0.52, 48));
  g.add(mesh(extrude(s, thick, 0.0015), M.steel));
  g.add(mesh(lathe([[r * 0.52, -thick / 2], [r * 0.5, thick * 1.6], [r * 0.3, thick * 1.7], [r * 0.12, thick * 1.7], [r * 0.12, thick * 1.2], [r * 0.48, thick * 1.1], [r * 0.48, -thick / 2]], 48), M.dark));
  return g;
}

// A silencer box with an outlet pipe, lying along x.
export function muffler(M, { len = 0.42, r = 0.075 } = {}) {
  const g = new THREE.Group();
  const p = [];
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * Math.PI / 2;
    p.push([Math.sin(a) * r, -len / 2 + r * 0.35 * (1 - Math.cos(a)) - r * 0.35]);
  }
  for (let i = 8; i >= 0; i--) {
    const a = (i / 8) * Math.PI / 2;
    p.push([Math.sin(a) * r, len / 2 - r * 0.35 * (1 - Math.cos(a)) + r * 0.35]);
  }
  p.unshift([0, -len / 2 - r * 0.35]);
  const geo = new THREE.LatheGeometry(p.map(([x, y]) => new THREE.Vector2(x, y)), 48);
  geo.rotateZ(Math.PI / 2);
  g.add(mesh(geo, M.steel));
  const pipe = rod(M, { r: r * 0.28, len: len * 0.45, axis: 'x', mat: 'bright' });
  pipe.position.x = len * 0.62;
  g.add(pipe);
  return g;
}

// A rectangular steel plate with two holes, standing in the xy plane.
export function plate(M, { w = 0.07, h = 0.16, thick = 0.006 } = {}) {
  const s = new THREE.Shape();
  const rr = 0.008;
  s.moveTo(-w / 2 + rr, 0);
  s.lineTo(w / 2 - rr, 0);
  s.quadraticCurveTo(w / 2, 0, w / 2, rr);
  s.lineTo(w / 2, h - rr);
  s.quadraticCurveTo(w / 2, h, w / 2 - rr, h);
  s.lineTo(-w / 2 + rr, h);
  s.quadraticCurveTo(-w / 2, h, -w / 2, h - rr);
  s.lineTo(-w / 2, rr);
  s.quadraticCurveTo(-w / 2, 0, -w / 2 + rr, 0);
  for (const y of [h * 0.22, h * 0.78]) {
    const c = new THREE.Path();
    c.absarc(0, y, w * 0.16, 0, Math.PI * 2, true);
    s.holes.push(c);
  }
  const geo = extrude(s, thick, 0.001);
  geo.rotateY(Math.PI / 2); // thin along x, so plates fall over along x
  return mesh(geo, M.steel);
}

// A plywood board: x is length, y thickness, z depth. Origin at the
// center of the top face, the line parts roll on.
export function board(M, { len = 0.6, thick = 0.018, depth = 0.12, mat = 'wood' } = {}) {
  const geo = new THREE.BoxGeometry(len, thick, depth);
  geo.translate(0, -thick / 2, 0);
  scaleUV(geo, len, depth);
  return mesh(geo, M[mat]);
}

// A wooden block, origin at the floor center.
export function block(M, { w = 0.1, h = 0.1, depth = 0.12, mat = 'wood' } = {}) {
  const geo = new THREE.BoxGeometry(w, h, depth);
  geo.translate(0, h / 2, 0);
  scaleUV(geo, Math.max(w, h), depth);
  return mesh(geo, M[mat]);
}

// A wooden ramp from x=0 to x=len, rising to h at the right end (dir 1)
// or falling from h at the left end (dir -1). The slope is slightly
// concave, like a sawn quarter pipe.
export function wedge(M, { len = 0.3, h = 0.1, depth = 0.12, dir = 1, mat = 'wood' } = {}) {
  const s = new THREE.Shape();
  const n = 12;
  const top = (k) => h * k; // straight, matching the rolling surface
  if (dir > 0) {
    s.moveTo(0, 0);
    s.lineTo(len, 0);
    for (let i = n; i >= 0; i--) s.lineTo((len * i) / n, top(i / n));
  } else {
    s.moveTo(0, 0);
    s.lineTo(len, 0);
    for (let i = n; i >= 0; i--) s.lineTo((len * i) / n, top(1 - i / n));
  }
  s.closePath();
  const geo = extrude(s, depth, 0.001);
  scaleUV(geo, 1, 1);
  return mesh(geo, M[mat]);
}

function scaleUV(geo, u, v) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u * 1.6, uv.getY(i) * v * 1.6);
}

// A thin cord between two points, rebuilt each frame when it moves.
export class Cord {
  constructor(M, r = 0.0012) {
    this.r = r;
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 6), M.cord);
    this.mesh.castShadow = true;
  }

  set(a, b) {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length();
    this.mesh.position.copy(a).addScaledVector(d, 0.5);
    this.mesh.scale.set(1, len, 1);
    this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  }
}

// A soft dark disc on the floor under a part, so parts sit on the floor
// rather than float above it.
export function contactShadow(size = 0.1, strength = 0.5) {
  const [c, g] = canvas(64, 64);
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(0,0,0,${strength})`);
  grad.addColorStop(0.5, `rgba(0,0,0,${strength * 0.45})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.scale.set(size, size, 1);
  m.position.y = 0.0008;
  m.renderOrder = 1;
  return m;
}

// A triangular pivot block with its apex at height h.
export function pivot(M, { h = 0.06, w = 0.09, depth = 0.1, mat = 'woodDark' } = {}) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0.004, h);
  s.lineTo(-0.004, h);
  s.closePath();
  return mesh(extrude(s, depth, 0.001), M[mat]);
}

// An upright plywood panel in the xy plane, standing on the floor.
export function panel(M, { w = 0.6, h = 0.45, thick = 0.018 } = {}) {
  const geo = new THREE.BoxGeometry(w, h, thick);
  geo.translate(0, h / 2, 0);
  scaleUV(geo, w, h);
  return mesh(geo, M.wood);
}

// A flat steel bar on an axle stub: from the pivot along +x (arm) or
// straight down (lever), standing out from z0 to z1.
export function bar(M, { len = 0.15, z0 = 0, z1 = 0.01, down = false } = {}) {
  const g = new THREE.Group();
  const w = 0.014;
  const geo = new THREE.BoxGeometry(len + w, w, 0.005);
  geo.translate(len / 2, 0, 0);
  const b = mesh(geo, M.bright);
  b.position.z = z1 - z0;
  const tip = mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.02, 16).rotateX(Math.PI / 2), M.dark);
  tip.position.set(len, 0, z1 - z0 - 0.004);
  const axle = mesh(new THREE.CylinderGeometry(0.006, 0.006, Math.abs(z1 - z0) + 0.02, 16).rotateX(Math.PI / 2), M.dark);
  axle.position.z = (z1 - z0) / 2;
  const inner = new THREE.Group();
  inner.add(b, tip, axle);
  if (down) inner.rotation.z = -Math.PI / 2;
  g.add(inner);
  return g;
}

// A gallows stand: base plate, post, and an arm reaching toward the camera.
export function stand(M, { h = 0.8, reach = 0.25, base = 0.2 } = {}) {
  const g = new THREE.Group();
  const foot = mesh(new THREE.BoxGeometry(base, 0.012, base), M.dark);
  foot.position.y = 0.006;
  const post = mesh(new THREE.CylinderGeometry(0.009, 0.009, h, 16), M.steel);
  post.position.y = h / 2;
  const arm = mesh(new THREE.CylinderGeometry(0.008, 0.008, reach + 0.03, 16).rotateX(Math.PI / 2), M.steel);
  arm.position.set(0, h - 0.01, reach / 2);
  const knuckle = mesh(new THREE.SphereGeometry(0.014, 16, 12), M.dark);
  knuckle.position.y = h - 0.01;
  g.add(foot, post, arm, knuckle);
  return g;
}

// A low cart: a plywood deck on four casters.
export function cart(M, { w = 0.5, depth = 0.32, deckY = 0.075, deckH = 0.05 } = {}) {
  const g = new THREE.Group();
  const deck = block(M, { w, h: deckH, depth, mat: 'woodDark' });
  deck.position.y = deckY;
  g.add(deck);
  const cr = 0.026;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const c = new THREE.Group();
      const wheel = mesh(new THREE.CylinderGeometry(cr, cr, 0.018, 24).rotateX(Math.PI / 2), M.rubber);
      wheel.position.y = cr;
      const fork = mesh(new THREE.BoxGeometry(0.03, deckY - cr + 0.004, 0.028), M.steel);
      fork.position.y = cr + (deckY - cr) / 2;
      c.add(wheel, fork);
      c.position.set(sx * (w / 2 - 0.05), 0, sz * (depth / 2 - 0.05));
      g.add(c);
    }
  }
  return g;
}
