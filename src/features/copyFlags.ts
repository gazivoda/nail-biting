// Which flags a MARKETING page may use to word its copy, and where it learns them without a request.
//
// A marketing page (home, About, How it works, a compare page, the trial button on a phone) must not
// make a request of its own for the feature flags: before WS11b none did, and a request under /api/
// counts against the shared limits. So it decides from, in this order:
//
//   1. the marker the server wrote into the page it just served,
//        <meta name="sb-copy-flags" content="event_sync phone_companion">
//      listing the copy-affecting flags that are ON (server.js, `copyMarkerTag`). The server only writes it
//      while at least one is on, so with every flag off the page is byte for byte what it always was.
//      This is authoritative and needs no request.
//   2. the last answer the app itself got from /api/features (src/features/flags.ts keeps it in the
//      key-value store), if it is less than FLAGS_TTL_MS old. A visit to the signed-in app refreshes it.
//   3. nothing: the flag is off, and the page says what it has always said.
//
// A visitor whose service worker serves the cached app shell gets no marker (the shell is a static file),
// so for them only (2) applies. Unknown means off, never on.
//
// No React and no DOM at import time, so the decision is tested in node.

import { FLAGS_TTL_MS } from './flags';

/** The flags the server lists in the marker: the ones that change copy on pages that exist today. */
export const COPY_MARKER_FLAGS = ['event_sync', 'phone_companion'] as const;

export const COPY_MARKER_NAME = 'sb-copy-flags';

/** "event_sync phone_companion" -> the set; anything else (absent, empty, junk) -> null, meaning "no marker". */
export function parseCopyMarker(content: string | null | undefined): ReadonlySet<string> | null {
  if (typeof content !== 'string') return null;
  const names = content.split(/\s+/).filter(name => (COPY_MARKER_FLAGS as readonly string[]).includes(name));
  return names.length ? new Set(names) : null;
}

export interface CachedFlags {
  at?: unknown;
  flags?: unknown;
}

/** Whether `name` is on, by the order above. */
export function copyFlagIsOn(
  name: string,
  { marker, cached, now }: { marker: ReadonlySet<string> | null; cached: CachedFlags | null | undefined; now: number },
): boolean {
  if (marker) return marker.has(name);
  if (!cached || typeof cached.at !== 'number' || now - cached.at >= FLAGS_TTL_MS || now < cached.at) return false;
  const flags = cached.flags;
  return flags !== null && typeof flags === 'object' && (flags as Record<string, unknown>)[name] === true;
}

/** Reads the marker out of the page, if there is a page. */
export function readCopyMarker(doc: Pick<Document, 'querySelector'> | undefined = typeof document === 'undefined' ? undefined : document): ReadonlySet<string> | null {
  try {
    return parseCopyMarker(doc?.querySelector(`meta[name="${COPY_MARKER_NAME}"]`)?.getAttribute('content'));
  } catch {
    return null;
  }
}
