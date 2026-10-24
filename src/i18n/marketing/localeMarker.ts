// Which localized versions of the marketing pages exist right now, as the server tells the page (WS12b).
//
// A marketing page makes no request to learn this (the same rule as src/features/copyFlags.ts: a request under /api/
// counts against shared limits and would change the request set of every page). The server writes
//
//     <meta name="sb-locales" content="es de pt-BR">
//
// into the four core pages (English and localized) while at least one locale flag is on, listing the locales whose
// flag is on. With every locale flag off the tag is not written and the page is byte for byte what it was. The
// language switcher is drawn only from this marker; a page served from the service worker's cached shell has none
// and shows no switcher (the localized addresses are never served from the shell: vite.config.ts denies them).

import { SITE_LOCALES, type SiteLocale } from './routes.ts';

export const LOCALES_MARKER_NAME = 'sb-locales';

/** "es pt-BR" -> ['es', 'pt-BR']; anything unknown is dropped. The result is in the fixed order of SITE_LOCALES. */
export function parseLocaleMarker(content: string | null | undefined): SiteLocale[] {
  if (typeof content !== 'string') return [];
  const named = new Set(content.split(/\s+/));
  return SITE_LOCALES.filter(l => named.has(l));
}

/** Reads the marker out of the page, if there is a page. */
export function readLocaleMarker(doc: Pick<Document, 'querySelector'> | undefined = typeof document === 'undefined' ? undefined : document): SiteLocale[] {
  try {
    return parseLocaleMarker(doc?.querySelector(`meta[name="${LOCALES_MARKER_NAME}"]`)?.getAttribute('content'));
  } catch {
    return [];
  }
}
