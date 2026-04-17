import { useState } from 'react';

const FORMSPREE_ENDPOINT = `https://formspree.io/f/${import.meta.env.VITE_FORMSPREE_FORM_ID}`;

interface FormState {
  fullName: string;
  email: string;
  message: string;
}

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
    <section aria-labelledby="contact-heading" className="reveal">
      <div className="max-w-2xl mx-auto">
        <h2
          id="contact-heading"
          className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight text-center mb-2"
        >
          Get in touch
        </h2>
        <p className="text-stone-500 dark:text-stone-400 text-sm text-center mb-8">
          Have a question or feedback? We'd love to hear from you.
        </p>
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-2xl p-8 shadow-card flex flex-col gap-5"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="contact-name" className="text-sm font-medium text-stone-700 dark:text-stone-300">
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
              className="rounded-xl border border-stone-200 dark:border-ink-400 bg-cream-100 dark:bg-ink-100 px-4 py-2.5 text-sm text-stone-800 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-forest-500 transition"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="contact-email" className="text-sm font-medium text-stone-700 dark:text-stone-300">
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
              className="rounded-xl border border-stone-200 dark:border-ink-400 bg-cream-100 dark:bg-ink-100 px-4 py-2.5 text-sm text-stone-800 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-forest-500 transition"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="contact-message" className="text-sm font-medium text-stone-700 dark:text-stone-300">
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
              className="rounded-xl border border-stone-200 dark:border-ink-400 bg-cream-100 dark:bg-ink-100 px-4 py-2.5 text-sm text-stone-800 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-forest-500 transition resize-none"
            />
          </div>
          <div aria-live="polite" aria-atomic="true" className="min-h-[1.5rem]">
            {status === 'success' && (
              <p className="text-forest-600 dark:text-forest-400 text-sm text-center">
                Message sent! We'll get back to you soon.
              </p>
            )}
            {status === 'error' && (
              <p className="text-red-600 dark:text-red-400 text-sm text-center">
                Something went wrong. Please try again or email us at hello@stopbiting.today.
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={status === 'sending'}
            className="inline-flex justify-center items-center gap-2 bg-forest-600 hover:bg-forest-500 disabled:opacity-50 disabled:cursor-not-allowed text-cream-100 font-semibold rounded-2xl px-8 py-3 text-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
          >
            {status === 'sending' ? 'Sending…' : 'Send Message'}
          </button>
        </form>
      </div>
    </section>
  );
}
