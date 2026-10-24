// NEEDS NATIVE REVIEW. THE review marker of Brazilian Portuguese: one flag for the app text (locales/pt-BR/*.ts) AND the
// marketing pages (locales/pt-BR/marketing-*.ts). While it is false the language picker says the translation is a
// draft, and the localized marketing pages (/pt-br, /pt-br/pricing, ...) are served noindex, left out of the sitemap,
// and not named in any hreflang, even with the flag locale_pt_br on. Flip it to true only after a native speaker has
// read every file in this folder; docs/agents/ws12b-notes.md lists the steps. It lives in its own file so the
// marketing chunk can read it without pulling in the app's whole catalog; locales/pt-BR/index.ts re-exports it.
export const reviewed = false;
