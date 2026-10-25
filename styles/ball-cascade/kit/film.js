// The ball-cascade film: thousands of bright bouncy balls pour down a steep
// street of painted row houses on a sunny day, in slow motion, shot by
// shot: the whole hill from across the street, low on the asphalt, around
// a mailbox, down the hill toward the city, close through the bounce, and
// last around the product, where the tagline and the name appear.
//
// URL parameters: brief=<url of brief.json>. Files named in the brief are
// resolved relative to the brief.
import * as THREE from 'three';
import { plan } from './plan.mjs';

const params = new URLSearchParams(location.search);
if (!params.has('brief')) throw new Error('Open this page with ?brief=<url of brief.json>');
const briefUrl = new URL(params.get('brief'), location.href);

const SLOPE = Math.tan((14 * Math.PI) / 180);
const ROAD = 5; // half width of the road
const WALK = 7.5; // the house fronts
const CURB = 0.15;
const PALETTE = ['#ff2d95', '#ffd400', '#2bd94e', '#ff6a00', '#1e7bff', '#8f3bff', '#00d4c4', '#ff3344'];
const HOUSES = ['#f4f1e8', '#efe3c4', '#f2d16b', '#bfe3d3', '#b9d3ea', '#f0b9a4', '#d8dde3', '#f6f6f2', '#9fcfc6'];

const ground = (x, z) => x * SLOPE + (Math.abs(z) > ROAD ? CURB : 0);

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

function texture(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (repeat) t.repeat.set(...repeat);
  return t;
}

// Sun-bleached asphalt with patches and grit.
function asphalt() {
  const [c, g] = canvas(1024, 1024);
  const r = rng(5);
  g.fillStyle = '#7d7c79';
  g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 26; i++) {
    const v = 105 + r() * 40;
    g.fillStyle = `rgba(${v},${v - 2},${v - 5},0.35)`;
    g.fillRect(r() * 1024, r() * 1024, 80 + r() * 300, 40 + r() * 200);
  }
  for (let i = 0; i < 60000; i++) {
    const v = 70 + r() * 110;
    g.fillStyle = `rgba(${v},${v},${v},0.5)`;
    g.fillRect(r() * 1024, r() * 1024, 1.5, 1.5);
  }
  g.strokeStyle = 'rgba(40,40,40,0.5)';
  for (let i = 0; i < 12; i++) {
    g.lineWidth = 1 + r() * 2;
    g.beginPath();
    let x = r() * 1024;
    let y = r() * 1024;
    g.moveTo(x, y);
    for (let k = 0; k < 8; k++) g.lineTo((x += (r() - 0.5) * 80), (y += (r() - 0.5) * 80));
    g.stroke();
  }
  return texture(c);
}

// Pale concrete sidewalk slabs.
function concrete() {
  const [c, g] = canvas(512, 512);
  const r = rng(9);
  g.fillStyle = '#c9c5bc';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 20000; i++) {
    const v = 170 + r() * 60;
    g.fillStyle = `rgba(${v},${v - 3},${v - 8},0.4)`;
    g.fillRect(r() * 512, r() * 512, 2, 2);
  }
  g.fillStyle = 'rgba(90,85,78,0.55)';
  g.fillRect(0, 0, 512, 3);
  g.fillRect(0, 0, 3, 512);
  return texture(c);
}

// Skews any geometry built in street coordinates up the hill.
function onHill(geo) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + p.getX(i) * SLOPE);
  geo.computeVertexNormals();
  return geo;
}

function mesh(geo, mat, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

// ---------- the street ----------

function street(scene, x0, x1) {
  const len = x1 - x0;
  const mid = (x0 + x1) / 2;
  const road = new THREE.PlaneGeometry(len, ROAD * 2, 200, 1);
  road.rotateX(-Math.PI / 2);
  road.translate(mid, 0, 0);
  const uv = road.attributes.uv;
  const pos = road.attributes.position;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 8, pos.getZ(i) / 8);
  scene.add(mesh(onHill(road), new THREE.MeshStandardMaterial({ map: asphalt(), roughness: 0.92 }), false));

  const walkMat = new THREE.MeshStandardMaterial({ map: concrete(), roughness: 0.85 });
  for (const side of [-1, 1]) {
    const w = new THREE.BoxGeometry(len, CURB, WALK - ROAD, 200, 1, 1);
    w.translate(mid, CURB / 2, side * (ROAD + WALK) / 2);
    const u = w.attributes.uv;
    const pp = w.attributes.position;
    for (let i = 0; i < pp.count; i++) u.setXY(i, pp.getX(i) / 1.5, pp.getZ(i) / 1.5);
    scene.add(mesh(onHill(w), walkMat, false));
  }
}

