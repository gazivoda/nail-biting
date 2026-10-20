// A short call to action in the middle of a blog post, for readers who came
// for a how-to and have read far enough to be weighing options. It is shown
// only on posts where a product prompt cannot read as exploiting a worry:
// tag-allowlisted, and never on posts about self-harm, OCD, PTSD, panic,
// depression, anxiety, tics, children, infections, cancer, supplements,
// medication, therapy or support groups.
const ELIGIBLE_TAGS = new Set(['Treatment', 'Productivity', 'Technology', 'Products', 'Comparison']);

const EXCLUDED_SLUG =
  /self-harm|ocd|ptsd|panic|depress|child|toddler|teen|parent|suicid|trauma|medic|ssri|(^|-)nac(-|$)|inositol|pinworm|staph|cancer|therap|clinic|doctor|infection|(^|-)tics?(-|$)|tourette|fsa-hsa|paronychia|osteomyelitis|hangnail|magnesium|support-group|hair-pulling|trichotillomania|skin-picking|anxiety/;

/** Minimum sections so the block sits mid-article, not next to the end card. */
const MIN_SECTIONS = 6;

export function midCtaEligible(slug: string, tag: string, sectionCount: number): boolean {
  return ELIGIBLE_TAGS.has(tag) && !EXCLUDED_SLUG.test(slug) && sectionCount >= MIN_SECTIONS;
}

/** Index of the section the block goes after: about 40% through, never before the third section. */
export function midCtaAfterIndex(sectionCount: number): number {
  return Math.max(2, Math.floor(sectionCount * 0.4) - 1);
}
