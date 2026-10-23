// Settings > Alerts   (section id "alerts")
//
// OWNER: WS2. Nobody else edits this file.
// SHOWN WHEN: hrt_coaching (see ../meta.ts; the page does the flag check, not this file).
// HOLDS: the competing-response prompt (when to show it, for how long, what to
// suggest) and the way into the 4-week program. The whole card is in
// ../CoachingSettings.tsx; this file is the one line that renders it.
//
// Use `fullWidth` unless the card is meant to pair with another half-width one,
// and follow DESIGN.md: pills, hairlines, no shadows, no illustrations of the habit.
// For gating INSIDE the card (one control behind a second flag) use
// useFeature('...') from '../../../features/useFeature'.

import { CoachingSettings } from '../CoachingSettings';

export function AlertsSection() {
  return <CoachingSettings />;
}
