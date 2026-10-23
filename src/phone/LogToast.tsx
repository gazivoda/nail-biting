// The confirmation after a log: what was recorded, Undo, and (for a bite) the
// optional "what set it off?" chips. Text and neutral shapes only.
//
// Always rendered as a polite live region, so a screen reader announces the new
// text; the visible card only exists while there is something to confirm.

import { PRESET_TAGS, type TagOption } from '../components/dashboard/triggerTags';
import { TagMark } from '../components/dashboard/TagMark';
import type { CustomTag } from '../types';
import type { LogFlow, LogToast as Toast } from './logFlow';

const CHIP =
  'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors duration-150 active:scale-95 motion-reduce:active:scale-100';
const CHIP_OFF =
  'border-stone-200 bg-stone-100 text-stone-700 hover:bg-stone-200 dark:border-ink-400 dark:bg-ink-fill dark:text-stone-300 dark:hover:bg-ink-400';
const CHIP_ON = 'border-transparent bg-deep text-white dark:bg-lime-300 dark:text-deep';

function triggerLabel(trigger: string, options: TagOption[]): string {
  return options.find(o => o.id === trigger)?.label ?? 'Not sure';
}

export function toastMessage(toast: Toast | null, options: TagOption[]): string {
  if (!toast) return '';
  if (toast.kind === 'urge') return 'Urge logged. Your streak is not affected.';
  return toast.trigger === 'unknown'
    ? 'Bite logged. Your streak starts again from now.'
    : `Bite logged: ${triggerLabel(toast.trigger, options)}. Your streak starts again from now.`;
}

export function LogToast({ toast, flow, customTags }: { toast: Toast | null; flow: LogFlow; customTags: ReadonlyArray<CustomTag> }) {
  const options: TagOption[] = [...PRESET_TAGS, ...customTags];
  const message = toastMessage(toast, options);

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">{message}</p>
      {toast && (
        <div className="rounded-2xl border border-forest-300 bg-forest-50 p-4 motion-safe:animate-fade-up dark:border-forest-700 dark:bg-forest-800/50">
          <div className="flex items-start justify-between gap-3">
            <p className="py-2.5 text-sm font-medium text-forest-700 dark:text-forest-300">{message}</p>
            <button
              type="button"
              onClick={() => flow.undo()}
              className="-mr-2 inline-flex min-h-11 shrink-0 items-center px-3 text-sm font-semibold text-forest-700 underline underline-offset-4 hover:text-forest-600 dark:text-forest-300 dark:hover:text-forest-200"
            >
              Undo
            </button>
          </div>
          {toast.kind === 'bite' && (
            <div className="mt-1">
              <p id="phone-trigger-label" className="text-xs font-semibold text-stone-600 dark:text-stone-300">What set it off? You can skip this.</p>
              <div role="group" aria-labelledby="phone-trigger-label" className="mt-2 flex flex-wrap gap-2">
                {options.map(opt => {
                  const on = toast.trigger === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => flow.tapTrigger(opt.id)}
                      className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}
                    >
                      {on ? null : <TagMark tag={opt} size={16} />}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
