// Pseudo-locale coverage for billing and sign-in (scopes "billing" and "auth"): the in-app paywall, the plan labels,
// trial wording, free-plan notice, lifetime plate, lifetime/gift cards, referral card, the gift (redeem) page, the
// sign-in page and its provider buttons. Each state is rendered with the German catalog on and every t() result
// marked; no word may be left outside the marks. A second block checks the English is what it always was.
//
// A static render has no effects, no clicks and no DOM, so a state that only exists after one (Paddle loaded, the
// emailed link sent, a redeem refused) is rendered through the small view component that draws it: PaymentReceived,
// GiftButton, SentNotice, EmailForm, FinishCard, RedeemedCard, RedeemForm, FailureNote, ReferralView, GiftBandView.
// The page-level state that cannot be reached (the Paddle SDK arriving) is only the switch between those views.

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { usePseudoLocale, expectAllTranslated, expectNoMissingParams } from '../testing/pseudo';
import { resetLocaleForTests } from '../core';
import { useMemoryStorage, resetStorage } from '../../../test-utils/memoryStorage';
import { kv } from '../../storage/kv';
import { dayKey } from '../../billing/freeTier';
import { useAppStore } from '../../store/useAppStore';
import { describeDays } from '../../../shared/plans.js';
import { messages as billingEn } from '../scopes/billing';
import { messages as authEn } from '../scopes/auth';

// Everything the pages read at module load or through hooks that cannot run in a static render.
const h = vi.hoisted(() => {
  vi.stubEnv('VITE_PADDLE_CLIENT_TOKEN', 'test_token');
  vi.stubEnv('VITE_PADDLE_PRICE_ID_MONTHLY', 'pri_month');
  vi.stubEnv('VITE_PADDLE_PRICE_ID_YEARLY', 'pri_year');
  vi.stubEnv('VITE_PADDLE_PRICE_ID_LIFETIME', 'pri_life');
  vi.stubEnv('VITE_PADDLE_PRICE_ID_GIFT', 'pri_gift');
  return {
    flags: new Set<string>(),
    auth: { user: null as unknown, accessStatus: 'trial_active' as string },
    prices: {} as Record<string, { total: string; currency: string }>,
    giftDays: null as number | null,
    providers: { apple: false, microsoft: false, magic_link: false },
    ready: true,
  };
});

vi.mock('../../contexts/AuthContext', async importOriginal => ({
  ...(await importOriginal<typeof import('../../contexts/AuthContext')>()),
  useAuth: () => ({
    user: h.auth.user, accessStatus: h.auth.accessStatus, signingIn: false, signInWithGoogle: () => {},
    signOut: async () => {}, refreshProfile: async () => {}, authError: null, clearAuthError: () => {},
  }),
  apiFetch: async () => ({}),
}));
// useFeature reads the server snapshot in a static render, which is always "off"; these flags are the test's.
vi.mock('../../features/useFeature', () => ({
  useFeature: (name: string) => h.flags.has(name),
  useFeatures: () => Object.fromEntries([...h.flags].map(n => [n, true])),
}));
vi.mock('../../billing/prices', async importOriginal => ({
  ...(await importOriginal<typeof import('../../billing/prices')>()),
  useLocalizedPrices: (ids: string[]) => Object.fromEntries(ids.filter(id => h.prices[id]).map(id => [id, h.prices[id]])),
}));
vi.mock('../../billing/useGiftInfo', () => ({ useGiftDays: () => (h.flags.has('gift_plan') ? h.giftDays : null) }));
vi.mock('../../auth/useSignInProviders', () => ({
  useSignInProviders: () => ({ providers: h.providers, ready: h.ready }),
  useSignInHref: () => '/api/auth/google',
}));