// Painted row houses, stepped down the hill, facing the street.
function houses(scene, x0, x1, r) {
  const trim = new THREE.MeshStandardMaterial({ color: '#f7f5ef', roughness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: '#2a3540', roughness: 0.08, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: '#3a3a38', roughness: 0.7 });
  const green = new THREE.MeshStandardMaterial({ color: '#4f7f3a', roughness: 0.9 });
  const box = (w, h, d, mat, x, y, z) => {
    const m = mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    scene.add(m);
    return m;
  };
  for (const side of [-1, 1]) {
    let x = x0;
    // No houses on the near side at the top, where the wide shot looks
    // across the street.
    const end = side > 0 ? -32 : x1;
    while (x < end) {
      const w = 6.2 + r() * 2;
      const base = x * SLOPE + CURB; // the low corner
      const top = (x + w) * SLOPE + CURB + 7.5 + r() * 2.5;
      const color = new THREE.MeshStandardMaterial({ color: HOUSES[Math.floor(r() * HOUSES.length)], roughness: 0.8 });
      const zf = side * WALK; // facade plane
      const depth = 10;
      const zc = side * (WALK + depth / 2);
      const face = -side; // the facade looks toward the street
      box(w - 0.1, top - base + 1, depth, color, x + w / 2, (base + top) / 2 - 0.5, zc);
      // Cornice.
      box(w, 0.35, 0.5, trim, x + w / 2, top - 0.2, zf + face * 0.2);
      // Garage at street level on the low side.
      const gw = 2.4 + r() * 0.6;
      box(gw, 2.3, 0.08, r() < 0.4 ? new THREE.MeshStandardMaterial({ color: '#7fd1c8', roughness: 0.6 }) : trim, x + 0.4 + gw / 2, base + 1.15, zf + face * 0.04);
      // Main floor: a bay window, a flat window, the door up a stair.
      const floor = base + 3.0;
      const bayX = x + 0.4 + gw / 2;
      box(3.0, 2.2, 0.7, color, bayX, floor + 1.4, zf + face * 0.35);
      box(3.1, 0.18, 0.8, trim, bayX, floor + 2.6, zf + face * 0.4);
      box(3.1, 0.18, 0.8, trim, bayX, floor + 0.25, zf + face * 0.4);
      for (const dx of [-0.95, 0, 0.95]) box(0.75, 1.5, 0.05, glass, bayX + dx, floor + 1.4, zf + face * 0.72);
      for (let k = 0; k < 2; k++) {
        const wx = bayX + 2.1 + k * 1.2;
        if (wx > x + w - 0.6) break;
        box(0.8, 1.5, 0.05, glass, wx, floor + 1.4, zf + face * 0.03);
        box(0.95, 0.12, 0.12, trim, wx, floor + 2.2, zf + face * 0.06);
      }
      // Upper floor windows.
      if (top - floor > 6) {
        for (let k = 0; k < 3; k++) {
          const wx = x + 1.2 + k * ((w - 2.4) / 2);
          box(0.8, 1.4, 0.05, glass, wx, floor + 4.3, zf + face * 0.03);
          box(0.95, 0.12, 0.12, trim, wx, floor + 5.05, zf + face * 0.06);
        }
      }
      // Door and stair on the high side.
      const dx = x + w - 1.1;
      const dBase = dx * SLOPE + CURB;
      box(0.95, 2.1, 0.06, dark, dx, floor + 1.05, zf + face * 0.03);
      const steps = 7;
      for (let k = 0; k < steps; k++) {
        const h = ((k + 1) * (floor - dBase)) / steps;
        box(1.3, h, 0.22, trim, dx, dBase + h / 2 - 0.02, zf + face * (0.11 + (steps - 1 - k) * 0.2));
      }
      // A shrub now and then.
      if (r() < 0.45) {
        const b = mesh(new THREE.IcosahedronGeometry(0.7 + r() * 0.4, 1), green);
        b.position.set(x + 3.6, x * SLOPE + CURB + 0.5, zf + face * 0.8);
        b.scale.set(1.3, 0.9, 0.8);
        scene.add(b);
      }
      x += w;
    }
  }
  // Telephone poles and their wires, on the near side.
  const wood = new THREE.MeshStandardMaterial({ color: '#6b5440', roughness: 0.9 });
  const cable = new THREE.MeshBasicMaterial({ color: '#222222' });
  let prev = null;
  for (let x = x0 + 4; x < x1; x += 28) {
    const y = x * SLOPE + CURB;
    const pole = mesh(new THREE.CylinderGeometry(0.12, 0.16, 11, 12), wood);
    pole.position.set(x, y + 5.5, -(ROAD + 0.5));
    scene.add(pole);
    const arm = mesh(new THREE.BoxGeometry(0.12, 0.12, 2.2), wood);
    arm.position.set(x, y + 10.2, -(ROAD + 0.5));
    scene.add(arm);
    if (prev) {
      for (const dz of [-0.9, 0.9]) {
        const a = new THREE.Vector3(prev.x, prev.y + 10.3, -(ROAD + 0.5) + dz);
        const b = new THREE.Vector3(x, y + 10.3, -(ROAD + 0.5) + dz);
        const d = new THREE.Vector3().subVectors(b, a);
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, d.length(), 4), cable);
        wire.position.copy(a).addScaledVector(d, 0.5);
        wire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
        scene.add(wire);
      }
    }
    prev = { x, y };
  }
}

