// ── a whole-surface capture: screenshot, AX tree (scoped), targets, contrast in both themes ──────────────────────────
import { shot, axTree, contrastBoth, tabWalk, save, setTheme, sleep } from './lib.mjs';
export * from './lib.mjs';

/** Mark the nearest ancestor (matching `ancestor`) of the first visible element containing `text` with data-a11y=name. */
export async function tag(page, text, ancestor, name) {
  return page.eval(`(() => {
    const t = ${JSON.stringify(text)};
    const all = [...document.querySelectorAll('body *')].filter((e) => window.__a11y.visible(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.replace(/\\s+/g,' ').trim().includes(t)));
    const el = all[0] || [...document.querySelectorAll('[aria-label]')].find((e) => e.getAttribute('aria-label').includes(t));
    if (!el) return false;
    const a = el.closest(${JSON.stringify(ancestor)}) || el.parentElement;
    a.setAttribute('data-a11y', ${JSON.stringify(name)});
    return true;
  })()`);
}

export async function capture(page, label, { root = 'body', scope = null, ui = true, tabs = true, shots = true, themes = true } = {}) {
  const res = { label, root };
  if (shots) { res.shot = await shot(page, label); }
  res.ax = await axTree(page, { rootSelector: scope ?? (root === 'body' ? null : root) });
  res.targets = JSON.parse(await page.eval(`JSON.stringify(window.__a11y.targets(${JSON.stringify(root)}))`));
  res.contrast = await contrastBoth(page, root, label, { ui });
  if (tabs) res.tabWalk = await tabWalk(page, { max: 60 });
  save(label, res);
  return res;
}

export function summarize(res, { showTab = true } = {}) {
  const L = [];
  L.push(`== ${res.label} (root ${res.root})`);
  if (res.ax) {
    L.push(`  AX nodes: ${res.ax.nodes?.length}  unnamed: ${res.ax.unnamed?.length}` + (res.ax.unnamed?.length ? ' -> ' + JSON.stringify(res.ax.unnamed.map((n) => n.role + ':' + n.name)) : ''));
  }
  if (res.targets) {
    L.push(`  targets: ${res.targets.total}, min side ${res.targets.min}, <44px: ${res.targets.under44}, small(<24) failing spacing: ${res.targets.small.filter((s) => s.fail).length}`);
    for (const s of res.targets.small.filter((s) => s.fail)) L.push(`    SMALL ${s.w}x${s.h} ${s.sel} "${s.name}"`);
  }
  for (const mode of ['light', 'dark']) {
    const c = res.contrast?.[mode];
    if (!c) continue;
    L.push(`  contrast ${mode}: n=${c.n} min=${c.min} darkClass=${c.darkClass} fails=${c.fails.length} uiFails=${c.ui.length} (ui checked ${c.uiCount})`);
    for (const f of c.fails) L.push(`    FAIL ${f.ratio}:${f.need} ${f.fg} on ${f.bg} ${f.px}px/${f.w} "${f.text}" ${f.sel}`);
    for (const f of c.ui) L.push(`    UIFAIL ${f.best} ${f.type} "${f.label}" ${f.edge} ${f.sel}`);
    for (const f of c.notes.slice(0, 6)) L.push(`    NOTE ${f.note} "${f.text}" ${f.ratio} ${f.sel}`);
  }
  if (showTab && res.tabWalk) {
    L.push(`  tab order (${res.tabWalk.length}): ` + res.tabWalk.map((s) => (s.name || s.sel || '?').slice(0, 24) + (s.fv ? '' : '[NOFV]') + (s.outline.startsWith('none') && !s.boxShadow ? '[NOOUTLINE]' : '')).join(' | '));
  }
  return L.join('\n');
}
