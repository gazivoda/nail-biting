// Scope "marketing-home" (WS12b): the home page (/, /es, /de, /pt-br), its contact form and the questions at the bottom.
// The pricing cards are in marketing-chrome (the /pricing page draws them too) and the live demo's own words are in
// marketing-demo (they ride in the demo's lazy chunk).
//
// The same words are the server-rendered crawler copy and the FAQPage structured data (server.js for English,
// dist/i18n/<locale>.json for the other languages): the page, its article and its schema are made from these messages.
//
// Messages that depend on something the visitor or the owner changes:
//   {methods}      the sign-in methods ("Google"), English words them through shared/flagCopy.js (copy());
//   {sync, ...}    the optional history sync (flag event_sync): English through copy(), the others in the message;
//   {phone, ...}   the phone companion (flag phone_companion): the same.
// The answer to "Do I need a Google account?" has a second form for when another sign-in method is on; the pieces are
// the faq.10.alt.* messages (English: shared/flagCopy.js signInAnswer, which a test compares them with).
//
// The guide titles are the titles of English articles, so they are the same in every language (the locale files repeat
// them on purpose); they sit here so no English is written in the page's code.
import { createScope } from '../scope.ts';

export const messages = {
  // ── Hero ──
  'authError.cancelled': 'Sign-in was cancelled, so nothing was set up. You can try again whenever you like.',
  'authError.failed': "Sign-in didn't finish, so nothing was set up. Please try again.",
  'authError.retry': 'Try again',
  'authError.dismiss': 'Dismiss',
  'hero.aria': 'Hero',
  'hero.title': 'Stop <hl>biting</hl> your nails.',
  'hero.lede': 'Your webcam watches your hands while you work. The moment a fingertip reaches your lips, an alarm sounds, so you catch the bites you would otherwise never notice.',
  'hero.howLink': 'How to start',
  'hero.note1': 'Made for a laptop or desktop with a webcam.',
  'hero.note2': 'Detection runs on your device and sends no camera data while it runs. Sign in with Google (it opens in a new tab). Cancel anytime.',
  'hero.sticker.trial': '{trialDaysText} free, no card',
  'hero.sticker.privacy': 'No camera data is sent while it runs',
  'hero.shot.alt': 'Stop Biting Watch screen with a large streak counter, alarms and bites today, and detection running.',
  'hero.shot.caption': 'The Watch screen, shown with example data.',

  // ── Live demo (the heading and paragraph render on page view; the demo itself is in marketing-demo) ──
  'demo.heading': 'Try the detector right now',
  'demo.intro': 'The same detector the app uses, on your own camera, before you sign up for anything.',
  'demo.start': 'Try the live demo',
  'demo.small': 'Runs on your own camera for 60 seconds, no account needed. Your browser will ask for camera access first. Turn your sound on. About 20 MB of AI models download once; after that, no video leaves the page.',
  'demo.loading': 'Downloading AI models (~20 MB, one time)…',

  // ── The tape (decorative) and the loop ──
  'tape.1': 'Notice it',
  'tape.2': 'Interrupt it',
  'tape.3': 'Replace it',
  'tape.4': 'Repeat',
  'loop.heading': 'A habit loop, <mark>broken</mark> in three moves',
  'loop.1.title': 'Notice',
  'loop.1.body': 'The alarm catches the bite you would never have noticed. Most of them happen on autopilot.',
  'loop.2.title': 'Interrupt',
  'loop.2.body': 'It sounds the moment a fingertip reaches your lips, while the habit is still automatic.',
  'loop.3.title': 'Replace',
  'loop.3.body': 'Press your palms flat or clench a fist. That part is yours, and it is what makes the habit fade.',

  // ── History ──
  'history.heading': 'Every catch ends up in <mark>History</mark>',
  'history.body': 'Each alarm and each bite you log lands here with the time. Tag what set it off (stress, boredom, deep focus) and after a week you can see which one is yours.',
  'history.sticker': 'Tag what set it off',
  'history.alt': "The History screen on a phone: each day's alarms and bites with their times, an alarm waiting to be reviewed, and bites tagged with what set them off, such as Deep focus.",
  'history.caption': 'Shown with example data.',

  // ── How to start ──
  'how.heading': 'How to start',
  'how.lede': "Sign in with Google (it opens in a new tab), allow the camera, and get on with your work. When your hand reaches your mouth, it goes off. That's the whole setup.",
  'how.small': "It runs in your desktop browser, so there's nothing to download. You can install it like an app later if you want it one click away.",
  'how.before': 'Before you start',
  'how.b1': "You need a webcam and a laptop or desktop browser. It's made for the hours you spend at a screen.",
  'how.b2': 'Keep the app open while you work. If you switch to another tab, press Minimize so a small window keeps watching.',
  'how.b3': 'It reacts to a hand near your mouth, not only to biting, so resting your chin on your fingers can set it off. Sensitivity has three levels.',
  'how.b4': 'It makes a noise. Pick a quieter sound, turn it down, or use a screen flash instead.',
  'how.b5': "Your history is stored in this browser, so it doesn't follow you to another computer.",

  // ── Science ──
  'science.heading': "Why an alarm works when <mark>willpower</mark> doesn't",
  'science.p1': "Nail biting runs on autopilot: by the time you notice, you're already doing it. That is why bitter polish and willpower rarely stick. The method with the strongest evidence, habit reversal training, starts with one hard step: noticing every time.",
  'science.p2': "In a clinic, a therapist would tap your shoulder. The alarm is that tap, available all day while you work. What you do next (press your palms flat, clench a fist) is the other half of the method, and it's yours.",
  'science.p3': 'An app is not a clinician. For severe or distressing biting, the <link>TLC Foundation for Body-Focused Repetitive Behaviors</link> lists BFRB-informed therapists.',
  'science.guideLink': 'Read the habit reversal training guide',
  'science.stat1': 'Somewhere <strong>between 20 and 30% of adults</strong> bite their nails chronically (Halteh, Scher & Lipner, 2017).',
  'science.stat2': "In the landmark habit reversal trial, participants' own daily counts fell by <strong>about 99% over five months</strong> (Azrin, Nunn & Frantz, 1980). That trial had a therapist teaching the method and people practising it every day. The app does the noticing part; the rest is still yours.",
  'science.ref1': 'Azrin, Nunn & Frantz (1980), Behaviour Research and Therapy',
  'science.ref2': 'Bate et al. (2011), Clinical Psychology Review meta-analysis',
  'science.pubmed': '(PubMed)',

  // ── Privacy ──
  'privacy.heading': 'Your camera never leaves <hl>your device.</hl>',
  'privacy.p1': 'A camera pointed at you all day is a lot to trust an app with, so detection runs entirely in your browser, on your own computer. No camera data is sent while it runs. Signing in and paying use the network.',
  'privacy.p2.lead': 'Check it yourself:',
  'privacy.p2.rest': "open your browser's developer tools, go to the Network tab and start detection. Once the detection models have downloaded, nothing carrying camera data is sent while it watches. It keeps working with the Wi-Fi off, and your history lives in this browser: clear the site's data and it's gone.",

  // ── Why this exists ──
  'maker.heading': 'Why this exists',
  'maker.p': 'I bit my nails for over twenty years. Bitter polish, reminder bands, willpower: none of it lasted, because I never noticed I was doing it until the damage was done. I write software and I had a webcam, so I built the thing that notices for me.',
  'maker.name': 'Igor Gazivoda',
  'maker.more': 'The longer story',

  // ── Questions (also the FAQPage structured data) ──
  'faq.heading': 'Questions people ask about nail biting',
  'faq.1.q': 'What is Stop Biting and how does it work?',
  'faq.1.a': 'Stop Biting is a webcam app that catches nail biting as it happens. You open it in your browser, allow the camera, and carry on with your work. On-device AI from Google MediaPipe checks 21 hand landmarks and your face mesh five times a second, and when your hand stays near your mouth for about six tenths of a second, an alarm sounds. That alarm is the awareness signal habit reversal training depends on: it interrupts the habit while it is still automatic. Each alert is logged in your browser, so you can tag what set it off, such as stress, boredom or deep focus, and watch your streak grow. Detection runs entirely on your device. No camera data is sent while it runs. It costs $2.99 a month or $29 a year after a {trialHyphen} free trial with no card. It is not a medical treatment or a replacement for a therapist.',
  'faq.2.q': 'Why do people bite their nails?',
  'faq.2.a': 'Nail biting (onychophagia) is a body-focused repetitive behaviour affecting up to 30% of adults (Lee and Lipner, 2022). Common triggers are stress, anxiety, boredom, and deep focus. The habit usually starts in childhood and becomes automatic, happening without conscious awareness. Genetic predisposition, perfectionism, and OCD-spectrum tendencies are also linked.',
  'faq.3.q': 'What are the best remedies to stop nail biting?',
  'faq.3.a': 'The evidence-based options are habit reversal training (the strongest by some margin), bitter-taste polishes like Mavala Stop, real-time awareness tools such as AI detection, competing response training, and stress reduction. Most people do best combining an awareness method with a competing response rather than relying on any single remedy.',
  'faq.4.q': 'What is habit reversal training for nail biting?',
  'faq.4.a': 'Habit reversal training (HRT) is a cognitive-behavioural method with three parts: awareness training, learning to notice every time you bite; a competing response, an incompatible action like clenching a fist or pressing your palms flat; and social support. In the original Azrin and Nunn clinical trial, participants who practised it consistently achieved a near-complete reduction in biting.',
  'faq.5.q': 'Is nail biting harmful?',
  'faq.5.a': 'Yes. Chronic nail biting causes dental damage including chipped teeth and jaw strain, nail fold infections, transfer of pathogens from fingers to mouth, and permanent nail deformity in severe cases. The visible damage also drives shame and social anxiety, which increases biting: a self-reinforcing cycle.',
  'faq.6.q': 'Does Stop Biting send my camera feed to the internet?',
  'faq.6.a': "No. Detection uses MediaPipe (Google's WebAssembly vision framework) running entirely on your device. Your camera feed is never uploaded, streamed, or stored anywhere outside it. Once the detection models have downloaded, nothing carrying camera data is sent while it watches: you can disconnect from the internet and it keeps working.",
  'faq.7.q': 'How long does it take to stop biting your nails?',
  'faq.7.a': 'Most people notice more biting in week one, because they are finally catching episodes they used to miss. No controlled trial has measured week-by-week biting frequency during self-directed habit reversal training, so treat any schedule, including ours, as an expectation rather than a measured result. The best-evidenced anchor is Lally et al. 2010: among the 39 volunteers whose data fitted the model, the median time for a new daily habit to become automatic was 66 days, with a range of 18 to 254. That is a general habit-formation figure, not one measured for nail biting.',
  'faq.8.q': 'Do I need a credit card, and can I cancel anytime?',
  'faq.8.a': 'No card is needed for the {trialHyphen} free trial. After that it is $2.99 a month or $29 a year, and you can cancel anytime from the app settings and keep access until the end of the paid period. Payments are handled by Paddle, so Stop Biting never sees your card details.',
  'faq.9.q': 'Does Stop Biting work on a phone?',
  'faq.9.a': 'It is made for a laptop or desktop with a webcam, because the detection needs a camera that can see your hands while you work. On a phone, use the Email me the link button to send yourself the address and open it on your computer.',
  'faq.10.q': 'Do I need a Google account to use it?',
  'faq.10.a': 'Accounts are created through Google sign-in, which gives us your name, email address and profile picture and never your Google password. The live demo on the homepage needs no account at all.',
  'faq.10.alt.intro': 'No. You can sign in with {methods}, so you do not need a Google account.',
  'faq.10.alt.google': 'Signing in with Google gives us your name, email address and profile picture and never your Google password.',
  'faq.10.alt.relay': '{who, select, apple {Signing in with Apple gives us the name and email address on that account (an Apple relay address if you hide yours) and never your password.} microsoft {Signing in with Microsoft gives us the name and email address on that account and never your password.} other {Signing in with Apple or Microsoft gives us the name and email address on that account (an Apple relay address if you hide yours) and never your password.}}',
  'faq.10.alt.magic': 'The emailed link needs only your email address.',
  'faq.10.alt.demo': 'The live demo on the homepage needs no account at all.',
  'faq.11.q': 'Is there an app that detects nail biting with a webcam?',
  'faq.11.a': "Yes. Several apps now watch for hand-to-mouth movement through a camera and interrupt the habit as it happens: Stop Biting, Hands Off (Mac and Windows), Nailed (a Mac menu bar app) and SmartBehavior (iPhone, Android and Windows). They differ in platform, price and which behaviours they cover. Stop Biting is our own product: it runs in a browser on a laptop or desktop with a webcam and detects nail biting only. Our comparison pages say where each of the others is the better fit, with details checked against each vendor's own site.",

  // ── Guides (English articles) ──
  'guides.heading': 'Featured guides',
  'guides.all': 'All {count} articles',
  'guides.note': 'The guides are in English.',
  'start.1': "Start here if you've tried polish and given up.",
  'start.2': 'For when you want to know why you bite, not just when.',
  'start.3': "If you're deciding between this and bitter polish.",
  'guide.1': 'How the AI nail biting detection works',
  'guide.2': 'Habit Reversal Training: the science behind stopping nail biting',
  'guide.3': 'How to stop nail biting: the complete guide',
  'guide.4': 'The 30-day plan to stop biting your nails',
  'guide.5': 'Trigger mapping: find out when you actually bite',
  'guide.6': 'Best apps to stop nail biting (2026)',
  'guide.7': 'Every nail biting remedy, ranked by evidence',
  'guide.8': 'The real health risks of nail biting',
  'guide.9': 'Nail biting in children: a guide for parents',
  'guide.10': 'Stop Biting vs bitter nail polish: which works?',
  'guide.11': 'Can an app help? The camera approach, in depth',

  // ── Contact form ──
  'contact.heading': 'Get in touch',
  'contact.intro': 'Questions, bugs, a false alarm that annoyed you: this goes straight to my inbox.',
  'contact.name': 'Name',
  'contact.namePh': 'Your name',
  'contact.email': 'Email',
  'contact.emailPh': 'you@example.com',
  'contact.message': 'Message',
  'contact.messagePh': 'What happened?',
  'contact.sent': "Sent. I'll get back to you soon.",
  'contact.error': 'Something went wrong. Please try again or email us at hello@stopbiting.today.',
  'contact.send': 'Send message',
  'contact.sending': 'Sending…',
} satisfies Record<string, string>;

export const { t, useT } = createScope('marketing-home', messages);
