// "Is this flag on, as far as the words on the site are concerned?" (WS11b)
//
// For most flags that is just the flag. For the three extra sign-in methods it is the
// flag AND the method's keys being present, the same rule GET /auth/providers uses
// (server/routes/authProviders.js, `available()`): a page must not tell a visitor they
// can sign in with Apple while the button is not there.
//
// Read at call time, not import time: ESM imports run before server.js has loaded .env.

import { appleConfigFromEnv } from '../auth/apple.js';
import { microsoftConfigFromEnv } from '../auth/microsoft.js';

function safe(fn) {
  try { return !!fn(); } catch { return false; }
}

/**
 * @param flags  the server's flag set (`isOn(name)`)
 * @param env    where the keys are (process.env)
 * @returns (name) => boolean
 */
export function createCopyIsOn(flags, env = process.env) {
  const configured = {
    signin_magic_link: () => !!env.RESEND_API_KEY?.trim(),
    signin_apple: () => !!appleConfigFromEnv(env),
    signin_microsoft: () => !!microsoftConfigFromEnv(env),
  };
  return name => flags.isOn(name) && (configured[name] ? safe(configured[name]) : true);
}
