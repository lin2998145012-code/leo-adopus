#!/usr/bin/env node
// adopus: make an ad for your product in the style of a legendary ad.
//
//   adopus doctor                         check Node, ffmpeg and Chrome
//   adopus styles                         list styles that can render
//   adopus new <dir> --style <slug> --name <product> [options]
//   adopus preview <dir> [--times 1,5,9] [--out sheet.png]
//   adopus render <dir> [--out ad.mp4]
//
// A film is a folder with a brief.json. Paths inside the brief are relative
// to that folder.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Browser, findChrome } from './chrome.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) args[key] = true;
      else args[key] = argv[++i];
    } else args._.push(a);
  }
  return args;
}

function fail(message) {
  console.error(`adopus: ${message}`);
  process.exit(1);
}

function styleKits() {
  const dir = join(ROOT, 'styles');
  return readdirSync(dir)
    .filter((d) => existsSync(join(dir, d, 'kit', 'index.html')))
    .map((slug) => {
      const style = readFileSync(join(dir, slug, 'STYLE.md'), 'utf8');
      const title = style.match(/^# (.+)$/m)?.[1] ?? slug;
      const inspired = style.match(/\*\*Inspired by:\*\* (.+)$/m)?.[1] ?? '';
      return { slug, title, inspired };
    });
}

function readBrief(dir) {
  const file = join(dir, 'brief.json');
  if (!existsSync(file)) fail(`no brief.json in ${dir}. Create one with \`adopus new\`.`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

// Serves the kits under /kit/ and the film folder under /film/.
function serve(filmDir) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const [base, rest] = path.startsWith('/film/') ? [filmDir, path.slice(6)] : path.startsWith('/kit/') ? [ROOT, path.slice(5)] : [null, ''];
    const file = base && resolve(base, rest);
    if (!file || !(file === base || file.startsWith(base + sep)) || !existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

function run(cmd, args, feed) {
  return new Promise((ok, no) => {
    const p = spawn(cmd, args, { stdio: [feed ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('error', no);
    p.on('close', (code) => (code === 0 ? ok() : no(new Error(`${cmd} failed:\n${err.slice(-2000)}`))));
    if (feed) feed(p.stdin);
  });
}

// Opens a film in headless Chrome and returns a frame grabber.
async function openFilm(dir) {
  const brief = readBrief(dir);
  const kit = join(ROOT, 'styles', brief.style ?? '', 'kit');
  if (!existsSync(join(kit, 'index.html'))) {
    fail(`style "${brief.style}" has no kit yet. Run \`adopus styles\` to see the ones that render.`);
  }
  const server = await serve(dir);
  const browser = await Browser.launch();
  const url = `http://127.0.0.1:${server.address().port}/kit/styles/${brief.style}/kit/index.html?brief=/film/brief.json`;
  const page = await browser.newPage(1920, 1080);
  await page.goto(url);
  await page.waitFor('!!(window.film && window.film.ready)');
  await page.evaluate('window.film.ready');
  const meta = await page.evaluate('({ width: film.width, height: film.height, fps: film.fps, duration: film.duration, keyTimes: film.keyTimes, format: film.format })');
  // Kits may ask for JPEG frames for video, which encode much faster than
  // PNG; stills stay PNG.
  const grab = async (t, format = 'image/png') => {
    const data = await page.evaluate(`(film.render(${t}), film.canvas.toDataURL('${format}', 0.95))`);
    return Buffer.from(data.split(',')[1], 'base64');
  };
  const close = async () => {
    await browser.close();
    server.close();
  };
  return { brief, kit, meta, grab, close };
}

async function preview(dir, args) {
  const film = await openFilm(dir);
  try {
    const times = args.times ? String(args.times).split(',').map(Number) : film.meta.keyTimes;
    const frames = join(dir, 'out', 'frames');
    await rm(frames, { recursive: true, force: true });
    await mkdir(frames, { recursive: true });
    for (const [i, t] of times.entries()) {
      await writeFile(join(frames, `f${String(i).padStart(3, '0')}.png`), await film.grab(t));
    }
    const out = resolve(args.out ?? join(dir, 'out', 'storyboard.png'));
    mkdirSync(dirname(out), { recursive: true });
    const cols = Number(args.cols ?? Math.min(4, times.length));
    const rows = Math.ceil(times.length / cols);
    const vertical = film.meta.height > film.meta.width;
    await run('ffmpeg', [
      '-y', '-loglevel', 'error', '-framerate', '1', '-i', join(frames, 'f%03d.png'),
      '-vf', `scale=${vertical ? 270 : 480}:-1,tile=${cols}x${rows}:padding=4:color=white`,
      '-frames:v', '1', out,
    ]);
    console.log(`Storyboard: ${out}`);
    console.log(`Frames at: ${times.join(', ')} s`);
  } finally {
    await film.close();
  }
}

async function render(dir, args) {
  const film = await openFilm(dir);
  try {
    const { meta, brief } = film;
    const outDir = join(dir, 'out');
    mkdirSync(outDir, { recursive: true });
    let audio = brief.music?.file ? resolve(dir, brief.music.file) : null;
    if (!audio) {
      const musicModule = join(film.kit, 'music.mjs');
      if (existsSync(musicModule)) {
        audio = join(outDir, 'music.wav');
        const { compose } = await import(pathToFileURL(musicModule));
        compose(brief, audio);
      }
    }
    const out = resolve(args.out ?? join(outDir, `${basename(resolve(dir))}.mp4`));
    mkdirSync(dirname(out), { recursive: true });
    const total = Math.round(meta.duration * meta.fps);
    const audioIn = audio ? ['-i', audio] : [];
    const audioOut = audio ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : [];
    await run('ffmpeg', [
      '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(meta.fps), '-i', '-',
      ...audioIn, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
      ...audioOut, '-movflags', '+faststart', out,
    ], async (stdin) => {
      for (let f = 0; f < total; f++) {
        const buf = await film.grab(f / meta.fps, meta.format);
        if (!stdin.write(buf)) await new Promise((ok) => stdin.once('drain', ok));
        if (f % meta.fps === 0) process.stdout.write(`\rRendering ${Math.round((f / total) * 100)}%`);
      }
      stdin.end();
    });
    console.log(`\rRendered ${relative(process.cwd(), out) || out}`);
  } finally {
    await film.close();
  }
}

// Writes a starter brief using the style kit's template.mjs, which turns
// command-line options into that style's brief.
async function newFilm(dir, args) {
  if (!dir) fail('usage: adopus new <dir> --style <slug> --name <product> [options]');
  const kits = styleKits().map((k) => k.slug);
  const style = args.style ?? kits[0];
  if (!kits.includes(style)) fail(`style "${style}" has no kit yet. Ready: ${kits.join(', ')}`);
  if (!args.name) fail('--name <product name> is required');
  if (existsSync(join(dir, 'brief.json')) && !args.force) fail(`${dir}/brief.json exists. Pass --force to replace it.`);
  mkdirSync(dir, { recursive: true });
  const copyIn = (file) => {
    if (!file) return undefined;
    if (!existsSync(file)) fail(`file not found: ${file}`);
    const name = basename(file);
    if (resolve(file) !== resolve(dir, name)) copyFileSync(file, join(dir, name));
    return name;
  };
  const { template, next } = await import(pathToFileURL(join(ROOT, 'styles', style, 'kit', 'template.mjs')));
  const brief = { style, ...template(args, copyIn) };
  writeFileSync(join(dir, 'brief.json'), `${JSON.stringify(brief, null, 2)}\n`);
  console.log(`Created ${join(dir, 'brief.json')}`);
  if (next) console.log(next);
  console.log(`Next: adopus preview ${dir}   then   adopus render ${dir}`);
}

async function doctor() {
  let ok = true;
  const check = (label, pass, hint) => {
    console.log(`${pass ? '✔' : '✘'} ${label}${pass ? '' : ` — ${hint}`}`);
    ok &&= pass;
  };
  const major = Number(process.versions.node.split('.')[0]);
  check(`Node ${process.versions.node}`, major >= 22, 'Node 22 or newer is required');
  const ff = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  check('ffmpeg', ff.status === 0, 'install ffmpeg (brew install ffmpeg, apt install ffmpeg, or ffmpeg.org)');
  const chrome = findChrome();
  check(`Chrome${chrome ? ` (${chrome})` : ''}`, !!chrome, 'install Google Chrome or set CHROME_PATH');
  if (chrome && major >= 22) {
    try {
      const browser = await Browser.launch();
      const page = await browser.newPage(64, 64);
      const gl = await page.evaluate("!!document.createElement('canvas').getContext('webgl2')");
      await browser.close();
      check('WebGL 2 in headless Chrome', gl, 'update Chrome; WebGL 2 is needed for the silhouette and 3D kits');
    } catch (e) {
      check('headless Chrome starts', false, e.message.split('\n')[0]);
    }
  }
  if (!ok) process.exit(1);
}

const [command, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);
const dir = args._[0] && resolve(args._[0]);
const commands = {
  doctor: () => doctor(),
  styles: () => {
    for (const k of styleKits()) console.log(`${k.slug.padEnd(22)} ${k.title} — inspired by ${k.inspired}`);
  },
  new: () => newFilm(dir, args),
  preview: () => preview(dir ?? fail('usage: adopus preview <dir>'), args),
  render: () => render(dir ?? fail('usage: adopus render <dir>'), args),
};
if (!commands[command]) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 9).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(command ? 1 : 0);
}
Promise.resolve(commands[command]()).catch((e) => fail(e.stack ?? e.message));
