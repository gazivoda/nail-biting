// Pages for features that ship BEHIND a flag (WS11b). All off in production today.
//
//   /features/habit-reversal-coaching   hrt_coaching        prompts after an alarm, urge timer, four-week program
//   /features/phone-companion           phone_companion     log from a phone in two taps
//   /features/share-with-therapist      share_links         a read-only summary link you control
//   /features/referral-program          referrals           bonus access for both sides
//   /features/desktop-app               desktop_app         KEEP OFF until desktop sign-in works (see below)
//   /solutions/cuticle-biting           detection_behaviors the same mouth alarm, logged under another name
//
// HOW THEY ARE KEPT OUT OF SIGHT. While a page's flag is off the server answers the
// branded 404, the URL is in no sitemap / llms file / site navigation, and this copy is
// not in dist/seo-content.json (it rides in dist/seo-gated.json, which the server reads
// and never serves). The browser bundle does not contain it either: the page renders
// from JSON the server resolves. src/data/featurePagePaths.ts has the flag per path;
// docs/agents/ws11b-notes.md says what must happen before each flag goes on.
//
// HOW THE COPY CHANGES WITH OTHER FLAGS. Each page says what is true when only its own
// flag is on. Where another flag changes a sentence, the text carries a marker the
// server resolves at start-up (shared/flagCopy.js):
//     {{if event_sync}}text for on{{else}}text for off{{end}}
// and numbers the environment decides are {{PLACEHOLDERS}} filled the same way.
//
// RULES THE COPY FOLLOWS (docs/agents/SWARM_RULES.md). Detection runs on your device and
// no camera data is sent while it runs (sign-in, payments and, when on, sync use the
// network, and the pages say so). No medical claims: an app is not a clinician. No
// numbers, studies, testimonials or competitor claims that are not in the product. No
// picture and no description of the habit itself. No dashes in the prose.
//
// Declarations are plain `function getXContent()` and the map is below them: this is
// the layout scripts/sync-seo.mjs reads to date each page (see comparePages.ts).

import { TRIAL_HYPHEN } from '../../shared/plans.js';
import { faqSection, MEDICAL_DISCLAIMER_SECTION, type PageContent } from './comparePages.ts';

// The three lines of privacy truth every page that mentions a camera repeats in the same words.
const PRIVACY_LINE = 'Detection runs on your device. No camera data is sent while it runs.';

