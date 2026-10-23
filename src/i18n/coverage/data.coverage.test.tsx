// Pseudo-locale coverage for Settings > Data and Account & Sync: the export / restore / delete card, the sync opt-in
// card, the words for every sync state, the default device name and the messages of the import planner. Each is
// rendered with the German catalog and every t() result marked; whatever is left outside the marks was hardcoded.
// Then the same views in English are compared with the exact sentences the app showed before it was localized.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { usePseudoLocale, expectAllTranslated, expectNoMissingParams } from '../testing/pseudo';
import { AuthProvider } from '../../contexts/AuthContext';
import {
  BackupRows, DataCard, DataSettings, DeleteEverythingRow, DeleteSyncedRow, ImportDone, ImportPreview,
} from '../../pages/settings/DataSettings';
import { SyncCardView, SyncSettings, type SyncCardViewProps } from '../../pages/settings/SyncSettings';
import { describeDeleteFailure as failure, describeNotice, describeStatus } from '../../sync/statusText';
import { defaultDeviceName } from '../../sync/deviceName';
import { MAX_IMPORT_BYTES, MAX_IMPORT_ENTRIES, planImport, type ImportPlan } from '../../backup/importPlan';
import { readChosenFile } from '../../backup/files';
import { OFF_STATUS } from '../../sync/runtime';
import type { SyncPhase, SyncStatus } from '../../sync/types';
import { t } from '../scopes/data';
import { resetLocaleForTests } from '../core';
import { resetFlagsForTests } from '../../features/flags';
import { resetStorage, useMemoryStorage } from '../../../test-utils/memoryStorage';

export const COVERS = [
  'src/pages/settings/DataSettings.tsx',
  'src/pages/settings/SyncSettings.tsx',
  'src/sync/statusText.ts',
  'src/sync/deviceName.ts',
  'src/backup/importPlan.ts',
  'src/backup/files.ts',
];

// Words that are not text from the app: the browsers and systems the device name is built from.
const ALLOW = ['Opera', 'ChromeOS', 'Linux'];

const check = (node: React.ReactNode, allow: Array<string | RegExp> = ALLOW): string => {
  const html = renderToStaticMarkup(<>{node}</>);
  expectAllTranslated(html, { allow });
  expectNoMissingParams(html);
  return html;
};

// ── Fixtures ────────────────────────────────────────────────────────────────

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 5, 1, 9, 0, 0);
const NOW = Date.UTC(2026, 9, 24, 12, 0, 0);
type Wire = { id: string; ts: number; source: 'alarm' | 'manual'; behavior: string; updatedAt: number };
const wire = (id: string, day: number, over: Partial<Wire> = {}): Wire => ({ id, ts: T0 + day * DAY, source: 'manual', behavior: 'nail_biting', updatedAt: T0 + day * DAY, ...over });

const BEHAVIORS = ['nail_biting', 'cuticle_skin_biting', 'nose_picking', 'eye_area_pulling', 'face_skin_picking', 'hair_pulling'];
const file = (events: unknown[], tombstones: unknown[] = [], exportedAt: number | null = T0 + 30 * DAY) =>
  JSON.stringify({ format: 'stop-biting-events', ...(exportedAt === null ? {} : { exportedAt }), events, tombstones });

const planOrThrow = (text: string, local: Wire[]): ImportPlan => {
  const plan = planImport(text, local as never);
  if (!plan.ok) throw new Error(plan.message);
  return plan;
};

/** A merge that touches every line of the preview: new events, a newer file version, a newer local one, a repeat, a twin, junk and a deletion. */
function mergePlan(extraNew: number): ImportPlan {
  const news = Array.from({ length: extraNew }, (_, i) => wire(`new-${i}`, 10 + i, { source: i % 2 ? 'alarm' : 'manual', behavior: BEHAVIORS[i % BEHAVIORS.length] }));
  const local = [wire('upd', 1, { updatedAt: T0 }), wire('kept', 2, { updatedAt: T0 + 40 * DAY }), wire('same', 3)];
  return planOrThrow(
    file(
      [...news, wire('upd', 1, { updatedAt: T0 + 5 * DAY }), wire('kept', 2), wire('same', 3), wire('new-0', 10), { junk: true }, 7],
      [{ id: 'gone', ts: T0, source: 'manual', behavior: 'nail_biting', updatedAt: T0 + 6 * DAY, deleted: true }],
    ),
    local,
  );
}

