// Settings > Schedule   (section id "schedule")
//
// OWNER: WS7a. Nobody else edits this file.
// SHOWN WHEN: background_watching (see ../meta.ts; the page does the flag check, not this file).
// HOLDS: the work-hours schedule and its "Start watching?" reminder (src/background/ScheduleSettings.tsx).
// Pause and meeting mode are on the Watch tab and in the minimized window, not here.

import { ScheduleSettings } from '../../../background/ScheduleSettings';

export function ScheduleSection() {
  return <ScheduleSettings />;
}
