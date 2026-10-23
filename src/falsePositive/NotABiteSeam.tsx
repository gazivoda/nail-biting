// The "Not a bite" button after an alarm (WS3). The SEAM:
//
//   <NotABiteSeam surface="main" />  in components/detection/AlertOverlay.tsx, next to CoachingSeam
//   <NotABiteSeam surface="pip" />   in components/detection/PiPWindow.tsx
//
// Both render the same offer (./controller), so tapping in one settles the other.
//
// Light on purpose, like the coaching seam: AlertOverlay is also rendered by the landing-page demo,
// which must never pull the app store into its bundle. This file and ./controller import only React
// and react-dom: no store, no storage module, no flags (scripts/falsePositiveGuards.test.mjs checks
// it, and so does scripts/coachingGuards.test.mjs, which walks the same import graph). Until the app's
// FalsePositiveBridge arms the controller (flag on, signed-in app) it renders nothing.
//
// Behaviour:
//  - Never in the way. A small card that does not take focus, has no backdrop and no focus trap, and
//    takes clicks only inside its own box. It goes away by itself after 15 seconds.
//  - Text only, no pictures of anything. Plain words.
//  - A polite live region says once that the alarm is in History and how to take it back.
//  - Keyboard: it is reachable with Tab like any button; Escape is left alone so it keeps meaning
//    what it means to the coaching prompt and the dialogs.

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { notABite, type NotABiteState } from './controller';

export type NotABiteSurface = 'main' | 'pip';

const SERVER_STATE: NotABiteState = { armed: false, offer: null };

export function NotABiteSeam({ surface }: { surface: NotABiteSurface }) {
  const state = useSyncExternalStore(notABite.subscribe, notABite.getState, () => SERVER_STATE);
  if (!state.armed) return null;
  return surface === 'pip' ? <PipButton state={state} /> : <Toast state={state} />;
}

function announcement(state: NotABiteState): string {
  if (!state.offer) return '';
  return state.offer.phase === 'offered'
    ? 'Alarm. If it was a false alarm, press Not a bite.'
    : 'Marked as not a bite. It is not counted. Press Undo to take it back.';
}

function Toast({ state }: { state: NotABiteState }) {
  if (typeof document === 'undefined') return null;
  return createPortal(<ToastBody state={state} />, document.body);
}

/** The toast's content. Exported so the markup can be tested without a page to portal into. */
export function ToastBody({ state }: { state: NotABiteState }) {
  const offer = state.offer;
  return (
    <>
      {/* Always in the page once armed, so a change of text is announced. */}
      <p role="status" aria-live="polite" className="sr-only">{announcement(state)}</p>
      {offer && (
        <div
          className="app-type pointer-events-auto fixed inset-x-4 top-4 z-[60] mx-auto max-w-sm"
          style={{ marginTop: 'env(safe-area-inset-top)' }}
        >
          <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white py-2 pl-4 pr-2 text-sm text-stone-800 dark:border-ink-400 dark:bg-ink-50 dark:text-stone-100">
            <p className="min-w-0 flex-1 leading-snug">
              {offer.phase === 'offered' ? (
                <>
                  <span className="font-semibold">Alarm.</span>{' '}
                  <span className="text-stone-600 dark:text-stone-300">Only resting your hand?</span>
                </>
              ) : (
                <span className="text-stone-600 dark:text-stone-300">Marked as not a bite. It is not counted.</span>
              )}
              {offer.suggestCalibration && (
                <>
                  {' '}
                  <span className="text-stone-600 dark:text-stone-300">Want to teach it how you rest your chin? It takes a minute.</span>{' '}
                  <button
                    type="button"
                    onClick={() => notABite.calibrate()}
                    className="inline-flex min-h-11 items-center font-semibold text-forest-700 underline underline-offset-4 hover:text-forest-600 dark:text-forest-300 dark:hover:text-forest-200"
                  >
                    Calibrate
                  </button>
                </>
              )}
            </p>
            {offer.phase === 'offered' ? (
              <button
                type="button"
                onClick={() => notABite.mark()}
                className="min-h-11 shrink-0 rounded-full bg-forest-700 px-4 text-sm font-semibold text-cream-100 transition-colors hover:bg-forest-600 dark:bg-forest-400 dark:text-ink-300 dark:hover:bg-forest-300"
              >
                Not a bite
              </button>
            ) : (
              <button
                type="button"
                onClick={() => notABite.undo()}
                className="min-h-11 shrink-0 rounded-full border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-100 dark:border-ink-400 dark:text-stone-200 dark:hover:bg-ink-fill"
              >
                Undo
              </button>
            )}
            <button
              type="button"
              onClick={() => notABite.dismiss()}
              aria-label="Close"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-ink-400 dark:hover:text-stone-200"
            >
              <span aria-hidden="true" className="text-lg leading-none">&times;</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// In the minimized window (a 240 x 64 strip) the offer is one small text button between the status
// and the Stop control. Styled with inline colours like the rest of that strip.
export function PipButton({ state }: { state: NotABiteState }) {
  const offer = state.offer;
  if (!offer) return null;
  const marked = offer.phase === 'marked';
  return (
    <>
      <span className="sr-only" role="status" aria-live="polite">{announcement(state)}</span>
      <button
        type="button"
        onClick={() => (marked ? notABite.undo() : notABite.mark())}
        className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors"
        style={{ color: '#ffd9d3', background: 'transparent', border: '1px solid #6b3a33' }}
      >
        {marked ? 'Undo' : 'Not a bite'}
      </button>
    </>
  );
}