function getHabitReversalCoachingContent(): PageContent {
  return {
    title: 'Habit reversal-style coaching after the alarm',
    subtitle: 'An optional prompt for something else to do with your hands, {{if urge_timer}}an urge timer, {{end}}and a four-week program of short lessons',
    intro: 'When the alarm sounds, Stop Biting can offer a competing response: a short, simple action you chose in advance, such as pressing your palms flat on the desk, held for 15 to 60 seconds. It is optional, it never delays or silences the alarm, and you can dismiss it at any moment. Habit reversal training pairs noticing the habit with doing something incompatible with it. The alarm is the noticing; this puts the second half in the app. It is a self-help tool. It is not a treatment, and an app is not a clinician.',
    sections: [
      {
        heading: 'What happens when the alarm goes off?',
        body: 'The alarm sounds first, exactly as it does without coaching. Once it has, a small card offers the response you picked, with a countdown ring and two buttons, Done and Skip. Escape dismisses it too. While you are using the minimized window the same prompt shows there as a one-line strip.\n\nThe card is not a pop-up you have to deal with: nothing is locked behind it, it does not pull focus from what you are typing, and if you stop the camera while it is counting down it is dropped rather than counted.\n\nEach prompted alarm remembers whether you finished the response or skipped it. The app can then show you the share of your alarms that were followed by a finished response, once there are alarms to count.',
      },
      {
        heading: 'What can you choose?',
        body: 'The prompt is off until you turn it on. In Settings, under Alerts, you choose:\n\nWhen it appears: never, once an hour, or at every alarm.\n\nHow long it lasts: anywhere from 15 to 60 seconds.\n\nWhat the response is: pick one of the suggestions, such as clenching your fists, pressing your palms flat on the desk, pressing your hands together or holding something in both hands, or write your own.\n\nThe choice is yours and stays on your device. Nobody grades it.',
      },
      {
        heading: '{{if urge_timer}}What is the urge timer?{{end}}',
        body: '{{if urge_timer}}An "I feel an urge" button on the Watch tab starts a guided breathing timer of 60 or 90 seconds, for the moment you feel the pull and before you have done anything. Pressing it logs an entry marked as an urge. An urge is not counted as a bite, so it does not reset your streak.\n\nThe timer respects reduced-motion settings: the ring is replaced by the number of seconds left.{{end}}',
      },
      {
        heading: 'What is in the four-week program?',
        body: 'Twenty-eight short lessons, one a day, in plain text with no video. The first week is about noticing, the second about choosing and practising a competing response, the third about working out what tends to set the habit off, and the fourth about slips and staying with it.\n\nOne new lesson opens per day. If you miss a day or a month, nothing is lost and there is no streak or "behind" count: the next lesson is simply the next one. Your progress is saved on this device and the lessons open without a network connection once the app has loaded.\n\nThe lessons are general, practical suggestions. They do not diagnose anything and they make no promise about results.',
      },
      {
        heading: 'Where does your information go?',
        body: `${PRIVACY_LINE} Your coaching choices and your progress in the program are kept in this browser. {{if event_sync}}If you turn on sync, whether you finished a response is part of the alarm entry that syncs to your account; your program progress and settings are not synced. Sync is off until you switch it on.{{else}}Nothing about it is sent to your account.{{end}}`,
      },
      faqSection(
        'Short answers to what people ask before turning the prompt on.',
        [
          ['Does the prompt stop or quiet the alarm?', 'No. The alarm starts first and keeps its own rules. The card only appears after it, and it cannot delay, replace or silence it.'],
          ['Do I have to do the response?', 'No. Skip, Escape or just carrying on all dismiss it, and nothing is held against you. The prompt is also off until you switch it on.'],
          ['Is this habit reversal training?', 'It borrows two of its ideas, noticing the habit and doing a competing action, and leaves out the rest, such as working with a trained person. It is a self-help tool, not a treatment, and it is not a replacement for a therapist.'],
          ['Do the lessons make any promises?', 'No. They are practical suggestions in plain language, with no outcome claims.'],
          ['What if I miss days of the program?', 'Nothing happens. The next lesson opens the day after you finish the last one, with no backlog and no penalty.'],
        ],
      ),
      MEDICAL_DISCLAIMER_SECTION,
    ],
    relatedPosts: [
      { href: '/blog/habit-reversal-training-guide', label: 'Habit Reversal Training: the guide' },
      { href: '/how-it-works', label: 'How Stop Biting works' },
      { href: '/pricing', label: 'Pricing and free trial' },
    ],
  };
}

