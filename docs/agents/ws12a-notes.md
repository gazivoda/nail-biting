# WS12a: localization of the signed-in app (es, de, pt-BR), behind `locale_es`, `locale_de`, `locale_pt_br`

Status: built, all three flags OFF. With all three off the app is English only and (checked) byte-identical to `main`.
Everything below names the file so you can check it. WS12b (marketing pages) builds on this: see the last section.

## What a person sees

- Settings > Account & Sync gets a **Language** card, only while at least one locale flag is on. It lists English and
  the languages whose flag is on, each written in its own language (English, Español, Deutsch, Português (Brasil)).
- The pick is stored on this device (`kv('i18n', 'locale')`). **The browser language is never read.** A language is used only
  when the person picked it AND its flag is on.
- The text of every signed-in screen changes, `<html lang>` follows, and dates, times, numbers and money are written the way that
  language writes them. Server-rendered pages (share page, unsubscribe pages, the weekly email itself, the marketing site, the blog)
  stay English.
- While a language's `reviewed` marker is `false` (all three today) the card says, in that language, that the translation is a
  machine draft that no native speaker has checked.

## Architecture (src/i18n)

| File | What |
|---|---|
| `message.ts` | The message format (pure TS): `{name}`, `{n, number}`, `{n, plural, =0 {..} one {# ..} other {# ..}}` (Intl.PluralRules of the active language), `{x, select, a {..} other {..}}`, rich tags `<link>..</link>`. A subset of ICU MessageFormat without ICU's apostrophe quoting. A missing parameter stays visible as `{name}`. |
| `core.ts` | Locale state (no React): the pick (kv), the allowed set (flags), the catalogs (lazy `import()` of `locale-xx.ts`), `<html lang>`, subscribe/version. Reads no feature flag itself. |
| `hooks.ts` | `useLocale()`, `useLocaleVersion()`. |
| `scope.ts` | `createScope(name, englishMessages)` -> `{ t, useT }`; keys are typed; per-key fallback to English. |
| `scopes/<name>.ts` | The English text of one area (the source of truth and the type of the keys), plus its `t`/`useT`. Imported by the code of that area, so the English strings land in the same lazy chunk as before. `scopes/index.ts` lists them all (tests only). |
| `locales/<es,de,pt-BR>/<scope>.ts` | The translation of one scope: `Record<keyof typeof english, string>`, so a missing key does not compile. `locales/<x>/index.ts` collects them and holds `reviewed`. |
| `locale-es.ts`, `locale-de.ts`, `locale-pt-BR.ts` | The entry of each lazy chunk (`assets/locale-*.js`). Kept out of the service worker precache (`vite.config.ts` `globIgnores`), so an English visitor's browser never downloads them. |
| `format.ts` | `formatNumber/Percent/Currency/Date/Time/DateTime/DatePattern/RelativeTime/Distance/List`, `weekdayName`. Intl based. While English shows they do exactly what the old code did (browser formats, date-fns patterns), so nothing changes for English. |
| `LocaleHost.tsx` | The only link between the language and the flags. Mounted in `App.tsx` (signed-in app and paywall), `SignIn.tsx`, `RedeemPage.tsx`. With nothing picked it returns null at once: no flag read, no request, no download. |
| `testing/` | Test-only: `pseudo.ts` (German catalog + every `t()` result wrapped in `⟦ ⟧`), `scan.ts` (finds English outside the marks). |
| `coverage/*.coverage.test.tsx` | One per area: renders the screens under the pseudo-locale and fails on any English that did not come through `t()`. |
| `catalogs.test.ts` | Parity: same keys, same placeholders, valid plural forms per language, no empty strings, review header. |

Scopes: `common` (shared words, trigger-tag labels, behavior labels), `shell`, `alarm` (tiny: OS notification, imported by `useDetection`),
`watch`, `background`, `calibration`, `history`, `insights`, `photos`, `settings`, `data`, `sharing`, `billing`, `auth`, `coaching`, `phone`, `language`.

