// Competitor profile pages that ship BEHIND the `compare_competitors` flag (off).
//
//   /compare/hands-off          what Hands Off is, who it suits, where we differ
//   /compare/habitaware-keen    what HabitAware's Keen3 is, who it suits, where we differ
//
// While the flag is off the server answers 404 and the client route renders its
// 404; the URLs are absent from the sitemap, llms.txt, llms-full.txt and the
// noscript nav; and this copy is not in dist/seo-content.json (it rides in
// dist/seo-gated.json, which the server does not serve). See
// src/data/gatedComparePaths.ts and docs/agents/ws11a-notes.md.
//
// ── OVERLAP WITH PUBLISHED PAGES (owner decision before the flag goes on) ───────
// /compare/stop-biting-vs-hands-off and /compare/stop-biting-vs-habitaware are
// live, in the sitemap, and were verified on 2026-09-10 and 2026-10-05. These two
// pages are written for a different question ("what is this product and who is it
// for", not "which one should I pick, side by side"), they link to those pages,
// and they carry their own facts, but they still sit close to them in search.
// Do not gate the published pages, and decide deliberately whether to run both.
//
// ── FACTS ───────────────────────────────────────────────────────────────────────
// Every competitor fact below was read on 2026-10-23 on the vendor's own pages,
// and the page it came from sits in the same table row as a link and, in the
// list below, as a comment. Nothing is written that was not read. The pages carry
// `needsVerification: true`: a human opens each source and confirms the wording
// before the flag is turned on, then sets it to false.
//
// Hands Off (https://handsoffapp.com), fetched 2026-10-23
//   https://handsoffapp.com/      "Hands Off is a desktop app that helps you quit nail biting,
//        skin picking, and hair pulling by detecting unconscious habits through your webcam and
//        interrupting them instantly."; "Download for Mac" / "Download for Windows"; "Hands Off
//        supports 5 common BFRBs, such as nail biting, skin picking, eyebrow/eyelash pulling, ear
//        picking, and nose picking."; "full-screen alert"; "3 days free, then €2.99 monthly."
//        (the only plan shown); "All processing happens locally on your device, no webcam data
//        ever leaves your computer"; "No video gets recorded"; "Fully GDPR compliant"; "No
//        personal data is collected, stored, or shared with third parties during habit tracking.";
//        creator Lennert Soffers, "I've been struggling with nail biting for over 20 years".
//        /pricing and /about returned HTTP 404 the same day; pricing is a section of the home page.
//   https://handsoffapp.com/faq   "multiple intervention options: full-screen overlay, full-screen
//        without camera, or small notification popup. Sensitivity adjusts from high (catches subtle
//        approaches) to low (only clear attempts)."; "daily detection counts, current streak
//        length, weekly trends, and longest streak"; "Hands Off only works during computer use
//        since it requires webcam access."; "The only network activity is a lightweight
//        authentication check every 5 minutes to verify your subscription."; "Hands Off continues
//        working normally. Only the subscription verification needs internet, and that has a
//        grace period."
//   NOT REPEATED: "achieving 70-90% reduction in episodes within the first week for most users"
//        (FAQ, no study or method given), and the FAQ's treatment-success percentages.
//
// HabitAware Keen3 (https://habitaware.com), fetched 2026-10-23
//   https://habitaware.com/     "evidence-based buzzing bracelet"; hair pulling (trichotillomania),
//        skin picking (dermatillomania) and nail biting (onychophagia); "Shipping January 2027";
//        "90-Day Guarantee"; "In our just-published pilot study, this HabitAware system was
//        associated with significant reduction in hair pulling severity and impairment."; "A
//        randomized controlled trial is now underway."
//   https://habitaware.com/products/keen3-bracelet   title "Preorder: Keen3 + 1 Year Pro Membership";
//        $199.00 USD (page and the store's own product feed .js agree: 19900 cents); "Estimated to
//        ship in January 2027"; "Includes one year of Keen3 Pro"; "After that, Pro is $99/year.";
//        "Keen3's awareness vibrations and lessons keep working without Pro."
//   https://habitaware.com/pages/faq-v1   "Keen's sophisticated motion sensors record the repetitive
//        way you do the behavior, and thereafter silently monitors your hand."; "Keen3 can store up
//        to two behaviors per band"; "generally work best with behaviors related to hand/wrist
//        motions near the head and face"; "false alarms still happen"; "Keen3 cannot physically
//        stop you"; "Keen3 is designed for kids (ages 8+) and adults"; iOS 13.0 / Android 6.0
//        minimums for the free companion app; "The battery on Keen3 lasts a full day".
//   https://habitaware.com/policies/refund-policy   effective May 1, 2025; "Keen2 Bracelet: Returns
//        accepted within 90 days on the date of delivery"; the policy body does not mention Keen3.
//   NOT REPEATED: "50,000+ Users", "2,500+ Therapists Recommend Keen2", "90% show improvement",
//        "100% of participants said they'd recommend it". Uncited vendor marketing.
//   NOT ASSESSED: the pilot study itself (the page links ScienceDirect); the page's statement
//        concerns hair pulling, and this page says so.
//
// Our own facts come from our published pages: /pricing, /how-it-works, llms.txt.

