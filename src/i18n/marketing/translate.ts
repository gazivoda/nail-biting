// A translator that needs no React and no global locale state (WS12b): the build script, the server-side tests and the
// "the crawler copy follows the page" tests format messages with it. The browser's `t()` (scope.ts) reads the global
// locale; this one is handed the language, the catalog and the bag, so a build can render all three languages in one run.
//
// Where a message depends on an optional feature ({sync, select, ...} or {phone, select, ...}) the translator does not
// choose: it renders both variants and wraps them in the marker shared/flagCopy.js already resolves,
//     {{if event_sync}}text with sync{{else}}text without{{end}}
// which the server resolves once at start-up against its own flags (the same way the feature pages do). The sign-in
// methods are the token {{SIGNIN_METHODS}} the server fills in the same way.

import { LOCALE_INFO, type Locale } from '../core.ts';
import { formatToParts, inspectMessage, parseRich, type Params, type RichNode } from '../message.ts';

export type CatalogLike = Readonly<Record<string, Readonly<Record<string, string>>>>;

/** How a tag in a rich message becomes HTML: `inner` is the already-rendered content of the tag. */
export type HtmlTags = Readonly<Record<string, (inner: string) => string>>;

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface Translator {
  locale: Locale;
  /** The shared values (prices, trial length, ...), for figures that are not messages. */
  bag: Params;
  /** The message as plain text (tags dropped). Variant messages come back wrapped in an {{if}} marker. */
  text(scope: string, key: string, params?: Params): string;
  /** The message as HTML: text escaped, `<tag>` pieces turned into markup by `tags`. */
  html(scope: string, key: string, params?: Params, tags?: HtmlTags): string;
}

/** The feature a message's {select} placeholder stands for. */
const VARIANT_PARAMS: ReadonlyArray<{ param: string; flag: string }> = [
  { param: 'sync', flag: 'event_sync' },
  { param: 'phone', flag: 'phone_companion' },
];

function renderRich(nodes: RichNode[], tags: HtmlTags): string {
  return nodes.map(n => {
    if (typeof n === 'string') return escapeHtml(n);
    const inner = renderRich(n.children, tags);
    return tags[n.tag] ? tags[n.tag](inner) : inner;
  }).join('');
}

function plainRich(nodes: RichNode[]): string {
  return nodes.map(n => (typeof n === 'string' ? n : plainRich(n.children))).join('');
}

export function createTranslator(options: {
  locale: Locale;
  /** The translations of this locale (a SiteCatalog / MetaCatalog merged); ignored for English. */
  catalog?: CatalogLike;
  /** The English messages by scope: the source, and the fallback for a key the catalog lacks. */
  english: CatalogLike;
  /** The shared values (bag.ts). */
  bag: Params;
}): Translator {
  const { locale, catalog, english, bag } = options;
  const tag = LOCALE_INFO[locale].tag;

  const template = (scope: string, key: string): string => {
    const found = (locale === 'en' ? undefined : catalog?.[scope]?.[key]) ?? english[scope]?.[key];
    if (found === undefined) throw new Error(`No message ${scope}.${key}`);
    return found;
  };

  function render(tpl: string, params: Params | undefined, one: (tpl: string, p: Params) => string): string {
    const base: Params = { ...bag, ...params };
    const used = inspectMessage(tpl).placeholders;
    const dependent = VARIANT_PARAMS.filter(v => v.param in used);
    if (dependent.length === 0) return one(tpl, base);
    if (dependent.length > 1) throw new Error(`A message may depend on one optional feature only: ${tpl}`);
    const { param, flag } = dependent[0];
    const off = one(tpl, { ...base, [param]: 'off' });
    const on = one(tpl, { ...base, [param]: 'on' });
    return on === off ? off : `{{if ${flag}}}${on}{{else}}${off}{{end}}`;
  }

  return {
    locale,
    bag,
    text(scope, key, params) {
      return render(template(scope, key), params, (tpl, p) => plainRich(parseRich(formatToParts(tpl, p, tag))));
    },
    html(scope, key, params, tags = {}) {
      return render(template(scope, key), params, (tpl, p) => renderRich(parseRich(formatToParts(tpl, p, tag)), tags));
    },
  };
}

/** Merges catalogs by scope (the site catalog and the meta catalog travel in different files). */
export function mergeCatalogs(...catalogs: CatalogLike[]): CatalogLike {
  return Object.assign({}, ...catalogs) as CatalogLike;
}
