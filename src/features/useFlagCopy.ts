import { useMemo } from 'react';
import { flagAware } from '../../shared/flagCopy.js';
import { useSignInProviders } from '../auth/useSignInProviders';
import { PRICE_IDS } from '../billing/env';
import { copyFlagIsOn, takeCopyFlagInputs, type BuildFacts } from './copyFlags';

// Copy that changes with a feature flag (WS11b, shared/flagCopy.js).
//
//   const copy = useFlagCopy();
//   <p>{copy('Your history is stored in this browser, so it doesn\'t follow you to another computer.')}</p>
//
// The source text is what is true with every flag off, and `copy` hands it back as the same string
// until a flag changes it. The server applies the same function to the same text for the crawler copy
// and the structured data, so a reader and a crawler are told the same thing.
//
// A marketing page makes NO request to learn the flags: it reads the marker the server put in the page
// (and, failing that, the app's last fresh answer). The order and the reasons are in ./copyFlags.ts.
// The three extra sign-in methods use the answer to GET /auth/providers instead, which already says
// "flag on AND keys configured" and which these pages fetch anyway for their buttons.

// What the build knows (a constant): the Lifetime words need the build's price id as well when there is no marker (copyFlags.ts).
const BUILD: BuildFacts = { lifetimePriceId: PRICE_IDS.lifetime !== '' };

/** One copy-affecting flag, by the marker or the app's last fresh answer. Never asks the server. */
export function useCopyFlag(name: string): boolean {
  return useMemo(() => copyFlagIsOn(name, takeCopyFlagInputs(), BUILD), [name]);
}

/** `isOn` for copy: the flags above, and the sign-in methods the server says are usable. */
export function useFlagIsOn(): (name: string) => boolean {
  const { providers } = useSignInProviders();
  return useMemo(() => {
    const inputs = takeCopyFlagInputs();
    return (name: string): boolean => {
      if (name === 'signin_magic_link') return providers.magic_link;
      if (name === 'signin_apple') return providers.apple;
      if (name === 'signin_microsoft') return providers.microsoft;
      return copyFlagIsOn(name, inputs, BUILD);
    };
  }, [providers]);
}

export function useFlagCopy(): (text: string) => string {
  const isOn = useFlagIsOn();
  return useMemo(() => (text: string) => flagAware(text, isOn), [isOn]);
}
