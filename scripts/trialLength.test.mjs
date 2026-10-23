// WS9: the trial length lives in ONE place (shared/plans.js, TRIAL_DAYS, default 3, overridable by the
// environment). This file keeps it there.
//
//   1. GUARD: no source file may spell the trial length as a literal ("3-day", "3 days", "three days") unless
//      the occurrence is in ALLOWED below (a competitor's own trial, a sentence about both products, legal text
//      nobody may edit here, or an unrelated duration). A stale allowlist entry fails too, so the list cannot rot.
//   2. CONSISTENCY: the page content built with TRIAL_DAYS=7 differs from the default build ONLY in trial-length
//      words (3 -> 7, three -> seven), and in plenty of places.
//   3. THE SHELL: index.html spells it with {{TRIAL_*}} placeholders and still parses as JSON-LD at any length.

import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_TRIAL_DAYS, fillTrialTokens, trialCopy } from '../shared/plans.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ─── 1. The guard ────────────────────────────────────────────────────────────

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const DEFAULT_FORMS = [String(DEFAULT_TRIAL_DAYS), WORDS[DEFAULT_TRIAL_DAYS] ?? String(DEFAULT_TRIAL_DAYS)].join('|');
// "3-day", "3 days", "three days" (the shipped length), and any "N-day trial" / "N-day free trial".
const DEFAULT_LITERAL = `\\b(?:${DEFAULT_FORMS})[- ]days?\\b`;
const LITERAL = new RegExp(`${DEFAULT_LITERAL}|\\b\\d+-day (?:free )?trial\\b`, 'gi');

/**
 * Each entry allows ONE kind of occurrence: the line must contain `text`, and the match must sit inside it.
 * kind: competitor = a rival's own trial or a quotation of it
 *       shared     = a sentence about both products ("each with", "Both offer"): true only while ours is also
 *                    this long, NEEDS REWRITE IF TRIAL_DAYS CHANGES (listed in docs/agents/ws9-notes.md)
 *       legal      = legal text this workstream may not edit; the owner updates it with the constant
 *       generic    = not about our trial at all
 */
const ALLOWED = [
  // The legal pages and their server-rendered mirror. NEEDS HUMAN REVIEW when TRIAL_DAYS changes.
  { file: 'src/pages/TermsPage.tsx', text: 'receive a 3-day free trial', kind: 'legal' },
  { file: 'src/pages/RefundPage.tsx', text: 'receive a 3-day free trial', kind: 'legal' },
  { file: 'server.js', text: 'All new users get a 3-day free trial with no credit card required.', kind: 'legal' },

  // Sentences about both products.
  { file: 'server.js', text: 'privacy, 3-day trials.', kind: 'shared' },
  { file: 'src/data/comparePages.ts', text: 'each with a 3-day free trial', kind: 'shared' },
  { file: 'src/data/comparePages.ts', text: 'with a 3-day free trial. Neither records', kind: 'shared' },
  { file: 'src/data/comparePages.ts', text: 'Both offer a 3-day free trial', kind: 'shared' },

  // Hands Off's own trial (source: https://handsoffapp.com/, see the NEEDS HUMAN VERIFICATION table in ws11a-notes.md).
  { file: 'server.js', text: 'after 3 days free.', kind: 'competitor' },
  { file: 'src/data/comparePages.ts', text: '"3 days free,', kind: 'competitor' },
  { file: 'src/data/comparePages.ts', text: '<td>3 days</td>', kind: 'competitor' },
  { file: 'src/data/comparePages.ts', text: 'Hands Off: €2.99/month with a 3-day free trial', kind: 'competitor' },
  { file: 'src/data/comparePages.ts', text: '€2.99/month with a 3-day trial', kind: 'competitor' },
  { file: 'src/data/competitorPages.ts', text: '"3 days free, then €2.99 monthly."', kind: 'competitor' },
  { file: 'src/data/competitorPages.ts', text: 'monthly plan after 3 days free', kind: 'competitor' },
  { file: 'src/data/competitorPages.ts', text: '“3 days free, then €2.99 monthly.”', kind: 'competitor' },
  { file: 'src/data/competitorPages.ts', text: '“3 days free”', kind: 'competitor' },
  { file: 'src/data/competitorPages.ts', text: 'offers 3 days free', kind: 'competitor' },
  { file: 'src/data/blogPosts.ts', text: 'costs €2.99/month with a 3-day trial', kind: 'competitor' },
  // HabitCam's own 7-day trial (https://habitcam.com/, read 13 Oct 2026; see ws11a notes).
  { file: 'src/data/blogPosts.ts', text: '7-day trial (13 Oct 2026)', kind: 'competitor' },
  { file: 'src/data/comparePages.ts', text: '7-day free trial, no credit card; lifetime license', kind: 'competitor' },
  { file: 'src/data/comparePages.ts', text: 'with a 7-day trial. Stop Biting is a web app', kind: 'competitor' },
  { file: 'src/data/comparePages.ts', text: 'a 7-day free trial with no credit card. Launch prices', kind: 'competitor' },

  // Not about our trial.
  { file: 'src/data/blogPosts.ts', text: 'bit more than three days a week', kind: 'generic' },
  { file: 'src/utils/trial.test.ts', text: "'3 days left'", kind: 'generic' },
  { file: 'scripts/sync-seo.mjs', text: '"3-day trial" carry its unit', kind: 'generic' },
  { file: 'scripts/sync-seo.mjs', text: 'the way "3 days" does', kind: 'generic' },
];

