import { createPortal } from 'react-dom';
import { useAppStore } from '../../store/useAppStore';
import { CoachingSeam } from '../../coaching/CoachingSeam';
import { NotABiteSeam } from '../../falsePositive/NotABiteSeam';

interface Props {
  pipWindow: Window;
  status: 'idle' | 'loading' | 'watching' | 'alert' | 'error';
}

// The floating window is for glancing at while you work, so while all is well
// it is a dim, still strip: a small dot, one line of muted text and a
// text-only stop control. No wave, no white panel, nothing that moves. Only an
// alert changes it, because that is the one thing it must not hide.
const LABEL: Record<Props['status'], string> = {
  idle: 'Waiting',
  loading: 'Starting',
  watching: 'Watching',
  alert: 'Nail biting detected',
  error: 'Not running',
};

export function PiPWindow({ pipWindow, status }: Props) {
  const { cameraEnabled, setCameraEnabled } = useAppStore();
  const isAlerting = status === 'alert';

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
          style={{ background: isAlerting ? '#e5604d' : '#6f8f7d', opacity: isAlerting ? 1 : 0.7 }}
        />
        <span
          className="truncate text-xs"
          style={{ color: isAlerting ? '#ffd9d3' : '#7f9488', fontWeight: isAlerting ? 600 : 500 }}
        >
          {cameraEnabled ? LABEL[status] : 'Stopped'}
        </span>
      </div>

      <NotABiteSeam surface="pip" />{/* SEAM (WS3): "Not a bite" after an alarm. Renders nothing unless the false-alarm controls are on. */}

      <button
        type="button"
        onClick={() => setCameraEnabled(!cameraEnabled)}
        className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
        style={{ color: '#6f8478', background: 'transparent' }}
        onMouseEnter={e => { e.currentTarget.style.color = '#d5e2da'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#6f8478'; }}
      >
        {cameraEnabled ? 'Stop' : 'Start'}
      </button>
    </div>,
    body
  );
}