import { PaywallPage, PaymentReceived, ActivatingNotice, CheckoutProblem, GiftThanks, GiftButton, PlansUnavailable } from '../../components/auth/PaywallPage';
import { LifetimePlate } from '../../components/billing/LifetimePlate';
import { FreeTierNotice } from '../../components/billing/FreeTierNotice';
import { PlanExtras, GiftBandView } from '../../components/billing/PlanExtras';
import { ReferralCard, ReferralView, type Summary } from '../../components/billing/ReferralCard';
import { RedeemPage, RedeemedCard, RedeemForm, FailureNote, type Failure } from '../../pages/RedeemPage';
import { SignInPage, FinishCard, SentNotice, EmailForm } from '../../pages/SignIn';
import { GoogleButton, AppleButton, MicrosoftButton } from '../../components/auth/ProviderButtons';
import { planOverride, describeLength, planFeature } from '../../billing/planLabel';
import { trialLeft, trialEndedMessage } from '../../utils/trial';
import { errorMessage, linkFailureMessage, sendFailureMessage, signInNotice, type SignInErrorCode, type LinkFailure, type SendFailure } from '../../auth/signInClient';
import { rememberGiftCode } from '../../billing/giftCode';
import { PLAN_FEATURES, YEARLY_EXTRA } from '../../components/site/plans';

export const COVERS = [
  'src/components/auth/PaywallPage.tsx',
  'src/components/auth/ProviderButtons.tsx',
  'src/components/billing/LifetimePlate.tsx',
  'src/components/billing/FreeTierNotice.tsx',
  'src/components/billing/PlanExtras.tsx',
  'src/components/billing/ReferralCard.tsx',
  'src/billing/planLabel.ts',
  'src/billing/planLength.ts', // describeLength, called through planLabel's re-export below
  'src/utils/trial.ts',
  'src/pages/RedeemPage.tsx',
  'src/pages/SignIn.tsx',
  'src/auth/signInClient.ts',
];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const user = (over: Record<string, unknown> = {}) => ({
  id: 'u1', email: 'a@b.c', name: 'A', avatar: null, trial_end_date: null, subscription_status: 'expired', subscription_plan: null,
  subscription_end_date: null, paddle_subscription_id: null, paddle_customer_id: null, ...over,
});
const html = (node: React.ReactElement) => renderToStaticMarkup(node);
const p = (text: string) => html(<p>{text}</p>);

beforeEach(() => {
  h.flags.clear();
  h.auth = { user: null, accessStatus: 'trial_active' };
  h.prices = {};
  h.giftDays = null;
  h.providers = { apple: false, microsoft: false, magic_link: false };
  h.ready = true;
});
afterAll(() => { vi.unstubAllEnvs(); });

function check(markup: string, allow: Array<string | RegExp> = []) {
  expectAllTranslated(markup, { allow });
  expectNoMissingParams(markup);
}

describe('paywall', () => {
  usePseudoLocale();

  it('after the trial: the ended line with nothing logged, one alert, many alerts', () => {
    h.auth.user = user();
    check(html(<PaywallPage />));
    for (const n of [1, 2, 1000]) {
      useAppStore.setState({ incidents: Array.from({ length: n }, (_, i) => ({ id: `i${i}`, timestamp: Date.now() - i * 1000, tag: 'stress', autoDetected: false })) });
      check(html(<PaywallPage />));
    }
    useAppStore.setState({ incidents: [] });
  });

  it('during the trial (opened from the app): back link, choose a plan, days left', () => {
    h.auth.user = user({ trial_end_date: iso(2.5 * DAY), subscription_status: 'trial' });
    const markup = html(<PaywallPage onBack={() => {}} />);
    check(markup);
    expect(markup).toContain('Noch 3 Tage'); // trial.left.days in German
  });

  it.each([[0.5 * HOUR], [1.5 * HOUR], [20 * HOUR], [DAY * 1.2]])('the countdown at %s ms left', ms => {
    h.auth.user = user({ trial_end_date: iso(ms), subscription_status: 'trial' });
    check(html(<PaywallPage onBack={() => {}} />));
  });

  it('with the prices Paddle reports for the visitor', () => {
    h.auth.user = user();
    h.prices = { pri_month: { total: '£2.49', currency: 'GBP' }, pri_year: { total: '£24.00', currency: 'GBP' } };
    const markup = html(<PaywallPage />);
    check(markup);
    expect(markup).toContain('£24.00');
    expect(markup).toContain('£2.49');
  });

  it('with the lifetime plate, with and without a price', () => {
    h.auth.user = user();
    h.flags.add('lifetime_plan');
    check(html(<PaywallPage />));
    h.prices = { pri_life: { total: '$79.00', currency: 'USD' } };
    check(html(<PaywallPage />));
    check(html(<LifetimePlate price="$79.00" disabled={false} onBuy={() => {}} />));
    check(html(<LifetimePlate disabled onBuy={() => {}} />));
  });

  it('the views a payment goes through', () => {
    check(html(<PaymentReceived onOpen={() => {}} />));
    check(html(<ActivatingNotice />));
    check(html(<CheckoutProblem />));
    check(html(<GiftThanks />));
    check(html(<PlansUnavailable />));
  });

  it('the gift button, with and without the length', () => {
    for (const days of [null, 365, 730, 30, 90, 45, 1]) check(html(<GiftButton days={days} onBuy={() => {}} />));
  });

  it('each plan line and the yearly extra go through the catalog', () => {
    for (const line of [...PLAN_FEATURES, YEARLY_EXTRA]) check(p(planFeature(line)));
  });
});

