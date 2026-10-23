import { describe, it, expect, vi } from 'vitest';
import { createMemoryDb } from '../../test-utils/memorySqlite.js';
import { runMigrations } from '../db/migrate.js';
import { EVENTS_MIGRATIONS, createEventStore } from '../events/store.js';
import { WEEKLY_EMAIL_MIGRATIONS, createPrefsStore } from '../weeklyEmail/prefs.js';
import { readUnsubscribeToken, verifyUnsubscribeToken } from '../weeklyEmail/token.js';
import {
  runWeeklyEmail, startWeeklyEmailJob, isSendSuccess, HOUR, SEND_AFTER_MS, SEND_UNTIL_MS, MAX_SENDS_PER_RUN,
} from './weeklyEmail.js';

const APP = 'https://stopbiting.test';
const utc = (...a) => Date.UTC(...a);
// Week W42 of 2026 in UTC: Mon 12 Oct 00:00 to Mon 19 Oct 00:00.
const WEEK_END = utc(2026, 9, 19);
const SEND_AT = WEEK_END + 9 * HOUR; // Monday 09:00 UTC, inside the window
const OPTED_IN = utc(2026, 9, 1);
const DAY = 24 * HOUR;

const quietLog = () => ({ log: vi.fn(), warn: vi.fn(), error: vi.fn() });

