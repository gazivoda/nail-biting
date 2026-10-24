// Scope "phone": The phone view.
// English is the source of truth. Add a key here, then the same key to
// src/i18n/locales/{es,de,pt-BR}/phone.ts (the compiler lists what is missing).
import { createScope } from '../scope';

export const messages = {
  // Home: greeting. The name (or "there") is the marked word, so each language chooses what to mark.
  'home.greeting.named': '{part, select, morning {Good morning} afternoon {Good afternoon} other {Good evening}}, <name>{name}</name>.',
  'home.greeting.anon': '{part, select, morning {Good morning, <name>there</name>.} afternoon {Good afternoon, <name>there</name>.} other {Good evening, <name>there</name>.}}',
  'home.freePlan': 'Free plan.',
  // Both forms read "N days" in English because that is what the screen has always said (the window is 7 or more days).
  // The other languages have a real singular.
  'home.freePlanHistory': 'Free plan: History shows your last {days, plural, one {{days} days} other {{days} days}}.',
  'home.trial': 'Free trial: {left}.',
  'home.choosePlan': 'Choose a plan',
  'home.logAria': 'Log',
  'home.bite': 'I bit',
  'home.urge': 'I feel an urge',
  'home.send.share': 'Send the link to my computer',
  'home.send.email': 'Email me the link for my computer',
  'home.openFull': 'Open the full app on this device',

  // The pill on each recent entry (src/phone/history.ts)
  'entry.bite': 'Bite',
  'entry.biteWith': 'Bite, {reason}',
  'entry.urgeDone': '{urge}, timer finished',
  'entry.notBite': 'Not a bite',
  'entry.alarm': 'Alarm',

  // Today's line: "2 bites, 1 urge today". The counts are joined with ", " and put in {list}.
  'today.none': 'Nothing logged today',
  'today.some': '{list} today',
  'today.bites': '{count, plural, one {{count} bite} other {{count} bites}}',
  'today.urges': '{count, plural, one {{count} urge} other {{count} urges}}',
  'today.alarms': '{count, plural, one {{count} alarm to review} other {{count} alarms to review}}',

  // The confirmation after a log
  'toast.urge': 'Urge logged. Your streak is not affected.',
  'toast.bite': 'Bite logged. Your streak starts again from now.',
  'toast.biteWith': 'Bite logged: {reason}. Your streak starts again from now.',
  'toast.question': 'What set it off? You can skip this.',

  // Recent list
  'recent.title': 'Recent',
  'recent.all': 'All history',
  'recent.empty': 'Nothing logged yet. Tap a button above when it happens.',

  // Where entries live
  'sync.phoneOnly': 'Stored on this phone only.',
  'sync.phoneOnlyCanSync': 'Stored on this phone only. Turn on sync in Settings to see it on your computer.',
  'sync.on': 'Sync is on, so your computer sees these entries.',
  'sync.openSettings': 'Open Settings',
} satisfies Record<string, string>;

export const { t, useT } = createScope('phone', messages);