// The file that defines the constant, its tests and this guard say the numbers on purpose.
const SELF = new Set(['shared/plans.js', 'shared/plans.test.js', 'scripts/trialLength.test.mjs', 'scripts/trialLengthDump.mjs']);
const SCAN_DIRS = ['src', 'server', 'shared', 'scripts'];
const SCAN_ROOT_FILES = /^(?:[\w.-]+\.(?:js|mjs|ts|html))$/;
const SCAN_EXT = /\.(?:ts|tsx|js|mjs|html)$/;

/** Is the match at [index, index+length) inside an occurrence of one of the allowed texts? */
function insideAllowed(str, index, length, entries) {
  return entries.some(a => {
    for (let at = str.indexOf(a.text); at >= 0; at = str.indexOf(a.text, at + 1)) {
      if (index >= at && index + length <= at + a.text.length) return true;
    }
    return false;
  });
}

function files() {
  const out = [];
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === 'dist') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (SCAN_EXT.test(name)) out.push(relative(ROOT, p));
    }
  };
  for (const d of SCAN_DIRS) walk(join(ROOT, d));
  for (const name of readdirSync(ROOT)) if (SCAN_ROOT_FILES.test(name) && statSync(join(ROOT, name)).isFile()) out.push(name);
  return out.filter(f => !SELF.has(f)).sort();
}

describe('the trial length is spelled in one place', () => {
  const found = []; // { file, line, text, match }
  const used = new Set();
  for (const file of files()) {
    const lines = readFileSync(join(ROOT, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(LITERAL)) {
        const entry = ALLOWED.findIndex(a => a.file === file && insideAllowed(line, m.index, m[0].length, [a]));
        if (entry >= 0) used.add(entry);
        else found.push(`${file}:${i + 1}: ${line.trim().slice(Math.max(0, m.index - 30), m.index + 50)}`);
      }
    });
  }

  it('has no literal trial length outside the allowlist', () => {
    expect(found, `Spell our trial with the tokens from shared/plans.js (\${TRIAL_HYPHEN}, {{TRIAL_HYPHEN}} in index.html). Competitor facts go in ALLOWED.\n${found.join('\n')}`).toEqual([]);
  });

  it('has no stale allowlist entries', () => {
    const stale = ALLOWED.filter((_, i) => !used.has(i)).map(a => `${a.file}: ${a.text}`);
    expect(stale, 'These ALLOWED entries match nothing any more; delete them').toEqual([]);
  });

  it('the scan really covers the places the copy lives', () => {
    const list = files();
    for (const f of ['server.js', 'index.html', 'src/pages/Landing.tsx', 'src/data/comparePages.ts', 'src/data/blogPosts.ts', 'server/auth/accounts.js', 'trialFollowup.js', 'email.js', 'src/utils/trial.ts']) {
      expect(list, f).toContain(f);
    }
  });
});

