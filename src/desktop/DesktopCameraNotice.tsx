import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import type { CameraPrompt, DesktopAPI } from './ipc';

/**
 * The explanation shown before the operating system asks for the camera, in the
 * packaged desktop app only (it is mounted by desktopHost.tsx, which runs only
 * when `window.desktop` exists). Main holds the page's camera request until the
 * user presses Continue; "Not now" answers it with a refusal.
 *
 * The second state ("blocked") appears when the OS has the camera switched off
 * for this app: it never asks twice, so the only way back is the system
 * settings page, and the card links straight to it.
 */
export function DesktopCameraNotice({ api }: { api: DesktopAPI }) {
  const [prompt, setPrompt] = useState<CameraPrompt | null>(null);
  const [busy, setBusy] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let alive = true;
    // A request can arrive before this component mounted; ask main once.
    api.camera.status().then((s) => {
      if (alive && s.pending) setPrompt({ kind: 'explain' });
    }).catch(() => {});
    const off = api.camera.onPrompt((p) => {
      setBusy(false);
      setPrompt(p);
    });
    return () => {
      alive = false;
      off();
    };
  }, [api]);

  useEffect(() => {
    if (prompt) primaryRef.current?.focus();
  }, [prompt]);

  const dismiss = useCallback(() => {
    if (prompt?.kind === 'explain') api.camera.decline();
    setPrompt(null);
  }, [api, prompt]);

  useEffect(() => {
    if (!prompt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prompt, dismiss]);

  if (!prompt) return null;

  const explain = prompt.kind === 'explain';

  const onPrimary = async () => {
    if (!explain) {
      api.camera.openSettings();
      setPrompt(null);
      return;
    }
    setBusy(true);
    try {
      await api.camera.request();
    } catch {
      // Main answers the held request either way; the card just closes.
    } finally {
      setBusy(false);
      // Main sends a "blocked" card if the answer was no; otherwise we are done.
      setPrompt((current) => (current?.kind === 'explain' ? null : current));
    }
  };

  const settingsPath = api.platform === 'win32'
    ? 'Settings, under Privacy & security, then Camera'
    : 'System Settings, under Privacy & Security, then Camera';

  return (
    <div className="app-type fixed bottom-4 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4 sm:left-auto sm:right-2 sm:translate-x-0">
      <div
        role="dialog"
        aria-labelledby="desktop-camera-title"
        aria-describedby="desktop-camera-body"
        className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-ink-400 dark:bg-ink-50"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-deep text-lime-300">
            <Camera size={18} aria-hidden="true" />
          </span>
          <h2
            id="desktop-camera-title"
            className="font-display text-lg font-extrabold tracking-[-0.03em] text-stone-900 dark:text-stone-100"
          >
            {explain ? 'Camera access' : 'The camera is turned off'}
          </h2>
        </div>

        <div id="desktop-camera-body" className="mt-3 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          {explain ? (
            <>
              <p>
                Stop Biting uses your camera to notice when your hand reaches your face. Detection runs on your
                device. No camera data is sent while it runs.
              </p>
              {api.platform === 'darwin' && <p className="mt-2">Next, macOS will ask you to allow it.</p>}
            </>
          ) : (
            <p>
              Camera access is off for Stop Biting. Turn it on in {settingsPath}, then start watching again.
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            ref={primaryRef}
            type="button"
            onClick={onPrimary}
            disabled={busy}
            className="inline-flex min-h-11 items-center rounded-full bg-deep px-5 font-display text-sm font-bold text-white transition-colors hover:bg-forest-500 disabled:opacity-60 dark:bg-lime-300 dark:text-deep dark:hover:bg-lime-200"
          >
            {explain ? 'Continue' : 'Open settings'}
          </button>
          <button
            type="button"
            onClick={dismiss}
            disabled={busy}
            className="min-h-11 text-sm font-medium text-stone-600 underline-offset-4 hover:underline dark:text-stone-300"
          >
            {explain ? 'Not now' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
