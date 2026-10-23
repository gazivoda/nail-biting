// The one line Dashboard.tsx adds for WS2. Everything is behind a flag:
//   hrt_coaching  the bridge that offers the prompt after an alarm, and the
//                 quiet link to the 4-week program
//   urge_timer    the "I feel an urge" button and its breathing timer
// With both off this renders nothing at all (no node, no gap in the column).
//
// Reading a flag asks the server once per page load (GET /api/features), then
// uses the last answer cached by the storage module, so it also works offline.

import { useFeature } from '../features/useFeature';
import { CoachingBridge } from './CoachingBridge';
import { ProgramEntry } from './ProgramEntry';
import { UrgeTimer } from './UrgeTimer';

export function CoachingDashboardSlot() {
  const hrt = useFeature('hrt_coaching');
  const urge = useFeature('urge_timer');
  return (
    <>
      {hrt && <CoachingBridge />}
      {urge && <UrgeTimer />}
      {hrt && <ProgramEntry />}
    </>
  );
}
