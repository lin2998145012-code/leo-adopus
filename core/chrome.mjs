// A minimal headless Chrome driver over the DevTools protocol, using Node's
// built-in WebSocket, so rendering needs no npm packages.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { homedir, platform, tmpdir } from 'node:os';
import { join } from 'node:path';

const CANDIDATES = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ],
};

// Playwright's browser cache, used when no system Chrome is installed.
function playwrightChrome() {
  const bases = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    join(homedir(), '.cache', 'ms-playwright'),
    join(homedir(), 'Library', 'Caches', 'ms-playwright'),
  ].filter(Boolean);
  for (const base of bases) {
    if (!existsSync(base)) continue;
    const dirs = readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse();
    for (const dir of dirs) {
      for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-win/chrome.exe']) {
        const p = join(base, dir, sub);
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
}

export function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const p of CANDIDATES[platform()] ?? []) if (existsSync(p)) return p;
  return playwrightChrome();
}

export class Browser {
  static async launch() {
    const exe = findChrome();
    if (!exe) throw new Error('Chrome not found. Install Google Chrome or set CHROME_PATH.');
    const profile = mkdtempSync(join(tmpdir(), 'adopus-chrome-'));
    const proc = spawn(exe, [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--mute-audio',
      '--no-proxy-server',
      '--disable-background-networking',
      '--disable-component-update',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
      'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    const wsUrl = await new Promise((ok, fail) => {
      let err = '';
      const timer = setTimeout(() => fail(new Error(`Chrome did not start:\n${err}`)), 30000);
      proc.stderr.on('data', (d) => {
        err += d;
        const m = err.match(/DevTools listening on (ws:\/\/\S+)/);
        if (m) {
          clearTimeout(timer);
          ok(m[1]);
        }
      });
      proc.on('exit', () => fail(new Error(`Chrome exited:\n${err}`)));
    });
    const browser = new Browser(proc, profile);
    await browser.connect(wsUrl);
    return browser;
  }

  constructor(proc, profile) {
    this.proc = proc;
    this.profile = profile;
    this.id = 0;
    this.pending = new Map();
    this.listeners = [];
  }

  connect(url) {
    return new Promise((ok, fail) => {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => ok();
      this.ws.onerror = (e) => fail(new Error(`DevTools connection failed: ${e.message ?? e}`));
      this.ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        } else if (msg.method) {
          for (const l of this.listeners) l(msg);
        }
      };
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  async newPage(width, height) {
    const { targetId } = await this.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new Page(this, sessionId);
    await page.send('Runtime.enable');
    await page.send('Page.enable');
    await page.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    return page;
  }

  async close() {
    try {
      await this.send('Browser.close');
    } catch {}
    this.ws?.close();
    this.proc.kill();
    try {
      rmSync(this.profile, { recursive: true, force: true });
    } catch {}
  }
}

class Page {
  constructor(browser, sessionId) {
    this.browser = browser;
    this.sessionId = sessionId;
    browser.listeners.push((msg) => {
      if (msg.sessionId !== sessionId) return;
      if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[film]', msg.params.exceptionDetails?.exception?.description ?? msg.params.exceptionDetails?.text);
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        console.error('[film]', msg.params.args.map((a) => a.value ?? a.description).join(' '));
      }
    });
  }

  send(method, params) {
    return this.browser.send(method, params, this.sessionId);
  }

  async goto(url) {
    await this.send('Page.navigate', { url });
  }

  // Evaluate an expression in the page, awaiting promises.
  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text);
    }
    return res.result.value;
  }

  async waitFor(expression, timeout = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await this.evaluate(expression).catch(() => false)) return;
      await new Promise((ok) => setTimeout(ok, 50));
    }
    throw new Error(`Timed out waiting for: ${expression}`);
  }
}
