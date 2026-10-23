// npm run eval:detection
//
// Replays the landmark fixtures through the app's own detection engine, one rule at a time, and prints
// precision and recall per rule. Exits 1 if a rule marked 'validated' (src/detection/registry.ts) falls
// below its bar in thresholds.json. Experimental rules are reported, never gated.
//
// It plays everything three ways (WS3): the shipped detector (the false_positive_controls flag off), the
// controls on, and the controls on with a simulated person who taps "Not a bite". The validated rules are
// gated in all three, each against its own bar, and the plan's acceptance line is checked: fewer false alarms
// on the chin-rest-rule scenes, and recall no more than 5 points below the shipped detector's.
//
//   --fixtures <dir>          default: scripts/eval-detection/fixtures (plus fixtures/real if present)
//   --thresholds <file>       default: scripts/eval-detection/thresholds.json
//   --report <file>           also write the markdown report there (docs/agents/ws1-eval-report.md)
//   --controls-report <file>  also write the WS3 comparison there (docs/agents/ws3-eval-report.md)
//   --sensitivity <s>         gate on this one instead of thresholds.json's gateSensitivity (low|medium|high)
//   --json                    print the results as JSON instead of the table
//
// SYNTHETIC fixtures measure a rule against scenes someone drew. They are a regression guard, not a claim
// about real-world accuracy.

import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtures } from './lib/fixtures.mjs';
import { SENSITIVITIES, controlsAcceptance, evaluateAll, gate, headlineFixtures, loadThresholds, sequenceFixtures } from './lib/evaluate.mjs';
import { renderReport, renderTable } from './lib/report.mjs';
import { renderControlsReport, renderControlsTable } from './lib/controlsReport.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
}

export function runEvaluation({ fixturesDir = join(HERE, 'fixtures'), thresholdsPath = join(HERE, 'thresholds.json'), gateOn = null } = {}) {
  const thresholds = loadThresholds(thresholdsPath);
  if (gateOn) thresholds.gateSensitivity = gateOn;
  const allFixtures = loadFixtures(fixturesDir);
  const fixtures = headlineFixtures(allFixtures);
  const sequences = sequenceFixtures(allFixtures);
  const play = variant => Object.fromEntries(SENSITIVITIES.map(s => [s, evaluateAll(allFixtures, thresholds, s, variant)]));

  const bySensitivity = play('shipped');
  const controls = play('controls');
  const learning = play('learning');
  const sequenceShipped = Object.fromEntries(SENSITIVITIES.map(s => [s, evaluateAll(allFixtures, thresholds, s, 'shipped-sequences').find(r => r.behavior === 'nail_biting').results]));

  const g = thresholds.gateSensitivity;
  const shippedVerdict = gate(bySensitivity[g], thresholds, g);
  const controlsVerdict = gate(controls[g], thresholds, g);
  const learningVerdict = gate(learning[g], thresholds, g);
  const acceptance = controlsAcceptance(allFixtures, thresholds, bySensitivity[g], controls[g]);
  const failures = [...shippedVerdict.failures, ...controlsVerdict.failures, ...learningVerdict.failures, ...acceptance.failures];
  const verdict = { ok: failures.length === 0, failures, skipped: shippedVerdict.skipped };

  return { fixtures, allFixtures, sequences, thresholds, bySensitivity, controls, learning, sequenceShipped, acceptance, verdict };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const sensitivity = arg('--sensitivity');
  if (sensitivity && !SENSITIVITIES.includes(sensitivity)) {
    console.error(`--sensitivity must be one of ${SENSITIVITIES.join(', ')}`);
    process.exit(2);
  }
  const result = runEvaluation({
    fixturesDir: arg('--fixtures') ? resolve(arg('--fixtures')) : undefined,
    thresholdsPath: arg('--thresholds') ? resolve(arg('--thresholds')) : undefined,
    gateOn: sensitivity,
  });

  if (process.argv.includes('--json')) {
    const slim = rows => rows.map(({ results: _results, ...rest }) => rest);
    const dump = by => Object.fromEntries(Object.entries(by).map(([k, v]) => [k, slim(v)]));
    console.log(JSON.stringify({ gate: result.verdict, bySensitivity: dump(result.bySensitivity), controls: dump(result.controls), learning: dump(result.learning) }, null, 2));
  } else {
    console.log(renderTable(result));
    console.log(renderControlsTable(result));
  }

  const reportPath = arg('--report');
  if (reportPath) {
    writeFileSync(resolve(reportPath), renderReport(result));
    console.log(`\nWrote ${reportPath}`);
  }
  const controlsReportPath = arg('--controls-report');
  if (controlsReportPath) {
    writeFileSync(resolve(controlsReportPath), renderControlsReport(result));
    console.log(`\nWrote ${controlsReportPath}`);
  }

  if (!result.verdict.ok) {
    console.error('\nFAILED: a validated rule fell below its bar in thresholds.json, or the WS3 acceptance line is not met:');
    for (const f of result.verdict.failures) console.error(`  - ${f}`);
    process.exit(1);
  }
}
