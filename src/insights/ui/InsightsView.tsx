// The Insights view inside History (Log.tsx): reads the store, works out the numbers once per change, and
// hands them to <InsightsBody />. Lazy-loaded, so nobody downloads it until they open the view.

import { Suspense, lazy, useMemo, useState } from 'react';
import { useFeatures } from '../../features/useFeature';
import { useAppStore } from '../../store/useAppStore';
import { computeInsightsMemo } from '../aggregate';
import { evaluateMilestones, type MilestoneStatus } from '../milestones';
import { useNow } from '../useNow';
import { useShareCard } from '../useShareCard';
import { CelebrationCard } from './CelebrationCard';
import { InsightsBody, type RangeDays, type Series } from './InsightsBody';

// The diary pulls in its own code (camera, canvas, storage), fetched only while photo_diary is on.
const PhotoDiary = lazy(() => import('../../photos/PhotoDiary').then(m => ({ default: m.PhotoDiary })));

export function InsightsView({ onGoToWatch }: { onGoToWatch?: () => void }) {
  const flags = useFeatures();
  const incidents = useAppStore(s => s.incidents);
  const customTags = useAppStore(s => s.customTags);
  const historyStartTime = useAppStore(s => s.historyStartTime);
  const now = useNow(60_000);

  const [series, setSeries] = useState<Series>('bites');
  const [rangeDays, setRangeDays] = useState<RangeDays>(90);
  const [viewing, setViewing] = useState<MilestoneStatus | null>(null);
  const card = useShareCard();

  const insights = useMemo(() => computeInsightsMemo(incidents, { now, rangeDays }), [incidents, now, rangeDays]);
  const milestones = useMemo(
    () => evaluateMilestones({ events: incidents, startedAt: historyStartTime, now }),
    [incidents, historyStartTime, now],
  );

  const close = () => { setViewing(null); card.reset(); };

  return (
    <>
      <InsightsBody
        insights={insights}
        milestones={milestones}
        customTags={customTags}
        series={series}
        onSeries={setSeries}
        rangeDays={rangeDays}
        onRangeDays={setRangeDays}
        charts={flags.insights}
        coachingOn={flags.hrt_coaching}
        falseAlarmsOn={flags.false_positive_controls}
        onGoToWatch={onGoToWatch}
        onOpenMilestone={setViewing}
        photoDiary={flags.photo_diary ? <Suspense fallback={null}><PhotoDiary /></Suspense> : null}
      />
      {viewing && (
        <CelebrationCard status={viewing} shareState={card.state} onShare={() => { void card.share(viewing); }} onClose={close} />
      )}
    </>
  );
}
