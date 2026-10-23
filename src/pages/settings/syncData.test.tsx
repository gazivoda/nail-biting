import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccountSyncSection } from './sections/AccountSyncSection';
import { DataSection } from './sections/DataSection';
import { SyncCardView, SyncSettings, type SyncCardViewProps } from './SyncSettings';
import { DataCard, DataSettings } from './DataSettings';
import { SettingsSlots } from './SettingsSlots';
import { AuthProvider } from '../../contexts/AuthContext';
import { OFF_STATUS } from '../../sync/runtime';
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
  // AuthProvider reads one localStorage flag when it mounts; node has none.
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetStorage();
  resetFlagsForTests();
});

const withAuth = (node: React.ReactNode) => renderToStaticMarkup(<AuthProvider>{node}</AuthProvider>);

describe('with every flag off nothing appears', () => {
  it('the two sections render nothing', () => {
    expect(withAuth(<AccountSyncSection />)).toBe('');
    expect(withAuth(<DataSection />)).toBe('');
  });

  it('and the Settings slots (which the real page renders) add nothing', () => {
    expect(withAuth(<SettingsSlots />)).toBe('');
  });

  it('other workstreams\' flags do not open the sync or data cards', () => {
    setFlags('signin_apple', 'weekly_email', 'referrals', 'photo_diary');
    expect(withAuth(<AccountSyncSection />)).toBe('');
    expect(withAuth(<DataSection />)).toBe('');
    expect(withAuth(<SyncSettings />)).toBe('');
    expect(withAuth(<DataSettings />)).toBe('');
  });
});

describe('event_sync only', () => {
  beforeEach(() => setFlags('event_sync'));

  it('Account & Sync shows the opt-in with the approved plain-language copy, off by default', () => {
    const html = withAuth(<SyncSettings />);
    expect(html).toContain('Account &amp; Sync');
    expect(html).toContain('Your history syncs to your account when this is on. Camera data never leaves your device.');
    expect(html).toContain('Sign in to use sync.'); // no signed-in user in this render
    expect(html).not.toContain('Sync now');
  });

  it('Data shows the server delete and delete-everything, but no export or import', () => {
    const html = withAuth(<DataSettings />);
    expect(html).toContain('Delete synced data');
    expect(html).toContain('Delete everything');
    expect(html).not.toContain('Export JSON');
    expect(html).not.toContain('Export CSV');
    expect(html).not.toContain('Choose file');
  });
});

describe('data_backup only (no account, no sync)', () => {
  beforeEach(() => setFlags('data_backup'));

  it('Data shows export and restore, and no sync control', () => {
    const html = withAuth(<DataSettings />);
    expect(html).toContain('Export JSON');
    expect(html).toContain('Export CSV');
    expect(html).toContain('Choose file');
    expect(html).toContain('Delete everything');
    expect(html).not.toContain('Delete synced data');
  });

  it('Account & Sync stays empty', () => {
    expect(withAuth(<AccountSyncSection />)).toBe('');
    expect(withAuth(<SyncSettings />)).toBe('');
  });

  it('says nothing is uploaded when exporting', () => {
    expect(withAuth(<DataSettings />)).toContain('nothing is uploaded');
  });
});

describe('both flags', () => {
  it('shows every control', () => {
    setFlags('event_sync', 'data_backup');
    const html = withAuth(<DataSettings />);
    for (const text of ['Export JSON', 'Export CSV', 'Choose file', 'Delete synced data', 'Delete everything']) expect(html).toContain(text);
  });

  it('renders the card from its props too', () => {
    const html = renderToStaticMarkup(<DataCard backup={true} sync={true} />);
    expect(html).toContain('Export JSON');
    expect(html).toContain('Delete synced data');
    expect(renderToStaticMarkup(<DataCard backup={false} sync={true} />)).not.toContain('Export JSON');
    expect(renderToStaticMarkup(<DataCard backup={true} sync={false} />)).not.toContain('Delete synced data');
  });
});

describe('the sync card', () => {
  const base: SyncCardViewProps = {
    signedIn: true, enabled: false, status: OFF_STATUS, now: 1_700_000_000_000, notice: null, deviceName: 'Chrome on macOS',
    onToggle: () => {}, onSyncNow: () => {}, onRename: () => {}, onDismissNotice: () => {},
  };
  const render = (over: Partial<SyncCardViewProps> = {}) => renderToStaticMarkup(<SyncCardView {...base} {...over} />);

  it('off: a switch that is off, the plain-language copy, what syncs, and nothing about status', () => {
    const html = render();
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('Your history syncs to your account when this is on. Camera data never leaves your device.');
    expect(html).toContain('Never video, pictures, face or hand tracking points, or your photo diary');
    expect(html).toContain('It is off until you turn it on');
    expect(html).not.toContain('Sync now');
    expect(html).not.toContain('This device');
  });

  it('on: shows the status, a Sync now button and the device name', () => {
    const html = render({
      enabled: true,
      status: { ...OFF_STATUS, phase: 'idle', lastSyncedAt: 1_700_000_000_000 - 120_000, pending: 2 },
    });
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('Last synced 2 minutes ago.');
    expect(html).toContain('2 changes are waiting to be sent.');
    expect(html).toContain('Sync now');
    expect(html).toContain('value="Chrome on macOS"');
    expect(html).toContain('Only you see this name. It stays on this device.');
  });

  it('disables Sync now while syncing', () => {
    const html = render({ enabled: true, status: { ...OFF_STATUS, phase: 'syncing' } });
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Sync now/);
    expect(html).toContain('Syncing…');
  });

  it('shows an error state in words and keeps the reassurance', () => {
    const html = render({ enabled: true, status: { ...OFF_STATUS, phase: 'backoff', retryAt: 1_700_000_000_000 + 180_000 } });
    expect(html).toContain('Could not reach the server.');
    expect(html).toContain('Your history is safe on this device.');
  });

  it('shows the one-time notice when synced data was deleted elsewhere', () => {
    const html = render({ notice: 'server_reset' });
    expect(html).toContain('deleted from another device, so sync is off here');
    expect(html).toContain('Dismiss');
  });

  it('asks a signed-out visitor to sign in instead of showing a switch', () => {
    const html = render({ signedIn: false });
    expect(html).toContain('Sign in to use sync.');
    expect(html).not.toContain('role="switch"');
  });

  it('never says what the owner ruled out', () => {
    const html = render({ enabled: true, status: { ...OFF_STATUS, phase: 'idle', lastSyncedAt: 1 } });
    expect(html).not.toMatch(/100% private|no cloud|zero network|nothing leaves your device/i);
  });
});
