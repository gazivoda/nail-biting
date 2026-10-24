import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';
import { CoachingSeam } from '../../coaching/CoachingSeam';
import { NotABiteSeam } from '../../falsePositive/NotABiteSeam';
import { useWatchGate } from '../../background/gate';
import { pauseForMinutes, resumeWatching } from '../../background/actions';
import { useT, type messages } from '../../i18n/scopes/watch';

interface Props {
  pipWindow: Window;
  status: 'idle' | 'loading' | 'watching' | 'alert' | 'error';
}

// The floating window is for glancing at while you work, so while all is well
// it is a dim, still strip: a small dot, one line of muted text and a
// text-only stop control. No wave, no white panel, nothing that moves. Only an
// alert changes it, because that is the one thing it must not hide.
const LABEL: Record<Props['status'], keyof typeof messages> = {
  idle: 'mini.status.idle',
  loading: 'mini.status.loading',
  watching: 'mini.status.watching',
  alert: 'mini.status.alert',
  error: 'mini.status.error',
};

export function PiPWindow({ pipWindow, status }: Props) {
  const t = useT();
  const { cameraEnabled, setCameraEnabled } = useAppStore();
  const isAlerting = status === 'alert';
  // WS7a (flag background_watching): the strip says when watching is paused or silent, and can pause or resume it.
  // With the flag off `gate.on` is false and the strip is exactly what it was.
  const gate = useWatchGate();
  const note = gate.note;
  const paused = gate.on && gate.paused;
  const label = !cameraEnabled ? t('mini.status.stopped') : paused && note ? note.strip.status : note?.kind === 'meeting' && status === 'watching' ? note.strip.status : t(LABEL[status]);
  // Two lines (a status word, and under it until when) only while paused or silent: the strip is 64 px high.
  const detail = cameraEnabled && note && (paused || (note.kind === 'meeting' && status === 'watching')) ? note.strip.detail : null;

  const body = pipWindow.document.body;
  if (!body) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-between gap-3 overflow-hidden px-4 transition-colors duration-300"
      style={{ background: isAlerting ? '#3a1612' : '#0c1411', fontFamily: 'Geist, system-ui, sans-serif' }}
      role="status"
    >
      {isAlerting && (
        <div className="pointer-events-none absolute inset-0" style={{ border: '3px solid #e5604d' }} />
      )}

      <CoachingSeam surface="pip" />{/* SEAM (WS2): covers the strip while a prompt runs. WS7a mounts beside it. */}

      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: isAlerting ? '#e5604d' : paused ? '#8a948f' : '#6f8f7d', opacity: isAlerting ? 1 : paused ? 0.55 : 0.7 }}
        />
        {detail ? (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-xs" style={{ color: '#7f9488', fontWeight: 500 }}>{label}</span>
            <span className="truncate text-[10px]" style={{ color: '#667c71' }}>{detail}</span>
          </span>
        ) : (
          <span
            className="truncate text-xs"
            style={{ color: isAlerting ? '#ffd9d3' : '#7f9488', fontWeight: isAlerting ? 600 : 500 }}
          >
            {label}
          </span>
        )}
      </div>

      <NotABiteSeam surface="pip" />{/* SEAM (WS3): "Not a bite" after an alarm. Renders nothing unless the false-alarm controls are on. */}

      {gate.on && cameraEnabled && (
        <button
          type="button"
          title={paused ? t('mini.resumeTitle') : t('mini.pauseTitle')}
          onClick={() => { if (paused) resumeWatching(); else void pauseForMinutes(15); }}
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
          style={{ color: paused ? '#d5e2da' : '#6f8478', background: 'transparent' }}
          onMouseEnter={e => { e.currentTarget.style.color = '#d5e2da'; }}
          onMouseLeave={e => { e.currentTarget.style.color = paused ? '#d5e2da' : '#6f8478'; }}
        >
          {paused ? t('mini.resume') : t('mini.pause')}
        </button>
      )}

      <button
        type="button"
        onClick={() => setCameraEnabled(!cameraEnabled)}
        className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
        style={{ color: '#6f8478', background: 'transparent' }}
        onMouseEnter={e => { e.currentTarget.style.color = '#d5e2da'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#6f8478'; }}
      >
        {cameraEnabled ? t('mini.stop') : t('mini.start')}
      </button>
    </div>,
    body
  );
}
