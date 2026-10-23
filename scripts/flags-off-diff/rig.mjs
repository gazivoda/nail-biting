// A throwaway copy of the real server around a checkout, so a build is measured on the server code that built it
// (scripts/background-probe/rig.mjs copies server.js from the CURRENT tree, which is wrong for a baseline).
//   startRigFrom({ root, port, flags })   root = a checkout that has server.js, server/, shared/ and a built dist/
// Same recipe as the WS7a rig: scratch dir, temp DATA_DIR with one signed-in user, dummy secrets, never touches
// .env or data/. The user's dates are FIXED (FIXED_NOW) so /api/user/me is comparable across rigs.
// Set TMPDIR to keep the scratch copies somewhere you can delete.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, symlinkSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';

const SECRET = 'ws13-rig-secret-ws13-rig-secret-0123456789';
export const FIXED_NOW = Date.UTC(2026, 9, 24, 12, 0, 0);

export async function startRigFrom({ root, port, flags = '', env: extraEnv = {} }) {
  const dir = mkdtempSync(join(tmpdir(), 'ws13-rig-'));
  for (const f of ['server.js', 'email.js', 'trialFollowup.js', 'package.json']) {
    if (existsSync(join(root, f))) cpSync(join(root, f), join(dir, f));
  }
  for (const d of ['server', 'shared']) cpSync(join(root, d), join(dir, d), { recursive: true });
  cpSync(join(root, 'dist'), join(dir, 'dist'), { recursive: true });
  symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'));
  const dataDir = join(dir, 'data');
  mkdirSync(dataDir);

  // better-sqlite3 and jsonwebtoken are imported from THIS tree's node_modules (all trees share one).
  const db = new Database(join(dataDir, 'users.db'));
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT, name TEXT, avatar TEXT, trial_end_date TEXT NOT NULL,
    subscription_status TEXT NOT NULL DEFAULT 'trial', subscription_plan TEXT, subscription_end_date TEXT,
    paddle_subscription_id TEXT, paddle_customer_id TEXT, created_at TEXT NOT NULL)`);
  db.prepare('INSERT INTO users (id, email, name, trial_end_date, subscription_status, created_at) VALUES (?,?,?,?,?,?)')
    .run('rig-user', 'rig@example.test', 'Rig User', new Date(FIXED_NOW + 3 * 86400000).toISOString(), 'trial', new Date(FIXED_NOW).toISOString());
  db.close();

  const env = {
    ...process.env,
    GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'x', JWT_SECRET: SECRET,
    PORT: String(port), DATA_DIR: dataDir, FEATURE_FLAGS: flags, APP_URL: `http://localhost:${port}`,
    RESEND_API_KEY: '', NODE_ENV: 'production', ...extraEnv,
  };
  const proc = spawn(process.execPath, ['server.js'], { cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  proc.stdout.on('data', (d) => { log += d; });
  proc.stderr.on('data', (d) => { log += d; });
  for (let i = 0; i < 150; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/health`);
      if (r.ok) break;
    } catch { /* not up */ }
    await new Promise((r) => setTimeout(r, 100));
    if (i === 149) { try { proc.kill('SIGKILL'); } catch { /* gone */ } throw new Error('rig server did not start: ' + log.slice(-800)); }
  }
  const token = jwt.sign({ sub: 'rig-user' }, SECRET, { expiresIn: '1d', algorithm: 'HS256' });
  return {
    url: `http://localhost:${port}`,
    token,
    dir,
    log: () => log,
    stop() { try { proc.kill('SIGKILL'); } catch { /* gone */ } try { rmSync(dir, { recursive: true, force: true }); } catch { /* gone */ } },
  };
}
