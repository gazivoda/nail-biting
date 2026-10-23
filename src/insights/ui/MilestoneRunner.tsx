// Shows the celebration card when a milestone is reached. Lazy chunk behind MilestoneHost.

import { useShareCard } from '../useShareCard';
import { CelebrationCard } from './CelebrationCard';
import { useMilestoneCelebration } from '../useMilestoneCelebration';

export function MilestoneRunner() {
  const { current, dismiss } = useMilestoneCelebration();
  const share = useShareCard();
  if (!current) return null;
  return (
    <CelebrationCard
      status={current}
      shareState={share.state}
      onShare={() => { void share.share(current); }}
      onClose={() => { share.reset(); dismiss(); }}
    />
  );
}
