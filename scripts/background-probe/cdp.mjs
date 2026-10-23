// Minimal CDP client for Node 24 (global WebSocket + fetch). No dependencies.
// Used by the WS7a hidden-tab measurements (docs/agents/ws7a-notes.md, ARCHITECTURE section 15).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Where this folder is, and where results go (RESULTS_DIR, default: docs/agents/ws7a-measurements next to the repo root).
export const HERE = new URL('.', import.meta.url).pathname;
export const SP = process.env.RESULTS_DIR ?? join(HERE, '..', '..', 'docs', 'agents', 'ws7a-measurements');
// Chrome with the DevTools protocol. Override with CHROME_BIN on Linux/Windows.
const CHROME = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launchChrome({ port, headless = 'new', args = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ws7a-chrome-'));
  const flags = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${dir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1280,900',
    ...(headless ? [`--headless=${headless}`] : []),
    ...args,
    'about:blank',
  ];
  const proc = spawn(CHROME, flags, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  proc.stderr.on('data', (d) => { stderr += d; });
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) {
        const v = await r.json();
        return { proc, dir, version: v.Browser, wsUrl: v.webSocketDebuggerUrl, stderr: () => stderr, close() { try { proc.kill('SIGKILL'); } catch {} try { rmSync(dir, { recursive: true, force: true }); } catch {} } };
      }
    } catch { /* not up yet */ }
    await sleep(100);
  }
  proc.kill('SIGKILL');
  throw new Error('chrome did not start: ' + stderr.slice(0, 500));
}

export class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.handlers = [];
    this.ready = new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { res, rej } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) rej(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? '')})`)); else res(msg.result);
      } else if (msg.method) {
        for (const h of this.handlers) h(msg);
      }
    };
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify(payload)); });
  }
  on(fn) { this.handlers.push(fn); }
  close() { try { this.ws.close(); } catch {} }
}

/** Open a page target, attach, return a session-scoped helper. */
export async function openPage(cdp, url, { newWindow = false } = {}) {
  const { targetId } = await cdp.send('Target.createTarget', { url, newWindow });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const page = {
    targetId,
    sessionId,
    send: (m, p) => cdp.send(m, p, sessionId),
    async eval(expression, { awaitPromise = true, userGesture = false } = {}) {
      const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true, userGesture }, sessionId);
      if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
      return r.result.value;
    },
  };
  return page;
}
