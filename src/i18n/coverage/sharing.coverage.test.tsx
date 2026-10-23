// Pseudo-locale coverage for Settings > Sharing and the weekly summary email card (scope "sharing"). Every state of
// both cards is rendered with the German catalog on and every t() result marked; no word may be left outside the marks.
// The public share page and the weekly email itself are rendered by the server and stay English (not in scope here).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { usePseudoLocale, expectAllTranslated, expectNoMissingParams } from '../testing/pseudo';
import { SharingCardView, SharingSettings, type SharingCardViewProps } from '../../pages/settings/SharingSettings';
import { WeeklyEmailCard, WeeklyEmailCardView, type CardPhase, type WeeklyEmailState } from '../../pages/settings/WeeklyEmailCard';
import { AuthProvider } from '../../contexts/AuthContext';
import {
  EXPIRY_OPTIONS, INTRO, SYNC_NEEDED, daysLeft, describeCreated, describeExpiry, describeViewed, failureText, previewFor,
} from '../../share/copy';
import { t as sharingT } from '../scopes/sharing';
import { messages as dataEn } from '../scopes/data';
import { messages as sharingEn } from '../scopes/sharing';
import { messages as dataEs } from '../locales/es/data';
import { messages as dataDe } from '../locales/de/data';
import { messages as dataPt } from '../locales/pt-BR/data';
import { messages as sharingEs } from '../locales/es/sharing';
import { messages as sharingDe } from '../locales/de/sharing';
import { messages as sharingPt } from '../locales/pt-BR/sharing';
import type { ShareLink } from '../../share/types';

export const COVERS = [
  'src/pages/settings/SharingSettings.tsx',
  'src/pages/settings/WeeklyEmailCard.tsx',
  'src/share/copy.ts',
];

// The text of the fixtures below that a person typed (a link note) is shown as typed, not translated.
const FIXTURE_WORDS = ['for', 'Friday', 'note'];

beforeEach(() => { vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} }); });
afterEach(() => { vi.unstubAllGlobals(); });

const NOW = new Date(2026, 9, 21).getTime();
const link = (over: Partial<ShareLink> = {}): ShareLink => ({
  id: 'l1', label: 'for Friday', createdAt: new Date(2026, 9, 1).getTime(), expiresAt: new Date(2026, 10, 1).getTime(),
  lastViewedAt: null, detailed: false, ...over,
});
const links: ShareLink[] = [
  link(), // active, never opened
  link({ id: 'l2', label: '', detailed: true, expiresAt: null, lastViewedAt: new Date(2026, 9, 20, 9, 30).getTime() }), // no expiry, unnamed, with dates
  link({ id: 'l3', label: 'for Friday', expiresAt: NOW - 1000, lastViewedAt: new Date(2026, 9, 20, 0, 5).getTime() }), // expired
];

const props = (over: Partial<SharingCardViewProps> = {}): SharingCardViewProps => ({
  signedIn: true, syncOn: true, syncFlag: true, load: 'ready',
  list: { links: [], max: 5, syncedEntries: 40 },
  form: { label: '', expiresInDays: 30, detailed: false },
  creating: false, created: null, confirmId: null, revoking: false, error: null, status: null, copied: 'idle', now: NOW,
  onLabel: () => {}, onExpiry: () => {}, onDetailed: () => {}, onCreate: () => {}, onCopy: () => {}, onDismissCreated: () => {},
  onAskRevoke: () => {}, onCancelRevoke: () => {}, onConfirmRevoke: () => {}, onGoToSync: () => {},
  ...over,
});
const sharing = (over?: Partial<SharingCardViewProps>) => renderToStaticMarkup(<SharingCardView {...props(over)} />);

const created = { ...link(), token: 'T'.repeat(43), url: `https://stopbiting.today/share/${'T'.repeat(43)}` };

