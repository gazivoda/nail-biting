import { useCallback, useState } from 'react';
import type { ShareUiState } from './ui/CelebrationCard';
import type { MilestoneStatus } from './milestones';
import { buildShareCardModel, downloadBlob, renderShareCardPng, shareOrDownload } from './shareCard';

/** Makes the share card for a milestone and hands it to the share sheet or a download. Local only. */
export function useShareCard() {
  const [state, setState] = useState<ShareUiState>('idle');

  const share = useCallback(async (status: MilestoneStatus) => {
    setState('working');
    try {
      const model = buildShareCardModel(status);
      const png = await renderShareCardPng(model);
      const result = await shareOrDownload(
        png,
        `stop-biting-${status.def.id}.png`,
        `Stop Biting: ${model.title}. ${model.reached}.`,
        navigator,
        downloadBlob,
      );
      setState(result);
    } catch {
      setState('failed');
    }
  }, []);

  const reset = useCallback(() => setState('idle'), []);
  return { state, share, reset };
}