describe('trial wording, plan labels and lengths', () => {
  usePseudoLocale();
  const NOW = Date.now();
  const at = (ms: number) => new Date(NOW + ms).toISOString();

  it('trialLeft in days, hours and under an hour', () => {
    for (const ms of [72 * HOUR, 25 * HOUR, 24 * HOUR, 23.9 * HOUR, 5 * HOUR, 1.5 * HOUR, 20 * 60_000]) {
      const text = trialLeft(at(ms), NOW);
      expect(text).not.toBeNull();
      check(p(text as string));
    }
  });

  it('trialEndedMessage for nothing, one, two and a thousand alerts', () => {
    for (const n of [0, NaN, -3, 1, 2, 41, 1000]) check(p(trialEndedMessage(n)));
  });

  it('planOverride words lifetime, gift, referral credit and the free plan', () => {
    const base = user();
    const states = [
      { grants: [{ kind: 'lifetime', ends_at: null }] },
      { grants: [{ kind: 'gift', ends_at: '2027-10-23T12:00:00Z' }] },
      { grants: [{ kind: 'referral_credit', ends_at: '2027-10-23T12:00:00Z' }] },
      { free_tier: { detection_minutes_per_day: 30, history_days: 7 } },
      { free_tier: { detection_minutes_per_day: 1, history_days: 1 } },
    ];
    const NOW_FIXED = Date.parse('2026-10-23T12:00:00Z');
    for (const entitlement of states) {
      const o = planOverride({ ...base, entitlement } as never, NOW_FIXED);
      expect(o).not.toBeNull();
      check(html(<div><b>{o?.badge}</b><b>{o?.headline}</b><p>{o?.detail}</p></div>));
    }
  });

  it.each([1, 2, 7, 30, 60, 90, 365, 730, 45])('describeLength(%i days)', days => {
    check(p(describeLength(days)));
  });
});

describe('free plan notice', () => {
  usePseudoLocale();
  const free = (minutes: number) => ({ user: user({ entitlement: { free_tier: { detection_minutes_per_day: minutes, history_days: 7 } } }), accessStatus: 'free_tier' });

  it('shows the minutes used, and with the upgrade button', () => {
    h.auth = free(30);
    kv.set('billing', 'free-usage', { day: dayKey(new Date()), seconds: 600 });
    check(html(<FreeTierNotice />));
    check(html(<FreeTierNotice onUpgrade={() => {}} />));
  });

  it('says the allowance is used up', () => {
    h.auth = free(30);
    kv.set('billing', 'free-usage', { day: dayKey(new Date()), seconds: 30 * 60 });
    check(html(<FreeTierNotice onUpgrade={() => {}} />));
    h.auth = free(1);
    kv.set('billing', 'free-usage', { day: dayKey(new Date()), seconds: 60 });
    check(html(<FreeTierNotice />));
  });

  it('draws nothing outside the free plan', () => {
    h.auth = { user: user(), accessStatus: 'paywall' };
    expect(html(<FreeTierNotice />)).toBe('');
  });
});

