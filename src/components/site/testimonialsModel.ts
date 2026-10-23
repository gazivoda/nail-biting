// Pure model for the testimonial section: the entry shape and the validator that
// turns whatever is in src/data/testimonials.json into entries safe to publish.
//
// No React, no DOM and no store import, so vitest (node) tests it, the
// Testimonials component renders from it, and scripts/generate-seo-content.mjs
// loads it directly (Node strips the types) to build the crawler copy from the
// very same validation. Types here are all erasable on purpose.
//
// The rule this module exists to enforce: NOTHING is shown unless the owner
// recorded consent. An entry without `consent: true` is dropped; a photo without
// `photoConsent: true` is dropped from an otherwise valid entry. See
// src/data/README-testimonials.md for the owner's side of it.

export interface Testimonial {
  /** What they said, in their words. Quote it as given; do not tidy it into a claim. */
  quote: string;
  /** First name only. */
  firstName: string;
  /** How long they bit their nails, in their words: "about ten years", "since childhood". */
  howLongTheyBit: string;
  /** Optional nails-only before/after photo, a site path under /testimonials/. */
  beforeAfterPhoto?: { src: string; alt: string };
}

const MAX_QUOTE = 600;
const MAX_SHORT = 80;
// A flat or one-folder-deep path under /testimonials/. No "..", no query, no scheme.
const PHOTO_PATH = /^\/testimonials\/(?:[\w-]+\/)?[\w-]+(?:\.[\w-]+)*\.(?:jpe?g|png|webp|avif)$/i;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

const cleanText = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t.length > 0 && t.length <= max ? t : null;
};

/**
 * Keeps only entries that are complete AND consented to. Anything else is
 * dropped silently here and reported by `rejectedTestimonials` (the unit test
 * uses it so a typo in the data file is noticed instead of hiding a quote).
 */
export function parseTestimonials(raw: unknown): Testimonial[] {
  if (!Array.isArray(raw)) return [];
  const out: Testimonial[] = [];
  for (const item of raw) {
    const entry = parseOne(item);
    if (entry) out.push(entry);
  }
  return out;
}

/** Indexes of entries in `raw` that parseTestimonials would drop, for tests and the README's checklist. */
export function rejectedTestimonials(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item, i) => (parseOne(item) ? [] : [i]));
}

function parseOne(item: unknown): Testimonial | null {
  if (!isRecord(item)) return null;
  if (item.consent !== true) return null;
  const quote = cleanText(item.quote, MAX_QUOTE);
  const firstName = cleanText(item.firstName, MAX_SHORT);
  const howLongTheyBit = cleanText(item.howLongTheyBit, MAX_SHORT);
  if (!quote || !firstName || !howLongTheyBit) return null;
  // First name only: a space would mean a surname slipped in.
  if (/\s/.test(firstName)) return null;

  const entry: Testimonial = { quote, firstName, howLongTheyBit };

  const photo = item.beforeAfterPhoto;
  if (typeof photo === 'string' && item.photoConsent === true && PHOTO_PATH.test(photo)) {
    const alt = cleanText(item.photoAlt, 160)
      ?? `Before and after photo of ${firstName}'s nails, shared with their permission`;
    entry.beforeAfterPhoto = { src: photo, alt };
  }
  return entry;
}

/** The small line under the first name. Shared by the page and the crawler copy. */
export function testimonialDetail(t: Testimonial): string {
  return `Bit their nails: ${t.howLongTheyBit}`;
}

/** The section heading. Shared by the page and the crawler copy. */
export const TESTIMONIALS_HEADING = 'In their own words';
