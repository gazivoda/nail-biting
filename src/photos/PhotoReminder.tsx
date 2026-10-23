// The weekly photo reminder: a quiet strip above the History list, inside the app only.
// No notification, no push, no email. It appears when the diary is on (`photo_diary`),
// the person has already taken a photo, and the newest one is a week old; "Not now" keeps
// it quiet for a day. Light on purpose: it reads kv and nothing else (no blob store).

import { useState } from 'react';
import { Camera } from 'lucide-react';
import { useFeature } from '../features/useFeature';
import { describeAge, isDue } from './diaryMeta';
import { readSnoozedUntil, snoozeReminder } from './metaKv';
import { usePhotoRecords } from './usePhotoRecords';

export function PhotoReminderView({ lastPhotoAge, onOpen, onSnooze }: { lastPhotoAge: string; onOpen: () => void; onSnooze: () => void }) {
  return (
    <section
      aria-label="Photo diary reminder"
      className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-stone-200 bg-white px-5 py-3 dark:border-ink-400 dark:bg-ink-50"
    >
      <p className="min-w-0 text-sm text-stone-700 dark:text-stone-200">
        <span className="font-semibold text-stone-900 dark:text-stone-100">Time for this week's hand photo.</span>{' '}
        Your last one was {lastPhotoAge}.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-deep px-5 font-display text-sm font-bold text-white transition-colors hover:bg-deep-2 dark:bg-lime-300 dark:text-deep dark:hover:bg-lime-200"
        >
          <Camera size={15} aria-hidden="true" />
          Open the photo diary
        </button>
        <button
          type="button"
          onClick={onSnooze}
          className="inline-flex min-h-11 items-center rounded-full border border-stone-300 px-5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-100 dark:border-ink-400 dark:text-stone-200 dark:hover:bg-ink-fill"
        >
          Not now
        </button>
      </div>
    </section>
  );
}

/** `onOpen` takes the person to the diary (the Insights view). */
export function PhotoReminder({ onOpen }: { onOpen: () => void }) {
  const on = useFeature('photo_diary');
  const { photos, now: readAt } = usePhotoRecords();
  // `readAt` is when the records were last read, which can be hours ago in a long-lived tab. A snooze is
  // judged against the moment it was made, so it keeps the clock it was made with.
  const [snooze, setSnooze] = useState<{ until: number | null; madeAt: number }>(() => ({ until: readSnoozedUntil(), madeAt: 0 }));
  const now = Math.max(readAt, snooze.madeAt);

  if (!on || !isDue(photos, now, snooze.until)) return null;

  return (
    <PhotoReminderView
      lastPhotoAge={describeAge(photos[0].takenAt, now)}
      onOpen={onOpen}
      onSnooze={() => {
        const madeAt = Date.now();
        snoozeReminder(madeAt);
        setSnooze({ until: readSnoozedUntil(), madeAt });
      }}
    />
  );
}
