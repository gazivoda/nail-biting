import { useFeature } from '../../features/useFeature';
import { TESTIMONIALS } from './testimonialsData';
import { TESTIMONIALS_HEADING, testimonialDetail, type Testimonial } from './testimonialsModel';

// Social proof for the homepage and /pricing: real quotes from real people, and
// nothing else. The data file ships as an EMPTY array, and while it is empty
// this renders nothing at all: no heading, no spacing, no network request.
// Never write an entry yourself; see src/data/README-testimonials.md for the
// owner's steps and the consent rules.
//
// Two gates, in this order:
//   1. data: TESTIMONIALS is empty        -> null, and the flag hook is never
//      mounted, so a visitor to a page that carries this component makes no
//      /api/features request while the feature is dark;
//   2. flag: `social_proof` is off        -> null (Gated, below).
// parseTestimonials() also drops any entry without `consent: true`.
//
// A page that adds this component must mirror it in the crawler copy that
// server.js injects (testimonialsArticleHtml), or a no-JS reader sees a
// different page. The heading and the detail line come from testimonialsModel
// so both sides read one string.

interface Layout {
  /** Spacing classes for the section. Applied only when the section renders. */
  className?: string;
  /** False inside a page that already wraps its content in .sg-container. */
  container?: boolean;
}

/** The section itself, from a list. Pure, so it is tested without a DOM. */
export function TestimonialsView({ entries, className = 'pb-16 lg:pb-20', container = true }: { entries: Testimonial[] } & Layout) {
  if (entries.length === 0) return null;
  return (
    <section aria-labelledby="testimonials-heading" className={className}>
      <div className={container ? 'sg-container' : undefined}>
        <h2 id="testimonials-heading" className="sg-h3">{TESTIMONIALS_HEADING}</h2>
        <ul className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {entries.map(t => (
            <li key={`${t.firstName}-${t.quote.slice(0, 24)}`}>
              <figure className="flex h-full flex-col gap-4 rounded-2xl border border-[color:var(--sg-rule)] bg-white p-6">
                {t.beforeAfterPhoto && (
                  <img
                    src={t.beforeAfterPhoto.src}
                    alt={t.beforeAfterPhoto.alt}
                    loading="lazy"
                    decoding="async"
                    className="h-auto w-full rounded-lg border border-[color:var(--sg-rule)]"
                  />
                )}
                <blockquote className="sg-body text-[color:var(--sg-ink)]">{t.quote}</blockquote>
                <figcaption className="mt-auto">
                  <span className="block font-bold">{t.firstName}</span>
                  <span className="sg-note block">{testimonialDetail(t)}</span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Gated(layout: Layout) {
  const on = useFeature('social_proof');
  return on ? <TestimonialsView entries={TESTIMONIALS} {...layout} /> : null;
}

/** Mount this on a page. Renders nothing until there is data AND the flag is on. */
export function Testimonials(layout: Layout = {}) {
  return TESTIMONIALS.length === 0 ? null : <Gated {...layout} />;
}
