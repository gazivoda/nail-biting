// Runs every rule over every fixture at the chosen sensitivities and applies the owner's thresholds.
// Pure: no printing, no process.exit. run.mjs prints, report.mjs writes markdown.

import { readFileSync } from 'node:fs';
import { BEHAVIORS } from '../../../src/storage/eventModel.ts';
import { BEHAVIOR_REGISTRY } from '../../../src/detection/registry.ts';
import { replay } from './replay.mjs';
import { scoreRule, meets } from './score.mjs';

export const SENSITIVITIES = ['low', 'medium', 'high'];

/**
 * The fixture tag that marks a scene as belonging to a rule's own family (see scenes.mjs). The headline
 * numbers use EVERY fixture; the "own scenes" numbers use only the family's plus the idle scene.
 */
export const FAMILY_TAG = {
  nail_biting: 'mouth',
  cuticle_skin_biting: 'mouth',
  nose_picking: 'nose',
  eye_area_pulling: 'eye',
  face_skin_picking: 'face-skin',
  hair_pulling: 'hair',
};

export function loadThresholds(path) {
  const t = JSON.parse(readFileSync(path, 'utf8'));
  for (const b of BEHAVIORS) {
    if (!t.rules?.[b]) throw new Error(`${path}: no entry for "${b}" in "rules"`);
    for (const key of ['minPrecision', 'minRecall']) {
      const v = t.rules[b][key];
      if (typeof v !== 'number' || v < 0 || v > 1) throw new Error(`${path}: rules.${b}.${key} must be a number from 0 to 1`);
    }
  }
  if (!SENSITIVITIES.includes(t.gateSensitivity)) throw new Error(`${path}: gateSensitivity must be one of ${SENSITIVITIES.join(', ')}`);
  if (!Number.isInteger(t.promotion?.minRealEvents) || t.promotion.minRealEvents < 1) throw new Error(`${path}: promotion.minRealEvents must be a whole number of at least 1`);
  return t;
}

/** Each rule on its own, over all fixtures, at one sensitivity. */
export function evaluateAll(fixtures, thresholds, sensitivity) {
  const graceMs = thresholds.graceMs ?? 1000;
  return BEHAVIORS.map(behavior => {
    const results = fixtures.map(fixture => ({ fixture, alarms: replay(fixture, { behaviors: [behavior], sensitivity }).alarms }));
    const score = scoreRule(results, behavior, { graceMs });
    const bar = thresholds.rules[behavior];
    const level = BEHAVIOR_REGISTRY[behavior].validation;

    const own = scoreRule(results.filter(r => r.fixture.tags.includes(FAMILY_TAG[behavior]) || r.fixture.tags.includes('idle')), behavior, { graceMs });
    const real = scoreRule(results.filter(r => r.fixture.source === 'real'), behavior, { graceMs });
    const promotable = real.events >= thresholds.promotion.minRealEvents && meets(real, bar);

    return {
      ...score,
      level,
      bar,
      passesBar: meets(score, bar),
      own: { alarms: own.alarms, correct: own.correct, falseAlarms: own.falseAlarms, events: own.events, detected: own.detected, precision: own.precision, recall: own.recall },
      realEvents: real.events,
      promotable,
      // A validated rule must meet its bar; an experimental one is only reported against it.
      gated: level === 'validated',
      results,
    };
  });
}

/** Whether nothing gated failed, and why not. Only the gate sensitivity is judged. */
export function gate(rows, thresholds, sensitivity) {
  if (sensitivity !== thresholds.gateSensitivity) return { ok: true, failures: [], skipped: true };
  const failures = [];
  for (const row of rows) {
    if (!row.gated) continue;
    if (row.events === 0) failures.push(`${row.behavior}: no labelled events in the fixtures, so recall cannot be measured`);
    if (row.precision !== null && row.precision < row.bar.minPrecision) failures.push(`${row.behavior}: precision ${row.precision.toFixed(2)} is below ${row.bar.minPrecision}`);
    if (row.recall !== null && row.recall < row.bar.minRecall) failures.push(`${row.behavior}: recall ${row.recall.toFixed(2)} is below ${row.bar.minRecall}`);
  }
  return { ok: failures.length === 0, failures, skipped: false };
}
