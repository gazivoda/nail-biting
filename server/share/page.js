// The public share page (WS10): one self-contained HTML document, rendered on the
// server from the whitelisted summary object (summary.js) and from nothing else.
//
// Why it is not the app's HTML shell: that file loads Google Analytics, the app bundle
// and, with it, calls to /api/user/me, /api/features and /auth/providers. The address of
// a share page contains the token, so none of that may run here. This page has
//
//   * no <script src>, no stylesheet link, no third-party host of any kind;
//   * one small inline script (a print button) and one inline stylesheet, each allowed
//     by the SHA-256 of its exact text in the CSP (both are constants, so the page needs
//     no per-request nonce and every response for a dead link is byte-identical);
//   * fonts and the logo from this site only (`/fonts`, `/logo.svg`);
//   * charts drawn as inline SVG, with no style attributes (the CSP forbids them).
//
// It receives the summary object only, never an event, a user or a link, and it does
// not render the link's label (the owner's private note). Everything dynamic is passed
// through `esc()` even though it is only numbers, fixed labels and YYYY-MM-DD dates.

import { createHash } from 'node:crypto';

const esc = s => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-10-21' -> '21 Oct 2026'. Anything else -> ''. */
function longDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso));
  if (!m) return '';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? ''} ${m[1]}`;
}

function shiftDate(iso, days) {
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(t) ? new Date(t + days * 86400000).toISOString().slice(0, 10) : '';
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const TRIGGER_LABELS = {
  stress: 'Stress',
  focus: 'Deep focus',
  boredom: 'Boredom',
  unknown: 'Not sure',
  other: 'Other reasons',
};

// ── Charts ───────────────────────────────────────────────────────────────────

const CHART_W = 336;

/** Vertical bars. `values` oldest first. Bars never exceed the chart; the scale always reaches at least 3. */
function barChart({ values, height, barWidth, label, showValues }) {
  const n = values.length;
  const pitch = CHART_W / n;
  const top = Math.max(3, ...values);
  const labelRoom = showValues ? 18 : 2;
  const plot = height - labelRoom - 2;
  const bars = values.map((v, i) => {
    const h = v === 0 ? 1.5 : Math.max(2, (v / top) * plot);
    const x = i * pitch + (pitch - barWidth) / 2;
    const y = height - 2 - h;
    const rect = `<rect class="${v === 0 ? 'bar zero' : 'bar'}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth}" height="${h.toFixed(2)}" rx="2"/>`;
    const text = showValues && v > 0
      ? `<text class="val" x="${(x + barWidth / 2).toFixed(2)}" y="${(y - 4).toFixed(2)}" text-anchor="middle">${v}</text>`
      : '';
    return rect + text;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${CHART_W} ${height}" role="img" aria-label="${esc(label)}" focusable="false">`
    + `<line class="axis" x1="0" y1="${height - 1}" x2="${CHART_W}" y2="${height - 1}"/>${bars}</svg>`;
}

function hbar(label, n, total) {
  const pct = total > 0 ? Math.round((n / total) * 100) : 0;
  return `<li class="hbar"><span class="hbar-label">${esc(label)}</span>`
    + `<svg class="hbar-track" width="100%" height="10" aria-hidden="true" focusable="false">`
    + `<rect class="hbar-bg" width="100%" height="10" rx="5"/><rect class="hbar-fill" width="${pct}%" height="10" rx="5"/></svg>`
    + `<span class="hbar-n">${n} <span class="muted">(${pct}%)</span></span></li>`;
}

// ── Sections ─────────────────────────────────────────────────────────────────

function streakSection(streak) {
  if (!streak) return '';
  const firstEntry = streak.since === 'first_entry';
  const unit = streak.days === 1 ? 'day' : 'days';
  const heading = firstEntry ? 'Days with no logged bite' : 'Days since the last logged bite';
  const caption = firstEntry
    ? 'No bite has been logged yet, so this counts from the first entry in the synced history.'
    : 'Counted from the most recent bite the person logged. Under 24 hours shows as 0.';
  return `<section class="card streak" aria-labelledby="h-streak">
  <h2 id="h-streak">${heading}</h2>
  <p class="big"><span class="num">${streak.days}</span> <span class="unit">${unit}</span></p>
  <p class="cap">${caption}</p>
</section>`;
}

