// Copy that changes with a feature flag (WS11b).
//
// Plain ES-module JavaScript with a hand-written flagCopy.d.ts beside it, for the
// same reason shared/plans.js is: the server (Node, no TypeScript step), the browser
// bundle and the build scripts all import it. No DOM, no React, no Node-only imports.
//
// Two mechanisms, one function (`flagAware`):
//
//  1. RULES. A sentence that is already on the site and stops being true when a
//     flag is on (history stays in the browser, Google is the only sign-in, a phone
//     cannot be used, there are two plans). The source files keep the sentence EXACTLY as it is today;
//     a rule says "when this text appears and these flags are on, say this
//     instead". With every flag off no rule applies and the text comes back
//     unchanged (same string), so the served site is byte-identical to the site
//     without this module. The rule lives here, not in the page source, so editing
//     it never moves a page's freshness fingerprint (scripts/sync-seo.mjs reads the
//     page sources, not this file).
//
//  2. MARKERS, for the pages WS11b adds. Their text says what is true when only the
//     page's own flag is on; where another flag changes a sentence they write
//        {{if event_sync}}text for on{{else}}text for off{{end}}
//     ({{else}} optional). Markers never nest.
//
// `isOn(name)` is whatever the caller trusts: the server passes its flags (and, for
// the sign-in methods, whether the method is also configured), the browser passes
// the flags it last heard from /api/features (and /auth/providers).
//
// Approved privacy wording only: "Detection runs on your device. No camera data is
// sent while it runs." Nothing here may say "100% private" or "nothing leaves your
// device". Sign-in and, when on, sync do use the network, and the copy says so.

import { lifetimePriceUsd } from './plans.js';

/** The flags that change copy on pages that exist today. */
export const COPY_FLAGS = Object.freeze([
  'event_sync',
  'phone_companion',
  'signin_magic_link',
  'signin_apple',
  'signin_microsoft',
  'lifetime_plan',
]);

const SIGNIN_NAMES = [
  ['signin_apple', 'Apple'],
  ['signin_microsoft', 'Microsoft'],
  ['signin_magic_link', 'an emailed link'],
];

