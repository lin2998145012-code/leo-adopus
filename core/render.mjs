// Renders an HTML film to MP4, or renders selected frames to a contact sheet.
//
//   node core/render.mjs films/<name> [--out out/<name>.mp4] [--audio file.wav]
//   node core/render.mjs films/<name> --times 0.5,1,1.5 --sheet out/sheet.png
//   node core/render.mjs films/<name> --query "shots=..."   (passed to the page)
//
// A film is a folder with an index.html that sets `window.film` to
//   { width, height, fps, duration, ready: Promise, render(t), canvas }
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
};

function parseArgs(argv) {
  const args = { film: argv[0] };
  for (let i = 1; i < argv.length; i += 2) args[argv[i].replace(/^--/, '')] = argv[i + 1];
  return args;
}

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const bundled = chromium.executablePath();
  if (bundled && existsSync(bundled)) return bundled;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (base && existsSync(base)) {
    for (const dir of readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()) {
      for (const sub of ['chrome-linux64', 'chrome-linux']) {
        const p = join(base, dir, sub, 'chrome');
        if (existsSync(p)) return p;
      }
    }
  }
  throw new Error('Chromium not found. Set CHROME_PATH or run `npx playwright install chromium`.');
}

function serve() {
  const server = createServer((req, res) => {
    const path = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!path.startsWith(ROOT) || !existsSync(path)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(readFileSync(path));
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

function run(cmd, args, input) {
  return new Promise((ok, fail) => {
    const p = spawn(cmd, args, { stdio: [input ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? ok() : fail(new Error(`${cmd} failed:\n${err.slice(-2000)}`))));
    if (input) input(p.stdin);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.film) {
    console.error('Usage: node core/render.mjs films/<name> [--out file.mp4] [--times a,b --sheet file.png]');
    process.exit(1);
  }
  const server = await serve();
  const browser = await chromium.launch({ executablePath: findChrome() });
  try {
    const page = await browser.newPage();
    page.on('console', (m) => m.type() === 'error' && console.error('[film]', m.text()));
    page.on('pageerror', (e) => console.error('[film]', e.message));
    const url = `http://127.0.0.1:${server.address().port}/${args.film.replace(/^\/|\/$/g, '')}/index.html${args.query ? `?${args.query}` : ''}`;
    await page.goto(url);
    await page.waitForFunction(() => window.film?.ready);
    await page.evaluate(() => window.film.ready);
    const meta = await page.evaluate(() => {
      const { width, height, fps, duration } = window.film;
      return { width, height, fps, duration };
    });
    await page.setViewportSize({ width: meta.width, height: meta.height });
    const grab = async (t) => {
      const data = await page.evaluate((time) => {
        window.film.render(time);
        return window.film.canvas.toDataURL('image/png');
      }, t);
      return Buffer.from(data.split(',')[1], 'base64');
    };

    if (args.times) {
      const times = args.times.split(',').map(Number);
      const dir = join(ROOT, '.cache', 'frames');
      mkdirSync(dir, { recursive: true });
      for (const [i, t] of times.entries()) {
        await writeFile(join(dir, `f${String(i).padStart(3, '0')}.png`), await grab(t));
      }
      const sheet = resolve(args.sheet ?? 'out/sheet.png');
      mkdirSync(dirname(sheet), { recursive: true });
      const cols = Number(args.cols ?? Math.min(4, times.length));
      const rows = Math.ceil(times.length / cols);
      const w = Number(args.thumb ?? 480);
      await run('ffmpeg', [
        '-y', '-loglevel', 'error', '-framerate', '1', '-i', join(dir, 'f%03d.png'),
        '-vf', `scale=${w}:-1,tile=${cols}x${rows}:padding=4:color=white`,
        '-frames:v', '1', sheet,
      ]);
      console.log(`Wrote ${sheet}`);
      return;
    }

    const out = resolve(args.out ?? join('out', `${args.film.split('/').filter(Boolean).pop()}.mp4`));
    mkdirSync(dirname(out), { recursive: true });
    const total = Math.round(meta.duration * meta.fps);
    const audio = args.audio ? ['-i', resolve(args.audio)] : [];
    const audioOut = args.audio ? ['-c:a', 'aac', '-b:a', '192k', '-shortest'] : [];
    await run(
      'ffmpeg',
      [
        '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(meta.fps), '-i', '-',
        ...audio, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
        ...audioOut, '-movflags', '+faststart', out,
      ],
      async (stdin) => {
        for (let f = 0; f < total; f++) {
          const buf = await grab(f / meta.fps);
          if (!stdin.write(buf)) await new Promise((ok) => stdin.once('drain', ok));
          if (f % meta.fps === 0) process.stdout.write(`\rframe ${f}/${total}`);
        }
        stdin.end();
      }
    );
    console.log(`\nWrote ${out}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
