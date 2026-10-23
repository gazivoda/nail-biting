// Settings > Behaviors   (section id "behaviors")
//
// OWNER: WS1. Nobody else edits this file.
// SHOWN WHEN: detection_behaviors (see ../meta.ts; the page does the flag check, not this file).
//
// A list of what the camera watches for. Nail biting is on by default and is the only
// thing watched until the user changes it here. Behaviours without a real-footage
// validation yet appear only while the `experimental` flag is on, under their own heading.
// Labels, descriptions and the validation level live in src/detection/registry.ts.
//
// Text only, no pictures of the habit (DESIGN.md, lessons.md).

import { ListChecks } from 'lucide-react';
import { Section, Row, Toggle } from '../ui';
import { useBehaviorSettings } from '../../../detection/useBehaviors';
import type { Behavior } from '../../../storage/eventModel';
import { useT, type messages } from '../../../i18n/scopes/settings';

// The toggle's name is a whole sentence per behavior: the verb and the noun change together in other languages.
const WATCH_FOR_KEY = {
  nail_biting: 'behaviors.watchFor.nail_biting',
  cuticle_skin_biting: 'behaviors.watchFor.cuticle_skin_biting',
  nose_picking: 'behaviors.watchFor.nose_picking',
  eye_area_pulling: 'behaviors.watchFor.eye_area_pulling',
  face_skin_picking: 'behaviors.watchFor.face_skin_picking',
  hair_pulling: 'behaviors.watchFor.hair_pulling',
} as const satisfies Record<Behavior, keyof typeof messages>;

export function BehaviorsSection() {
  const t = useT();
  const { visible, selected, setBehavior } = useBehaviorSettings();
  const validated = visible.filter(b => b.validation === 'validated');
  const experimental = visible.filter(b => b.validation === 'experimental');
  const onlyOne = selected.length === 1;

  const rowFor = (id: (typeof visible)[number]['id']) => {
    const info = visible.find(b => b.id === id)!;
    const on = selected.includes(id);
    return (
      <Row key={id} label={info.label} description={info.description}>
        <Toggle
          value={on}
          onChange={next => setBehavior(id, next)}
          label={t(WATCH_FOR_KEY[id])}
        />
      </Row>
    );
  };

  return (
    <Section title={t('behaviors.title')} icon={ListChecks} fullWidth>
      <p className="text-sm text-stone-600 dark:text-stone-300">
        {t('behaviors.intro')}
        {onlyOne ? ` ${t('behaviors.atLeastOne')}` : ''}
      </p>

      {validated.map(b => rowFor(b.id))}

      {experimental.length > 0 && (
        <div className="space-y-5 border-t border-stone-200 pt-5 dark:border-ink-400">
          <div>
            <h3 className="text-[15px] font-semibold text-stone-900 dark:text-stone-100">{t('behaviors.experimental.title')}</h3>
            <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-300">
              {t('behaviors.experimental.note')}
            </p>
          </div>
          {experimental.map(b => rowFor(b.id))}
        </div>
      )}
    </Section>
  );
}
