// Scope "marketing-how" (WS12b): the /how-it-works page. The h1, the lede, "Why awareness is the bottleneck", the five steps
// and the five questions are also the server-rendered crawler copy and the HowTo / FAQPage structured data (server.js for
// English, dist/i18n/<locale>.json for the other languages): the page and its schema are made from the same messages.
//
// Two messages depend on the optional history sync (flag event_sync): the incident-log row and the first answer. English
// words them through shared/flagCopy.js (copy()), the other languages through the {sync, select, ...} in their message.
//
// The four "Learn more" links are article titles. The articles are English only, so the titles are the same in every
// language (the locale files repeat them on purpose); they live here so no English sits in the page's code.
import { createScope } from '../scope.ts';

export const messages = {
  'bc.how': 'How it works',
  'hero.title': 'How AI nail biting <hl>detection</hl> works',
  'hero.lede': 'Stop Biting uses MediaPipe and WebAssembly to detect nail biting in real time, entirely on your device. The MediaPipe Hand Landmarker tracks 21 hand landmarks, and the alarm fires about 0.6 seconds after it sees your hand approaching your mouth. Setup takes under two minutes.',
  'figure.alt': 'Stop Biting Watch screen with a large streak counter, alarms and bites today, and detection running.',
  'figure.caption': 'The Watch screen, shown with example data.',

  'why.heading': 'Why awareness is the bottleneck',
  'why.body': "Most biting episodes happen without you noticing: the habit is automatic, and it runs below the threshold of conscious awareness. <link>Habit Reversal Training</link> (the gold-standard treatment) identifies awareness training as its most critical component. Stop Biting automates that component: it catches the episodes you don't notice.",

  'steps.heading': 'Getting started',
  'step.1.title': 'Open the app',
  'step.1.body': 'Visit stopbiting.today in Chrome, Edge, or Firefox. There is nothing to install.',
  'step.2.title': 'Grant camera access',
  'step.2.body': 'Allow webcam access. The video feed is processed entirely on your device by MediaPipe running in WebAssembly. No camera data is sent while it runs.',
  'step.3.title': 'Position your camera',
  'step.3.body': 'Make sure your face and hands are visible in the camera view. The AI tracks 21 hand landmarks and detects when they approach the mouth region.',
  'step.4.title': 'Work, game, or study normally',
  'step.4.body': 'Stop Biting runs in the background, checking five times a second. It needs three consecutive frames before it acts, so an alarm fires about six tenths of a second after your hand starts moving to your mouth.',
  'step.5.title': 'Respond to the alarm',
  'step.5.body': 'The alarm is your awareness signal. Do the hand exercise the app suggests, such as pressing your palms flat or clenching a fist: a competing response your hands cannot do while biting. Doing it every time is the core of habit reversal training.',

  'specs.heading': 'Technical specifications',
  'spec.1.label': 'Detection model',
  'spec.1.value': 'Google MediaPipe Hand Landmarker (21 landmarks)',
  'spec.2.label': 'Processing',
  'spec.2.value': 'WebAssembly: sandboxed, runs on your device',
  'spec.3.label': 'Alarm latency',
  'spec.3.value': 'About 0.6 seconds after your hand starts moving to your mouth',
  'spec.4.label': 'Incident logging',
  'spec.4.value': 'Timestamped log stored locally, never transmitted',

  'faq.heading': 'Common questions',
  'faq.1.q': 'What happens to my camera data?',
  'faq.1.a': 'It is processed frame by frame on your device by the MediaPipe WASM binary running locally. No camera data is sent while it runs. Signing in and paying use the network, and you can check this yourself by watching your network traffic while the app runs.',
  'faq.2.q': 'Does it work on Mac, Windows, and Linux?',
  'faq.2.a': 'The web app works on any device with a modern browser and webcam: Mac, Windows, Linux, and Chromebook.',
  'faq.3.q': "Will it false-alarm when I'm eating or touching my face?",
  'faq.3.a': 'The detection model distinguishes sustained hand-to-mouth proximity from brief touches, and sensitivity can be adjusted in settings.',
  'faq.4.q': "Does it work if I'm not at the camera?",
  'faq.4.a': 'Detection needs your face and hands in frame. At a desk you are usually in frame anyway.',
  'faq.5.q': 'Does it work in the dark?',
  'faq.5.a': "Detection accuracy drops in poor lighting. A desk lamp or ordinary room light is enough; you don't need anything special.",

  'learn.heading': 'Learn more',
  'learn.note': 'These articles are in English.',
  'link.1': 'Habit Reversal Training: the clinical method behind the app',
  'link.2': 'Stop Biting app review: what to expect in the first two weeks',
  'link.3': 'How we verified on-device processing',
  'link.4': 'Stop Biting vs bitter nail polish: which works?',
} satisfies Record<string, string>;

export const { t, useT } = createScope('marketing-how', messages);
