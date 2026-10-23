import type { ComponentType } from 'react';
import type { SettingsSectionId } from './meta';
import { DetectionSection } from './sections/DetectionSection';
import { AlertsSection } from './sections/AlertsSection';
import { BehaviorsSection } from './sections/BehaviorsSection';
import { ScheduleSection } from './sections/ScheduleSection';
import { AccountSyncSection } from './sections/AccountSyncSection';
import { DataSection } from './sections/DataSection';
import { SharingSection } from './sections/SharingSection';

/**
 * One component per section, each in its own file and edited by one workstream.
 * Lives in a .ts file so SettingsSlots.tsx exports only a component. Adding a
 * section means: an id in meta.ts, a file in ./sections, and a line here.
 */
export const SECTION_COMPONENTS: Record<SettingsSectionId, ComponentType> = {
  detection: DetectionSection,
  alerts: AlertsSection,
  behaviors: BehaviorsSection,
  schedule: ScheduleSection,
  'account-sync': AccountSyncSection,
  data: DataSection,
  sharing: SharingSection,
};
