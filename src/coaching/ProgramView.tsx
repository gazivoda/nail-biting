// The full-screen shell around the 4-week program (WS2, flag hrt_coaching),
// loaded lazily by ProgramHost the first time the view is opened.
//
// A full-screen view in a portal on <body>, with the rest of the app made inert
// while it is open (no Tab into the page behind, nothing read behind it). The
// app keeps running underneath, so detection and the alarm are unaffected, and
// the coaching card, which also lives on <body>, stays usable on top.
//
// The flag is checked here too, so a stale open state can never show the view
// with the flag off.

import { Suspense, lazy, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFeature } from '../features/useFeature';
import { closeProgram, installProgramPopstate } from './programViewState';
import { useT as useCommonT } from '../i18n/scopes/common';

const Program = lazy(() => import('../pages/Program').then(m => ({ default: m.Program })));

export function ProgramView() {
  const enabled = useFeature('hrt_coaching');

  // The Back button closes the view.
  useEffect(() => (enabled ? installProgramPopstate() : undefined), [enabled]);

  if (!enabled || typeof document === 'undefined') return null;
  return createPortal(<Overlay />, document.body);
}

export function Overlay() {
  const tc = useCommonT();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    ref.current?.focus({ preventScroll: true }); // the dialog itself: the lesson content may still be loading
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) closeProgram();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      root?.removeAttribute('inert');
      // Back to where the person was (the link that opened it), if it is still there.
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="program-title"
      tabIndex={-1}
      className="app-type outline-none fixed inset-0 z-[55] overflow-y-auto bg-cream-200 text-stone-800 dark:bg-ink-100 dark:text-stone-200"
    >
      <Suspense fallback={<p role="status" className="p-8 text-sm text-stone-600 dark:text-stone-300">{tc('loading')}</p>}>
        <Program onClose={closeProgram} />
      </Suspense>
    </div>
  );
}
