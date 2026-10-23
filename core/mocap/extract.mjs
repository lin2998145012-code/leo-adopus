// Extracts motion segments from the CMU Graphics Lab Motion Capture Database
// into a compact JSON file of joint positions that films can load.
//
// Usage: node core/mocap/extract.mjs <segments.json> <out.json>
//
// segments.json is an array of
//   { "id": "jump", "subject": "05", "trial": "05_17", "start": 3.2, "duration": 2.5 }
// Times are in seconds. One second of pre-roll before `start` is included so
// physics (hair, cloth, cables) can settle before a shot begins.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadClip } from './asf-amc.mjs';

const SOURCE_FPS = 120;
const OUT_FPS = 60;
const PREROLL = 1;
const CACHE = join(process.cwd(), '.cache', 'mocap');
const BASE = 'http://mocap.cs.cmu.edu/subjects';

export const JOINTS = [
  'root', 'lhipjoint', 'lfemur', 'ltibia', 'lfoot', 'ltoes',
  'rhipjoint', 'rfemur', 'rtibia', 'rfoot', 'rtoes',
  'lowerback', 'upperback', 'thorax', 'lowerneck', 'upperneck', 'head',
  'lclavicle', 'lhumerus', 'lradius', 'lwrist', 'lhand', 'lfingers', 'lthumb',
  'rclavicle', 'rhumerus', 'rradius', 'rwrist', 'rhand', 'rfingers', 'rthumb',
];

async function fetchCached(path) {
  const file = join(CACHE, path);
  if (!existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true });
    const res = await fetch(`${BASE}/${path}`);
    if (!res.ok) throw new Error(`Failed to download ${path}: ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return file;
}

async function main() {
  const [specPath, outPath] = process.argv.slice(2);
  if (!specPath || !outPath) {
    console.error('Usage: node core/mocap/extract.mjs <segments.json> <out.json>');
    process.exit(1);
  }
  const specs = JSON.parse(readFileSync(specPath, 'utf8'));
  const clips = new Map();
  const segments = {};
  for (const spec of specs) {
    const key = `${spec.subject}/${spec.trial}`;
    if (!clips.has(key)) {
      const asf = await fetchCached(`${spec.subject}/${spec.subject}.asf`);
      const amc = await fetchCached(`${spec.subject}/${spec.trial}.amc`);
      clips.set(key, loadClip(asf, amc));
    }
    const frames = clips.get(key);
    const fps = spec.sourceFps ?? SOURCE_FPS;
    const from = Math.max(0, Math.round((spec.start - PREROLL) * fps));
    const to = Math.min(
      frames.length - 1,
      Math.round((spec.start + spec.duration) * fps)
    );
    const step = fps / OUT_FPS;
    const out = [];
    for (let f = from; f <= to; f += step) {
      const pose = frames[Math.round(f)];
      // Millimeter integers keep the file small.
      out.push(JOINTS.flatMap((j) => pose.get(j).map((v) => Math.round(v * 1000))));
    }
    segments[spec.id] = {
      source: `CMU ${spec.trial}`,
      start: spec.start,
      preroll: (Math.round(spec.start * fps) - from) / fps,
      frames: out,
    };
  }
  writeFileSync(outPath, JSON.stringify({ fps: OUT_FPS, joints: JOINTS, segments }));
  console.log(`Wrote ${Object.keys(segments).length} segments to ${outPath}`);
}

main();
