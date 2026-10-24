import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
// axe-core is not a dependency of this repo; Lighthouse brings it. Point AXE_JS at an axe.min.js, or let this look in the npx cache.
function findAxe() {
  if (process.env.AXE_JS) return process.env.AXE_JS;
  const root = join(homedir(), '.npm', '_npx');
  for (const d of existsSync(root) ? readdirSync(root) : []) { const p = join(root, d, 'node_modules', 'axe-core', 'axe.min.js'); if (existsSync(p)) return p; }
  throw new Error('axe.min.js not found: run `npx lighthouse --version` once, or set AXE_JS');
}
const AXE = readFileSync(findAxe(), 'utf8');

/** Run axe-core (the engine Lighthouse's accessibility audits use) on the current state of a page. */
export async function axeRun(page, { include = null, tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'], rules = null } = {}) {
  await page.eval(`window.__a11y.settle(true)`);
  const has = await page.eval(`typeof window.axe !== 'undefined'`);
  if (!has) await page.eval(AXE + '\n;true');
  const expr = `(async () => {
    const ctx = ${include ? JSON.stringify({ include: [[include]] }) : 'document'};
    const opts = { runOnly: { type: 'tag', values: ${JSON.stringify(tags)} }, resultTypes: ['violations', 'incomplete'] };
    const r = await window.axe.run(ctx, opts);
    const slim = (list) => list.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 6).map((n) => ({ target: n.target.join(' '), html: n.html.slice(0, 160), why: (n.any.concat(n.all, n.none).map((c) => c.message)).slice(0, 2).join(' | ') })), count: v.nodes.length }));
    return JSON.stringify({ version: window.axe.version, violations: slim(r.violations), incomplete: slim(r.incomplete), passes: r.passes.length });
  })()`;
  return JSON.parse(await page.eval(expr));
}

export function axeSummary(label, r, { showIncomplete = false } = {}) {
  const L = [`-- axe ${label}: ${r.violations.length} violation rule(s), ${r.incomplete.length} incomplete, ${r.passes} passes`];
  for (const v of r.violations) {
    L.push(`   [${v.impact}] ${v.id} x${v.count}: ${v.help}`);
    for (const n of v.nodes.slice(0, 3)) L.push(`      ${n.target} :: ${n.html.slice(0, 100)} :: ${n.why.slice(0, 140)}`);
  }
  if (showIncomplete) for (const v of r.incomplete) { L.push(`   (needs review) ${v.id} x${v.count}`); for (const n of v.nodes.slice(0, 2)) L.push(`      ${n.target} :: ${n.html.slice(0, 80)}`); }
  return L.join('\n');
}