describe('sharing card, pseudo-locale', () => {
  usePseudoLocale({ flags: ['share_links'] });

  // built inside each test, so the German catalog is already on when a state asks the catalog for text
  const states: Record<string, () => Partial<SharingCardViewProps>> = {
    'ready, no links': () => ({}),
    'signed out': () => ({ signedIn: false }),
    'sync off, sync available': () => ({ syncOn: false }),
    'sync off, sync not available': () => ({ syncOn: false, syncFlag: false }),
    'nothing synced yet': () => ({ list: { links: [], max: 5, syncedEntries: 0 } }),
    'loading': () => ({ load: 'loading', list: null }),
    'load failed': () => ({ load: 'error', list: null, error: failureText(0, 'load') }),
    'dates on, 7 days': () => ({ form: { label: 'note', expiresInDays: 7, detailed: true } }),
    '90 days': () => ({ form: { label: '', expiresInDays: 90, detailed: false } }),
    'no expiry': () => ({ form: { label: '', expiresInDays: null, detailed: false } }),
    'links: active, no expiry, expired': () => ({ list: { links, max: 5, syncedEntries: 3 } }),
    'at the limit': () => ({ list: { links: [...links, link({ id: 'l4' }), link({ id: 'l5' })], max: 5, syncedEntries: 3 } }),
    'asking to revoke': () => ({ list: { links, max: 5, syncedEntries: 3 }, confirmId: 'l1' }),
    'revoking': () => ({ list: { links, max: 5, syncedEntries: 3 }, confirmId: 'l1', revoking: true }),
    'making a link': () => ({ creating: true }),
    'new link': () => ({ created }),
    'new link, copied': () => ({ created, copied: 'copied' }),
    'new link, copy by hand': () => ({ created, copied: 'manual' }),
    'revoked': () => ({ status: sharingT('status.revoked') }),
    'action failed': () => ({ error: failureText(409, 'create') }),
  };

  for (const [name, over] of Object.entries(states)) {
    it(`has no English outside the marks: ${name}`, () => {
      const html = sharing(over());
      expectAllTranslated(html, { allow: FIXTURE_WORDS });
      expectNoMissingParams(html);
    });
  }

  it('really is German: the headings and buttons come from the catalog', () => {
    const html = sharing({ list: { links, max: 5, syncedEntries: 3 } });
    expect(html).toContain('⟦Teilen⟧');
    expect(html).toContain('⟦Aktive Links⟧');
    expect(html).toContain('⟦Deaktivieren⟧');
    expect(html).toContain('⟦Abgelaufen⟧');
    expect(html).toContain('⟦Kein Ablaufdatum⟧');
  });

  it('writes the dates in German order, with a 24-hour time', () => {
    const html = sharing({ list: { links, max: 5, syncedEntries: 3 } });
    expect(html).toMatch(/⟦Läuft ab am 1\. Nov\.? 2026⟧/);
    expect(html).toMatch(/⟦Zuletzt geöffnet: 20\. Okt\.? 2026, 09:30⟧/);
    expect(html).toMatch(/⟦Zuletzt geöffnet: 20\. Okt\.? 2026, 00:05⟧/);
  });

  it('the expiry choices are translated with their numbers', () => {
    const html = sharing();
    for (const o of EXPIRY_OPTIONS) expect(html).toContain(`>${o.label}</option>`); // the label already carries its marks
    expect(EXPIRY_OPTIONS.map(o => o.label)).toEqual(['⟦7 Tage⟧', '⟦30 Tage⟧', '⟦90 Tage⟧', '⟦Kein Ablaufdatum⟧']);
  });

  it('the revoke button names the link, or says it has no note', () => {
    const html = sharing({ list: { links, max: 5, syncedEntries: 3 } });
    expect(html).toContain('aria-label="⟦Link for Friday deaktivieren⟧"');
    expect(html).toContain('aria-label="⟦Link ohne Notiz deaktivieren⟧"');
  });

  it('the real card, signed out, asks for a sign-in', () => {
    const html = renderToStaticMarkup(<AuthProvider><SharingSettings /></AuthProvider>);
    expectAllTranslated(html);
    expectNoMissingParams(html);
    expect(html).toContain('⟦Melde dich an, um einen Link zum Teilen zu erstellen.⟧');
  });

  it('the words of the helpers, for every input', () => {
    const lines = [
      String(INTRO), String(SYNC_NEEDED),
      ...previewFor(false).shows, ...previewFor(true).shows, ...previewFor(true).never,
      describeExpiry(null, NOW), describeExpiry(NOW - 1, NOW), describeExpiry(NOW + 86_400_000, NOW),
      describeViewed(null), describeViewed(new Date(2026, 9, 21, 14, 5).getTime()), describeCreated(new Date(2026, 9, 3).getTime()),
    ];
    for (const status of [0, 400, 401, 404, 409, 429, 500, 502]) {
      for (const action of ['load', 'create', 'revoke'] as const) lines.push(failureText(status, action));
    }
    const html = renderToStaticMarkup(<ul>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>);
    expectAllTranslated(html);
    expectNoMissingParams(html);
    expect(daysLeft(NOW + 86_400_000 * 2 - 1, NOW)).toBe(2); // not text, but the same file
  });

  it('a sharing preview shows two more lines when dates are on', () => {
    expect(previewFor(true).shows.length).toBe(previewFor(false).shows.length + 2);
    expect(previewFor(true).never.length).toBe(4);
  });
});

