// Runs every rule over every fixture at the chosen sensitivities and applies the owner's thresholds.
// Pure: no printing, no process.exit. run.mjs prints, report.mjs writes markdown.
//
// WS3 added two more ways to play the same fixtures (see lib/replay.mjs):
//   shipped    the engine the app runs with the false_positive_controls flag OFF (what this file always did)
//   controls   the flag ON for a person who has not yet said "Not a bite": the chin-rest rule, both hands
//   learning   the flag ON and a simulated person who taps "Not a bite" after every false alarm
// Fixtures tagged `sequence` (one pose repeated, then a real bite) exist for the learning comparison; they
// are NOT part of the headline numbers for shipped and controls, so adding them cannot move the ratchet.

import { readFileSync } from 'node:fs';
import { BEHAVIORS } from '../../../src/storage/eventModel.ts';
import { BEHAVIOR_REGISTRY } from '../../../src/detection/registry.ts';
import { defaultControls } from '../../../src/detection/controls.ts';
import { replay } from './replay.mjs';
import { scoreRule, meets } from './score.mjs';

export const SENSITIVITIES = ['low', 'medium', 'high'];
export const VARIANTS = ['shipped', 'controls', 'learning'];
// ('shipped-sequences' is the shipped detector played over the sequence fixtures, for the learning comparison only.)
export const SEQUENCE_TAG = 'sequence';

/** Single scenes: the headline set. Sequences are kept apart for the learning comparison. */
export const headlineFixtures = fixtures => fixtures.filter(f => !f.tags.includes(SEQUENCE_TAG));
export const sequenceFixtures = fixtures => fixtures.filter(f => f.tags.includes(SEQUENCE_TAG));

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

const checkBar = (path, bar) => {
  for (const key of ['minPrecision', 'minRecall']) {
    const v = bar?.[key];
    if (typeof v !== 'number' || v < 0 || v > 1) throw new Error(`${path}.${key} must be a number from 0 to 1`);
  }
};

export function loadThresholds(path) {
  const t = JSON.parse(readFileSync(path, 'utf8'));
  for (const b of BEHAVIORS) {
    if (!t.rules?.[b]) throw new Error(`${path}: no entry for "${b}" in "rules"`);
    checkBar(`${path}: rules.${b}`, t.rules[b]);
  }
  if (!SENSITIVITIES.includes(t.gateSensitivity)) throw new Error(`${path}: gateSensitivity must be one of ${SENSITIVITIES.join(', ')}`);
  if (!Number.isInteger(t.promotion?.minRealEvents) || t.promotion.minRealEvents < 1) throw new Error(`${path}: promotion.minRealEvents must be a whole number of at least 1`);
  // WS3: the bars for the validated mouth rules with the controls on. Optional, so an old thresholds file still loads.
  for (const key of ['withControls', 'withLearning']) {
    for (const b of ['nail_biting', 'cuticle_skin_biting']) {
      if (t[key]?.[b]) checkBar(`${path}: ${key}.${b}`, t[key][b]);
    }
  }
  if (t.controlsMaxRecallDrop !== undefined && !(t.controlsMaxRecallDrop >= 0 && t.controlsMaxRecallDrop <= 1)) throw new Error(`${path}: controlsMaxRecallDrop must be from 0 to 1`);
  return t;
}

function barFor(thresholds, behavior, variant) {
  if (variant === 'controls') return thresholds.withControls?.[behavior] ?? thresholds.rules[behavior];
  if (variant === 'learning') return thresholds.withLearning?.[behavior] ?? thresholds.withControls?.[behavior] ?? thresholds.rules[behavior];
  return thresholds.rules[behavior];
}

