import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SharingSection } from './sections/SharingSection';
import { SharingCardView, SharingSettings, type SharingCardViewProps } from './SharingSettings';
import { SettingsSlots } from './SettingsSlots';
import { AuthProvider } from '../../contexts/AuthContext';
import { kv } from '../../storage/kv';
import { setStorageAdapter } from '../../storage/adapter';
import { resetFlagsForTests } from '../../features/flags';
import { createMemoryAdapter, resetStorage } from '../../../test-utils/memoryStorage';
import type { ShareLink } from '../../share/types';

const setFlags = (...on: string[]) => {
  kv.set('flags', 'last-known', { at: Date.now(), flags: Object.fromEntries(on.map(n => [n, true])) });
  resetFlagsForTests();
};

beforeEach(() => {
  setStorageAdapter(createMemoryAdapter());
  resetFlagsForTests();
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetStorage();
  resetFlagsForTests();
});

const withAuth = (node: React.ReactNode) => renderToStaticMarkup(<AuthProvider>{node}</AuthProvider>);

describe('with the flag off nothing appears', () => {
  it('the section, the card and the Settings slots render nothing', () => {
    expect(withAuth(<SharingSection />)).toBe('');
    expect(withAuth(<SharingSettings />)).toBe('');
    expect(withAuth(<SettingsSlots />)).toBe('');
  });

  it('another feature\'s flag does not open it', () => {
    setFlags('event_sync', 'insights', 'referrals');
    expect(withAuth(<SharingSection />)).toBe('');
    expect(withAuth(<SharingSettings />)).toBe('');
  });
});

const link = (over: Partial<ShareLink> = {}): ShareLink => ({
  id: 'l1', label: 'for Friday', createdAt: new Date(2026, 9, 1).getTime(), expiresAt: new Date(2026, 10, 1).getTime(), lastViewedAt: null, detailed: false, ...over,
});

const props = (over: Partial<SharingCardViewProps> = {}): SharingCardViewProps => ({
  signedIn: true, syncOn: true, syncFlag: true, load: 'ready',
  list: { links: [], max: 5, syncedEntries: 40 },
  form: { label: '', expiresInDays: 30, detailed: false },
  creating: false, created: null, confirmId: null, revoking: false, error: null, status: null, copied: 'idle',
  now: new Date(2026, 9, 21).getTime(),
  onLabel: () => {}, onExpiry: () => {}, onDetailed: () => {}, onCreate: () => {}, onCopy: () => {}, onDismissCreated: () => {},
  onAskRevoke: () => {}, onCancelRevoke: () => {}, onConfirmRevoke: () => {}, onGoToSync: () => {},
  ...over,
});
const view = (over?: Partial<SharingCardViewProps>) => renderToStaticMarkup(<SharingCardView {...props(over)} />);

