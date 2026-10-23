// The behaviours the app can watch for: their names, their rule, and how far
// each one can be trusted (`validation`).
//
//   validated     the rule has been run against landmark fixtures and clears the
//                 owner's thresholds (scripts/eval-detection/thresholds.json).
//                 TODAY THAT MEANS SYNTHETIC FIXTURES ONLY. It is a regression
//                 guard for a rule that is unchanged from what shipped, not a
//                 measurement of real-world accuracy.
//   experimental  no real footage has been tried. Hidden unless the `experimental`
//                 feature flag is on, and never offered by default.
//
// Only nail_biting and cuticle_skin_biting may be 'validated' (docs/agents/
// SWARM_RULES.md): the second is the same mouth rule as the first under another
// name. Promoting anything else is the owner's call, made by recording real
// fixtures first (scripts/eval-detection/README.md) and then editing this file;
// src/detection/registry.test.ts fails if anyone does it without also deciding it
// in thresholds.json.
//
// No marketing page may advertise a behaviour on the strength of this table.

import { BEHAVIORS, type Behavior } from '../storage/eventModel.ts';
import { RULES, type ZoneRule } from './rules.ts';

export type ValidationLevel = 'validated' | 'experimental';

export interface BehaviorInfo {
  id: Behavior;
  /** Plain words for the settings list. */
  label: string;
  /** One word for tight spaces (the History filter). */
  shortLabel: string;
  /** One neutral sentence. It describes what is watched, never what the habit looks like. */
  description: string;
  validation: ValidationLevel;
  /** Behaviours in one group share a rule, so at most one of them is monitored at a time. */
  group?: 'mouth';
  rule: ZoneRule;
}

export const BEHAVIOR_REGISTRY: Readonly<Record<Behavior, BehaviorInfo>> = {
  nail_biting: {
    id: 'nail_biting',
    label: 'Nail biting',
    shortLabel: 'Nails',
    description: 'A fingertip held near your mouth for about 0.6 seconds. This is the check the app has always used.',
    validation: 'validated',
    group: 'mouth',
    rule: RULES.nail_biting,
  },
  cuticle_skin_biting: {
    id: 'cuticle_skin_biting',
    label: 'Cuticle and skin biting',
    shortLabel: 'Cuticles',
    description: 'The same mouth check as nail biting, recorded under this name. Choose the one that fits you; they share one check, so only one can be on.',
    validation: 'validated',
    group: 'mouth',
    rule: RULES.cuticle_skin_biting,
  },
  nose_picking: {
    id: 'nose_picking',
    label: 'Nose picking',
    shortLabel: 'Nose',
    description: 'An index or little fingertip at your nose for about 1.6 seconds.',
    validation: 'experimental',
    rule: RULES.nose_picking,
  },
  eye_area_pulling: {
    id: 'eye_area_pulling',
    label: 'Eyelash and eyebrow pulling',
    shortLabel: 'Eyes',
    description: 'A thumb and finger pinched together at your eye or brow for about 1.4 seconds.',
    validation: 'experimental',
    rule: RULES.eye_area_pulling,
  },
  face_skin_picking: {
    id: 'face_skin_picking',
    label: 'Face skin picking',
    shortLabel: 'Face skin',
    description: 'A fingertip moving in small repeated movements on your cheek, chin or forehead for about 3 seconds.',
    validation: 'experimental',
    rule: RULES.face_skin_picking,
  },
  hair_pulling: {
    id: 'hair_pulling',
    label: 'Hair pulling',
    shortLabel: 'Hair',
    description: 'A pinch above your forehead for about 2 seconds. Needs your camera framed high enough to see the top of your head.',
    validation: 'experimental',
    rule: RULES.hair_pulling,
  },
};

export const DEFAULT_BEHAVIORS: readonly Behavior[] = ['nail_biting'];

export const isExperimental = (id: Behavior): boolean => BEHAVIOR_REGISTRY[id].validation === 'experimental';

export interface SelectionOptions {
  /** The `experimental` feature flag. */
  experimental: boolean;
}

/** The behaviours the settings list may show, in registry order. */
export function visibleBehaviors({ experimental }: SelectionOptions): BehaviorInfo[] {
  return BEHAVIORS.map(id => BEHAVIOR_REGISTRY[id]).filter(b => experimental || b.validation === 'validated');
}

const isBehavior = (x: unknown): x is Behavior => typeof x === 'string' && (BEHAVIORS as readonly string[]).includes(x);

/**
 * Cleans whatever was stored: unknown names and duplicates dropped, experimental ones dropped
 * unless allowed, at most one behaviour per group (the first in registry order wins), registry
 * order. An empty result means nothing usable was stored and callers fall back to the default.
 */
export function normalizeSelection(stored: unknown, { experimental }: SelectionOptions): Behavior[] {
  if (!Array.isArray(stored)) return [];
  const picked = new Set(stored.filter(isBehavior));
  const out: Behavior[] = [];
  const groups = new Set<string>();
  for (const id of BEHAVIORS) {
    if (!picked.has(id)) continue;
    const info = BEHAVIOR_REGISTRY[id];
    if (!experimental && info.validation === 'experimental') continue;
    if (info.group) {
      if (groups.has(info.group)) continue;
      groups.add(info.group);
    }
    out.push(id);
  }
  return out;
}

export interface EffectiveFlags extends SelectionOptions {
  /** The `detection_behaviors` feature flag. */
  detectionBehaviors: boolean;
}

/**
 * What the detector should actually run. With `detection_behaviors` off this is ALWAYS
 * just nail biting, whatever is stored, so a flag that is off cannot change behaviour.
 */
export function effectiveBehaviors(flags: EffectiveFlags, stored: unknown): Behavior[] {
  if (!flags.detectionBehaviors) return [...DEFAULT_BEHAVIORS];
  const selection = normalizeSelection(stored, flags);
  return selection.length > 0 ? selection : [...DEFAULT_BEHAVIORS];
}

/**
 * The selection after the user turns one behaviour on or off. Turning one on turns off any
 * other behaviour of its group. The last behaviour cannot be turned off (nothing would be watched).
 */
export function toggleBehavior(current: readonly Behavior[], id: Behavior, on: boolean, options: SelectionOptions): Behavior[] {
  const next = new Set<Behavior>(normalizeSelection(current, options));
  if (on) {
    const group = BEHAVIOR_REGISTRY[id].group;
    if (group) for (const other of [...next]) if (BEHAVIOR_REGISTRY[other].group === group) next.delete(other);
    next.add(id);
  } else {
    if (next.size <= 1) return normalizeSelection([...next], options);
    next.delete(id);
  }
  return normalizeSelection([...next], options);
}

/** True when the selection is anything other than the default of nail biting alone. */
export function isNonDefaultSelection(stored: unknown): boolean {
  if (!Array.isArray(stored)) return false;
  return !(stored.length === 1 && stored[0] === 'nail_biting') && stored.length > 0;
}