function countsSection(view) {
  const { totals, daily, weekly } = view;
  const detail = view.detail;
  const dailyLabel = `Bar chart, bites per day over the last ${view.window.dailyDays} days, oldest first: ${daily.join(', ')}.`;
  const weeklyLabel = `Bar chart, bites per block of 7 days over the last ${view.window.weeklyWeeks} blocks, oldest first: ${weekly.join(', ')}.`;
  const dailyStart = detail ? longDate(shiftDate(detail.today, -(view.window.dailyDays - 1))) : '4 weeks ago';
  const dailyEnd = detail ? longDate(detail.today) : 'Today';
  const weeklyStart = detail ? longDate(shiftDate(detail.today, -(view.window.weeklyWeeks * 7 - 1))) : '12 weeks ago';
  const weeklyEnd = detail ? longDate(detail.today) : 'This week';
  const busiestDay = Math.max(0, ...daily);
  return `<section class="card" aria-labelledby="h-counts">
  <h2 id="h-counts">Logged bites</h2>
  <dl class="stats">
    <div><dt>Last 7 days</dt><dd>${totals.last7Days}</dd></div>
    <div><dt>The 7 days before</dt><dd>${totals.previous7Days}</dd></div>
    <div><dt>Last 12 weeks</dt><dd>${totals.last12Weeks}</dd></div>
  </dl>
  <div class="charts">
    <figure>
      <figcaption>Each day, last 4 weeks${busiestDay > 0 ? ` <span class="muted">(most in one day: ${busiestDay})</span>` : ''}</figcaption>
      ${barChart({ values: daily, height: 96, barWidth: 7, label: dailyLabel, showValues: false })}
      <div class="axis-labels"><span>${esc(dailyStart)}</span><span>${esc(dailyEnd)}</span></div>
    </figure>
    <figure>
      <figcaption>Each week, last 12 weeks</figcaption>
      ${barChart({ values: weekly, height: 118, barWidth: 20, label: weeklyLabel, showValues: true })}
      <div class="axis-labels"><span>${esc(weeklyStart)}</span><span>${esc(weeklyEnd)}</span></div>
    </figure>
  </div>
</section>`;
}

function triggersSection(view) {
  const total = view.triggers.reduce((s, t) => s + t.count, 0);
  const rows = view.triggers.filter(t => t.count > 0).map(t => hbar(TRIGGER_LABELS[t.key] ?? 'Other reasons', t.count, total)).join('');
  return `<section class="card" aria-labelledby="h-triggers">
  <h2 id="h-triggers">What set it off</h2>
  <p class="cap">The reason the person picked when they logged a bite, over the last 12 weeks. They choose it themselves, so it is their view, not a measurement.</p>
  ${total > 0 ? `<ul class="hbars">${rows}</ul>` : '<p>No bites were logged in the last 12 weeks.</p>'}
</section>`;
}

function competingSection(cr) {
  const body = cr.ratePercent === null
    ? '<p>No alarms with a competing-response prompt in the last 12 weeks.</p>'
    : `<p class="big small"><span class="num">${cr.ratePercent}%</span></p>
  <p>${plural(cr.completed, 'alarm')} of ${plural(cr.alarms, 'alarm')} in the last 12 weeks ${cr.completed === 1 ? 'was' : 'were'} followed by a finished competing response.</p>`;
  return `<section class="card" aria-labelledby="h-cr">
  <h2 id="h-cr">After an alarm</h2>
  <p class="cap">A competing response is a short alternative action the person picks in the app to do when an alarm sounds.</p>
  ${body}
</section>`;
}

function hoursSection(detail) {
  const values = detail.byHour;
  const total = values.reduce((s, n) => s + n, 0);
  const label = `Bar chart, bites by hour of the day from midnight, over the last 12 weeks: ${values.join(', ')}.`;
  return `<section class="card" aria-labelledby="h-hours">
  <h2 id="h-hours">Time of day</h2>
  <p class="cap">Bites by the hour of the day they were logged, over the last 12 weeks.</p>
  ${total > 0
    ? `<figure>${barChart({ values, height: 84, barWidth: 9, label, showValues: false })}
  <div class="axis-labels four"><span>12 am</span><span>6 am</span><span>12 pm</span><span>6 pm</span></div></figure>`
    : '<p>No bites were logged in the last 12 weeks.</p>'}
  ${detail.lastBiteDate ? `<p>Last logged bite: <strong>${esc(longDate(detail.lastBiteDate))}</strong></p>` : ''}
</section>`;
}

