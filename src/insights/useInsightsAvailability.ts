import { useFeatures } from '../features/useFeature';

/**
 * Whether History gets a second view, and what it is called. `null` with both flags off, so History is
 * exactly what it was. With only the photo diary on, the view is just the diary and says so in its name.
 */
export function useInsightsAvailability(): { label: 'Insights' | 'Photos' } | null {
  const flags = useFeatures();
  if (flags.insights) return { label: 'Insights' };
  if (flags.photo_diary) return { label: 'Photos' };
  return null;
}
