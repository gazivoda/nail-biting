// NEEDS NATIVE REVIEW. THE review marker of Spanish: one flag for the app text (locales/es/*.ts) AND the marketing pages
// (locales/es/marketing-*.ts). While it is false the language picker says the translation is a draft, and the
// localized marketing pages (/es, /es/pricing, ...) are served noindex, left out of the sitemap, and not named in any
// hreflang, even with the flag locale_es on. Flip it to true only after a native speaker has read every file in
// this folder; docs/agents/ws12b-notes.md lists the steps. It lives in its own file so the marketing chunk can read
// it without pulling in the app's whole catalog; locales/es/index.ts re-exports it.
export const reviewed = false;
