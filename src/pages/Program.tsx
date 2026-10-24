// The 4-week program (WS2, flag hrt_coaching): one short lesson a day, with a
// small thing to try. Content: src/data/hrtProgram.json (NEEDS HUMAN REVIEW).
// Progress: the storage module's kv (src/coaching/programProgress.ts).
//
// Rendered full-screen by ProgramHost (src/coaching/ProgramHost.tsx). Offline:
// the text is part of the app bundle and progress is local.
//
// Tone: no scores, no streaks, no "you are behind". A lesson opens the day after
// the last one was finished, whenever that is; a gap loses nothing.
//
// Language (WS12a): the page around the lessons is translated (src/i18n/scopes/coaching.ts). The lesson
// texts, the week titles and summaries and the intro (src/data/hrtProgram.json) are intentionally English:
// they are marked NEEDS HUMAN REVIEW and are not translated (WS12 scope decision).

import { useEffect, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, Check, Lock } from 'lucide-react';
import { PROGRAM, lessonByDay, lessonsOfWeek, programNeedsReview, type Lesson } from '../coaching/program';
import {
  PROGRAM_LESSON_COUNT, completedCount, currentLesson, getProgress, isCompleted, isUnlocked, localDateKey,
  markDone, resetProgress, saveProgress, start, subscribeProgress, unlockedCount,
} from '../coaching/programProgress';
import { CoachingStatsLine } from '../coaching/CoachingStatsLine';
import { useT } from '../i18n/scopes/coaching';
import { useT as useCommonT } from '../i18n/scopes/common';

const DEV_REVIEW_NOTE = 'NEEDS HUMAN REVIEW (shown in development builds only): the lesson text in src/data/hrtProgram.json has not been signed off.'; // i18n-ignore: developer note, rendered in development builds only

/** Today's local date key; re-read every minute so the next lesson opens at local midnight. */
function useToday(): string {
  const [today, setToday] = useState(() => localDateKey(new Date()));
  useEffect(() => {
    const id = setInterval(() => setToday(localDateKey(new Date())), 60_000);
    return () => clearInterval(id);
  }, []);
  return today;
}