function aboutSection(view) {
  return `<section class="card about" aria-labelledby="h-about">
  <h2 id="h-about">How to read this page</h2>
  <ul>
    <li>It is made from the history the person chose to sync from the Stop Biting app. Entries that have not synced yet are not included, so it can be a little behind.</li>
    <li>A bite is an entry the person logged by hand, or an alarm they confirmed as a bite. Urges, entries marked as not a bite, and deleted entries are not counted.</li>
    <li>The streak counts whole days since the last logged bite. The app keeps its own streak start date on each device, so the two can differ.</li>
    <li>Days are the person's own days, in their time zone.</li>
    <li>${view.detailed
      ? 'The person chose to include calendar dates and the time of day. No single entry, name, email, photo or camera data is shown.'
      : 'The person chose not to include dates, so charts show positions such as "Today" and "4 weeks ago". No name, email, photo, camera data or exact time is shown.'}</li>
  </ul>
</section>`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

const CSS = `
@font-face { font-family: 'Bricolage Grotesque'; font-style: normal; font-weight: 200 800; font-display: swap; src: url(/fonts/bricolage-latin.woff2) format('woff2'); }
@font-face { font-family: Geist; font-style: normal; font-weight: 100 900; font-display: swap; src: url(/fonts/geist-latin.woff2) format('woff2'); }
:root {
  color-scheme: light dark;
  --paper: #f7f7f1; --surface: #ffffff; --ink: #0f1d17; --ink-2: #3b4a43; --line: #dfe3d9;
  --deep: #0b2a1e; --signal: #c6f24e; --bar: #2a6a46; --bar-zero: #aab5ac; --fill-bg: #e6eadf;
  --display: 'Bricolage Grotesque', Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --sans: Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
@supports (color: oklch(0% 0 0)) {
  :root {
    --paper: oklch(97.6% 0.008 105); --surface: oklch(100% 0 0); --ink: oklch(19% 0.03 160); --ink-2: oklch(42% 0.025 160);
    --line: oklch(90% 0.01 130); --deep: oklch(25% 0.05 162); --signal: oklch(90% 0.2 124);
    --bar: oklch(46% 0.13 148); --bar-zero: oklch(76% 0.016 150); --fill-bg: oklch(93% 0.012 140);
  }
}
@media (prefers-color-scheme: dark) {
  :root {
    --paper: #0d1a14; --surface: #12211a; --ink: #e3ebe5; --ink-2: #b3c0b8; --line: #2c3d33;
    --deep: #12211a; --signal: #c6f24e; --bar: #c6f24e; --bar-zero: #4a5d52; --fill-bg: #22332a;
  }
  @supports (color: oklch(0% 0 0)) {
    :root {
      --paper: oklch(15% 0.02 165); --surface: oklch(18% 0.02 165); --ink: oklch(92% 0.012 150); --ink-2: oklch(76% 0.015 155);
      --line: oklch(30% 0.018 165); --deep: oklch(18% 0.02 165); --signal: oklch(90% 0.2 124);
      --bar: oklch(84% 0.19 124); --bar-zero: oklch(42% 0.02 160); --fill-bg: oklch(24% 0.02 165);
    }
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--sans); font-size: 1rem; line-height: 1.6; -webkit-font-smoothing: antialiased; }
.wrap { max-width: 46rem; margin: 0 auto; padding: 0 16px; }
header.top { border-bottom: 1px solid var(--line); }
header.top .wrap { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 60px; }
.brand { display: inline-flex; align-items: center; gap: 10px; color: var(--ink); text-decoration: none; font-family: var(--display); font-weight: 800; font-size: 1.125rem; letter-spacing: -0.02em; }
.brand img { display: block; border-radius: 7px; }
.tag { font-size: 0.875rem; color: var(--ink-2); }
main { padding: 28px 0 48px; }
h1 { font-family: var(--display); font-weight: 800; font-size: clamp(1.9rem, 1.3rem + 2.6vw, 2.75rem); line-height: 1.02; letter-spacing: -0.04em; margin: 0 0 12px; }
h2 { font-family: var(--display); font-weight: 750; font-size: 1.25rem; line-height: 1.15; letter-spacing: -0.03em; margin: 0 0 8px; }
p { margin: 0 0 12px; }
.lede { color: var(--ink-2); max-width: 38rem; }
.note { border: 1px solid var(--line); background: var(--surface); border-radius: 1.25rem; padding: 14px 16px; margin: 16px 0 20px; font-size: 0.9375rem; }
.note p:last-child { margin-bottom: 0; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 1.25rem; padding: 20px; margin: 0 0 16px; }
.cap, .muted { color: var(--ink-2); }
.cap { font-size: 0.9375rem; }
.streak { background: var(--deep); border-color: transparent; color: #ffffff; }
.streak h2 { color: #ffffff; }
.streak .cap { color: rgba(255, 255, 255, 0.82); margin-bottom: 0; }
.big { margin: 4px 0 8px; line-height: 0.95; }
.big .num { font-family: var(--display); font-weight: 800; letter-spacing: -0.05em; font-size: clamp(4rem, 3rem + 8vw, 6rem); font-variant-numeric: tabular-nums; }
.big .unit { font-family: var(--display); font-weight: 700; font-size: 1.5rem; letter-spacing: -0.02em; }
.streak .unit { color: var(--signal); }
.big.small .num { font-size: clamp(2.6rem, 2rem + 4vw, 3.5rem); }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 8px 0 16px; }
.stats div { border: 1px solid var(--line); border-radius: 1rem; padding: 10px 12px; }
.stats dt { font-size: 0.8125rem; color: var(--ink-2); line-height: 1.3; }
.stats dd { margin: 2px 0 0; font-family: var(--display); font-weight: 800; font-size: 1.75rem; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.charts { display: grid; gap: 20px; }
figure { margin: 0; }
figcaption { font-weight: 600; font-size: 0.9375rem; margin-bottom: 6px; }
figcaption .muted { font-weight: 400; }
.chart { display: block; width: 100%; max-width: 440px; height: auto; overflow: visible; }
.chart .bar { fill: var(--bar); }
.chart .bar.zero { fill: var(--bar-zero); }
.chart .axis { stroke: var(--line); stroke-width: 1; }
.chart .val { font: 600 12px var(--sans); fill: var(--ink-2); }
.axis-labels { display: flex; justify-content: space-between; max-width: 440px; font-size: 0.8125rem; color: var(--ink-2); margin-top: 4px; }
.hbars { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 10px; }
.hbar { display: grid; grid-template-columns: 7.5rem 1fr auto; align-items: center; gap: 10px; }
.hbar-label { font-size: 0.9375rem; }
.hbar-track { display: block; }
.hbar-bg { fill: var(--fill-bg); }
.hbar-fill { fill: var(--bar); }
.hbar-n { font-variant-numeric: tabular-nums; font-weight: 600; text-align: right; min-width: 5.5rem; }
.hbar-n .muted { font-weight: 400; }
.about ul { margin: 0; padding-left: 1.2rem; font-size: 0.9375rem; color: var(--ink-2); }
.about li { margin-bottom: 6px; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 8px; }
.btn { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 22px; border-radius: 999px; font: 700 1rem var(--display); cursor: pointer; border: 2px solid var(--ink); background: transparent; color: var(--ink); }
.btn:hover { background: var(--surface); }
.needs-js { display: none; }
.js .needs-js { display: inline-flex; }
.print-only { display: none; }
a { color: var(--bar); }
a:focus-visible, button:focus-visible { outline: 2px solid var(--bar); outline-offset: 3px; }
footer { color: var(--ink-2); font-size: 0.875rem; }
footer p { margin-bottom: 6px; }
@media (min-width: 720px) {
  .charts { grid-template-columns: 1fr 1fr; }
  .stats dd { font-size: 2rem; }
}
@media (max-width: 420px) {
  .hbar { grid-template-columns: 1fr auto; }
  .hbar-track { grid-column: 1 / -1; grid-row: 2; }
  .hbar-label { grid-column: 1; grid-row: 1; }
  .hbar-n { grid-column: 2; grid-row: 1; }
}
@media print {
  @page { size: A4; margin: 12mm; }
  :root { --paper: #fff; --surface: #fff; --ink: #111; --ink-2: #333; --line: #bbb; --deep: #fff; --signal: #111; --bar: #1f5a3a; --bar-zero: #999; --fill-bg: #e5e5e5; }
  html, body { background: #fff; color: #111; }
  body { font-size: 10.5pt; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  header.top .wrap { min-height: 0; padding-top: 0; padding-bottom: 6px; }
  .wrap { max-width: none; padding: 0; }
  main { padding: 8px 0 0; }
  h1 { font-size: 20pt; margin-bottom: 4px; }
  h2 { font-size: 12pt; margin-bottom: 4px; }
  .lede { display: none; }
  .note { margin: 8px 0 10px; padding: 8px 10px; font-size: 9pt; }
  .card { break-inside: avoid; padding: 10px 12px; margin-bottom: 8px; border-radius: 10px; }
  .streak { background: #fff; color: #111; border: 1px solid #bbb; }
  .streak h2, .streak .cap, .streak .unit { color: #111; }
  .big { margin: 0 0 2px; }
  .big .num { font-size: 34pt; }
  .big.small .num { font-size: 24pt; }
  .big .unit { font-size: 12pt; }
  .stats { gap: 6px; margin: 4px 0 8px; }
  .stats dd { font-size: 15pt; }
  .charts { grid-template-columns: 1fr 1fr; gap: 12px; }
  .chart, .axis-labels { max-width: none; }
  .hbars { gap: 6px; }
  .about ul { font-size: 8.5pt; }
  .btn, .no-print { display: none !important; }
  .js .print-only { display: block; }
  a { color: #111; text-decoration: none; }
}
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
`;

const SCRIPT = `(function () {
  document.documentElement.classList.add('js');
  var btn = document.getElementById('print-btn');
  if (btn && typeof window.print === 'function') btn.addEventListener('click', function () { window.print(); });
  var on = document.getElementById('printed-on');
  if (on) { try { on.textContent = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) {} }
})();`;

const sha256 = text => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;
const STYLE_HASH = sha256(CSS);
const SCRIPT_HASH = sha256(SCRIPT);

function shell({ title, body, withScript }) {
  const scriptTag = withScript ? `<script>${SCRIPT}</script>` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="light dark">
<title>${esc(title)}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>${CSS}</style>
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="/" rel="noreferrer noopener"><img src="/logo.svg" alt="" width="28" height="28">Stop Biting</a>
  <span class="tag">Shared summary</span>
</div></header>
<main><div class="wrap">
${body}
</div></main>
${scriptTag}
</body>
</html>`;
}

/**
 * The share page for a summary object from buildShareView().
 * @param {object} view
 */
export function renderSharePage(view) {
  const intro = `<h1>Shared summary</h1>
<p class="lede">The person who made this link chose to share these counts with you. The page is read-only.</p>
<aside class="note" aria-label="About this page">
  <p><strong>Shared by the person who made this link.</strong> They can stop sharing at any time, and revoked links stop working straight away.</p>
  <p>It shows counts and groups from a habit log they kept. It is not a diagnosis or a clinical assessment: Stop Biting is an app, not a clinician.</p>
</aside>
<p class="print-only" id="printed">Printed on <span id="printed-on"></span></p>`;

  const sections = view.hasData
    ? [
        streakSection(view.streak),
        countsSection(view),
        triggersSection(view),
        competingSection(view.competingResponse),
        view.detail ? hoursSection(view.detail) : '',
        aboutSection(view),
      ].join('\n')
    : `<section class="card" aria-labelledby="h-empty">
  <h2 id="h-empty">No history to show yet</h2>
  <p>The person who made this link has not synced any history from the Stop Biting app, so there is nothing to show yet. Sharing works from history they choose to sync; once they do, their summary will appear here.</p>
</section>`;

  const footer = `<footer class="no-print">
  <div class="actions"><button type="button" class="btn needs-js" id="print-btn">Print or save as PDF</button></div>
  <p>This page loads nothing from other sites, sets no cookies and asks search engines not to list it.</p>
</footer>`;

  return shell({ title: 'Shared summary | Stop Biting', body: `${intro}\n${sections}\n${footer}`, withScript: true });
}

/**
 * What every dead link shows: unknown, revoked, expired or mistyped. ONE constant, no script,
 * nothing that depends on which of those it was.
 */
export const NOT_FOUND_PAGE = shell({
  title: 'Link not found | Stop Biting',
  withScript: false,
  body: `<h1>This link does not work.</h1>
<p class="lede">The link may have been stopped by the person who shared it, it may have expired, or the address may be mistyped. If you were expecting a summary, ask the person for a new link.</p>
<p><a href="/">Go to Stop Biting</a></p>`,
});

/** A plain page for "too many requests", with no data in it. */
export const TOO_MANY_PAGE = shell({
  title: 'Please wait | Stop Biting',
  withScript: false,
  body: `<h1>Please try again in a few minutes.</h1>
<p class="lede">This page has been opened too many times from your connection in a short while.</p>`,
});

/**
 * The CSP for these pages: this origin's fonts and logo, plus exactly the one inline style and
 * (on the summary page only) the one inline script, matched by hash. Nothing else loads or runs.
 */
export function pageCsp({ script }) {
  return [
    "default-src 'none'",
    `style-src ${STYLE_HASH}`,
    `script-src ${script ? SCRIPT_HASH : "'none'"}`,
    "font-src 'self'",
    "img-src 'self'",
    "connect-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}
