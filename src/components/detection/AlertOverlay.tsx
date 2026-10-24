import { AlertTriangle } from 'lucide-react';
import { CoachingSeam } from '../../coaching/CoachingSeam';
import { NotABiteSeam } from '../../falsePositive/NotABiteSeam';
import { useT } from '../../i18n/scopes/alarm';

interface Props {
  visible: boolean;
}

// The flash is only mounted while `visible`; the coaching seam is not, because
// its countdown (15 to 60 s) outlives the flash and sound-only users never see
// the flash at all. It renders nothing unless the app armed it (flag on).
export function AlertOverlay({ visible }: Props) {
  return (
    <>
      <CoachingSeam surface="main" />{/* SEAM (WS2). */}
      <NotABiteSeam surface="main" />{/* SEAM (WS3): the "Not a bite" toast. Renders nothing unless the false-alarm controls are on. */}
      {visible && <AlertFlash />}
    </>
  );
}

function AlertFlash() {
  const t = useT();
  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Alert border flash */}
      <div className="absolute inset-0 border-8 border-alert-400 alert-flash rounded-none" />
      {/* Center message */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="alert-flash bg-alert-900/90 border border-alert-400 rounded-2xl px-8 py-6 flex flex-col items-center gap-3">
          <AlertTriangle className="text-alert-400" size={48} />
          {/* An instruction, not a scolding: the alarm also fires on the
              occasional false catch, and a competing response is what
              habit reversal asks for in this moment. */}
          <p className="font-display text-3xl font-extrabold tracking-[-0.04em] text-cream-100">{t('overlay.title')}</p>
          <p className="text-alert-100 text-sm">{t('overlay.hint')}</p>
        </div>
      </div>
    </div>
  );
}
