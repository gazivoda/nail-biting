// Like scripts/background-probe/rig.mjs, plus: extra env (dummy providers), a paid-up or trial user, and an optional
// stub for the email provider (RESEND_API_KEY set so the magic-link option shows; no mail is ever sent: we never submit).
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';

const ROOT = new URL('../../../', import.meta.url).pathname; // the repo root (this folder is docs/agents/a11y-audit)
const SECRET = 'ws13-a11y-secret-ws13-a11y-secret-0123456789';

export async function startRig({ dist, port, flags = '', extraEnv = {} }) {
  const dir = mkdtempSync(join(tmpdir(), 'ws13-a11y-rig-'));
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
    RESEND_API_KEY: 're_dummy_not_real', EMAIL_FROM: 'a11y@example.test', NODE_ENV: 'development',
    APPLE_CLIENT_ID: 'a11y.example.test', APPLE_TEAM_ID: 'ABCDEFGHIJ', APPLE_KEY_ID: 'ABCDEFGHIJ', APPLE_PRIVATE_KEY: generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' }),
    MICROSOFT_CLIENT_ID: 'dummy', MICROSOFT_CLIENT_SECRET: 'dummy',
    ...extraEnv,
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