// ─── 2. Seven days changes the trial words and nothing else ──────────────────

function dump(trialDays) {
  const env = { PATH: process.env.PATH };
  if (trialDays !== undefined) env.TRIAL_DAYS = String(trialDays);
  const res = spawnSync(process.execPath, [join(ROOT, 'scripts/trialLengthDump.mjs')], { cwd: ROOT, encoding: 'utf8', env, maxBuffer: 256 * 1024 * 1024 });
  expect(res.status, res.stderr).toBe(0);
  return JSON.parse(res.stdout);
}

describe('TRIAL_DAYS=7', () => {
  const three = dump();
  const seven = dump(7);

  it('builds the same set of strings', () => {
    expect(Object.keys(seven)).toEqual(Object.keys(three));
  });

  it('changes only trial-length words (3 to 7, three to seven), and in many places', () => {
    const SPLIT = /(\b(?:3|7|three|seven|Three|Seven)\b)/;
    const SWAP = { 3: '7', three: 'seven', Three: 'Seven' };
    let changed = 0;
    for (const [path, a] of Object.entries(three)) {
      const b = seven[path];
      if (a === b) continue;
      changed++;
      const pa = a.split(SPLIT), pb = b.split(SPLIT);
      expect(pb.length, path).toBe(pa.length);
      pa.forEach((piece, i) => {
        if (i % 2 === 0) expect(pb[i], `${path}: text between numbers`).toBe(piece);   // prose is untouched
        else expect([piece, SWAP[piece]], `${path}: ${piece} -> ${pb[i]}`).toContain(pb[i]); // same number, or its 7 spelling
      });
    }
    expect(changed).toBeGreaterThanOrEqual(50);
  });

  it('every leftover "3-day"/"3 days" at 7 is an allowlisted rival fact or shared sentence', () => {
    // Text the allowlist covers can keep saying 3; nothing else may.
    for (const [path, b] of Object.entries(seven)) {
      for (const m of b.matchAll(new RegExp(DEFAULT_LITERAL, 'gi'))) {
        expect(insideAllowed(b, m.index, m[0].length, ALLOWED), `${path}: …${b.slice(Math.max(0, m.index - 80), m.index + 80)}…`).toBe(true);
      }
    }
  });
});

// ─── 3. The shell ────────────────────────────────────────────────────────────

describe('index.html', () => {
  const source = readFileSync(join(ROOT, 'index.html'), 'utf8');

  it('spells the trial with placeholders, in the description, the Offer and the FAQ', () => {
    expect(source).toContain('{{TRIAL_HYPHEN}} free trial');
    expect(source).toContain('"value": {{TRIAL_DAYS}}');
  });

  it.each([3, 7, 14])('has valid JSON-LD blocks and no placeholder left over at %i days', days => {
    const filled = fillTrialTokens(source, trialCopy(days));
    expect(filled).not.toMatch(/\{\{TRIAL_/);
    const blocks = [...filled.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) expect(() => JSON.parse(b[1])).not.toThrow();
    const offer = blocks.map(b => JSON.parse(b[1])).flatMap(j => j.offers ?? []).find(o => o.eligibleDuration);
    expect(offer.eligibleDuration.value).toBe(days);
    expect(offer.description).toContain(`${days}-day free trial`);
  });
});
