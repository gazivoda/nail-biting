import { Eye, EyeOff, Loader2, AlertTriangle, WifiOff } from 'lucide-react';
import type { DetectionStatus } from '../../hooks/useDetection';

interface Props {
  status: DetectionStatus;
  cameraEnabled: boolean;
  onRetry?: () => void;
}

const config: Record<DetectionStatus, { icon: typeof Eye; label: string; color: string }> = {
  idle: { icon: EyeOff, label: 'Detection off', color: 'text-white/80' },
  loading: { icon: Loader2, label: 'Loading detection…', color: 'text-white' },
  watching: { icon: Eye, label: 'Watching', color: 'text-white' },
  alert: { icon: AlertTriangle, label: 'Hands near mouth', color: 'text-white' },
  // Never shown in a frame: DetectionSurface replaces the badge with the full
  // failure message and its Try again button.
  error: { icon: WifiOff, label: "Detection couldn't load", color: 'text-white' },
};

// A live region, so a screen reader hears the change from loading to
// detecting. There is no "paused" state: detection keeps a
// background interval while the tab is hidden, and a badge that only renders
// while the tab is hidden is one nobody sees.
export function DetectionStatus({ status }: Props) {
  const { icon: Icon, label, color } = config[status];
  const isLoading = status === 'loading';

  return (
    <div role="status" aria-live="polite" className={`inline-flex min-h-8 items-center gap-2 rounded-full bg-deep px-3.5 text-sm font-semibold ${color} ${status === 'alert' ? '!bg-alert-600' : ''}`}>
      <Icon size={14} aria-hidden="true" className={isLoading ? 'animate-spin' : ''} />
      <span>{label}</span>
      {status === 'watching' && (
        <span aria-hidden="true" className="w-2 h-2 rounded-full bg-lime-300 animate-pulse-slow motion-reduce:animate-none" />
      )}
    </div>
  );
}
