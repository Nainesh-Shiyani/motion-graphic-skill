// Minimal headless Chrome/Edge driver over the DevTools protocol (Node 22+, no dependencies).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'
];

export function findBrowser() {
  return CANDIDATES.find((p) => p && fs.existsSync(p));
}

export async function launch({ width = 1280, height = 800, initScript = '' } = {}) {
  const exe = findBrowser();
  if (!exe) throw new Error('No Chrome/Edge found - set CHROME_PATH');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-chrome-'));
  const proc = spawn(exe, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`,
    `--window-size=${width},${height}`, '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--hide-scrollbars', '--mute-audio', '--allow-file-access-from-files',
    '--enable-unsafe-swiftshader', 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((res, rej) => {
    let buf = '';
    proc.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) res(m[1]);
    });
    proc.on('exit', (c) => rej(new Error('browser exited ' + c + '\n' + buf)));
    setTimeout(() => rej(new Error('browser did not start\n' + buf)), 20000);
  });
  const port = new URL(wsUrl).port;
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });

  let id = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(msg.error.message)); else res(msg.result);
    } else if (msg.method) listeners.forEach((l) => l(msg));
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });

  const consoleMsgs = [];
  listeners.add((msg) => {
    if (msg.method === 'Runtime.consoleAPICalled') {
      consoleMsgs.push({ type: msg.params.type, text: msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ') });
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      consoleMsgs.push({ type: 'exception', text: (d.exception && d.exception.description) || d.text });
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      consoleMsgs.push({ type: 'log-error', text: msg.params.entry.text + ' ' + (msg.params.entry.url || '') });
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  if (initScript) await send('Page.addScriptToEvaluateOnNewDocument', { source: initScript });

  const page = {
    send,
    console: consoleMsgs,
    async goto(url, { timeout = 30000 } = {}) {
      const loaded = new Promise((r) => {
        const l = (msg) => { if (msg.method === 'Page.loadEventFired') { listeners.delete(l); r(); } };
        listeners.add(l);
        setTimeout(() => { listeners.delete(l); r(); }, timeout);
      });
      await send('Page.navigate', { url });
      await loaded;
    },
    async waitForNavigation(timeout = 15000) {
      return new Promise((r) => {
        const l = (msg) => { if (msg.method === 'Page.loadEventFired') { listeners.delete(l); r(true); } };
        listeners.add(l);
        setTimeout(() => { listeners.delete(l); r(false); }, timeout);
      });
    },
    async eval(expression) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
      return r.result.value;
    },
    async reducedMotion(on) {
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: on ? 'reduce' : 'no-preference' }] });
    },
    async viewport(w, h, mobile = false) {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
    },
    async screenshot(file, { full = false, jpeg = false, quality = 82 } = {}) {
      const opts = jpeg ? { format: 'jpeg', quality } : { format: 'png' };
      if (full) {
        const m = await send('Page.getLayoutMetrics');
        const h = Math.min(Math.ceil(m.cssContentSize.height), 12000);
        opts.captureBeyondViewport = true;
        opts.clip = { x: 0, y: 0, width: m.cssLayoutViewport.clientWidth, height: h, scale: 1 };
      }
      const r = await send('Page.captureScreenshot', opts);
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    },
    async mouse(type, x, y) {
      await send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: type === 'mouseMoved' ? 0 : 1 });
    },
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    async close() {
      try { ws.close(); } catch (e) { /* ignore */ }
      proc.kill();
      await new Promise((r) => setTimeout(r, 300));
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* locked on Windows sometimes */ }
    }
  };
  return page;
}
