// Scope "marketing-about" (WS12b): the /about page, the founder's story. The same words are the server-rendered article
// (server.js for English, dist/i18n/<locale>.json for the other languages).
//
// The third privacy paragraph depends on the optional history sync (flag event_sync): English words it through
// shared/flagCopy.js (copy()), the other languages through the {sync, select, ...} in their message.
import { createScope } from '../scope.ts';

export const messages = {
  'bc.about': 'About',
  'hero.title': 'About Stop <hl>Biting</hl>',
  'hero.lede': "Built by a nail biter, for nail biters. Here's why this app exists.",

  'story.heading': "The founder's story",
  'story.p1': "I'm Igor Gazivoda, a software developer. I bit my nails for over 20 years. Not occasionally: constantly, automatically, without noticing until the damage was already done.",
  'story.p2': "I tried everything: bitter polish, reminder bands, sheer willpower. They all failed the same way. The habit is automatic. It happens below the threshold of conscious awareness. By the time I noticed my hand was in my mouth, I'd already been biting for 30 seconds.",
  'story.p3': "When I read the research on Habit Reversal Training, I understood why everything else had failed. HRT's core insight is that awareness is the bottleneck: you can't interrupt a habit you don't know is happening. The gold-standard treatment literally starts with \"awareness training\" before anything else.",
  'story.p4': 'I had a webcam. I knew how to code. I knew MediaPipe could run hand tracking on-device. So I built the awareness component, the part of HRT that is hardest to do alone.',

  'does.heading': 'What Stop Biting does',
  'does.p1': "Stop Biting uses your computer's webcam and Google's MediaPipe framework (compiled to WebAssembly and running entirely in your browser) to detect when your hand moves toward your mouth. When it does, an audible alarm fires.",
  'does.p2': 'That alarm is the external awareness signal that HRT research identifies as the most critical component of the treatment. It catches the episodes that self-monitoring misses. Most of them happen without you noticing.',
  'does.p3': 'The app also logs each detection with a timestamp, so you can see your actual biting frequency, not your estimated frequency. A real count, rather than a guess, is what turns the habit into something you can work on.',

  'privacy.heading': 'Privacy: the non-negotiable',
  'privacy.p1': "The app uses your webcam. This requires trust. I've designed it so that trust can be verified, not just promised.",
  'privacy.p2': 'All video processing runs in WebAssembly on your device. No video, no frames and no detections are transmitted. You can disconnect your internet connection after the app loads and it will function identically. You can verify this by watching your network traffic while the app runs.',
  'privacy.p3': 'Your alarm and bite log is stored in your browser. The site counts page visits with Google Analytics; that never includes anything from your camera.',

  'tech.heading': 'The technology',
  'tech.p1': "The detection model is built on <link>Google MediaPipe's Hand Landmarker</link>, which locates 21 hand landmarks. Stop Biting runs it five times a second. The model runs in WebAssembly (a sandboxed binary execution format supported by all modern browsers), meaning it has no network access and cannot read files outside the browser sandbox.",
  'tech.p2': 'The mouth proximity detection compares hand landmark coordinates to facial landmark coordinates in each frame. When a hand landmark is within detection threshold of the mouth region for a sustained period, the alarm triggers.',

  'site.heading': 'How this site is written',
  'site.p1': "Every article, guide and comparison here is written by me. I'm a developer, not a clinician, and the <link>editorial policy and corrections page</link> says exactly what that means for what you read: how claims are sourced, how anything I say about a competing product is checked, and how to tell me when something on this site is wrong.",
} satisfies Record<string, string>;

export const { t, useT } = createScope('marketing-about', messages);
