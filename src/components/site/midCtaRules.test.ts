import { describe, it, expect } from 'vitest';
import { midCtaAfterIndex, midCtaEligible } from './midCtaRules';

describe('midCtaEligible', () => {
  it('allows a how-to post with enough sections', () => {
    expect(midCtaEligible('how-to-stop-nail-biting', 'Treatment', 8)).toBe(true);
    expect(midCtaEligible('nail-biting-laptop-working-from-home', 'Productivity', 7)).toBe(true);
  });

  it('never shows on sensitive topics, whatever the tag', () => {
    for (const slug of [
      'is-nail-biting-self-harm', 'nail-biting-ocd-connection', 'nail-biting-panic-disorder',
      'nail-biting-and-depression', 'nail-biting-in-children', 'nail-biting-toddler', 'nail-biting-teenagers',
      'nail-biting-vs-tics-tourette', 'nail-biting-medication', 'nail-biting-cancer', 'staph-mrsa-nail-biting',
      'pinworm-nail-biting', 'nail-biting-finding-a-therapist', 'nail-biting-cognitive-behavioral-therapy',
      'inositol-nail-biting', 'nac-nail-biting', 'nail-biting-fsa-hsa', 'nail-biting-paronychia', 'nail-biting-magnesium', 'nail-biting-support-groups', 'nail-biting-vs-hair-pulling', 'nail-biting-interview-anxiety',
    ]) {
      expect(midCtaEligible(slug, 'Treatment', 9), slug).toBe(false);
    }
  });

  it('is off for tags outside the allowlist and for short posts', () => {
    expect(midCtaEligible('nail-biting-cost', 'Health', 9)).toBe(false);
    expect(midCtaEligible('nail-biting-stress', 'Psychology', 9)).toBe(false);
    expect(midCtaEligible('how-to-stop-nail-biting', 'Treatment', 5)).toBe(false);
  });

  it('places the block about 40% through, after the third section at the earliest', () => {
    expect(midCtaAfterIndex(6)).toBe(2);
    expect(midCtaAfterIndex(10)).toBe(3);
    expect(midCtaAfterIndex(20)).toBe(7);
  });
});
