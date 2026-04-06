# Stop Biting — Product Brief

## What It Is

Stop Biting (stopbiting.today) is an app that uses real-time, on-device AI to detect nail biting the moment it happens and immediately sound an audible alarm. It automates the two hardest parts of Habit Reversal Training (HRT) — awareness and sensory interruption — by catching the exact moment fingers approach the mouth and firing an alert before the bite completes.

---

## Who It's For

Adults with onychophagia (chronic nail biting), a body-focused repetitive behaviour affecting 20–30% of adults. Best suited to:

- People who bite during screen-based work (coding, video calls, reading) where a webcam can observe continuously and the habit is most automatic
- Those who've tried and failed with passive methods (bitter nail polish, willpower, gloves)
- People who want a private, self-directed alternative to therapist-assisted HRT

---

## How It Works

The user opens the app, enables their webcam, and the AI starts watching. When it detects fingers approaching the mouth, it plays a jarring alarm — interrupting the habit at the neurological moment the automatic chain can be broken. Over time, this builds conscious awareness and weakens the habit loop.

**Technically:**
- Google MediaPipe hand (21 keypoints) and face (468 landmarks) models run in WebAssembly at 30+ fps
- When hand landmarks enter defined proximity of mouth landmarks, detection fires
- Zero camera data leaves the device — fully verifiable by monitoring network traffic
- Works completely offline after initial setup

---

## Platforms

| Platform | Status |
|---|---|
| Mac (Apple Silicon) | Available — DMG download |
| Mac (Intel) | Available — separate DMG |
| Windows | Coming soon |
| Web browser | Available — same app, Google sign-in |

---

## Pricing

| Tier | Price |
|---|---|
| Free trial | 7 days, no card required |
| Monthly | €2.99 / month |
| Yearly | €29.00 / year (~€2.42/mo, saves 19%) |

All paid plans include unlimited AI detection, streak tracking, full incident history, and all alert types. Trial expires → paywall → subscribe to continue.

---

## Key Features

1. **Real-time AI detection** — catches hand-to-mouth movement at the moment it occurs
2. **100% on-device** — no camera frames transmitted anywhere, works offline
3. **Audible alarm** — fires at the exact detection moment
4. **Streak tracker** — current streak + all-time best; losing the streak is the motivational hook
5. **Incident log with tags** — tag each detected bite by trigger (stress, focus, boredom) to surface patterns
6. **7-day frequency chart** — visual bite history, colour-coded by severity
7. **Camera toggle and panic button** — visible controls alongside the live camera view
8. **Google sign-in** — one-click auth, no passwords
9. **PayPal subscriptions** — server-side verified before access is granted (no client-side bypass)
10. **SEO blog** — 10 long-form articles on the psychology, neuroscience, and treatment of nail biting

---

## Tech Stack

- **Frontend:** React 19 + TypeScript + Tailwind CSS + Zustand + Recharts
- **AI:** Google MediaPipe (WebAssembly, bundled locally)
- **Desktop:** Electron 41, electron-builder (DMG for Mac, NSIS for Windows)
- **Backend:** Node.js + Express 5 + SQLite (better-sqlite3)
- **Auth:** Google OAuth → HttpOnly session cookie (web) / Bearer token via deep-link (Electron)
- **Payments:** PayPal Subscriptions (@paypal/react-paypal-js), server-side verified
- **Hosting:** Coolify (Nixpacks, self-hosted VPS)
- **Domain:** stopbiting.today

---

## Brand Pillars

1. **Privacy** — on-device, zero bytes sent, independently verifiable
2. **Science** — grounded in HRT clinical literature and DSM-5 BFRB classification
3. **Simplicity** — detection starts in under 10 seconds, nothing extraneous in the UI
