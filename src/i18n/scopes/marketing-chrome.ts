// Scope "marketing-chrome" (WS12b): the text every marketing page shares: the header, the footer, the closing call to
// action, the trial button, the language switcher, and the two pricing cards (the home page and /pricing both draw
// them). Imported by the main bundle, so it is kept to what those components say.
//
// Placeholders written in the bag (src/i18n/marketing/bag.ts) are filled in by useSiteT(); English prints its
// prices as literals and spells the trial length with {trialHyphen}, {trialDaysText}, {trialWordsCap}, which is
// what the page always did. The other languages use {trialDays, plural, ...} and {pMonthly} and friends.
import { createScope } from '../scope.ts';

export const messages = {
  // ── Header ──
  'nav.label': 'Site navigation',
  'nav.skip': 'Skip to content',
  'nav.how': 'How to start',
  'nav.science': 'Science',
  'nav.privacy': 'Privacy',
  'nav.pricing': 'Pricing',
  'nav.faq': 'FAQ',
  'nav.blog': 'Blog',
  'nav.signin': 'Sign in',

  // ── Breadcrumb (every inner page) ──
  'bc.label': 'Breadcrumb',
  'bc.home': 'Home',

  // ── Trial button ──
  'trial.start': 'Start free trial',
  'trial.send': 'Send the link to my computer',
  'trial.email': 'Email me the link for my computer',
  'trial.mailSubject': 'Stop Biting, for my computer',
  'trial.mailBody': 'Open this on my laptop or desktop: https://stopbiting.today',
  'trial.shareText': 'Open this on my laptop or desktop:',

  // ── The offer, beside every trial button ──
  'offer.line': '{trialDaysText} free, no card, then $2.99/month',

  // ── Closing call to action ──
  'cta.aria': 'Call to action',
  'cta.heading': 'Catch your next <hl>bite.</hl>',
  'cta.body': 'Leave it running through your next workday, then open History and see when you bite.',

  // ── The offer at the foot of an inner page (About, How it works) ──
  'bottom.heading': 'Try it free for {trialDaysText}.',
  'bottom.note': 'No card to start. Then $2.99 a month or $29 a year, cancel anytime.',

  // ── Footer ──
  'footer.about': 'An awareness alarm for nail biting (onychophagia), made by <link>Igor Gazivoda</link>. Detection runs in your browser. No camera data is sent while it runs.',
  'footer.nav': 'Footer navigation',
  'footer.home': 'Home',
  'footer.blog': 'Blog',
  'footer.pricing': 'Pricing',
  'footer.contact': 'Contact',
  'footer.editorial': 'Editorial Policy',
  'footer.privacy': 'Privacy Policy',
  'footer.terms': 'Terms of Service',
  'footer.refund': 'Refund Policy',
  'footer.tagline': 'Stop biting.',
  'footer.copy': '© {year} Stop Biting.',
  'footer.englishOnly': 'The blog and the legal pages are only available in English.',

  // ── Language switcher ──
  'lang.label': 'Language',

  // ── The sign-in methods, as a list ("Google, Apple or an emailed link") ──
  'signin.google': 'Google',
  'signin.apple': 'Apple',
  'signin.microsoft': 'Microsoft',
  'signin.magic': 'an emailed link',

  // ── What every plan includes (the same lines the in-app paywall shows) ──
  'plan.f1': 'Detection for as long as you run it',
  'plan.f2': 'Current and best streak',
  'plan.f3': 'Full history with trigger tags',
  'plan.f4': 'Sound, flash, or both',
  'plan.extra': 'Priority support',
  'plan.privacy': 'Detection runs on your device; no camera data leaves it',

  // ── The two pricing cards (home page and /pricing) ──
  'pricing.heading': '$2.99 a month, or <mark>$29 a year.</mark>',
  'pricing.lede': '{trialWordsCap} free first, and no card to start. You pick a plan when the trial ends.',
  'pricing.badge.save': 'Best value: save 19%',
  'pricing.badge.localized': 'Best value',
  'pricing.yearly': 'Yearly',
  'pricing.perYear': '/ year',
  'pricing.yearly.eq': '$2.42/month, billed yearly',
  'pricing.yearly.billed': 'Billed yearly',
  'pricing.monthly': 'Monthly',
  'pricing.perMonth': '/ month',
  'pricing.monthly.billed': 'Billed monthly',
  'pricing.monthly.short': 'Everything in Yearly except priority support.',
  'pricing.localizedNote': 'These prices are shown in your local currency. The list prices are $2.99 a month and $29 a year.',
  'pricing.payments': 'Payments go through Paddle. Cancel anytime in Settings. You can ask for a full refund within 14 days of your first payment: see the <link>refund policy</link>.',
} satisfies Record<string, string>;

export const { t, useT } = createScope('marketing-chrome', messages);
