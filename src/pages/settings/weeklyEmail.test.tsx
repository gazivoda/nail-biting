// Settings > Account & Sync > Weekly summary email (WS5). Rendered in node with
// react-dom/server: the card's states are covered through the props-only view; the
// gate is covered with the flag off and on.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WeeklyEmailCard, WeeklyEmailCardView, type WeeklyEmailCardViewProps, type WeeklyEmailState } from './WeeklyEmailCard';
import { WeeklyEmailSettings } from './WeeklyEmailSettings';
import { AccountSyncSection } from './sections/AccountSyncSection';
import { SettingsSlots } from './SettingsSlots';
import { AuthProvider } from '../../contexts/AuthContext';
import { kv } from '../../storage/kv';
import { setStorageAdapter } from '../../storage/adapter';
import { resetFlagsForTests } from '../../features/flags';
import { createMemoryAdapter, resetStorage } from '../../../test-utils/memoryStorage';

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

const state = (over: Partial<WeeklyEmailState> = {}): WeeklyEmailState => ({
  enabled: false, timezone: null, hasSyncedData: true, hasEmail: true, lastSentWeek: null, ...over,
});
const view = (over: Partial<WeeklyEmailCardViewProps> = {}) =>
  renderToStaticMarkup(
    <WeeklyEmailCardView phase="ready" state={state()} saving={false} error={null} onToggle={() => {}} onRetry={() => {}} {...over} />,
  );

describe('the gate', () => {
  it('renders nothing with every flag off', () => {
    expect(withAuth(<WeeklyEmailSettings />)).toBe('');
    expect(withAuth(<AccountSyncSection />)).toBe('');
    expect(withAuth(<SettingsSlots />)).toBe('');
  });

  it('renders nothing for other workstreams\' flags', () => {
    setFlags('event_sync', 'insights', 'photo_diary', 'referrals');
    expect(withAuth(<WeeklyEmailSettings />)).toBe('');
  });

  it('with the flag on, the card is a lazy chunk: the first render shows nothing and no request is made', () => {
    setFlags('weekly_email');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(withAuth(<WeeklyEmailSettings />)).toBe('');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('the real card, signed out, asks for a sign-in and makes no request', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const html = withAuth(<WeeklyEmailCard />);
    expect(html).toContain('Weekly summary email');
    expect(html).toContain('Sign in to use this.');
    expect(html).not.toContain('role="switch"');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('the card', () => {
  it('off by default: a labelled switch that is off, with the plain-language promise', () => {
    const html = view();
    expect(html).toContain('Weekly summary email');
    expect(html).toContain('Email me a weekly summary');
    expect(html).toMatch(/role="switch"[^>]*aria-checked="false"|aria-checked="false"[^>]*role="switch"/);
    expect(html).toContain('aria-label="Email me a weekly summary"');
    expect(html).toContain('email address on your account');
    expect(html).toContain('built from the history you sync');
    expect(html).toContain('off until you turn it on');
    expect(html).toContain('never more than one email a week');
    expect(html).toContain('unsubscribe link');
    expect(html).toContain('Weekly summary email is off');
  });

  it('on: the switch is on and the status says so', () => {
    const html = view({ state: state({ enabled: true }) });
    expect(html).toMatch(/aria-checked="true"/);
    expect(html).toContain('Weekly summary email is on');
  });

  it('with nothing synced, says to turn on sync first (and not otherwise)', () => {
    expect(view({ state: state({ hasSyncedData: false }) })).toContain('Turn on sync first.');
    expect(view({ state: state({ hasSyncedData: true }) })).not.toContain('Turn on sync first');
    expect(view({ state: state({ enabled: true, hasSyncedData: false }) })).toContain('nothing from this account has synced yet');
  });

  it('an account with no email address is told so, and the sync hint is not piled on top', () => {
    const html = view({ state: state({ hasEmail: false, hasSyncedData: false }) });
    expect(html).toContain('Your account has no email address, so a summary cannot be sent.');
    expect(html).not.toContain('Turn on sync first');
  });

  it('shows a save error as an alert', () => {
    const html = view({ error: 'Could not save that. Check your connection and try again.' });
    expect(html).toMatch(/role="alert"[^>]*>Could not save that/);
  });

  it('signed out and loading have no switch', () => {
    const out = view({ phase: 'signed-out', state: null });
    expect(out).toContain('Sign in to use this.');
    expect(out).not.toContain('role="switch"');
    const loading = view({ phase: 'loading', state: null });
    expect(loading).toContain('Loading');
    expect(loading).not.toContain('role="switch"');
  });

  it('a failed load offers Try again and says so', () => {
    const html = view({ phase: 'load-failed', state: null });
    expect(html).toContain('Try again');
    expect(html).toContain('Could not load this setting.');
    expect(html).not.toContain('role="switch"');
  });

  it('keeps to the project\'s rules for copy: no overclaim, no medical claim, no dash, no emoji', () => {
    const texts = [
      view(), view({ state: state({ enabled: true, hasSyncedData: false }) }), view({ state: state({ hasEmail: false }) }),
      view({ phase: 'load-failed', state: null }), view({ error: 'Could not save that. Check your connection and try again.' }),
    ].join('\n').toLowerCase();
    for (const banned of ['100% private', 'nothing leaves', 'no cloud', 'zero network', 'treat', 'cure', 'clinical', 'therapy']) {
      expect(texts, banned).not.toContain(banned);
    }
    expect(texts).not.toMatch(/[–—]/);
    expect(texts).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('never has an address field: the server uses the account\'s own address', () => {
    expect(view()).not.toMatch(/<input|type="email"/i);
  });
});