describe('weekly summary email card, pseudo-locale', () => {
  usePseudoLocale({ flags: ['weekly_email'] });

  const state = (over: Partial<WeeklyEmailState> = {}): WeeklyEmailState => ({
    enabled: false, timezone: null, hasSyncedData: true, hasEmail: true, lastSentWeek: null, ...over,
  });
  const weekly = (phase: CardPhase, st: WeeklyEmailState | null, extra: { saving?: boolean; error?: string | null } = {}) =>
    renderToStaticMarkup(
      <WeeklyEmailCardView phase={phase} state={st} saving={extra.saving ?? false} error={extra.error ?? null} onToggle={() => {}} onRetry={() => {}} />,
    );

  // rendered inside each test, so the German catalog is already on
  const cases: Record<string, () => string> = {
    'signed out': () => weekly('signed-out', null),
    'loading': () => weekly('loading', null),
    'ready, off': () => weekly('ready', state()),
    'ready, on': () => weekly('ready', state({ enabled: true })),
    'no email address': () => weekly('ready', state({ hasEmail: false })),
    'nothing synced': () => weekly('ready', state({ hasSyncedData: false })),
    'load failed': () => weekly('load-failed', null),
    'saving': () => weekly('ready', state(), { saving: true }),
  };

  for (const [name, render] of Object.entries(cases)) {
    it(`has no English outside the marks: ${name}`, () => {
      const html = render();
      expectAllTranslated(html);
      expectNoMissingParams(html);
    });
  }

  it('every save error is translated', () => {
    // saveErrorText (private to the card) picks one of these by the HTTP status; the card shows it through the `error` prop
    const errors = (['noEmail', 'signedOut', 'unavailable', 'tooMany', 'generic'] as const).map(k => sharingT(`weekly.error.${k}`));
    expect(new Set(errors).size).toBe(5);
    for (const e of errors) {
      const html = weekly('ready', state(), { error: e });
      expectAllTranslated(html);
      expectNoMissingParams(html);
      expect(html).toContain(`role="alert"`);
    }
  });

  it('the real card, signed out, is German and makes no request', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const html = renderToStaticMarkup(<AuthProvider><WeeklyEmailCard /></AuthProvider>);
    expectAllTranslated(html);
    expect(html).toContain('⟦Melde dich an, um das zu nutzen.⟧');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// The cards point at the Account & Sync card by name and quote its switch. Both come from the data scope, so the
// words here must be the very words that card shows, in every language.
describe('the names of the sync card and its switch match the card itself', () => {
  const sets = [
    ['en', sharingEn, dataEn], ['es', sharingEs, dataEs], ['de', sharingDe, dataDe], ['pt-BR', sharingPt, dataPt],
  ] as const;
  for (const [locale, sharing, data] of sets) {
    it(`${locale}`, () => {
      expect(sharing['sync.go'], 'go-to button').toContain(data['sync.title']);
      expect(sharing['sync.turnOn'], 'turn-on hint').toContain(data['sync.title']);
      expect(sharing['sync.turnOn'], 'turn-on hint').toContain(data['sync.toggle']);
      expect(sharing['weekly.about'], 'weekly email note').toContain(data['sync.toggle']);
    });
  }
});
