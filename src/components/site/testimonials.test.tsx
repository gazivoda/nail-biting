import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Testimonials, TestimonialsView } from './Testimonials';
import { TESTIMONIALS, TESTIMONIALS_RAW } from './testimonialsData';
import {
  TESTIMONIALS_HEADING,
  parseTestimonials,
  rejectedTestimonials,
  testimonialDetail,
  type Testimonial,
} from './testimonialsModel';

const good = {
  quote: 'It made me notice.',
  firstName: 'Sam',
  howLongTheyBit: 'about ten years',
  consent: true,
};

describe('parseTestimonials (the consent gate)', () => {
  it('turns anything that is not a list into an empty list', () => {
    for (const bad of [undefined, null, {}, 'x', 3]) expect(parseTestimonials(bad)).toEqual([]);
    expect(parseTestimonials([])).toEqual([]);
  });

  it('keeps a complete, consented entry', () => {
    expect(parseTestimonials([good])).toEqual([
      { quote: 'It made me notice.', firstName: 'Sam', howLongTheyBit: 'about ten years' },
    ]);
  });

  it('drops an entry without consent: true, however complete', () => {
    for (const consent of [undefined, false, 'true', 1]) {
      expect(parseTestimonials([{ ...good, consent }])).toEqual([]);
    }
  });

  it('drops an entry with a missing or blank field, a surname, or an over-long quote', () => {
    expect(parseTestimonials([{ ...good, quote: '   ' }])).toEqual([]);
    expect(parseTestimonials([{ ...good, firstName: undefined }])).toEqual([]);
    expect(parseTestimonials([{ ...good, howLongTheyBit: '' }])).toEqual([]);
    expect(parseTestimonials([{ ...good, firstName: 'Sam Smith' }])).toEqual([]);
    expect(parseTestimonials([{ ...good, quote: 'x'.repeat(601) }])).toEqual([]);
  });

  it('shows a photo only with photoConsent: true and a path under /testimonials/', () => {
    const photo = '/testimonials/sam.webp';
    expect(parseTestimonials([{ ...good, beforeAfterPhoto: photo }])[0].beforeAfterPhoto).toBeUndefined();
    expect(parseTestimonials([{ ...good, beforeAfterPhoto: photo, photoConsent: false }])[0].beforeAfterPhoto).toBeUndefined();
    expect(parseTestimonials([{ ...good, beforeAfterPhoto: 'https://example.com/a.jpg', photoConsent: true }])[0].beforeAfterPhoto).toBeUndefined();
    expect(parseTestimonials([{ ...good, beforeAfterPhoto: '/testimonials/../secret.png', photoConsent: true }])[0].beforeAfterPhoto).toBeUndefined();
    const ok = parseTestimonials([{ ...good, beforeAfterPhoto: photo, photoConsent: true }])[0];
    expect(ok.beforeAfterPhoto?.src).toBe(photo);
    expect(ok.beforeAfterPhoto?.alt).toMatch(/Sam/);
  });

  it('names the entries it would drop, so a typo in the data file is noticed', () => {
    expect(rejectedTestimonials([good, { ...good, consent: false }, 'x'])).toEqual([1, 2]);
  });
});

describe('the shipped data file', () => {
  it('is a list, with no entry the validator would drop (nothing half-finished or unconsented)', () => {
    expect(Array.isArray(TESTIMONIALS_RAW)).toBe(true);
    expect(rejectedTestimonials(TESTIMONIALS_RAW)).toEqual([]);
  });
});

describe('Testimonials renders nothing when there is nothing to show', () => {
  it('TestimonialsView with no entries is an empty string: no heading, no wrapper, no spacing', () => {
    expect(renderToStaticMarkup(createElement(TestimonialsView, { entries: [], className: 'mt-20' }))).toBe('');
  });

  it('Testimonials (flag off, which is the default before /api/features answers) is an empty string', () => {
    // True for an empty data file (it returns before the flag hook is mounted) and for a
    // populated one (the hook's server snapshot is off), so this holds whatever the owner adds.
    expect(renderToStaticMarkup(createElement(Testimonials))).toBe('');
  });

  it('an empty data file means the component never mounts the flag hook', () => {
    if (TESTIMONIALS.length === 0) {
      expect(Testimonials({})).toBeNull();
    }
  });
});

describe('TestimonialsView with entries', () => {
  const entries: Testimonial[] = [
    { quote: 'First quote.', firstName: 'Sam', howLongTheyBit: 'about ten years' },
    {
      quote: 'Second quote.',
      firstName: 'Alex',
      howLongTheyBit: 'since childhood',
      beforeAfterPhoto: { src: '/testimonials/alex.webp', alt: 'Before and after photo of Alex\'s nails, shared with their permission' },
    },
  ];
  const html = renderToStaticMarkup(createElement(TestimonialsView, { entries }));

  it('prints the heading, each quote, first name and detail line', () => {
    expect(html).toContain(TESTIMONIALS_HEADING);
    for (const t of entries) {
      expect(html).toContain(t.quote);
      expect(html).toContain(t.firstName);
      expect(html).toContain(testimonialDetail(t));
    }
  });

  it('prints an image only for the entry that has a consented photo', () => {
    expect(html.match(/<img /g)).toHaveLength(1);
    expect(html).toContain('/testimonials/alex.webp');
  });

  it('adds no star rating or review markup', () => {
    expect(html).not.toMatch(/itemprop|aggregateRating|ratingValue|★|stars?\b/i);
  });
});