function getPhoneCompanionContent(): PageContent {
  return {
    title: 'Log nail biting from your phone in two taps',
    subtitle: 'Stop Biting on a phone: two big buttons, your streak and your recent entries',
    intro: 'The alarm needs a laptop or desktop with a webcam, but biting does not stop when you leave the desk. On a phone, Stop Biting opens a simple screen with two buttons, "I bit" and "I feel an urge", your current streak, today\'s count and your recent entries. Logging takes two taps or fewer, you can add it to your home screen, and there is no camera and no detection on the phone. ' + PRIVACY_LINE,
    sections: [
      {
        heading: 'What do you see on the phone?',
        body: 'Two large buttons at the top. "I bit" logs a bite at once, and a second tap can say what set it off. "I feel an urge" logs an urge{{if urge_timer}} and offers a short breathing timer{{end}}; it is not counted as a bite and does not reset your streak. Both can be undone from the confirmation that appears after the tap.\n\nBelow them are your current streak, today\'s count and your recent entries, in the same words as the History tab on your computer.\n\nThe phone view is chosen by the device: a phone gets it, and so does a computer that reports no camera. A tablet or a laptop keeps the full app, and "Open the full app on this device" is always on the screen.',
      },
      {
        heading: 'How do you put it on your home screen?',
        body: 'On Android, your browser offers to install it, and the installed icon shows two shortcuts when you hold it down: "I bit" and "I feel an urge". On an iPhone, open the page in Safari, tap Share, then Add to Home Screen. Apple ignores the shortcuts, but you can make your own in the Shortcuts app that opens stopbiting.today with ?action=bite on the end.\n\nOnce it has been opened online, logging works without a connection: entries are saved on the phone first.',
      },
      {
        heading: 'Where do the entries go?',
        body: '{{if event_sync}}Entries stay on the phone unless you turn on sync in Settings. With sync on, the entries you log on your phone are copied to your account and your computer shows them; it can take a few minutes to arrive. Sync is off until you switch it on, and only the small entry records are sent, never a camera image or a photo.{{else}}Entries stay on the phone. They are not copied to your account or to your computer, and clearing the browser data on the phone removes them.{{end}}',
      },
      {
        heading: 'Which account does it use?',
        body: `The same one as on your computer. You sign in the usual way, and the ${TRIAL_HYPHEN} free trial and the plans apply exactly as they do on a computer. Signing in and paying use the network, as always. An account whose trial has ended sees the paywall instead of the phone screen.`,
      },
      faqSection(
        'Short answers about the phone screen.',
        [
          ['Does it detect biting on a phone?', 'No. There is no camera use and no detection on the phone. The alarm needs a laptop or desktop with a webcam; the phone is for logging.'],
          ['How many taps does it take to log a bite?', 'One to log it, and a second if you want to say what set it off. {{if urge_timer}}Logging an urge is one tap to open the breathing timer and one to start it.{{else}}Logging an urge is one tap.{{end}}'],
          ['Can I still send the link to my computer?', 'Yes. "Send the link to my computer" stays on the screen for setting up the alarm on a desktop.'],
          ['Does it work without a connection?', 'Once it has been opened online and installed, logging works without one and the entries are kept on the phone.'],
          ['Is there a separate app to download?', 'No. It is the same web app, added to your home screen.'],
        ],
      ),
    ],
    relatedPosts: [
      { href: '/how-it-works', label: 'How Stop Biting works' },
      { href: '/pricing', label: 'Pricing and free trial' },
      { href: '/features/habit-reversal-coaching', label: 'Coaching after the alarm' },
    ],
  };
}

