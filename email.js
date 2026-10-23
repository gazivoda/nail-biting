import { Resend } from 'resend';

let resend = null;
function getResend() {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}
// onboarding@resend.dev only delivers to the Resend account owner; set EMAIL_FROM
// to an address on a domain verified in Resend before real users get mail.
const FROM = process.env.EMAIL_FROM || 'Stop Biting Nails <onboarding@resend.dev>';
const ADMIN_EMAIL = 'gazivodai61@gmail.com';
const APP_URL = process.env.APP_URL || 'https://stopbiting.today';

function formatDate(isoString) {
  if (!isoString) return 'soon';
  const d = new Date(isoString);
  return isNaN(d) ? 'soon' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// Generic transactional send for route modules (magic-link sign-in, weekly
// summaries): same Resend client and sender as the emails below. Each caller
// builds its own subject and body. Returns Resend's response; throws on failure.
export async function sendEmail({ to, subject, html, text, headers }) {
  const message = { from: FROM, to, subject };
  if (html !== undefined) message.html = html;
  if (text !== undefined) message.text = text;
  if (headers !== undefined) message.headers = headers;
  return getResend().emails.send(message);
}

export async function sendWelcomeEmail({ name, email, trial_end_date }) {
  const firstName = name ? name.split(' ')[0] : 'there';
  const trialEnd = formatDate(trial_end_date);

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Welcome to Stop Biting Nails, ${firstName}!`,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>Welcome to Stop Biting</title>
</head>
<body style="margin:0;padding:0;background:#F7F7F1;font-family:-apple-system,BlinkMacSystemFont,Geist,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F1;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:32px 0 24px;text-align:center;">
              <span style="font-size:18px;font-weight:700;color:#0B2A1E;letter-spacing:-0.5px;">
                Stop Biting
              </span>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:28px;border:1px solid #e5e1db;padding:40px 40px 32px;">
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#0B2A1E;letter-spacing:-0.5px;">
                Welcome, ${firstName}!
              </h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#3F5249;">
                Your free trial has started. Here's what you get access to:
              </p>
              <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:2.2;color:#1F2F27;">
                <li><strong>AI detection</strong> real-time on-device nail biting detection via your webcam</li>
                <li><strong>Instant alerts</strong> gentle reminders the moment a bite attempt is detected</li>
                <li><strong>Streak tracking</strong> see your progress and build lasting habits</li>
              </ul>
              <p style="margin:0 0 8px;font-size:13px;color:#5F6F67;">
                Your trial ends on <strong style="color:#1F2F27;">${trialEnd}</strong>.
              </p>
              <div style="margin-top:32px;text-align:center;">
                <a href="${APP_URL}" style="display:inline-block;background:#0B2A1E;color:#F7F7F1;font-weight:600;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:999px;">
                  Open the App
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0;text-align:center;font-size:12px;color:#5F6F67;">
              You're receiving this because you signed up for Stop Biting.<br>
              <a href="https://stopbiting.today" style="color:#5F6F67;">stopbiting.today</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
}

export async function sendFeedbackEmail({ name, email }) {
  const firstName = name ? name.split(' ')[0] : 'there';

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `How did your Stop Biting trial go, ${firstName}?`,
    replyTo: ADMIN_EMAIL,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>How was your trial?</title>
</head>
<body style="margin:0;padding:0;background:#F7F7F1;font-family:-apple-system,BlinkMacSystemFont,Geist,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F1;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:32px 0 24px;text-align:center;">
              <span style="font-size:18px;font-weight:700;color:#0B2A1E;letter-spacing:-0.5px;">
                Stop Biting
              </span>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:28px;border:1px solid #e5e1db;padding:40px 40px 36px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0B2A1E;letter-spacing:-0.5px;">
                Hey ${firstName}, how did it go?
              </h1>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#1F2F27;">
                Your free trial has ended. I just wanted to reach out personally to see how it went.
              </p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#1F2F27;">
                Did the AI detection actually catch you biting? Was anything confusing or broken? Any features you wished existed?
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#1F2F27;">
                Honest feedback, good or bad, helps a lot. Just hit reply and let me know what you think.
              </p>
              <div style="background:#F7F7F1;border-radius:12px;padding:20px 24px;margin-bottom:28px;">
                <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#0B2A1E;text-transform:uppercase;letter-spacing:0.5px;">If the app helped you</p>
                <p style="margin:0;font-size:14px;line-height:1.6;color:#1F2F27;">
                  A short review goes a long way for a tiny indie app. Even a sentence or two would mean the world.
                </p>
              </div>
              <div style="text-align:center;">
                <a href="mailto:gazivodai61@gmail.com?subject=Feedback%20on%20Stop%20Biting" style="display:inline-block;background:#0B2A1E;color:#F7F7F1;font-weight:600;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:999px;margin-bottom:12px;">
                  Reply with Feedback
                </a>
                <br>
                <a href="${APP_URL}" style="display:inline-block;margin-top:10px;font-size:13px;color:#3F5249;text-decoration:underline;">
                  Or continue with a subscription at $2.99/month
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0;text-align:center;font-size:12px;color:#5F6F67;">
              Igor, maker of Stop Biting<br>
              <a href="https://stopbiting.today" style="color:#5F6F67;">stopbiting.today</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
}

export async function sendAdminNotification({ name, email, created_at, trial_end_date }) {
  const displayName = name || 'Unknown';
  const signedUpAt = new Date(created_at).toUTCString();
  const trialEnd = formatDate(trial_end_date);

  await getResend().emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New signup: ${displayName}`,
    text: `New user signed up on Stop Biting Nails.\n\nName: ${displayName}\nEmail: ${email}\nSigned up: ${signedUpAt}\nTrial ends: ${trialEnd}`,
  });
}