describe('lifetime and gift cards (/pricing)', () => {
  usePseudoLocale();

  it('both cards, with and without prices and a gift length', () => {
    h.flags.add('lifetime_plan');
    h.flags.add('gift_plan');
    check(html(<PlanExtras />));
    h.prices = { pri_life: { total: '$79.00', currency: 'USD' }, pri_gift: { total: '$29.00', currency: 'USD' } };
    h.giftDays = 365;
    check(html(<PlanExtras />));
    h.giftDays = 30;
    check(html(<PlanExtras />));
  });

  it('the gift card in each state of the purchase', () => {
    for (const state of ['idle', 'opening', 'done', 'failed'] as const) {
      for (const days of [null, 365]) check(html(<GiftBandView price="$29.00" days={days} state={state} onBuy={() => {}} />));
    }
    check(html(<GiftBandView price={undefined} days={null} state="idle" onBuy={() => {}} />));
  });

  it('draws nothing with both flags off', () => {
    expect(html(<PlanExtras />)).toBe('');
  });
});

describe('referral card', () => {
  usePseudoLocale();
  const summary = (over: Partial<Summary> = {}): Summary => ({ code: 'abc', link: 'https://stopbiting.today/?ref=abc', credit_days: 30, pending: 0, rewarded: 0, credit_days_earned: 0, ...over });

  it('before the numbers arrive, and with the flag off', () => {
    h.auth.user = user();
    expect(html(<ReferralCard />)).toBe('');
    h.flags.add('referrals');
    check(html(<ReferralCard />));
  });

  it('the card for each state of the lookup', () => {
    check(html(<ReferralView summary={null} failed copied={false} onCopy={() => {}} />));
    check(html(<ReferralView summary={summary()} failed={false} copied onCopy={() => {}} />));
    for (const over of [
      { rewarded: 0 }, { rewarded: 1 }, { rewarded: 5, credit_days_earned: 30 }, { rewarded: 1, credit_days_earned: 365, pending: 1 },
      { rewarded: 2, credit_days_earned: 60, pending: 3 }, { credit_days: 365 }, { credit_days: 45, pending: 2 },
    ]) {
      check(html(<ReferralView summary={summary(over)} failed={false} copied={false} onCopy={() => {}} />));
    }
  });
});

describe('gift page', () => {
  usePseudoLocale();

  it('while the account is checked, signed out, and signed in', () => {
    h.auth.accessStatus = 'loading';
    check(html(<RedeemPage />));
    h.auth.accessStatus = 'no_auth';
    check(html(<RedeemPage />));
    rememberGiftCode('ABCDEFGHIJKLMNOPQRST');
    check(html(<RedeemPage />));
    h.auth = { user: user(), accessStatus: 'paywall' };
    check(html(<RedeemPage />));
  });

  it('signed in without a code in the link, typing one, and while redeeming', () => {
    const base = { typed: '', onType: () => {}, inputClass: '', onSubmit: () => {} };
    check(html(<RedeemForm {...base} hasLink={false} working={false} canSubmit={false} />));
    check(html(<RedeemForm {...base} hasLink={false} working canSubmit />));
    check(html(<RedeemForm {...base} hasLink working={false} canSubmit />));
  });

  it('after a redeem: until a date, or days saved', () => {
    check(html(<RedeemedCard days={365} endsAt="2027-10-23T12:00:00Z" />));
    for (const days of [1, 30, 365, 730, 45]) check(html(<RedeemedCard days={days} endsAt={null} />));
  });

  it('every way a redeem can be refused', () => {
    for (const failure of ['invalid', 'already_redeemed', 'expired', 'revoked', 'busy', 'failed'] as Failure[]) check(html(<FailureNote failure={failure} />));
  });
});

