// What the "no hardcoded English" rule covers.
//
// DEFAULT IS IN. Every file under src/ is in scope, so a new screen is checked
// from its first commit. A file or folder is exempt only if it is listed below
// with a reason. Adding to this list is a decision: say why, and name where the
// text WILL be dealt with (or why it never will be).
//
// Used by eslint.config.js (the `local-i18n` rules) and by the coverage tests
// (src/i18n/*.test.tsx). Plain ESM so ESLint can load it without a TS step.
//
// A pattern is a repo-relative path. A trailing "/" or "/**" matches a folder
// and everything under it; anything else matches that exact file.

export const EXCLUDED = [
  // ── Marketing pages: WS12b (localised routes /es/..., hreflang, SSR) ──────
  { pattern: 'src/pages/Landing.tsx', reason: 'Marketing home page. WS12b: needs localised routes and server-rendered meta, not just a catalog.' },
  { pattern: 'src/pages/HowItWorks.tsx', reason: 'Marketing page (WS12b).' },
  { pattern: 'src/pages/About.tsx', reason: 'Marketing page (WS12b).' },
  { pattern: 'src/pages/PricingPage.tsx', reason: 'Marketing pricing page (WS12b). The app-side paywall IS translated.' },
  { pattern: 'src/pages/ComparePage.tsx', reason: 'Competitor and solutions pages; the copy lives in src/data/comparePages.ts (WS12b or never).' },
  { pattern: 'src/pages/BlogIndex.tsx', reason: 'Blog index: ~190 English articles are not translated (WS12 scope decision).' },
  { pattern: 'src/pages/BlogPost.tsx', reason: 'Blog article page: articles are English only (WS12 scope decision).' },
  { pattern: 'src/pages/CostCalculator.tsx', reason: 'Public calculator page (marketing); WS12b.' },
  { pattern: 'src/pages/NailGrowthCalculator.tsx', reason: 'Public calculator page (marketing); WS12b.' },
  { pattern: 'src/pages/PrintableTracker.tsx', reason: 'Printable marketing tool page; WS12b.' },
  { pattern: 'src/utils/costCalc.ts', reason: 'Calculator maths for the marketing calculator page.' },
  { pattern: 'src/utils/nailGrowth.ts', reason: 'Calculator maths for the marketing calculator page.' },
  { pattern: 'src/components/site/', reason: 'Marketing site chrome (header, footer, CTAs, testimonials). WS12b.' },
  { pattern: 'src/components/demo/', reason: 'The marketing live demo on the home page. WS12b.' },
  { pattern: 'src/components/blog/', reason: 'Blog helpers (tag pill).' },
  { pattern: 'src/components/ContactForm.tsx', reason: 'Used only on the marketing home page (WS12b).' },
  { pattern: 'src/components/PricingSection.tsx', reason: 'Marketing pricing block (home page and /pricing). WS12b.' },
  { pattern: 'src/components/PromoVideo.tsx', reason: 'Marketing promo video block on the home page.' },
  { pattern: 'src/hooks/useScrollReveal.ts', reason: 'Marketing scroll animation; no text.' },
  { pattern: 'src/data/', reason: 'Content files: blog posts, compare pages, program lessons (28 coaching lessons), testimonials. Not translated (WS12 scope decision).' },

  // ── Legal text: never machine translated ──────────────────────────────────
  { pattern: 'src/pages/LegalPage.tsx', reason: 'Legal page chrome. Legal text is not machine translated; needs a lawyer plus a translator.' },
  { pattern: 'src/pages/TermsPage.tsx', reason: 'Legal text. Not machine translated.' },
  { pattern: 'src/pages/PrivacyPage.tsx', reason: 'Legal text. Not machine translated.' },
  { pattern: 'src/pages/RefundPage.tsx', reason: 'Legal text. Not machine translated.' },
  { pattern: 'src/pages/EditorialPolicyPage.tsx', reason: 'Editorial policy text: published statement, not app UI.' },

  // ── Never user facing ─────────────────────────────────────────────────────
  { pattern: 'src/dev/', reason: 'Development-only fixtures (stripped from production builds).' },
  { pattern: 'src/storage/fixtures/', reason: 'Test fixtures of persisted state.' },
  { pattern: 'src/detection/__reference__/', reason: 'Verbatim copy of the pre-WS1 detector, used by the equivalence test.' },
  { pattern: 'src/detection/synthetic.ts', reason: 'Synthetic landmark fixtures for tests and the eval harness.' },
  { pattern: 'src/i18n/messages/', reason: 'The catalogs themselves are where the strings live.' },
  { pattern: 'src/i18n/pseudo.ts', reason: 'Builds the test pseudo-locale.' },
];

const norm = p => p.replace(/\\/g, '/').replace(/^\.\//, '');

/** True when the repo-relative path is exempt. Test files are always exempt. */
export function isExcluded(relPath) {
  const p = norm(relPath);
  if (/\.test\.(ts|tsx|mjs|js)$/.test(p) || p.includes('/__tests__/')) return true;
  return EXCLUDED.some(({ pattern }) => {
    const base = pattern.replace(/\/\*\*$/, '/');
    return base.endsWith('/') ? p.startsWith(base) : p === base;
  });
}

/** True for a repo-relative path the rule must check. */
export function isInScope(relPath) {
  const p = norm(relPath);
  return /^src\/.*\.(ts|tsx)$/.test(p) && !p.endsWith('.d.ts') && !isExcluded(p);
}
