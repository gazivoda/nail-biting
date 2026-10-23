// A throwaway copy of the real server around a given dist/ so a build can be measured in a real browser:
// scratch dir with server.js + server/ + shared/ + email.js, the dist you name, a temp DATA_DIR with one
// signed-in user (trial running), and a session cookie for that user. Dummy secrets; never touches .env or data/.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import { HERE } from './cdp.mjs';

const ROOT = join(HERE, '..', '..');
const SECRET = 'ws7a-rig-secret-ws7a-rig-secret-0123456789';

export async function startRig({ dist, port, flags = '' }) {
  const dir = mkdtempSync(join(tmpdir(), 'ws7a-rig-'));
  for (const f of ['server.js', 'email.js', 'trialFollowup.js', 'package.json']) cpSync(join(ROOT, f), join(dir, f));
  for (const d of ['server', 'shared']) cpSync(join(ROOT, d), join(dir, d), { recursive: true });
  cpSync(dist, join(dir, 'dist'), { recursive: true });
  symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'));
  const dataDir = join(dir, 'data');
  mkdirSync(dataDir);

  const db = new Database(join(dataDir, 'users.db'));
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT, name TEXT, avatar TEXT, trial_end_date TEXT NOT NULL,
    subscription_status TEXT NOT NULL DEFAULT 'trial', subscription_plan TEXT, subscription_end_date TEXT,
    paddle_subscription_id TEXT, paddle_customer_id TEXT, created_at TEXT NOT NULL)`);
  const now = Date.now();
  db.prepare('INSERT INTO users (id, email, name, trial_end_date, subscription_status, created_at) VALUES (?,?,?,?,?,?)')
    .run('rig-user', 'rig@example.test', 'Rig User', new Date(now + 3 * 86400000).toISOString(), 'trial', new Date(now).toISOString());
  db.close();

  const env = {
    ...process.env,
    GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'x', JWT_SECRET: SECRET,
    PORT: String(port), DATA_DIR: dataDir, FEATURE_FLAGS: flags, APP_URL: `http://localhost:${port}`,
    RESEND_API_KEY: '', NODE_ENV: 'development',
  };
  const proc = spawn(process.execPath, ['server.js'], { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  proc.stdout.on('data', (d) => { log += d; });
  proc.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/health`);
      if (r.ok) break;
    } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 100));
    if (i === 99) throw new Error('rig server did not start: ' + log.slice(-600));
  }
  const token = jwt.sign({ sub: 'rig-user' }, SECRET, { expiresIn: '1d', algorithm: 'HS256' });
  return {
    url: `http://localhost:${port}`,
    token,
    log: () => log,
    stop() { try { proc.kill('SIGKILL'); } catch { /* gone */ } try { rmSync(dir, { recursive: true, force: true }); } catch { /* gone */ } },
  };
}
