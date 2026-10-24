// The locale state. No React here, so it is tested in node and can be read from anywhere
// (an event handler, a notification, a pure helper). The React side is hooks.ts.
//
// What decides the language the person sees:
//   1. what they picked (kept through ./persist.ts in kv 'i18n' / 'locale'), never the browser's language: there is no detection;
//   2. whether that locale is allowed, which means its feature flag is on. The core does not read
//      flags (that would pull the network client into every page that formats a string):
//      <LocaleHost /> tells it with setAllowedLocales();
//   3. whether its catalog has arrived. Catalogs are fetched on demand (dynamic import), so an
//      English visitor never downloads them. Until a catalog is here the text stays English, and
//      <html lang> is not touched; a key missing from a catalog also falls back to English.
//
// With nothing picked, or a locale whose flag is off, getLocale() is 'en' and nothing below
// changes anything on the page.

// This file imports nothing from the app (no storage, no flags, no store): the alarm overlay and the
// detection hook, which the marketing home page's demo also loads, reach it, and the guard tests
// (scripts/coachingGuards, falsePositiveGuards, backgroundGuards) keep storage and the flag client out of
// that part of the bundle. Where the pick is stored is plugged in by ./persist.ts, which only the signed-in
// app imports; with nothing plugged in the language is English.

export const LOCALES = ['en', 'es', 'de', 'pt-BR'] as const;
export type Locale = (typeof LOCALES)[number];
export type ForeignLocale = Exclude<Locale, 'en'>;

export interface LocaleInfo {
  code: Locale;
  /** The language's name in itself. Never translated: a person must be able to find their own language. */
  native: string;
  /** BCP 47 tag for Intl and for <html lang>. */
  tag: string;
  /** The flag that lets people pick it (the owner turns it on after a native review). */
  flag: 'locale_es' | 'locale_de' | 'locale_pt_br' | null;
}

export const LOCALE_INFO: Record<Locale, LocaleInfo> = {
  en: { code: 'en', native: 'English', tag: 'en', flag: null },
  es: { code: 'es', native: 'Español', tag: 'es', flag: 'locale_es' },
  de: { code: 'de', native: 'Deutsch', tag: 'de', flag: 'locale_de' },
  'pt-BR': { code: 'pt-BR', native: 'Português (Brasil)', tag: 'pt-BR', flag: 'locale_pt_br' },
};

export function isLocale(x: unknown): x is Locale {
  return typeof x === 'string' && (LOCALES as readonly string[]).includes(x);
}

/** What a locale file (src/i18n/locale-xx.ts) exports. */
export interface LocaleModule {
  /** `false` until a native speaker has checked the file; the language card says so while it is false. */
  reviewed: boolean;
  catalog: Record<string, Record<string, string>>;
}

const LOADERS: Record<ForeignLocale, () => Promise<LocaleModule>> = {
  es: () => import('./locale-es'),
  de: () => import('./locale-de'),
  'pt-BR': () => import('./locale-pt-BR'),
};

// The text of the localized MARKETING pages (WS12b) is a second, smaller catalog per language, fetched by a visitor
// who opened one of those pages (and by nobody else). It is kept apart from the app's catalog above so that the
// app's chunk does not grow, and so that opening /es/pricing does not download the whole signed-in app's text.
// lookup() reads both.
const SITE_LOADERS: Record<ForeignLocale, () => Promise<LocaleModule>> = {
  es: () => import('./locale-site-es'),
  de: () => import('./locale-site-de'),
  'pt-BR': () => import('./locale-site-pt-BR'),
};

/** Where the pick lives. ./persist.ts plugs in the storage module; nothing is plugged in on the marketing pages. */
export interface LocalePersistence {
  read(): unknown;
  write(locale: Locale): void;
}
let persistence: LocalePersistence | null = null;

