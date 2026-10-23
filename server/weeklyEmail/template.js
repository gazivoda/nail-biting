// The weekly summary email (WS5): subject, HTML and plain text.
//
// Same look as the other emails in email.js (cream page, forest ink, 28px card,
// pill button), no images and no illustrations. Plain words: where the numbers
// come from, what a bite is, no cause claimed, nothing medical. The person's email
// address is never in the body; their name is not used at all.

const BRAND_INK = '#0B2A1E';
const BODY_INK = '#1F2F27';
const MUTED_INK = '#5F6F67';
const SECONDARY_INK = '#3F5249';

export const WEEKLY_SUBJECT = 'Your week with Stop Biting';

/** HTML-escapes text for element content and double-quoted attributes. */
export function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function listWords(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** 'Mon 13 Oct' in the person's zone, for the first and last day of the week. */
export function weekRangeLabel(weekStart, weekEnd, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short' });
  return `${fmt.format(new Date(weekStart))} to ${fmt.format(new Date(weekEnd - 1))}`;
}

/**
 * The sentences, as data, so the HTML and the text part say exactly the same thing.
 * @param {ReturnType<import('./summary.js').buildWeeklySummary>} s
 */
export function summaryLines(s) {
  const lines = { headline: '', compare: null, trigger: null, quiet: null, review: null };

  lines.headline = s.thisWeek === 0 ? 'No bites logged this week' : `${plural(s.thisWeek, 'bite', 'bites')} logged this week`;

  if (s.lastWeek > 0) {
    if (s.direction === 'same') lines.compare = `The same as the week before (${s.lastWeek}).`;
    else if (s.direction === 'down' || s.direction === 'up') {
      const pct = Math.abs(s.changePct ?? 0);
      const word = s.direction === 'down' ? 'fewer' : 'more';
      lines.compare = `${pct}% ${word} than the week before (${s.lastWeek}).`;
    }
  } else if (s.thisWeek > 0) {
    lines.compare = 'No bites were logged the week before, so there is nothing to compare with.';
  }

  if (s.topTrigger) {
    lines.trigger = `The reason you picked most often: ${s.topTrigger.label} (${s.topTrigger.count} of ${s.topTrigger.of} bites with a reason).`;
  }

  if (s.thisWeek > 0 && s.quietestDays) {
    lines.quiet = `Days with the fewest bites logged: ${listWords(s.quietestDays)}.`;
  }

  if (s.alarmsToReview > 0) {
    lines.review = `${plural(s.alarmsToReview, 'alarm is', 'alarms are')} still waiting for your review in History. Alarms only count as bites once you confirm them.`;
  }
  return lines;
}

const SOURCE_NOTE =
  'These numbers are built from the history you chose to sync. A bite is something you logged by hand or an alarm you confirmed.';
const ABOUT_NOTE = 'A log is a way to notice a habit, not a treatment.';

/**
 * @param {object} p
 * @param {ReturnType<import('./summary.js').buildWeeklySummary>} p.summary
 * @param {number} p.weekStart   epoch ms
 * @param {number} p.weekEnd     epoch ms (exclusive)
 * @param {string} p.timeZone
 * @param {string} p.appUrl      e.g. https://stopbiting.today
 * @param {string} p.unsubscribeUrl
 * @returns {{ subject: string, html: string, text: string }}
 */
export function buildWeeklyEmail({ summary, weekStart, weekEnd, timeZone, appUrl, unsubscribeUrl }) {
  const range = weekRangeLabel(weekStart, weekEnd, timeZone);
  const lines = summaryLines(summary);

  const extra = [lines.compare, lines.trigger, lines.quiet, lines.review].filter(Boolean);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>${esc(WEEKLY_SUBJECT)}</title>
</head>
<body style="margin:0;padding:0;background:#F7F7F1;font-family:-apple-system,BlinkMacSystemFont,Geist,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F1;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:32px 0 24px;text-align:center;">
              <span style="font-size:18px;font-weight:700;color:${BRAND_INK};letter-spacing:-0.5px;">
                Stop Biting
              </span>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:28px;border:1px solid #e5e1db;padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:13px;color:${MUTED_INK};">${esc(range)}</p>
              <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:${BRAND_INK};letter-spacing:-0.5px;">
                ${esc(lines.headline)}
              </h1>
${extra.map(line => `              <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:${BODY_INK};">${esc(line)}</p>`).join('\n')}
              <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:${MUTED_INK};">${esc(SOURCE_NOTE)}</p>
              <div style="margin-top:28px;text-align:center;">
                <a href="${esc(appUrl)}" style="display:inline-block;background:${BRAND_INK};color:#F7F7F1;font-weight:600;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:999px;">
                  Open the app
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0;text-align:center;font-size:12px;line-height:1.6;color:${MUTED_INK};">
              You get this because you turned on the weekly summary in Settings. It is one email a week.<br>
              <a href="${esc(unsubscribeUrl)}" style="color:${SECONDARY_INK};">Unsubscribe</a><br>
              ${esc(ABOUT_NOTE)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Stop Biting: ${range}`,
    '',
    lines.headline,
    ...extra,
    '',
    SOURCE_NOTE,
    '',
    `Open the app: ${appUrl}`,
    '',
    '--',
    'You get this because you turned on the weekly summary in Settings. It is one email a week.',
    `Unsubscribe: ${unsubscribeUrl}`,
    ABOUT_NOTE,
  ].join('\n');

  return { subject: WEEKLY_SUBJECT, html, text };
}

// ── The two pages behind the unsubscribe link ────────────────────────────────

const PAGE_STYLE = `body{margin:0;background:#F7F7F1;color:${BODY_INK};font-family:-apple-system,BlinkMacSystemFont,Geist,'Segoe UI',sans-serif}
main{max-width:520px;margin:12vh auto 0;padding:0 20px}
.card{background:#fff;border:1px solid #e5e1db;border-radius:28px;padding:36px 32px}
h1{margin:0 0 14px;font-size:24px;letter-spacing:-0.5px;color:${BRAND_INK}}
p{margin:0 0 16px;font-size:15px;line-height:1.7}
.brand{font-weight:700;color:${BRAND_INK};letter-spacing:-0.5px;margin:0 0 18px;text-align:center}
button,.btn{display:inline-block;background:${BRAND_INK};color:#F7F7F1;font:600 15px inherit;font-family:inherit;border:0;border-radius:999px;padding:14px 32px;text-decoration:none;cursor:pointer}
.muted{color:${MUTED_INK};font-size:13px}
a{color:${SECONDARY_INK}}`;

function page(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="referrer" content="no-referrer">
  <title>${esc(title)}</title>
  <style>${PAGE_STYLE}</style>
</head>
<body>
  <main>
    <p class="brand">Stop Biting</p>
    <div class="card">
${bodyHtml}
    </div>
  </main>
</body>
</html>`;
}

/** GET: asks first. A link in an email can be opened by a mail scanner, so opening it changes nothing. */
export function confirmPageHtml(postUrl) {
  return page('Unsubscribe from the weekly summary', `      <h1>Unsubscribe from the weekly summary?</h1>
      <p>You will stop getting the weekly summary email from Stop Biting. Your history and your account are not touched.</p>
      <form method="post" action="${esc(postUrl)}">
        <button type="submit">Unsubscribe</button>
      </form>`);
}

export function doneUnsubscribedPageHtml(appUrl) {
  return page('You are unsubscribed', `      <h1>You are unsubscribed</h1>
      <p>You will not get the weekly summary email any more. You can turn it back on in Settings, under Account &amp; Sync.</p>
      <p><a class="btn" href="${esc(appUrl)}">Open the app</a></p>`);
}

/** Same page for a link that is forged, damaged or unknown: nothing tells the cases apart. */
export function invalidLinkPageHtml(appUrl) {
  return page('This link does not work', `      <h1>This link does not work</h1>
      <p>It may be incomplete or out of date. To stop the weekly summary, open Settings in the app, under Account &amp; Sync, and turn it off.</p>
      <p><a href="${esc(appUrl)}">Open the app</a></p>`);
}
