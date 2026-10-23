// The Watch tab's pause card (WS7a, flag background_watching): pause for 15 minutes, an hour or until tomorrow,
// meeting mode (silent, flash only, still logs), and a line about what happens with this tab in the background.
// Renders nothing with the flag off, and nothing while detection is switched off (there is nothing to pause).
//
// Text and plain pills only. No picture of the habit, no icon that stands for it.

import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useWatchGate } from './gate';
import { pauseForMinutes, pauseUntilTomorrow, resumeWatching, startMeeting } from './actions';
import { cadenceNote, loadCadence, subscribeCadence } from './cadence';

// Whether this browser can float the small status window (Document Picture-in-Picture, Chromium).
const canFloatWindow = () => typeof window !== 'undefined' && 'documentPictureInPicture' in window;
const currentNote = () => cadenceNote(loadCadence(), Date.now(), canFloatWindow());

const PILL =
  'inline-flex min-h-11 items-center rounded-full border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition-colors hover:border-stone-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 dark:border-ink-400 dark:text-stone-100 dark:hover:border-stone-300';
const PRIMARY =
  'inline-flex min-h-11 items-center rounded-full bg-deep px-5 text-sm font-semibold text-white transition-colors hover:bg-forest-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 dark:bg-lime-300 dark:text-deep dark:hover:bg-lime-200';

const MEETING_CHOICES = [
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 120, label: '2 hours' },
];

export function BackgroundSlot() {
  const gate = useWatchGate();
  const cameraEnabled = useAppStore((s) => s.cameraEnabled);
  const [busy, setBusy] = useState(false);
  const firstPause = useRef<HTMLButtonElement>(null);
  // What the last stretch in the background really ran at, if it was slow (src/background/cadence.ts).
  const [slowNote, setSlowNote] = useState<string | null>(currentNote);
  useEffect(() => subscribeCadence(() => setSlowNote(currentNote())), []);
  if (!gate.on || !cameraEnabled) return null;

  const note = gate.note;
  const run = (action: () => Promise<void> | void) => async () => {
    setBusy(true);
    try { await action(); } finally { setBusy(false); }
  };

  return (
    <section
      aria-label="Pause and meeting mode"
      className="rounded-2xl border border-stone-200 bg-white p-6 dark:border-ink-400 dark:bg-ink-50 sm:p-7"
    >
      <p className="mb-4 text-sm font-semibold text-stone-700 dark:text-stone-200">Pause</p>

      {note && (
        <div role="status" className="mb-5">
          <p className="text-[15px] font-semibold text-stone-900 dark:text-stone-100">{note.title}</p>
          {/* a pause already explains itself in the camera card; meeting mode has no other place to say what it does */}
          {note.kind === 'meeting' && <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">{note.detail}</p>}
          {/* The button removes itself when pressed: send focus to the first pause choice, not to the top of the page. */}
          <button type="button" onClick={() => { resumeWatching(); window.setTimeout(() => firstPause.current?.focus(), 0); }} className={`${PRIMARY} mt-3`}>
            {note.kind === 'paused' ? 'Resume now' : 'End meeting mode'}
          </button>
        </div>
      )}

      {gate.state.kind !== 'paused' && (
        <div>
          <p className="mb-2 text-sm text-stone-600 dark:text-stone-300">Stop watching for a while. It starts again by itself.</p>
          <div className="flex flex-wrap gap-2">
            <button ref={firstPause} type="button" disabled={busy} onClick={run(() => pauseForMinutes(15))} className={PILL}>15 minutes</button>
            <button type="button" disabled={busy} onClick={run(() => pauseForMinutes(60))} className={PILL}>1 hour</button>
            <button type="button" disabled={busy} onClick={run(pauseUntilTomorrow)} className={PILL}>Until tomorrow</button>
          </div>
        </div>
      )}

      {gate.state.kind === 'running' && (
        <div className="mt-5">
          <p className="mb-2 text-sm text-stone-600 dark:text-stone-300">
            Meeting mode: keep watching, silently. The screen flashes, no sound, and alarms are still logged.
          </p>
          <div className="flex flex-wrap gap-2">
            {MEETING_CHOICES.map((c) => (
              <button key={c.minutes} type="button" onClick={() => startMeeting(c.minutes)} className={PILL}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-5 text-xs leading-relaxed text-stone-600 dark:text-stone-300">
        While you work in other tabs, detection keeps running. Some browsers slow background tabs down, so checks can be
        less frequent there.
      </p>
      {slowNote && (
        <p role="status" className="mt-2 text-xs leading-relaxed text-stone-700 dark:text-stone-200">{slowNote}</p>
      )}
    </section>
  );
}
