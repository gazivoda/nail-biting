// Scope "marketing-pricing" (WS12b): the text of the /pricing page that is not in the two pricing cards (those are in
// marketing-chrome, because the home page draws them too). The four questions are mirrored word for word in the
// server's FAQPage JSON-LD and crawler copy (server.js PRICING_FAQS for English, dist/i18n/<locale>.json for the
// other languages), so edit a question here, in the locales and in those places together.
import { createScope } from '../scope.ts';

export const messages = {
  'bc.pricing': 'Pricing',

  'includes.heading': 'What every plan includes',
  'faq.heading': 'Pricing questions',

  'faq.1.q': 'How does the {trialHyphen} free trial work?',
  'faq.1.a': 'Every account starts with a {trialHyphen} free trial that includes full detection and tracking features, with no credit card required. When the trial ends, pick the monthly or yearly plan to keep going.',
  'faq.2.q': 'What is the difference between Monthly and Yearly?',
  'faq.2.a': 'Both plans include the same features: detection for as long as you run it, current and best streak, full history with trigger tags, and sound, flash, or both. Yearly is billed once at $29.00 (about $2.42/month, saving 19% versus $2.99/month billing) and adds priority support.',
  'faq.3.q': 'How do payments work?',
  'faq.3.a': 'Payments are handled by Paddle, a secure merchant of record. Stop Biting never sees or stores your card details.',
  'faq.4.q': 'Can I cancel anytime?',
  'faq.4.a': 'Yes. Cancel anytime from the app settings and you keep access until the end of the paid period. See the <link>refund policy</link> for details.',

  'cta.heading': 'Try it free for {trialDaysText}.',
  'cta.note': 'No card to start. Curious first? Read <how>how the detection works</how>, or <calc>work out what biting costs you</calc>.',
} satisfies Record<string, string>;

export const { t, useT } = createScope('marketing-pricing', messages);
