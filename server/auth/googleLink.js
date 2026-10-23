// The one seam into the Google callback (server.js).
//
// Google sign-in stays exactly as it was: the callback looks the user up by
// `users.id` (the Google subject). Only when NO user has that id (a Google
// sign-in the callback would otherwise turn into a brand-new account) does it ask
// this function whether the person already has an account made with another method
// (an emailed link, Apple, Microsoft) that Google's verified email points at.
//
//   let user = getUser(googleId);
//   if (!user) user = linkGoogleSignIn(googlePayload);   // null -> create, as before
//
// It can only ever return a user that was created by a new method, so an existing
// Google user is never affected, and with no such accounts it always returns null.
// Any failure returns null (and is logged): sign-in must never break because of it.

import { createAccounts } from './accounts.js';

export function createGoogleLinker({ db, getUser, log = console.error }) {
  let accounts = null;
  return function linkGoogleSignIn(payload) {
    try {
      // Prepared on first use: the tables are created by the route registry's
      // migrations, which run after server.js has defined this.
      accounts ??= createAccounts({ db, getUser, saveUser: () => { throw new Error('linkGoogleSignIn never creates users'); } });
      return accounts.linkGoogleSignIn(payload);
    } catch (err) {
      log('[auth] google account linking skipped:', err?.message);
      return null;
    }
  };
}
