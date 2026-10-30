// A copy rule (shared/flagCopy.js) only does anything while the text it replaces is still in the source. If
// someone rewords a sentence, the rule would silently stop working and the site would keep saying the old
// thing with the flag on. This test fails then, naming the rule.
//
// It also pins the other half of the promise: the source files hold the text that is true with every flag
// off, so a rule's replacement never appears in a source.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../shared/flagCopy.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = file => readFileSync(join(ROOT, file), 'utf8')
  .replace(/\\'/g, '\'')           // a sentence written as 'it doesn\'t' in a single-quoted literal
  .replace(/\\n/g, '\n');

// rule id -> the files that carry its text
const SOURCES = {
  'faq-alert-log': ['src/i18n/scopes/marketing-home.ts', 'index.html'],
  'home-history-line': ['src/i18n/scopes/marketing-home.ts', 'server.js'],
  'home-history-privacy': ['src/i18n/scopes/marketing-home.ts'],
  'network-use': ['src/i18n/scopes/marketing-home.ts', 'src/i18n/scopes/marketing-how.ts', 'server.js'],
  'about-log': ['src/i18n/scopes/marketing-about.ts', 'server.js'],
  'settings-privacy-log': ['src/i18n/scopes/settings.ts'], // WS12a: the Settings text lives in the catalog now
  'how-log-row': ['src/i18n/scopes/marketing-how.ts'],
  'how-log-item': ['server.js'],
  'blog-log-not-synced': ['src/data/blogPosts.ts'],
  'blog-log-no-cloud': ['src/data/blogPosts.ts'],
  'faq-google-account': ['src/i18n/scopes/marketing-home.ts', 'index.html'],
  'home-sign-in': ['src/i18n/scopes/marketing-home.ts', 'server.js'],
  'nailbitemenu-needs': ['src/data/comparePages.ts'],
  'nailbitemenu-requires': ['src/data/comparePages.ts'],
  'nailbitemenu-table': ['src/data/comparePages.ts'],
  'faq-phone': ['src/i18n/scopes/marketing-home.ts', 'index.html'],
  // lifetime_plan: the pricing questions (the catalog and the server's PRICING_FAQS) and two homepage answers
  'pricing-faq-pick-plan': ['src/i18n/scopes/marketing-pricing.ts', 'server.js'],
  'pricing-faq-difference-q': ['src/i18n/scopes/marketing-pricing.ts', 'server.js'],
  'pricing-faq-difference': ['src/i18n/scopes/marketing-pricing.ts', 'server.js'],
  'home-faq-cost': ['src/i18n/scopes/marketing-home.ts', 'index.html'],
  'home-faq-cancel': ['src/i18n/scopes/marketing-home.ts', 'index.html'],
  // lifetime_plan: the pages that quote Stop Biting's price (compare and solutions pages, two posts) and the offer at their foot
  'compare-hands-off-annual': ['src/data/comparePages.ts'],
  'compare-hands-off-cost': ['src/data/comparePages.ts'],
  'compare-ai-apps-cost': ['src/data/comparePages.ts'],
  'compare-nailed-cost': ['src/data/comparePages.ts'],
  'compare-habitaware-plans': ['src/data/comparePages.ts'],
  'compare-pavlok-try': ['src/data/comparePages.ts'],
  'compare-nailed-is-subscription': ['src/data/comparePages.ts'],
  'compare-nailed-buys': ['src/data/comparePages.ts'],
  'compare-nailed-pays': ['src/data/comparePages.ts'],
  'compare-nailed-heading': ['src/data/comparePages.ts'],
  'compare-habitcam-pick': ['src/data/comparePages.ts'],
  'compare-habitcam-limit': ['src/data/comparePages.ts'],
  'compare-nailbitemenu-limit': ['src/data/comparePages.ts'],
  'compare-biteless-both': ['src/data/comparePages.ts'],
  'how-it-works-pricing-link': ['server.js'],
  'compare-cta-price': ['src/pages/ComparePage.tsx'],
  'price-list-short': ['src/data/comparePages.ts', 'src/data/blogPosts.ts'],
  'price-list': ['src/data/comparePages.ts', 'src/data/blogPosts.ts'],
};

describe('copy rules and the sources they replace text in', () => {
  it('every rule has its sources listed, and every listed rule exists', () => {
    expect(Object.keys(SOURCES).sort()).toEqual(RULES.map(r => r.id).sort());
  });

  it.each(RULES.map(r => [r.id, r]))('%s: its text is in every source that is supposed to carry it', (id, rule) => {
    for (const file of SOURCES[id]) {
      expect(read(file).includes(rule.off), `${file} should contain the text of rule ${id}`).toBe(true);
    }
  });

  it('no source already says what a rule would put in its place', () => {
    for (const rule of RULES) {
      const replacements = [
        () => false,
        name => rule.flags.includes(name),
        () => true,
      ].map(isOn => rule.on(isOn)).filter(Boolean);
      for (const file of SOURCES[rule.id]) {
        for (const text of replacements) expect(read(file).includes(text), `${file} / ${rule.id}`).toBe(false);
      }
    }
  });
});
