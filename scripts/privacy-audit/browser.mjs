// Chrome + the DevTools protocol, with nothing installed: a tiny CDP client (Node's global WebSocket and fetch),
// a Chrome launcher with a fake camera, and the real server.js on a scratch DATA_DIR with a real signed-in user.
// Used by the privacy audit (run.mjs) only.
import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
export const CHROME = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// ── The real server ─────────────────────────────────────────────────────────

/**
 * Starts `node server.js` from `root` (the real built app: it serves root/dist) on `port`, with a scratch DATA_DIR,
 * throwaway credentials and exactly the environment the marketing end-to-end test uses (no real .env, no mail, no
 * Paddle). NODE_ENV is left unset because the Dockerfile does not set it either.
 * Then signs a person in the way the product does: a row in the users table and a session JWT signed exactly as
 * server.js does (`jwt.sign({ sub }, JWT_SECRET, { expiresIn: '14d', algorithm: 'HS256' })`), sent as the `nh_session` cookie.
 */
const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.once('error', reject);
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
});

/**
 * server.js sends `upgrade-insecure-requests` in its Content-Security-Policy. In production the site is https and that
 * does nothing; on http://localhost Chrome applies it to a service worker's own fetches, which turns `/` into
 * https://localhost:PORT/, a TLS error, and the worker never installs. So that the audit can run (and record) the real
 * service worker, a pass-through proxy sits in front of server.js and removes that one directive. Nothing else is touched.
 */
function startProxy(listenPort, targetPort) {
  const proxy = http.createServer((req, res) => {
    const up = http.request({ host: '127.0.0.1', port: targetPort, method: req.method, path: req.url, headers: req.headers }, (ur) => {
      const headers = { ...ur.headers };
      for (const k of Object.keys(headers)) {
        if (k.toLowerCase() === 'content-security-policy') headers[k] = String(headers[k]).replace(/;?\s*upgrade-insecure-requests/gi, '');
      }
      res.writeHead(ur.statusCode, ur.statusMessage, headers);
      ur.pipe(res);
    });
    up.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.pipe(up);
  });
  // Both loopback families, so a stranger already listening on the same port on [::1] cannot silently answer for us
  // ("localhost" resolves to ::1 first): EADDRINUSE on either is an error.
  const listenOn = (srv, host) => new Promise((resolve, reject) => {
    srv.once('error', (e) => (e.code === 'EADDRNOTAVAIL' || e.code === 'EAFNOSUPPORT' ? resolve(false) : reject(e)));
    srv.listen(listenPort, host, () => resolve(true));
  });
  return (async () => {
    await listenOn(proxy, '127.0.0.1');
    const v6 = http.createServer(proxy.listeners('request')[0]);
    await listenOn(v6, '::1');
    const close = proxy.close.bind(proxy);
    proxy.close = (...a) => { v6.close(); v6.closeAllConnections?.(); return close(...a); };
    return proxy;
  })();
}

export async function startServer({ root, port, flags = '', nodeEnv, keepUpgradeInsecure = false }) {
  if (!existsSync(join(root, 'dist', 'index.html'))) throw new Error(`no build at ${root}/dist: run \`npm run build:web\` first`);
  const dataDir = mkdtempSync(join(tmpdir(), 'sb-privacy-audit-'));
  const innerPort = keepUpgradeInsecure ? port : await freePort();
  const secret = randomBytes(24).toString('hex');
  const env = {
    PATH: process.env.PATH,
    PORT: String(innerPort),
    DATA_DIR: dataDir,
    GOOGLE_CLIENT_ID: 'x',
    GOOGLE_CLIENT_SECRET: 'x',
    JWT_SECRET: secret,
    FEATURE_FLAGS: flags,
    APP_URL: `http://localhost:${port}`,
    RESEND_API_KEY: '',
    PADDLE_API_KEY: '',
    PADDLE_WEBHOOK_SECRET: '',
    ELECTRON_PROTOCOL: '',
    ...(nodeEnv ? { NODE_ENV: nodeEnv } : {}),
  };
  const child = spawn(process.execPath, ['server.js'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', d => { log += d; });
  child.stderr.on('data', d => { log += d; });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`server did not start:\n${log.slice(-800)}`)), 30000);
    const poll = setInterval(() => {
      if (log.includes('Server running')) { clearTimeout(t); clearInterval(poll); resolve(); }
      if (child.exitCode !== null) { clearTimeout(t); clearInterval(poll); reject(new Error(`server exited:\n${log.slice(-800)}`)); }
    }, 50);
  });

  const proxy = keepUpgradeInsecure ? null : await startProxy(port, innerPort);
  const db = new Database(join(dataDir, 'users.db'));
  const now = Date.now();
  const user = { id: 'audit-user', email: 'audit@example.test', name: 'Audit User' };
  db.prepare('INSERT INTO users (id, email, name, trial_end_date, subscription_status, created_at) VALUES (?,?,?,?,?,?)')
    .run(user.id, user.email, user.name, new Date(now + 3 * 86400000).toISOString(), 'trial', new Date(now).toISOString());
  db.close();
  const token = jwt.sign({ sub: user.id }, secret, { expiresIn: '14d', algorithm: 'HS256' });

  const origin = `http://localhost:${port}`;
  const me = await fetch(`${origin}/api/user/me`, { headers: { Cookie: `nh_session=${token}` } }).then(r => r.status).catch(() => 0);
  return {
    origin,
    token,
    user,
    dataDir,
    signedInCheck: me,
    log: () => log,
    async stop() {
      proxy?.close();
      proxy?.closeAllConnections?.();
      child.kill();
      await new Promise(r => child.once('exit', r));
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

// ── Chrome ──────────────────────────────────────────────────────────────────

export async function launchChrome({ port, extraArgs = [] }) {
  const dir = mkdtempSync(join(tmpdir(), 'sb-privacy-chrome-'));
  const flags = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${dir}`,
    '--no-first-run', '--no-default-browser-check',
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-component-update', '--disable-background-networking', '--disable-sync',
    '--window-size=1280,900', '--headless=new',
    ...extraArgs,
    'about:blank',
  ];
  const proc = spawn(CHROME, flags, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  proc.stderr.on('data', d => { stderr += d; });
  for (let i = 0; i < 150; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) {
        const v = await r.json();
        return { proc, version: v.Browser, wsUrl: v.webSocketDebuggerUrl, stderr: () => stderr, close() { try { proc.kill('SIGKILL'); } catch { /* gone */ } try { rmSync(dir, { recursive: true, force: true }); } catch { /* gone */ } } };
      }
    } catch { /* not up yet */ }
    await sleep(100);
  }
  proc.kill('SIGKILL');
  throw new Error(`chrome did not start: ${stderr.slice(0, 500)}`);
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
        if (msg.error) rej(new Error(`${msg.error.message} ${JSON.stringify(msg.error.data ?? '')}`)); else res(msg.result);
      } else if (msg.method) {
        for (const h of this.handlers) { try { h(msg); } catch (e) { console.error('cdp handler error', e); } }
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
  close() { try { this.ws.close(); } catch { /* closed */ } }
}
