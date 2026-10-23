// The one component the alarm UI mounts to show the competing-response prompt
// (WS2). It is the SEAM:
//
//   <CoachingSeam surface="main" />  in components/detection/AlertOverlay.tsx
//   <CoachingSeam surface="pip" />   in components/detection/PiPWindow.tsx
//
// Both render the same live session (./controller), so Done or Skip in either
// place closes both and the result is saved once.
//
// Light on purpose. AlertOverlay is also rendered by the landing-page demo,
// which must never pull the app store into its bundle (ARCHITECTURE.md, 2 and
// 14). So this file, ./CoachingCard, ./controller and ./session import only
// React and lucide: no store, no storage module, no flags. That is checked by
// scripts/coachingGuards.test.mjs. Until the app's CoachingBridge arms the
// controller (flag on, signed-in app) this renders nothing, in the demo, on the
// landing page and with every flag off.
//
// Behaviour, all of it optional and none of it in the way:
//  - Non-modal. No focus trap, no backdrop, focus is never moved here (the
//    person may be mid-sentence). It is reachable with Tab like any control.
//  - Escape skips (the document it lives in: the minimized window listens in
//    its own document). Skip and Escape are never disabled in any state.
//  - A polite live region announces the prompt once, and the "Done" at the end.
//    The ticking number is aria-hidden: a screen reader should not read 30 numbers.
//  - It is a fixed card in a portal on <body>: it shows even when the Watch tab
//    is not the visible tab (that tab stays mounted but hidden so detection keeps
//    running), and it does not take clicks anywhere outside its own box.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { alarmCoaching, type ControllerState } from './controller';
import { progress as sessionProgress, remainingSec, type CoachingSession } from './session';
import { CoachingCard } from './CoachingCard';
import { cardAnnouncement } from './cardText';

export type CoachingSurface = 'main' | 'pip';

const SERVER_STATE: ControllerState = { armed: false, session: { phase: 'idle' } };

export function CoachingSeam({ surface }: { surface: CoachingSurface }) {
  const state = useSyncExternalStore(alarmCoaching.subscribe, alarmCoaching.getState, () => SERVER_STATE);
  if (!state.armed) return null;
  return <Armed surface={surface} session={state.session} />;
}

function Armed({ surface, session }: { surface: CoachingSurface; session: CoachingSession }) {
  const active = session.phase !== 'idle';
  const ref = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());

  // While this surface is mounted a prompt can be seen. If the last surface goes
  // away mid-session (the camera was stopped) the controller drops the session
  // without saving a result.
  useEffect(() => alarmCoaching.attach(), []);

  // Redraw four times a second while a session is showing, and nudge the
  // controller so it advances even if its own timer was throttled.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setNow(Date.now());
      alarmCoaching.tick();
    }, 250);
    return () => clearInterval(id);
  }, [active]);

  // Escape = Skip, in the document that owns this element (the minimized
  // window is a separate document). Registered in the capture phase and marked
  // as handled, so the topmost transient thing wins: with the 4-week program
  // open underneath, Escape dismisses this card and does not also close the
  // program. Ignored if something else already used the key.
  useEffect(() => {
    if (!active) return;
    const doc = ref.current?.ownerDocument ?? document;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      alarmCoaching.skip();
      e.preventDefault();
    };
    doc.addEventListener('keydown', onKey, { capture: true });
    return () => doc.removeEventListener('keydown', onKey, { capture: true });
  }, [active]);

  const card = active ? (
    <CoachingCard
      variant={surface === 'pip' ? 'pip' : 'main'}
      phase={session.phase === 'finished' ? 'finished' : 'running'}
      text={session.text}
      remainingSec={remainingSec(session, now)}
      progress={sessionProgress(session, now)}
      onDone={() => alarmCoaching.complete()}
      onSkip={() => alarmCoaching.skip()}
    />
  ) : null;

  if (surface === 'pip') {
    // PiPWindow's root is already a status region; the strip switches the
    // ticking off and keeps one quiet live message of its own.
    return (
      <div ref={ref} style={{ display: active ? 'block' : 'none' }}>
        {card}
        <span className="sr-only" role="status" aria-live="polite">{cardAnnouncement(session)}</span>
      </div>
    );
  }

  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      {/* Always in the page once armed, so the change of text is announced. */}
      <p role="status" aria-live="polite" className="sr-only">{cardAnnouncement(session)}</p>
      {active && (
        <div
          ref={ref}
          className="app-type pointer-events-auto fixed inset-x-4 bottom-20 z-[60] mx-auto max-w-md lg:bottom-6"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          {card}
        </div>
      )}
    </>,
    document.body,
  );
}