const seedHistoryPlan = (): ImportPlan => planOrThrow(file([wire('a', 1), wire('b', 2, { source: 'alarm', behavior: 'hair_pulling' })]), []);
const singlePlan = (): ImportPlan => {
  const local = [wire('upd', 1, { updatedAt: T0 }), wire('kept', 2, { updatedAt: T0 + 40 * DAY }), wire('same', 3)];
  return planOrThrow(
    file(
      [wire('only-new', 10, { behavior: 'hair_pulling' }), wire('upd', 1, { updatedAt: T0 + 5 * DAY }), wire('kept', 2), wire('same', 3), wire('only-new', 10, { behavior: 'hair_pulling' }), 42],
      [{ id: 'gone', ts: T0, source: 'manual', behavior: 'nail_biting', updatedAt: T0 + 6 * DAY, deleted: true }],
    ),
    local,
  );
};
const noopPlan = (): ImportPlan => planOrThrow(file([wire('same', 3)]), [wire('same', 3)]);
const listPlan = (): ImportPlan => planOrThrow(JSON.stringify([wire('x', 1), wire('y', 2)]), []);

/** Plans by hand for the lines no small fixture reaches. */
const bigNumbers = (): ImportPlan => ({ ...mergePlan(7), total: 1234, added: 1234, updated: 1000, deletions: 2, unchanged: 3000, keptNewer: 2, duplicatesInFile: 2, invalid: 2, exceedsLimit: true });

const syncBase: SyncCardViewProps = {
  signedIn: true, enabled: true, status: { ...OFF_STATUS, phase: 'idle', lastSyncedAt: NOW - 120_000 }, now: NOW, notice: null, deviceName: 'Chrome on macOS',
  onToggle: () => {}, onSyncNow: () => {}, onRename: () => {}, onDismissNotice: () => {},
};

const PHASES: SyncPhase[] = ['off', 'idle', 'syncing', 'offline', 'backoff', 'signed_out', 'unavailable', 'rejected', 'quota', 'server_reset'];
const statusOf = (patch: Partial<SyncStatus>): SyncStatus => ({ ...OFF_STATUS, ...patch });

const withAuth = (node: React.ReactNode) => <AuthProvider>{node}</AuthProvider>;

beforeEach(() => {
  // AuthProvider reads one localStorage flag when it mounts; node has none.
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
});
afterEach(() => { vi.unstubAllGlobals(); });

// ── German, every word marked ───────────────────────────────────────────────

