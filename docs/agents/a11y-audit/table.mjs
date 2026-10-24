import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const dir = join(process.env.A11Y_DIR ?? join(tmpdir(), 'ws13-a11y'), 'out');
const rows = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json') && !x.startsWith('axe-') && !x.startsWith('a') ).sort()) {
  let r; try { r = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
  if (!r.contrast) continue;
  const nonDisabledMin = (m) => { const xs = r.contrast[m].all.filter((x) => !x.disabled && !x.note); return xs.length ? Math.min(...xs.map((x) => x.ratio)) : null; };
  rows.push({
    label: r.label, nL: r.contrast.light.n, minL: nonDisabledMin('light'), minD: nonDisabledMin('dark'),
    textFails: r.contrast.light.fails.length + r.contrast.dark.fails.length, ui: Math.max(r.contrast.light.ui.length, r.contrast.dark.ui.length),
    minTarget: r.targets?.min, under44: r.targets?.under44, unnamed: r.ax?.unnamed?.length,
  });
}
console.log('label | texts | min contrast light | dark | text fails | ui-boundary flags | min target | <44 | unnamed AX');
for (const r of rows) console.log([r.label, r.nL, r.minL, r.minD, r.textFails, r.ui, r.minTarget, r.under44, r.unnamed].join(' | '));
