# Welcome Email, Admin Notification & Contact Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a branded welcome email to new users, an admin signup notification, and a contact form on the landing page.

**Architecture:** Resend SDK handles all transactional emails (welcome + admin notification), triggered server-side in the auth callback when a new user is created. The contact form is a React component that POSTs directly to Formspree — no backend required.

**Tech Stack:** Node.js/Express (server.js), React + TypeScript + Tailwind (frontend), Resend Node SDK, Formspree (hosted form service)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `email.js` | Create | Resend email helper — `sendWelcomeEmail`, `sendAdminNotification` |
| `server.js` | Modify | Import email.js, add `isNewUser` flag, fire emails after `saveUser` |
| `src/components/ContactForm.tsx` | Create | Contact form UI, posts to Formspree |
| `src/pages/Landing.tsx` | Modify | Import and render `<ContactForm />` before footer |
| `.env` | Modify | Add `RESEND_API_KEY` and `FORMSPREE_FORM_ID` |
| `.env.example` | Modify | Document the two new env vars |

---

## Pre-requisites (manual, do before starting)

1. Create a [Resend](https://resend.com) account and generate an API key. Save it — you'll need it for `.env`.
2. Create a new form at [Formspree](https://formspree.io) for this project (separate from stepto). Copy the form ID (the part after `/f/` in the endpoint URL). Save it.

---

## Task 1: Install Resend and configure environment

**Files:**
- Modify: `.env`
- Modify: `.env.example`

- [ ] **Step 1: Install the Resend SDK**

```bash
npm install resend
```

Expected output: `added 1 package` (or similar). No errors.

- [ ] **Step 2: Add env vars to `.env`**

Open `.env` and append these two lines:

```
# Resend transactional email
RESEND_API_KEY=re_your_api_key_here

# Formspree contact form (create a form at formspree.io, paste the ID)
FORMSPREE_FORM_ID=your_form_id_here
```

- [ ] **Step 3: Document in `.env.example`**

Open `.env.example` and append:

```
# Resend transactional email (get key at resend.com)
RESEND_API_KEY=

# Formspree contact form ID (the part after /f/ in the formspree endpoint)
FORMSPREE_FORM_ID=
```

- [ ] **Step 4: Commit**

```bash
git add .env.example package.json package-lock.json
git commit -m "chore: install resend and document new env vars"
```

---

## Task 2: Create email helper module

**Files:**
- Create: `email.js`

- [ ] **Step 1: Create `email.js` at the project root**

```js
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Stop Biting Nails <onboarding@resend.dev>';
const ADMIN_EMAIL = 'gazivodai61@gmail.com';
const APP_URL = process.env.APP_URL || 'https://stopbiting.today';

export async function sendWelcomeEmail({ name, email, trial_end_date }) {
  const firstName = name ? name.split(' ')[0] : 'there';
  const trialEnd = new Date(trial_end_date).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Welcome to Stop Biting Nails, ${firstName}!`,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>Welcome to Stop Biting Nails</title>
</head>
<body style="margin:0;padding:0;background:#F7F3EE;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F3EE;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:32px 0 24px;text-align:center;">
              <span style="font-size:18px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">
                stop biting <span style="color:#1D5C38;letter-spacing:2px;text-transform:uppercase;font-size:16px;">NAILS</span>
              </span>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e5e1db;padding:40px 40px 32px;">
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">
                Welcome, ${firstName}!
              </h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#6b7280;">
                Your free trial has started. Here's what you get access to:
              </p>
              <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:2.2;color:#374151;">
                <li><strong>AI detection</strong> — real-time on-device nail biting detection via your webcam</li>
                <li><strong>Instant alerts</strong> — gentle reminders the moment a bite attempt is detected</li>
                <li><strong>Streak tracking</strong> — see your progress and build lasting habits</li>
              </ul>
              <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;">
                Your trial ends on <strong style="color:#374151;">${trialEnd}</strong>.
              </p>
              <div style="margin-top:32px;text-align:center;">
                <a href="${APP_URL}" style="display:inline-block;background:#1D5C38;color:#F7F3EE;font-weight:600;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:14px;">
                  Open the App
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0;text-align:center;font-size:12px;color:#9ca3af;">
              You're receiving this because you signed up for Stop Biting Nails.<br>
              <a href="https://stopbiting.today" style="color:#9ca3af;">stopbiting.today</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
}

export async function sendAdminNotification({ name, email, created_at, trial_end_date }) {
  const signedUpAt = new Date(created_at).toUTCString();
  const trialEnd = new Date(trial_end_date).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New signup: ${name}`,
    text: `New user signed up on Stop Biting Nails.\n\nName: ${name}\nEmail: ${email}\nSigned up: ${signedUpAt}\nTrial ends: ${trialEnd}`,
  });
}
```

> **Note:** The template uses JavaScript template literal interpolation — `${firstName}`, `${trialEnd}`, `${APP_URL}`. These resolve at call time, not in the HTML string itself.

- [ ] **Step 2: Verify the file is valid ESM (same module system as server.js)**

```bash
node --input-type=module <<'EOF'
import { createRequire } from 'module';
console.log('ESM import works');
EOF
```

Expected: `ESM import works`

- [ ] **Step 3: Commit**

```bash
git add email.js
git commit -m "feat: add Resend email helper with welcome and admin notification"
```

---

## Task 3: Hook emails into the auth callback

**Files:**
- Modify: `server.js` lines 1–13 (import) and ~279–297 (auth callback)

- [ ] **Step 1: Add import to `server.js`**

At the top of `server.js`, after the existing imports (after line 12), add:

```js
import { sendWelcomeEmail, sendAdminNotification } from './email.js';
```

- [ ] **Step 2: Add `isNewUser` flag and email calls in the auth callback**

Find this block in `server.js` (~line 279):

```js
    // Find or create user
    let user = getUser(googleId);
    if (!user) {
      const trialEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      user = {
        id: googleId,
        email: googlePayload.email,
        name: googlePayload.name,
        avatar: googlePayload.picture,
        trial_end_date: trialEnd,
        subscription_status: 'trial',
        subscription_plan: null,
        subscription_end_date: null,
        paddle_subscription_id: null,
        paddle_customer_id: null,
        created_at: new Date().toISOString(),
      };
    }
    saveUser(user);
```

Replace it with:

```js
    // Find or create user
    let user = getUser(googleId);
    const isNewUser = !user;
    if (!user) {
      const trialEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      user = {
        id: googleId,
        email: googlePayload.email,
        name: googlePayload.name,
        avatar: googlePayload.picture,
        trial_end_date: trialEnd,
        subscription_status: 'trial',
        subscription_plan: null,
        subscription_end_date: null,
        paddle_subscription_id: null,
        paddle_customer_id: null,
        created_at: new Date().toISOString(),
      };
    }
    saveUser(user);

    if (isNewUser) {
      sendWelcomeEmail(user).catch(err => console.error('[email] welcome failed:', err));
      sendAdminNotification(user).catch(err => console.error('[email] admin notification failed:', err));
    }
```

- [ ] **Step 3: Start the server and verify it boots without errors**

```bash
npm run dev
```

Expected: Server starts, no import errors. Check the terminal for any `Cannot find module './email.js'` or similar.

- [ ] **Step 4: Test with a real signup (or simulate)**

Sign in with a Google account that has **never** logged into the app before. Check:
- Terminal: no `[email]` error lines
- `gazivodai61@gmail.com` inbox: admin notification arrives
- Signed-in user's inbox: welcome email arrives

If `RESEND_API_KEY` is not yet configured, the calls will fail silently (`.catch` logs to console). That's expected — add the key first.

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "feat: send welcome and admin notification emails on new user signup"
```

---

## Task 4: Create the ContactForm component

**Files:**
- Create: `src/components/ContactForm.tsx`

- [ ] **Step 1: Create `src/components/ContactForm.tsx`**

```tsx
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
              value={form.fullName}
              onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
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
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
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
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="Tell us what's on your mind..."
              className="rounded-xl border border-stone-200 dark:border-ink-400 bg-cream-100 dark:bg-ink-100 px-4 py-2.5 text-sm text-stone-800 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-forest-500 transition resize-none"
            />
          </div>
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
          <button
            type="submit"
            disabled={status === 'sending'}
            className="inline-flex justify-center items-center gap-2 bg-forest-600 hover:bg-forest-500 disabled:opacity-50 text-cream-100 font-semibold rounded-2xl px-8 py-3 text-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
          >
            {status === 'sending' ? 'Sending…' : 'Send Message'}
          </button>
        </form>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add `VITE_FORMSPREE_FORM_ID` to `.env`**

The component reads `import.meta.env.VITE_FORMSPREE_FORM_ID` (Vite exposes env vars prefixed with `VITE_`). Update the `.env` entry added in Task 1 — rename `FORMSPREE_FORM_ID` to `VITE_FORMSPREE_FORM_ID`:

```
VITE_FORMSPREE_FORM_ID=your_form_id_here
```

Also update `.env.example`:

```
VITE_FORMSPREE_FORM_ID=
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ContactForm.tsx .env.example
git commit -m "feat: add ContactForm component with Formspree integration"
```

---

## Task 5: Add ContactForm to the Landing page

**Files:**
- Modify: `src/pages/Landing.tsx`

- [ ] **Step 1: Add the import at the top of `Landing.tsx`**

After the existing import on line 10 (`import { DetectionWave } from '../components/DetectionWave';`), add:

```tsx
import { ContactForm } from '../components/ContactForm';
```

- [ ] **Step 2: Add the `<ContactForm />` section before the closing `</div>` of `<main>`**

Find this block in `Landing.tsx` (~line 599):

```tsx
          </section>

        </div>
      </main>
```

Replace with:

```tsx
          </section>

          {/* ── CONTACT ───────────────────────────────────────────────────── */}
          <ContactForm />

        </div>
      </main>
```

- [ ] **Step 3: Run the dev server and verify visually**

```bash
npm run dev
```

Open `http://localhost:5173`. Scroll to the bottom of the landing page — you should see the "Get in touch" form above the footer, styled consistently with the rest of the page.

Check:
- Light and dark mode both look correct (toggle with the theme button in the nav)
- Form fields focus ring is forest green
- Submit button matches the CTA buttons elsewhere on the page

- [ ] **Step 4: Submit a test message**

Fill in the form and submit. Expected:
- Button shows "Sending…" briefly
- Success message appears: "Message sent! We'll get back to you soon."
- Formspree dashboard shows the submission
- Your Formspree-configured email receives the notification

- [ ] **Step 5: Commit**

```bash
git add src/pages/Landing.tsx
git commit -m "feat: add contact form section to landing page"
```

---

## Self-Review Notes

- **Trial duration:** The code uses a 3-day trial (`3 * 24 * 60 * 60 * 1000`), not 7 days. The welcome email copy says "free trial" without specifying duration to avoid mismatch if this changes.
- **RESEND_API_KEY not set:** Email calls fail silently (`.catch` logs to console) — signup still works.
- **VITE_FORMSPREE_FORM_ID not set:** `FORMSPREE_ENDPOINT` becomes `https://formspree.io/f/undefined`. The Formspree POST will return a 404. Set the env var before testing Task 4+5.
- **Resend sender domain:** `onboarding@resend.dev` works immediately for testing. For production, verify your domain in the Resend dashboard and update `FROM` in `email.js`.
