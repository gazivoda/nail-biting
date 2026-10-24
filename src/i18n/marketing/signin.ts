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
