// Settings > Data   (section id "data")
//
// OWNER: WS4 (with WS5 photo diary). Nobody else edits this file.
// SHOWN WHEN: data_backup, event_sync, photo_diary (see ../meta.ts; the page does the flag check, not this file).
// HOLDS: export, restore, delete synced data, delete everything (WS4; ../DataSettings.tsx, flags
// data_backup and event_sync). The existing "Clear all data" card stays in Settings.tsx.
//
// WS5: add the photo diary controls as your own card below, behind `photo_diary`.
// The WS4 card renders nothing while data_backup and event_sync are both off.
//
// Use `fullWidth` unless the card is meant to pair with another half-width one,
// and follow DESIGN.md: pills, hairlines, no shadows, no illustrations of the habit.

import { DataSettings } from '../DataSettings';

export function DataSection() {
  return (
    <>
      <DataSettings />
    </>
  );
}
