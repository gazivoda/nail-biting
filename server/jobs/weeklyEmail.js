// The weekly summary job (WS5). Runs hourly inside the web server (same pattern as
// trialFollowup.js) and mails each OPTED-IN person one summary of the last
// completed week, built from their SYNCED events only.
//
// Who gets an email: opted in (email_preferences.weekly_summary = 1), has an
// address on the account, has synced events (store.counts(...).live > 0), and had at
// least one bite in the week or the week before. Nobody else, ever.
//
// When: the "last completed week" is the ISO week (Monday 00:00 to Monday 00:00)
// in the person's own time zone. A summary goes out from 8 hours after that week
// ended until 72 hours after, and only if the week ended AFTER the person opted in
// (switching it on on a Monday morning does not mail last week at once). Outside
// that window a missed week is simply skipped: a stale summary is worse than none.
//
// How often: once per person per ISO week, and a restart, a second instance or an
// overlapping run cannot change that. The job CLAIMS the week with a single UPDATE
// (prefs.claimWeek) and only the caller that changed the row sends. If the send
// fails the claim is handed back (releaseWeek) so the next hourly run tries again
// inside the window. A crash between "sent" and "recorded" cannot double-send; the
// worst case is one lost email.
//
// The Resend SDK does NOT throw when the API refuses a message: it returns
// `{ data: null, error }`. isSendSuccess() treats that (and any empty result) as a
// failure. The older emails in email.js still ignore it; they are not changed here.

import { createEventStore } from '../events/store.js';
import { createPrefsStore } from '../weeklyEmail/prefs.js';
import { weekBounds, validTimeZone } from '../weeklyEmail/week.js';
import { buildWeeklySummary } from '../weeklyEmail/summary.js';
import { signUnsubscribeToken } from '../weeklyEmail/token.js';
import { buildWeeklyEmail } from '../weeklyEmail/template.js';

export const HOUR = 60 * 60 * 1000;
/** A summary goes out no earlier than this long after the week ended... */
export const SEND_AFTER_MS = 8 * HOUR;
/** ...and no later than this long after. */
export const SEND_UNTIL_MS = 72 * HOUR;
/** Most emails one run will attempt, so a bug or a backlog cannot run away. */
export const MAX_SENDS_PER_RUN = 200;

export const unsubscribeUrl = (appUrl, token) => `${appUrl}/api/email/unsubscribe/${token}`;

/** True only for a result that says the message was accepted. */
export function isSendSuccess(result) {
  return result != null && typeof result === 'object' && !result.error && result.data != null;
}

/**
 * One pass over everyone who is opted in. Pure apart from the database and `send`.
 *
 * @param {object} p
 * @param {import('better-sqlite3').Database} p.db
 * @param {(msg: {to: string, subject: string, html: string, text: string, headers: Record<string,string>}) => Promise<unknown>} p.send
 * @param {number} [p.now]            epoch ms
 * @param {string} p.appUrl           site address used in the links
 * @param {{log: Function, warn: Function, error: Function}} [p.log]
 * @param {number} [p.cap]
 * @returns {Promise<{ considered: number, sent: number, failed: number, skipped: Record<string, number> }>}
 */
export async function runWeeklyEmail({ db, send, now = Date.now(), appUrl, log = console, cap = MAX_SENDS_PER_RUN, store, prefs }) {
  const events = store ?? createEventStore(db);
  const preferences = prefs ?? createPrefsStore(db);
  const findEmail = db.prepare('SELECT email FROM users WHERE id = ?');

  const result = { considered: 0, sent: 0, failed: 0, skipped: {} };
  const skip = reason => { result.skipped[reason] = (result.skipped[reason] ?? 0) + 1; };

  for (const row of preferences.listOptedIn()) {
    result.considered++;
    if (result.sent + result.failed >= cap) { skip('cap'); continue; }

    const email = findEmail.get(row.user_id)?.email;
    if (typeof email !== 'string' || email.trim() === '') { skip('no_email'); continue; }

    const tz = validTimeZone(row.timezone) ?? 'UTC';
    const bounds = weekBounds(now, tz);
    if (now < bounds.weekEnd + SEND_AFTER_MS) { skip('too_early'); continue; }
    if (now >= bounds.weekEnd + SEND_UNTIL_MS) { skip('too_late'); continue; }
    if (bounds.weekEnd <= (row.opted_in_at ?? 0)) { skip('opted_in_after_week'); continue; }
    if (row.last_sent_week !== null && row.last_sent_week >= bounds.weekKey) { skip('already_sent'); continue; }

    if (events.counts(row.user_id).live === 0) { skip('no_synced_data'); continue; }

    const weekEvents = events.listUserEvents(row.user_id, { since: bounds.prevWeekStart, until: bounds.weekEnd });
    const summary = buildWeeklySummary(weekEvents, { ...bounds, timeZone: tz });
    if (summary.thisWeek + summary.lastWeek === 0) { skip('nothing_to_say'); continue; }

    // Claim, then send. Only the run that changed the row may send.
    const previous = row.last_sent_week;
    if (!preferences.claimWeek(row.user_id, bounds.weekKey)) { skip('claimed_elsewhere'); continue; }

    let ok = false;
    try {
      const token = signUnsubscribeToken(row.user_id, row.unsubscribe_secret);
      const link = unsubscribeUrl(appUrl, token);
      const message = buildWeeklyEmail({ summary, weekStart: bounds.weekStart, weekEnd: bounds.weekEnd, timeZone: tz, appUrl, unsubscribeUrl: link });
      const response = await send({
        to: email,
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: {
          'List-Unsubscribe': `<${link}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });
      ok = isSendSuccess(response);
      if (!ok) log.error(`[weekly-email] not accepted for user ${row.user_id}, week ${bounds.weekKey}:`, response?.error?.name ?? response?.error?.message ?? 'no result');
    } catch (err) {
      log.error(`[weekly-email] send threw for user ${row.user_id}, week ${bounds.weekKey}:`, err?.name ?? 'error');
    }

    if (ok) {
      result.sent++;
      log.log(`[weekly-email] sent to user ${row.user_id} for ${bounds.weekKey}`);
    } else {
      result.failed++;
      preferences.releaseWeek(row.user_id, bounds.weekKey, previous);
    }
  }
  return result;
}

/**
 * Starts the hourly job. Returns the timer, or null when it must not run (no email
 * provider configured). `unref()` so the timer never keeps the process alive.
 *
 * @param {object} p
 * @param {import('better-sqlite3').Database} p.db
 * @param {Function} p.send
 * @param {string} p.appUrl
 * @param {Record<string, string | undefined>} [p.env]
 * @param {Function} [p.run]               replaced in tests
 * @param {Function} [p.setIntervalFn]     replaced in tests
 */
export function startWeeklyEmailJob({ db, send, appUrl, env = process.env, log = console, run = runWeeklyEmail, setIntervalFn = setInterval }) {
  if (!env.RESEND_API_KEY) {
    log.warn('[weekly-email] RESEND_API_KEY not set, job disabled');
    return null;
  }
  const tick = () => Promise.resolve()
    .then(() => run({ db, send, appUrl, now: Date.now(), log }))
    .catch(err => log.error('[weekly-email] run failed:', err?.message ?? err));
  tick();
  const timer = setIntervalFn(tick, HOUR);
  timer?.unref?.();
  return timer;
}
