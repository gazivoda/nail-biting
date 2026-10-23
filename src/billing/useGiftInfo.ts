// How long one gift lasts, from the server (GIFT_PLAN_DAYS), so the copy never states a duration the
// Paddle product does not have. Null until known, and null if the request fails: the copy then
// says "a gift" without a length.

import { useEffect, useState } from 'react';
import { useFeature } from '../features/useFeature';

let cached: number | null = null;

export function useGiftDays(): number | null {
  const on = useFeature('gift_plan');
  const [days, setDays] = useState<number | null>(cached);

  useEffect(() => {
    if (!on || cached !== null) return;
    let live = true;
    fetch('/api/billing/gift-info', { credentials: 'omit' })
      .then(r => (r.ok ? r.json() : null))
      .then((body: { days?: unknown } | null) => {
        if (typeof body?.days === 'number' && body.days > 0) {
          cached = body.days;
          if (live) setDays(body.days);
        }
      })
      .catch(() => { /* the copy works without it */ });
    return () => { live = false; };
  }, [on]);

  return on ? days : null;
}
