// Zero-dependency Chrome DevTools Protocol driver.
// Launches the system Chrome headless and talks CDP over Node's built-in
// global WebSocket. Used by the benchmark harness to apply a deterministic
// CPU throttle and measure frame times. Dev-only; never shipped.
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CHROME =
  process.env.CHROME_BIN ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// A page-scoped CDP session over a single WebSocket.
export class CDPSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.pending = new Map();
    this.handlers = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;
      ws.addEventListener('open', () => resolve(this));
      ws.addEventListener('error', (e) => reject(new Error('CDP ws error: ' + (e?.message || e?.type || 'unknown'))));
      ws.addEventListener('message', (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.id != null && this.pending.has(msg.id)) {
          const { resolve: res, reject: rej } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) rej(new Error(`${msg.error.message} (${msg.error.code})`));
          else res(msg.result);
        } else if (msg.method) {
          const list = this.handlers.get(msg.method);
          if (list) for (const cb of list) cb(msg.params);
        }
      });
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, cb) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(cb);
  }

  // Evaluate an expression in the page; awaits promises, returns the value by JSON.
  async evaluate(expression) {
    const { result, exceptionDetails } = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails) {
      throw new Error('Page eval failed: ' + (exceptionDetails.exception?.description || exceptionDetails.text));
    }
    return result.value;
  }

  close() {
    try { this.ws?.close(); } catch { /* ignore */ }
  }
}

// Launch headless Chrome, return { browser-level info, openPage(url), kill() }.
export async function launchChrome({ headless = true } = {}) {
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'cd-bench-'));
  const args = [
    headless ? '--headless=new' : '',
    '--disable-gpu',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--mute-audio',
    '--autoplay-policy=no-user-gesture-required',
    '--hide-scrollbars',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    'about:blank',
  ].filter(Boolean);

  const proc = spawn(CHROME, args, { stdio: ['ignore', 'ignore', 'pipe'] });

  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const to = setTimeout(() => reject(new Error('Chrome did not report a DevTools endpoint in time')), 15000);
    proc.stderr.on('data', (d) => {
      buf += d.toString();
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(to); resolve(m[1]); }
    });
    proc.on('exit', (code) => { clearTimeout(to); reject(new Error('Chrome exited early, code ' + code)); });
  });

  // Derive the HTTP base (http://host:port) from the browser ws URL.
  const httpBase = wsUrl.replace(/^ws:/, 'http:').replace(/\/devtools\/browser\/.*$/, '');

  async function openPage(url) {
    // PUT /json/new?<url> creates a fresh tab and returns its ws endpoint.
    const res = await fetch(`${httpBase}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
    if (!res.ok) throw new Error('Failed to open page target: ' + res.status);
    const target = await res.json();
    const session = new CDPSession(target.webSocketDebuggerUrl);
    await session.connect();
    return session;
  }

  async function kill() {
    try { proc.kill('SIGKILL'); } catch { /* ignore */ }
    try { await rm(userDataDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }

  return { proc, httpBase, wsUrl, openPage, kill };
}