let preferred: Locale | null = null; // read through `persistence` on first use
let allowed: ReadonlySet<Locale> = new Set<Locale>(['en']);
let effective: Locale = 'en';
let version = 0;
let langWritten = false;
const catalogs = new Map<Locale, LocaleModule>();
const siteCatalogs = new Map<Locale, LocaleModule>();
const loading = new Map<Locale, Promise<void>>();
const siteLoading = new Map<Locale, Promise<void>>();
const failed = new Set<Locale>();
const siteFailed = new Set<Locale>();
// The language of the marketing PAGE being shown (WS12b): set from the address (/es/pricing) by App.tsx, never
// stored, and never read from the browser's language. It wins over the pick and does not need the locale flag:
// the server only serves a localized page while the flag is on.
let pageLocale: Locale | null = null;
const listeners = new Set<() => void>();
let transform: ((s: string) => string) | null = null;

function notify() {
  version += 1;
  listeners.forEach(fn => { try { fn(); } catch { /* a listener must not break a locale change */ } });
}

function applyDocumentLang() {
  if (typeof document === 'undefined') return;
  const want = LOCALE_INFO[effective].tag;
  // Never write the attribute while English is showing and we have not changed it: the page stays as served.
  if (effective === 'en' && !langWritten) return;
  if (document.documentElement.lang !== want) document.documentElement.lang = want;
  langWritten = true;
}

function load(locale: ForeignLocale) {
  if (loading.has(locale) || catalogs.has(locale) || failed.has(locale)) return;
  loading.set(
    locale,
    LOADERS[locale]()
      .then(mod => { catalogs.set(locale, mod); })
      .catch(() => { failed.add(locale); }) // offline and never fetched: stay English
      .finally(() => { loading.delete(locale); recompute(); }),
  );
}

function loadSite(locale: ForeignLocale) {
  if (siteLoading.has(locale) || siteCatalogs.has(locale) || siteFailed.has(locale)) return;
  siteLoading.set(
    locale,
    SITE_LOADERS[locale]()
      .then(mod => { siteCatalogs.set(locale, mod); })
      .catch(() => { siteFailed.add(locale); }) // offline: the page stays as it is
      .finally(() => { siteLoading.delete(locale); recompute(); notify(); }), // notify: a failure changes nothing else, but the page waits on it
  );
}

/** Decide the effective locale from the pick, the allowed set and the loaded catalogs. */
function recompute() {
  if (pageLocale !== null) {
    // A localized marketing page: its own language, as soon as the marketing catalog is here.
    let next = effective;
    if (pageLocale === 'en') next = 'en';
    else if (siteCatalogs.has(pageLocale)) next = pageLocale;
    else loadSite(pageLocale as ForeignLocale);
    if (next !== effective) {
      effective = next;
      applyDocumentLang();
      notify();
    }
    return;
  }
  const pick = getPreferredLocale();
  const wanted: Locale = pick !== 'en' && allowed.has(pick) ? pick : 'en';
  let next = effective;
  if (wanted === 'en') next = 'en';
  else if (catalogs.has(wanted)) next = wanted;
  else load(wanted as ForeignLocale); // keep showing the current language until it arrives
  if (next !== effective) {
    effective = next;
    applyDocumentLang();
    notify();
  }
}

// ── Reading ──────────────────────────────────────────────────────────────────

/** The locale the text is in right now. */
export function getLocale(): Locale {
  return effective;
}

/** What the person picked, whether or not it is currently allowed. 'en' when nothing was picked. */
export function getPreferredLocale(): Locale {
  if (preferred === null) {
    const stored = persistence ? persistence.read() : 'en';
    preferred = isLocale(stored) ? stored : 'en';
  }
  return preferred;
}

/** Bumps on every change of the effective locale or the pick; hooks use it to re-render. */
export function getLocaleVersion(): number {
  return version;
}