import { TRIAL_HYPHEN } from '../../shared/plans.js';
import {
  MEDICAL_DISCLAIMER_SECTION,
  faqSection,
  verificationSection,
  type PageContent,
} from './comparePages.ts';

const checked = '23 October 2026';

/** A source cell: the vendor's page, linked, so a reader (and a verifier) can open the same page. */
function source(url: string): string {
  return `<a class="sg-link" href="${url}" target="_blank" rel="noopener noreferrer">${url.replace(/^https:\/\//, '').replace(/\/$/, '')}</a>`;
}

/** Rows of [what, what the vendor's site says, the page it says it on]. */
function factsTable(vendor: string, rows: [string, string, string][]): string {
  return `<table><thead><tr><th></th><th>What ${vendor}’s site says</th><th>Source</th></tr></thead><tbody>` +
    rows.map(([what, says, url]) => `<tr><td>${what}</td><td>${says}</td><td>${source(url)}</td></tr>`).join('') +
    '</tbody></table>';
}

function getHandsOffProfileContent(): PageContent {
  return {
    needsVerification: true,
    title: 'Hands Off Nail Biting App: Features, Price, Who It Suits',
    subtitle: 'What the Hands Off desktop app does according to its own site, where it is the better choice, and where Stop Biting fits instead',
    intro: 'Hands Off is a Mac and Windows desktop app that uses your webcam to catch nail biting, skin picking and other body-focused repetitive behaviours, and interrupts you with an on-screen alert. Its own site lists a €2.99 monthly plan after 3 days free. It is the better fit if you want a native desktop app or have more than one of these behaviours; Stop Biting is the better fit if nail biting is your problem and you would rather use a browser tab than install anything. Disclosure: Stop Biting is our product, so read this as a fair attempt, not an independent review. Every Hands Off detail below was read on handsoffapp.com on ' + checked + ', with the page it came from linked beside it.',
    sections: [
      {
        heading: 'What is Hands Off and how does it work?',
        body: 'Hands Off is made by Lennert Soffers, who writes on its site that he struggled with nail biting for over 20 years. According to the site, it runs in the background, watches your hands through your webcam, and interrupts you with an alert when your hand moves toward your face to bite or pick.\n\nThe table lists what its site and FAQ say, with the page each line comes from. Quotations are Hands Off’s own words.',
        html: factsTable('Hands Off', [
          ['Platforms', '“Hands Off is a desktop app”, with “Download for Mac” and “Download for Windows” buttons. We found no browser version on the page.', 'https://handsoffapp.com/'],
          ['Behaviours', '“Hands Off supports 5 common BFRBs, such as nail biting, skin picking, eyebrow/eyelash pulling, ear picking, and nose picking.”', 'https://handsoffapp.com/'],
          ['Alerts', '“a full-screen alert”. Its FAQ lists three styles, “full-screen overlay, full-screen without camera, or small notification popup”, and says sensitivity adjusts “from high (catches subtle approaches) to low (only clear attempts)”.', 'https://handsoffapp.com/faq'],
          ['Progress', 'Its FAQ lists “daily detection counts, current streak length, weekly trends, and longest streak”.', 'https://handsoffapp.com/faq'],
          ['Price', '“3 days free, then €2.99 monthly.” This is the only plan we found listed; there is no annual or lifetime option on the page.', 'https://handsoffapp.com/'],
          ['Camera data', '“All processing happens locally on your device, no webcam data ever leaves your computer.” “No video gets recorded.”', 'https://handsoffapp.com/'],
          ['Personal data', '“Fully GDPR compliant.” “No personal data is collected, stored, or shared with third parties during habit tracking.”', 'https://handsoffapp.com/'],
          ['Network use', '“The only network activity is a lightweight authentication check every 5 minutes to verify your subscription.”', 'https://handsoffapp.com/faq'],
          ['Away from the computer', '“Hands Off only works during computer use since it requires webcam access.”', 'https://handsoffapp.com/faq'],
        ]),
      },
      {
        heading: 'When is Hands Off the better fit?',
        body: 'If you have more than one of these behaviours, Hands Off is the broader tool: its site lists five, where Stop Biting detects nail biting only. If you want a native desktop app rather than a browser tab, or you like having a choice of full-screen, camera-free or small pop-up alerts with adjustable sensitivity, it offers those as described in its FAQ.\n\nIt is also made by someone who says he has bitten his nails himself, and its price is published. For a desktop-only, multi-behaviour situation it is a credible choice.\n\nOne limit it shares with every webcam app, in its own words: it only works while you are at the computer, because it needs the webcam.',
      },
      {
        heading: 'When is Stop Biting the better fit?',
        body: 'Stop Biting is the better fit if nail biting is the habit you want to catch and you would rather not install anything. It runs in a browser tab on a Mac or Windows PC, which helps on a work laptop where you cannot install software. It also has an annual plan, $29 a year, where Hands Off’s site lists one monthly plan, and alongside the alarm it has a library of free guides on habit reversal training, competing responses and trigger mapping.\n\nThe limits are real. Stop Biting detects nail biting only, it needs you to sign in, and, like Hands Off, it only sees your hands while you are in front of a webcam.',
      },
      {
        heading: 'How do Hands Off and Stop Biting compare on price and privacy?',
        body: `Monthly prices are close: Stop Biting is $2.99 a month and Hands Off lists €2.99 a month. Each starts with a free trial: Stop Biting’s is a ${TRIAL_HYPHEN} free trial with no card required, and Hands Off’s site says “3 days free”. Over a year, Stop Biting’s annual plan is $29, while twelve months of Hands Off at its listed price is €35.88 and its site lists no annual option. The currencies differ, so compare the real figures at checkout.\n\nOn camera data the two say similar things in different words. Stop Biting: detection runs on your device and no camera data is sent while it runs; signing in and paying use the network. Hands Off: processing is local and no video is recorded, and its FAQ adds that the app makes a subscription check every 5 minutes.\n\nOne number on its site we do not repeat is the “70-90% reduction in episodes within the first week for most users” in its FAQ. The page cites no study or method for it, so we cannot check it, and we make no equivalent claim for Stop Biting.`,
      },
      faqSection(
        'Short answers, from the same ' + checked + ' read of handsoffapp.com as the rest of this page.',
        [
          ['Does Hands Off work in a browser?', 'Its site describes Hands Off as a desktop app, with downloads for Mac and Windows. We found no browser version there on ' + checked + '. Stop Biting runs in a browser tab.'],
          ['How much does Hands Off cost?', 'Its site says “3 days free, then €2.99 monthly.” We found no annual or lifetime plan listed.'],
          ['Which behaviours does Hands Off cover?', 'Its site says it supports 5 common BFRBs, such as nail biting, skin picking, eyebrow/eyelash pulling, ear picking, and nose picking. Stop Biting detects nail biting only.'],
          ['Does Hands Off need an internet connection?', 'Its FAQ says the only network activity is a lightweight authentication check every 5 minutes to verify your subscription, and that it continues working if the internet goes down, with a grace period for the subscription check.'],
          ['Is Hands Off the same kind of app as Stop Biting?', 'Broadly, yes: both are webcam apps that alert you when your hand moves toward your face, and both say detection runs on your device. They differ in platform (a desktop download or a browser tab), in coverage (five behaviours or nail biting only) and in plans (€2.99 a month, or $2.99 a month and $29 a year).'],
          ['Can I try both?', `Yes. Hands Off’s site offers 3 days free and Stop Biting has a ${TRIAL_HYPHEN} free trial with no card required, so you can run each for a few days at your own desk before deciding.`],
        ],
      ),
      {
        heading: 'Which should you pick: Hands Off or Stop Biting?',
        body: 'Pick Hands Off if you want one desktop app for more than one behaviour, or you prefer an installed app with a choice of alert styles.\n\nPick Stop Biting if nail biting is the habit, you want to start from a browser tab without installing anything, or you want the annual plan.\n\nOur side-by-side page, Stop Biting vs Hands Off, is linked below. This page is about Hands Off on its own terms.',
      },
      verificationSection('Every Hands Off detail on this page was read on handsoffapp.com (the home page and its FAQ) on ' + checked + ', and quoted phrases are its own wording. We looked for an annual plan, a lifetime plan and a browser version and did not find them, and we say so rather than assume. We re-verify competitor details and date them here. Prices and features change: confirm on handsoffapp.com before buying.', ['https://handsoffapp.com', 'https://handsoffapp.com/faq']),
      MEDICAL_DISCLAIMER_SECTION,
    ],
    relatedPosts: [
      { href: '/compare/stop-biting-vs-hands-off', label: 'Stop Biting vs Hands Off: side by side' },
      { href: '/compare/ai-detection-apps', label: 'All AI nail biting detection apps compared (2026)' },
      { href: '/compare/habitaware-keen', label: 'HabitAware Keen3: price, how it works, who it suits' },
      { href: '/solutions/for-windows', label: 'Stop nail biting on Windows: webcam detection in your browser' },
      { href: '/how-it-works', label: 'How Stop Biting’s AI detection works' },
    ],
  };
}