// Across the street from the wide shot: a sloping lawn below the near
// sidewalk, and an old pickup parked at the far curb.
function nearSide(scene) {
  const lawn = new THREE.PlaneGeometry(60, 40, 30, 1);
  lawn.rotateX(-Math.PI / 2);
  lawn.translate(2, 0, WALK + 20);
  const grass = new THREE.MeshStandardMaterial({ color: '#6c8442', roughness: 1 });
  const m = mesh(onHill(lawn), grass, false);
  m.position.y = CURB - 0.05;
  scene.add(m);
}

function pickup(scene, x, z) {
  const paint = new THREE.MeshPhysicalMaterial({ color: '#7f9fbd', roughness: 0.45, clearcoat: 0.4 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#d8d8d8', metalness: 1, roughness: 0.2 });
  const tire = new THREE.MeshStandardMaterial({ color: '#1b1b1b', roughness: 0.9 });
  const glass = new THREE.MeshStandardMaterial({ color: '#25303a', roughness: 0.05, metalness: 0.5 });
  const g = new THREE.Group();
  const add = (geo, mat, px, py, pz) => {
    const m = mesh(geo, mat);
    m.position.set(px, py, pz);
    g.add(m);
  };
  add(new THREE.BoxGeometry(4.9, 0.55, 1.75), paint, 0, 0.75, 0); // body
  add(new THREE.BoxGeometry(1.5, 0.75, 1.62), paint, 0.55, 1.4, 0); // cab
  add(new THREE.BoxGeometry(0.06, 0.55, 1.4), glass, 1.32, 1.45, 0); // windscreen
  add(new THREE.BoxGeometry(1.2, 0.5, 0.04), glass, 0.55, 1.45, 0.82); // side window
  add(new THREE.BoxGeometry(1.6, 0.4, 1.7), paint, 1.9, 1.05, 0); // hood
  add(new THREE.BoxGeometry(0.12, 0.2, 1.8), chrome, 2.5, 0.6, 0); // bumper
  add(new THREE.BoxGeometry(0.12, 0.2, 1.8), chrome, -2.5, 0.6, 0);
  for (const wx of [-1.6, 1.7]) {
    for (const wz of [-0.82, 0.82]) {
      const w = mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.25, 20).rotateX(Math.PI / 2), tire);
      w.position.set(wx, 0.38, wz);
      g.add(w);
      const fender = mesh(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), paint);
      fender.position.set(wx, 0.62, wz);
      fender.scale.set(1.15, 0.6, 0.45);
      g.add(fender);
    }
  }
  g.position.set(x, x * SLOPE, z);
  g.rotation.z = Math.atan(SLOPE);
  scene.add(g);
  return { type: 'box', x, z, hx: 2.5, hz: 0.9, y0: x * SLOPE, y1: x * SLOPE + 1.5 };
}

