// What the camera frame shows while watching is paused (WS7a): a plain panel with the end time and a Resume button,
// laid over the frame where the feed would be. Neutral colours, no animation, no picture.

import { useWatchGate } from './gate';
import { resumeWatching } from './actions';

export function PausedOverlay() {
  const gate = useWatchGate();
  const note = gate.paused ? gate.note : null;
  if (!note) return null;
  return (
    <div
      role="status"
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-stone-100 px-6 text-center dark:bg-ink-300"
    >
      <p className="font-display text-xl font-bold tracking-[-0.02em] text-stone-900 dark:text-stone-100">{note.title}</p>
      <p className="max-w-xs text-sm text-stone-600 dark:text-stone-300">{note.detail}</p>
      <button
        type="button"
        onClick={() => {
          resumeWatching();
          // This panel goes away with its button: focus the camera card's own Stop button, not the top of the page.
          window.setTimeout(() => document.querySelector<HTMLElement>('[data-tour="camera-toggle"] button')?.focus(), 0);
        }}
        className="inline-flex min-h-11 items-center rounded-full bg-deep px-5 text-sm font-semibold text-white transition-colors hover:bg-forest-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 dark:bg-lime-300 dark:text-deep dark:hover:bg-lime-200"
      >
        Resume now
      </button>
    </div>
  );
}