/** `initial` is for the pseudo-locale test (src/i18n/coverage): it renders a picked lesson or the reset question without a click. */
export function Program({ onClose, initial }: { onClose: () => void; initial?: { picked?: number; confirmReset?: boolean } }) {
  const t = useT();
  const tc = useCommonT();
  const progress = useSyncExternalStore(subscribeProgress, getProgress, getProgress);
  const today = useToday();
  const [picked, setPicked] = useState<number | null>(initial?.picked ?? null);
  const [confirmReset, setConfirmReset] = useState(initial?.confirmReset ?? false);

  const started = progress.startedOn !== null;
  const open = unlockedCount(progress, today);
  const done = completedCount(progress);
  const current = currentLesson(progress, today);
  // What is shown: the lesson the person picked, else today's, else the last one opened.
  const shownDay = picked ?? current ?? (started ? Math.max(1, open) : null);
  const shown = shownDay !== null ? lessonByDay(shownDay) : undefined;
  const allDone = started && done >= PROGRAM_LESSON_COUNT;

  return (
    <div className="mx-auto max-w-3xl px-5 pb-28 pt-6 sm:px-8">
      <button
        type="button"
        onClick={onClose}
        className="-ml-3 inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-stone-600 transition-colors hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-100"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        {t('program.back')}
      </button>

      <header className="mt-4">
        <h1 id="program-title" tabIndex={-1} className="font-display text-[2.5rem] font-extrabold leading-[0.95] tracking-[-0.045em] text-stone-900 outline-none sm:text-6xl dark:text-stone-100">
          {PROGRAM.title}
        </h1>
        <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-stone-700 dark:text-stone-200">{PROGRAM.intro}</p>
        <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-stone-600 dark:text-stone-300">{PROGRAM.pace}</p>
        <p className="mt-3 max-w-xl rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm leading-relaxed text-stone-600 dark:border-ink-400 dark:bg-ink-50 dark:text-stone-300">
          {PROGRAM.disclaimer}
        </p>
        {import.meta.env.DEV && programNeedsReview() && (
          <p className="mt-3 max-w-xl rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            {DEV_REVIEW_NOTE}
          </p>
        )}
      </header>

      {!started ? (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => saveProgress(start(progress, today))}
            className="min-h-12 rounded-full bg-deep px-7 font-display text-base font-bold text-white transition-colors hover:bg-deep-2 dark:bg-lime-300 dark:text-deep dark:hover:bg-lime-200"
          >
            {t('program.start')}
          </button>
          <p className="mt-3 text-sm text-stone-600 dark:text-stone-300">{t('program.startNote')}</p>
        </div>
      ) : (
        <>
          <p className="mt-8 text-sm font-semibold text-stone-700 dark:text-stone-200" role="status">
            {allDone ? t('program.finished', { total: PROGRAM_LESSON_COUNT }) : t('program.progress', { done, total: PROGRAM_LESSON_COUNT })}
          </p>

          {shown && (
            <LessonCard
              key={shown.day}
              lesson={shown}
              done={isCompleted(progress, shown.day)}
              doneToday={progress.completed[String(shown.day)] === today}
              canMarkDone={isUnlocked(progress, shown.day, today) && !isCompleted(progress, shown.day)}
              isLast={shown.day === PROGRAM_LESSON_COUNT}
              onDone={() => saveProgress(markDone(progress, shown.day, today))}
            />
          )}

          <CoachingStatsLine className="mt-6 max-w-xl text-sm leading-relaxed text-stone-700 dark:text-stone-200" />

          <nav aria-label={t('program.allLessons')} className="mt-10 space-y-8">
            {PROGRAM.weeks.map(w => (
              <section key={w.week} aria-labelledby={`week-${w.week}`}>
                <h2 id={`week-${w.week}`} className="font-display text-xl font-bold tracking-[-0.02em] text-stone-900 dark:text-stone-100">
                  {t('program.weekHeading', { week: w.week, title: w.title })}
                </h2>
                <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{w.summary}</p>
                <ul className="mt-3 divide-y divide-stone-200 overflow-hidden rounded-2xl border border-stone-200 bg-white dark:divide-ink-400 dark:border-ink-400 dark:bg-ink-50">
                  {lessonsOfWeek(w.week).map(l => {
                    const unlocked = isUnlocked(progress, l.day, today);
                    const complete = isCompleted(progress, l.day);
                    const active = shown?.day === l.day;
                    return (
                      <li key={l.day}>
                        <button
                          type="button"
                          disabled={!unlocked}
                          aria-current={active ? 'true' : undefined}
                          onClick={() => setPicked(l.day)}
                          className={`flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                            unlocked ? 'hover:bg-stone-100 dark:hover:bg-ink-fill' : 'cursor-not-allowed text-stone-500 dark:text-stone-400'
                          } ${active ? 'font-semibold text-stone-900 dark:text-stone-100' : 'text-stone-700 dark:text-stone-200'}`}
                        >
                          <span className="w-12 shrink-0 font-mono text-[13px] tabular-nums text-stone-500 dark:text-stone-400">{t('program.day', { day: l.day })}</span>
                          <span className="flex-1">{l.title}</span>
                          {complete ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-forest-700 dark:text-forest-300">
                              <Check size={13} aria-hidden="true" /> {tc('done')}
                            </span>
                          ) : !unlocked ? (
                            <span className="inline-flex items-center gap-1 text-xs">
                              <Lock size={12} aria-hidden="true" /> {t('program.notOpen')}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </nav>

          <div className="mt-10">
            {confirmReset ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-stone-600 dark:text-stone-300">{t('program.confirmReset')}</span>
                <button
                  type="button"
                  onClick={() => { resetProgress(); setPicked(null); setConfirmReset(false); }}
                  className="min-h-11 rounded-full bg-alert-600 px-5 font-semibold text-cream-100 transition-colors hover:bg-alert-800"
                >
                  {t('program.confirmYes')}
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirmReset(false)}
                  className="min-h-11 rounded-full border border-stone-300 px-5 font-semibold text-stone-700 transition-colors hover:bg-stone-100 dark:border-ink-400 dark:text-stone-200 dark:hover:bg-ink-fill"
                >
                  {tc('cancel')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="min-h-11 rounded-full px-1 text-sm font-semibold text-stone-500 underline underline-offset-4 transition-colors hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
              >
                {t('program.reset')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function LessonCard({ lesson, done, doneToday, canMarkDone, isLast, onDone }: {
  lesson: Lesson;
  done: boolean;
  doneToday: boolean;
  canMarkDone: boolean;
  isLast: boolean;
  onDone: () => void;
}) {
  const t = useT();
  return (
    <article className="mt-3 rounded-2xl border border-stone-200 bg-white p-6 sm:p-7 dark:border-ink-400 dark:bg-ink-50" aria-labelledby={`lesson-${lesson.day}`}>
      <p className="text-sm font-semibold text-stone-500 dark:text-stone-400">
        {t('program.lessonMeta', { day: lesson.day, total: PROGRAM_LESSON_COUNT, week: PROGRAM.weeks.find(w => w.week === lesson.week)?.title ?? '' })}
      </p>
      <h2 id={`lesson-${lesson.day}`} className="mt-1 font-display text-2xl font-bold tracking-[-0.03em] text-stone-900 sm:text-3xl dark:text-stone-100">
        {lesson.title}
      </h2>
      <div className="mt-4 space-y-3 text-base leading-relaxed text-stone-700 dark:text-stone-200">
        {lesson.body.map((p, i) => <p key={i} className="text-pretty">{p}</p>)}
      </div>
      <div className="mt-5 rounded-2xl border border-forest-200 bg-forest-50 px-4 py-3 dark:border-forest-800 dark:bg-forest-900/20">
        <p className="text-sm font-semibold text-forest-700 dark:text-forest-300">{t('program.tryToday')}</p>
        <p className="mt-1 text-pretty text-[15px] leading-relaxed text-stone-800 dark:text-stone-100">{lesson.tryToday}</p>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {canMarkDone ? (
          <button
            type="button"
            onClick={onDone}
            className="min-h-11 rounded-full bg-deep px-6 font-display text-sm font-bold text-white transition-colors hover:bg-deep-2 dark:bg-lime-300 dark:text-deep dark:hover:bg-lime-200"
          >
            {t('program.markDone')}
          </button>
        ) : null}
        {done && (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-700 dark:text-forest-300" role="status">
            <Check size={15} aria-hidden="true" />
            {isLast ? t('program.doneLast') : doneToday ? t('program.doneToday') : t('program.doneBare')}
          </p>
        )}
      </div>
    </article>
  );
}
