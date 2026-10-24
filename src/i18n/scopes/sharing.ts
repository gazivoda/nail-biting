// Scope "sharing": Settings: sharing links and the weekly email.
// English is the source of truth. Add a key here, then the same key to
// src/i18n/locales/{es,de,pt-BR}/sharing.ts (the compiler lists what is missing).
//
// Only the Settings cards are translated. The public share page and the weekly email itself are rendered
// by the server (server/share/page.js, server/weeklyEmail/*) and stay English.
import { createScope } from '../scope';

export const messages = {
  // src/share/copy.ts: the words for the card and for the state of a link
  'intro': 'Show a read-only summary to someone you choose, like a therapist or a friend who helps you stay accountable. Anyone who has the link can open it, so only send it to people you trust. Stop Biting is an app, not a clinician: the summary is your own log, not an assessment.',
  'syncNeeded': 'Sharing needs your history to be synced.',

  'expiry.days': '{count, plural, one {# day} other {# days}}',
  'expiry.none': 'No expiry',
  'expiry.expired': 'Expired',
  'expiry.expires': 'Expires {date}',
  'viewed.never': 'Not opened yet',
  'viewed.last': 'Last opened {date}',
  'created.on': 'Made {date}',

  'preview.shows.daily': 'How many bites you logged each day over 4 weeks, and each week over 12 weeks',
  'preview.shows.streak': 'How many whole days it has been since your last logged bite',
  'preview.shows.triggers': 'What set bites off, in groups: stress, deep focus, boredom, not sure, other',
  'preview.shows.response': 'How often you finished a competing response after an alarm',
  'preview.shows.dates': 'Calendar dates on the charts, and the date of your last logged bite',
  'preview.shows.hours': 'A time-of-day chart: which hours of the day bites were logged',
  'preview.never.identity': 'Your name, email or account',
  'preview.never.photos': 'Photos, or anything from your camera',
  'preview.never.notes': 'Notes, or the names of reasons you wrote yourself',
  'preview.never.entries': 'Any single entry, or the exact time of one',

  'failure.offline': 'No connection right now. Check your internet and try again.',
  'failure.signIn': 'Please sign in again to manage share links.',
  'failure.unavailable': 'Sharing is not available right now.',
  'failure.tooMany': 'Too many requests. Wait a minute and try again.',
  'failure.limit': 'You have reached the limit of active links. Revoke one to make another.',
  'failure.badInput': 'That did not look right. Check the note and try again.',
  'failure.load': 'Could not load your links. Try again in a moment.',
  'failure.revoke': 'Could not revoke that link. Try again in a moment.',
  'failure.create': 'Could not make the link. Try again in a moment.',

  // src/pages/settings/SharingSettings.tsx
  'card.title': 'Sharing',
  'card.signedOut': 'Sign in to make a share link.',
  'sync.turnOn': 'A link shows the history your account has synced. Turn on “Sync my history across devices” under Account & Sync, then come back here.',
  'sync.notAvailable': 'History sync is not available yet, so a link would have nothing to show. It will work once sync is available.',
  'sync.go': 'Go to Account & Sync',
  'card.nothingSynced': 'Nothing from your history has synced yet, so a link would show “no history yet”. It fills in as soon as sync has run.',
  'form.note.label': 'Note for yourself',
  'form.note.description': 'Only you see this, for example “for my appointment on Friday”. It is never shown on the shared page.',
  'form.expiry.label': 'Stops working after',
  'form.expiry.description': 'You can revoke a link at any time, whatever you pick.',
  'form.dates.label': 'Include calendar dates',
  'form.dates.description': 'Off by default. Adds dates to the charts and a time-of-day chart.',
  'preview.title': 'What this link will show',
  'preview.neverTitle': 'What it never shows',
  'create.button': 'Make a share link',
  'create.busy': 'Making link…',
  'create.limit': 'You have {max} active links, the most allowed. Revoke one to make another.',
  'new.group': 'Your new link',
  'new.title': 'Your link is ready. Copy it now.',
  'new.note': 'This is the only time it is shown. Stop Biting keeps just a fingerprint of it, so it cannot be shown again. If you lose it, revoke it and make a new one.',
  'new.urlLabel': 'Your share link',
  'new.copy': 'Copy link',
  'new.copied': 'Copied',
  'new.copiedStatus': 'Copied to your clipboard.',
  'new.copyManual': 'Could not copy automatically. The link is selected: press Ctrl+C (Cmd+C on a Mac).',
  'status.revoked': 'Link revoked. It stopped working straight away.',
  'links.title': 'Active links',
  'links.empty': 'No active links. Anyone you shared one with has lost access.',
  'link.unnamed': 'Unnamed link',
  'link.withDates': 'With dates',
  'link.countsOnly': 'Counts only',
  'link.revoke': 'Revoke',
  'link.revokeNamed': 'Revoke link {label}',
  'link.revokeUnnamed': 'Revoke link without a note',
  'revoke.group': 'Confirm revoking this link',
  'revoke.warning': 'Anyone who opens this link will see a “link does not work” page, straight away. You can make a new link later.',
  'revoke.yes': 'Yes, revoke this link',
  'revoke.busy': 'Revoking…',
  'revoke.keep': 'Keep it',

  // src/pages/settings/WeeklyEmailCard.tsx
  'weekly.title': 'Weekly summary email',
  'weekly.label': 'Email me a weekly summary',
  'weekly.description': 'One email a week: how many bites you logged, how that compares with the week before, the reason you pick most, and your quietest days.',
  'weekly.signedOut': 'Sign in to use this.',
  'weekly.about': 'It goes to the email address on your account and is built from the history you sync, so it needs “Sync my history across devices” to be on. It is off until you turn it on, it is never more than one email a week, and every email has an unsubscribe link. A week with nothing logged sends nothing.',
  'weekly.loadFailed': 'Could not load this setting. Check your connection and try again.',
  'weekly.noEmail': 'Your account has no email address, so a summary cannot be sent.',
  'weekly.needSync': 'Turn on sync first. The summary is built from your synced history, and nothing from this account has synced yet.',
  'weekly.saving': 'Saving',
  'weekly.isOn': 'Weekly summary email is on',
  'weekly.isOff': 'Weekly summary email is off',
  'weekly.error.noEmail': 'Your account has no email address, so this cannot be turned on.',
  'weekly.error.signedOut': 'You were signed out. Sign in again to change this.',
  'weekly.error.unavailable': 'The weekly summary is not available right now.',
  'weekly.error.tooMany': 'Too many changes in a short time. Wait a moment and try again.',
  'weekly.error.generic': 'Could not save that. Check your connection and try again.',
} satisfies Record<string, string>;

export const { t, useT } = createScope('sharing', messages);