/** Each rule on its own, over the fixtures of the variant's set, at one sensitivity. */
export function evaluateAll(fixtures, thresholds, sensitivity, variant = 'shipped') {
  const graceMs = thresholds.graceMs ?? 1000;
  const set = variant === 'learning' || variant === 'shipped-sequences' ? sequenceFixtures(fixtures) : headlineFixtures(fixtures);
  return BEHAVIORS.map(behavior => {
    const results = set.map(fixture => {
      const options = { behaviors: [behavior], sensitivity };
      if (variant === 'controls' || variant === 'learning') options.controls = defaultControls();
      if (variant === 'learning') {
        // The simulated person's judgement is the fixture's own labels, the same ones that score the alarm.
        options.learn = { isCorrect: (t, b) => fixture.labels.some(l => l.behaviors.includes(b) && t >= l.startMs && t <= l.endMs + graceMs) };
      }
      const played = replay(fixture, options);
      return { fixture, alarms: played.alarms, taps: played.taps };
    });
    const score = scoreRule(results, behavior, { graceMs });
    const bar = barFor(thresholds, behavior, variant);
    const level = BEHAVIOR_REGISTRY[behavior].validation;

    const own = scoreRule(results.filter(r => r.fixture.tags.includes(FAMILY_TAG[behavior]) || r.fixture.tags.includes('idle')), behavior, { graceMs });
    const real = scoreRule(results.filter(r => r.fixture.source === 'real'), behavior, { graceMs });
    const promotable = real.events >= thresholds.promotion.minRealEvents && meets(real, bar);

    return {
      ...score,
      variant,
      level,
      bar,
      passesBar: meets(score, bar),
      own: { alarms: own.alarms, correct: own.correct, falseAlarms: own.falseAlarms, events: own.events, detected: own.detected, precision: own.precision, recall: own.recall },
      realEvents: real.events,
      promotable,
      taps: results.reduce((n, r) => n + (r.taps ?? 0), 0),
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
    const where = row.variant && row.variant !== 'shipped' ? ` (${row.variant})` : '';
    if (row.events === 0) failures.push(`${row.behavior}${where}: no labelled events in the fixtures, so recall cannot be measured`);
    if (row.precision !== null && row.precision < row.bar.minPrecision) failures.push(`${row.behavior}${where}: precision ${row.precision.toFixed(2)} is below ${row.bar.minPrecision}`);
    if (row.recall !== null && row.recall < row.bar.minRecall) failures.push(`${row.behavior}${where}: recall ${row.recall.toFixed(2)} is below ${row.bar.minRecall}`);
  }
  return { ok: failures.length === 0, failures, skipped: false };
}

/**
 * The acceptance line of WS3 as checks over the three variants at the gate sensitivity: the controls find
 * at least as many chin-rest scenes' worth of silence (fewer false alarms on the chin-rest-rule fixtures),
 * and nail-biting recall is no more than `controlsMaxRecallDrop` (default 5 points) below the shipped detector's.
 */
export function controlsAcceptance(fixtures, thresholds, shipped, controls) {
  const failures = [];
  const maxDrop = thresholds.controlsMaxRecallDrop ?? 0.05;
  const s = shipped.find(r => r.behavior === 'nail_biting');
  const c = controls.find(r => r.behavior === 'nail_biting');
  if (s.recall !== null && c.recall !== null && c.recall < s.recall - maxDrop) {
    failures.push(`nail_biting recall with the controls (${c.recall.toFixed(2)}) is more than ${(maxDrop * 100).toFixed(0)} points below the shipped detector's (${s.recall.toFixed(2)})`);
  }
  const chinFalse = rows => rows.results.filter(r => r.fixture.tags.includes('chin-rest-rule')).reduce((n, r) => n + r.alarms.filter(a => !isCorrect(r.fixture, a, 'nail_biting', thresholds.graceMs ?? 1000)).length, 0);
  const before = chinFalse(s);
  const after = chinFalse(c);
  if (!(after < before)) failures.push(`the controls do not reduce false alarms on the chin-rest-rule fixtures (${before} shipped, ${after} with controls)`);
  return { ok: failures.length === 0, failures, chinRest: { before, after } };
}

function isCorrect(fixture, alarm, behavior, graceMs) {
  return fixture.labels.some(l => l.behaviors.includes(behavior) && alarm.t >= l.startMs && alarm.t <= l.endMs + graceMs);
}
