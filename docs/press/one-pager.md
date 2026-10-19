# Stop Biting: press one-pager

Fact sheet for a writer or editor who asks "what is this and what can I safely say?".
Nothing here is sent anywhere by itself: the owner decides who gets it (see
`docs/off-site-kit/outreach-templates.md` section B for the honest-pitch rules).
Every fact below was read in the repo on 2026-10-19; the source column says where, so a
figure can be re-checked before it is used.

## In one paragraph

Stop Biting is a web app that watches through a laptop or desktop webcam and sounds an
alarm the moment a hand reaches the mouth, so a person catches the nail biting they would
otherwise never notice. It was built by Igor Gazivoda, a developer who bit his nails for
over 20 years. It detects nail biting only, and only in front of a webcam. It is not a
medical treatment.

## Fast facts

| | | Where it is stated |
|---|---|---|
| Product | Web app at https://stopbiting.today (no desktop or phone app) | Landing page, "How it works" |
| Needs | A computer with a webcam and a modern browser | Landing page note "Made for a laptop or desktop with a webcam" |
| How it detects | Google MediaPipe Hand Landmarker, 21 hand landmarks, runs in the browser (WebAssembly); checks five times a second, needs three consecutive frames, alarm about 0.6 seconds after the hand approaches the mouth | /how-it-works |
| Privacy | Detection runs on the device and no camera data is sent while it runs. Sign-in is with Google and the site uses Google Analytics, so do not write "no data is collected" | Landing page, /privacy |
| Price | 3 days free, no card, then $2.99/month or $29/year | Landing page offer line, /pricing |
| Refunds | A full refund can be requested within 14 days of the first payment | /refund-policy |
| Founder | Igor Gazivoda, developer, bit his nails for over 20 years | /about |
| Contact | hello@stopbiting.today | Refund policy, contact form |

## Three angles, with figures a writer can quote

Each figure is one the site already cites, with its source and its limits on the linked page.

1. **"Most biters never notice it happening."** Habit reversal training, the best-studied
   approach, starts with awareness, and the app automates that one step.
   Page: https://stopbiting.today/blog/habit-reversal-training-guide
2. **"How common is it, really?"** Reviews estimate 20-30% of adults (Halteh, Scher &
   Lipner, 2017) and up to 45% of children aged 10 to puberty (Lee & Lipner, 2022) bite
   their nails; a community sample of schoolchildren gave 22.3% (Ghanizadeh & Shekoohi,
   2011). The samples differ, so the figures are not directly comparable.
   Page: https://stopbiting.today/blog/nail-biting-statistics
3. **"What does the evidence say about the usual remedies?"** For example, a six-week trial
   of 80 nail biters found a 26% drop-out rate with bitter polish against 12% for a wristband.
   Page: https://stopbiting.today/blog/bitter-nail-polish-review

## Please do not write

- That the app is a treatment, cure or clinically proven. We know of no trial of the app.
- That it works on phones or tablets, or as a desktop download. It is a web app for a
  computer webcam.
- That it detects other habits. It detects nail biting.
- "No data leaves your device" or "zero data". The accurate line is: no camera data is sent
  while it runs.
- The 1980 habit reversal result ("about 99% down") without its limits: it was
  self-recorded, over five months, against negative practice, and is quoted second-hand from
  a 2022 review. The statistics page explains this.

## Assets

- Real screenshots of the app with example data: `public/shots/` (the Watch and History
  screens; the metadata files record that they are real captures, labelled as example data).
- Social cards: `public/og/site.png` and one per article under `public/og/`.
- A writer who wants to try it can use the free trial; do not offer payment or incentives
  in exchange for coverage (see outreach-templates section D).
