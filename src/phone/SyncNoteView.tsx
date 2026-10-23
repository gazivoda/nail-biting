// Says, in plain words, where the entries made on this phone live (WS6).
// The wording per state is in ./syncNote.ts; this reads the three facts it needs
// (the event_sync flag, this account's opt-in, the engine's status) and shows it.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useFeature } from '../features/useFeature';
import { useAuth } from '../contexts/AuthContext';
import { getOptedInUserId, subscribeSyncOptIn } from '../sync/optIn';
import { useSyncStatus } from '../sync/useSyncStatus';
import { describeStatus } from '../sync/statusText';
import { syncNoteFor } from './syncNote';
import { useT } from '../i18n/scopes/phone';

function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}

export function SyncNoteView({ onOpenSettings }: { onOpenSettings: () => void }) {
  const t = useT();
  const { user } = useAuth();
  const syncAvailable = useFeature('event_sync');
  const optedInFor = useSyncExternalStore(subscribeSyncOptIn, getOptedInUserId, () => null);
  const status = useSyncStatus();
  const now = useNow(30_000);

  const note = syncNoteFor({ syncAvailable, optedIn: !!user && optedInFor === user.id });
  const line = note.kind === 'syncing' ? describeStatus(status, now) : null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-ink-400 dark:bg-ink-50">
      <p className="text-sm leading-relaxed text-stone-700 dark:text-stone-200">{note.text}</p>
      {line && (
        <p className="mt-1 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          {line.headline}{line.tone === 'warn' && line.detail ? ` ${line.detail}` : ''}
        </p>
      )}
      {note.action === 'settings' && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="mt-2 inline-flex min-h-11 items-center rounded-full border border-stone-300 px-5 text-sm font-semibold text-stone-800 transition-colors hover:border-stone-500 dark:border-ink-400 dark:text-stone-100 dark:hover:border-stone-400"
        >
          {t('sync.openSettings')}
        </button>
      )}
    </div>
  );
}
