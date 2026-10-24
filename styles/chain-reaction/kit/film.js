// The chain-reaction film: one unbroken tracking shot along a wooden floor
// in a white paneled room, where machined parts set each other off and the
// last one rolls the product into place under a hanging banner. Then white,
// and the name.
//
// URL parameters: brief=<url of brief.json>. Files named in the brief are
// resolved relative to the brief.
import * as THREE from 'three';
import { plan } from './machine.mjs';
import * as P from './parts.js';

const params = new URLSearchParams(location.search);
if (!params.has('brief')) throw new Error('Open this page with ?brief=<url of brief.json>');
const briefUrl = new URL(params.get('brief'), location.href);

const WALL_Z = -1.25;
const VFOV = { '16:9': 24, '1:1': 30, '4:5': 33, '9:16': 40 };

// ---------- textures ----------

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Oak floorboards running along x: 4 m by 2 m per tile.
function floorTexture() {
  const W = 4096;
  const H = 2048;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const r = rng(21);
  const rows = 16; // 12.5 cm boards
  const bh = H / rows;
  for (let row = 0; row < rows; row++) {
    let x = -r() * 1200;
    while (x < W) {
      const len = 900 + r() * 1400;
      const tone = r();
      const base = [62 + tone * 34, 42 + tone * 22, 31 + tone * 13];
      g.fillStyle = `rgb(${base.map(Math.round)})`;
      g.fillRect(x, row * bh, len, bh);
      // Grain: long wavy streaks.
      for (let i = 0; i < 60; i++) {
        const y = row * bh + r() * bh;
        const a = 0.04 + r() * 0.1;
        g.strokeStyle = r() < 0.5 ? `rgba(60,38,26,${a})` : `rgba(190,150,115,${a * 0.8})`;
        g.lineWidth = 0.8 + r() * 3;
        g.beginPath();
        const ph = r() * 10;
        for (let xx = x; xx <= x + len; xx += 40) {
          const yy = y + Math.sin(xx / (180 + r() * 60) + ph) * 2.2;
          xx === x ? g.moveTo(xx, yy) : g.lineTo(xx, yy);
        }
        g.stroke();
      }
      // An occasional knot.
      if (r() < 0.25) {
        const kx = x + r() * len;
        const ky = row * bh + bh * (0.25 + r() * 0.5);
        const grad = g.createRadialGradient(kx, ky, 0, kx, ky, 18);
        grad.addColorStop(0, 'rgba(50,30,20,0.5)');
        grad.addColorStop(1, 'rgba(50,30,20,0)');
        g.fillStyle = grad;
        g.fillRect(kx - 30, ky - 20, 60, 40);
      }
      g.fillStyle = 'rgba(30,18,12,0.7)';
      g.fillRect(x, row * bh, 3, bh); // end joint
      x += len;
    }
    g.fillStyle = 'rgba(30,18,12,0.75)';
    g.fillRect(0, row * bh, W, 3); // long joint
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 16;
  return t;
}

function textCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

async function loadImage(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

// ---------- the room ----------

function room(scene, x0, x1) {
  const floorTex = floorTexture();
  floorTex.repeat.set(1 / 4, 1 / 2);
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.38, metalness: 0, envMapIntensity: 0.28 });
  const floorGeo = new THREE.PlaneGeometry(x1 - x0, 8);
  floorGeo.rotateX(-Math.PI / 2);
  floorGeo.translate((x0 + x1) / 2, 0, WALL_Z + 4);
  // World-space UVs so the boards keep their scale.
  const pos = floorGeo.attributes.position;
  const uv = floorGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), -pos.getZ(i));
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  scene.add(floor);

  const paint = new THREE.MeshStandardMaterial({ color: '#d3d8c8', roughness: 0.85, envMapIntensity: 0.6 });
  const trim = new THREE.MeshStandardMaterial({ color: '#e3e6da', roughness: 0.55, envMapIntensity: 0.6 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 4), paint);
  wall.position.set((x0 + x1) / 2, 2, WALL_Z);
  wall.receiveShadow = true;
  scene.add(wall);

  // Wainscoting: baseboard, chair rail and panel moldings, as instanced
  // boxes.
  const boxes = [];
  const box = (cx, cy, cz, w, h, d) => boxes.push([cx, cy, cz, w, h, d]);
  const len = x1 - x0;
  box(x0 + len / 2, 0.08, WALL_Z + 0.012, len, 0.16, 0.024);
  box(x0 + len / 2, 0.165, WALL_Z + 0.018, len, 0.014, 0.036);
  box(x0 + len / 2, 0.92, WALL_Z + 0.016, len, 0.05, 0.032);
  box(x0 + len / 2, 0.95, WALL_Z + 0.024, len, 0.014, 0.048);
  const panelW = 1.05;
  const gap = 0.16;
  const strip = 0.03;
  const panel = (px, y0, y1) => {
    const z = WALL_Z + 0.01;
    box(px + panelW / 2, y0, z, panelW, strip, 0.02);
    box(px + panelW / 2, y1, z, panelW, strip, 0.02);
    box(px, (y0 + y1) / 2, z, strip, y1 - y0, 0.02);
    box(px + panelW, (y0 + y1) / 2, z, strip, y1 - y0, 0.02);
  };
  const pilasters = [];
  for (let px = Math.floor(x0 / 6) * 6; px < x1; px += 6) pilasters.push(px);
  for (let px = x0; px < x1; px += panelW + gap) {
    if (pilasters.some((q) => px + panelW > q - 0.3 && px < q + 0.3)) continue;
    panel(px, 0.3, 0.8);
    panel(px, 1.1, 2.4);
  }
  for (const q of pilasters) {
    box(q, 2, WALL_Z + 0.06, 0.42, 4, 0.12);
    box(q, 0.08, WALL_Z + 0.07, 0.46, 0.16, 0.14);
    box(q, 0.92, WALL_Z + 0.075, 0.46, 0.05, 0.15);
  }
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const inst = new THREE.InstancedMesh(geo, trim, boxes.length);
  const mat = new THREE.Matrix4();
  boxes.forEach(([cx, cy, cz, w, h, d], i) => {
    mat.makeScale(w, h, d).setPosition(cx, cy, cz);
    inst.setMatrixAt(i, mat);
  });
  inst.castShadow = true;
  inst.receiveShadow = true;
  scene.add(inst);
}