function world() {
  const db = createMemoryDb({ users: true });
  runMigrations(db, [...EVENTS_MIGRATIONS, ...WEEKLY_EMAIL_MIGRATIONS]);
  const store = createEventStore(db);
  let clock = OPTED_IN;
  const prefs = createPrefsStore(db, { now: () => clock });
  const sent = [];
  let n = 0;
  const w = {
    db, store, prefs, sent,
    log: quietLog(),
    send: vi.fn(async msg => { sent.push(msg); return { data: { id: `m${++n}` }, error: null }; }),
    addUser(id, email = `${id}@example.com`) {
      db.prepare(`INSERT INTO users (id, email, name, trial_end_date, created_at) VALUES (?, ?, ?, ?, ?)`)
        .run(id, email, 'Name', '2030-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
      return id;
    },
    optIn(id, { timezone = 'UTC', at = OPTED_IN } = {}) {
      clock = at;
      prefs.setEnabled(id, true, timezone);
      return id;
    },
    bites(id, times, over = {}) {
      store.sync(id, times.map((ts, i) => ({
        id: `${id}-${ts}-${i}-${over.tag ?? ''}-${over.source ?? ''}`, ts, source: 'manual', behavior: 'nail_biting', updatedAt: ts, ...over,
      })), { since: 0 });
    },
    run(extra = {}) {
      return runWeeklyEmail({ db, send: w.send, now: SEND_AT, appUrl: APP, log: w.log, ...extra });
    },
    row: id => prefs.get(id),
  };
  return w;
}

/** A user who is opted in, has synced events, and bit twice this week. */
function readyUser(w, id = 'u1', over = {}) {
  w.addUser(id, over.email);
  w.optIn(id, over);
  w.bites(id, [utc(2026, 9, 13, 10), utc(2026, 9, 14, 11)]);
  return id;
}

describe('isSendSuccess: the Resend SDK returns { data, error } instead of throwing', () => {
  it('only an accepted message is a success', () => {
    expect(isSendSuccess({ data: { id: 'x' }, error: null })).toBe(true);
    expect(isSendSuccess({ data: null, error: { name: 'validation_error', message: 'bad' } })).toBe(false);
    expect(isSendSuccess({ data: { id: 'x' }, error: { name: 'x' } })).toBe(false);
    expect(isSendSuccess({ data: null, error: null })).toBe(false);
    expect(isSendSuccess({})).toBe(false);
    expect(isSendSuccess(undefined)).toBe(false);
    expect(isSendSuccess(null)).toBe(false);
    expect(isSendSuccess('ok')).toBe(false);
  });
});

describe('who gets an email', () => {
  it('an opted-in person with synced events gets exactly one, with the unsubscribe headers', async () => {
    const w = world();
    readyUser(w);
    const r = await w.run();
    expect(r).toMatchObject({ considered: 1, sent: 1, failed: 0 });
    expect(w.sent).toHaveLength(1);
    const msg = w.sent[0];
    expect(msg.to).toBe('u1@example.com');
    expect(msg.subject).toBe('Your week with Stop Biting');
    expect(msg.html).toContain('2 bites logged this week');
    expect(msg.text).toContain('2 bites logged this week');
    const link = msg.headers['List-Unsubscribe'];
    expect(link).toMatch(new RegExp(`^<${APP}/api/email/unsubscribe/[A-Za-z0-9_.-]+>$`));
    expect(msg.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    const token = link.slice(link.lastIndexOf('/') + 1, -1);
    expect(readUnsubscribeToken(token)?.userId).toBe('u1');
    expect(verifyUnsubscribeToken(token, w.row('u1').unsubscribe_secret)).toBe(true);
    expect(msg.html).toContain(`${APP}/api/email/unsubscribe/${token}`);
    expect(msg.text).toContain(`${APP}/api/email/unsubscribe/${token}`);
    expect(w.row('u1').last_sent_week).toBe('2026-W42');
  });

  it('never to someone who is not opted in, however much they have synced', async () => {
    const w = world();
    w.addUser('off');
    w.prefs.ensure('off'); // a row exists, switched off (the default)
    w.bites('off', [utc(2026, 9, 13, 10)]);
    w.addUser('never-touched'); // no row at all
    w.bites('never-touched', [utc(2026, 9, 13, 10)]);
    w.addUser('was-on');
    w.optIn('was-on');
    w.bites('was-on', [utc(2026, 9, 13, 10)]);
    w.prefs.unsubscribe('was-on');
    const r = await w.run();
    expect(r).toMatchObject({ considered: 0, sent: 0 });
    expect(w.send).not.toHaveBeenCalled();
  });

  it('never to someone with no synced events, or only deleted ones', async () => {
    const w = world();
    w.addUser('empty');
    w.optIn('empty');
    w.addUser('gone');
    w.optIn('gone');
    w.store.sync('gone', [{ id: 'g1', ts: utc(2026, 9, 13, 10), source: 'manual', behavior: 'nail_biting', updatedAt: 1 }], { since: 0 });
    w.store.sync('gone', [{ id: 'g1', ts: utc(2026, 9, 13, 10), source: 'manual', behavior: 'nail_biting', updatedAt: 2, deleted: true }], { since: 0 });
    const r = await w.run();
    expect(r.sent).toBe(0);
    expect(r.skipped.no_synced_data).toBe(2);
    expect(w.send).not.toHaveBeenCalled();
  });

  it('never to an account with no email address', async () => {
    const w = world();
    readyUser(w, 'noemail', { email: '' });
    w.addUser('nullemail', null);
    w.optIn('nullemail');
    w.bites('nullemail', [utc(2026, 9, 13, 10)]);
    const r = await w.run();
    expect(r.sent).toBe(0);
    expect(r.skipped.no_email).toBe(2);
  });

  it('an opted-in id with no matching account is skipped, not an error', async () => {
    const w = world();
    w.optIn('ghost');
    w.bites('ghost', [utc(2026, 9, 13, 10)]);
    expect((await w.run()).skipped.no_email).toBe(1);
  });

  it('only the opted-in people among several', async () => {
    const w = world();
    readyUser(w, 'a');
    readyUser(w, 'b');
    w.addUser('c');
    w.bites('c', [utc(2026, 9, 13, 10)]); // synced but never opted in
    await w.run();
    expect(w.sent.map(m => m.to).sort()).toEqual(['a@example.com', 'b@example.com']);
  });
});

describe('once per ISO week, whatever happens', () => {
  it('a second run in the same window sends nothing', async () => {
    const w = world();
    readyUser(w);
    await w.run();
    const again = await w.run({ now: SEND_AT + 5 * HOUR });
    expect(again.sent).toBe(0);
    expect(again.skipped.already_sent).toBe(1);
    expect(w.sent).toHaveLength(1);
  });

  it('a restart (new store objects, same database) cannot double-send', async () => {
    const w = world();
    readyUser(w);
    await w.run();
    const restarted = await runWeeklyEmail({
      db: w.db, send: w.send, now: SEND_AT + HOUR, appUrl: APP, log: w.log,
      store: createEventStore(w.db), prefs: createPrefsStore(w.db),
    });
    expect(restarted.sent).toBe(0);
    expect(w.sent).toHaveLength(1);
  });

  it('two runs at the same moment send once (the claim is one statement)', async () => {
    const w = world();
    readyUser(w);
    const slow = vi.fn(async msg => { w.sent.push(msg); await new Promise(r => setTimeout(r, 10)); return { data: { id: 'm' }, error: null }; });
    const [a, b] = await Promise.all([w.run({ send: slow }), w.run({ send: slow })]);
    expect(a.sent + b.sent).toBe(1);
    expect(w.sent).toHaveLength(1);
  });

  it('the next week gets its own email', async () => {
    const w = world();
    readyUser(w);
    await w.run();
    w.bites('u1', [utc(2026, 9, 20, 10)]); // a bite in W43
    const next = await w.run({ now: SEND_AT + 7 * DAY });
    expect(next.sent).toBe(1);
    expect(w.row('u1').last_sent_week).toBe('2026-W43');
    expect(w.sent[1].text).toContain('1 bite logged this week');
    expect(w.sent[1].text).toContain('50% fewer than the week before (2).');
  });

  it('claims are refused for a week that is not newer than the recorded one', () => {
    const w = world();
    w.addUser('u1');
    w.optIn('u1');
    expect(w.prefs.claimWeek('u1', '2026-W42')).toBe(true);
    expect(w.prefs.claimWeek('u1', '2026-W42')).toBe(false);
    expect(w.prefs.claimWeek('u1', '2026-W41')).toBe(false);
    expect(w.prefs.claimWeek('u1', '2026-W43')).toBe(true);
    // Giving back a claim only works while it is still the current one.
    expect(w.prefs.releaseWeek('u1', '2026-W42', null)).toBe(false);
    expect(w.prefs.releaseWeek('u1', '2026-W43', '2026-W42')).toBe(true);
    expect(w.row('u1').last_sent_week).toBe('2026-W42');
  });

  it('cannot claim for someone who has opted out', () => {
    const w = world();
    w.addUser('u1');
    w.optIn('u1');
    w.prefs.unsubscribe('u1');
    expect(w.prefs.claimWeek('u1', '2026-W42')).toBe(false);
  });
});

describe('a send that does not work', () => {
  it('a result with an error is a failure: the week is handed back and the next run sends it, once', async () => {
    const w = world();
    readyUser(w);
    const calls = [];
    const flaky = vi.fn(async msg => {
      calls.push(msg);
      return calls.length === 1 ? { data: null, error: { name: 'validation_error', message: 'The to field is invalid' } } : { data: { id: 'ok' }, error: null };
    });
    const first = await w.run({ send: flaky });
    expect(first).toMatchObject({ sent: 0, failed: 1 });
    expect(w.row('u1').last_sent_week).toBeNull(); // not claimed any more
    const second = await w.run({ send: flaky, now: SEND_AT + HOUR });
    expect(second).toMatchObject({ sent: 1, failed: 0 });
    const third = await w.run({ send: flaky, now: SEND_AT + 2 * HOUR });
    expect(third.sent).toBe(0);
    expect(calls).toHaveLength(2);
    expect(w.row('u1').last_sent_week).toBe('2026-W42');
  });

  it('an empty or odd result is a failure too', async () => {
    for (const result of [undefined, null, {}, { data: null, error: null }]) {
      const w = world();
      readyUser(w);
      const r = await w.run({ send: async () => result });
      expect(r, JSON.stringify(result)).toMatchObject({ sent: 0, failed: 1 });
      expect(w.row('u1').last_sent_week).toBeNull();
    }
  });

  it('a send that throws is a failure that does not stop the run or leak out of it', async () => {
    const w = world();
    readyUser(w, 'a');
    readyUser(w, 'b');
    let i = 0;
    const r = await w.run({ send: async msg => { if (i++ === 0) throw new Error('network down'); w.sent.push(msg); return { data: { id: 'x' }, error: null }; } });
    expect(r).toMatchObject({ sent: 1, failed: 1 });
    expect(w.sent).toHaveLength(1);
    const failedUser = ['a', 'b'].find(id => w.row(id).last_sent_week === null);
    expect(failedUser).toBeDefined();
  });

  it('logs the user id and the reason, never the email address', async () => {
    const w = world();
    readyUser(w, 'u1', { email: 'secret.person@example.org' });
    await w.run({ send: async () => ({ data: null, error: { name: 'rate_limit_exceeded', message: 'Too many requests for secret.person@example.org' } }) });
    await w.run({ send: async () => { throw new Error('boom for secret.person@example.org'); }, now: SEND_AT + HOUR });
    const logged = JSON.stringify([...w.log.log.mock.calls, ...w.log.warn.mock.calls, ...w.log.error.mock.calls]);
    expect(w.log.error).toHaveBeenCalled();
    expect(logged).toContain('u1');
    expect(logged).not.toContain('secret.person');
  });
});

describe('when it sends: the window after the week ends', () => {
  it('not before 8 hours after the week ended, from 8 hours, until 72 hours', async () => {
    const early = world();
    readyUser(early);
    expect((await early.run({ now: WEEK_END + SEND_AFTER_MS - 1 })).skipped.too_early).toBe(1);
    expect(early.send).not.toHaveBeenCalled();

    const onTime = world();
    readyUser(onTime);
    expect((await onTime.run({ now: WEEK_END + SEND_AFTER_MS })).sent).toBe(1);

    const last = world();
    readyUser(last);
    expect((await last.run({ now: WEEK_END + SEND_UNTIL_MS - 1 })).sent).toBe(1);

    const late = world();
    readyUser(late);
    expect((await late.run({ now: WEEK_END + SEND_UNTIL_MS })).skipped.too_late).toBe(1);
    expect(late.send).not.toHaveBeenCalled();
  });

  it('a missed week is not sent late: a run a week later covers the newer week instead', async () => {
    const w = world();
    readyUser(w);
    const r = await w.run({ now: SEND_AT + 6 * DAY }); // Sunday 25 Oct: W42 is stale, W43 has not ended
    expect(r.sent).toBe(0);
    expect(w.send).not.toHaveBeenCalled();
  });

  it('only for a week that ended AFTER the person opted in', async () => {
    const before = world();
    readyUser(before, 'u1', { at: WEEK_END - 1 }); // Sunday 23:59:59.999
    expect((await before.run()).sent).toBe(1);

    const after = world();
    readyUser(after, 'u1', { at: WEEK_END + 2 * HOUR }); // Monday 02:00, after last week closed
    const r = await after.run();
    expect(r.sent).toBe(0);
    expect(r.skipped.opted_in_after_week).toBe(1);

    const exactly = world();
    readyUser(exactly, 'u1', { at: WEEK_END });
    expect((await exactly.run()).sent).toBe(0);
  });

  it('switching it off and on again restarts that rule', async () => {
    const w = world();
    readyUser(w);
    w.prefs.unsubscribe('u1');
    w.optIn('u1', { at: WEEK_END + HOUR });
    expect((await w.run()).sent).toBe(0);
  });
});

describe("the week is the person's own", () => {
  it('Auckland (UTC+13) is sent its week while a UTC person at the same moment is not', async () => {
    const w = world();
    w.addUser('nz');
    w.optIn('nz', { timezone: 'Pacific/Auckland' });
    w.bites('nz', [utc(2026, 9, 11, 11, 30), utc(2026, 9, 13, 10)]); // the first is Monday 00:30 NZDT, Sunday 11:30 UTC
    w.addUser('utc');
    w.optIn('utc', { timezone: 'UTC' });
    w.bites('utc', [utc(2026, 9, 13, 10)]);
    // 20:00 UTC on Sunday 18 Oct = 09:00 Monday 19 Oct in Auckland; Auckland's week ended 11:00 UTC.
    const now = utc(2026, 9, 18, 20);
    const r = await w.run({ now });
    expect(r.sent).toBe(1);
    expect(w.sent[0].to).toBe('nz@example.com');
    expect(w.sent[0].text).toContain('2 bites logged this week'); // the 00:30 Monday entry is in Auckland's week
    expect(w.sent[0].text).toContain('Mon 12 Oct to Sun 18 Oct');
    expect(w.row('nz').last_sent_week).toBe('2026-W42');
    expect(w.row('utc').last_sent_week).toBeNull();
  });

  it('Honolulu (UTC-10) waits for its own Monday', async () => {
    const w = world();
    w.addUser('hi');
    w.optIn('hi', { timezone: 'Pacific/Honolulu' });
    w.bites('hi', [utc(2026, 9, 13, 20)]);
    // Monday 19 Oct 12:00 UTC is Monday 02:00 in Honolulu: its week ended 10:00 UTC that day, only 2 hours ago.
    expect((await w.run({ now: utc(2026, 9, 19, 12) })).skipped.too_early).toBe(1);
    // Monday 19 Oct 20:00 UTC = 10:00 Honolulu: 10 hours after the week ended.
    expect((await w.run({ now: utc(2026, 9, 19, 20) })).sent).toBe(1);
  });

  it('a week with the clocks going back (New York): the Sunday evening bite is in it, and the key is W44', async () => {
    const w = world();
    w.addUser('ny');
    w.optIn('ny', { timezone: 'America/New_York' });
    w.bites('ny', [utc(2026, 10, 2, 4, 30), utc(2026, 9, 27, 15)]); // 23:30 EST Sunday 1 Nov; Mon 26 Oct 11:00 EDT is 15:00Z
    const weekEnd = utc(2026, 10, 2, 5); // Monday 2 Nov 00:00 EST
    expect((await w.run({ now: weekEnd + 8 * HOUR - 1 })).sent).toBe(0);
    expect((await w.run({ now: weekEnd + 8 * HOUR })).sent).toBe(1);
    expect(w.sent[0].text).toContain('2 bites logged this week');
    expect(w.row('ny').last_sent_week).toBe('2026-W44');
  });

  it('a stored zone that is no longer valid is read as UTC', async () => {
    const w = world();
    readyUser(w);
    w.db.prepare("UPDATE email_preferences SET timezone = 'Not/AZone' WHERE user_id = 'u1'").run();
    expect((await w.run()).sent).toBe(1);
  });
});

describe('nothing to say', () => {
  it('sends nothing, and does not claim the week, when there are no bites in either week', async () => {
    const w = world();
    w.addUser('u1');
    w.optIn('u1');
    w.bites('u1', [utc(2026, 8, 1, 10)]); // synced, but a month earlier
    w.bites('u1', [utc(2026, 9, 13, 10)], { triggers: ['urge'] });
    w.bites('u1', [utc(2026, 9, 14, 10)], { falsePositive: true });
    w.bites('u1', [utc(2026, 9, 15, 10)], { source: 'alarm' }); // unconfirmed alarm
    const r = await w.run();
    expect(r.sent).toBe(0);
    expect(r.skipped.nothing_to_say).toBe(1);
    expect(w.send).not.toHaveBeenCalled();
    expect(w.row('u1').last_sent_week).toBeNull();
  });

  it('a bite in the week before only is still worth a line (it was 2 and now it is none)', async () => {
    const w = world();
    w.addUser('u1');
    w.optIn('u1');
    w.bites('u1', [utc(2026, 9, 6, 10), utc(2026, 9, 7, 10)]);
    expect((await w.run()).sent).toBe(1);
    expect(w.sent[0].text).toContain('No bites logged this week');
    expect(w.sent[0].text).toContain('100% fewer than the week before (2).');
  });

  it('a confirmed alarm counts; a false alarm and an urge do not', async () => {
    const w = world();
    w.addUser('u1');
    w.optIn('u1');
    w.bites('u1', [utc(2026, 9, 13, 10)], { source: 'alarm', confirmed: true });
    w.bites('u1', [utc(2026, 9, 13, 11)], { source: 'alarm', confirmed: true, falsePositive: true });
    w.bites('u1', [utc(2026, 9, 13, 12)], { triggers: ['urge'] });
    w.bites('u1', [utc(2026, 9, 13, 13)], { source: 'alarm' });
    await w.run();
    expect(w.sent[0].text).toContain('1 bite logged this week');
    expect(w.sent[0].text).toContain('1 alarm is still waiting for your review');
  });
});

describe('the cap per run', () => {
  it('attempts at most `cap` emails in one run and the rest follow on later runs', async () => {
    const w = world();
    for (const id of ['a', 'b', 'c', 'd', 'e']) readyUser(w, id);
    const first = await w.run({ cap: 2 });
    expect(first).toMatchObject({ sent: 2, considered: 5 });
    expect(first.skipped.cap).toBe(3);
    expect((await w.run({ cap: 2 })).sent).toBe(2);
    expect((await w.run({ cap: 2 })).sent).toBe(1);
    expect((await w.run({ cap: 2 })).sent).toBe(0);
    expect(new Set(w.sent.map(m => m.to)).size).toBe(5);
  });

  it('the default is a few hundred', () => {
    expect(MAX_SENDS_PER_RUN).toBeGreaterThanOrEqual(100);
    expect(MAX_SENDS_PER_RUN).toBeLessThanOrEqual(1000);
  });
});

describe('what is in the message', () => {
  it('has no email address in the subject, body or headers, and escapes what it prints', async () => {
    const w = world();
    readyUser(w, 'u1', { email: 'someone.private@example.net' });
    await w.run();
    const m = w.sent[0];
    const everything = [m.subject, m.html, m.text, JSON.stringify(m.headers)].join('\n');
    expect(everything).not.toContain('someone.private');
    expect(m.html).not.toMatch(/<script/i);
  });

  it('sends to the account address, whatever else is in the database', async () => {
    const w = world();
    readyUser(w, 'u1', { email: 'account@example.com' });
    await w.run();
    expect(w.sent[0].to).toBe('account@example.com');
  });
});

describe('startWeeklyEmailJob', () => {
  it('does nothing without a configured provider', () => {
    const setIntervalFn = vi.fn();
    const run = vi.fn();
    const log = quietLog();
    expect(startWeeklyEmailJob({ db: {}, send: vi.fn(), appUrl: APP, env: {}, log, run, setIntervalFn })).toBeNull();
    expect(startWeeklyEmailJob({ db: {}, send: vi.fn(), appUrl: APP, env: { RESEND_API_KEY: '' }, log, run, setIntervalFn })).toBeNull();
    expect(setIntervalFn).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalled();
  });

  it('with a provider: runs once now, then hourly on an unref\'d timer', async () => {
    const unref = vi.fn();
    const setIntervalFn = vi.fn(() => ({ unref }));
    const run = vi.fn(async () => ({}));
    const timer = startWeeklyEmailJob({ db: 'db', send: 'send', appUrl: APP, env: { RESEND_API_KEY: 're_x' }, log: quietLog(), run, setIntervalFn });
    expect(timer).toEqual({ unref });
    expect(setIntervalFn).toHaveBeenCalledWith(expect.any(Function), HOUR);
    expect(unref).toHaveBeenCalled();
    await Promise.resolve();
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0]).toMatchObject({ db: 'db', send: 'send', appUrl: APP });
    expect(typeof run.mock.calls[0][0].now).toBe('number');
    setIntervalFn.mock.calls[0][0](); // the hourly tick
    await Promise.resolve();
    await Promise.resolve();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('a run that fails is logged and the timer keeps going', async () => {
    const log = quietLog();
    const run = vi.fn(async () => { throw new Error('db locked'); });
    const setIntervalFn = vi.fn(() => ({ unref() {} }));
    startWeeklyEmailJob({ db: 'db', send: 's', appUrl: APP, env: { RESEND_API_KEY: 're_x' }, log, run, setIntervalFn });
    await new Promise(r => setTimeout(r, 0));
    expect(log.error).toHaveBeenCalledWith('[weekly-email] run failed:', 'db locked');
  });
});
