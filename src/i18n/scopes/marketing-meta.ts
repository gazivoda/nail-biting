// Scope "marketing-meta" (WS12b): the text that is NOT on the page itself: <title>, meta descriptions, the structured data
// (schema.org JSON-LD) and the branded 404 page of the localized marketing pages. Only the build script reads it
// (scripts/generate-locale-pages.mjs writes it, rendered, into dist/i18n/<locale>.json for the server), so the
// browser bundle never carries it. The English values here are the source of the translations' types; the
// English pages' own meta stays where it always was (server.js), and a test pins that the two say the same.
import { createScope } from '../scope.ts';

export const messages = {
  // ── /pricing ──
  'pricing.title': 'Pricing: $2.99/month or $29/year | Stop Biting',
  'pricing.description': 'Stop Biting pricing: {trialHyphen} free trial, no card required. Then $2.99/month or $29/year (about $2.42/month, save 19%). Cancel anytime.',
  'pricing.name': 'Stop Biting Pricing',
  'pricing.schemaDescription': 'Pricing for Stop Biting: {trialHyphen} free trial, then $2.99/month or $29/year.',
  'pricing.faqName': 'Stop Biting pricing questions',

  // ── /about ──
  'about.title': 'About Stop Biting | Built by Igor Gazivoda',
  'about.description': 'Stop Biting was built by Igor Gazivoda, a developer who bit his nails for 20 years. On-device AI detection that sends no camera data anywhere while it runs.',
  'about.name': 'About Stop Biting',
  'about.personDescription': 'Igor Gazivoda is the founder of Stop Biting, an on-device AI app for nail biting detection built with MediaPipe and WebAssembly.',

  // ── /how-it-works ──
  'how.title': 'How AI Nail Biting Detection Works | Stop Biting',
  'how.description': 'Stop Biting uses MediaPipe and WebAssembly to detect nail biting in real time, on your device. No camera data is sent while it runs.',
  'how.name': 'How AI nail biting detection works',
  'how.howtoName': 'How to Use Stop Biting for Nail Biting Detection',
  'how.howtoDescription': 'Set up real-time AI nail biting detection in under 2 minutes using your webcam.',

  // ── The product, as structured data (SoftwareApplication, on every localized page) ──
  'app.description': 'Web app that uses your webcam and on-device AI (MediaPipe) to detect nail biting (onychophagia) in real-time. Sounds an alarm the moment your hand nears your mouth. Includes streak tracking, incident logging, habit reversal training guidance, and 7-day bite history. No camera data is sent while it runs.',
  'app.os': 'Web browser (Mac or Windows)',
  'app.offer.trial.name': 'Free trial',
  'app.offer.trial.description': 'Full detection and tracking features during a {trialHyphen} free trial. No credit card required.',
  'app.offer.monthly.name': 'Monthly',
  'app.offer.monthly.description': 'Unlimited AI detection, streak tracking, full incident history and all alert types',
  'app.offer.yearly.name': 'Yearly',
  'app.offer.yearly.description': 'Everything in Monthly plus priority support — saves 19% versus billing monthly',
  'app.feature.1': 'Real-time nail biting detection via webcam AI',
  'app.feature.2': 'On-device detection: no camera data is sent while it runs',
  'app.feature.3': 'Sound and visual alerts when nail biting detected',
  'app.feature.4': 'Streak tracking and all-time best record',
  'app.feature.5': 'Incident log with trigger tagging (stress, focus, boredom)',
  'app.feature.6': '7-day bite frequency chart',
  'app.feature.7': 'Habit reversal training (HRT) guidance built in',
  'app.feature.8': 'Works as PWA — install directly from browser, no app store needed',
  'app.feature.9': 'Free 60-second live demo — try detection in the browser, no signup',
  'image.caption': 'The Stop Biting Watch screen, shown with example data.',

  // ── The noscript site navigation: the pages that exist in this language ──
  'nav.home': 'Stop Biting: AI nail biting detection',
  'nav.how': 'How AI nail biting detection works',
  'nav.pricing': 'Pricing: free trial, $2.99/month or $29/year',
  'nav.about': 'About Stop Biting',

  // ── The branded 404 page ──
  'notfound.title': 'Page not found | Stop Biting',
  'notfound.h1': "This page doesn't exist.",
  'notfound.p': 'The link may be broken or the page may have moved. The app, the guides and everything else are where they were.',
  'notfound.home': 'Go to the homepage',
  'notfound.blog': 'Read the guides',
} satisfies Record<string, string>;

export const { t, useT } = createScope('marketing-meta', messages);
