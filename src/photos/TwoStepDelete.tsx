// A delete button that asks once, in the page (never window.confirm). Focus goes to
// the safe choice ("Keep") when the question opens and back to the first button when
// it is dismissed, the same pattern History's "Clear all" uses.

import { useState } from 'react';
import { Trash2 } from 'lucide-react';

export interface TwoStepDeleteProps {
  /** The first button: "Delete" / "Delete all photos". */
  label: string;
  /** Spoken name of the first button, e.g. "Delete the photo from 12 Oct 2026". */
  ariaLabel?: string;
  /** The question: "Delete this photo?" */
  question: string;
  /** The confirming button: "Delete" / "Delete all". */
  confirmLabel: string;
  /** The safe button: "Keep" / "Keep my photos". */
  keepLabel: string;
  onConfirm: () => void;
  /** Starts the question open (tests render the open state without a click). */
  initiallyOpen?: boolean;
  compact?: boolean;
}

export function TwoStepDelete(p: TwoStepDeleteProps) {
  const [open, setOpen] = useState(p.initiallyOpen === true);
  const [returnFocus, setReturnFocus] = useState(false);

  if (open) {
    return (
      <div role="group" aria-label={p.question} className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-stone-700 dark:text-stone-200">{p.question}</span>
        <button
          type="button"
          onClick={() => { setOpen(false); p.onConfirm(); }}
          className="inline-flex min-h-11 items-center rounded-full bg-alert-600 px-5 font-semibold text-cream-100 transition-colors hover:bg-alert-800"
        >
          {p.confirmLabel}
        </button>
        <button
          type="button"
          autoFocus
          onClick={() => { setOpen(false); setReturnFocus(true); }}
          className="inline-flex min-h-11 items-center rounded-full border border-stone-300 px-5 font-semibold text-stone-700 transition-colors hover:bg-stone-100 dark:border-ink-400 dark:text-stone-200 dark:hover:bg-ink-fill"
        >
          {p.keepLabel}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      autoFocus={returnFocus}
      aria-label={p.ariaLabel}
      onClick={() => setOpen(true)}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border border-stone-300 text-sm font-semibold text-stone-700 transition-colors hover:border-alert-600 hover:text-alert-600 dark:border-ink-400 dark:text-stone-200 dark:hover:border-alert-400 dark:hover:text-alert-400 ${p.compact ? 'px-3' : 'px-4'}`}
    >
      <Trash2 size={14} aria-hidden="true" />
      {p.label}
    </button>
  );
}
