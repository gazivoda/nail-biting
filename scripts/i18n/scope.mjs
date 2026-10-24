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
  { pattern: 'src/pages/ComparePage.tsx', reason: 'Competitor and solutions pages; the copy lives in src/data/comparePages.ts (WS12b or never).' },
  { pattern: 'src/pages/BlogIndex.tsx', reason: 'Blog index: ~190 English articles are not translated (WS12 scope decision).' },
  { pattern: 'src/pages/BlogPost.tsx', reason: 'Blog article page: articles are English only (WS12 scope decision).' },
  { pattern: 'src/pages/CostCalculator.tsx', reason: 'Public calculator page (marketing); WS12b.' },
  { pattern: 'src/pages/NailGrowthCalculator.tsx', reason: 'Public calculator page (marketing); WS12b.' },
  { pattern: 'src/pages/PrintableTracker.tsx', reason: 'Printable marketing tool page; WS12b.' },
  { pattern: 'src/utils/costCalc.ts', reason: 'Calculator maths for the marketing calculator page.' },
  { pattern: 'src/utils/nailGrowth.ts', reason: 'Calculator maths for the marketing calculator page.' },
  // src/components/site/: the header, footer, closing call to action, trial button and language switcher ARE translated
  // (WS12b, scope marketing-chrome). What is left here is English on purpose:
  { pattern: 'src/components/site/BlogMidCta.tsx', reason: 'Call to action inside blog articles; the blog is English only.' },
  { pattern: 'src/components/site/ShareButton.tsx', reason: 'Share button of blog articles; the blog is English only.' },
  { pattern: 'src/components/site/Testimonials.tsx', reason: 'Real quotes, written in English by the people who gave them; not shown on localized pages (PricingPage, Landing hide it).' },
  { pattern: 'src/components/site/testimonialsModel.ts', reason: 'Validator and heading of the testimonial section (English quotes).' },
  { pattern: 'src/components/site/testimonialsData.ts', reason: 'Loader of the testimonial data file (English quotes).' },
  { pattern: 'src/components/site/plans.ts', reason: 'The four English plan lines are lookup keys shared with the in-app paywall (planFeature); the marketing pages show them through marketing-chrome plan.f1..f4, and a test pins that the two agree.' },
  { pattern: 'src/components/site/midCtaRules.ts', reason: 'Which blog posts get a call to action; blog is English only.' },
  { pattern: 'src/components/demo/', reason: 'The marketing live demo on the home page. WS12b.' },
  { pattern: 'src/components/blog/', reason: 'Blog helpers (tag pill).' },
  { pattern: 'src/components/ContactForm.tsx', reason: 'Used only on the marketing home page (WS12b).' },
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
  { pattern: 'src/i18n/scopes/', reason: 'The English catalogs: this is where the strings live.' },
  { pattern: 'src/i18n/testing/', reason: 'Test helpers for the pseudo-locale (they talk about English in their messages).' },
  { pattern: 'src/i18n/locales/', reason: 'The translations: this is where the strings live.' },
  { pattern: 'src/features/registry.ts', reason: 'Owner documentation of each flag (description, what to do before turning it on). Never rendered; nothing reads FEATURES[...] in the UI.' },
  { pattern: 'src/desktop/trayModel.ts', reason: 'Menu of the Electron tray, built in the main process, which has no renderer locale. Follow-up for the desktop app (WS7b owner).' },
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