function getShareWithTherapistContent(): PageContent {
  return {
    title: 'Share your progress with a therapist or a friend',
    subtitle: 'A read-only link to a plain summary. You decide who gets it, for how long, and you can revoke it',
    intro: 'If you work with a therapist or a coach, or want a friend or partner to hold you accountable, you can make a read-only link to a summary of your bites, what tends to set them off and your streak. The person you give it to needs no account. By default the link shows counts without dates, it expires, and it stops working the moment you revoke it. It shows no photos and none of your account details. An app is not a clinician: the summary is something to talk about, not advice.',
    sections: [
      {
        heading: 'What does the link show?',
        body: 'A single calm page with:\n\nYour streak, in whole days.\n\nThe number of bites in the last 7 days, the 7 days before that and the last 12 weeks, with 28 daily and 12 weekly counts as a simple chart.\n\nWhat tends to set the bites off, counted in five groups: stress, focus, boredom, unknown and other.\n\nIf you use the coaching prompt, the share of your alarms that were followed by a finished competing response.\n\nBy default the chart shows positions, such as "4 weeks ago" or "today", not dates. If you switch on dates when you make the link, the page also shows day-level dates and a chart of the hours of the day. It never shows an exact time.',
      },
      {
        heading: 'What does it never show?',
        body: 'Never, with or without dates: your name, your email address, your account, your time zone, photos, the individual entries and their exact times, which hand it was, any note you wrote, the names of reasons you made yourself, or the label you gave the link. The label is only for your own list.\n\nThe page carries no analytics, sets no cookies and loads nothing from other sites, and search engines are told not to index it.',
      },
      {
        heading: 'How do you control it?',
        body: 'In Settings, under Sharing, you make a link and choose when it expires: 7, 30 or 90 days, or never. You can have up to five active links at once, each with its own label, and you see when each was last opened. Revoke any of them with one button. A revoked, expired or mistyped link all give the same plain "not found" page, so nobody can tell which it was.\n\nThe address is the key: anyone who has it can open the page until it expires or you revoke it, so send it only to people you trust. Some chat apps open a link to show a preview, and that can count as it being opened.',
      },
      {
        heading: 'Where does the summary come from?',
        body: '{{if event_sync}}From the history you have synced to your account. Sync is off until you switch it on in Settings, and a link made with sync off shows "no history yet".{{else}}From the history you have synced to your account, so a link shows nothing until history has been synced.{{end}} The summary is worked out on our server from your synced entries when the page is opened, and only the summary is shown to the person with the link. The streak can differ a little from the one in the app, because the app counts from the date it first opened on each device. The page says so.\n\nThere is also a Print button that fits the summary on one page, for an appointment.',
      },
      faqSection(
        'Short answers about sharing.',
        [
          ['Does the other person need an account?', 'No. They open the link in a browser and see the summary.'],
          ['Can I take it back?', 'Yes. Revoking a link ends it at once. Links also expire by themselves unless you chose never.'],
          ['Will they see when I bit?', 'Not by default. The default summary shows counts and groups without dates. Dates and the hours of the day appear only if you switch them on for that link.'],
          ['Can they see my photos or my camera?', 'No. Photos stay on your device and are never part of a summary. A summary is built from your logged entries only, never from the camera.'],
          ['Is this medical advice or a report for a clinician?', 'No. It is a plain summary of your own logs. An app is not a clinician, and what the summary means is for you and the person you share it with to talk about.'],
        ],
      ),
      MEDICAL_DISCLAIMER_SECTION,
    ],
    relatedPosts: [
      { href: '/blog/nail-biting-accountability-partner', label: 'Nail biting and an accountability partner' },
      { href: '/blog/bfrb-guide', label: 'BFRB guide' },
      { href: '/features/habit-reversal-coaching', label: 'Coaching after the alarm' },
    ],
  };
}

function getReferralProgramContent(): PageContent {
  return {
    title: 'Refer a friend: you both get bonus access',
    subtitle: 'A personal link, one reward when someone you refer pays for the first time, and the checks that keep it fair',
    intro: 'Every signed-in account has a personal link. When someone signs up through it and later pays for the first time, you both get {{REFERRAL_CREDIT}} of bonus access. The days are saved and start by themselves once your trial or plan is not covering you. If that payment is refunded, the bonus days are taken back.',
    sections: [
      {
        heading: 'How does it work?',
        body: 'Your link is in Settings, under Account and Sync, in a card called "Refer a friend". It looks like stopbiting.today with a short code on the end. Anyone who opens it has the code remembered in their browser for 30 days. When they create an account, the app tells our server once which link they came from.\n\nThe reward is paid when their first payment completes. Not the free trial and not a renewal. Then you both get {{REFERRAL_CREDIT}} of bonus access.',
      },
      {
        heading: 'When do the bonus days start?',
        body: 'They are saved, and they start by themselves when the account has no other access: no running trial, no subscription and no other bonus. So a referral never gives you days on top of a month you are already paying for; it covers the next gap instead. Bonus days from several referrals are used one after another.',
      },
      {
        heading: 'What is checked?',
        body: 'The program is for real referrals, so a few things are checked:\n\nYou cannot refer yourself, and variations of the same email address do not count as a different person.\n\nA payment made with the same card as yours does not earn a reward.\n\nA link counts only for a new account, within a week of it being created and before it has paid.\n\nEach person you refer can earn one reward. A refund or a chargeback of the payment takes the bonus days back from both sides.\n\nThese checks are not perfect, and a reward is only ever paid after a real, unrefunded payment.',
      },
      {
        heading: 'What does the person you refer get?',
        body: 'The same free trial everyone gets, with no card needed, and then the same plans and prices. If they pay, they get the same {{REFERRAL_CREDIT}} of bonus access that you do.',
      },
      faqSection(
        'Short answers about the referral link.',
        [
          ['Where do I find my link?', 'In Settings, under Account and Sync. You need to be signed in.'],
          ['When do I get my bonus access?', 'After the person you referred pays for the first time, and once your trial or plan is not covering you.'],
          ['Is there a payment before the reward?', 'Yes. Signing up through your link is not enough: the reward is paid only after their first real payment.'],
          ['What if they ask for a refund?', 'The bonus days are taken back from both of you.'],
          ['Does the link follow people around?', 'It is a short public code, not a secret, and a visitor\'s browser keeps it for 30 days and then forgets it. It is only used if they sign up.'],
        ],
      ),
    ],
    relatedPosts: [
      { href: '/pricing', label: 'Pricing and free trial' },
      { href: '/how-it-works', label: 'How Stop Biting works' },
      { href: '/refund-policy', label: 'Refund policy' },
    ],
  };
}

