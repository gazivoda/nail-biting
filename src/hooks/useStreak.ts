import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { formatDuration } from '../utils/time';

export function useStreak() {
  const { lastBiteTime, firstOpenTime, bestStreakMs } = useAppStore();
  const [, setTick] = useState(0);

  // Re-render every 60 seconds to keep timer live
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const streakStart = lastBiteTime ?? firstOpenTime;
  const currentStreakMs = Date.now() - streakStart;

  return {
    currentStreakMs,
    bestStreakMs,
    formattedCurrent: formatDuration(currentStreakMs),
    formattedBest: formatDuration(bestStreakMs),
    isGood: currentStreakMs > 60 * 60 * 1000,   // over 1 hour = good
    isGreat: currentStreakMs > 24 * 60 * 60 * 1000, // over 1 day = great
  };
}
