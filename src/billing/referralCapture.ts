// Called once at start-up (main.tsx). Does nothing unless the address carries ?ref=CODE, so a page load
// without it makes no request and touches no storage. With it, the code is kept only if the server says
// the referrals flag is on: that costs one GET /api/features, and only on a visit that came from a link.

import { isFeatureOn, refreshFlags } from '../features/flags';
import { parseRefParam, rememberReferral } from './referral';

export async function captureReferralFromLocation(search: string): Promise<boolean> {
  const code = parseRefParam(search);
  if (!code) return false;
  try {
    await refreshFlags();
  } catch { /* keep whatever is known */ }
  if (!isFeatureOn('referrals')) return false;
  return rememberReferral(code);
}