export function subscribeLocale(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** The BCP 47 tag of the effective locale, for Intl. */
export function intlTag(): string {
  return LOCALE_INFO[effective].tag;
}

/** `undefined` while English shows (Intl then uses the browser's own formats, as the app always did), else the tag. */
export function intlLocaleArg(): string | undefined {
  return effective === 'en' ? undefined : LOCALE_INFO[effective].tag;
}

/** The translated message, or undefined (English locale, catalog not here yet, or the key is missing). */
export function lookup(scope: string, key: string): string | undefined {
  if (effective === 'en') return undefined;
  return catalogs.get(effective)?.catalog[scope]?.[key] ?? siteCatalogs.get(effective)?.catalog[scope]?.[key];
}

/** Whether a native speaker has checked this locale's file. English is its own source. */
export function isLocaleReviewed(locale: Locale): boolean {
  if (locale === 'en') return true;
  return (catalogs.get(locale) ?? siteCatalogs.get(locale))?.reviewed ?? false;
}

export function isLocaleLoaded(locale: Locale): boolean {
  return locale === 'en' || catalogs.has(locale);
}

/** True when fetching the marketing catalog failed (offline, blocked): the page then stays as it is. */
export function didSiteLocaleLoadFail(locale: Locale): boolean {
  return siteFailed.has(locale);
}

/** Whether the marketing catalog of this locale is here (English has none to load). */
export function isSiteLocaleLoaded(locale: Locale): boolean {
  return locale === 'en' || siteCatalogs.has(locale);
}

/** True when fetching this locale's catalog failed (offline, blocked). Cleared by the next setLocale. */
export function didLocaleLoadFail(locale: Locale): boolean {
  return failed.has(locale);
}

// ── Writing ──────────────────────────────────────────────────────────────────

/** Plugs in the storage of the pick (./persist.ts). Re-reads the pick, so it may be called after first use. */
export function configurePersistence(p: LocalePersistence | null): void {
  persistence = p;
  preferred = null;
  recompute();
  notify();
}

/** The person picks a language. Stored, and applied as soon as its flag is on and its catalog is here. */
export function setLocale(locale: Locale): void {
  if (!isLocale(locale)) return;
  preferred = locale;
  persistence?.write(locale);
  failed.delete(locale);
  recompute();
  notify(); // the pick itself changed (the language card shows it)
}

/**
 * The language of the marketing page on screen (App.tsx, from the address). `null` goes back to the pick. The page
 * language is applied once the marketing catalog has arrived; until then the text stays as it is. Never stored.
 */
export function setPageLocale(locale: Locale | null): void {
  if (pageLocale === locale) return;
  pageLocale = locale;
  recompute();
  notify();
}

export function getPageLocale(): Locale | null {
  return pageLocale;
}

/** Which locales may be used (their flags are on). <LocaleHost /> is the only caller. English is always allowed. */
export function setAllowedLocales(list: readonly Locale[]): void {
  const next = new Set<Locale>(list);
  next.add('en');
  if (next.size === allowed.size && [...next].every(l => allowed.has(l))) return;
  allowed = next;
  recompute();
}

export function getAllowedLocales(): readonly Locale[] {
  return LOCALES.filter(l => allowed.has(l));
}

// ── Output transform (tests only) ────────────────────────────────────────────

/** Applied to every string t() returns. The pseudo-locale test uses it to mark them; production never sets it. */
export function transformOutput(s: string): string {
  return transform ? transform(s) : s;
}

export function setOutputTransformForTests(fn: ((s: string) => string) | null): void {
  transform = fn;
}

// ── Test hooks ───────────────────────────────────────────────────────────────

export function installCatalogForTests(locale: ForeignLocale, mod: LocaleModule): void {
  catalogs.set(locale, mod);
  failed.delete(locale);
}

/** The marketing catalog of a locale (src/i18n/locale-site-*.ts), installed by a test instead of fetched. */
export function installSiteCatalogForTests(locale: ForeignLocale, mod: LocaleModule): void {
  siteCatalogs.set(locale, mod);
  siteFailed.delete(locale);
}

export function resetLocaleForTests(): void {
  preferred = null;
  allowed = new Set<Locale>(['en']);
  effective = 'en';
  version = 0;
  langWritten = false;
  pageLocale = null;
  catalogs.clear();
  siteCatalogs.clear();
  loading.clear();
  siteLoading.clear();
  failed.clear();
  siteFailed.clear();
  transform = null;
}

/** Waits for the catalog of `locale` (resolves at once for English). Tests and the language card use it. */
export async function ensureLocaleLoaded(locale: Locale): Promise<void> {
  if (locale === 'en') return;
  load(locale);
  await loading.get(locale);
}

/** Waits for the marketing catalog of `locale` (resolves at once for English). A localized page renders after it. */
export async function ensureSiteLocaleLoaded(locale: Locale): Promise<void> {
  if (locale === 'en') return;
  loadSite(locale);
  await siteLoading.get(locale);
}
