// Scope "plans": the few lines PlanExtras (lifetime and gift bands) and describeLength need. PlanExtras is also drawn on
// the marketing /pricing page, which is in the main bundle, so this scope is kept tiny: the big billing scope stays in
// the paywall's lazy chunk.
import { createScope } from '../scope.ts';

export const messages = {
  'extras.label': 'Other ways to buy',
  'plan.lifetime': 'Lifetime',
  'lifetime.badge': 'Best deal',
  'lifetime.once': 'once',
  'lifetime.priceAtCheckout': 'Price shown at checkout',
  'lifetime.band.body': 'Pay once instead of every month or year. It includes everything in the monthly plan, with no renewals, for as long as Stop Biting is offered. Start the free trial, then choose Lifetime in the app.',
  'lifetime.band.cta': 'Start free trial',
  'gift.title': 'Give it as a gift',
  'gift.body.length': 'Buy {length} of Stop Biting for someone else. We email you a link to pass on. They sign in, open it and redeem it once. The gift starts when no trial or subscription is covering them.',
  'gift.body.plain': 'Buy access of Stop Biting for someone else. We email you a link to pass on. They sign in, open it and redeem it once. The gift starts when no trial or subscription is covering them.',
  'gift.thanks': 'Thank you. The gift link is being emailed to the address you paid with. It can take a few minutes.',
  'gift.failed': 'Checkout could not load. If you use an ad blocker, allow paddle.com for this site and reload, or email hello@stopbiting.today.',
  'gift.buy': 'Buy a gift',
  'length.years': '{count, plural, one {one year} other {{count} years}}',
  'length.months': '{count, plural, one {one month} other {{count} months}}',
  'length.days': '{count, plural, one {one day} other {{count} days}}',
} satisfies Record<string, string>;

export const { t, useT } = createScope('plans', messages);