// A soft room for reflections: white walls, a bright ceiling and a warm
// floor.
function environment(renderer) {
  const env = new THREE.Scene();
  const roomBox = new THREE.Mesh(
    new THREE.BoxGeometry(10, 5, 10),
    new THREE.MeshBasicMaterial({ color: '#e4e6dc', side: THREE.BackSide }),
  );
  // The probe sits half a meter above the floor.
  roomBox.position.y = 2.0;
  env.add(roomBox);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshBasicMaterial({ color: '#4a3326' }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.49;
  env.add(floor);
  const light = (w, h, x, y, z, rx, v) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(v, v, v * 0.96) }));
    m.position.set(x, y, z);
    m.rotation.x = rx;
    env.add(m);
  };
  light(7, 4, 0, 4.4, 0, Math.PI / 2, 4.5);
  light(5, 2.4, -2, 1.8, 4.9, Math.PI, 3.2);
  light(3, 1.4, 3, 1.6, -4.9, 0, 2.2);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.035).texture;
  pm.dispose();
  return tex;
}

// ---------- parts ----------

const ROLLERS = new Set(['gear', 'bearing', 'ball', 'wheel', 'muffler', 'disc', 'cart', 'plate']);

function build(M, part, assets) {
  const o = part.opts;
  switch (part.kind) {
    case 'gear': return P.gear(M, o);
    case 'bearing': return P.bearing(M, o);
    case 'ball': return P.ball(M, o);
    case 'wheel': return P.wheel(M, o);
    case 'plate': return P.plate(M, o);
    case 'disc': return P.disc(M, o);
    case 'spring': return P.spring(M, o);
    case 'nut': return P.nut(M, o);
    case 'valve': return P.valve(M, o);
    case 'board': return P.board(M, o);
    case 'block': return P.block(M, o);
    case 'wedge': return P.wedge(M, o);
    case 'pivot': return P.pivot(M, o);
    case 'panel': return P.panel(M, o);
    case 'stand': return P.stand(M, o);
    case 'cart': return P.cart(M, o);
    case 'lever': return P.bar(M, { ...o, down: true });
    case 'arm': return P.bar(M, o);
    case 'muffler': {
      const g = new THREE.Group();
      const m = P.muffler(M, o);
      m.rotation.y = Math.PI / 2;
      g.add(m);
      return g;
    }
    case 'cord': {
      const g = new THREE.Group();
      const c = P.rod(M, { r: 0.0016, len: o.len, axis: 'y', mat: 'cord' });
      c.position.y = -o.len / 2;
      g.add(c);
      return g;
    }
    case 'product': return assets.product(o);
    case 'banner': return assets.banner(o);
    default: throw new Error(`unknown part ${part.kind}`);
  }
}

