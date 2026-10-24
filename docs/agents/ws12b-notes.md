# WS12b: the core marketing pages in Spanish, German and Brazilian Portuguese

Branch `worktree-agent-a4f495929d6e6be67`. Flags: none new. It uses the three WS12a flags `locale_es`, `locale_de`, `locale_pt_br`.

**Every translation here is a machine draft marked NEEDS NATIVE REVIEW. Nothing is indexable until a person has read it and flipped the language's
`reviewed` marker.** With the flags off (production today) the site is what it was: see "Flags off" below for how that was checked.

## What exists

The home page, `/how-it-works`, `/pricing` and `/about`, plus the shared pieces (header, footer, closing call to action, trial button, pricing
section, the home page FAQ, the contact form, the live demo's text, the 404 page), in `es`, `de` and `pt-BR`.

| English | Spanish | German | Brazilian Portuguese |
|---|---|---|---|
| `/` | `/es` | `/de` | `/pt-br` |
| `/how-it-works` | `/es/how-it-works` | `/de/how-it-works` | `/pt-br/how-it-works` |
| `/pricing` | `/es/pricing` | `/de/pricing` | `/pt-br/pricing` |
| `/about` | `/es/about` | `/de/about` | `/pt-br/about` |

The slug after the language is the English slug on purpose (no translated URLs: nothing to keep in step, and the language switcher can map any page to
the same page). The prefix is lower case (`pt-br`): the server's canonicalising 301 lower-cases paths, so `/pt-BR/` would redirect. The home page has no
trailing slash (`/es`), like the English home page canonical.

## The three states of a language (the whole policy is `localeState()` in `server/marketing/localePages.js`)

| State | When | What a visitor and a crawler get |
|---|---|---|
| **off** | the flag (`locale_es` ...) is off. Production today. | The addresses answer the branded 404 like any unknown address. Not in the sitemap, named in no `hreflang`, no language switcher drawn, no server log line. The English pages and every other response are byte for byte what they were (checked, see below). |
| **draft** | flag on, `reviewed` still `false` | `/es` ... answer 200 so you and a translator can QA them. `<meta name="robots" content="noindex,follow">` and `X-Robots-Tag: noindex,follow`. Not in the sitemap, not in any `hreflang`. The English pages gain only the language switcher. |
| **live** | flag on **and** `reviewed = true` | Indexable, self canonical, `hreflang` for English, every live language and `x-default` (the same set on the English page and on each localized page, so it is reciprocal), sitemap entries with `xhtml:link` alternates on both sides, localized `<title>`, description, Open Graph and Twitter tags, `og:locale` (es_LA, de_DE, pt_BR), `<html lang>`, localized JSON-LD (WebPage/AboutPage/HowTo/FAQPage/BreadcrumbList/Person with `inLanguage`; the FAQPage equals the visible FAQ, and the SoftwareApplication/Offer in the page shell is localized). |

Languages are independent: es live, de draft and pt-BR off at the same time works (tested). The crawler copy (the server-rendered article inside
`#root` and the `<noscript>` navigation) follows the visible page section by section, in the language of the page.

## How the owner takes a language live

1. Have a native speaker read every file of the language: `src/i18n/locales/<x>/marketing-{chrome,pricing,about,how,home,demo,meta}.ts`, `site.ts`,
   `meta.ts` (the page titles and descriptions; build only). Use the glossary in `ws12a-notes.md` (the app and the site use the same words).
2. To QA first: set the flag in the server's environment (`FEATURE_FLAGS=locale_de`, comma separated with any others) and deploy. The pages are
   reachable and `noindex`. The server logs `[locale] served: de (draft)` at start-up.
3. When the reading is done: set `export const reviewed = true;` in `src/i18n/locales/<x>/reviewed.ts` (one marker per language; it also stops the
   app's language picker calling the translation a draft), commit, build and deploy. The log line says `de (live)`.
4. Check: `curl -s https://stopbiting.today/sitemap.xml | grep -c hreflang` is non-zero; `view-source:` of `/de/pricing` has the self canonical, no
   `noindex`, and the four `hreflang` links; the English `/pricing` has the same four. Then submit the sitemap in Search Console if you like.
5. To undo: remove the flag. The addresses become 404 again, drop out of the sitemap and the `hreflang` annotations disappear in the same deploy. Search
   engines drop 404 pages over days to weeks.

`SB_I18N_DIR` (environment variable) points the server at another folder of the `dist/i18n/<locale>.json` files. It exists so the integration tests can
boot the real server with a copy whose marker says `reviewed: true` without editing a committed file. **Never set it in production.** Nothing else can make
a language "reviewed": the marker travels inside the file the build wrote.

## How a page is made

- **English text** lives in `src/i18n/scopes/marketing-*.ts` (7 scopes, 311 messages), translations in `src/i18n/locales/<x>/marketing-*.ts` typed
  `Record<keyof English, string>`. The components (`Landing`, `HowItWorks`, `PricingPage`, `About`, `SiteHeader`, `SiteFooter`, `ClosingCta`,
  `TrialButton`, `PricingSection`, `ContactForm`, `HeroDemo`) read them through `useSiteT` (`src/i18n/marketing/useSite.ts`).
- **The language of a page comes from its URL**, not from the stored pick: `setPageLocale()` in `src/i18n/core.ts` overrides the language for the page
  and is never stored. `src/i18n/locale-site-<x>.ts` is the page catalog chunk (`assets/locale-site-*.js`, kept out of the service worker precache); a
  page renders nothing until it has loaded (or failed, then English shows).
- **The bag** (`src/i18n/marketing/bag.ts`): the numbers and words every page shares, passed as message parameters so no message carries a literal
  that could drift: `trialDays` (plural, from `shared/plans.js` / `TRIAL_DAYS`), prices (`pMonthly`, `pYearly`, `pYearlyShort`, `pMonthlyEq`, `pSave`; list
  prices from one place, USD, formatted per language with `Intl`), the flag-dependent phrases (`sync`, `phone`, `methods`), `homeUrl`.
- **English is unchanged**: English messages keep their literal `$2.99` and the `{trialHyphen}` tokens, and the flag-aware copy rules (`shared/flagCopy.js`)
  still run in `copy()`.
- **The crawler copy and the metadata** are rendered at build time (`scripts/generate-locale-pages.mjs` from the vite `closeBundle`, through
  `src/i18n/marketing/{build,articles,translate,signin}.ts`) into `dist/i18n/<locale>.json` with the review marker and the freshness dates. The server
  (`server/marketing/localePages.js`) only reads them: no message formatter at run time. `/i18n/*` answers 404. Flag-dependent sentences (event sync, phone
  companion, the sign-in methods) are rendered as `{{if flag}}...{{else}}...{{end}}` variants and resolved per process by the same flag rules as the English
  copy; the eight sign-in combinations are precomputed.
- **The build needs Node 22.18 or newer** (it imports `.ts` files directly, as `generate-seo-content.mjs` already did). The Docker build stage (`node:22-alpine`) and Nixpacks
  (`NIXPACKS_NODE_VERSION=22`) satisfy it; a build with only the files the Dockerfile copies was run to prove the new script needs nothing else.

## The language switcher

Header (large screens, a `details` menu) and footer (always) of the four marketing pages, **only while at least one language is served**
(the server writes `<meta name="sb-locales" content="...">` into the English pages and the localized ones). Plain links to the equivalent page of the
other language (not the home page), with `hreflang` and `lang`. Clicking one also stores the pick (`kv('i18n','locale')`, the same key the app's Settings
picker writes), so the app opens in the language the visitor chose on the site. Nothing ever redirects from the browser language or the stored pick.

## Terminology and register

Neutral register: Spanish tú, German du, Brazilian Portuguese você. The brand stays "Stop Biting". Words are the app's (`ws12a-notes.md` glossary); a test
(`catalogs.test.ts`) compares the shared terms with the app catalogs. The approved privacy sentence ("Detection runs on your device. No camera data is sent
while it runs.") is translated faithfully in all three. No invented numbers, no medical claims, prices stay USD (`2,99 $` in German, `2,99 US$` in
Spanish, `US$ 2,99` in Brazilian Portuguese).

## What is NOT translated

Blog, compare, solutions, feature and tool pages, the legal pages (privacy, terms, refund, editorial policy), the sign-in page, the signed-in app's
server pages, emails, `llms.txt`, Open Graph images (the English card is reused; no localized cards), the testimonials block (hidden on localized
pages: the quotes are real and in English), and any page not in the table above. The localized footer says the blog and legal pages are English only;
their links go to the English pages. The footer links from a localized page to an English-only page carry the anchor attribute `hreflang="en"`,
and the `<noscript>` navigation labels them as English (`lang="en"`).

## Enforcement and tests

- `local-i18n/*` lint scope now covers every converted file (`scripts/i18n/scope.mjs`; exemptions left only where a reason is written): **0 new violations,
  the baseline stays 23 errors / 4 warnings**.
- Catalog parity for the seven scopes x 3 languages (keys, placeholders, plural forms, tags, `NEEDS NATIVE REVIEW` header, `reviewed.ts`).
- Pseudo-locale coverage render per converted page (`src/i18n/coverage/site.coverage.test.tsx`, `site-home.coverage.test.tsx`): German catalog with every
  `t()` result marked; any word outside a mark fails. The same pages in English must say what they always said.
- `src/i18n/marketing/articles.test.tsx`: the crawler article follows the React page section by section (both directions), with and without event sync, phone
  companion and each sign-in method, for 4 pages x 3 languages; FAQPage questions and answers equal the visible FAQ.
- `scripts/localePages.test.mjs` boots the **real** `server.js` in the three states per language and mixed states (36 tests): 404 body equals an unknown
  address when off, noindex in draft, hreflang/sitemap reciprocity, `/i18n/*` 404, English pages unchanged apart from the switcher marker and hreflang.
- `server/marketing/localePages.test.js` (24 unit tests), `routes`, `bag`, `signin`, `siteCatalogs`, `pageLocale` tests.
- WS12a tests I changed (all because files moved from "exempt" to "converted", never loosened): `scripts/i18n/{guard,inventory,no-hardcoded-text}.test.mjs`,
  `scripts/flagCopySources.test.mjs` (its sources are now the marketing scopes), `src/i18n/catalogs.test.ts`.
- Probe for a person: `node scripts/i18n/dom-probe/site.mjs compare|layout ...` (English DOM against another build; the localized pages at 390 and 1280 px:
  sideways scroll, overflowing boxes, console errors, the switcher, the demo's first click).

## What was verified, and how

| Claim | Evidence |
|---|---|
| Flags off: nothing changed | Build of current `main` against this branch with every flag unset (`scripts/flags-off-diff/dist-diff.mjs`): of 553 `dist` files, 503 identical after hash normalisation (every HTML, JSON, txt, xml and image file), 27 JS chunks identical apart from the minifier's renamed identifiers, 14 changed (13 JS/CSS chunks, `sw.js`), 9 added (the three `i18n/*.json`, three `locale-site-*.js`, three small shared chunks named `reviewed-*.js` that also carry the `plans` messages). 89 of 91 HTTP responses of the real server identical (status, headers, body) with `scripts/flags-off-diff`; the two that differ are `/sw.js` and the entry chunk `/assets/index.js` (rebuilt). `/es`, `/de/pricing`, `/pt-br/about`, `/i18n/es.json` answer the same 404 as `/no-such-page`. |
| English pages unchanged | DOM (HTML) of `/`, `/pricing`, `/how-it-works`, `/about` identical at 1280 and 390 px in headless Chrome. `scripts/flags-off-diff` DOM and pixels: 24 of 25 captures identical to the pixel. **One capture differs by 83 pixels**: the English `/pricing` lede at 1280 px (box 10 x 13 px at the "Y" of "You"). Same HTML; main renders `{TRIAL_WORDS_CAP} free first, ...` as two text nodes, the converted page as one, and Chrome positions glyphs per text run (0.02 px apart). Several other text-node boundaries differ the same way ("All 188 articles", the footer year, `3 days free, no card`) without changing a pixel in the captures. Not visible; kept as is rather than splitting translated messages to imitate JSX. |
| Localized pages render | Headless Chrome at 390 and 1280 px, all 12 pages: `<html lang>`, canonical, hreflang, no console errors (the one console message, a 404 for `/auth/providers`, is the same on the English pages: the sign-in providers route answers 404 while no sign-in flag is on), no sideways scroll, nothing past the right edge (the probe still reports the footer's big decorative word as clipped at 390 px: it is clipped by design, the English footer on `main` measures the same 544 px inside 390). German at 390 px needed fixes (a shorter label for the small header button, a new message whose English text is unchanged; wrapping buttons, two footer columns, the offer line): in `index.css` under `html:not([lang='en'])`, so English layout is untouched. |
| Lighthouse (`npx lighthouse` 13.5, local server, temp `DATA_DIR`, dummy env, flags on, `reviewed: true` copies) | All 12 localized pages: **SEO 100, Accessibility 100, Best practices 96** (the 4 points are the same `/auth/providers` console error; English `/pricing` scores the same; one run of `/de/pricing` scored 92 with an extra `inspector-issues` audit and was not reproduced in three re-runs). Performance was not scored. |
| `seo:sync` once, `seo:check`, `og:check` | `src/data/pageUpdates.json` gained 12 localized rows (dated 2026-10-24); localized pages are kept out of `seo-content.json` and the claim corpus. `seo:check` and `og:check` pass; `og:generate` changes nothing (no localized cards). |
| Switcher | Header and footer links map `/pricing` to `/de/pricing`, not the home page; a click stores the pick and `<html lang>` follows; English pages do not redirect when a pick is stored. |
| Bundle | English home first load 186.84 to 191.93 KB gzip (+5.08 KB, +2.7 percent); everything an English visitor could download +7.45 KB gzip. Page catalogs `locale-site-*` 10.2 to 10.9 KB gzip each, fetched only on a localized page; none in the service worker precache. |
| Suite | 185 files / 3807 tests (2 skipped) against 175 / 3561 on `main`; scoped lint 23 errors / 4 warnings, as on `main`. |

## NOT verified

- Any translation by a native speaker. Terminology was checked against the app catalogs only.
- Real search engine behaviour: no crawl, no Search Console, no hreflang validator, no Google Rich Results Test on the localized JSON-LD (it is built from the
  same functions as the English one and tested for shape).
- Anything on a real device or Safari/Firefox; only headless Chrome and Lighthouse. The 390 px layout check is automated plus screenshots read by me.
- Performance scores of the localized pages (only SEO, accessibility, best practices).
- The merged result in production: Coolify build, Node patch level of the image. (`node:22-alpine` and Nixpacks 22 are moving tags; 22.18 is required.)
- Paddle checkout in another language (the checkout itself is not translated here; the app's billing screens are WS12a).

## Risks and things that need a human

1. **Machine translation quality** of all 311 messages x 3 languages, including FAQ answers, the "How it works" steps and the About page's technical
   paragraph. Plural and register choices are consistent but unreviewed.
2. **Claims translated faithfully that may be worth re-checking in English too** (they are on the live English pages): "You can disconnect your internet
   connection after the app loads and it will function identically" (About), "It keeps working with the Wi-Fi off" (home), and "detects nail biting only"
   (FAQ). If the owner changes the English, the translations must follow (the catalogs make that a visible diff).
3. **Duplicate-content perception**: four translated pages sit beside English-only blog and legal pages; localized pages link to English pages for those.
   Intentional and stated on the page.
4. **Visitors served by the service worker on `/`** get the cached app shell without the server's `sb-locales` marker, so no language switcher on the
   home page for them (the other pages come from the server and have it). Same limitation as the flag-aware copy markers; the localized pages are reachable
   from every other page and from search.
5. `og:locale` for Spanish is `es_LA`: neutral Latin American Spanish was the register chosen; change `OG_LOCALE` in `routes.ts` if the owner prefers `es_ES`.
6. German is the longest language; the layout was fixed for 390 px, but a native speaker may shorten labels further.
7. English text-node boundaries differ from the old JSX in a few places (see the table); invisible, but a pixel diff tool reports one `/pricing` capture.

## Seams in shared files (kept minimal)

`server.js`: one import block, `LOCALE_FILES/STATES/CTX` before `sendHtml`, `decorateEnglishHtml` in `sendHtml` for status 200, the sitemap handler
combines `withLocaleAlternates`, the `/i18n/{*rest}` 404, one `registerLocalePages` block before the SPA fallback. `vite.config.ts`: the second `execFileSync`.
`src/App.tsx`: the locale prefix branch. `src/i18n/core.ts`: page locale, site catalog loader. `scripts/sync-seo.mjs` and `generate-seo-content.mjs`: the
localized pages in the freshness ledger and out of `seo-content.json`. The service worker already serves only `/` from its cached shell (WS13), so `/es`
etc. always reach the server.
