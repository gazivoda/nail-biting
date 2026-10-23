import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { decideCelebration } from './celebrate';
import { markMilestonesSeen, readMilestoneRecord } from './milestoneSeen';
import type { MilestoneStatus } from './milestones';

const CHECK_EVERY_MS = 60_000;
const FIRST_CHECK_MS = 2_500;

/**
 * Watches the history and the clock, and hands out one milestone at a time. A milestone is recorded as seen
 * the moment it is shown, so closing the tab with the card open does not bring it back. Checks: shortly after
 * the app opens, whenever the history changes, once a minute (a streak milestone is reached by time passing),
 * and when the tab becomes visible again. Nothing is shown in a hidden tab.
 */
export function useMilestoneCelebration(): { current: MilestoneStatus | null; dismiss: () => void } {
  const [current, setCurrent] = useState<MilestoneStatus | null>(null);
  const showing = useRef(false);

  const check = useCallback(() => {
    if (showing.current || document.visibilityState === 'hidden') return;
    try {
      const { incidents, historyStartTime } = useAppStore.getState();
      const now = Date.now();
      const record = readMilestoneRecord();
      const decision = decideCelebration({ events: incidents, startedAt: historyStartTime, now, seen: record.seen, baselined: record.baselined });
      if (decision.baseline) {
        markMilestonesSeen(decision.silent, now, { baseline: true });
        return;
      }
      if (!decision.show) return;
      markMilestonesSeen([decision.show.def.id, ...decision.silent], now);
      showing.current = true;
      setCurrent(decision.show);
    } catch {
      /* a celebration must never break the app */
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(check, FIRST_CHECK_MS);
    const every = window.setInterval(check, CHECK_EVERY_MS);
    const unsubscribe = useAppStore.subscribe((state, prev) => {
      if (state.incidents !== prev.incidents) window.setTimeout(check, 0);
    });
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check]);

  const dismiss = useCallback(() => {
    showing.current = false;
    setCurrent(null);
    // Another one may be waiting (the alarm count and a streak can arrive together).
    window.setTimeout(check, 600);
  }, [check]);

  return { current, dismiss };
}
