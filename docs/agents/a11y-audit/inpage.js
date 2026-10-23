// Injected into every page: window.__a11y.{contrast, targets, focusables, describe, anchors}
(() => {
  if (window.__a11y) return;
  const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  function rgba(css) {
    if (cache.has(css)) return cache.get(css);
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = '#000'; // reset, so an unparsable value cannot leave the previous colour
    cx.fillStyle = css;
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    // canvas stores premultiplied; getImageData un-premultiplies (lossy at low alpha, fine here)
    const v = [d[0], d[1], d[2], d[3] / 255];
    cache.set(css, v);
    return v;
  }
  const over = (fg, bg) => { // fg (with alpha) over opaque bg
    const a = fg[3];
    return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const ratio = (a, b) => { const la = lum(a), lb = lum(b); const hi = Math.max(la, lb), lo = Math.min(la, lb); return (hi + 0.05) / (lo + 0.05); };
  const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

  function sel(el) {
    if (!el || el.nodeType !== 1) return '';
    const parts = [];
    let e = el;
    for (let i = 0; e && e.nodeType === 1 && i < 4; i++) {
      let s = e.tagName.toLowerCase();
      if (e.id) { s += '#' + e.id; parts.unshift(s); break; }
      const role = e.getAttribute('role'); if (role) s += `[role=${role}]`;
      const tid = e.getAttribute('data-testid'); if (tid) s += `[data-testid=${tid}]`;
      parts.unshift(s);
      e = e.parentElement;
    }
    return parts.join(' > ');
  }

  function visible(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
      if (parseFloat(cs.opacity) === 0) return false;
      if (e.hasAttribute('hidden')) return false;
    }
    return true;
  }

  // The colour behind an element: composite the translucent backgrounds from the first opaque ancestor down.
  function backdrop(el) {
    const layers = [];
    let note = '';
    let opacity = 1;
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      opacity *= parseFloat(cs.opacity);
      const c = rgba(cs.backgroundColor);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        // gradients / images: cannot be resolved by a colour; record it
        if (/gradient/.test(cs.backgroundImage) && c[3] === 0 && !/url\(/.test(cs.backgroundImage)) note = note || 'gradient bg';
        else if (/url\(/.test(cs.backgroundImage)) note = note || 'image bg';
        else note = note || 'gradient bg';
      }
      if (c[3] > 0) layers.push(c);
      if (c[3] >= 0.999 && cs.backgroundImage === 'none') break;
    }
    let base = [255, 255, 255, 1];
    if (!layers.length || layers[layers.length - 1][3] < 0.999) {
      // fall to the page: html/body background
      const bb = rgba(getComputedStyle(document.body).backgroundColor);
      const hb = rgba(getComputedStyle(document.documentElement).backgroundColor);
      base = hb[3] >= 0.999 ? hb : bb[3] >= 0.999 ? bb : base;
      if (bb[3] > 0 && bb[3] < 0.999) base = over(bb, base);
    } else {
      base = layers.pop();
    }
    let out = base;
    for (let i = layers.length - 1; i >= 0; i--) out = over(layers[i], out);
    return { color: out, note, opacity };
  }

  function sizeInfo(cs) {
    const px = parseFloat(cs.fontSize);
    const w = parseInt(cs.fontWeight, 10) || 400;
    const large = px >= 24 || (px >= 18.66 && w >= 700);
    return { px, w, large };
  }

  function ownText(el) {
    let t = '';
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue;
    return t.replace(/\s+/g, ' ').trim();
  }

  function contrast(rootSel = 'body', opts = {}) {
    const root = document.querySelector(rootSel) || document.body;
    const rows = [];
    const els = [root, ...root.querySelectorAll('*')];
    for (const el of els) {
      const tag = el.tagName.toLowerCase();
      if (['script', 'style', 'svg', 'path', 'noscript', 'canvas', 'video', 'img'].includes(tag)) continue;
      let text = ownText(el);
      const isInput = tag === 'input' || tag === 'textarea';
      if (!text && !(isInput && el.value && el.type !== 'range' && el.type !== 'checkbox' && el.type !== 'radio')) continue;
      if (!text) text = '[value] ' + String(el.value).slice(0, 20);
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 2 || r.height <= 2) continue;
      const cs = getComputedStyle(el);
      const fg0 = rgba(cs.color);
      const { color: bg, note, opacity } = backdrop(el);
      const fg = over([fg0[0], fg0[1], fg0[2], fg0[3] * opacity], bg);
      const ratioV = ratio(fg, bg);
      const { px, w, large } = sizeInfo(cs);
      const need = large ? 3 : 4.5;
      const disabled = el.disabled || el.closest('[disabled],[aria-disabled=true]') !== null;
      rows.push({
        sel: sel(el), text: text.slice(0, 48), ratio: Math.round(ratioV * 100) / 100, need, large,
        fg: hex(fg), bg: hex(bg), px: Math.round(px * 10) / 10, w, note, disabled,
        fail: ratioV < need - 1e-9 && !disabled,
        op: opacity < 1 ? Math.round(opacity * 100) / 100 : undefined,
      });
    }
    // placeholders
    for (const el of root.querySelectorAll('input[placeholder],textarea[placeholder]')) {
      if (!visible(el) || el.value) continue;
      const cs = getComputedStyle(el, '::placeholder');
      const fg0 = rgba(cs.color);
      const { color: bg, opacity } = backdrop(el);
      const fg = over([fg0[0], fg0[1], fg0[2], fg0[3] * opacity * (parseFloat(cs.opacity) || 1)], bg);
      const rt = ratio(fg, bg);
      rows.push({ sel: sel(el) + '::placeholder', text: el.getAttribute('placeholder').slice(0, 40), ratio: Math.round(rt * 100) / 100, need: 4.5, large: false, fg: hex(fg), bg: hex(bg), px: parseFloat(cs.fontSize), w: 400, note: '', disabled: false, fail: rt < 4.5 });
    }
    return rows;
  }

  // Non-text contrast: the edge/fill that identifies a control (inputs, selects, switches/toggles, sliders, checkboxes)
  function uiContrast(rootSel = 'body') {
    const root = document.querySelector(rootSel) || document.body;
    const rows = [];
    // text fields, selects, textareas: the boundary must reach 3:1. Switches, segmented radios and native range/radio inputs are measured separately.
    const q = 'input:not([type=hidden]):not([type=range]):not([type=radio]):not([type=checkbox]),select,textarea,[role=progressbar]';
    for (const el of root.querySelectorAll(q)) {
      if (!visible(el)) { /* visually-hidden checkboxes behind a custom switch: look at the sibling */ continue; }
      const cs = getComputedStyle(el);
      const { color: around } = backdrop(el.parentElement || el);
      const own = rgba(cs.backgroundColor);
      const bcol = rgba(cs.borderTopColor);
      const bw = parseFloat(cs.borderTopWidth);
      const outl = cs.outlineStyle !== 'none' ? rgba(cs.outlineColor) : null;
      const cands = [];
      if (bw >= 1 && cs.borderTopStyle !== 'none' && bcol[3] > 0) cands.push(['border', ratio(over(bcol, around), around)]);
      if (own[3] > 0.05) cands.push(['fill', ratio(over(own, around), around)]);
      const best = cands.length ? Math.max(...cands.map((c) => c[1])) : 0;
      rows.push({
        sel: sel(el), type: el.getAttribute('type') || el.getAttribute('role') || el.tagName.toLowerCase(),
        label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30),
        edge: cands.map((c) => c[0] + ':' + Math.round(c[1] * 100) / 100).join(' '), best: Math.round(best * 100) / 100,
        fail: best < 3 && !el.disabled,
      });
    }
    return rows;
  }

  const INTERACTIVE = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[role=switch],[role=checkbox],[role=radio],[role=tab],[role=slider],[role=menuitem],[tabindex]:not([tabindex="-1"])';
  function targets(rootSel = 'body') {
    const root = document.querySelector(rootSel) || document.body;
    const items = [];
    for (const el of root.querySelectorAll(INTERACTIVE)) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      // an input hidden visually (sr-only) with a visible label as the target: use the label rect
      let rect = r;
      let via = '';
      if ((el.type === 'checkbox' || el.type === 'radio') && r.width < 4) { const lab = el.closest('label'); if (lab) { rect = lab.getBoundingClientRect(); via = 'label'; } }
      const inline = el.tagName === 'A' && cs.display === 'inline' && !!el.closest('p,li,span,div') && ownText(el.parentElement || el).length > ownText(el).length + 8;
      items.push({ el, sel: sel(el), name: (el.getAttribute('aria-label') || el.innerText || el.value || el.title || '').trim().slice(0, 30), w: Math.round(rect.width * 10) / 10, h: Math.round(rect.height * 10) / 10, x: rect.x, y: rect.y, cx: rect.x + rect.width / 2, cy: rect.y + rect.height / 2, rect, inline, via });
    }
    const small = items.filter((i) => i.w < 24 || i.h < 24);
    const out = [];
    for (const s of small) {
      // spacing exception: a 24px circle centred on the target must not touch another target (rect) or another small target's circle
      let touches = false;
      for (const o of items) {
        if (o === s || o.el.contains(s.el) || s.el.contains(o.el)) continue;
        // distance from circle centre to the other rect
        const dx = Math.max(o.rect.left - s.cx, 0, s.cx - o.rect.right);
        const dy = Math.max(o.rect.top - s.cy, 0, s.cy - o.rect.bottom);
        if (Math.hypot(dx, dy) < 12) { touches = true; break; }
      }
      out.push({ sel: s.sel, name: s.name, w: s.w, h: s.h, inlineLink: s.inline, spacingOk: !touches, via: s.via, fail: !s.inline && touches });
    }
    return { total: items.length, small: out, min: items.reduce((m, i) => Math.min(m, i.w, i.h), 9999), under44: items.filter((i) => i.w < 44 || i.h < 44).length };
  }

  function focusables(rootSel = 'body') {
    const root = document.querySelector(rootSel) || document.body;
    return [...root.querySelectorAll(INTERACTIVE)].filter(visible).map((el) => ({ sel: sel(el), tab: el.tabIndex }));
  }

  function describe(el) {
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      sel: sel(el), tag: el.tagName.toLowerCase(), role: el.getAttribute('role') || '',
      name: (el.getAttribute('aria-label') || el.innerText || el.value || el.title || '').trim().replace(/\s+/g, ' ').slice(0, 40),
      type: el.getAttribute('type') || '',
      fv: el.matches(':focus-visible'),
      outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineOffset}`,
      boxShadow: cs.boxShadow === 'none' ? '' : cs.boxShadow.slice(0, 60),
      rect: (() => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
    };
  }

  function anchors() {
    // sanity anchors: body text vs page, with a known-good ratio
    const tmp = [[0, 0, 0, 1], [255, 255, 255, 1]];
    return { blackOnWhite: Math.round(ratio(tmp[0], tmp[1]) * 100) / 100, canvasRed: rgba('oklch(60% 0.2 28)').slice(0, 3).join(',') };
  }

  // Colour transitions only advance with rendered frames; measure the settled colour instead of guessing a delay.
  async function settle(on = true) {
    let st = document.getElementById('__a11y_nt');
    if (on && !st) { st = document.createElement('style'); st.id = '__a11y_nt'; st.textContent = '*,*::before,*::after{transition:none!important}'; document.head.appendChild(st); }
    if (!on && st) st.remove();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return true;
  }

  // Live-region churn: how often the text inside aria-live / role=status / role=alert regions changes.
  const LIVE = '[aria-live]:not([aria-live=off]),[role=status],[role=alert],[role=log],[role=timer]';
  const liveLog = [];
  try {
    new MutationObserver((muts) => {
      for (const m of muts) {
        const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        const lr = el && el.closest && el.closest(LIVE);
        if (lr) liveLog.push({ t: performance.now(), sel: sel(lr), role: lr.getAttribute('role') || '', live: lr.getAttribute('aria-live') || '', text: (lr.innerText || '').replace(/\s+/g, ' ').slice(0, 70) });
      }
    }).observe(document, { subtree: true, childList: true, characterData: true });
  } catch (e) { /* no document yet */ }
  const liveReset = () => { liveLog.length = 0; };
  const liveReport = () => {
    const by = {};
    for (const e of liveLog) { const k = e.sel + ' [' + (e.role || e.live) + ']'; (by[k] ||= { n: 0, first: e.t, last: e.t, sample: e.text }).n++; by[k].last = e.t; by[k].sample = e.text; }
    return Object.entries(by).map(([k, v]) => ({ region: k, changes: v.n, perSec: Math.round((v.n / Math.max(1, (v.last - v.first) / 1000)) * 10) / 10, sample: v.sample }));
  };

  window.__a11y = { liveReset, liveReport, settle, contrast, uiContrast, targets, focusables, describe, anchors, rgba, ratio, over, backdrop, sel, visible };
})();