function getHabitAwareKeenContent(): PageContent {
  return {
    needsVerification: true,
    title: 'HabitAware Keen3 Bracelet: Price, How It Works, Who It Suits',
    subtitle: 'What HabitAware’s Keen3 bracelet does according to its own site, where it is the better choice, and where a webcam app fits instead',
    intro: `Keen3 is HabitAware’s vibrating wrist bracelet for hair pulling, skin picking and nail biting. Its own site lists it at $199.00 with a year of the Keen3 Pro subscription included, then $99 a year for Pro, and shows it as a preorder estimated to ship in January 2027. It is the better fit if you bite away from a screen or want one device for more than one behaviour; Stop Biting is the better fit if you bite at a computer and want to start today, at $2.99 a month or $29 a year after a ${TRIAL_HYPHEN} free trial. Disclosure: Stop Biting is our product, so read this as a fair attempt, not an independent review. Every HabitAware detail below was read on habitaware.com on ` + checked + ', with the page it came from linked beside it.',
    sections: [
      {
        heading: 'What is Keen3 and how does it work?',
        body: 'HabitAware sells wrist-worn bracelets that vibrate when they detect a movement you have trained them to recognise. Keen3 is the model on its home page. Its FAQ says you train it in the companion app by performing your behaviour, that its motion sensors record the repetitive movement, and that it then makes you aware with a gentle vibration. It does not stop the behaviour: in its words, “Keen3 cannot physically stop you”.\n\nThe table lists what its site says, with the page each line comes from. Quotations are HabitAware’s own words.',
        html: factsTable('HabitAware', [
          ['What it is', 'A wrist bracelet described as an “evidence-based buzzing bracelet” for hair pulling (trichotillomania), skin picking (dermatillomania) and nail biting (onychophagia).', 'https://habitaware.com/'],
          ['Availability and price', '“Preorder: Keen3 + 1 Year Pro Membership”, $199.00 USD, “Estimated to ship in January 2027”.', 'https://habitaware.com/products/keen3-bracelet'],
          ['After the first year', '“Includes one year of Keen3 Pro.” “After that, Pro is $99/year.” “Keen3’s awareness vibrations and lessons keep working without Pro.”', 'https://habitaware.com/products/keen3-bracelet'],
          ['How it senses', '“Keen’s sophisticated motion sensors record the repetitive way you do the behavior, and thereafter silently monitors your hand.” The FAQ also says “false alarms still happen”.', 'https://habitaware.com/pages/faq-v1'],
          ['Behaviours', 'Its FAQ names hair pulling, skin picking and nail biting, says the list is not exhaustive, and says Keen3 can store up to two behaviours per band. It says Keen3 generally works best with “behaviors related to hand/wrist motions near the head and face”.', 'https://habitaware.com/pages/faq-v1'],
          ['Phone and battery', 'A free companion app, for iOS 13.0 or later and Android 6.0 or later. “The battery on Keen3 lasts a full day.”', 'https://habitaware.com/pages/faq-v1'],
          ['Ages', '“Keen3 is designed for kids (ages 8+) and adults who are ready to change.”', 'https://habitaware.com/pages/faq-v1'],
          ['Guarantee', 'The home page advertises a “90-Day Guarantee”. The refund policy (effective May 1, 2025) lists returns within 90 days for the Keen2 bracelet and does not mention Keen3, so check the terms that apply to Keen3 before buying.', 'https://habitaware.com/policies/refund-policy'],
          ['Evidence it cites', '“In our just-published pilot study, this HabitAware system was associated with significant reduction in hair pulling severity and impairment.” “A randomized controlled trial is now underway.” That statement is about hair pulling, and we have not assessed the study.', 'https://habitaware.com/'],
        ]),
      },
      {
        heading: 'When is Keen3 the better fit?',
        body: `Keen3 is the better fit if you bite or pick away from a screen. A bracelet on your wrist is not limited to what a webcam can see, so it can act on the train, on the sofa or on a phone call, where Stop Biting cannot. It is also the better fit if hair pulling or skin picking is part of the picture, since its site names those alongside nail biting, and if you want one device for more than one behaviour.\n\nIt is a bigger commitment: $199.00 upfront, a preorder that its site says is estimated to ship in January 2027, and a subscription of $99 a year after the first year if you want the Pro features. The site says Keen3’s vibrations and lessons keep working without Pro. It also advertises a 90-day guarantee, a longer window than our ${TRIAL_HYPHEN} free trial.`,
      },
      {
        heading: 'When is Stop Biting the better fit?',
        body: `Stop Biting is the better fit if you bite while you work at a computer and want to start today without waiting for hardware. It is a web app at $2.99 a month or $29 a year after a ${TRIAL_HYPHEN} free trial with no card required, and there is nothing to charge or wear.\n\nDetection is a camera watching your hand reach your mouth, where Keen3 uses a motion sensor on your wrist. We have no head-to-head accuracy data for the two and do not claim either is more accurate.\n\nThe limits are plain. Stop Biting detects nail biting only, and only while you are in front of a webcam.`,
      },
      {
        heading: 'How much do Keen3 and Stop Biting cost?',
        body: `Keen3: $199.00 USD, which includes one year of Keen3 Pro. After that, Pro is $99 a year, and the site says the vibrations and lessons keep working without it. Stop Biting: $2.99 a month or $29 a year, with a ${TRIAL_HYPHEN} free trial.\n\nOver the first year at the listed prices that is $199.00 for Keen3 against $29.00 for Stop Biting’s annual plan, or $35.88 for twelve monthly payments. They are different kinds of product, so price is only one input: a wearable that goes where you go, against a subscription that works at your desk. Prices change, so confirm on habitaware.com and stopbiting.today before buying.`,
      },
      faqSection(
        'Short answers, from the same ' + checked + ' read of habitaware.com as the rest of this page.',
        [
          ['Is HabitAware Keen3 available now?', 'Its product page lists Keen3 as a preorder, “Estimated to ship in January 2027”, as of ' + checked + '.'],
          ['How much does the Keen3 cost?', 'Its product page lists $199.00 USD, including one year of Keen3 Pro. After that, Pro is $99 a year, and the site says the vibrations and lessons keep working without Pro.'],
          ['Does Keen3 work for nail biting?', 'Its FAQ names nail biting (onychophagia) alongside hair pulling and skin picking. It also says false alarms still happen.'],
          ['Does Keen3 need a phone?', 'Its FAQ says you set it up and train it with a free companion app, for iOS 13.0 or later or Android 6.0 or later.'],
          ['Does Stop Biting work away from my computer?', 'No. Stop Biting watches your hand through a webcam, so it only works while you are in front of one. A wrist bracelet is not limited that way.'],
          ['Is a wearable or a webcam app better?', 'Neither is better for everyone. A wearable fits habits that happen away from a screen; a webcam app fits habits that happen at one, and costs less to start. Some people reasonably use both.'],
        ],
      ),
      {
        heading: 'Which should you pick: Keen3 or Stop Biting?',
        body: 'Pick Keen3 if you bite or pick away from screens, if hair pulling or skin picking is part of the picture, or if you want a wearable and are happy to preorder one.\n\nPick Stop Biting if you bite while you work or browse, want to start today without buying hardware, and want the habit reversal guides around the alert.\n\nOur side-by-side page, Stop Biting vs HabitAware (Keen), is linked below. This page is about Keen3 on its own terms.',
      },
      verificationSection('Every HabitAware detail on this page was read on habitaware.com (the home page, the Keen3 product page, the FAQ and the refund policy) on ' + checked + ', and quoted phrases are its own wording. The pilot study the home page mentions was not assessed by us, and we do not repeat the user and therapist counts on the home page because it cites no source for them. We re-verify competitor details and date them here. Prices, ship dates and policies change: confirm on habitaware.com before buying.', ['https://habitaware.com', 'https://habitaware.com/products/keen3-bracelet', 'https://habitaware.com/pages/faq-v1', 'https://habitaware.com/policies/refund-policy']),
      MEDICAL_DISCLAIMER_SECTION,
    ],
    relatedPosts: [
      { href: '/compare/stop-biting-vs-habitaware', label: 'Stop Biting vs HabitAware (Keen): wrist sensor or webcam?' },
      { href: '/compare/ai-detection-apps', label: 'All AI nail biting detection apps compared (2026)' },
      { href: '/compare/hands-off', label: 'Hands Off: features, price, who it suits' },
      { href: '/compare/stop-biting-vs-biteless', label: 'Stop Biting vs BiteLess: Apple Watch or webcam?' },
      { href: '/how-it-works', label: 'How Stop Biting’s AI detection works' },
    ],
  };
}

/** Keyed by path. The paths are listed in gatedComparePaths.ts; a test keeps the two in step. */
export const GATED_PAGE_MAP: Record<string, () => PageContent> = {
  '/compare/hands-off': getHandsOffProfileContent,
  '/compare/habitaware-keen': getHabitAwareKeenContent,
};