describe('sign-in page', () => {
  usePseudoLocale();
  // The page reads the address when it first renders (a failed provider redirect arrives as ?error=...&provider=...).
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: { search: '?error=email_unverified&provider=microsoft', hash: '', pathname: '/signin', origin: 'https://stopbiting.today' },
      history: { replaceState: () => {} },
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  const FIXTURE = [/^(dana|example|com)$/];

  it('with every provider and the emailed link, and with only Google while the answer is awaited', () => {
    h.providers = { apple: true, microsoft: true, magic_link: true };
    const markup = html(<SignInPage />);
    check(markup, FIXTURE);
    expect(markup).toContain('Mit Google anmelden');
    expect(markup).toContain('Mit Apple anmelden');
    expect(markup).toContain('Mit Microsoft anmelden');
    expect(markup).toContain('Microsoft'); // the unverified-email notice names the provider
    h.providers = { apple: false, microsoft: false, magic_link: false };
    h.ready = false;
    const waiting = html(<SignInPage />);
    check(waiting, FIXTURE);
    expect(waiting).not.toContain('Mit Apple anmelden');
  });

  it('each provider flag on its own', () => {
    for (const providers of [{ apple: true, microsoft: false, magic_link: false }, { apple: false, microsoft: true, magic_link: false }, { apple: false, microsoft: false, magic_link: true }]) {
      h.providers = providers;
      check(html(<SignInPage />), FIXTURE);
    }
  });

  it('the buttons carry each provider\'s own phrase and the product name unchanged', () => {
    check(html(<div><GoogleButton /><AppleButton /><MicrosoftButton /></div>));
  });

  it('the emailed link: finish card, before and while signing in', () => {
    check(html(<FinishCard confirming={false} onConfirm={() => {}} />));
    check(html(<FinishCard confirming onConfirm={() => {}} />));
  });

  it('the address form: empty, sending, and with each refusal', () => {
    const ref = { current: null };
    const base = { email: 'dana@example.com', onEmail: () => {}, inputRef: ref, onSubmit: () => {} };
    check(html(<EmailForm {...base} sending={false} error={null} />), FIXTURE);
    check(html(<EmailForm {...base} sending error={null} />), FIXTURE);
    for (const reason of ['invalid_email', 'too_many', 'failed'] as SendFailure[]) check(html(<EmailForm {...base} sending={false} error={sendFailureMessage(reason)} />), FIXTURE);
  });

  it('"check your inbox": waiting out the cooldown, ready to resend, and failing to resend', () => {
    const base = { email: 'dana@example.com', sending: false, onResend: () => {}, onDifferent: () => {} };
    check(html(<SentNotice {...base} cooldown={30} error={null} />), FIXTURE);
    check(html(<SentNotice {...base} cooldown={0} error={null} />), FIXTURE);
    check(html(<SentNotice {...base} cooldown={0} error={sendFailureMessage('too_many')} />), FIXTURE);
  });

  it('a hostile address cannot add markup or leave a placeholder', () => {
    const markup = html(<SentNotice email={'<b>x</b>{who}'} cooldown={0} sending={false} error={null} onResend={() => {}} onDifferent={() => {}} />);
    expect(markup).not.toContain('<b>x</b>');
    expect(markup).toContain('&lt;b&gt;x&lt;/b&gt;{who}');
  });

  it('every sign-in message', () => {
    const codes: SignInErrorCode[] = ['cancelled', 'state_mismatch', 'no_code', 'callback_failed', 'email_unverified', 'unknown'];
    for (const code of codes) {
      for (const provider of [undefined, null, 'apple', 'microsoft', 'other']) check(p(errorMessage(code, provider)));
    }
    for (const reason of ['expired', 'used', 'invalid'] as LinkFailure[]) check(p(linkFailureMessage(reason)));
    for (const failure of ['failed', 'expired', 'used', 'invalid'] as const) check(p(signInNotice(failure, null) as string));
    check(p(signInNotice(null, 'cancelled') as string));
    expect(signInNotice(null, null)).toBeNull();
  });
});