// The city at the bottom of the hill, in the haze.
function city(scene, xEnd, r) {
  const mats = ['#c9c3b8', '#d8d2c6', '#b8b4ad', '#e2ddd2'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));
  for (let i = 0; i < 70; i++) {
    const w = 6 + r() * 12;
    const h = 10 + r() * (r() < 0.2 ? 90 : 35);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mats[i % mats.length]);
    m.position.set(xEnd - 20 - r() * 160, xEnd * SLOPE - 25 + h / 2, (r() - 0.5) * 260);
    scene.add(m);
  }
}

function sky(scene, renderer) {
  const geo = new THREE.SphereGeometry(400, 32, 16);
  const col = [];
  const top = new THREE.Color('#3f8fe0');
  const hor = new THREE.Color('#cfe6f5');
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = Math.max(0, p.getY(i) / 400);
    const c = hor.clone().lerp(top, Math.pow(k, 0.6));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  scene.add(dome);
  // Reflections: the same sky, a warm street below and the sun.
  const env = new THREE.Scene();
  env.add(dome.clone());
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), new THREE.MeshBasicMaterial({ color: '#8a8478' }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2;
  env.add(floor);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(18, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(40, 38, 32) }));
  sun.position.set(-150, 220, 160);
  env.add(sun);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.02).texture;
  pm.dispose();
  return { dome, env: tex };
}

// ---------- things on the sidewalk ----------

function props(scene) {
  const obstacles = [];
  const add = (m, o) => {
    scene.add(m);
    obstacles.push(o);
  };
  const red = new THREE.MeshPhysicalMaterial({ color: '#c8202a', roughness: 0.35, clearcoat: 0.6 });
  const gray = new THREE.MeshStandardMaterial({ color: '#8a8d8f', roughness: 0.5, metalness: 0.6 });
  const yellow = new THREE.MeshStandardMaterial({ color: '#e8c21a', roughness: 0.5 });
  const placeAt = (x, z) => ground(x, z);
  // A mailbox on a post and two trash cans, mid hill.
  const mx = -45.5;
  const mz = -6.3;
  const my = placeAt(mx, mz);
  const post = mesh(new THREE.BoxGeometry(0.1, 1.0, 0.1), gray);
  post.position.set(mx, my + 0.5, mz);
  scene.add(post);
  const boxM = mesh(new THREE.BoxGeometry(0.5, 0.4, 0.32), red);
  boxM.position.set(mx, my + 1.2, mz);
  add(boxM, { type: 'box', x: mx, z: mz, hx: 0.25, hz: 0.16, y0: my + 1.0, y1: my + 1.4 });
  for (const [cx, cz] of [[-44.6, -6.6], [-44.0, -6.2]]) {
    const y = placeAt(cx, cz);
    const can = mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.95, 24, 1, true), gray);
    can.position.set(cx, y + 0.475, cz);
    const lid = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 24), gray);
    lid.position.set(cx, y + 0.97, cz);
    scene.add(can);
    add(lid, { type: 'cyl', x: cx, z: cz, r: 0.33, y0: y, y1: y + 1.0 });
  }
  // A fire hydrant near the close shot.
  const hx = -79;
  const hz = -5.7;
  const hy = placeAt(hx, hz);
  const prof = [[0.0, 0], [0.16, 0], [0.16, 0.06], [0.12, 0.08], [0.12, 0.5], [0.15, 0.52], [0.15, 0.56], [0.1, 0.62], [0.04, 0.7], [0, 0.7]];
  const hyd = mesh(new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 24), yellow);
  hyd.position.set(hx, hy, hz);
  add(hyd, { type: 'cyl', x: hx, z: hz, r: 0.15, y0: hy, y1: hy + 0.7 });
  return obstacles;
}

// ---------- balls ----------