// ---------- post: depth of field, tone and grade, white and end card ----------

const POST_VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const POST_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tCard;
uniform vec2 res;
uniform float focus, blur, near, far, exposure, white, card, seed;
float lin(float d) { float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
float coc(vec2 uv) { float z = lin(texture2D(tDepth, uv).r); return min(blur * abs(1.0 - focus / z), blur); }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed) * 43758.5453); }
void main() {
  float c0 = coc(vUv);
  vec3 sum = texture2D(tColor, vUv).rgb;
  float wsum = 1.0;
  if (c0 > 0.6) {
    float spin = hash(vUv * res + 7.0) * 6.2832;
    for (int i = 0; i < 24; i++) {
      float fi = float(i) + 0.5;
      float r = sqrt(fi / 24.0) * c0;
      float a = fi * 2.39996 + spin;
      vec2 o = vec2(cos(a), sin(a)) * r;
      vec2 uv = vUv + o / res;
      float cs = coc(uv);
      float w = smoothstep(r - 1.0, r + 1.0, cs);
      sum += texture2D(tColor, uv).rgb * w;
      wsum += w;
    }
  }
  vec3 col = sum / wsum * exposure;
  col = aces(col);
  // Grade: a little faded and cool-green in the whites, warm in the mids.
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, 0.8);
  col = col * vec3(0.96, 1.0, 0.9) + vec3(0.006, 0.01, 0.006) * (1.0 - l);
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.35);
  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q, q) * 0.8;
  col = pow(col, vec3(1.0 / 2.2));
  col += (hash(vUv * res) - 0.5) * 0.022;
  col = mix(col, vec3(1.0), white);
  vec4 cardCol = texture2D(tCard, vUv);
  col = mix(col, cardCol.rgb, cardCol.a * card);
  gl_FragColor = vec4(col, 1.0);
}`;

// ---------- film ----------

async function load() {
  const brief = await (await fetch(briefUrl)).json();
  const product = brief.product ?? {};
  const productImg = product.image ? await loadImage(new URL(product.image, briefUrl)) : null;
  const logoImg = product.logo ? await loadImage(new URL(product.logo, briefUrl)) : null;
  const shown = productImg ?? logoImg;
  if (shown) product.ratio = shown.naturalWidth / shown.naturalHeight;
  const p = plan({ ...brief, product });
  await document.fonts.load('400 40px Inter');
  await document.fonts.load('600 40px Inter');

  const canvas = document.getElementById('film');
  canvas.width = p.width;
  canvas.height = p.height;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(p.width, p.height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d8dbd0');
  scene.environment = environment(renderer);
  scene.environmentIntensity = 1.1;
  const xs = p.parts.map((q) => q.track.rest.x);
  room(scene, Math.min(...xs) - 6, p.stopX + 8);

  const hemi = new THREE.HemisphereLight('#f3f2ea', '#5a3e2e', 0.4);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4e6', 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.002;
  scene.add(sun, sun.target);

  const M = P.materials(brief.accent ?? '#c8261e');
  const name = String(product.name ?? 'Product');
  const assets = {
    product(o) {
      const g = new THREE.Group();
      const src = shown ?? textCanvas(800, 800, (x, w, h) => {
        x.fillStyle = '#1b1b1b';
        x.font = '600 120px Inter';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText(name, w / 2, h / 2);
      });
      const tex = new THREE.Texture(src);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      tex.anisotropy = 8;
      const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, color: new THREE.Color(1.25, 1.25, 1.25) });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), mat);
      plane.position.y = o.h / 2;
      plane.castShadow = true;
      plane.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
      const foot = P.contactShadow(1, 0.7);
      foot.scale.set(o.w * 1.15, o.w * 0.5, 1);
      foot.position.set(0, 0.001, 0.01);
      g.add(plane, foot);
      return g;
    },
    banner(o) {
      const g = new THREE.Group();
      const tex = new THREE.CanvasTexture(textCanvas(1024, Math.round((1024 * o.h) / o.w), (x, w, h) => {
        x.fillStyle = '#121212';
        x.fillRect(0, 0, w, h);
        x.fillStyle = '#f2f2ee';
        const label = name.toUpperCase();
        let size = h * 0.24;
        x.font = `400 ${size}px Inter`;
        x.letterSpacing = `${size * 0.32}px`;
        while (x.measureText(label).width > w * 0.78 && size > 10) {
          size *= 0.92;
          x.font = `400 ${size}px Inter`;
          x.letterSpacing = `${size * 0.32}px`;
        }
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText(label, w / 2 + size * 0.16, h * (logoImg ? 0.42 : 0.5));
        if (logoImg) {
          const lh = h * 0.16;
          const lw = (lh * logoImg.naturalWidth) / logoImg.naturalHeight;
          x.globalAlpha = 0.9;
          x.drawImage(logoImg, w / 2 - lw / 2, h * 0.64, lw, lh);
        }
      }));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h, 24, 4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, side: THREE.DoubleSide }));
      // A gentle sag between the two hanging points.
      const pos = cloth.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(((pos.getX(i) / o.w) + 0.5) * Math.PI) * 0.012);
      cloth.geometry.computeVertexNormals();
      cloth.castShadow = true;
      const rodM = P.rod(M, { r: 0.006, len: o.w + 0.04, axis: 'x', mat: 'dark' });
      rodM.position.y = o.h / 2 + 0.006;
      g.add(cloth, rodM);
      for (const sx of [-0.45, 0.45]) {
        const wire = P.rod(M, { r: 0.0009, len: 3, axis: 'y', mat: 'cord' });
        wire.position.set(sx * o.w, o.h / 2 + 1.5, 0);
        g.add(wire);
      }
      return g;
    },
  };

  const objects = p.parts.map((part) => {
    const obj = build(M, part, assets);
    scene.add(obj);
    let shadow = null;
    if (ROLLERS.has(part.kind)) {
      const size = { wheel: 0.75, cart: 0.7, muffler: 0.3, disc: 0.24, plate: 0.12 }[part.kind] ?? (part.opts.r ?? (part.opts.module ? part.opts.module * part.opts.teeth / 2 : 0.05)) * 2.4;
      shadow = P.contactShadow(size, 0.55);
      if (part.kind === 'cart') shadow.scale.set(part.opts.w * 1.3, part.opts.depth * 1.5, 1);
      if (part.kind === 'muffler') shadow.scale.set(0.2, 0.55, 1);
      scene.add(shadow);
    }
    return { part, obj, shadow };
  });

  // Render targets for the post pass.
  const rt = new THREE.WebGLRenderTarget(p.width, p.height, {
    type: THREE.HalfFloatType, samples: 4,
    depthTexture: new THREE.DepthTexture(p.width, p.height),
  });
  const camera = new THREE.PerspectiveCamera(VFOV[p.aspect] ?? 24, p.width / p.height, 0.02, 40);
  const cardTex = new THREE.CanvasTexture(endCard(p, name, brief.end?.tagline ?? '', logoImg));
  cardTex.colorSpace = THREE.NoColorSpace;
  const post = new THREE.ShaderMaterial({
    vertexShader: POST_VERT,
    fragmentShader: POST_FRAG,
    uniforms: {
      tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, tCard: { value: cardTex },
      res: { value: new THREE.Vector2(p.width, p.height) },
      focus: { value: 1 }, blur: { value: 8 }, near: { value: camera.near }, far: { value: camera.far },
      exposure: { value: 0.9 }, white: { value: 0 }, card: { value: 0 }, seed: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post);
  quad.frustumCulled = false;
  const postScene = new THREE.Scene();
  postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect);
  // Taller formats frame tighter, so parts keep their size on screen.
  const narrow = Math.min(1, Math.sqrt(p.width / p.height / (16 / 9)));
  const camAt = (t) => {
    const f = Math.min(p.camera.x.length - 1.001, Math.max(0, t * p.fps));
    const i = Math.floor(f);
    const k = f - i;
    const lerp = (a) => a[i] + (a[i + 1] - a[i]) * k;
    return { x: lerp(p.camera.x), y: lerp(p.camera.y), w: lerp(p.camera.w) * narrow };
  };

  function render(t) {
    for (const { part, obj, shadow } of objects) {
      const q = part.track.at(t);
      obj.position.set(q.x, q.y, q.z);
      obj.rotation.set(q.rx, q.ry, q.rz);
      if (shadow) {
        const lift = part.kind === 'cart' || part.kind === 'plate' ? 0 : Math.max(0, q.y - (part.opts.r ?? 0));
        shadow.position.set(q.x, 0.0008, q.z);
        shadow.material.opacity = Math.max(0, 1 - lift / 0.12);
      }
    }
    // The dolly: low, slightly behind the action, looking a touch ahead.
    const c = camAt(t);
    const dist = c.w / 2 / Math.tan(hfov / 2);
    // Look a little ahead while the dolly moves, dead center once it stops.
    const tx = c.x + Math.min(c.w * 0.1, Math.max(0, camAt(t + 0.8).x - c.x) * 0.25);
    const ty = Math.max(0.05, c.y);
    camera.position.set(tx - dist * 0.12, ty + dist * 0.11, dist);
    camera.lookAt(tx, ty, 0);
    sun.target.position.set(tx, 0, 0);
    sun.position.set(tx - 1.4, 4.4, 1.6);
    sun.shadow.camera.left = sun.shadow.camera.bottom = -Math.max(1.6, c.w * 1.1);
    sun.shadow.camera.right = sun.shadow.camera.top = Math.max(1.6, c.w * 1.1);
    sun.shadow.camera.updateProjectionMatrix();

    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    const u = post.uniforms;
    u.focus.value = Math.hypot(dist, dist * 0.11);
    u.blur.value = Math.min(30, Math.max(5, 15 / dist)) * (p.height / 1080);
    u.white.value = Math.min(1, Math.max(0, (t - p.whiteAt) / 0.8));
    u.card.value = Math.min(1, Math.max(0, (t - p.cardT - 0.2) / 0.6));
    u.seed.value = (Math.floor(t * p.fps) % 97) * 0.731;
    renderer.render(postScene, postCam);
  }

  Object.assign(window.film, {
    width: p.width, height: p.height, fps: p.fps, duration: p.length,
    keyTimes: p.keyTimes, canvas, render, format: 'image/jpeg',
  });
  render(0);
}

// The closing card: the name (or logo) and the tagline on white.
function endCard(p, name, tagline, logo) {
  return textCanvas(p.width, p.height, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    const unit = Math.min(w, h * 1.4) / 1920;
    let y = h * 0.47;
    if (logo) {
      const lh = 150 * unit * 1.4;
      const lw = Math.min(w * 0.6, (lh * logo.naturalWidth) / logo.naturalHeight);
      g.drawImage(logo, w / 2 - lw / 2, y - lh, lw, (lw * logo.naturalHeight) / logo.naturalWidth);
    } else {
      g.fillStyle = '#161616';
      g.font = `600 ${Math.round(96 * unit * 1.4)}px Inter`;
      g.letterSpacing = `${Math.round(18 * unit * 1.4)}px`;
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.fillText(name.toUpperCase(), w / 2, y);
    }
    if (tagline) {
      g.letterSpacing = '0px';
      g.fillStyle = '#6b6b6b';
      g.font = `400 ${Math.round(40 * unit * 1.4)}px Inter`;
      g.textAlign = 'center';
      g.fillText(tagline, w / 2, y + 90 * unit * 1.4);
    }
  });
}

window.film = { ready: load() };
