// Scope "auth": The sign-in page and provider buttons.
// English is the source of truth. Add a key here, then the same key to
// src/i18n/locales/{es,de,pt-BR}/auth.ts (the compiler lists what is missing).
import { createScope } from '../scope';

export const messages = {
  'page.title': 'Sign in | Stop Biting',

  // The emailed link was opened: one more press to sign in.
  'finish.title': 'Finish signing in',
  'finish.body': 'Press the button to sign in on this device. Opening the email link on its own does not sign anyone in.',
  'finish.button': 'Sign in to Stop Biting',
  'finish.working': 'Signing in…',

  'intro.title': 'Sign in or start your free trial',
  'intro.body': 'Choose how you want to sign in. New here? The same options start your trial. Already have an account? You will be signed back in.',
  'checking': 'Checking for more options…',
  'divider.or': 'or',

  // Provider buttons: each provider's own phrase, the product name unchanged.
  'provider.google': 'Sign in with Google',
  'provider.apple': 'Sign in with Apple',
  'provider.microsoft': 'Sign in with Microsoft',

  // The emailed-link form.
  'email.label': 'Email address',
  'email.placeholder': 'you@example.com',
  'email.send': 'Email me a sign-in link',
  'email.sending': 'Sending…',
  'sent.title': 'Check your inbox',
  'sent.body': 'A sign-in link is on its way to <b>{email}</b>. It works once and expires in 15 minutes. If it has not arrived after a couple of minutes, check your spam folder.',
  'sent.again': 'Send another link',
  'sent.againWait': 'Send another link ({seconds}s)',
  'sent.different': 'Use a different email',

  'terms': 'By continuing you agree to the <terms>Terms</terms> and the <privacy>Privacy Policy</privacy>.',

  // Messages shown above the buttons or the form after something did not work.
  'error.invalidEmail': "That doesn't look like an email address. Please check it and try again.",
  'error.tooMany': 'Too many tries. Please wait a few minutes and try again.',
  'error.sendFailed': "We couldn't send the email. Please try again in a moment.",
  'error.finishFailed': "We couldn't finish signing you in. Please request a new link.",
  'error.who.default': 'Your sign-in provider',
  'error.cancelled': 'Sign-in was cancelled, so nothing was set up. You can try again whenever you like.',
  'error.unverified': '{who} did not confirm that this email address belongs to you, so we did not connect it to an existing account. Use the emailed sign-in link instead: it proves you can read that inbox.',
  'error.generic': "Sign-in didn't finish, so nothing was set up. Please try again.",
  'link.expired': 'That sign-in link has expired. Links work for 15 minutes. Enter your email and we will send a new one.',
  'link.used': 'That sign-in link was already used. Each link works once. Enter your email and we will send a new one.',
  'link.invalid': "That sign-in link isn't valid. Enter your email and we will send a new one.",
} satisfies Record<string, string>;

export const { t, useT } = createScope('auth', messages);
