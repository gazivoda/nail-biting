import { AlertTriangle, Camera, Eye, EyeOff, ShieldCheck, Square } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { WatchNote } from '../../background/watchText';
import { useT } from '../../i18n/scopes/watch';

/** `problem`: detection is switched on but nothing is watching (the camera
 *  didn't start, or the models didn't load), as a short title. */
export function CameraToggle({ problem = null, note = null }: { problem?: string | null; note?: WatchNote | null }) {
  const t = useT();
  const cameraProblem = problem !== null;
  const { cameraEnabled, showCameraFeed, setCameraEnabled, setShowCameraFeed } = useAppStore();

  if (!cameraEnabled) {
    // Paper card, one deep pill: the streak above is the screen's deep moment.
    return (
      <div className="p-6 sm:p-7">
        <h2 className="font-display text-[1.75rem] sm:text-[2rem] font-extrabold leading-[1.05] tracking-[-0.04em] text-stone-900 dark:text-stone-100">
          {t('toggle.off.title')}
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          {t('toggle.off.body')}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          <button
            type="button"
            onClick={() => setCameraEnabled(true)}
            className="group inline-flex min-h-14 items-center gap-3 rounded-full bg-deep pl-3 pr-6 font-display text-lg font-bold tracking-[-0.01em] text-white transition-colors duration-150 hover:bg-forest-500 active:scale-[0.99] motion-reduce:active:scale-100 dark:bg-lime-300 dark:text-deep dark:hover:bg-lime-200"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-lime-300 text-deep dark:bg-deep dark:text-lime-300">
              <Camera size={20} aria-hidden="true" />
            </span>
            {t('toggle.off.start')}
          </button>
          <span className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300">
            <ShieldCheck size={13} aria-hidden="true" />
            {t('toggle.off.privacy')}
          </span>
        </div>
      </div>
    );
  }

  // Active / ON state
  return (
    <div
      data-tour="camera-toggle"
      className="w-full overflow-hidden bg-deep text-white"
    >
      {/* Status row */}
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex items-center gap-3.5">
          {/* Live dot while watching; a warning sign, not just a red dot,
              when nothing is (colour alone can't carry the state). */}
          {cameraProblem ? (
            <AlertTriangle size={16} aria-hidden="true" className="shrink-0 text-amber-400" />
          ) : note?.kind === 'paused' ? (
            // WS7a: paused is a still, neutral dot (nothing is being checked), not the live pulse.
            <span aria-hidden="true" className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-white/50" />
          ) : (
            <div className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-lime-300 opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-lime-300" />
            </div>
          )}
          <div>
            <p className="font-display text-lg font-bold leading-tight tracking-[-0.02em] text-white">
              {problem ?? note?.title ?? t('toggle.on.title')}
            </p>
            <p className="mt-0.5 text-xs text-white/75">
              {cameraProblem ? t('toggle.on.problemHint') : note ? note.hint : t('toggle.on.hint')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCameraEnabled(false)}
          className="flex min-h-11 items-center gap-1.5 px-4 rounded-full text-sm font-semibold text-white bg-white/15 hover:bg-white/25 transition-colors duration-150"
        >
          <Square size={11} fill="currentColor" aria-hidden="true" />
          {t('toggle.on.stop')}
        </button>
      </div>

      {/* Show feed sub-toggle. The whole row is the switch: the 36x18 track
          alone was the smallest target in the app, and its label was not
          clickable. */}
      <button
        type="button"
        role="switch"
        aria-checked={showCameraFeed}
        data-tour="hide-feed"
        onClick={() => setShowCameraFeed(!showCameraFeed)}
        className={`flex min-h-12 w-full items-center justify-between px-5 border-t text-left transition-colors hover:bg-white/5 border-white/15`}
      >
        <span className="flex items-center gap-2 text-white/85">
          {showCameraFeed ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
          <span className="text-sm">{t('toggle.showFeed')}</span>
        </span>
        <span
          aria-hidden="true"
          className={`relative h-[18px] w-9 shrink-0 rounded-full transition-colors duration-200 ${
            showCameraFeed ? 'bg-lime-300' : 'bg-white/25'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full transition-transform duration-200 ${showCameraFeed ? 'bg-deep' : 'bg-white'}`}
            style={{ transform: showCameraFeed ? 'translateX(18px)' : 'translateX(0)' }}
          />
        </span>
      </button>
    </div>
  );
}
