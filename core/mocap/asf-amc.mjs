// Parser and forward kinematics for ASF/AMC motion capture files, the format
// used by the CMU Graphics Lab Motion Capture Database.
import { readFileSync } from 'node:fs';

const DEG = Math.PI / 180;
// ASF lengths are in units of 1/0.45 inch; convert to meters.
const UNIT_TO_M = (1 / 0.45) * 0.0254;

function rotX(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [1, 0, 0, 0, c, -s, 0, s, c];
}
function rotY(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}
function rotZ(a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}
function mul(a, b) {
  const r = new Array(9);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      r[i * 3 + j] =
        a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
}
function transpose(m) {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}
function apply(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}
// Euler angles in degrees, applied X then Y then Z (static axes).
function euler(x, y, z) {
  return mul(rotZ(z * DEG), mul(rotY(y * DEG), rotX(x * DEG)));
}

export function parseAsf(text) {
  const bones = new Map();
  const hierarchy = new Map();
  const lines = text.split(/\r?\n/);
  let section = '';
  let bone = null;
  let rootAxis = [0, 0, 0];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith(':')) {
      section = line.split(/\s+/)[0];
      continue;
    }
    const parts = line.split(/\s+/);
    if (section === ':root' && parts[0] === 'orientation') {
      rootAxis = parts.slice(1, 4).map(Number);
    } else if (section === ':bonedata') {
      if (parts[0] === 'begin') bone = { dof: [] };
      else if (parts[0] === 'end') bones.set(bone.name, bone);
      else if (parts[0] === 'name') bone.name = parts[1];
      else if (parts[0] === 'direction')
        bone.direction = parts.slice(1, 4).map(Number);
      else if (parts[0] === 'length') bone.length = Number(parts[1]) * UNIT_TO_M;
      else if (parts[0] === 'axis') {
        const C = euler(...parts.slice(1, 4).map(Number));
        bone.C = C;
        bone.Cinv = transpose(C);
      } else if (parts[0] === 'dof') bone.dof = parts.slice(1);
    } else if (section === ':hierarchy') {
      if (parts[0] === 'begin' || parts[0] === 'end') continue;
      hierarchy.set(parts[0], parts.slice(1));
    }
  }
  const C = euler(...rootAxis);
  bones.set('root', { name: 'root', C, Cinv: transpose(C), dof: [] });
  return { bones, hierarchy };
}

export function parseAmc(text) {
  const frames = [];
  let frame = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(':')) continue;
    if (/^\d+$/.test(line)) {
      frame = new Map();
      frames.push(frame);
      continue;
    }
    const parts = line.split(/\s+/);
    frame.set(parts[0], parts.slice(1).map(Number));
  }
  return frames;
}

// Returns a Map of joint name -> [x, y, z] in meters (Y up). Each bone's
// position is its end point; "root" is the pelvis origin.
export function solveFrame(skeleton, values) {
  const { bones, hierarchy } = skeleton;
  const out = new Map();
  const rootVals = values.get('root');
  const root = bones.get('root');
  const rootPos = rootVals.slice(0, 3).map((v) => v * UNIT_TO_M);
  const rootRot = mul(root.C, mul(euler(...rootVals.slice(3, 6)), root.Cinv));
  out.set('root', rootPos);
  const visit = (parentName, parentMatrix, parentPos) => {
    for (const childName of hierarchy.get(parentName) ?? []) {
      const b = bones.get(childName);
      const rot = [0, 0, 0];
      const vals = values.get(childName) ?? [];
      b.dof.forEach((d, i) => {
        rot['xyz'.indexOf(d[1])] = vals[i] ?? 0;
      });
      const matrix = mul(parentMatrix, mul(b.C, mul(euler(...rot), b.Cinv)));
      const offset = apply(matrix, b.direction).map((v) => v * b.length);
      const pos = parentPos.map((v, i) => v + offset[i]);
      out.set(childName, pos);
      visit(childName, matrix, pos);
    }
  };
  visit('root', rootRot, rootPos);
  return out;
}

export function loadClip(asfPath, amcPath) {
  const skeleton = parseAsf(readFileSync(asfPath, 'utf8'));
  const frames = parseAmc(readFileSync(amcPath, 'utf8'));
  return frames.map((f) => solveFrame(skeleton, f));
}
