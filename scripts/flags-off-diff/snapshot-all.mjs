// usage: node scripts/flags-off-diff/snapshot-all.mjs <port> <outDir> <label=checkoutRoot> [<label=checkoutRoot> ...] [--flags a,b]
// Runs http-snapshot.mjs for each checkout, one after the other (one server at a time, on one port).
// Each checkout needs a built dist/ (npm run build:web). Then: node http-diff.mjs <outDir> <labelA> <labelB>.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const args = process.argv.slice(2);
const fi = args.indexOf('--flags');
const flags = fi >= 0 ? args.splice(fi, 2)[1] : '';
const [port, outDir, ...specs] = args;
for (const spec of specs) {
  const [label, ...rest] = spec.split('=');
  const r = spawnSync(process.execPath, [join(import.meta.dirname, 'http-snapshot.mjs'), label, rest.join('='), port, outDir, flags], { stdio: 'inherit' });
  if (r.status !== 0) { console.error(`snapshot of ${label} failed`); process.exit(1); }
}
