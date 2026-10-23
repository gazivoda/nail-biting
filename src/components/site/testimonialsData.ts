// The testimonial data file, loaded and validated. Its own module (not Testimonials.tsx)
// because a component file may export only components (react-refresh), and because the
// test reads the raw list to check nothing in the file is being dropped.
import { parseTestimonials, type Testimonial } from './testimonialsModel';

// import.meta.glob rather than `import x from './x.json'`: tsconfig.app.json does
// not enable resolveJsonModule, and that file is shared by every workstream.
export const TESTIMONIALS_RAW: unknown = Object.values(
  import.meta.glob('../../data/testimonials.json', { eager: true, import: 'default' }),
)[0];

/** The entries that are complete and consented to. Empty while the data file is empty. */
export const TESTIMONIALS: Testimonial[] = parseTestimonials(TESTIMONIALS_RAW);
