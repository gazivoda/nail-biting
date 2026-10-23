// usage: node scripts/background-probe/show-app.mjs <label...>   prints the tables of docs/agents/ws7a-measurements/app-<label>.json
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SP } from './cdp.mjs';

for (const label of process.argv.slice(2)) {
  const r = JSON.parse(readFileSync(join(SP, `app-${label}.json`), 'utf8'));
  console.log(`=== ${label}  mode=${r.mode} flags="${r.flags}" ${r.browser}  hidden=${r.visHidden} pip=${r.pipOpen ?? '-'} back=${r.visBack ?? '-'}`);
  if (r.error) console.log('ERROR', r.error);
  console.log('frames fresh at every checkpoint:', r.checkpoints.every((c) => c.fresh === true), `(${r.checkpoints.length} checkpoints)`);
  console.log('longest time without a detection step while hidden (s):', r.longestSecondsWithoutAStepWhileHidden);
  if (r.alarms) console.log('alarms', JSON.stringify(r.alarms));
  console.table(r.table);
  console.log('cpu % of one core', JSON.stringify(r.cpu));
}
