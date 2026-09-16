import { useState } from 'react';

const FORMSPREE_ENDPOINT = `https://formspree.io/f/${import.meta.env.VITE_FORMSPREE_FORM_ID}`;

interface FormState {
  fullName: string;
  email: string;
  message: string;
}

// Typeset in the editorial system the rest of the homepage uses (see the
// `/* ── Editorial system ── */` block in index.css): heading in the display
// serif, intro as a lede, field labels in mono as apparatus, and hairlines
// rather than a rounded card with a shadow bounding the whole thing.
//
// A form is the one place on this page that still needs real affordances, so
// the inputs keep a visible field boundary, a white ground against the cream
// page, and the forest focus ring. Labels stay tied to their inputs, `required`
// still drives native validation, and the live region is unchanged.
//
// `ed-page` is on the section so `--ed-hairline` resolves (and the editorial
// focus ring applies) wherever this component is mounted, not only inside
// Landing's `.ed-page` root.
const FIELD_CLASS =
  'w-full rounded-lg border border-hairline bg-white px-4 py-2.5 text-sm text-stone-800 ' +
  'placeholder:text-stone-500 transition focus:outline-none focus:ring-2 focus:ring-forest-500';

export function ContactForm() {
  const [form, setForm] = useState<FormState>({ fullName: '', email: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: 'Contact from Stop Biting Nails',
          fromName: form.fullName,
          email: form.email,
          body: form.message,
        }),
      });
      setStatus(res.ok ? 'success' : 'error');
      if (res.ok) setForm({ fullName: '', email: '', message: '' });
    } catch {
      setStatus('error');
    }
  }

  return (
    <section aria-labelledby="contact-heading" className="ed-page reveal">
      <div className="mx-auto max-w-2xl border-t border-hairline pt-10">
        <h2 id="contact-heading" className="ed-h2 text-stone-800">
          Get in touch
        </h2>
        <p className="ed-lede ed-measure mt-5 text-stone-600">
          Have a question or feedback? We'd love to hear from you.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-9 flex flex-col gap-7 border-y border-hairline py-9"
        >
          <div className="flex flex-col gap-2.5">
            <label htmlFor="contact-name" className="ed-mono text-stone-500">
              Your Name
            </label>
            <input
              id="contact-name"
              type="text"
              required
              autoComplete="name"
              value={form.fullName}
              onChange={e => { if (status === 'error') setStatus('idle'); setForm(f => ({ ...f, fullName: e.target.value })); }}
              placeholder="Jane Smith"
              className={FIELD_CLASS}
            />
          </div>
          <div className="flex flex-col gap-2.5">
            <label htmlFor="contact-email" className="ed-mono text-stone-500">
              Your Email
            </label>
            <input
              id="contact-email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={e => { if (status === 'error') setStatus('idle'); setForm(f => ({ ...f, email: e.target.value })); }}
              placeholder="jane@example.com"
              className={FIELD_CLASS}
            />
          </div>
          <div className="flex flex-col gap-2.5">
            <label htmlFor="contact-message" className="ed-mono text-stone-500">
              Your Message
            </label>
            <textarea
              id="contact-message"
              required
              rows={5}
              autoComplete="off"
              value={form.message}
              onChange={e => { if (status === 'error') setStatus('idle'); setForm(f => ({ ...f, message: e.target.value })); }}
              placeholder="Tell us what's on your mind..."
              className={`${FIELD_CLASS} resize-none`}
            />
          </div>
          <div aria-live="polite" aria-atomic="true" className="min-h-[1.5rem]">
            {status === 'success' && (
              <p className="ed-body text-forest-600">
                Message sent! We'll get back to you soon.
              </p>
            )}
            {status === 'error' && (
              <p className="ed-body text-red-700">
                Something went wrong. Please try again or email us at hello@stopbiting.today.
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={status === 'sending'}
            className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-forest-600 px-6 py-3 text-sm font-semibold text-cream-100 transition-colors duration-150 hover:bg-forest-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'sending' ? 'Sending…' : 'Send Message'}
          </button>
        </form>
      </div>
    </section>
  );
}
