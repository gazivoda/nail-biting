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

import { kv } from '../storage/kv';
import { FLAGS_TTL_MS } from './flags';

/**
 * The flags the server lists in the marker: the ones that change copy on pages that exist today. `lifetime_plan` is listed only
 * when the server also knows the Lifetime price id (server/marketing/copyFlags.js), which is the condition its crawler copy and
 * its FAQPage data already follow: the marker hands the FAQ the same decision, so the page and the schema cannot disagree.
 */
export const COPY_MARKER_FLAGS = ['event_sync', 'phone_companion', 'lifetime_plan'] as const;

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

/** What only the BUILD knows, for the flags whose words also need it (see `copyFlagIsOn`). */
export interface BuildFacts {
  /** The build was given the Paddle price id of the Lifetime plan (VITE_PADDLE_PRICE_ID_LIFETIME): the same fact the card needs. */
  lifetimePriceId: boolean;
}

/**
 * Whether `name` is on, by the order above.
 *
 * `build` (optional) is for `lifetime_plan`, whose card needs the flag AND the build's price id. The server lists the flag in the
 * marker only when it knows the id too, so a marker is the whole answer. Without a marker the app's own answer is only the flag,
 * and the words must not say "Lifetime" next to a card that is not there: they wait for the build's id as well.
 */
export function copyFlagIsOn(
  name: string,
  { marker, cached, now }: { marker: ReadonlySet<string> | null; cached: CachedFlags | null | undefined; now: number },
  build?: BuildFacts,
): boolean {
  if (marker) return marker.has(name);
  if (name === 'lifetime_plan' && build && !build.lifetimePriceId) return false;
  if (!cached || typeof cached.at !== 'number' || now - cached.at >= FLAGS_TTL_MS || now < cached.at) return false;
  const flags = cached.flags;
  return flags !== null && typeof flags === 'object' && (flags as Record<string, unknown>)[name] === true;
}

export interface CopyFlagInputs {
  marker: ReadonlySet<string> | null;
  cached: CachedFlags | null;
  now: number;
}

/**
 * What a page can know about the flags right now: its marker, the app's last answer and the time. Kept out
 * of the React hooks because it reads the clock and the page, which a component must not do while rendering.
 */
export function takeCopyFlagInputs(): CopyFlagInputs {
  return { marker: readCopyMarker(), cached: kv.get<CachedFlags | null>('flags', 'last-known', null), now: Date.now() };
}

/** Reads the marker out of the page, if there is a page. */
export function readCopyMarker(doc: Pick<Document, 'querySelector'> | undefined = typeof document === 'undefined' ? undefined : document): ReadonlySet<string> | null {
  try {
    return parseCopyMarker(doc?.querySelector(`meta[name="${COPY_MARKER_NAME}"]`)?.getAttribute('content'));
  } catch {
    return null;
  }
}
