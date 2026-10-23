// The email that carries a gift link to the person who bought it. Plain wording, no marketing claims.
// The buyer forwards the link; the code is in the link's fragment (#code=...), which browsers never
// send to a server, so it does not end up in access logs or a Referer header.

import { formatGiftCode } from './gift.js';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** "one year", "3 months", "45 days". */
export function describeDays(days) {
  if (days % 365 === 0) { const y = days / 365; return y === 1 ? 'one year' : `${y} years`; }
  if (days % 30 === 0) { const m = days / 30; return m === 1 ? 'one month' : `${m} months`; }
  return days === 1 ? 'one day' : `${days} days`;
}

export function giftRedeemLink(appUrl, code) {
  return `${appUrl.replace(/\/+$/, '')}/redeem#code=${code}`;
}

export function buildGiftEmail({ appUrl, code, days, expiresAt = null }) {
  const link = giftRedeemLink(appUrl, code);
  const duration = describeDays(days);
  const expires = expiresAt ? new Date(expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;
  const subject = 'Your Stop Biting gift link';

  const text = [
    `Thank you for your purchase. This is the link for the gift of ${duration} of Stop Biting.`,
    '',
    link,
    '',
    `Send it to the person you are giving it to. They sign in with their own account (or create one), open the link and press Redeem. The ${duration} are then added to their account.`,
    `The link works once. Anyone who has it can redeem it, so send it only to them.${expires ? ` It can be redeemed until ${expires}.` : ''}`,
    '',
    `Your code, if the link does not open: ${formatGiftCode(code)}`,
    '',
    'Questions: hello@stopbiting.today',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#F7F7F1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1F2F27;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Thank you for your purchase. This is the link for the gift of ${esc(duration)} of Stop Biting.</p>
    <p style="margin:0 0 20px;"><a href="${esc(link)}" style="display:inline-block;background:#1F2F27;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px;">Open the gift link</a></p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">Send it to the person you are giving it to. They sign in with their own account (or create one), open the link and press Redeem. The ${esc(duration)} are then added to their account.</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">The link works once. Anyone who has it can redeem it, so send it only to them.${expires ? ` It can be redeemed until ${esc(expires)}.` : ''}</p>
    <p style="font-size:14px;line-height:1.6;margin:0 0 12px;color:#4a5a52;">Your code, if the link does not open: <strong>${esc(formatGiftCode(code))}</strong></p>
    <p style="font-size:14px;line-height:1.6;margin:0;color:#4a5a52;">Questions: <a href="mailto:hello@stopbiting.today" style="color:#4a5a52;">hello@stopbiting.today</a></p>
  </div>
</body>
</html>`;

  return { subject, html, text, link };
}
