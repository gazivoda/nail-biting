// usage: node scripts/flags-off-diff/dom-all.mjs <port> <chromePort> <outDir> <label=checkoutRoot> [...] [--flags a,b] [--only-out]
// Runs dom-snap.mjs for each checkout, one after the other. --only-out skips the signed-in phase (to repeat the
// signed-out captures cheaply when a difference might be timing). Then: node dom-diff.mjs <outDir> <labelA> <labelB> <chromePort>.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const args = process.argv.slice(2);
const take = (name, hasValue) => { const i = args.indexOf(name); if (i < 0) return null; return hasValue ? args.splice(i, 2)[1] : (args.splice(i, 1), true); };
const flags = take('--flags', true) ?? '';
const onlyOut = take('--only-out', false);
const [port, chromePort, outDir, ...specs] = args;
for (const spec of specs) {
  const [label, ...rest] = spec.split('=');
  const env = { ...process.env, ...(onlyOut ? { DOM_ONLY: 'out' } : {}) };
  const r = spawnSync(process.execPath, [join(import.meta.dirname, 'dom-snap.mjs'), label, rest.join('='), port, chromePort, outDir, flags], { stdio: 'inherit', env });
  if (r.status !== 0) { console.error(`dom snapshot of ${label} failed`); process.exit(1); }
}
