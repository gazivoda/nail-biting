// Whether the calibration view is open (WS3): a tiny external store so Settings > Detection and the
// "Not a bite" toast can open it, and the one CalibrationHost (mounted by the FalsePositiveBridge, so only
// while the flag is on) can show it. Imports nothing, so the toast's side of it stays light.

type Listener = () => void;

let open = false;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach(fn => { try { fn(); } catch { /* ignore */ } });

export function isCalibrationOpen(): boolean { return open; }

export function subscribeCalibration(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function openCalibration(): void {
  if (open) return;
  open = true;
  emit();
}

export function closeCalibration(): void {
  if (!open) return;
  open = false;
  emit();
}

/** For tests. */
export function resetCalibrationForTests(): void {
  open = false;
  listeners.clear();
}
