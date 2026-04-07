import { Eye, EyeOff, Loader2, AlertTriangle, WifiOff, EyeClosed } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { DetectionStatus } from '../../hooks/useDetection';

interface Props {
  status: DetectionStatus;
  cameraEnabled: boolean;
  onRetry?: () => void;
}

const config: Record<DetectionStatus, { icon: typeof Eye; label: string; color: string }> = {
  idle: { icon: EyeOff, label: 'Detection off', color: 'text-stone-500' },
  loading: { icon: Loader2, label: 'Loading AI models…', color: 'text-amber-400' },
  watching: { icon: Eye, label: 'Watching you', color: 'text-forest-400' },
  alert: { icon: AlertTriangle, label: 'Hands near mouth!', color: 'text-alert-400' },
  error: { icon: WifiOff, label: 'Model load failed', color: 'text-alert-600' },
};

export function DetectionStatus({ status, onRetry }: Props) {
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    const handler = () => setIsHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  if (status === 'watching' && isHidden) {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-500">
        <EyeClosed size={14} />
        <span>Paused — window hidden</span>
      </div>
    );
  }

  const { icon: Icon, label, color } = config[status];
  const isLoading = status === 'loading';

  return (
    <div className={`flex items-center gap-2 text-sm ${color}`}>
      <Icon size={14} className={isLoading ? 'animate-spin' : ''} />
      <span>{label}</span>
      {status === 'watching' && (
        <span className="w-2 h-2 rounded-full bg-forest-400 animate-pulse-slow" />
      )}
      {status === 'error' && onRetry && (
        <button
          onClick={onRetry}
          className="ml-1 text-xs underline text-alert-400 hover:text-alert-600"
        >
          Retry
        </button>
      )}
    </div>
  );
}
