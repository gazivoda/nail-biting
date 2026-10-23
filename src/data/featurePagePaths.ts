// Which pages describe a feature that ships behind a flag, and which flag.
//
// A path list and nothing else (no copy, no React), so the build scripts and the
// tests can read it cheaply. The browser bundle does NOT import it: a feature page
// is rendered from JSON the server resolves (see FeaturePageView in
// src/pages/ComparePage.tsx), so a page's address and flag never ride in the app's
// JavaScript while the flag is off. The server reads the same map out of
// dist/seo-gated.json, because the runtime image carries no src/.
//
// While a page's flag is off: the server answers the branded 404 for the URL and for
// its data file, the page is absent from sitemap.xml, llms.txt, llms-full.txt, the
// noscript site navigation and the per-page social card, and its copy sits in
// dist/seo-gated.json, which the server reads and never serves. Turning the flag on
// is `FEATURE_FLAGS=<name>` plus a restart (docs/agents/ARCHITECTURE.md, section 5).
//
// The copy lives in src/data/featurePages.ts. What must happen before each flag goes
// on is in docs/agents/ws11b-notes.md.
//
// Never add a path that is in the sitemap today: gating is not a way to hide a
// published page.

export const FEATURE_PAGE_FLAGS = {
  '/features/habit-reversal-coaching': 'hrt_coaching',
  '/features/phone-companion': 'phone_companion',
  '/features/share-with-therapist': 'share_links',
  '/features/referral-program': 'referrals',
  // Keep this flag OFF until desktop sign-in works against the hosted API and the
  // macOS build is signed: docs/agents/ws11b-notes.md, top of the file.
  '/features/desktop-app': 'desktop_app',
  '/solutions/cuticle-biting': 'detection_behaviors',
} as const;

export type FeaturePagePath = keyof typeof FEATURE_PAGE_FLAGS;

export const FEATURE_PAGE_PATHS = Object.keys(FEATURE_PAGE_FLAGS) as FeaturePagePath[];

export function isFeaturePagePath(path: string): path is FeaturePagePath {
  return Object.prototype.hasOwnProperty.call(FEATURE_PAGE_FLAGS, path);
}
