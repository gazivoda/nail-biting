// The share-link summary (WS10): the ONLY thing a share link can reveal.
//
// `buildShareView(events, { detailed, timezone, now })` takes a user's synced events
// (the WS4 event store: server/events/store.js `listUserEvents`) and returns a plain
// object that is safe to show to anyone holding the link. It works in two steps so the
// privacy property is easy to audit:
//
//   1. `analyse()` reads the events and returns NUMBERS ONLY: counts per bucket, a
//      streak length, a handful of totals. No event, id, string or timestamp from the
//      input survives this step except as a count or a position in a fixed-size array.
//   2. `toPublicView()` writes the output by naming every key literally (no spread, no
//      copying of an input object, no Object.assign). A field that is not written there
//      cannot reach the output, whatever an event contains.
//
// What the output contains (exact key sets are pinned by tests):
//
//   always         version, detailed, hasData, window, streak, totals, daily, weekly,
//                  triggers, competingResponse
//   detailed only  detail { today, lastBiteDate, byHour }
//
// Never present, in either mode: event ids, device ids, hands, behaviors, free text,
// custom reason names, per-event timestamps, the owner's name, email or time zone.
//
// ── Definitions (the server's own, worked out from synced events only) ─────────────
//
// An event is "live" when it is not deleted (the event store already leaves tombstones
// out; they are skipped here too).
//
//   urge    a manual event whose first trigger is `urge` (the WS2 urge timer). Not a bite.
//   bite    live, not marked `falsePositive`, not an urge, and either logged by hand
//           (source `manual`) or an alarm the person confirmed (`confirmed: true`).
//           This is the app's `isBite` (useAppStore.ts) restated on the wire shape.
//           An unconfirmed alarm is "awaiting review" and is not a bite.
//   alarm   live, source `alarm`, not marked `falsePositive` (WS2's `coachingStats`).
//
// Streak: whole days since the NEWEST bite (`since: 'last_bite'`). When the account has
// synced entries but no bite at all, the streak runs from the OLDEST synced entry of any
// kind (`since: 'first_entry'`), which mirrors the app's "last bite, else first open".
// With no synced entries there is no streak (`null`) and `hasData` is false.
// Known limits, stated on the public page too: the app keeps its streak start date per
// device (WS4 "Known limitations"; `firstOpenTime` and `historyStartTime` are not
// synced), so this figure can differ from the app's; and an entry that has not synced
// yet is not counted, so the streak can read longer than the app shows.
//
// Windows are in the OWNER's time zone (stored on the link), ending today:
//   daily    the last 28 days, oldest first (index 27 is today)
//   weekly   the last 12 blocks of 7 days, oldest first (index 11 is the last 7 days)
//   triggers every bite in those 12 weeks, grouped by the bite's first trigger into the
//            fixed keys stress | focus | boredom | unknown | other. Anything that is not
//            one of the four preset ids (custom reasons, free text) is `other`, so no
//            string a person typed can leave the server.
//   competingResponse   WS2's rule over the same 12 weeks: among alarms, the window
//            starts at the first alarm that carried a competing response; the rate is
//            completed / alarms. `ratePercent` is null when that window has no alarms.
//   byHour   (detailed) bites per local hour of day over the same 12 weeks.

const DAY_MS = 24 * 60 * 60 * 1000;

export const VIEW_VERSION = 1;
export const DAILY_DAYS = 28;
export const WEEKLY_WEEKS = 12;
export const WINDOW_DAYS = WEEKLY_WEEKS * 7;
export const TRIGGER_KEYS = Object.freeze(['stress', 'focus', 'boredom', 'unknown', 'other']);

// Same bounds the sync validator enforces on `ts` (server/events/limits.js). Anything outside
// is not a real entry; skipping it here keeps a corrupt row from producing an absurd date.
const MAX_TS = Date.UTC(2100, 0, 1);

const PRESET_TRIGGERS = new Set(['stress', 'focus', 'boredom', 'unknown']);

const isRecord = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const zeros = n => Array.from({ length: n }, () => 0);
const count = x => (Number.isSafeInteger(x) && x >= 0 ? x : 0);

/** A valid IANA zone name, or 'UTC'. Whatever the client sent, this never throws. */
export function normalizeTimezone(tz) {
  if (typeof tz !== 'string' || tz.length === 0 || tz.length > 64) return 'UTC';
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** ts (epoch ms) -> { dayNum, hour } in `timezone`. dayNum counts local calendar days since 1970-01-01. */
function makeClock(timezone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', hourCycle: 'h23',
  });
  return ts => {
    let y = 1970, m = 1, d = 1, h = 0;
    for (const p of fmt.formatToParts(ts)) {
      if (p.type === 'year') y = Number(p.value);
      else if (p.type === 'month') m = Number(p.value);
      else if (p.type === 'day') d = Number(p.value);
      else if (p.type === 'hour') h = Number(p.value) % 24;
    }
    return { dayNum: Math.floor(Date.UTC(y, m - 1, d) / DAY_MS), hour: h };
  };
}

const dayNumToDate = n => new Date(n * DAY_MS).toISOString().slice(0, 10); // YYYY-MM-DD

function triggerKey(first) {
  if (first === undefined || first === 'auto-detected') return 'unknown'; // an alarm nobody has labelled
  return PRESET_TRIGGERS.has(first) ? first : 'other';
}

/**
 * Step 1. Numbers only. Exported for tests; the app only calls buildShareView.
 *
 * @param {readonly object[]} events canonical wire events (any junk is skipped, nothing throws)
 * @param {{ now: number, timezone: string }} ctx
 */