describe('English is what it always was', () => {
  beforeEach(() => { useMemoryStorage(); resetLocaleForTests(); });
  afterEach(() => { resetLocaleForTests(); resetStorage(); });

  it('the plan lines match the pricing cards, line for line', () => {
    expect(billingEn['feature.detection']).toBe(PLAN_FEATURES[0]);
    expect(billingEn['feature.streak']).toBe(PLAN_FEATURES[1]);
    expect(billingEn['feature.history']).toBe(PLAN_FEATURES[2]);
    expect(billingEn['feature.alert']).toBe(PLAN_FEATURES[3]);
    expect(billingEn['feature.support']).toBe(YEARLY_EXTRA);
    expect(PLAN_FEATURES.length).toBe(4);
    for (const line of [...PLAN_FEATURES, YEARLY_EXTRA, 'not a plan line']) expect(planFeature(line)).toBe(line);
  });

  it('lengths read like shared/plans.js describeDays', () => {
    for (const days of [1, 2, 7, 14, 30, 60, 90, 180, 365, 730, 1095, 45, 31, 1000]) expect(describeLength(days)).toBe(describeDays(days));
  });

  it('trial wording, including big numbers', () => {
    const NOW = Date.UTC(2026, 8, 26, 12);
    expect(trialLeft(new Date(NOW + 1000 * DAY).toISOString(), NOW)).toBe('1000 days left');
    expect(trialEndedMessage(1000)).toBe('Your free trial has ended. It logged 1000 alerts, and your history is still saved on this device.');
    expect(trialEndedMessage(1.9)).toBe('Your free trial has ended. It logged 1 alert, and your history is still saved on this device.');
  });

  it('the paywall prices read $2.99, $29, $29.00 and $2.42', () => {
    h.auth.user = user();
    const markup = html(<PaywallPage />);
    expect(markup).toContain('$2.99 a month, or $29 a year. No camera data is sent while it runs.');
    expect(markup).toContain('>$29.00<');
    expect(markup).toContain('>$2.99<');
    expect(markup).toContain('$2.42/month, billed yearly');
    expect(markup).toContain('Best value: save 19%');
    expect(markup).toContain('Keep the alarm <span class="sg-hl">running</span>');
    const choose = html(<PaywallPage onBack={() => {}} />);
    expect(choose).toContain('Choose a <span class="sg-hl">plan</span>');
    h.prices = { pri_month: { total: '£2.49', currency: 'GBP' }, pri_year: { total: '£24.00', currency: 'GBP' } };
    expect(html(<PaywallPage />)).toContain('These prices are shown in your local currency. The list prices are $2.99 a month and $29 a year.');
  });

  it('the free-plan, referral and plan-label sentences', () => {
    h.auth = { user: user({ entitlement: { free_tier: { detection_minutes_per_day: 30, history_days: 7 } } }), accessStatus: 'free_tier' };
    kv.set('billing', 'free-usage', { day: dayKey(new Date()), seconds: 600 });
    expect(html(<FreeTierNotice />)).toContain('Free plan: 10 of 30 minutes of detection used today.');
    kv.set('billing', 'free-usage', { day: dayKey(new Date()), seconds: 1800 });
    expect(html(<FreeTierNotice />)).toContain("You have used today&#x27;s 30 free minutes of detection. It starts again tomorrow.");
    const summary: Summary = { code: 'c', link: 'l', credit_days: 365, pending: 1, rewarded: 2, credit_days_earned: 60 };
    const markup = html(<ReferralView summary={summary} failed={false} copied={false} onCopy={() => {}} />);
    expect(markup).toContain('you both get one year of bonus access.');
    expect(markup).toContain('2 people have paid through your link, earning you 2 months. 1 is signed up and have not paid yet.');
    const plan = planOverride(user({ entitlement: { free_tier: { detection_minutes_per_day: 30, history_days: 7 } } }) as never);
    expect(plan?.detail).toBe('30 minutes of detection a day and the last 7 days of history.');
  });

  it('the sign-in messages', () => {
    expect(errorMessage('email_unverified', 'apple')).toBe(
      'Apple did not confirm that this email address belongs to you, so we did not connect it to an existing account. '
      + 'Use the emailed sign-in link instead: it proves you can read that inbox.');
    expect(errorMessage('email_unverified')).toMatch(/^Your sign-in provider did not confirm/);
    expect(sendFailureMessage('invalid_email')).toBe("That doesn't look like an email address. Please check it and try again.");
    expect(signInNotice('failed', null)).toBe("We couldn't finish signing you in. Please request a new link.");
    expect(authEn['sent.againWait']).toBe('Send another link ({seconds}s)');
  });
});
