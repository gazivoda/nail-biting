// Scope "billing": Paywall, trial banners, plan labels, free-tier notice, lifetime plate, referral card, redeem page.
// English is the source of truth. Add a key here, then the same key to
// src/i18n/locales/{es,de,pt-BR}/billing.ts (the compiler lists what is missing).
//
// Counts that sit inside a plural are written as {count}, not #, so the English reads exactly as it always did
// (1000 stays "1000", not "1,000").
import { createScope } from '../scope';

export const messages = {
  // ── Trial wording (src/utils/trial.ts): the paywall, dashboard banner, tab bar and settings share these ──

  // ── Plan labels (src/billing/planLabel.ts) ──
  'plan.lifetime': 'Lifetime',
  'plan.lifetime.detail': 'One payment, no renewals.',
  'plan.gift': 'Gift',
  'plan.gift.until': 'Access until {date}',
  'plan.referral': 'Referral credit',
  'plan.referral.until': 'Bonus access until {date}',
  'plan.free.badge': 'Free plan',
  'plan.free': 'Free',
  'plan.free.detail': '{minutes, plural, one {{minutes} minute} other {{minutes} minutes}} of detection a day and the last {days, plural, one {{days} day} other {{days} days}} of history.',

  // A length of time, in the words shared/plans.js describeDays() uses ("one year", "3 months", "45 days").

  // What every plan includes: the same five lines as src/components/site/plans.ts (a test checks they match).
  'feature.detection': 'Detection for as long as you run it',
  'feature.streak': 'Current and best streak',
  'feature.history': 'Full history with trigger tags',
  'feature.alert': 'Sound, flash, or both',
  'feature.support': 'Priority support',

  // ── The in-app paywall (src/components/auth/PaywallPage.tsx) ──
  'paywall.checkoutUnavailable': "Checkout couldn't load. If you use an ad blocker, allow paddle.com for this site and reload, or email hello@stopbiting.today.",
  'paywall.received.title': 'Payment received',
  'paywall.received.body': 'Your subscription can take a few seconds to activate.',
  'openApp': 'Open the app',
  'paywall.backToApp': 'Back to app',
  'paywall.signOut': 'Sign out',
  'paywall.title.choose': 'Choose a <hl>plan</hl>',
  'paywall.title.keep': 'Keep the alarm <hl>running</hl>',
  'paywall.lede': '{monthly} a month, or {yearly} a year. No camera data is sent while it runs.',
  'paywall.trialLeft': '{left} in your free trial.',
  'paywall.unavailable.title': 'Subscriptions are unavailable right now',
  'paywall.unavailable.body': 'Please try again later, or email hello@stopbiting.today.',
  'paywall.activating': 'Activating your subscription…',
  'paywall.badge.localized': 'Best value',
  'paywall.badge.save': 'Best value: save 19%',
  'paywall.yearly': 'Yearly',
  'paywall.perYear': '/ year',
  'paywall.billedYearly': 'Billed yearly',
  'paywall.perMonthBilledYearly': '{price}/month, billed yearly',
  'paywall.subscribeYearly': 'Subscribe yearly',
  'paywall.monthly': 'Monthly',
  'paywall.perMonth': '/ month',
  'paywall.billedMonthly': 'Billed monthly',
  'paywall.subscribeMonthly': 'Subscribe monthly',
  'paywall.localCurrency': 'These prices are shown in your local currency. The list prices are {monthly} a month and {yearly} a year.',
  'paywall.giftBuy': 'Buy {length} as a gift for someone else',
  'paywall.giftBuyGeneric': 'Buy a gift for someone else',
  'paywall.secure': 'Secure payment via Paddle',
  'paywall.cancel': 'Cancel anytime in Settings',
  'paywall.noCamera': 'No camera data is sent while it runs',

  // ── Lifetime and gift (LifetimePlate on the paywall, PlanExtras on /pricing) ──
  'lifetime.once': 'once',
  'lifetime.priceAtCheckout': 'Price shown at checkout',
  'lifetime.plate.body': 'One payment, no renewals, for as long as Stop Biting is offered. See the <link>refund policy</link>.',
  'lifetime.buy': 'Buy lifetime',
  'gift.thanks': 'Thank you. The gift link is being emailed to the address you paid with. It can take a few minutes.',

  // ── Free plan line on the Dashboard (src/components/billing/FreeTierNotice.tsx) ──
  'freeTier.reached': "You have used today's {minutes, plural, one {{minutes} free minute} other {{minutes} free minutes}} of detection. It starts again tomorrow.",
  'freeTier.used': 'Free plan: {used} of {limit, plural, one {{limit} minute} other {{limit} minutes}} of detection used today.',
  'freeTier.choose': 'Choose a plan',

  // ── Refer a friend (src/components/billing/ReferralCard.tsx) ──
  'referral.title': 'Refer a friend',
  'referral.intro.days': 'When someone you refer pays for the first time, you both get {days} of bonus access. The days are saved and start by themselves when your trial or subscription is not covering you. If that payment is refunded, the days are taken back.',
  'referral.intro.plain': 'When someone you refer pays for the first time, you both get bonus access.',
  'referral.failed': 'Your link could not be loaded. Please try again later.',
  'referral.link': 'Your link',
  'referral.link.description': 'Anyone who signs up through it is counted for you.',
  'referral.link.aria': 'Your referral link',
  'referral.copy': 'Copy',
  'referral.copied': 'Copied',
  'referral.paid': '{count, plural, one {{count} person has} other {{count} people have}} paid through your link.',
  'referral.paid.earned': '{count, plural, one {{count} person has} other {{count} people have}} paid through your link, earning you {days}.',
  'referral.pending': '{count, plural, one {{count} is} other {{count} are}} signed up and have not paid yet.',

  // ── The gift page (src/pages/RedeemPage.tsx) ──
  'redeem.pageTitle': 'Redeem a gift | Stop Biting',
  'redeem.failure.invalid': 'That code is not valid. Check it and try again.',
  'redeem.failure.already_redeemed': 'This gift has already been redeemed.',
  'redeem.failure.expired': 'This gift link has expired. If you were sent it recently, email hello@stopbiting.today.',
  'redeem.failure.revoked': 'This gift is no longer valid. If you think that is a mistake, email hello@stopbiting.today.',
  'redeem.failure.busy': 'Too many tries. Please wait a few minutes and try again.',
  'redeem.failure.failed': 'Something went wrong. Please try again in a moment.',
  'redeem.done.title': 'Gift redeemed',
  'redeem.done.until': 'Your gift is active until {date}.',
  'redeem.done.saved': '{length} of Stop Biting are saved on your account. They start by themselves when your trial or subscription is not covering you.',
  'redeem.checking': 'Checking your account…',
  'redeem.signIn.title': 'Sign in to redeem your gift',
  'redeem.title': 'Redeem a gift',
  'redeem.signIn.withLink': 'Your gift link is kept on this device while you sign in. Sign in with your own account, or create one, and you will come back here.',
  'redeem.signIn.noLink': 'Open the gift link you were sent. If it does not open, sign in first and then type the code from the email.',
  'redeem.signIn.button': 'Sign in',
  'redeem.ready.withLink': 'Your gift link is ready. It works once, and the days are added to the account you are signed in with.',
  'redeem.ready.typeCode': 'Type the code from the gift email. It works once, and the days are added to the account you are signed in with.',
  'redeem.code.aria': 'Gift code',
  'redeem.code.placeholder': 'XXXXX-XXXXX-XXXXX-XXXXX',
  'redeem.redeeming': 'Redeeming…',
  'redeem.redeem': 'Redeem',
} satisfies Record<string, string>;

export const { t, useT } = createScope('billing', messages);