export function analyse(events, { now, timezone }) {
  const clock = makeClock(timezone);
  const todayNum = clock(now).dayNum;
  const lo = now - (WINDOW_DAYS + 2) * DAY_MS; // cheap pre-filter; the exact test is by local day
  const hi = now + 2 * DAY_MS;

  const a = {
    live: 0,
    firstEntryTs: null,
    lastBiteTs: null,
    daily: zeros(DAILY_DAYS),
    weekly: zeros(WEEKLY_WEEKS),
    byHour: zeros(24),
    triggers: Object.fromEntries(TRIGGER_KEYS.map(k => [k, 0])),
    alarms: [], // { ts, prompted, done } for alarms inside the window
  };

  for (const e of events) {
    if (!isRecord(e) || e.deleted === true) continue;
    const ts = e.ts;
    if (typeof ts !== 'number' || !Number.isFinite(ts) || ts < 0 || ts >= MAX_TS) continue;

    a.live++;
    if (a.firstEntryTs === null || ts < a.firstEntryTs) a.firstEntryTs = ts;

    const falsePositive = e.falsePositive === true;
    const first = Array.isArray(e.triggers) && typeof e.triggers[0] === 'string' ? e.triggers[0] : undefined;
    const urge = e.source === 'manual' && first === 'urge';
    const bite = !falsePositive && !urge && (e.source === 'manual' || e.confirmed === true);
    const alarm = e.source === 'alarm' && !falsePositive;

    if (bite && (a.lastBiteTs === null || ts > a.lastBiteTs)) a.lastBiteTs = ts;
    if (!bite && !alarm) continue;
    if (ts < lo || ts > hi) continue;

    const { dayNum, hour } = clock(ts);
    const ago = todayNum - dayNum;
    if (ago < 0 || ago >= WINDOW_DAYS) continue;

    if (bite) {
      if (ago < DAILY_DAYS) a.daily[DAILY_DAYS - 1 - ago]++;
      a.weekly[WEEKLY_WEEKS - 1 - Math.floor(ago / 7)]++;
      a.byHour[hour]++;
      a.triggers[triggerKey(first)]++;
    }
    if (alarm) {
      const cr = isRecord(e.competingResponse) ? e.competingResponse : null;
      a.alarms.push({ ts, prompted: cr !== null, done: cr !== null && cr.done === true });
    }
  }

  // Competing response, WS2's rule (src/utils/coachingStats.ts): the window opens at the
  // first alarm that carried a prompt; every alarm from then on is in the denominator.
  let since = null;
  for (const al of a.alarms) if (al.prompted && (since === null || al.ts < since)) since = al.ts;
  const inWindow = since === null ? [] : a.alarms.filter(al => al.ts >= since);
  a.response = { alarms: inWindow.length, completed: inWindow.filter(al => al.prompted && al.done).length };

  // Streak (see the header for the definition).
  if (a.lastBiteTs !== null) {
    a.streak = { since: 'last_bite', days: Math.floor(Math.max(0, now - a.lastBiteTs) / DAY_MS) };
  } else if (a.firstEntryTs !== null) {
    a.streak = { since: 'first_entry', days: Math.floor(Math.max(0, now - a.firstEntryTs) / DAY_MS) };
  } else {
    a.streak = null;
  }

  a.todayNum = todayNum;
  // A bite dated in the future (a device clock set ahead) is shown as today, never as a later date.
  a.lastBiteDayNum = a.lastBiteTs === null ? null : Math.min(clock(a.lastBiteTs).dayNum, todayNum);
  return a;
}

const sum = (arr, from, to) => arr.slice(from, to).reduce((s, n) => s + n, 0);

/**
 * Step 2. The whitelist. Every key of the output is written out here, once, from the
 * numbers `analyse` produced. Nothing is spread or copied from an event.
 */
export function toPublicView(a, detailed) {
  const isDetailed = detailed === true;
  const daily = a.daily.map(count);
  const weekly = a.weekly.map(count);

  const view = {
    version: VIEW_VERSION,
    detailed: isDetailed,
    hasData: a.live > 0,
    window: { dailyDays: DAILY_DAYS, weeklyWeeks: WEEKLY_WEEKS },
    streak: a.streak === null
      ? null
      : { days: count(a.streak.days), since: a.streak.since === 'last_bite' ? 'last_bite' : 'first_entry' },
    totals: {
      last7Days: sum(daily, DAILY_DAYS - 7, DAILY_DAYS),
      previous7Days: sum(daily, DAILY_DAYS - 14, DAILY_DAYS - 7),
      last12Weeks: sum(weekly, 0, WEEKLY_WEEKS),
    },
    daily,
    weekly,
    triggers: TRIGGER_KEYS.map(key => ({ key, count: count(a.triggers[key]) })),
    competingResponse: {
      alarms: count(a.response.alarms),
      completed: count(a.response.completed),
      ratePercent: a.response.alarms > 0 ? Math.round((count(a.response.completed) / a.response.alarms) * 100) : null,
    },
  };

  if (isDetailed) {
    view.detail = {
      today: dayNumToDate(a.todayNum),
      lastBiteDate: a.lastBiteDayNum === null ? null : dayNumToDate(a.lastBiteDayNum),
      byHour: a.byHour.map(count),
    };
  }
  return view;
}

/**
 * The share-link summary for a user's events.
 *
 * @param {readonly object[]} events  canonical wire events from the event store
 * @param {{ detailed?: boolean, timezone?: string, now?: number }} [options]
 */
export function buildShareView(events, { detailed = false, timezone = 'UTC', now = Date.now() } = {}) {
  return toPublicView(analyse(events, { now, timezone: normalizeTimezone(timezone) }), detailed === true);
}
