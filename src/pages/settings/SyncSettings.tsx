// Settings > Account & Sync: the opt-in for syncing history between devices (WS4,
// flag event_sync). Rendered from sections/AccountSyncSection.tsx.
//
// Sync is OFF until the person turns it on here. Switching it on does one thing:
// records "this account opted in" on this browser; the SyncHost mounted in the
// app then starts the engine. Switching it off stops the engine at once.

import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { RefreshCw } from 'lucide-react';
import { Row, Section, Toggle } from './ui';
import { useFeatures } from '../../features/useFeature';
import { useT } from '../../i18n/scopes/data';
import { useAuth } from '../../contexts/AuthContext';
import { useSyncStatus } from '../../sync/useSyncStatus';
import { describeNotice, describeStatus, type StatusLine } from '../../sync/statusText';
import { defaultDeviceName } from '../../sync/deviceName';
import {
  getOptedInUserId, getStoredDeviceName, getSyncNotice, setDeviceName, setSyncNotice, subscribeDeviceName,
  subscribeSyncNotice, subscribeSyncOptIn, type SyncNotice,
} from '../../sync/optIn';
import { disableSync, enableSync } from '../../sync/actions';
import { syncNowIfRunning } from '../../sync/runtime';
import type { SyncStatus } from '../../sync/types';

/** The section's content. Nothing at all while the feature flag is off. */
export function SyncSettings() {
  const on = useFeatures().event_sync;
  if (!on) return null;
  return <SyncCard />;
}

function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}

function SyncCard() {
  useT(); // re-render on a language change: the default device name below is worked out here
  const { user } = useAuth();
  const optedInFor = useSyncExternalStore(subscribeSyncOptIn, getOptedInUserId, () => null);
  const notice = useSyncExternalStore(subscribeSyncNotice, getSyncNotice, () => null);
  const storedName = useSyncExternalStore(subscribeDeviceName, getStoredDeviceName, () => null);
  const status = useSyncStatus();
  const now = useNow(30_000);

  const signedIn = !!user;
  const enabled = signedIn && optedInFor === user.id;
  const deviceName = storedName ?? defaultDeviceName(typeof navigator === 'undefined' ? undefined : navigator.userAgent);

  return (
    <SyncCardView
      signedIn={signedIn}
      enabled={enabled}
      status={status}
      now={now}
      notice={notice}
      deviceName={deviceName}
      onToggle={on => { if (on && user) enableSync(user.id); else disableSync(); }}
      onSyncNow={() => { void syncNowIfRunning(); }}
      onRename={setDeviceName}
      onDismissNotice={() => setSyncNotice(null)}
    />
  );
}

export interface SyncCardViewProps {
  signedIn: boolean;
  enabled: boolean;
  status: SyncStatus;
  now: number;
  notice: SyncNotice | null;
  deviceName: string;
  onToggle(on: boolean): void;
  onSyncNow(): void;
  onRename(name: string): void;
  onDismissNotice(): void;
}

const toneClass: Record<StatusLine['tone'], string> = {
  ok: 'text-stone-800 dark:text-stone-100',
  busy: 'text-stone-700 dark:text-stone-200',
  warn: 'text-alert-600 dark:text-alert-400',
};

/** The card itself, without any hook of its own, so every state can be rendered in a test. */
export function SyncCardView(p: SyncCardViewProps) {
  const t = useT();
  const nameId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const line = describeStatus(p.status, p.now);
  const syncing = p.status.phase === 'syncing';

  return (
    <Section title={t('sync.title')} icon={RefreshCw} fullWidth>
      {p.notice && (
        <div role="status" className="rounded-2xl border border-stone-200 bg-stone-50 p-4 dark:border-ink-400 dark:bg-ink-100">
          <p className="text-[15px] font-semibold text-stone-900 dark:text-stone-100">{describeNotice(p.notice).headline}</p>
          <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-300">{describeNotice(p.notice).detail}</p>
          <button
            type="button"
            onClick={p.onDismissNotice}
            className="mt-2 inline-flex min-h-11 items-center rounded-full px-1 text-sm font-semibold text-forest-700 underline underline-offset-4 hover:text-forest-600 dark:text-forest-300 dark:hover:text-forest-200"
          >
            {t('sync.dismiss')}
          </button>
        </div>
      )}

      <Row
        label={t('sync.toggle')}
        description={t('sync.toggleDescription')}
      >
        {p.signedIn ? (
          <Toggle value={p.enabled} onChange={p.onToggle} label={t('sync.toggle')} />
        ) : (
          <span className="text-sm text-stone-600 dark:text-stone-300">{t('sync.signInToUse')}</span>
        )}
      </Row>

      <p className="-mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
        {t('sync.whatSyncs')}
      </p>

      {p.enabled && (
        <>
          <Row label={t('sync.statusLabel')}>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={p.onSyncNow}
                disabled={syncing}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-stone-300 px-5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-ink-400 dark:text-stone-200 dark:hover:bg-ink-fill"
              >
                {t('sync.syncNow')}
              </button>
            </div>
          </Row>
          <div role="status" aria-live="polite" className="-mt-3 space-y-0.5">
            <p className={`text-[15px] font-semibold ${toneClass[line.tone]}`}>{line.headline}</p>
            {line.detail && <p className="text-sm text-stone-600 dark:text-stone-300">{line.detail}</p>}
          </div>

          <Row label={t('sync.deviceLabel')} description={t('sync.deviceDescription')}>
            <div className="flex items-center gap-2">
              <label htmlFor={nameId} className="sr-only">{t('sync.deviceNameLabel')}</label>
              <input
                id={nameId}
                type="text"
                value={draft ?? p.deviceName}
                maxLength={40}
                onChange={e => setDraft(e.target.value)}
                onBlur={() => { if (draft !== null) { p.onRename(draft); setDraft(null); } }}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                className="min-h-11 w-56 max-w-full rounded-full border border-stone-300 bg-white px-4 text-sm text-stone-900 dark:border-ink-400 dark:bg-ink-fill dark:text-stone-100"
              />
            </div>
          </Row>
        </>
      )}
    </Section>
  );
}
