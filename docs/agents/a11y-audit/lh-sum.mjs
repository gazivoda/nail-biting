import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const dir = join(process.env.A11Y_DIR ?? join(tmpdir(), 'ws13-a11y'), 'lh');
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  let j; try { j = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { console.log(f, 'unreadable'); continue; }
  const cat = j.categories?.accessibility;
  console.log(`\n${f.replace('.json', '')}: score ${cat ? Math.round(cat.score * 100) : '?'}  (LH ${j.lighthouseVersion}, ${j.configSettings?.formFactor}, finalUrl ${j.finalDisplayedUrl || j.finalUrl})`);
  if (j.runtimeError) console.log('  runtimeError', JSON.stringify(j.runtimeError));
  for (const ref of cat?.auditRefs ?? []) {
    const a = j.audits[ref.id];
    if (a.score === null || a.scoreDisplayMode === 'notApplicable' || a.scoreDisplayMode === 'informative') continue;
    if (a.score < 1) {
      console.log(`  FAIL ${ref.id} (w${ref.weight}): ${a.title}`);
      for (const it of (a.details?.items ?? []).slice(0, 6)) console.log('     ', (it.node?.selector || it.node?.snippet || JSON.stringify(it)).slice(0, 110), '|', (it.node?.explanation || '').replace(/\s+/g, ' ').slice(0, 160));
    }
  }
  const manual = (cat?.auditRefs ?? []).filter((r) => j.audits[r.id].scoreDisplayMode === 'manual').length;
  console.log(`  manual-check audits: ${manual}`);
}