// Simulates the stream through one shot. Balls start spread up and down
// the street, fall and bounce downhill, and those that leave are thrown
// back in at the top, so the flow stays full. Returns positions and
// velocities for every frame of the shot.
function simulate({ x0, up, down, n, seed, frames, fps, slowmo, warm, obstacles }) {
  const r = rng(seed);
  const P = new Float32Array(n * 3);
  const V = new Float32Array(n * 3);
  const R = new Float32Array(n);
  const spawn = (i, anywhere) => {
    const x = anywhere ? x0 - down + r() * (up + down) : x0 + up * (0.6 + r() * 0.4);
    const z = (r() * 2 - 1) * (WALK - 0.3);
    P[i * 3] = x;
    P[i * 3 + 1] = ground(x, z) + 0.3 + r() * (anywhere ? 2.5 : 4);
    P[i * 3 + 2] = z;
    V[i * 3] = -(3 + r() * 5);
    V[i * 3 + 1] = (r() - 0.3) * 3;
    V[i * 3 + 2] = (r() - 0.5) * 2;
  };
  for (let i = 0; i < n; i++) {
    R[i] = 0.024 + r() * 0.018;
    spawn(i, true);
  }
  const L = Math.sqrt(1 + SLOPE * SLOPE);
  const nx = -SLOPE / L;
  const ny = 1 / L;
  const dt = 1 / 240;
  const step = () => {
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      let vx = V[j];
      let vy = V[j + 1] - 9.81 * dt;
      let vz = V[j + 2];
      const sp = Math.hypot(vx, vy, vz);
      const drag = 1 - 0.035 * sp * dt;
      vx *= drag;
      vy *= drag;
      vz *= drag;
      let x = P[j] + vx * dt;
      let y = P[j + 1] + vy * dt;
      let z = P[j + 2] + vz * dt;
      const rad = R[i];
      // The hill (road or sidewalk), as a sloped plane.
      const h = ground(x, z);
      const d = (y - h) * ny;
      if (d < rad) {
        const pen = rad - d;
        x += nx * pen;
        y += ny * pen;
        const vn = vx * nx + vy * ny;
        if (vn < 0) {
          const e = 0.8;
          vx -= (1 + e) * vn * nx;
          vy -= (1 + e) * vn * ny;
          vx = vx * 0.97 + (r() - 0.5) * 0.8;
          vz = vz * 0.97 + (r() - 0.5) * 0.8;
        }
      }
      // The curbs, for balls low on the road.
      if (Math.abs(z) > ROAD - rad && Math.abs(z) < ROAD && y - x * SLOPE < CURB + rad * 0.3) {
        z = Math.sign(z) * (ROAD - rad);
        vz = -vz * 0.6;
      }
      // House fronts and stairs.
      if (Math.abs(z) > WALK - 0.4 - rad) {
        z = Math.sign(z) * (WALK - 0.4 - rad);
        vz = -vz * 0.6;
      }
      for (const o of obstacles) {
        if (y < o.y0 - rad || y > o.y1 + rad) continue;
        if (o.type === 'cyl') {
          const dx = x - o.x;
          const dz = z - o.z;
          const dd = Math.hypot(dx, dz);
          if (dd < o.r + rad) {
            if (y > o.y1 - 0.05 && vy < 0) {
              y = o.y1 + rad;
              vy = -vy * 0.75;
            } else {
              const ux = dx / dd;
              const uz = dz / dd;
              x = o.x + ux * (o.r + rad);
              z = o.z + uz * (o.r + rad);
              const vn = vx * ux + vz * uz;
              if (vn < 0) {
                vx -= 1.7 * vn * ux;
                vz -= 1.7 * vn * uz;
              }
            }
          }
        } else if (Math.abs(x - o.x) < o.hx + rad && Math.abs(z - o.z) < o.hz + rad) {
          if (y > o.y1 - 0.05 && vy < 0) {
            y = o.y1 + rad;
            vy = -vy * 0.75;
          } else if (Math.abs(x - o.x) - o.hx > Math.abs(z - o.z) - o.hz) {
            x = o.x + Math.sign(x - o.x) * (o.hx + rad);
            vx = -vx * 0.7;
          } else {
            z = o.z + Math.sign(z - o.z) * (o.hz + rad);
            vz = -vz * 0.7;
          }
        }
      }
      P[j] = x;
      P[j + 1] = y;
      P[j + 2] = z;
      V[j] = vx;
      V[j + 1] = vy;
      V[j + 2] = vz;
      if (x < x0 - down || y < ground(x, z) - 1) spawn(i, false);
    }
  };
  for (let k = 0; k < warm * 240; k++) step();
  const per = (slowmo / fps) * 240; // physics steps per frame
  const out = [];
  let acc = 0;
  for (let f = 0; f < frames; f++) {
    out.push({ P: P.slice(), V: V.slice() });
    acc += per;
    while (acc >= 1) {
      step();
      acc -= 1;
    }
  }
  return { frames: out, R };
}

