// The privacy audit against the real app in a real browser: a 45-second smoke in both modes. It needs Chrome, a
// camera-less fake device, a free port and a build, so it only runs when you ask for it:
//
//   npm run build:web && PRIVACY_AUDIT=1 npx vitest run scripts/privacy-audit/smoke.test.mjs
//
// Without PRIVACY_AUDIT=1 it is skipped (like marketingSite.test.mjs without a build). The full 5-minute audit is
// `npm run privacy:audit`. Optional: PRIVACY_AUDIT_PORT (default 3213), PRIVACY_AUDIT_CHROME_PORT (default 4213).
import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const enabled = process.env.PRIVACY_AUDIT === '1';

describe.skipIf(!enabled)('privacy audit smoke (real browser, 45 s per mode)', () => {
  it('passes with sync off and with sync on', async () => {
    expect(existsSync(join(ROOT, 'dist/index.html')), 'run `npm run build:web` first').toBe(true);
    const out = mkdtempSync(join(tmpdir(), 'sb-privacy-smoke-'));
    const child = spawn(process.execPath, [
      join(ROOT, 'scripts/privacy-audit/run.mjs'), '--mode', 'both', '--seconds', '45', '--out', out,
      '--port', process.env.PRIVACY_AUDIT_PORT ?? '3213', '--chrome-port', process.env.PRIVACY_AUDIT_CHROME_PORT ?? '4213',
    ], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    child.stdout.on('data', d => { log += d; });
    child.stderr.on('data', d => { log += d; });
    const code = await new Promise(resolve => child.on('exit', resolve));
    const summary = existsSync(join(out, 'summary.json')) ? JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8')) : null;
    try {
      // exit 1 = a privacy violation, 2 = inconclusive (the run could not reach the states it needs): both are failures
      expect(code, log.split('\n').slice(-60).join('\n')).toBe(0);
      expect(summary?.results.map(r => [r.mode, r.verdict])).toEqual([['off', 'PASS'], ['on', 'PASS']]);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 420_000);
});
