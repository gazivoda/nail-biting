// Mounted once for a signed-in user (App.tsx). Renders nothing, and does nothing unless one of three things
// is true, each of which only exists while its flag is on:
//
//   * a referral code was kept when the visitor arrived by a link (src/billing/referral.ts)
//       -> tie this new account to it, once, then forget the code;
//   * a gift code is waiting (the recipient opened the gift link, then had to sign in)
//       -> go to /redeem so they can use it;
//   * the account is in the free tier (the server says so in user.entitlement.free_tier)
//       -> count the day's detection time and keep detection off once it is used.
//
// With every flag off none of those can happen, so this makes no request and touches nothing.

import { useEffect } from 'react';
import { forgetReferral, pendingReferral } from '../../billing/referral';
import { pendingGiftCode } from '../../billing/giftCode';
import { useFreeTierMeter } from '../../billing/useFreeTier';
import { apiFetch, useAuth } from '../../contexts/AuthContext';

export function BillingHost() {
  const { user } = useAuth();
  const userId = user?.id;

  useFreeTierMeter();

  useEffect(() => {
    if (!userId) return;
    const code = pendingReferral();
    if (!code) return;
    apiFetch('/api/referrals/attach', { method: 'POST', body: JSON.stringify({ code }) })
      .then(() => forgetReferral())               // accepted or refused, the answer is final
      .catch((err: Error) => {
        // 404: the program was switched off since the link was opened. Anything else (offline): try again next time.
        if (/\b404\b/.test(err.message)) forgetReferral();
      });
  }, [userId]);

  useEffect(() => {
    if (!userId || window.location.pathname === '/redeem') return;
    if (pendingGiftCode()) window.location.assign('/redeem');
  }, [userId]);

  return null;
}
