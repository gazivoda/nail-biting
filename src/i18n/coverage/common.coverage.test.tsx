// Pseudo-locale coverage for the shared vocabulary: trigger-tag labels and behavior names/descriptions. They are
// read through getters (`tag.label`, `info.label`), so every screen that shows them follows the language.

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { usePseudoLocale, expectAllTranslated, expectNoMissingParams } from '../testing/pseudo';
import { PRESET_TAGS, URGE_TAG } from '../../components/dashboard/triggerTags';
import { BEHAVIOR_REGISTRY } from '../../detection/registry';
import { BEHAVIORS } from '../../storage/eventModel';
import { useT } from '../scopes/common';

export const COVERS = ['src/components/dashboard/triggerTags.ts', 'src/detection/registry.ts'];

function Common() {
  const t = useT();
  return (
    <ul>
      {(['cancel', 'close', 'back', 'save', 'delete', 'undo', 'done', 'continue', 'loading', 'tryAgain'] as const).map(k => <li key={k}>{t(k)}</li>)}
    </ul>
  );
}

describe('shared vocabulary, pseudo-locale', () => {
  usePseudoLocale();

  it('trigger tag labels come from the catalog (the stored ids stay English)', () => {
    const html = renderToStaticMarkup(<ul>{[...PRESET_TAGS, URGE_TAG].map(tag => <li key={tag.id} data-id={tag.id}>{tag.label}</li>)}</ul>);
    expectAllTranslated(html);
    expect(html).toContain('data-id="stress"');
    expect(PRESET_TAGS.map(t => t.id)).toEqual(['stress', 'focus', 'boredom', 'unknown']);
  });

  it('every behavior has a translated label, short label and description', () => {
    const html = renderToStaticMarkup(
      <div>
        {BEHAVIORS.map(id => (
          <section key={id}>
            <h3>{BEHAVIOR_REGISTRY[id].label}</h3>
            <b>{BEHAVIOR_REGISTRY[id].shortLabel}</b>
            <p>{BEHAVIOR_REGISTRY[id].description}</p>
          </section>
        ))}
      </div>,
    );
    expectAllTranslated(html);
    expectNoMissingParams(html);
  });

  it('the common words render translated', () => {
    expectAllTranslated(renderToStaticMarkup(<Common />));
  });
});

describe('shared vocabulary, English', () => {
  it('is what the app always said', () => {
    expect(PRESET_TAGS.map(t => t.label)).toEqual(['Stress', 'Deep focus', 'Boredom', 'Not sure']);
    expect(URGE_TAG.label).toBe('Urge');
    expect(BEHAVIOR_REGISTRY.nail_biting.label).toBe('Nail biting');
    expect(BEHAVIOR_REGISTRY.nail_biting.shortLabel).toBe('Nails');
  });
});
