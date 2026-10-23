import type { ComponentType } from 'react';
import { useFeatures } from '../../features/useFeature';
import { visibleSections, type SettingsSectionId } from './meta';
import { SECTION_COMPONENTS } from './sectionComponents';

/**
 * Renders the flag-enabled sections, in order, as grid children of the Settings
 * page (a fragment, so each section's own card is the grid item). Renders
 * nothing when no section is enabled or when the enabled ones have no content.
 */
export function SettingsSlots({ components = SECTION_COMPONENTS }: { components?: Record<SettingsSectionId, ComponentType> }) {
  const flags = useFeatures();
  const sections = visibleSections(flags);
  if (sections.length === 0) return null;
  return (
    <>
      {sections.map(s => {
        const Component = components[s.id];
        return <Component key={s.id} />;
      })}
    </>
  );
}