// ---------- post ----------

const POST_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor, tDepth, tText, tName;
uniform vec2 res;
uniform float focus, blur, near, far, textA, nameA, seed;
float lin(float d) { float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
float coc(vec2 uv) { float z = lin(texture2D(tDepth, uv).r); return min(blur * abs(1.0 - focus / z), blur); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed) * 43758.5453); }
void main() {
  float c0 = coc(vUv);
  vec3 sum = texture2D(tColor, vUv).rgb;
  float wsum = 1.0;
  if (c0 > 0.6) {
    float spin = hash(vUv * res + 3.0) * 6.2832;
    for (int i = 0; i < 24; i++) {
      float fi = float(i) + 0.5;
      float r = sqrt(fi / 24.0) * c0;
      float a = fi * 2.39996 + spin;
      vec2 uv = vUv + vec2(cos(a), sin(a)) * r / res;
      float w = smoothstep(r - 1.0, r + 1.0, coc(uv));
      sum += texture2D(tColor, uv).rgb * w;
      wsum += w;
    }
  }
  vec3 col = aces(sum / wsum * 1.05);
  // Sunny film look: rich color, warm highlights, gentle vignette.
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, 1.12);
  col *= vec3(1.03, 1.0, 0.96);
  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q, q) * 0.5;
  col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));
  col += (hash(vUv * res) - 0.5) * 0.02;
  vec4 t = texture2D(tText, vUv);
  col = mix(col, t.rgb, t.a * textA);
  vec4 nm = texture2D(tName, vUv);
  col = mix(col, nm.rgb, nm.a * nameA);
  gl_FragColor = vec4(col, 1.0);
}`;

// ---------- film ----------

async function loadImage(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

async function load() {
  const brief = await (await fetch(briefUrl)).json();
  const p = plan(brief);
  await document.fonts.load('300 40px Inter');
  await document.fonts.load('600 40px Inter');
  const product = brief.product ?? {};
  const productImg = product.image ? await loadImage(new URL(product.image, briefUrl)) : null;
  const logoImg = product.logo ? await loadImage(new URL(product.logo, briefUrl)) : null;
  const name = String(product.name ?? 'Product');
  const palette = (brief.palette?.length ? brief.palette : PALETTE).map((c) => new THREE.Color(c));

  const cv = document.getElementById('film');
  cv.width = p.width;
  cv.height = p.height;
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(p.width, p.height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#cfe2ee', 60, 260);
  const { env } = sky(scene, renderer);
  scene.environment = env;
  scene.environmentIntensity = 0.7;
  const r = rng(77);
  street(scene, -170, 70);
  houses(scene, -150, 60, r);
  city(scene, -170, r);
  const obstacles = props(scene);
  nearSide(scene);
  obstacles.push(pickup(scene, -3, -3.9));
  scene.add(new THREE.HemisphereLight('#cfe6ff', '#8a7a66', 0.7));
  const sun = new THREE.DirectionalLight('#fff1dc', 3.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 2;
  scene.add(sun, sun.target);

  // The product, standing on the far sidewalk for the last shot.
  const px = -95;
  const pz = -5.6;
  const pSize = product.size ?? 0.9;
  if (productImg) {
    const tex = new THREE.Texture(productImg);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    const ratio = productImg.naturalWidth / productImg.naturalHeight;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(pSize * ratio, pSize), new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, color: new THREE.Color(1.1, 1.1, 1.1) }));
    plane.position.set(px, ground(px, pz) + pSize / 2, pz);
    plane.castShadow = true;
    plane.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
    scene.add(plane);
    obstacles.push({ type: 'box', x: px, z: pz, hx: (pSize * ratio) / 2, hz: 0.12, y0: ground(px, pz), y1: ground(px, pz) + pSize });
  }

  // Balls: one instanced mesh, stretched along their motion like a film
  // shutter would.
  const MAX = 9000;
  const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshPhysicalMaterial({ roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.3 }), MAX);
  balls.castShadow = true;
  balls.receiveShadow = true;
  balls.frustumCulled = false;
  const cr = rng(3);
  for (let i = 0; i < MAX; i++) balls.setColorAt(i, palette[Math.floor(cr() * palette.length)]);
  scene.add(balls);

  // Cameras: where each kind of shot looks from, and what it looks at.
  const at = (x, z, h) => new THREE.Vector3(x, ground(x, z) + h, z);
  const SHOTS = {
    wide: { x0: 0, pos: at(1.5, 0, 2.2).setZ(23), look: at(0, -6, 3.4), hfov: 58, drift: -1.8, sim: { up: 22, down: 22, n: 9000 }, focus: null },
    low: { x0: -25, pos: at(-28, 1.2, 0.22), look: at(-16, -0.5, 0.9), hfov: 62, drift: 0.4, sim: { up: 14, down: 6, n: 7000 }, focus: 3.2 },
    detail: { x0: -45, pos: at(-43.6, -1.2, 1.0), look: at(-45, -6.3, 0.9), hfov: 46, drift: -0.3, sim: { up: 10, down: 5, n: 6000 }, focus: 5.3 },
    downhill: { x0: -62, pos: at(-40, 1.5, 3.2), look: at(-110, -0.5, 0.5), hfov: 52, drift: -1.0, sim: { up: 12, down: 60, n: 9000 }, focus: null },
    close: { x0: -79, pos: at(-79.5, 1.8, 0.55), look: at(-79, -3, 0.5), hfov: 30, drift: -0.15, sim: { up: 8, down: 4, n: 6000 }, focus: 4.2 },
    product: { x0: -95, pos: at(-93.6, -1.5, 1.0), look: at(-95, pz, pSize * 0.5), hfov: 40, drift: -0.2, sim: { up: 10, down: 5, n: 4000 }, focus: null },
  };
  SHOTS.product.focus = SHOTS.product.pos.distanceTo(SHOTS.product.look);

  // Text for the last shot: the tagline, then the name.
  const textCanvas = (draw) => {
    const [c, g] = canvas(p.width, p.height);
    draw(g, p.width, p.height);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    return t;
  };
  const unit = Math.min(p.width, p.height * 1.4) / 1920;
  const tagline = String(brief.end?.tagline ?? '');
  const tagTex = textCanvas((g, w, h) => {
    g.fillStyle = '#ffffff';
    g.shadowColor = 'rgba(0,0,0,0.35)';
    g.shadowBlur = 24 * unit;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = 92 * unit * (p.height > p.width ? 1.25 : 1);
    g.font = `300 ${size}px Inter`;
    while (g.measureText(tagline).width > w * 0.86) g.font = `300 ${(size *= 0.94)}px Inter`;
    g.fillText(tagline, w / 2, h * 0.8);
  });
  const nameTex = textCanvas((g, w, h) => {
    g.fillStyle = '#ffffff';
    g.shadowColor = 'rgba(0,0,0,0.35)';
    g.shadowBlur = 18 * unit;
    const m = 60 * unit;
    if (logoImg) {
      const lh = 64 * unit;
      const lw = (lh * logoImg.naturalWidth) / logoImg.naturalHeight;
      g.drawImage(logoImg, w - m - lw, m, lw, lh);
    } else {
      g.font = `600 ${44 * unit}px Inter`;
      g.letterSpacing = `${10 * unit}px`;
      g.textAlign = 'right';
      g.textBaseline = 'top';
      g.fillText(name.toUpperCase(), w - m, m);
    }
  });

  const rt = new THREE.WebGLRenderTarget(p.width, p.height, { type: THREE.HalfFloatType, samples: 4, depthTexture: new THREE.DepthTexture(p.width, p.height) });
  const camera = new THREE.PerspectiveCamera(40, p.width / p.height, 0.05, 600);
  const post = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: POST_FRAG,
    uniforms: {
      tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, tText: { value: tagTex }, tName: { value: nameTex },
      res: { value: new THREE.Vector2(p.width, p.height) }, focus: { value: 10 }, blur: { value: 0 },
      near: { value: camera.near }, far: { value: camera.far }, textA: { value: 0 }, nameA: { value: 0 }, seed: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post);
  quad.frustumCulled = false;
  const postScene = new THREE.Scene();
  postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const cache = new Map();
  const shotSim = (shot) => {
    if (!cache.has(shot.index)) {
      cache.clear();
      const S = SHOTS[shot.kind];
      cache.set(shot.index, simulate({
        x0: S.x0, ...S.sim, seed: shot.seed, frames: Math.ceil(shot.d * p.fps) + 2, fps: p.fps,
        slowmo: p.slowmo, warm: 3.5, obstacles,
      }));
    }
    return cache.get(shot.index);
  };

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const vdir = new THREE.Vector3();
  const X = new THREE.Vector3(1, 0, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const aspect = p.width / p.height;

  function render(t) {
    const shot = p.shots.find((s) => t >= s.t && t < s.t + s.d) ?? p.shots[p.shots.length - 1];
    const S = SHOTS[shot.kind];
    const k = Math.min(1, (t - shot.t) / shot.d);
    const sim = shotSim(shot);
    const fi = Math.min(sim.frames.length - 1, Math.round((t - shot.t) * p.fps));
    const { P, V } = sim.frames[fi];
    const n = S.sim.n;
    const shutter = (p.slowmo / p.fps) * 0.18;
    for (let i = 0; i < MAX; i++) {
      if (i >= n) {
        m4.makeScale(0, 0, 0);
        balls.setMatrixAt(i, m4);
        continue;
      }
      const j = i * 3;
      const rad = sim.R[i];
      vdir.set(V[j], V[j + 1], V[j + 2]);
      const sp = vdir.length();
      q.setFromUnitVectors(X, sp > 1e-4 ? vdir.divideScalar(sp) : X);
      pos.set(P[j], P[j + 1], P[j + 2]);
      scl.set(rad + sp * shutter, rad, rad);
      m4.compose(pos, q, scl);
      balls.setMatrixAt(i, m4);
    }
    balls.instanceMatrix.needsUpdate = true;

    // Camera, drifting a little through the shot.
    const hf = (S.hfov * Math.PI) / 180;
    const vf = Math.min(75, (2 * Math.atan(Math.tan(hf / 2) / aspect) * 180) / Math.PI);
    camera.fov = vf;
    camera.updateProjectionMatrix();
    const dx = S.drift * k;
    camera.position.set(S.pos.x + dx, S.pos.y + dx * SLOPE, S.pos.z);
    camera.lookAt(S.look.x + dx, S.look.y + dx * SLOPE, S.look.z);
    const target = S.look.clone();
    sun.target.position.copy(target);
    sun.position.copy(target).add(new THREE.Vector3(18, 30, 22));
    const span = Math.max(8, S.pos.distanceTo(S.look) * 1.6);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -span;
    sun.shadow.camera.right = sun.shadow.camera.top = span;
    sun.shadow.camera.far = 120;
    sun.shadow.camera.updateProjectionMatrix();

    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    const u = post.uniforms;
    u.focus.value = S.focus ?? S.pos.distanceTo(S.look);
    u.blur.value = (S.focus ? Math.min(26, 60 / S.focus) : 3) * (p.height / 1080);
    u.seed.value = (Math.floor(t * p.fps) % 97) * 0.37;
    u.textA.value = Math.min(1, Math.max(0, (t - p.taglineAt) / 0.8));
    u.nameA.value = Math.min(1, Math.max(0, (t - p.nameAt) / 0.8));
    renderer.render(postScene, postCam);
  }

  Object.assign(window.film, {
    width: p.width, height: p.height, fps: p.fps, duration: p.length,
    keyTimes: p.keyTimes, canvas: cv, render, format: 'image/jpeg',
  });
  render(0);
}

window.film = { ready: load() };