// TODO(owner): this page describes the desktop app as it will be AFTER three things are done, and
// the flag stays off until then (docs/agents/ws11b-notes.md, top of the file):
//   1. signing in from the desktop app works against the hosted API (it does not today),
//   2. the macOS build is signed and notarized (docs/DESKTOP_SIGNING.md),
//   3. you have decided where the installer is linked from (add the link to a section here; nothing
//      on this page points at /downloads/*, whose old v1.1.0 entries predate the current app).
// Sentences that are only true after (1) are marked "account" in the notes. A Windows build is
// configured but has never been built or run, so this page does not offer it.
function getDesktopAppContent(): PageContent {
  return {
    title: 'Stop Biting for Mac: a desktop app that keeps watching',
    subtitle: 'The same detection in its own window, with a menu bar icon, pause controls and an option to start at login',
    intro: 'The desktop app is the Stop Biting web app in its own window, for people who want it to keep watching without a browser tab open. Closing the window hides it to the menu bar instead of quitting, and a menu there lets you pause, start and stop. It is the same account and the same detection as in the browser, which stays available. ' + PRIVACY_LINE + ' Signing in and paying use the network.',
    sections: [
      {
        heading: 'What does the desktop app add to the browser version?',
        body: 'A menu bar icon with a menu: open the window, see whether it is watching or paused, start or stop watching, pause for 15 minutes, for an hour or until tomorrow, resume, turn "Launch at login" on or off, and quit.\n\nClosing the window hides the app to the menu bar. Detection is built to keep running with the window hidden, so you do not need a tab in front or the Minimize window.\n\nNative notifications for the alarm.\n\nA plain explanation of why the app needs your camera, shown before macOS asks for permission.',
      },
      {
        heading: 'Does it start by itself?',
        body: 'Only if you ask. "Launch at login" is off until you switch it on in the menu bar menu. Quitting from that menu really quits the app.',
      },
      {
        heading: 'What does it share with the web app?',
        body: 'The detection, the alarm, the sounds and the sensitivity settings. It is the same Stop Biting: the same account, the same plans and the same free trial for a new account. Its history is kept in the app, on that computer, and is separate from the one in your browser. Your camera feed is not sent anywhere while detection runs. Signing in and paying use the network, as they do in the browser.',
      },
      {
        heading: 'Which computers does it run on?',
        body: 'A Mac. One installer covers Apple silicon and Intel Macs. There is no Windows version yet; on Windows, the browser version works as before.',
      },
      faqSection(
        'Short answers about the desktop app.',
        [
          ['Do I need the desktop app?', 'No. The browser version does the same detection. The desktop app is for people who want it to keep running from the menu bar with the window closed.'],
          ['Does it keep watching with the window closed?', 'Yes, that is what it is built for. Closing the window hides the app to the menu bar; use Quit in the menu to stop it.'],
          ['Will it start when I log in?', 'Only if you switch "Launch at login" on in the menu bar menu. It is off by default.'],
          ['Is there a Windows version?', 'Not yet.'],
          ['Is my camera feed sent anywhere?', PRIVACY_LINE],
        ],
      ),
    ],
    relatedPosts: [
      { href: '/how-it-works', label: 'How Stop Biting works' },
      { href: '/solutions/for-mac', label: 'Stop nail biting on a Mac' },
      { href: '/pricing', label: 'Pricing and free trial' },
    ],
  };
}