describe('Data card, pseudo-locale', () => {
  usePseudoLocale({ flags: ['data_backup', 'event_sync'] });

  it('the page card with both flags: export, restore, delete synced data, delete everything', () => {
    const html = check(withAuth(<DataSettings />));
    for (const word of ['Daten', 'Verlauf exportieren', 'JSON exportieren', 'Aus Datei wiederherstellen', 'Synchronisierte Daten löschen', 'Alles löschen']) expect(html).toContain(word);
  });

  it('the card from its props, with each part on and off', () => {
    check(<DataCard backup={true} sync={false} />);
    check(<DataCard backup={false} sync={true} />);
  });

  it('the sentences that follow an export, shown under the export row', () => {
    for (const n of [0, 1, 2, 1234]) {
      check(<BackupRows seed={{ exported: t('export.savedJson', { count: n }) }} />);
      check(<BackupRows seed={{ exported: t('export.savedCsv', { count: n }) }} />);
    }
    expect(t('export.savedJson', { count: 1 })).toContain('1 Ereignis wurde');
    expect(t('export.savedJson', { count: 1234 })).toContain('1.234 Ereignisse wurden');
  });

  it('why a file was refused: every reason the planner and the file reader give', async () => {
    const reasons: string[] = [];
    reasons.push((planImport('x'.repeat(MAX_IMPORT_BYTES + 1), []) as { message: string }).message);
    reasons.push((planImport('this is not json', []) as { message: string }).message);
    reasons.push((planImport('{"hello":1}', []) as { message: string }).message);
    reasons.push((planImport(JSON.stringify(new Array(MAX_IMPORT_ENTRIES + 1).fill(0)), []) as { message: string }).message);
    reasons.push((planImport('[]', []) as { message: string }).message);
    reasons.push((planImport('[1,2]', []) as { message: string }).message);
    const tooBig = await readChosenFile({ size: MAX_IMPORT_BYTES + 1, text: async () => '' } as unknown as File);
    const broken = await readChosenFile({ size: 10, text: async () => { throw new Error('boom'); } } as unknown as File);
    for (const r of [tooBig, broken]) if (!r.ok) reasons.push(r.message);
    expect(reasons).toHaveLength(8);
    expect(new Set(reasons).size).toBe(7); // the "too big" sentence is the same from the planner and the file reader
    for (const message of reasons) check(<BackupRows seed={{ imp: { step: 'refused', message } }} />);
    expect(reasons[3]).toContain('50.000');
  });

  it('the preview: a merge touching every line, the single forms, a restore, a plain list, nothing to do, a huge file', () => {
    const merge = mergePlan(7);
    expect(merge.updated).toBe(1);
    expect(merge.deletions).toBe(1);
    expect(merge.keptNewer).toBe(1);
    expect(merge.unchanged).toBe(1);
    expect(merge.duplicatesInFile).toBe(1);
    expect(merge.invalid).toBe(2);
    for (const plan of [merge, singlePlan(), seedHistoryPlan(), listPlan(), noopPlan(), bigNumbers(), { ...mergePlan(2), exceedsLimit: true }]) {
      check(<ImportPreview plan={plan} fileName="stop-biting-history-2026-10-23.json" onConfirm={() => {}} onCancel={() => {}} />);
    }
    const html = check(<ImportPreview plan={bigNumbers()} fileName="f.json" onConfirm={() => {}} onCancel={() => {}} />);
    expect(html).toContain('1.234 Einträge');
    expect(html).toContain('5.000');
    expect(check(<ImportPreview plan={singlePlan()} fileName="f.json" onConfirm={() => {}} onCancel={() => {}} />)).toContain('1 Eintrag');
  });

  it('every behavior word in the sample lines', () => {
    const first = planOrThrow(file(BEHAVIORS.slice(0, 5).map((b, i) => wire(`b${i}`, 20 - i, { behavior: b, source: i % 2 ? 'alarm' : 'manual' }))), []);
    const second = planOrThrow(file([wire('h', 30, { behavior: 'hair_pulling' })]), []);
    for (const plan of [first, second]) {
      check(<ImportPreview plan={plan} fileName="f.json" onConfirm={() => {}} onCancel={() => {}} />);
      check(<ImportDone plan={plan} onClose={() => {}} />);
    }
  });

  it('after importing: the four summaries, the kept-newer line, the sample and the "and more" line', () => {
    const base = mergePlan(8);
    for (const [updated, deletions, keptNewer] of [[0, 0, 0], [3, 0, 1], [0, 1, 2], [4, 2, 5], [1, 1, 1]]) {
      check(<ImportDone plan={{ ...base, updated, deletions, keptNewer }} onClose={() => {}} />);
    }
    check(<ImportDone plan={{ ...base, sample: [], added: 0, updated: 0, deletions: 0, keptNewer: 0 }} onClose={() => {}} />);
    check(<BackupRows seed={{ imp: { step: 'done', plan: base } }} />);
    check(<BackupRows seed={{ imp: { step: 'preview', plan: base, fileName: 'f.json' } }} />);
  });

  it('delete synced data: idle, checking, asking (none, one, many), working, done, every failure', () => {
    check(<DeleteSyncedRow />);
    check(<DeleteSyncedRow seed={{ step: 'checking' }} />);
    for (const count of [0, 1, 2, 1234]) {
      check(<DeleteSyncedRow seed={{ step: 'asking', count }} />);
      check(<DeleteSyncedRow seed={{ step: 'working', count }} />);
      check(<DeleteSyncedRow seed={{ step: 'done', count }} />);
    }
    for (const status of [0, 401, 429, 500, 503]) check(<DeleteSyncedRow seed={{ step: 'error', message: failure(status) }} />);
    expect(new Set([0, 401, 429, 500].map(failure)).size).toBe(4);
    expect(check(<DeleteSyncedRow seed={{ step: 'asking', count: 1 }} />)).toContain(t('wipe.confirmSome', { count: 1 }));
  });

  it('delete everything: idle, asking with and without the synced copy, working, done, error', () => {
    check(<DeleteEverythingRow sync={true} />);
    check(<DeleteEverythingRow sync={false} />);
    check(<DeleteEverythingRow sync={true} seed={{ step: 'asking', alsoSynced: true }} />);
    check(<DeleteEverythingRow sync={true} seed={{ step: 'asking', alsoSynced: false }} />);
    check(<DeleteEverythingRow sync={false} seed={{ step: 'asking', alsoSynced: false }} />);
    check(<DeleteEverythingRow sync={true} seed={{ step: 'working' }} />);
    check(<DeleteEverythingRow sync={true} seed={{ step: 'done' }} />);
    check(<DeleteEverythingRow sync={true} seed={{ step: 'error', message: failure(0) }} />);
  });
});

