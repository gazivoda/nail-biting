// Scope "shell": The frame around the app: tab bar, headers, install prompt and guide, onboarding tour, desktop camera notice, app loading.
// English is the source of truth. Add a key here, then the same key to
// src/i18n/locales/{es,de,pt-BR}/shell.ts (the compiler lists what is missing).
import { createScope } from '../scope';

export const messages = {
  // Tab bar (sidebar and bottom bar)
  'tabs.watch': 'Watch',
  'tabs.history': 'History',
  'tabs.settings': 'Settings',
  'tabs.today': 'Today',
  'nav.main': 'Main navigation',
  'trial.title': 'Free trial',
  // The number is shown on its own in large type; these are the words after it.
  'trial.daysLeft': '{count, plural, one {day left} other {days left}}',
  'trial.hoursLeft': '{count, plural, one {hour left} other {hours left}}',
  'trial.endsToday': 'Ends today',
  'trial.upgrade': 'Upgrade',
  'account.subscribed': 'Subscribed',
  'account.signOut': 'Sign out',
  'install.app': 'Install app',
  'privacy.footer': 'No camera data is sent while it runs',

  // Install banner
  'prompt.title': 'Install Stop Biting',
  'prompt.body': 'Add to home screen for quick access, no app store needed.',
  'pwa.dismiss': 'Dismiss',

  // Install guide (sheet)
  'pwa.iconAlt': 'Stop Biting icon',
  'pwa.title.line1': 'Stop Biting works best',
  'pwa.title.line2': 'as an installed app',
  'pwa.subtitle': 'Free · no App Store · takes 10 seconds',
  'pwa.benefit.background.title': 'Background detection',
  'pwa.benefit.background.desc': 'AI keeps monitoring even when you switch apps',
  'pwa.benefit.instant.title': 'Instant launch',
  'pwa.benefit.instant.desc': 'One tap from your home screen, no browser',
  'pwa.benefit.device.title': 'Runs on your device',
  'pwa.benefit.device.desc': 'No camera data is sent while detection runs',
  'pwa.benefit.log.title': 'Log in a tap or two',
  'pwa.benefit.log.desc': 'Record a bite or an urge as it happens',
  'pwa.benefit.offline.title': 'Works with no signal',
  'pwa.benefit.offline.desc': 'Entries are saved on this phone and sync later if you turned sync on',
  'pwa.ios.heading': 'How to install on iOS',
  'pwa.ios.share.label': 'Tap the Share button',
  'pwa.ios.share.sub': 'the ↑ icon at the bottom of Safari',
  'pwa.ios.add.label': 'Tap "Add to Home Screen"',
  'pwa.ios.add.sub': 'scroll down in the share sheet',
  'pwa.ios.confirm.label': 'Tap "Add"',
  'pwa.ios.confirm.sub': 'top-right corner of the dialog',
  'pwa.ios.warning': "Make sure you're using <b>Safari</b>. Only Safari supports installation on iOS.",
  'pwa.install.heading': 'Install in one click',
  'pwa.install.button': 'Install Stop Biting',
  'pwa.footer.ios': 'Open in Safari to install',
  'pwa.footer.other': 'No app store required',
  'pwa.later': 'Maybe later',

  // Onboarding tour
  'tour.stepOf': 'Step {step} of {total}',
  'tour.skip': 'Skip tour',
  'tour.next': 'Next',
  'tour.detector.title': 'This is the detector',
  'tour.detector.body': 'Once your browser lets it use the camera, it watches for your hands and sounds the alarm when one reaches your mouth. No camera data is sent while it runs.',
  'tour.feed.title': 'Camera feed stays hidden',
  'tour.feed.body': 'Your video stays hidden so you can focus on work. Detection runs either way. Turn the feed on only if you want to see yourself.',
  'tour.streak.title': 'Your streak',
  'tour.streak.body': "How long you've gone without a bite. An alarm doesn't reset it; a bite you confirm or log does.",
  'tour.log.title': 'Bit and the alarm missed it?',
  'tour.log.body': 'Log it here and tag what set it off: stress, deep focus, boredom.',
  'tour.history.title': 'History',
  'tour.history.body': 'Every alarm and bite by day, with a 7-day chart.',

  // Desktop app: the camera explanation shown before the operating system asks
  'camera.explain.title': 'Camera access',
  'camera.explain.body': 'Stop Biting uses your camera to notice when your hand reaches your face. Detection runs on your device. No camera data is sent while it runs.',
  'camera.explain.macos': 'Next, macOS will ask you to allow it.',
  'camera.blocked.title': 'The camera is turned off',
  'camera.blocked.body': 'Camera access is off for Stop Biting. Turn it on in {path}, then start watching again.',
  'camera.path.win': 'Settings, under Privacy & security, then Camera',
  'camera.path.mac': 'System Settings, under Privacy & Security, then Camera',
  'camera.notNow': 'Not now',
  'camera.openSettings': 'Open settings',

  // The text the phone's share sheet or mail draft starts with (src/utils/phoneLink.ts). Here, not in "phone",
  // because the marketing page imports that file and the shell scope is already in the main bundle.
  'share.title': 'Stop Biting, for my computer',
  'share.text': 'Open this on my laptop or desktop:',
} satisfies Record<string, string>;

export const { t, useT } = createScope('shell', messages);
