// The celebration screen for a milestone: a quiet card over the app. The figure, what it means, when it
// happened, and two buttons. No confetti, no picture of the habit; the brand's own dashed rings sit behind
// the text and the card fades up unless the person has asked for reduced motion.
//
// It is a dialog: it takes focus on open (the "Continue" button), Escape and Continue close it, and focus goes
// back to where it was. It sits below the coaching card (z-60) so it never covers a competing-response prompt.
// Presentational only: the host decides when to show it and what Share does.

import { useEffect, useId, useRef } from 'react';
import { Rings } from '../../components/site/Rings';
import { useT as useCommonT } from '../../i18n/scopes/common';
import { useT, type messages } from '../../i18n/scopes/insights';
import type { ShareResult } from '../shareCard';
import { formatCardDate } from '../shareCard';
import type { MilestoneStatus } from '../milestones';

export type ShareUiState = 'idle' | 'working' | ShareResult;

// The line under the buttons for each state of the share step; no line for "idle" and "cancelled".
const SHARE_NOTE_KEYS: Partial<Record<ShareUiState, keyof typeof messages>> = {
  working: 'card.working',
  shared: 'card.shared',
  downloaded: 'card.downloaded',
  failed: 'card.failed',
};

export function CelebrationCard({ status, shareState = 'idle', onShare, onClose }: {
  status: MilestoneStatus;
  shareState?: ShareUiState;
  onShare?: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const tc = useCommonT();
  const noteKey = SHARE_NOTE_KEYS[shareState];
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // Focus moves once, on open, and goes back to where it was on close.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      // The card says it is modal, so Tab stays on its buttons instead of wandering into the page behind it.
      if (e.key === 'Tab') {
        const buttons = [...(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])];
        if (buttons.length === 0) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !dialogRef.current?.contains(active))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (active === last || !dialogRef.current?.contains(active))) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (before && document.contains(before)) before.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[55] grid place-items-center bg-stone-900/50 p-4 dark:bg-black/60">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="milestone-card"
        className="bite sg-dark relative w-full max-w-md overflow-hidden rounded-[2rem] border border-transparent bg-deep p-7 text-white sm:p-9 dark:border-ink-400 motion-safe:animate-fade-up"
      >
        <Rings className="-bottom-24 -left-20 h-72 w-72" />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-lime-300">{t('milestone.kicker')}</p>
          <p className="mt-3 font-display text-6xl font-extrabold leading-[0.9] tracking-[-0.045em] sm:text-7xl">{status.def.figure}</p>
          <h2 id={titleId} className="mt-4 font-display text-2xl font-bold tracking-[-0.03em]">{status.def.title}</h2>
          <p className="mt-2 text-pretty text-base leading-relaxed text-white/80">{status.def.detail}</p>
          {status.reachedAt !== null && <p className="mt-3 text-sm text-white/70">{t('card.reached', { date: formatCardDate(status.reachedAt) })}</p>}

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="inline-flex min-h-12 items-center rounded-full bg-lime-300 px-6 font-display text-base font-bold text-deep transition-colors hover:bg-lime-200"
            >
              {tc('continue')}
            </button>
            {onShare && (
              <button
                type="button"
                onClick={onShare}
                disabled={shareState === 'working'}
                className="inline-flex min-h-12 items-center rounded-full border border-white/30 px-6 text-base font-semibold text-white/90 transition-colors hover:border-white/60 disabled:opacity-60"
              >
                {t('card.share')}
              </button>
            )}
          </div>
          <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-white/75">{noteKey ? t(noteKey) : ''}</p>
          {onShare && (
            <p className="mt-1 text-xs leading-relaxed text-white/60">
              {t('card.note')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
