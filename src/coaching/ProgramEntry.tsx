// The discreet way into the 4-week program from the Watch tab (WS2, flag
// hrt_coaching): one quiet line of text, not a card. Says where you are and
// nothing about what you missed.

import { useSyncExternalStore } from 'react';
import { BookOpen } from 'lucide-react';
import { openProgram } from './programViewState';
import { PROGRAM_LESSON_COUNT, completedCount, getProgress, subscribeProgress } from './programProgress';
import { useT } from '../i18n/scopes/coaching';

export function ProgramEntry() {
  const t = useT();
  const progress = useSyncExternalStore(subscribeProgress, getProgress, getProgress);
  const started = progress.startedOn !== null;
  const done = completedCount(progress);
  const label = !started
    ? t('program.entry')
    : done >= PROGRAM_LESSON_COUNT
      ? t('program.entryFinished')
      : t('program.entryProgress', { done, total: PROGRAM_LESSON_COUNT });
  return (
    <button
      type="button"
      onClick={openProgram}
      className="inline-flex min-h-11 items-center justify-center gap-2 self-center rounded-full px-4 text-sm font-semibold text-stone-600 underline-offset-4 transition-colors hover:text-stone-900 hover:underline dark:text-stone-300 dark:hover:text-stone-100"
    >
      <BookOpen size={15} aria-hidden="true" />
      {label}
    </button>
  );
}
