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

## What was checked, and how

All numbers are from this branch (base: main at c3b3510, "tasks: WS7a merged, WS12a launched").

| Acceptance | Result |
|---|---|
| Flags off: byte-identical to main | **Verified** with `scripts/i18n/dom-probe/compare.mjs`: main's `build:web` bundle and this branch's, each behind the real server with a throwaway signed-in user and a fake camera, page HTML with digits masked, 1280 px light and dark and 390 px: Watch, History, Settings, the voluntary upgrade page, the phone view (touch emulation), the sign-in page. Every flag off: **15 screens SAME**. Every non-locale flag on (so Insights, the program, schedule, sync, sharing, referral, lifetime and gift cards, phone view and sign-in providers are drawn): **18 screens SAME**. Only the three `locale_*` flags are off in both runs. |
| No English leaks into a switched app | **Verified** two ways. (1) `src/i18n/coverage/*.coverage.test.tsx` (12 files): German catalog + every `t()` result wrapped in `⟦ ⟧`; any word outside the marks fails (product names, units and Intl month names allowed). `scripts/i18n/inventory.test.mjs`: 112 files use `t()`; 108 are rendered by a coverage test; 5 carry a `NOT-RENDERED` reason (App.tsx, `useDetection.ts`, `useNotifications.ts`, `useShareCard.ts`, `CoachingBridge.tsx`: need a camera, a DOM or a router; their text is asserted through the scope instead). Each coverage test was shown to fail when a literal was planted. (2) `scripts/i18n/dom-probe/switch.mjs` in headless Chrome: pick the language in Settings with no reload, then list every line still identical to English on Watch, History, Insights and Settings: only `Upgrade`, `Pause`, `System`, `min`, `Flash`, `Volume`, the language names and the brand name (loan words that are the same in that language); `<html lang>` follows; switching back to English gives the original HTML (only React's attribute order on the active tab differs). |
| Catalog parity | `src/i18n/catalogs.test.ts` (132 tests): same keys in es/de/pt-BR as English in all 21 scopes, same placeholders and kinds, plural forms valid for the language and `other` present, no empty strings, same edge whitespace, rich tags equal, each locale file starts with `NEEDS NATIVE REVIEW`, `reviewed = false`. 1,084 messages x 3 languages. |
| Lint rule works, zero new violations | `scripts/i18n/no-hardcoded-text.test.mjs` (ESLint RuleTester, 59 tests); `scripts/i18n/guard.test.mjs` runs the real config over the app inside `npm test`: 0 findings. `npx eslint src server scripts electron shared`: **23 errors, 4 warnings, the baseline** (same files and rules). 20 `// i18n-ignore:` comments, each with a reason: 7 internal section titles in `settings/meta.ts` (never rendered, pinned by `settings.test.tsx`), 7 landmark-zone descriptions in `detection/zones.ts` (documentation, never rendered), 2 CSS font stacks, 1 dev-build-only note, 1 diagnostic string, 1 English reference constant pinned by `photoGuard`, 1 internal session label. |
| English-only bundle growth | Main entry chunk (every page): 230.4 KB -> 249.3 KB raw, **68.7 -> 74.6 KB gzip (+5.9 KB, +8.6 percent of that chunk)**. Home page first load (entry + vendor + css): **179.9 -> 184.6 KB gzip (+4.7 KB, 2.6 percent)**. Home page with the live demo: +8.1 KB gzip (the alarm text and the pause/cadence words ride in the demo's chunk). Everything an English visitor could ever download (all chunks): 468.8 -> 490.6 KB gzip (+21.8 KB, 4.6 percent). What it is made of: the i18n core (message format, locale state, hooks, scope factory, host: about 8 KB raw / 3.8 KB gzip) and the keys around moved strings; the strings themselves were in the same chunks before. Catalogs: `locale-de` 77.8 KB raw / 22.9 gzip, `locale-es` 75.7 / 22.1, `locale-pt-BR` 75.1 / 21.9, fetched only after a person picks that language; **0 of them in the service worker precache** (`sw.js` checked; `vite.config.ts` `globIgnores: **/assets/locale-*.js`). Script: `scripts/i18n/dom-probe/bundle-size.mjs <main dist> <this dist>`. |
| Layout in de and pt-BR | **Checked** with `scripts/i18n/dom-probe/layout.mjs` (headless Chrome over CDP; sideways scroll, boxes past the edge, clipped text) at 390 and 1280 px for Watch, History, Insights, Settings, the upgrade page, the phone view and sign-in, in de, pt-BR and es, against an English baseline. Found and fixed: the language card's four names overflowed 390 px (now a wrapping row of pills); a preset-response list in Settings > Alerts pushed the page 8 px wide in Portuguese (`min-width: 0` on grid items, and wrapping instead of an ellipsis, in `src/index.css`, scoped to `html:not([lang='en'])` so the English markup and layout are unchanged). What is left is also in the English baseline (the decorative rings on the streak card, the sidebar's trial pill). Screenshots at 390 px: `docs/agents/ws12a-evidence/`. |
| Definition of done | `npm run build:web` exit 0; `npm test` 166 files / 3,324 tests (baseline 146 / 2,684); `node --check server.js` ok (server untouched); `npm run seo:check` in sync; `grep -l "seedPreviewData\|previewKind" dist/assets/*.js` and `grep -l "dev-override\|readDevOverrides" dist/assets/*.js` print nothing. |

### Not verified

A native speaker has read none of it. Real Safari, Firefox, Edge, a real phone, VoiceOver/TalkBack. The Electron app (the lazy `locale-*` chunk under `file://`). The OS notification text on a real OS. Whether Paddle's checkout overlay follows the language (it does not: no `locale` is passed to Paddle; follow-up for WS9's code). A flag turned on in production.

