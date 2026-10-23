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

export function BehaviorsSection() {
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
          label={`Watch for ${info.label.toLowerCase()}`}
        />
      </Row>
    );
  };

  return (
    <Section title="Behaviors" icon={ListChecks} fullWidth>
      <p className="text-sm text-stone-600 dark:text-stone-300">
        Choose what the camera watches for. Each alarm is logged under the behavior that set it off.
        {onlyOne ? ' At least one stays on.' : ''}
      </p>

      {validated.map(b => rowFor(b.id))}

      {experimental.length > 0 && (
        <div className="space-y-5 border-t border-stone-200 pt-5 dark:border-ink-400">
          <div>
            <h3 className="text-[15px] font-semibold text-stone-900 dark:text-stone-100">Experimental</h3>
            <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-300">
              These have not been tried on real footage yet. Expect false alarms and missed ones.
            </p>
          </div>
          {experimental.map(b => rowFor(b.id))}
        </div>
      )}
    </Section>
  );
}
