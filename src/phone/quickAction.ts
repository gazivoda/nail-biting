// Deep links into the phone view: `/?action=bite` and `/?action=urge` (WS6).
//
// They are what the home-screen shortcuts open (the manifest the server sends
// while `phone_companion` is on), and what a person can point their own phone
// shortcut at. The phone view reads the link once, acts, and removes it from the
// address so a reload or a relaunch never logs twice. With the flag off nothing
// reads it: the address is just an address.

export type QuickAction = 'bite' | 'urge';

export function parseQuickAction(search: string): QuickAction | null {
  const v = new URLSearchParams(search).get('action');
  return v === 'bite' || v === 'urge' ? v : null;
}

/** The same address without `action`, keeping any other query and the hash. */
export function withoutAction(pathname: string, search: string, hash: string): string {
  const params = new URLSearchParams(search);
  params.delete('action');
  const q = params.toString();
  return `${pathname}${q ? `?${q}` : ''}${hash}`;
}

let taken = false;

/**
 * Returns the requested action the first time it is called in this page load
 * (and strips it from the address); null afterwards. The module flag also
 * covers React StrictMode running an effect twice in development.
 */
export function takeQuickAction(
  loc: { pathname: string; search: string; hash: string },
  history: { replaceState(data: unknown, unused: string, url: string): void },
): QuickAction | null {
  if (taken) return null;
  const action = parseQuickAction(loc.search);
  if (!action) return null;
  taken = true;
  try {
    history.replaceState(null, '', withoutAction(loc.pathname, loc.search, loc.hash));
  } catch {
    // an address that cannot be rewritten still logs once, thanks to `taken`
  }
  return action;
}

/** Tests only. */
export function resetQuickActionForTests(): void {
  taken = false;
}