Other seams: `App.tsx` `AppRouter` calls `useLocaleVersion()` so a language change re-renders the whole signed-in tree below it
(state is kept; nothing remounts), and renders `<LocaleHost />`. `LanguageSettings.tsx` is mounted with one line in
`sections/AccountSyncSection.tsx`; `pages/settings/meta.ts` lists the three locale flags for the `account-sync` section so the section
opens when any of them is on.

## How to add a string

1. Add the key and the English text to the area's `src/i18n/scopes/<scope>.ts`.
2. Add the same key to `locales/es|de|pt-BR/<scope>.ts` (the compiler lists what is missing).
3. In a component: `const t = useT();` then `t('key', { count })`. Outside React: `import { t }` and call it when needed, never at module level.
4. A table of labels: a function, or an object with `get label() { return t('x') }`, or a typed key table. Stored ids are never translated.
5. `npx eslint <file>` must show no `local-i18n` finding; `npx vitest run src/i18n scripts/i18n` for the rest.

## How to add a locale

1. Add the code to `LOCALES` and `LOCALE_INFO` (native name, BCP 47 tag, flag name) in `core.ts`, the loader in `LOADERS`, and `locale-xx.ts`.
2. Copy `locales/de/` to `locales/<xx>/`, translate, set the header `NEEDS NATIVE REVIEW` and `reviewed = false`.
3. Register the flag in `src/features/registry.ts` and `server/features.js` (+ `.env.example`), add it to the `account-sync` flags in `settings/meta.ts`.
4. Add the locale to `catalogs.test.ts` and `vite.config.ts` needs nothing (the `locale-*` pattern covers it).

## Turning a language on (owner)

1. A native speaker reads `src/i18n/locales/<locale>/*.ts` (the terms are in the glossary below), fixes the wording in those files, and the change goes through the normal deploy.
2. Set `reviewed` to `true` in `src/i18n/locales/<locale>/index.ts` (then the "machine draft" note disappears). `catalogs.test.ts` pins `reviewed === false`; flip that expectation in the same change.
3. In Coolify set `FEATURE_FLAGS=...,locale_es` (or `locale_de`, `locale_pt_br`) and restart. No rebuild. Check `GET /api/features`.
4. Settings > Account & Sync > Language now offers it. Turning the flag off again returns everyone to English at their next flag refresh; their pick is kept for when it comes back.

## Not translated (on purpose)

See `scripts/i18n/scope.mjs` (each exemption has a reason; the lint rule and the tests read the same list):
Landing, How it works, About, Pricing page, Compare and Solutions pages, Blog (index and ~190 posts), calculators, printable tracker, `src/components/site/**`,
`src/components/demo/**` (marketing demo), `src/data/**` (blog, compare pages, the 28 coaching lessons, testimonials), legal pages (never machine translated),
`src/features/registry.ts` (owner documentation), `src/desktop/trayModel.ts` (the Electron tray menu is built in the main process, which has no renderer language: follow-up for the desktop app).
Also English: every server-rendered page and email (`server/share/page.js`, the weekly email, unsubscribe pages, the OAuth error redirect text), the OS-level text of the PWA manifest and the app badge,
and anything a person typed (custom tags).

## Enforcement

- `local-i18n/no-hardcoded-text` and `local-i18n/no-english-literals` (ESLint, `scripts/i18n/no-hardcoded-text.mjs`, wired in `eslint.config.js`): errors on JSX text, text attributes (`aria-label`, `title`, `placeholder`, `alt`, `label`, `description`, ...), string children, and sentence-like literals anywhere in an in-scope file. Default is IN: a file is exempt only if `scripts/i18n/scope.mjs` lists it with a reason. A deliberate exception takes `// i18n-ignore: <reason>`. Rule tests: `scripts/i18n/no-hardcoded-text.test.mjs`.
- `scripts/i18n/guard.test.mjs` runs the real ESLint config over the app in `npm test` (lint has unrelated pre-existing errors) and fails on any finding.
- Pseudo-locale coverage: `src/i18n/coverage/*.coverage.test.tsx` + `scripts/i18n/inventory.test.mjs` (every file that uses `t()` is rendered by a coverage test or carries a `NOT-RENDERED` line with a reason).
- Catalog parity: `src/i18n/catalogs.test.ts`.

## For WS12b (marketing pages)

RESULTS_PLACEHOLDER
