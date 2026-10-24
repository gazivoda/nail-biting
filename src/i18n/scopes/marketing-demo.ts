// Scope "marketing-demo" (WS12b): the words of the 60-second live demo on the home page (src/components/demo/HeroDemo.tsx).
// Kept apart from marketing-home because the demo is a lazy chunk (it pulls in MediaPipe): its words ride in that chunk,
// and a page view that never starts the demo never loads them. The camera and model error sentences are the app's own
// (scope "watch", shared with the signed-in app); a visitor who starts the demo on a localized page fetches that
// catalog too (Landing does it on the click).
import { createScope } from '../scope.ts';

export const messages = {
  'start': 'Try the live demo',
  'retry': 'Try again',
  'again': 'Run it again',
  'loading': 'Downloading AI models (~20 MB, one time)…',
  'hint': 'Bring a fingertip to your lips to hear the alarm',
  'offer': '{trialDaysText} free, no card',
  'result': '{count, plural, =0 {Nothing caught in 60 seconds. Run it again and touch your lips to hear the alarm.} one {Caught you once in 60 seconds. The app does this all day, while you work.} other {Caught you # times in 60 seconds. The app does this all day, while you work.}}',
  'catch': "That's the alarm. Caught {count, plural, one {once} other {# times}} so far.",
  'failure': 'You can still <trial>start the free trial</trial> ({offer}) or read <how>how detection works</how>.',
} satisfies Record<string, string>;

export const { t, useT } = createScope('marketing-demo', messages);
