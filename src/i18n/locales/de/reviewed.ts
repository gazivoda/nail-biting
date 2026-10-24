// NEEDS NATIVE REVIEW. THE review marker of German: one flag for the app text (locales/de/*.ts) AND the marketing pages
// (locales/de/marketing-*.ts). While it is false the language picker says the translation is a draft, and the
// localized marketing pages (/de, /de/pricing, ...) are served noindex, left out of the sitemap, and not named in any
// hreflang, even with the flag locale_de on. Flip it to true only after a native speaker has read every file in
// this folder; docs/agents/ws12b-notes.md lists the steps. It lives in its own file so the marketing chunk can read
// it without pulling in the app's whole catalog; locales/de/index.ts re-exports it.
export const reviewed = false;
