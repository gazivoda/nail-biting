# Welcome Email, Admin Notification & Contact Form

**Date:** 2026-04-17  
**Status:** Approved

## Overview

Three additions to the nail-habit-app:

1. A branded welcome email sent to new users on first login
2. An admin notification email sent to gazivodai61@gmail.com on every new signup
3. A contact form added to the landing page

---

## Architecture

### Email Service

All transactional emails use **Resend** (resend.com) via the official Node SDK.

New env var required: `RESEND_API_KEY`

Sender address: `onboarding@resend.dev` for development. Production requires a verified domain configured in the Resend dashboard.

### Contact Form

Uses **Formspree** (formspree.io) — no backend code required. A new Formspree form must be created for this project (separate from stepto's `mbjwbbpv` form ID). The form ID is hardcoded in the component as a constant.

---

## New Files

### `email.js` (project root, alongside `server.js`)

Email helper module with two exported functions:

**`sendWelcomeEmail(user)`**
- `user`: `{ name, email, trial_end_date }`
- Sends HTML welcome email to `user.email`
- Non-throwing: logs errors but does not re-throw (email failure must not break signup)

**`sendAdminNotification(user)`**
- `user`: `{ name, email, created_at, trial_end_date }`
- Sends plain-text notification to `gazivodai61@gmail.com`
- Non-throwing: same error handling policy

### `src/components/ContactForm.tsx`

React component ported from `/Users/igorgazivoda/stepto-website/src/components/Contact/index.tsx`.

Fields:
- Full Name (text, required)
- Email (email, required)
- Message (textarea, required)

POSTs to `https://formspree.io/f/<NAIL_APP_FORM_ID>` via fetch.

Styling: nail-habit-app brand (cream background, forest green focus rings and submit button, `rounded-xl` cards, `shadow-card`). Hidden field `_subject` set to `"Contact from Stop Biting Nails"` to distinguish from stepto submissions in the Formspree dashboard.

---

## Backend Changes (`server.js`)

In the `/api/auth/callback` handler, after the existing `INSERT INTO users` statement for new users, add two non-blocking email calls:

```js
// Fire-and-forget — do not await, do not let failures surface to the user
sendWelcomeEmail(user).catch(err => console.error('Welcome email failed:', err));
sendAdminNotification(user).catch(err => console.error('Admin notification failed:', err));
```

No changes to the existing auth flow, JWT issuance, or cookie logic.

---

## Frontend Changes (`src/pages/Landing.tsx`)

Add `<ContactForm />` as a new section above the footer. No other landing page sections are modified.

---

## Email Templates

### Welcome Email

- **Subject:** `Welcome to Stop Biting Nails, [name]!`
- **Format:** HTML (inline styles for email client compatibility)
- **Structure:**
  - Header: logo text "stop biting NAILS" on cream (`#F7F3EE`) background, forest green (`#1D5C38`) accent
  - Body: greeting, 2–3 sentence app description (AI detection, real-time alerts, streak tracking), trial end date
  - CTA button: "Open the App" → `https://stopbitingnails.com` (forest green background, white text)
  - Footer: plain text, no unsubscribe link (transactional)

### Admin Notification

- **Subject:** `New signup: [name]`
- **Format:** Plain text
- **Fields included:** name, email, trial end date, signup timestamp (UTC)

---

## Dependencies

```
npm install resend
```

No new frontend dependencies. Formspree is a hosted service with no SDK.

---

## Out of Scope

- Email for trial expiration warnings
- Subscription confirmation emails (handled by Paddle)
- Payment failure emails
- Unsubscribe / email preferences management