describe('Account & Sync card, pseudo-locale', () => {
  usePseudoLocale({ flags: ['event_sync'] });

  it('the page card (nobody signed in)', () => {
    const html = check(withAuth(<SyncSettings />));
    expect(html).toContain('Konto und Synchronisierung');
  });

  it('every state of the card: off, on in each phase, signed out, with the notice', () => {
    check(<SyncCardView {...syncBase} enabled={false} status={OFF_STATUS} />);
    check(<SyncCardView {...syncBase} enabled={false} signedIn={false} status={OFF_STATUS} />);
    for (const phase of PHASES) {
      check(<SyncCardView {...syncBase} status={statusOf({ phase, lastSyncedAt: NOW - 120_000, retryAt: NOW + 180_000, pending: 3 })} />);
    }
    check(<SyncCardView {...syncBase} notice="server_reset" />);
    check(<SyncCardView {...syncBase} deviceName={defaultDeviceName(undefined)} />);
  });
});

describe('sync status words, pseudo-locale', () => {
  usePseudoLocale();

  const lines = (status: SyncStatus) => {
    const line = describeStatus(status, NOW);
    return <><p>{line.headline}</p>{line.detail && <p>{line.detail}</p>}</>;
  };

  it('every phase, with and without waiting changes, with and without a retry time', () => {
    for (const phase of PHASES) {
      for (const pending of [0, 1, 2, 1500]) {
        for (const lastSyncedAt of [null, NOW - 30_000, NOW - 3 * 3600_000, NOW - 5 * DAY]) {
          for (const retryAt of [null, NOW + 120_000]) check(lines(statusOf({ phase, pending, lastSyncedAt, retryAt })));
        }
      }
    }
  });

  it('the one-time notice', () => {
    const notice = describeNotice('server_reset');
    check(<><p>{notice.headline}</p><p>{notice.detail}</p></>);
  });

  it('German plural and number forms are used', () => {
    expect(describeStatus(statusOf({ phase: 'idle', lastSyncedAt: NOW, pending: 1 }), NOW).detail).toContain('1 Änderung wartet');
    expect(describeStatus(statusOf({ phase: 'idle', lastSyncedAt: NOW, pending: 1500 }), NOW).detail).toContain('1.500 Änderungen warten');
  });
});

