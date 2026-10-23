// "I feel an urge": a 60 or 90 second guided breathing timer (WS2, flag urge_timer).
//
// A sibling of PanicButton, not an extension of it: PanicButton records a bite
// (and resets the streak); this records an urge that was felt. It borrows
// PanicButton's pattern (button -> small sheet -> confirmation with Undo and a
// polite live region) so it feels like the same app.
//
// A neutral expanding circle, no figure, no hands, no mouth. Under
// prefers-reduced-motion the circle is not shown; the same instruction runs as
// text with a countdown. Fully operable by keyboard: every control is a button,
// Escape stops the timer. Works offline: nothing here touches the network.
//
// The timer is the same pure state machine as the alarm prompt (./session), so
// the same guarantees hold: Stop works at any moment, and a result is saved once.

import { useEffect, useRef, useState } from 'react';
import { Wind } from 'lucide-react';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { IDLE, elapsedMs, offer, remainingSec, skip, tick, type CoachingResult, type CoachingSession } from './session';
import { DEFAULT_URGE_DURATION, URGE_DURATIONS_SEC, breathAt, type UrgeDuration } from './breathing';
import { finishUrge, logUrge, undoUrge } from './urgeLog';

type RunningSession = Extract<CoachingSession, { phase: 'running' }>;

type Ui =
  | { step: 'idle' }
  | { step: 'choose' }
  | { step: 'running'; session: RunningSession }
  | { step: 'logged'; eventId: string; done: boolean };

const CONFIRM_MS = 8000;
const SMALL = 0.55;
type DurationValue = `${UrgeDuration}`;