function joinOr(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

/** ["Google", "Apple", ...] for the sign-in methods that are really on, Google always first. */
function signInMethods(isOn) {
  return ['Google', ...SIGNIN_NAMES.filter(([flag]) => isOn(flag)).map(([, name]) => name)];
}

const anySignIn = isOn => SIGNIN_NAMES.some(([flag]) => isOn(flag));

/**
 * The answer to "Do I need a Google account to use it?" for the methods that are on.
 * Composed from the methods, not written out per combination. NEEDS HUMAN REVIEW
 * (it describes what each provider hands us).
 */
export function signInAnswer(isOn) {
  const methods = signInMethods(isOn);
  const parts = [`No. You can sign in with ${joinOr(methods)}, so you do not need a Google account.`];
  parts.push('Signing in with Google gives us your name, email address and profile picture and never your Google password.');
  const apple = isOn('signin_apple');
  const microsoft = isOn('signin_microsoft');
  if (apple || microsoft) {
    const who = apple && microsoft ? 'Apple or Microsoft' : apple ? 'Apple' : 'Microsoft';
    const relay = apple ? ' (an Apple relay address if you hide yours)' : '';
    parts.push(`Signing in with ${who} gives us the name and email address on that account${relay} and never your password.`);
  }
  if (isOn('signin_magic_link')) parts.push('The emailed link needs only your email address.');
  parts.push('The live demo on the homepage needs no account at all.');
  return parts.join(' ');
}

/**
 * "$99": the Lifetime list price as the words write it (shared/plans.js, the one number; it must equal the Paddle price).
 * Read when a rule runs, not when this file is imported: the server loads .env after its imports, and the offer in the
 * structured data (server/marketing/lifetimeCopy.js) is made from the same call, so the sentence and the offer agree.
 */
const lifetimeUsd = () => `$${lifetimePriceUsd()}`;

/** A rule of the Lifetime group: nothing with the flag off, `text(price)` with it on. */
function lifetimeRule(id, where, off, text) {
  return {
    id,
    where,
    off,
    flags: ['lifetime_plan'],
    on: isOn => (isOn('lifetime_plan') ? text(lifetimeUsd()) : null),
  };
}

/**
 * Each rule: `off` is a piece of text exactly as the source files write it today;
 * `flags` are the flags that can change it; `on(isOn)` is the text to use instead,
 * or null when, with the flags as they are, nothing changes. `where` is for people
 * (and the test that every rule still finds its text).
 */
export const RULES = Object.freeze([
  // ── history stays on this device unless sync is on (event_sync) ────────────
  {
    id: 'faq-alert-log',
    where: 'Landing FAQ 1, the FAQPage in index.html and its crawler copy',
    off: 'Each alert is logged in your browser, so you can tag what set it off',
    flags: ['event_sync'],
    on: isOn => (isOn('event_sync')
      ? 'Each alert is logged in your browser and copied to your account only if you turn on sync, so you can tag what set it off'
      : null),
  },
  {
    id: 'home-history-line',
    where: 'Landing "Before you start" list and its crawler copy',
    off: 'Your history is stored in this browser, so it doesn\'t follow you to another computer.',
    flags: ['event_sync'],
    on: isOn => (isOn('event_sync')
      ? 'Your history is stored in this browser. To see it on another computer, turn on sync in Settings; it stays off until you do.'
      : null),
  },
  {
    id: 'home-history-privacy',
    where: 'Landing privacy section',
    off: 'and your history lives in this browser: clear the site\'s data and it\'s gone.',
    flags: ['event_sync'],
    on: isOn => (isOn('event_sync')
      ? 'and your history lives in this browser unless you turn on sync: with sync off, clear the site\'s data and it\'s gone.'
      : null),
  },
  {
    id: 'network-use',
    where: 'Landing privacy section, How it works FAQ, and their crawler copies',
    off: 'Signing in and paying use the network',
    flags: ['event_sync'],
    on: isOn => (isOn('event_sync')
      ? 'Signing in, paying and, if you turn it on, syncing use the network'
      : null),
  },
  {
    id: 'about-log',
    where: 'About page and its crawler copy',
    off: 'Your alarm and bite log is stored in your browser.',
    flags: ['event_sync'],
    on: isOn => (isOn('event_sync')
      ? 'Your alarm and bite log is stored in your browser, and is copied to your account only if you turn on sync.'
      : null),
  },
  {
    id: 'settings-privacy-log',
    where: 'Settings, Privacy card',
    off: 'your alarm and bite log stays in this browser too.',
    flags: ['event_sync'],
    on: isOn => (isOn('event_sync')
      ? 'your alarm and bite log stays in this browser too, unless you turn on sync.'
      : null),
  },
  {
    id: 'how-log-row',
    where: 'How it works spec table',
    off: 'Timestamped log stored locally, never transmitted',
    flags: ['event_sync'],
    on: isOn => (isOn('event_sync')
      ? 'Timestamped log stored locally; sent to your account only if you turn on sync'
      : null),
  },
  {
    id: 'how-log-item',
    where: 'How it works crawler copy',
    off: 'timestamped log stored locally — never transmitted',
    flags: ['event_sync'],
    on: isOn => (isOn('event_sync')
      ? 'timestamped log stored locally; sent to your account only if you turn on sync'
      : null),
  },

  {
    id: 'blog-log-not-synced',
    where: 'Blog post: webcam privacy',
    off: 'Your incident log and streaks are stored in your browser rather than synced to a server, and clearing the site\'s data removes them.',
    flags: ['event_sync'],
    on: isOn => (isOn('event_sync')
      ? 'Your incident log and streaks are stored in your browser unless you turn on sync, which copies the log to your account; with sync off, clearing the site\'s data removes them.'
      : null),
  },
  {
    id: 'blog-log-no-cloud',
    where: 'Blog post: mediapipe detection explained or the app review',
    off: 'The alarm and bite log is stored in your browser, with no cloud sync.',
    flags: ['event_sync'],
    on: isOn => (isOn('event_sync')
      ? 'The alarm and bite log is stored in your browser, and is copied to your account only if you turn on sync.'
      : null),
  },

  // ── sign-in options (signin_magic_link, signin_apple, signin_microsoft) ─────
  {
    id: 'faq-google-account',
    where: 'Landing FAQ "Do I need a Google account to use it?", the FAQPage in index.html and its crawler copy',
    off: 'Accounts are created through Google sign-in, which gives us your name, email address and profile picture and never your Google password. The live demo on the homepage needs no account at all.',
    flags: ['signin_magic_link', 'signin_apple', 'signin_microsoft'],
    on: isOn => (anySignIn(isOn) ? signInAnswer(isOn) : null),
  },
  {
    id: 'home-sign-in',
    where: 'Landing hero note and "How to start", and their crawler copies',
    off: 'Sign in with Google (it opens in a new tab)',
    flags: ['signin_magic_link', 'signin_apple', 'signin_microsoft'],
    on: isOn => (anySignIn(isOn) ? `Sign in with ${joinOr(signInMethods(isOn))} (it opens in a new tab)` : null),
  },
  {
    id: 'nailbitemenu-needs',
    where: 'Compare page: Stop Biting vs NailBiteMenu (intro)',
    off: 'needs a Google sign-in',
    flags: ['signin_magic_link', 'signin_apple', 'signin_microsoft'],
    on: isOn => (anySignIn(isOn) ? `needs a sign-in (${joinOr(signInMethods(isOn))})` : null),
  },
  {
    id: 'nailbitemenu-requires',
    where: 'Compare page: Stop Biting vs NailBiteMenu (body and FAQ)',
    off: 'requires a Google sign-in',
    flags: ['signin_magic_link', 'signin_apple', 'signin_microsoft'],
    on: isOn => (anySignIn(isOn) ? `requires a sign-in (${joinOr(signInMethods(isOn))})` : null),
  },
  {
    id: 'nailbitemenu-table',
    where: 'Compare page: Stop Biting vs NailBiteMenu (table)',
    off: 'Google sign-in required',
    flags: ['signin_magic_link', 'signin_apple', 'signin_microsoft'],
    on: isOn => (anySignIn(isOn) ? `Sign-in required (${joinOr(signInMethods(isOn))})` : null),
  },

  // ── a phone can be used for logging (phone_companion) ──────────────────────
  {
    id: 'faq-phone',
    where: 'Landing FAQ "Does Stop Biting work on a phone?", the FAQPage in index.html and its crawler copy',
    off: 'It is made for a laptop or desktop with a webcam, because the detection needs a camera that can see your hands while you work. On a phone, use the Email me the link button to send yourself the address and open it on your computer.',
    flags: ['phone_companion'],
    on: isOn => (isOn('phone_companion')
      ? 'The alarm needs a laptop or desktop with a webcam, because the detection needs a camera that can see your hands while you work. On a phone you can sign in and log a bite or an urge in two taps, see your streak, and add the app to your home screen; nothing is detected on the phone. Once you are signed in, a link on the phone screen sends the address to your computer for setting up the alarm.'
      : null),
  },

  // ── the Lifetime plan is a third plan (lifetime_plan) ──────────────────────
  // `isOn('lifetime_plan')` is the flag AND a Lifetime price id the server knows (server/marketing/copyFlags.js), and the
  // browser learns exactly that from the page's marker, so the card, these sentences and the schema agree.
  // The words are the card's own ("Pay once instead of every month or year. It includes everything in the monthly plan, with
  // no renewals, for as long as Stop Biting is offered.", src/i18n/scopes/plans.ts and the Terms): the questions and answers
  // below quote no price (the card and the offer carry it), no saving, never "the best deal"; the rules after them, for the
  // pages that quote Stop Biting's price, say "$99 once" from shared/plans.js (lifetimeUsd). A statement that
  // is only true of a subscription (cancel anytime) is kept to the monthly and yearly plans. English only: a translation
  // never contains these English sentences, so the draft languages are untouched until a translator words them.
  // Every `on` text must not contain its own `off` text (the rules are applied to text that has already been through them).
  {
    id: 'pricing-faq-pick-plan',
    where: 'Pricing page FAQ "How does the free trial work?", its FAQPage and its crawler copy',
    off: 'When the trial ends, pick the monthly or yearly plan to keep going.',
    flags: ['lifetime_plan'],
    on: isOn => (isOn('lifetime_plan')
      ? 'When the trial ends, pick the monthly, yearly or Lifetime plan to keep going.'
      : null),
  },
  {
    id: 'pricing-faq-difference-q',
    where: 'Pricing page FAQ question about the plans, its FAQPage and its crawler copy',
    off: 'What is the difference between Monthly and Yearly?',
    flags: ['lifetime_plan'],
    on: isOn => (isOn('lifetime_plan')
      ? 'What is the difference between Monthly, Yearly and Lifetime?'
      : null),
  },
  {
    id: 'pricing-faq-difference',
    where: 'Pricing page FAQ answer about the plans, its FAQPage and its crawler copy',
    off: 'Both plans include the same features: detection for as long as you run it, current and best streak, full history with trigger tags, and sound, flash, or both. Yearly is billed once at $29.00 (about $2.42/month, saving 19% versus $2.99/month billing) and adds priority support.',
    flags: ['lifetime_plan'],
    on: isOn => (isOn('lifetime_plan')
      ? 'Every plan includes the same features: detection for as long as you run it, current and best streak, full history with trigger tags, and sound, flash, or both. Yearly is billed once at $29.00 (about $2.42/month, saving 19% versus $2.99/month billing) and adds priority support. Lifetime is paid once instead of every month or year. It includes everything in the monthly plan, with no renewals, for as long as Stop Biting is offered.'
      : null),
  },
  {
    id: 'home-faq-cost',
    where: 'Landing FAQ 1 (what Stop Biting costs), the FAQPage in index.html and its crawler copy',
    off: 'It costs $2.99 a month or $29 a year after a',
    flags: ['lifetime_plan'],
    on: isOn => (isOn('lifetime_plan')
      ? 'It costs $2.99 a month, $29 a year or a one-time Lifetime payment after a'
      : null),
  },
  {
    id: 'home-faq-cancel',
    where: 'Landing FAQ 8 (credit card and cancelling), the FAQPage in index.html and its crawler copy',
    off: 'After that it is $2.99 a month or $29 a year, and you can cancel anytime from the app settings and keep access until the end of the paid period.',
    flags: ['lifetime_plan'],
    on: isOn => (isOn('lifetime_plan')
      ? 'After that it is $2.99 a month, $29 a year or a one-time Lifetime payment. A monthly or yearly plan can be cancelled anytime from the app settings, and you keep access until the end of the paid period.'
      : null),
  },

  // ── the Lifetime plan on the pages that quote Stop Biting's price ───────────
  // The compare and solutions pages, and two blog posts, give the price as "$2.99/month or $29/year" and a few sentences call
  // the app "a subscription". While the plan is for sale that is half the picture, and the structured data of the same pages
  // (the one product node, server/marketing/lifetimeCopy.js) already lists the Lifetime offer. The sources keep their text, so no
  // page's freshness date moves; these rules say the rest at serve time and in the browser, with the price from the same call
  // as the offer (lifetimeUsd). Competitor facts, competitor prices and the conclusions of the comparisons are not touched.
  // The sentences that need their own wording come first: a rule consumes its text, and the two price lists at the end take
  // what is left (a table cell, a bullet, an answer), which is why they sit last. Nothing here quotes a saving or says "best deal".
  lifetimeRule(
    'compare-hands-off-annual',
    'Compare page: Stop Biting vs Hands Off, "What does Stop Biting do better than Hands Off?"',
    'Stop Biting is $2.99/month or $29/year — about $2.42/month if you commit, roughly 19% cheaper than paying monthly.',
    usd => `Stop Biting is $2.99/month, or $29/year (about $2.42/month if you commit, roughly 19% cheaper than paying monthly), or ${usd} once for the Lifetime plan.`,
  ),
  lifetimeRule(
    'compare-hands-off-cost',
    'Compare page: Stop Biting vs Hands Off, the cost section',
    'Stop Biting: $2.99/month or $29/year (about $2.42/month), with a',
    usd => `Stop Biting: $2.99/month, $29/year (about $2.42/month) or ${usd} once, with a`,
  ),
  lifetimeRule(
    'compare-ai-apps-cost',
    'Compare page: AI nail biting detection apps, the Stop Biting section',
    'Pricing is published: $2.99/month or $29/year (~$2.42/month), with a',
    usd => `Pricing is published: $2.99/month, $29/year (~$2.42/month) or ${usd} once, with a`,
  ),
  lifetimeRule(
    'compare-nailed-cost',
    'Compare page: Stop Biting vs Nailed, "Which is cheaper"',
    'Stop Biting: $2.99/month, or $29/year (~$2.42/month).',
    usd => `Stop Biting: $2.99/month, $29/year (~$2.42/month) or ${usd} once for the Lifetime plan.`,
  ),
  lifetimeRule(
    'compare-habitaware-plans',
    'Compare page: Stop Biting vs HabitAware, "What does Stop Biting do better"',
    'It is a subscription with a published price: $2.99/month or $29/year, about $2.42/month on the annual plan.',
    usd => `It has published prices: $2.99/month, $29/year (about $2.42/month on the annual plan) or ${usd} once for the Lifetime plan.`,
  ),
  lifetimeRule(
    'compare-pavlok-try',
    'Compare page: Stop Biting vs Pavlok, "What does Stop Biting do better"',
    'It costs far less to try: $2.99/month or $29/year, against the device prices on Pavlok’s home page.',
    usd => `It costs far less to try: $2.99/month, or $29/year, against the device prices on Pavlok’s home page. Stop Biting also has a one-time Lifetime plan at ${usd}.`,
  ),
  lifetimeRule(
    'compare-nailed-is-subscription',
    'Compare page: Stop Biting vs Nailed (intro)',
    'Stop Biting is a subscription that adds',
    () => 'Stop Biting is a subscription, or a one-time Lifetime plan, that adds',
  ),
  lifetimeRule(
    'compare-nailed-buys',
    'Compare page: Stop Biting vs Nailed, "Why choose Stop Biting over Nailed?"',
    'Stop Biting’s subscription buys you things you may not need',
    () => 'Stop Biting’s paid plans buy you things you may not need',
  ),
  lifetimeRule(
    'compare-nailed-pays',
    'Compare page: Stop Biting vs Nailed, "Which is cheaper"',
    'What the subscription pays for is the rest of the system',
    () => 'What a Stop Biting plan pays for is the rest of the system',
  ),
  lifetimeRule(
    'compare-nailed-heading',
    'Compare page: Stop Biting vs Nailed, the heading of the last question',
    'Should I buy Nailed or subscribe to Stop Biting?',
    () => 'Should I buy Nailed or pay for Stop Biting?',
  ),
  lifetimeRule(
    'compare-habitcam-pick',
    'Compare page: Stop Biting vs HabitCam (intro)',
    'want one purchase instead of a subscription, or have more than one of those behaviours',
    usd => `want to pay once for less than Stop Biting’s ${usd} Lifetime plan, or have more than one of those behaviours`,
  ),
  lifetimeRule(
    'compare-habitcam-limit',
    'Compare page: Stop Biting vs HabitCam, "What does Stop Biting do better"',
    'and only in front of your webcam, and it is a subscription.',
    usd => `and only in front of your webcam, and it is a subscription unless you choose the one-time Lifetime plan at ${usd}.`,
  ),
  lifetimeRule(
    'compare-nailbitemenu-limit',
    'Compare page: Stop Biting vs NailBiteMenu, "What does Stop Biting do better"',
    'Stop Biting is a paid subscription after the trial,',
    () => 'Stop Biting is a paid subscription or a one-time Lifetime plan after the trial,',
  ),
  lifetimeRule(
    'compare-biteless-both',
    'Compare page: Stop Biting vs BiteLess, "What do they have in common?"',
    'Both sell a subscription.',
    () => 'Both sell a subscription, and Stop Biting also has a one-time Lifetime plan.',
  ),
  lifetimeRule(
    'compare-cta-price',
    'The offer at the foot of every compare and solutions page (src/pages/ComparePage.tsx)',
    'then $2.99 a month or $29 a year',
    usd => `then $2.99 a month, $29 a year or ${usd} once`,
  ),
  lifetimeRule(
    'price-list-short',
    'The short price list in the AI detection apps table and the best-apps post table',
    '$2.99/mo or $29/yr',
    usd => `$2.99/mo, $29/yr or ${usd} once`,
  ),
  lifetimeRule(
    'price-list',
    'Stop Biting\'s price in a sentence, a table cell or a FAQ answer: compare and solutions pages, two blog posts, the llms-full.txt copies of them',
    '$2.99/month or $29/year',
    usd => `$2.99/month, $29/year or ${usd} once`,
  ),
]);

/**
 * The pricing headline while the Lifetime card is shown, in three pieces so the page can mark the middle one
 * (`<mark>` in the catalog message `pricing.heading`, "$2.99 a month, or <mark>$29 a year.</mark>"). It is not a rule: the
 * catalog message has a tag in it and the server's copy of it is a heading, so the page (src/components/PricingSection.tsx)
 * and the crawler article (ANCHORS in server/marketing/lifetimeCopy.js) both build it from here. English only.
 */
export function lifetimeHeadline(price = lifetimePriceUsd()) {
  return { lead: '$2.99 a month, ', mark: '$29 a year,', tail: ` or $${price} once.` };
}

/** The rules that apply with these flags, as [off, on] pairs. */
function activeRules(isOn) {
  const out = [];
  for (const rule of RULES) {
    const on = rule.on(isOn);
    if (on !== null && on !== undefined) out.push([rule.off, on]);
  }
  return out;
}

const MARKER = /\{\{if ([a-z_0-9]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{end\}\}/g;

/** Resolves {{if flag}}..{{else}}..{{end}} markers. Text without markers is returned as it came. */
export function resolveMarkers(text, isOn) {
  if (typeof text !== 'string' || !text.includes('{{if ')) return text;
  return text.replace(MARKER, (_whole, flag, yes, no) => (isOn(flag) ? yes : (no ?? '')));
}

/**
 * The text to show with the flags as `isOn` reports them. Applies the rules, then
 * the markers. With no rule active and no marker the SAME string comes back.
 */
export function flagAware(text, isOn) {
  if (typeof text !== 'string' || text === '') return text;
  let out = text;
  for (const [off, on] of activeRules(isOn)) {
    if (out.includes(off)) out = out.split(off).join(on);
  }
  return resolveMarkers(out, isOn);
}

/** True when `flagAware` could change anything in this text, whatever the flags. */
export function mentionsFlagCopy(text) {
  if (typeof text !== 'string') return false;
  return text.includes('{{if ') || RULES.some(rule => text.includes(rule.off));
}

/** True when at least one rule gives different text with these flags (the server's "nothing to do" test). */
export function anyRuleActive(isOn) {
  return activeRules(isOn).length > 0;
}

/** Applies `flagAware` to every string in a JSON-like value; objects and arrays are rebuilt only when something changed. */
export function flagAwareDeep(value, isOn) {
  if (typeof value === 'string') return flagAware(value, isOn);
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map(item => {
      const mapped = flagAwareDeep(item, isOn);
      if (mapped !== item) changed = true;
      return mapped;
    });
    return changed ? next : value;
  }
  if (value && typeof value === 'object') {
    let changed = false;
    const next = {};
    for (const [key, item] of Object.entries(value)) {
      const mapped = flagAwareDeep(item, isOn);
      if (mapped !== item) changed = true;
      next[key] = mapped;
    }
    return changed ? next : value;
  }
  return value;
}

/**
 * A page's sections after markers are resolved: a section whose heading, body and
 * html all came out empty (a whole section wrapped in an {{if}}) is dropped.
 */
export function dropEmptySections(page) {
  if (!page || !Array.isArray(page.sections)) return page;
  const sections = page.sections.filter(s => (s.heading ?? '').trim() !== '' || (s.body ?? '').trim() !== '' || (s.html ?? '').trim() !== '');
  return sections.length === page.sections.length ? page : { ...page, sections };
}

// ─── Numbers the environment decides ─────────────────────────────────────────

/**
 * Fills {{NAME}} placeholders with values the server reads from its environment at
 * boot (the referral reward). Unknown names are left alone. Pass the values in; this
 * file reads nothing itself.
 */
export function fillCopyTokens(text, values) {
  if (typeof text !== 'string' || !text.includes('{{')) return text;
  return text.replace(/\{\{([A-Z][A-Z0-9_]*)\}\}/g, (whole, name) => (name in values ? values[name] : whole));
}

export function fillCopyTokensDeep(value, values) {
  if (typeof value === 'string') return fillCopyTokens(value, values);
  if (Array.isArray(value)) return value.map(item => fillCopyTokensDeep(item, values));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fillCopyTokensDeep(v, values)]));
  }
  return value;
}