describe('default device name, pseudo-locale', () => {
  usePseudoLocale();

  it('every system and browser, and the fallback', () => {
    const uas = [
      undefined,
      '',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0',
      'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0 Mobile/15E148',
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36 OPR/80.0',
      'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
      'Windows',
      'Firefox/100.0',
    ];
    check(<>{uas.map((ua, i) => <p key={i}>{defaultDeviceName(ua)}</p>)}</>);
  });

  it('the browser and the system are joined in German, and the app has its German name', () => {
    expect(defaultDeviceName('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/120.0 Electron/28.0 Safari/537.36')).toContain('Stop-Biting-App');
    expect(defaultDeviceName('Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36')).toBe('⟦Chrome auf Windows⟧');
    expect(defaultDeviceName(undefined)).toBe('⟦Dieses Gerät⟧');
  });
});

// ── English: the exact sentences the app showed before it was localized ─────

describe('English is unchanged', () => {
  beforeEach(() => { useMemoryStorage(); resetLocaleForTests(); });
  afterEach(() => { resetStorage(); resetFlagsForTests(); });

  const text = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>).replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
  const preview = (plan: ImportPlan) => text(<ImportPreview plan={plan} fileName="f.json" onConfirm={() => {}} onCancel={() => {}} />);
  const done = (plan: ImportPlan) => text(<ImportDone plan={plan} onClose={() => {}} />);

  it('the preview lines, single and many', () => {
    const many = preview(bigNumbers());
    expect(many).toContain('f.json: 1,234 entries, exported ');
    expect(many).toContain('1,234 new events will be added (');
    expect(many).toContain('1,000 here will be replaced by a newer version from the file');
    expect(many).toContain('2 deletion records from the file will be applied');
    expect(many).toContain('3,000 already here and unchanged');
    expect(many).toContain('2 here are newer than the file’s version and stay as they are');
    expect(many).toContain('2 listed twice in the file (counted once)');
    expect(many).toContain('2 entries are not valid and will be skipped');
    expect(many).toContain('The app keeps the newest 5,000 events, so the oldest ones in this file will be left out.');
    expect(many).toContain('Newest events being added');
    expect(many).toMatch(/ · (alarm|logged by hand) · (nail biting|cuticle skin biting|nose picking|eye area pulling|face skin picking|hair pulling)\|/);
    expect(many).toContain('|Import|Cancel|');
    const one = preview(singlePlan());
    expect(one).toContain('f.json: 7 entries');
    expect(one).toContain('1 new event will be added (');
    expect(one).toContain('1 deletion record from the file will be applied');
    expect(one).toContain('1 entry is not valid and will be skipped');
    expect(preview(listPlan())).toContain('f.json: 2 entries|');
    expect(preview(seedHistoryPlan())).toContain('This device has no history yet, so this restores everything from the file, including your streak dates.');
    const nothing = preview(noopPlan());
    expect(nothing).toContain('There is nothing new in this file. Your history stays exactly as it is.');
    expect(nothing).toContain('|Close|');
    expect(nothing).not.toContain('|Import|');
  });

  it('the summary after importing', () => {
    const base = mergePlan(8);
    expect(done({ ...base, added: 1, updated: 0, deletions: 0, keptNewer: 0 })).toContain('Done. Added 1 event.');
    expect(done({ ...base, added: 8, updated: 3, deletions: 0, keptNewer: 1 })).toContain('Done. Added 8 events, updated 3.');
    expect(done({ ...base, added: 8, updated: 0, deletions: 1, keptNewer: 0 })).toContain('Done. Added 8 events, applied 1 deletion.');
    expect(done({ ...base, added: 1234, updated: 4, deletions: 2, keptNewer: 5 })).toContain('Done. Added 1,234 events, updated 4, applied 2 deletions.');
    // the old wording said "kept as they were" for one event too; it is kept word for word
    expect(done({ ...base, keptNewer: 1 })).toContain('1 newer event was kept as they were.');
    expect(done({ ...base, keptNewer: 5 })).toContain('5 newer events were kept as they were.');
    expect(done({ ...base, added: 1234 })).toContain('and 1,229 more');
  });

  it('the refusals and failures', async () => {
    const msg = (text: string) => (planImport(text, []) as { message: string }).message;
    expect(msg('x'.repeat(MAX_IMPORT_BYTES + 1))).toBe('That file is larger than 10 MB. A history export is far smaller, so this is probably not one.');
    expect(msg('nope')).toBe('That file is not valid JSON. Choose a file you exported from Stop Biting.');
    expect(msg('{}')).toBe('That file does not look like a Stop Biting history export.');
    expect(msg(JSON.stringify(new Array(MAX_IMPORT_ENTRIES + 1).fill(0)))).toBe('That file has more than 50,000 entries.');
    expect(msg('[]')).toBe('That file has no events in it.');
    expect(msg('[3]')).toBe('None of the entries in that file are valid events.');
    const tooBig = await readChosenFile({ size: MAX_IMPORT_BYTES + 1, text: async () => '' } as unknown as File);
    expect(tooBig).toEqual({ ok: false, message: 'That file is larger than 10 MB. A history export is far smaller, so this is probably not one.' });
    const broken = await readChosenFile({ size: 1, text: async () => { throw new Error('x'); } } as unknown as File);
    expect(broken).toEqual({ ok: false, message: 'That file could not be read.' });
    expect(failure(0)).toBe('Could not reach the server. Nothing was deleted. Check your connection and try again.');
    expect(failure(401)).toBe('You are signed out. Sign in again, then try once more.');
    expect(failure(429)).toBe('Too many requests. Wait a minute and try again.');
    expect(failure(500)).toBe('The server could not delete it. Nothing was deleted. Try again in a moment.');
  });

  it('delete synced data and delete everything', () => {
    expect(text(<DeleteSyncedRow seed={{ step: 'asking', count: 1 }} />)).toContain('This permanently deletes 1 synced event from your account. Other devices will stop syncing. It can’t be undone.');
    expect(text(<DeleteSyncedRow seed={{ step: 'asking', count: 1234 }} />)).toContain('This permanently deletes 1,234 synced events from your account.');
    expect(text(<DeleteSyncedRow seed={{ step: 'asking', count: 0 }} />)).toContain('This permanently clears the history held on your account. Other devices will stop syncing. It can’t be undone.');
    expect(text(<DeleteSyncedRow seed={{ step: 'done', count: 2 }} />)).toContain('Deleted 2 synced events from your account. Sync is off. History on this device is untouched.');
    expect(text(<DeleteSyncedRow seed={{ step: 'done', count: 0 }} />)).toContain('Cleared the history held on your account. Sync is off. History on this device is untouched.');
    expect(text(<DeleteSyncedRow seed={{ step: 'checking' }} />)).toContain('Checking…');
    expect(text(<DeleteSyncedRow seed={{ step: 'working', count: 2 }} />)).toContain('Deleting…');
    expect(text(<DeleteEverythingRow sync={true} seed={{ step: 'asking', alsoSynced: true }} />)).toContain('Also delete the copy synced to my account. If you leave this off, the copy stays and sync is switched off on this device.');
    expect(text(<DeleteEverythingRow sync={true} seed={{ step: 'asking', alsoSynced: true }} />)).toContain('Yes, delete everything');
    expect(text(<DeleteEverythingRow sync={true} seed={{ step: 'done' }} />)).toContain('Everything on this device has been erased.');
  });

  it('what exporting says', () => {
    expect(t('export.savedJson', { count: 1 })).toBe('Saved 1 event as a file you can restore from.');
    expect(t('export.savedJson', { count: 1234 })).toBe('Saved 1,234 events as a file you can restore from.');
    expect(t('export.savedCsv', { count: 0 })).toBe('Saved 0 rows for a spreadsheet.');
    expect(t('export.savedCsv', { count: 1 })).toBe('Saved 1 row for a spreadsheet.');
  });

  it('every sync status sentence', () => {
    const say = (patch: Partial<SyncStatus>) => describeStatus(statusOf(patch), NOW);
    expect(say({ phase: 'syncing' })).toEqual({ headline: 'Syncing…', tone: 'busy' });
    expect(say({ phase: 'offline' })).toEqual({ headline: 'You are offline.', detail: 'Everything is saved on this device and will sync when you are back online.', tone: 'warn' });
    expect(say({ phase: 'offline', pending: 1 }).detail).toBe('Everything is saved on this device and will sync when you are back online. 1 change is waiting to be sent.');
    expect(say({ phase: 'offline', pending: 1500 }).detail).toBe('Everything is saved on this device and will sync when you are back online. 1,500 changes are waiting to be sent.');
    expect(say({ phase: 'backoff', retryAt: NOW + 120_000 })).toEqual({ headline: 'Could not reach the server.', detail: 'Your history is safe on this device. Trying again in 2 minutes.', tone: 'warn' });
    expect(say({ phase: 'backoff' }).detail).toBe('Your history is safe on this device. Trying again soon.');
    expect(say({ phase: 'signed_out' })).toEqual({ headline: 'You have been signed out.', detail: 'Sign in again to keep syncing. Your history on this device is untouched.', tone: 'warn' });
    expect(say({ phase: 'unavailable' })).toEqual({ headline: 'Sync is not available right now.', detail: 'Your history is safe on this device. It will try again later.', tone: 'warn' });
    expect(say({ phase: 'rejected' })).toEqual({ headline: 'The server did not accept some changes.', detail: 'Nothing is lost on this device. Try Sync now.', tone: 'warn' });
    expect(say({ phase: 'quota' })).toEqual({ headline: 'Your synced history is full.', detail: 'Export a copy from Data below, then delete the synced copy to start fresh.', tone: 'warn' });
    expect(say({ phase: 'server_reset' })).toEqual({ headline: 'Synced data was deleted, so sync is off.', detail: 'Your history on this device is untouched.', tone: 'warn' });
    expect(say({ phase: 'idle' })).toEqual({ headline: 'Waiting for the first sync.', detail: undefined, tone: 'busy' });
    expect(say({ phase: 'idle', pending: 2 }).detail).toBe('2 changes are waiting to be sent.');
    expect(say({ phase: 'idle', lastSyncedAt: NOW - 90_000_000, pending: 0 })).toEqual({ headline: 'Last synced 1 day ago.', detail: undefined, tone: 'ok' });
    expect(describeNotice('server_reset')).toEqual({
      headline: 'Your synced data was deleted from another device, so sync is off here.',
      detail: 'Your history on this device is untouched. Turn sync on to upload it again.',
      tone: 'warn',
    });
  });

  it('the device name', () => {
    expect(defaultDeviceName('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/120.0 Safari/537.36')).toBe('Chrome on macOS');
    expect(defaultDeviceName('Mozilla/5.0 (Macintosh) Electron/28.0 Chrome/120.0')).toBe('Stop Biting app on macOS');
    expect(defaultDeviceName(undefined)).toBe('This device');
  });

  it('the sync card', () => {
    const html = text(<SyncCardView {...syncBase} />);
    expect(html).toContain('Account &amp; Sync');
    expect(html).toContain('What syncs: for each entry, its time, its type, the bite reason you picked, which hand if known, and whether you finished a competing response. Never video, pictures, face or hand tracking points, or your photo diary. It is off until you turn it on, and you can turn it off or delete the synced copy at any time (see Data).');
    expect(html).toContain('Last synced 2 minutes ago.');
    expect(html).toContain('Name of this device');
  });
});
