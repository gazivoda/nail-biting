// Which Settings sections exist, who owns them, and which feature flags show
// them. Pure data and one pure function, so it is tested without React.
//
// Settings.tsx keeps every card it had (Plan, Detection and alarm, Periodic
// reminders, Alarm sound, Bite reasons, Appearance, Privacy, Data). The seven
// sections below are NEW cards added after "Bite reasons" by <SettingsSlots />.
// A section appears only when at least one of its flags is on; a section with
// nothing to show renders null. So with every flag off the page is unchanged.

import type { FeatureName, FlagMap } from '../../features/flags';

export type SettingsSectionId =
  | 'detection'
  | 'alerts'
  | 'behaviors'
  | 'schedule'
  | 'account-sync'
  | 'data'
  | 'sharing';

export interface SettingsSectionMeta {
  id: SettingsSectionId;
  /** Heading for the card. The section component renders it via <Section title=...>. */
  title: string;
  /** Workstream that edits src/pages/settings/sections/<File>.tsx. */
  owner: string;
  /** Shown when ANY of these is on. An empty list means "always eligible". */
  flags: readonly FeatureName[];
}

/** Render order. The order of the plan: Detection, Alerts, Behaviors, Schedule, Account & Sync, Data, Sharing. */
export const SETTINGS_SECTIONS: readonly SettingsSectionMeta[] = [
  { id: 'detection',    title: 'Detection',      owner: 'WS3',  flags: ['false_positive_controls'] },
  { id: 'alerts',       title: 'Alerts',         owner: 'WS2',  flags: ['hrt_coaching'] },
  { id: 'behaviors',    title: 'Behaviors',      owner: 'WS1',  flags: ['detection_behaviors'] },
  { id: 'schedule',     title: 'Schedule',       owner: 'WS7a', flags: ['background_watching'] },
  { id: 'account-sync', title: 'Account & Sync', owner: 'WS4',  flags: ['event_sync', 'signin_magic_link', 'signin_apple', 'signin_microsoft', 'weekly_email', 'referrals', 'locale_es', 'locale_de', 'locale_pt_br'] },
  { id: 'data',         title: 'Data',           owner: 'WS4',  flags: ['data_backup', 'event_sync', 'photo_diary'] },
  { id: 'sharing',      title: 'Sharing',        owner: 'WS10', flags: ['share_links'] },
];

export function sectionIsEnabled(section: SettingsSectionMeta, flags: FlagMap): boolean {
  return section.flags.length === 0 || section.flags.some(f => flags[f] === true);
}

/** The sections whose flags allow them to appear, in render order. */
export function visibleSections(
  flags: FlagMap,
  sections: readonly SettingsSectionMeta[] = SETTINGS_SECTIONS,
): SettingsSectionMeta[] {
  return sections.filter(s => sectionIsEnabled(s, flags));
}
