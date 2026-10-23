import { describe, it, expect } from 'vitest';
import {
  BEHAVIOR_REGISTRY,
  DEFAULT_BEHAVIORS,
  effectiveBehaviors,
  isNonDefaultSelection,
  normalizeSelection,
  toggleBehavior,
  visibleBehaviors,
} from './registry.ts';
import { RULES } from './rules.ts';
import { BEHAVIORS } from '../storage/eventModel.ts';

const OFF = { detectionBehaviors: false, experimental: false };
const ON = { detectionBehaviors: true, experimental: false };
const EXPERIMENTAL = { detectionBehaviors: true, experimental: true };

describe('the behaviour registry', () => {
  it('covers every behaviour in the event schema exactly once, with its rule', () => {
    expect(Object.keys(BEHAVIOR_REGISTRY).sort()).toEqual([...BEHAVIORS].sort());
    for (const b of BEHAVIORS) {
      expect(BEHAVIOR_REGISTRY[b].id).toBe(b);
      expect(BEHAVIOR_REGISTRY[b].rule).toBe(RULES[b]);
      expect(BEHAVIOR_REGISTRY[b].label.length).toBeGreaterThan(0);
    }
    expect(new Set(BEHAVIORS.map(b => BEHAVIOR_REGISTRY[b].label)).size).toBe(BEHAVIORS.length);
  });

  // docs/agents/SWARM_RULES.md: only synthetic fixtures exist, so only the mouth rule and its relabelling may be validated.
  it('marks only nail biting and cuticle/skin biting validated; everything else is experimental', () => {
    const validated = BEHAVIORS.filter(b => BEHAVIOR_REGISTRY[b].validation === 'validated');
    expect(validated).toEqual(['nail_biting', 'cuticle_skin_biting']);
    for (const b of BEHAVIORS) {
      expect(['validated', 'experimental']).toContain(BEHAVIOR_REGISTRY[b].validation);
    }
  });

  it('the two validated behaviours share one mouth rule and one group', () => {
    expect(BEHAVIOR_REGISTRY.nail_biting.group).toBe('mouth');
    expect(BEHAVIOR_REGISTRY.cuticle_skin_biting.group).toBe('mouth');
    expect(BEHAVIOR_REGISTRY.nail_biting.rule.zone).toBe(BEHAVIOR_REGISTRY.cuticle_skin_biting.rule.zone);
  });

  it('the default is nail biting alone', () => {
    expect(DEFAULT_BEHAVIORS).toEqual(['nail_biting']);
  });

});

describe('what the settings list shows', () => {
  it('shows only the validated behaviours unless the experimental flag is on', () => {
    expect(visibleBehaviors({ experimental: false }).map(b => b.id)).toEqual(['nail_biting', 'cuticle_skin_biting']);
    expect(visibleBehaviors({ experimental: true }).map(b => b.id)).toEqual([...BEHAVIORS]);
  });
});

describe('effectiveBehaviors: what the detector actually runs', () => {
  it('with detection_behaviors off it is ALWAYS nail biting, whatever is stored', () => {
    for (const stored of [undefined, null, [], ['nose_picking'], ['cuticle_skin_biting'], ['hair_pulling', 'nail_biting'], 'garbage', 42]) {
      expect(effectiveBehaviors(OFF, stored)).toEqual(['nail_biting']);
      expect(effectiveBehaviors({ detectionBehaviors: false, experimental: true }, stored)).toEqual(['nail_biting']);
    }
  });

  it('with the flag on and nothing usable stored it is nail biting', () => {
    for (const stored of [undefined, null, [], 'x', {}, ['not_a_behaviour']]) {
      expect(effectiveBehaviors(ON, stored)).toEqual(['nail_biting']);
    }
  });

  it('honours a stored validated choice', () => {
    expect(effectiveBehaviors(ON, ['cuticle_skin_biting'])).toEqual(['cuticle_skin_biting']);
  });

  it('drops experimental behaviours unless the experimental flag is on, then falls back if nothing is left', () => {
    expect(effectiveBehaviors(ON, ['nose_picking'])).toEqual(['nail_biting']);
    expect(effectiveBehaviors(ON, ['nail_biting', 'nose_picking'])).toEqual(['nail_biting']);
    expect(effectiveBehaviors(EXPERIMENTAL, ['nose_picking'])).toEqual(['nose_picking']);
    expect(effectiveBehaviors(EXPERIMENTAL, ['nail_biting', 'nose_picking'])).toEqual(['nail_biting', 'nose_picking']);
  });

  it('never runs both mouth labels: they are one check', () => {
    expect(effectiveBehaviors(ON, ['cuticle_skin_biting', 'nail_biting'])).toEqual(['nail_biting']);
  });

  it('returns registry order without duplicates', () => {
    expect(effectiveBehaviors(EXPERIMENTAL, ['hair_pulling', 'nose_picking', 'nose_picking', 'nail_biting']))
      .toEqual(['nail_biting', 'nose_picking', 'hair_pulling']);
  });

  it('returns a fresh array each time, so nobody can edit the default', () => {
    const a = effectiveBehaviors(OFF, undefined);
    a.push('hair_pulling');
    expect(effectiveBehaviors(OFF, undefined)).toEqual(['nail_biting']);
    expect(DEFAULT_BEHAVIORS).toEqual(['nail_biting']);
  });
});

describe('toggleBehavior', () => {
  it('turning one mouth label on turns the other off', () => {
    expect(toggleBehavior(['nail_biting'], 'cuticle_skin_biting', true, { experimental: false })).toEqual(['cuticle_skin_biting']);
    expect(toggleBehavior(['cuticle_skin_biting'], 'nail_biting', true, { experimental: false })).toEqual(['nail_biting']);
  });

  it('adds and removes experimental ones next to the mouth label', () => {
    const opts = { experimental: true };
    expect(toggleBehavior(['nail_biting'], 'nose_picking', true, opts)).toEqual(['nail_biting', 'nose_picking']);
    expect(toggleBehavior(['nail_biting', 'nose_picking'], 'nail_biting', false, opts)).toEqual(['nose_picking']);
  });

  it('refuses to turn the last behaviour off', () => {
    expect(toggleBehavior(['nail_biting'], 'nail_biting', false, { experimental: false })).toEqual(['nail_biting']);
    expect(toggleBehavior(['nose_picking'], 'nose_picking', false, { experimental: true })).toEqual(['nose_picking']);
  });
});

describe('normalizeSelection / isNonDefaultSelection', () => {
  it('ignores anything that is not a list of known names', () => {
    expect(normalizeSelection('nail_biting', { experimental: true })).toEqual([]);
    expect(normalizeSelection(['nail_biting', 7, null, 'x'], { experimental: true })).toEqual(['nail_biting']);
  });

  it('only a stored choice other than "nail biting alone" is non-default', () => {
    expect(isNonDefaultSelection(undefined)).toBe(false);
    expect(isNonDefaultSelection(null)).toBe(false);
    expect(isNonDefaultSelection([])).toBe(false);
    expect(isNonDefaultSelection(['nail_biting'])).toBe(false);
    expect(isNonDefaultSelection(['cuticle_skin_biting'])).toBe(true);
    expect(isNonDefaultSelection(['nail_biting', 'nose_picking'])).toBe(true);
  });
});
