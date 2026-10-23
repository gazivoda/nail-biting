// Where the Document Picture-in-Picture window is, for the one reader that needs to know: the detection loop,
// which borrows that window's timers while the main tab is hidden (a window the browser treats as visible has
// timers that are not slowed down; measured in docs/agents/ws7a-notes.md).
//
// usePictureInPicture.ts sets it when the window opens and clears it when the window goes away. Nothing else
// writes it. Plain TypeScript, no DOM types: the window only has to look like `TimerHost`.

export interface TimerHost {
  readonly closed: boolean;
  setInterval(fn: () => void, ms: number): number;
  clearInterval(id: number): void;
}

let pip: TimerHost | null = null;
const listeners = new Set<() => void>();

export function setPipTickWindow(win: TimerHost | null): void {
  if (pip === win) return;
  pip = win;
  listeners.forEach((fn) => {
    try { fn(); } catch { /* a listener must not break the window opening or closing */ }
  });
}

/** The PiP window, or null when there is none or it has been closed. */
export function getPipTickWindow(): TimerHost | null {
  return pip && !pip.closed ? pip : null;
}

export function subscribePipTickWindow(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