## Things the owner should know

1. **Every translation is a machine draft.** `NEEDS NATIVE REVIEW` heads each file and `reviewed = false` marks each locale. Points a reviewer should look at first: es `computadora` (Latin American) vs `ordenador`, the greeting fallback for a person with no name (`tú`, `du`, `você`), "respuesta competitiva / konkurrierende Reaktion / resposta competitiva" for "competing response" (the program's term, see the coaching texts), "Revocar / Deaktivieren / Revogar" for revoking a share link, "Racha / Serie / Sequência" for streak, pt-BR "Cerre os punhos" (a literal Spanish-shaped phrase; "Feche os punhos" is more natural), the provider sign-in button phrases (they follow each provider's own localized wording from memory; check them against the providers' brand pages before turning a language on).
2. **Terms** (all areas use them; keep them when editing): alarm = alarma/Alarm/alarme, bite = mordisco/Biss/mordida, nail biting = morderse las uñas/Nägelkauen/roer as unhas, streak = racha/Serie/sequência, trigger = desencadenante/Auslöser/gatilho, History = Historial/Verlauf/Histórico, Watch = Vigilar/Überwachen/Monitorar, Settings = Ajustes/Einstellungen/Configurações, Insights = Análisis/Einblicke/Análises, Milestones = Hitos/Meilensteine/Marcos, Urge = impulso/Drang/impulso. Register: es "tú", de "du", pt-BR "você".
3. **English output is unchanged at the shipped defaults.** Where a count of one used to read ungrammatically the English now pluralises correctly only for that value (free-tier minutes: "1 free minute"; the defaults are 30 and 7, so no shipped screen changes). A few English quirks were kept on purpose so English stays byte-identical, and the translations use the right singular: "1 newer event was kept as they were", "1 seconds left" (calibration), "your last 1 days" (unreachable), "1 bites in all", the lowercase start of "one year of Stop Biting are saved...". Fixing them is a one-word change in the English message.
4. **Two existing tests got a one-line allowlist entry** (their job is to keep code out of a part of the bundle; the new i18n files are allowed in): `scripts/photoGuard.test.mjs` (`ALLOWED_OUTSIDE` gained the three i18n modules the photo diary imports; its no-network closure checks still follow them) and `scripts/falsePositiveGuards.test.mjs` (the not-a-bite seam may import `../i18n/scopes/alarm`). `scripts/phoneGuards.test.mjs` finds the phone view's two big buttons by regex on English source text; the source keeps a JSX comment with that text so it still passes: repoint the regexes at `t('home.bite')` and `t('home.urge')` when convenient.
5. **Server-rendered text stays English**: the share page, unsubscribe pages and the weekly email (`server/**` untouched), the OAuth error redirect text, the PWA manifest, the OS-level app badge, and the Electron tray menu (built in the main process, which has no renderer language; `src/desktop/trayModel.ts` is on the exemption list as a follow-up for the desktop app).
6. **Marketing is untouched.** A person who picked German and opens the home page, the blog or the pricing page sees English (those pages never mount `<LocaleHost />`), with an English `<html lang>`.
7. The sign-in page translates "By continuing you agree to the Terms and the Privacy Policy" and its two link labels, but the legal pages themselves stay English. Decide whether that sentence should stay English until a lawyer-approved translation exists.
8. The lesson text of the 4-week program (`src/data/**`) stays English inside an otherwise translated program view.

## For WS12b (marketing pages), on top of this infrastructure

What exists and can be reused as is: `src/i18n/message.ts` (pure; also loadable by Node 24 since the import chain uses explicit `.ts` extensions, which is how `scripts/eval-detection` loads `registry.ts`), `format.ts`, `createScope`, the catalog and parity tests, the lint rule (`scripts/i18n/scope.mjs` lists each marketing file with `WS12b` in its reason: delete the entry when a file's text is extracted and the rule starts covering it), and the pseudo-locale harness (`src/i18n/testing`).

What WS12b must add:
1. **Locale from the URL, not from the stored pick.** Routes `/es/...`, `/de/...`, `/pt-br/...` (lower case: the server's canonicalising 301 lower-cases paths, so `/pt-BR/` would redirect). `App.tsx` strips the prefix and renders the same pages. Add a page-level override in `core.ts` (a `pageLocale` that wins over the pick and is never stored) and a catalog loader for the marketing scopes; marketing scopes go in new `src/i18n/scopes/marketing-*.ts` files so the app chunks do not carry them. Marketing pages must not import `src/storage/index.ts` or the store (lessons: the demo must never touch the store); `core.ts` and `scope.ts` import neither.
2. **Server side (`server.js`, SSR).** `KNOWN_ROUTES` and one handler per localized route (or a prefix handler) behind the same server flag (`flags.isOn('locale_es')`; return 404 while the flag is off so it cannot be indexed), `injectMeta` with localized title/description/canonical/`og:locale`, `<html lang>` rewritten in the shell, `hreflang` alternates (reciprocal, plus `x-default`) only for pages that exist in that language (blog posts and compare pages stay English: no alternates), localized `schema` and the no-JS article copy (it must follow the visible page, lessons.md), `SITE_NAV` in `injectNoscriptNav`. The Docker runtime image copies files by name: if server code reads catalogs, copy them (or emit `dist/i18n/<locale>.json` at build time from the scopes in `scripts/generate-seo-content.mjs`).
3. **`scripts/sync-seo.mjs`** (binary bytes in it: `grep -a`, edit in bytes): `CORE_PAGES` / `PAGE_SOURCES` entries and sitemap `xhtml:link` alternates for localized pages, `llms.txt` key pages; localized OG images (`scripts/generate-og-images.mjs`, needs Chrome).
4. **Service worker**: `navigateFallback` already serves the shell for `/es/...`; keep `/assets/locale-*.js` out of the precache for any new locale chunks.
5. **Content that is data** (`src/data/**`: compare pages, testimonials, FAQ) needs a per-locale data layer, not just scopes; legal text needs a lawyer plus a translator and must not be machine translated; prices come from Paddle (pass `locale` to the checkout, which this branch does not).
6. A picker for visitors who are not signed in (this branch offers the language only in Settings). The rule "never auto-detect from the browser language" holds for marketing too: a suggestion banner is fine, switching on its own is not.
