import { PRICE_IDS } from './env';
import { useFeature } from '../features/useFeature';

/** Lifetime is for sale: the flag `lifetime_plan` is on and the build knows the Paddle price id (kept apart from the
 * card component, which only exports components, so fast refresh works). */
export function useLifetimeOn(): boolean {
  return useFeature('lifetime_plan') && PRICE_IDS.lifetime !== '';
}
