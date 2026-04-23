import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';

const GOAL_MS = 25 * 60 * 1000; // 25 minutes

export function SessionGoal() {
  const { cameraEnabled } = useAppStore();
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (cameraEnabled) {
      if (!startRef.current) startRef.current = Date.now() - elapsedMs;
      const id = setInterval(() => {
        setElapsedMs(Date.now() - startRef.current!);
      }, 1000);
      return () => clearInterval(id);
    } else {
      startRef.current = null;
    }
  }, [cameraEnabled]);

  const progress = Math.min(elapsedMs / GOAL_MS, 1);
  const minutes = Math.floor(elapsedMs / 60000);
  const seconds = Math.floor((elapsedMs % 60000) / 1000);
  const done = progress >= 1;

  return (
    <div className="bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-[18px] p-7 shadow-card dark:shadow-card-dark">
      <p className="text-[10px] font-semibold tracking-[1.2px] uppercase text-stone-400 dark:text-stone-500 mb-4">Session</p>

      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="font-mono text-[32px] font-medium leading-none tabular-nums text-stone-800 dark:text-stone-100 tracking-tight">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
        <span className="text-sm text-stone-400 dark:text-stone-500">/ 25m goal</span>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-1.5 bg-stone-100 dark:bg-ink-400 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${progress * 100}%`,
            background: done ? 'oklch(46% 0.130 148)' : 'oklch(58% 0.130 148)',
          }}
        />
      </div>

      {done && (
        <p className="text-[11px] text-forest-600 dark:text-forest-400 font-medium mt-2">
          Goal reached!
        </p>
      )}

      {!cameraEnabled && !done && (
        <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-2">
          Start detection to begin session
        </p>
      )}
    </div>
  );
}