describe('the card', () => {
  it('opens with plain words: who it is for, that anyone with the link can open it, and that an app is not a clinician', () => {
    const html = view();
    expect(html).toContain('Sharing');
    expect(html).toContain('someone you choose');
    expect(html).toContain('Anyone who has the link can open it');
    expect(html).toContain('an app, not a clinician');
  });

  it('defaults to counts only: the dates switch is off, expiry is 30 days', () => {
    const html = view();
    expect(html).toMatch(/aria-label="Include calendar dates"[^>]*aria-checked="false"|aria-checked="false"[^>]*aria-label="Include calendar dates"/);
    expect(html).toMatch(/<option value="30" selected="">30 days<\/option>/);
    expect(html).not.toContain('Calendar dates on the charts');
  });

  it('previews exactly what the link shows: dates and time of day only when the switch is on', () => {
    const on = view({ form: { label: '', expiresInDays: 7, detailed: true } });
    expect(on).toContain('What this link will show');
    expect(on).toContain('Calendar dates on the charts');
    expect(on).toContain('A time-of-day chart');
    expect(on).toContain('What it never shows');
    expect(on).toContain('Your name, email or account');
    expect(on).toContain('Photos, or anything from your camera');
    expect(on).toContain('Any single entry, or the exact time of one');
    expect(view()).toContain('What it never shows');
  });

  it('asks the person to sign in when they are not', () => {
    const html = view({ signedIn: false });
    expect(html).toContain('Sign in to make a share link.');
    expect(html).not.toContain('Make a share link');
  });

  it('says sharing needs synced history, and points to the sync setting, when sync is off', () => {
    const html = view({ syncOn: false });
    expect(html).toContain('Sharing needs your history to be synced.');
    expect(html).toContain('Sync my history across devices');
    expect(html).toContain('Go to Account &amp; Sync');
  });

  it('says so, without a button, when sync is not available at all', () => {
    const html = view({ syncOn: false, syncFlag: false });
    expect(html).toContain('Sharing needs your history to be synced.');
    expect(html).toContain('History sync is not available yet');
    expect(html).not.toContain('Go to Account');
  });

  it('warns, but still lets a link be made, when sync is on and nothing has arrived yet', () => {
    const html = view({ list: { links: [], max: 5, syncedEntries: 0 } });
    expect(html).toContain('Nothing from your history has synced yet');
    expect(html).toContain('Make a share link');
  });

  it('lists active links with a note, kind, expiry and when they were last opened, and a Revoke button each', () => {
    const html = view({
      list: { links: [link(), link({ id: 'l2', label: '', detailed: true, expiresAt: null, lastViewedAt: new Date(2026, 9, 20, 9, 30).getTime() })], max: 5, syncedEntries: 3 },
    });
    expect(html).toContain('for Friday');
    expect(html).toContain('Unnamed link');
    expect(html).toContain('Counts only');
    expect(html).toContain('With dates');
    expect(html).toContain('Expires 1 Nov 2026');
    expect(html).toContain('No expiry');
    expect(html).toContain('Not opened yet');
    expect(html).toContain('Last opened 20 Oct 2026, 09:30');
    expect((html.match(/>Revoke</g) ?? []).length).toBe(2);
  });

  it('asks before revoking, in the page, naming what happens, with the safe button focused', () => {
    const html = view({ list: { links: [link()], max: 5, syncedEntries: 3 }, confirmId: 'l1' });
    expect(html).toContain('Confirm revoking this link');
    expect(html).toContain('see a “link does not work” page');
    expect(html).toContain('Yes, revoke this link');
    expect(html).toContain('Keep it');
    expect(html).toMatch(/autofocus/i);
    expect(html).not.toContain('>Revoke<'); // the plain button is replaced while asking
  });

  it('shows the new link once, with copy, a plain explanation, and a hint when copying failed', () => {
    const created = { ...link(), token: 'T'.repeat(43), url: `https://stopbiting.today/share/${'T'.repeat(43)}` };
    const fresh = view({ created });
    expect(fresh).toContain('Your link is ready. Copy it now.');
    expect(fresh).toContain('This is the only time it is shown');
    expect(fresh).toContain(`value="${created.url}"`);
    expect(fresh).toContain('Copy link');
    expect(view({ created, copied: 'copied' })).toContain('Copied to your clipboard.');
    expect(view({ created, copied: 'manual' })).toContain('press Ctrl+C');
  });

  it('never prints a token in the list', () => {
    const html = view({ list: { links: [link()], max: 5, syncedEntries: 3 } });
    expect(html).not.toMatch(/\/share\/[A-Za-z0-9_-]{20,}/);
  });

  it('stops offering a new link at the limit', () => {
    const many = Array.from({ length: 5 }, (_, i) => link({ id: `l${i}` }));
    const html = view({ list: { links: many, max: 5, syncedEntries: 3 } });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Make a share link<\/button>/);
    expect(html).toContain('Revoke one to make another');
  });

  it('shows an error as an alert and progress while working', () => {
    expect(view({ error: 'Sharing is not available right now.' })).toContain('role="alert"');
    expect(view({ creating: true })).toContain('Making link…');
    expect(view({ load: 'loading', list: null })).toContain('Loading…');
  });
});
