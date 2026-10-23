// The sign-in email. Same look as the other emails in email.js (cream ground,
// white card, deep-forest button), plain and short.
//
// The link goes to /signin#t=<token>. The token is in the URL FRAGMENT, which
// browsers never send to a server, so it does not appear in access logs, and a
// mail scanner that fetches the link receives only the (inert) page. Signing in
// needs a click on the page's button, which POSTs the token.

const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function magicLinkUrl(appUrl, token) {
  return `${appUrl.replace(/\/+$/, '')}/signin#t=${token}`;
}

/** @returns {{ subject: string, html: string, text: string }} */
export function buildMagicLinkEmail({ appUrl, token, ttlMinutes = 15 }) {
  const url = magicLinkUrl(appUrl, token);
  const subject = 'Your Stop Biting sign-in link';

  const text = [
    'Sign in to Stop Biting',
    '',
    'Open this link on the device where you want to use the app, then press the sign-in button on the page:',
    url,
    '',
    `The link works once and expires in ${ttlMinutes} minutes.`,
    'If you did not ask for it, you can ignore this email. Nothing happens unless the link is opened and confirmed.',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>Sign in to Stop Biting</title>
</head>
<body style="margin:0;padding:0;background:#F7F7F1;font-family:-apple-system,BlinkMacSystemFont,Geist,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F1;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:32px 0 24px;text-align:center;">
              <span style="font-size:18px;font-weight:700;color:#0B2A1E;letter-spacing:-0.5px;">Stop Biting</span>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:28px;border:1px solid #e5e1db;padding:40px 40px 32px;">
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#0B2A1E;letter-spacing:-0.5px;">Sign in to Stop Biting</h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3F5249;">
                Press the button on the next page to finish signing in. The link works once and expires in ${ttlMinutes} minutes.
              </p>
              <div style="margin:28px 0;text-align:center;">
                <a href="${escapeHtml(url)}" style="display:inline-block;background:#0B2A1E;color:#F7F7F1;font-weight:600;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:999px;">
                  Open sign-in page
                </a>
              </div>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#5F6F67;">
                If the button does not work, copy this address into your browser:<br>
                <span style="word-break:break-all;color:#1F2F27;">${escapeHtml(url)}</span>
              </p>
              <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#5F6F67;">
                If you did not ask for this email, you can ignore it. Nothing happens unless the link is opened and confirmed.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0;text-align:center;font-size:12px;color:#5F6F67;">
              <a href="https://stopbiting.today" style="color:#5F6F67;">stopbiting.today</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
