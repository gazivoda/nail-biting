import { useFeatures } from '../features/useFeature';
import { useT } from '../i18n/scopes/history';

/**
 * Whether History gets a second view, and what it is called. `null` with both flags off, so History is
 * exactly what it was. With only the photo diary on, the view is just the diary and says so in its name.
 * The words are in the `history` scope: this runs in the History page itself, not in the lazy Insights chunk.
 */
export function useInsightsAvailability(): { label: string } | null {
  const flags = useFeatures();
  const t = useT();
  if (flags.insights) return { label: t('switch.insights') };
  if (flags.photo_diary) return { label: t('switch.photos') };
  return null;
}
