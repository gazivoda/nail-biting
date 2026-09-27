import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { PRESET_TAGS, type TagOption } from './triggerTags';
import { TagMark } from './TagMark';
import type { TriggerTag } from '../../types';

// "I just bit my nails": log a bite and what set it off. Logging resets the
// streak, so the confirmation says so, stays up long enough to read, and can
// be undone (a wrong tap should not cost a streak). No emoji and no artificial
// press delay: the sheet opens on the press, like every other button.
export function PanicButton() {
  const { logIncident, deleteIncident, customTags } = useAppStore();
  const tags: TagOption[] = [...PRESET_TAGS, ...customTags];
  const [showTags, setShowTags] = useState(false);
  const [logged, setLogged] = useState<{ id: string; label: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  // The pressed tag button disappears with the sheet; focus goes to Undo
  // rather than dropping to <body>.
  useEffect(() => { if (logged) undoRef.current?.focus(); }, [logged]);

  const close = () => {
    if (timer.current) clearTimeout(timer.current);
    setLogged(null);
    setShowTags(false);
  };

  const handleLog = (tag: TriggerTag, label: string) => {
    logIncident(tag, false);
    // Hand-logged bites are never merged, so the new entry is the newest one.
    const id = useAppStore.getState().incidents[0]?.id;
    setLogged(id ? { id, label } : null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(close, 5000);
  };

  const undo = () => {
    if (logged) deleteIncident(logged.id);
    close();
  };

  // Always in the page, so screen readers announce the change: a live region
  // that arrives together with its text often is not read.
  const announcer = (
    <p role="status" aria-live="polite" className="sr-only">
      {logged ? `Logged: ${logged.label}. Your streak starts again from now.` : ''}
    </p>
  );

  if (logged) {
    return (
      <>
      {announcer}
      <div
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl border border-forest-300 bg-forest-50 px-4 py-2 animate-fade-up dark:border-forest-700 dark:bg-forest-800/50"
      >
        <p className="text-sm font-medium text-forest-700 dark:text-forest-300">
          Logged: {logged.label}. Your streak starts again from now.
        </p>
        <button
          ref={undoRef}
          type="button"
          onClick={undo}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-forest-700 underline underline-offset-4 hover:text-forest-600 dark:text-forest-300 dark:hover:text-forest-200"
        >
          Undo
        </button>
      </div>
      </>
    );
  }

  if (showTags) {
    return (
      <>
      {announcer}
      <div className="bg-white dark:bg-ink-50 border border-alert-400 dark:border-alert-800 rounded-2xl p-4 shadow-card dark:shadow-card-dark animate-fade-up">
        <p className="text-stone-500 dark:text-stone-400 text-sm text-center mb-3">What triggered it?</p>
        <div className="grid grid-cols-2 gap-2">
          {tags.map(tag => (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleLog(tag.id, tag.label)}
              className="flex items-center gap-2 bg-stone-100 dark:bg-ink-fill hover:bg-stone-200 dark:hover:bg-ink-400 active:scale-95 border border-stone-200 dark:border-ink-400 rounded-xl px-3 py-3 text-sm text-stone-700 dark:text-stone-300 transition-all duration-150"
            >
              <TagMark tag={tag} size={18} />
              <span>{tag.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowTags(false)}
          className="mt-2 min-h-11 w-full text-sm text-stone-500 transition-colors hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
        >
          Cancel
        </button>
      </div>
      </>
    );
  }

  return (
    <>
    {announcer}
    <button
      type="button"
      data-tour="panic-button"
      onClick={() => setShowTags(true)}
      className="w-full select-none rounded-2xl border border-alert-400 bg-alert-100 py-4 text-base font-medium text-alert-600 transition-all duration-150 hover:border-alert-600 hover:bg-alert-100/80 active:scale-95 dark:border-alert-800 dark:bg-alert-900/30 dark:text-alert-400 dark:hover:bg-alert-900/50"
    >
      I just bit my nails
    </button>
    </>
  );
}
