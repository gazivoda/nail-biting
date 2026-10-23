// npm run eval:detection
//
// Replays the landmark fixtures through the app's own detection engine, one rule at a time, and prints
// precision and recall per rule. Exits 1 if a rule marked 'validated' (src/detection/registry.ts) falls
// below its bar in thresholds.json. Experimental rules are reported, never gated.
//
//   --fixtures <dir>      default: scripts/eval-detection/fixtures (plus fixtures/real if present)
//   --thresholds <file>   default: scripts/eval-detection/thresholds.json
//   --report <file>       also write the markdown report there (docs/agents/ws1-eval-report.md)
//   --sensitivity <s>     gate on this one instead of thresholds.json's gateSensitivity (low|medium|high)
//   --json                print the results as JSON instead of the table
//
// SYNTHETIC fixtures measure a rule against scenes someone drew. They are a regression guard, not a claim
// about real-world accuracy.

import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFixtures } from './lib/fixtures.mjs';
import { SENSITIVITIES, evaluateAll, gate, loadThresholds } from './lib/evaluate.mjs';
import { renderReport, renderTable } from './lib/report.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
}

export function runEvaluation({ fixturesDir = join(HERE, 'fixtures'), thresholdsPath = join(HERE, 'thresholds.json'), gateOn = null } = {}) {
  const thresholds = loadThresholds(thresholdsPath);
  if (gateOn) thresholds.gateSensitivity = gateOn;
  const fixtures = loadFixtures(fixturesDir);
  const bySensitivity = Object.fromEntries(SENSITIVITIES.map(s => [s, evaluateAll(fixtures, thresholds, s)]));
  const verdict = gate(bySensitivity[thresholds.gateSensitivity], thresholds, thresholds.gateSensitivity);
  return { fixtures, thresholds, bySensitivity, verdict };
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
    console.log(JSON.stringify({ gate: result.verdict, bySensitivity: Object.fromEntries(Object.entries(result.bySensitivity).map(([k, v]) => [k, slim(v)])) }, null, 2));
  } else {
    console.log(renderTable(result));
  }

  const reportPath = arg('--report');
  if (reportPath) {
    writeFileSync(resolve(reportPath), renderReport(result));
    console.log(`\nWrote ${reportPath}`);
  }

  if (!result.verdict.ok) {
    console.error('\nFAILED: a validated rule fell below its bar in thresholds.json:');
    for (const f of result.verdict.failures) console.error(`  - ${f}`);
    process.exit(1);
  }
}
