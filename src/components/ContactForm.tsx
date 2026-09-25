import { useState } from 'react';

const FORMSPREE_ENDPOINT = `https://formspree.io/f/${import.meta.env.VITE_FORMSPREE_FORM_ID}`;

interface FormState {
  fullName: string;
  email: string;
  message: string;
}

// Set in the homepage's sign system (`.sg-*` in index.css; the section sits
// inside Landing's `.sg-page`). A form is the one place on the page that needs
// real affordances, so fields keep a visible boundary on a white ground and a
// blue focus ring. No `.reveal`: the homepage runs no reveal hook, and an
// unrevealed section stays invisible. The submit is ink-outlined so the blue
// fill stays reserved for the trial.
const FIELD_CLASS =
  'w-full rounded-xl border border-[color:var(--sg-rule)] bg-white px-4 py-3 text-[1.0625rem] ' +
  'text-[color:var(--sg-ink)] placeholder:text-[color:oklch(54%_0.012_255)] transition ' +
  'focus:border-[color:var(--sg-accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--sg-accent)]/30';

const LABEL_CLASS = 'text-[0.9375rem] font-bold';

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
    <section aria-labelledby="contact-heading" className="grid gap-10 border-t border-[color:var(--sg-rule)] pt-16 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <h2 id="contact-heading" className="sg-h2">
          Get in touch
        </h2>
        <p className="sg-body mt-4">
          Questions, bugs, a false alarm that annoyed you: this goes straight to my inbox.
        </p>
      </div>

      <div className="lg:col-span-8">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-6"
        >
          <div className="flex flex-col gap-2.5">
            <label htmlFor="contact-name" className={LABEL_CLASS}>
              Name
            </label>
            <input
              id="contact-name"
              type="text"
              required
              autoComplete="name"
              value={form.fullName}
              onChange={e => { if (status === 'error') setStatus('idle'); setForm(f => ({ ...f, fullName: e.target.value })); }}
              placeholder="Your name"
              className={FIELD_CLASS}
            />
          </div>
          <div className="flex flex-col gap-2.5">
            <label htmlFor="contact-email" className={LABEL_CLASS}>
              Email
            </label>
            <input
              id="contact-email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={e => { if (status === 'error') setStatus('idle'); setForm(f => ({ ...f, email: e.target.value })); }}
              placeholder="you@example.com"
              className={FIELD_CLASS}
            />
          </div>
          <div className="flex flex-col gap-2.5">
            <label htmlFor="contact-message" className={LABEL_CLASS}>
              Message
            </label>
            <textarea
              id="contact-message"
              required
              rows={5}
              autoComplete="off"
              value={form.message}
              onChange={e => { if (status === 'error') setStatus('idle'); setForm(f => ({ ...f, message: e.target.value })); }}
              placeholder="What happened?"
              className={`${FIELD_CLASS} resize-none`}
            />
          </div>
          <div aria-live="polite" aria-atomic="true" className="empty:-mt-6">
            {status === 'success' && (
              <p className="sg-body font-semibold text-[color:var(--sg-green)]">
                Sent. I'll get back to you soon.
              </p>
            )}
            {status === 'error' && (
              <p className="sg-body font-semibold text-red-700">
                Something went wrong. Please try again or email us at hello@stopbiting.today.
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={status === 'sending'}
            className="sg-btn sg-btn-ink self-start disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'sending' ? 'Sending…' : 'Send message'}
          </button>
        </form>
      </div>
    </section>
  );
}
