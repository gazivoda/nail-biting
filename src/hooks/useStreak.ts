import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { formatDuration } from '../utils/time';

export function useStreak() {
  const { lastBiteTime, firstOpenTime, bestStreakMs } = useAppStore();
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  const streakStart = lastBiteTime ?? firstOpenTime;
  const currentStreakMs = Date.now() - streakStart;

  const totalSeconds = Math.floor(currentStreakMs / 1000);
  const streakSeconds = totalSeconds % 60;
  const streakMinutes = Math.floor(totalSeconds / 60) % 60;
  const streakHours = Math.floor(totalSeconds / 3600) % 24;
  const streakDays = Math.floor(totalSeconds / 86400);

  return {
    currentStreakMs,
    bestStreakMs,
    formattedCurrent: formatDuration(currentStreakMs),
    formattedBest: formatDuration(bestStreakMs),
    isGood: currentStreakMs > 60 * 60 * 1000,
    isGreat: currentStreakMs > 24 * 60 * 60 * 1000,
    streakDays,
    streakHours,
    streakMinutes,
    streakSeconds,
  };
}