export function UrgeTimer() {
  const [ui, setUi] = useState<Ui>({ step: 'idle' });
  const [duration, setDuration] = useState<UrgeDuration>(DEFAULT_URGE_DURATION);
  const [now, setNow] = useState(() => Date.now());
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Whichever control is the main one in the current step; each step replaces
  // the button that was pressed, so focus is handed to the new one.
  const mainRef = useRef<HTMLButtonElement>(null);
  const [focusTick, setFocusTick] = useState(0);
  useEffect(() => { if (focusTick > 0) mainRef.current?.focus(); }, [focusTick]);
  const moveFocus = () => setFocusTick(n => n + 1);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  const conclude = (r: CoachingResult) => {
    finishUrge(r.eventId, r.patch);
    setUi({ step: 'logged', eventId: r.eventId, done: r.patch.done });
    moveFocus();
    if (closeTimer.current) clearTimeout(closeTimer.current);
    // Closing by itself does not move focus (nothing is stolen from where the person is now).
    closeTimer.current = setTimeout(() => setUi({ step: 'idle' }), CONFIRM_MS);
  };

  const start = () => {
    const t = Date.now();
    const eventId = logUrge(); // the urge happened: it is logged now, not only if the timer is finished
    const session = offer(IDLE, { eventId, text: 'Breathe with the circle', durationSec: duration }, t);
    if (session.phase !== 'running') return;
    setNow(t);
    setUi({ step: 'running', session });
    moveFocus();
  };

  const stop = (session: RunningSession) => {
    const r = skip(session, Date.now()).result;
    if (r) conclude(r);
  };

  const cancel = () => { setUi({ step: 'idle' }); moveFocus(); };

  const undo = () => {
    if (ui.step === 'logged') undoUrge(ui.eventId);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setUi({ step: 'idle' });
    moveFocus();
  };

  // Drive the clock while running.
  const running = ui.step === 'running' ? ui.session : null;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const r = tick(running, t).result;
      if (r) conclude(r);
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // Escape stops the timer, or closes the sheet.
  const open = ui.step === 'running' || ui.step === 'choose';
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (running) stop(running);
      else cancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, running]);

  // Always in the page, so screen readers announce the change of text.
  const announcement =
    ui.step === 'running' ? `Breathing timer started, ${ui.session.durationSec} seconds. Press Stop, or Escape, to end it.`
    : ui.step === 'logged' ? 'Logged as an urge. Your streak is not affected.'
    : '';

  return (
    <div className="order-first md:order-none">
      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
      {ui.step === 'idle' && (
        <button
          ref={mainRef}
          type="button"
          onClick={() => { setUi({ step: 'choose' }); moveFocus(); }}
          className="w-full select-none rounded-full border-2 border-deep min-h-14 py-3.5 font-display text-lg font-bold tracking-[-0.01em] text-deep transition-colors duration-150 hover:bg-deep hover:text-white active:scale-[0.99] motion-reduce:active:scale-100 dark:border-lime-300 dark:text-lime-300 dark:hover:bg-lime-300 dark:hover:text-deep"
        >
          I feel an urge
        </button>
      )}

      {ui.step === 'choose' && (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 motion-safe:animate-fade-up dark:border-ink-400 dark:bg-ink-50">
          <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-stone-900 dark:text-stone-100">Breathe it out</h2>
          <p className="mt-1 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
            Follow the breathing for a minute or so, and keep your hands busy with something else. This logs an urge, not a bite, so your streak is not affected.
          </p>
          <div className="mt-4">
            <SegmentedControl<DurationValue>
              ariaLabel="Length of the timer"
              value={`${duration}`}
              onChange={v => setDuration(Number(v) as UrgeDuration)}
              options={URGE_DURATIONS_SEC.map(d => ({ label: `${d} seconds`, value: `${d}` as DurationValue }))}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              ref={mainRef}
              type="button"
              onClick={start}
              className="min-h-11 rounded-full bg-deep px-6 font-display text-sm font-bold text-white transition-colors hover:bg-deep-2 dark:bg-lime-300 dark:text-deep dark:hover:bg-lime-200"
            >
              Start
            </button>
            <button
              type="button"
              onClick={cancel}
              className="min-h-11 rounded-full px-5 text-sm font-semibold text-stone-600 transition-colors hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {ui.step === 'running' && <Breathing session={ui.session} now={now} onStop={() => stop(ui.session)} stopRef={mainRef} />}

      {ui.step === 'logged' && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl border border-forest-300 bg-forest-50 px-4 py-2 motion-safe:animate-fade-up dark:border-forest-700 dark:bg-forest-800/50">
          <p className="flex items-center gap-2 text-sm font-medium text-forest-700 dark:text-forest-300">
            <Wind size={15} aria-hidden="true" />
            <span>{ui.done ? 'Timer finished. Logged as an urge.' : 'Logged as an urge.'} Your streak is not affected.</span>
          </p>
          <button
            ref={mainRef}
            type="button"
            onClick={undo}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-forest-700 underline underline-offset-4 hover:text-forest-600 dark:text-forest-300 dark:hover:text-forest-200"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

export function Breathing({ session, now, onStop, stopRef }: {
  session: RunningSession;
  now: number;
  onStop: () => void;
  stopRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const elapsed = elapsedMs(session, now);
  const b = breathAt(elapsed);
  const left = remainingSec(session, now);
  // The first moments sit at the small size so the first breath in has somewhere to grow from.
  const scale = elapsed < 120 ? SMALL : b.target === 1 ? 1 : SMALL;
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 text-center motion-safe:animate-fade-up dark:border-ink-400 dark:bg-ink-50">
      {/* For a screen reader the picture and the ticking text below are hidden, so this is the guide: the phase word only,
          read out when it changes (about every 4 to 6 seconds), never the seconds. Text that has not changed is not
          touched in the page, so nothing is read again until the phase turns over. */}
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{b.phase === 'in' ? 'Breathe in' : 'Breathe out'}</p>
      {/* The circle is decorative and not shown under reduced motion. The words below carry the instruction. */}
      <div aria-hidden="true" className="mx-auto grid h-40 w-40 place-items-center rounded-full border-2 border-forest-300 motion-reduce:hidden dark:border-forest-600">
        <div
          className="h-36 w-36 rounded-full bg-deep motion-reduce:transition-none dark:bg-lime-300"
          style={{ transform: `scale(${scale})`, transition: `transform ${b.phaseSec}s ease-in-out` }}
        />
      </div>
      <p aria-hidden="true" className="mt-4 font-display text-3xl font-extrabold tracking-[-0.03em] text-stone-900 dark:text-stone-100">
        {b.phase === 'in' ? 'Breathe in' : 'Breathe out'}
        <span className="hidden tabular-nums motion-reduce:inline"> {b.secondsLeft}</span>
      </p>
      <p aria-hidden="true" className="mt-1 text-sm tabular-nums text-stone-600 dark:text-stone-300">{left} seconds left</p>
      <button
        ref={stopRef}
        type="button"
        onClick={onStop}
        className="mt-4 min-h-11 rounded-full border border-stone-300 px-6 text-sm font-semibold text-stone-800 transition-colors hover:border-stone-500 dark:border-ink-400 dark:text-stone-100 dark:hover:border-stone-400"
      >
        Stop
      </button>
    </div>
  );
}
