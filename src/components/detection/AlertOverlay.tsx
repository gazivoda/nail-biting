import { AlertTriangle } from 'lucide-react';

interface Props {
  visible: boolean;
}

export function AlertOverlay({ visible }: Props) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Alert border flash */}
      <div className="absolute inset-0 border-8 border-alert-400 alert-flash rounded-none" />
      {/* Center message */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="alert-flash bg-alert-900/90 border border-alert-400 rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-2xl">
          <AlertTriangle className="text-alert-400" size={48} />
          <p className="text-2xl font-bold text-cream-100">Hands away!</p>
          <p className="text-alert-100 text-sm">Stop biting your nails!</p>
        </div>
      </div>
    </div>
  );
}
