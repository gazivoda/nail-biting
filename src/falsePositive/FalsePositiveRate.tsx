// The false-alarm rate as one quiet line (WS3), in History's summary and Settings > Detection. Renders
// nothing unless the `false_positive_controls` flag is on and there is something to say.

import { useState } from 'react';
import type { Incident } from '../types';
import { describeFalsePositiveRate, falsePositiveRates } from './stats';
import { useFalsePositiveEnabled } from './useEnabled';
import { useLocale } from '../i18n/hooks';

export function FalsePositiveRate({ incidents, className = '' }: { incidents: readonly Incident[]; className?: string }) {
  useLocale(); // the sentence is built by describeFalsePositiveRate with t(): re-render when the language changes
  const on = useFalsePositiveEnabled();
  // Anchored at mount so render stays pure; the two weeks are counted back from the moment the page opened.
  const [now] = useState(() => Date.now());
  if (!on) return null;
  const sentence = describeFalsePositiveRate(falsePositiveRates(incidents, now));
  if (!sentence) return null;
  return (
    <p className={`mt-4 border-t border-stone-200 pt-4 text-sm text-stone-600 dark:border-ink-400 dark:text-stone-300 ${className}`.trim()}>
      {sentence}
    </p>
  );
}
