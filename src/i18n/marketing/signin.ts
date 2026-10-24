// The sign-in methods as words, for the localized marketing pages (WS12b). Pure TypeScript.
//
// English composes its sentences in shared/flagCopy.js (`signInAnswer`, the `home-sign-in` rule). The other languages
// cannot reuse English sentences, so each language's catalog carries the pieces (marketing-home: `faq.google.*`)
// and this file picks which ones apply and writes the list of methods in the language ("Google, Apple o un enlace
// enviado por correo"). A method counts as on only when its flag is on AND its keys are configured: the caller passes
// an `isOn` that already knows (the server's createCopyIsOn, the browser's useFlagIsOn).

export type MethodNames = Readonly<{ google: string; apple: string; microsoft: string; magic: string }>;

export const SIGNIN_FLAGS = ['signin_apple', 'signin_microsoft', 'signin_magic_link'] as const;

/** True when any method besides Google is usable. */
export function anySignIn(isOn: (flag: string) => boolean): boolean {
  return SIGNIN_FLAGS.some(flag => isOn(flag));
}

/** The methods that are usable, Google always first, in the order English lists them. */
export function methodKeys(isOn: (flag: string) => boolean): Array<keyof MethodNames> {
  return [
    'google',
    ...(isOn('signin_apple') ? (['apple'] as const) : []),
    ...(isOn('signin_microsoft') ? (['microsoft'] as const) : []),
    ...(isOn('signin_magic_link') ? (['magic'] as const) : []),
  ];
}

/** "Google" or "Google, Apple o un enlace enviado por correo": a disjunction in the language of the page. */
export function methodsText(tag: string, names: MethodNames, isOn: (flag: string) => boolean): string {
  const list = methodKeys(isOn).map(k => names[k]);
  if (list.length <= 1) return names.google;
  return new Intl.ListFormat(tag, { type: 'disjunction', style: 'long' }).format(list);
}

/** Says one of the answer's pieces (marketing-home faq.10.alt.*), in the language on screen or being built. */
export type SignInSay = (
  key: 'faq.10.alt.intro' | 'faq.10.alt.google' | 'faq.10.alt.relay' | 'faq.10.alt.magic' | 'faq.10.alt.demo',
  params?: Readonly<Record<string, string | number>>,
) => string;

/**
 * "Do I need a Google account to use it?" for the sign-in methods that are on: the same five pieces, in the same order,
 * as `signInAnswer` in shared/flagCopy.js writes for English (a test compares the English pieces with it). The
 * `{methods}` in the first piece comes from the bag, so the caller's `say` has already been given the list.
 */
export function composeSignInAnswer(say: SignInSay, isOn: (flag: string) => boolean): string {
  const parts = [say('faq.10.alt.intro'), say('faq.10.alt.google')];
  const who = relayWho(isOn);
  if (who) parts.push(say('faq.10.alt.relay', { who }));
  if (isOn('signin_magic_link')) parts.push(say('faq.10.alt.magic'));
  parts.push(say('faq.10.alt.demo'));
  return parts.join(' ');
}

/** Every combination of the three extra sign-in methods, as the key the build writes and the server reads ("", "apple", "apple+magic", ...). */
export function signInCombos(): Array<{ key: string; isOn: (flag: string) => boolean }> {
  const out: Array<{ key: string; isOn: (flag: string) => boolean }> = [];
  for (let mask = 0; mask < 8; mask += 1) {
    const on = new Set<string>();
    if (mask & 1) on.add('signin_apple');
    if (mask & 2) on.add('signin_microsoft');
    if (mask & 4) on.add('signin_magic_link');
    out.push({ key: comboKey(flag => on.has(flag)), isOn: flag => on.has(flag) });
  }
  return out;
}

/** "" with only Google; otherwise the extra methods that are on, joined with "+" (apple, microsoft, magic). */
export function comboKey(isOn: (flag: string) => boolean): string {
  return [isOn('signin_apple') ? 'apple' : '', isOn('signin_microsoft') ? 'microsoft' : '', isOn('signin_magic_link') ? 'magic' : '']
    .filter(Boolean)
    .join('+');
}

/**
 * Which "who" the second sentence of the Google-account answer names: Apple, Microsoft or both; null when neither is on.
 * (The message picks the words: `{who, select, apple {..} microsoft {..} both {..} other {..}}`.)
 */
export function relayWho(isOn: (flag: string) => boolean): 'apple' | 'microsoft' | 'both' | null {
  const apple = isOn('signin_apple');
  const microsoft = isOn('signin_microsoft');
  if (apple && microsoft) return 'both';
  if (apple) return 'apple';
  if (microsoft) return 'microsoft';
  return null;
}