function getCuticleBitingContent(): PageContent {
  return {
    title: 'Cuticle and skin biting: the same mouth alarm, logged under its own name',
    subtitle: 'What Stop Biting does for biting the skin around your nails, and how early that is',
    intro: 'Stop Biting does not have a separate detector for cuticle or skin biting. It uses the one check it uses for nail biting, a fingertip held near your mouth for about 0.6 seconds, and it cannot tell nails from cuticles. What you can do is choose which behavior your alerts are recorded as, so that History and your charts show "Cuticle and skin biting" instead of "Nail biting". This is early. So far the check has been tried on scenes made up for testing, not on footage of real people, and we publish no accuracy figure.',
    sections: [
      {
        heading: 'How do you use it for cuticle and skin biting?',
        body: 'In Settings, under Behaviors, choose "Cuticle and skin biting". The alarm itself is unchanged: it fires when a fingertip stays near your mouth. From then on, the alarms are recorded under the new name, and the History filter lets you look at that behavior on its own once more than one is in your history.\n\nNail biting and cuticle and skin biting share one check, so only one of them can be on at a time. Pick the one that fits you best.',
      },
      {
        heading: 'How well does it work?',
        body: 'We do not know yet, and we would rather say that than guess. The check was tested on recorded hand and face positions generated for testing, not on footage of real people biting their cuticles. It can only see a fingertip near your mouth, so it can fire when you rest your chin on your fingers, drink, or cover a yawn, and it can miss a bite that does not bring a fingertip to your mouth. Expect false alarms and misses, and tell us what you find.\n\nWe publish no accuracy numbers for this behavior because we have none from real people.',
      },
      {
        heading: 'What does this page not claim?',
        body: 'It makes no claim about skin picking elsewhere on your face or body, nose picking or hair pulling. It covers biting only, the same mouth check as for nail biting.\n\nIt also makes no medical claim. Stop Biting is not a treatment or a replacement for a therapist, and biting that hurts you, bleeds or worries you is worth raising with a doctor or a therapist who knows body-focused repetitive behaviors.',
      },
      {
        heading: 'What stays the same?',
        body: `${PRIVACY_LINE} The alarm, the sensitivity settings, the sounds, the streak and your history work as they do for nail biting. Sign-in and payments use the network.`,
      },
      faqSection(
        'Short answers about cuticle and skin biting.',
        [
          ['Is cuticle biting detected differently from nail biting?', 'No. It is the same check, a fingertip held near your mouth. What changes is the name your alerts are recorded under.'],
          ['Why can I only have one of the two on?', 'They share a single check, so recording an alarm under both names would count it twice.'],
          ['Is it accurate?', 'We have not measured it on real people for this behavior, so we do not claim an accuracy. It has been tried on made-up test scenes only.'],
          ['Does it detect skin picking, nose picking or hair pulling?', 'This page does not claim that. It covers biting around the nails and uses the same mouth check as nail biting.'],
          ['What if it goes off when I am not biting?', 'It can, for example when your chin rests on your fingers. The sensitivity setting in Settings can reduce this.'],
        ],
      ),
      MEDICAL_DISCLAIMER_SECTION,
    ],
    relatedPosts: [
      { href: '/blog/nail-and-cuticle-picking', label: 'Nail and cuticle picking' },
      { href: '/how-it-works', label: 'How Stop Biting works' },
      { href: '/blog/how-to-stop-nail-biting', label: 'The complete guide to stopping nail biting' },
    ],
  };
}

export const FEATURE_PAGE_MAP: Record<string, () => PageContent> = {
  '/features/habit-reversal-coaching': getHabitReversalCoachingContent,
  '/features/phone-companion': getPhoneCompanionContent,
  '/features/share-with-therapist': getShareWithTherapistContent,
  '/features/referral-program': getReferralProgramContent,
  '/features/desktop-app': getDesktopAppContent,
  '/solutions/cuticle-biting': getCuticleBitingContent,
};
