import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Stop Biting Nails <onboarding@resend.dev>';
const ADMIN_EMAIL = 'gazivodai61@gmail.com';
const APP_URL = process.env.APP_URL || 'https://stopbiting.today';

export async function sendWelcomeEmail({ name, email, trial_end_date }) {
  const firstName = name ? name.split(' ')[0] : 'there';
  const trialEnd = new Date(trial_end_date).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Welcome to Stop Biting Nails, ${firstName}!`,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>Welcome to Stop Biting Nails</title>
</head>
<body style="margin:0;padding:0;background:#F7F3EE;font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F3EE;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:32px 0 24px;text-align:center;">
              <span style="font-size:18px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">
                stop biting <span style="color:#1D5C38;letter-spacing:2px;text-transform:uppercase;font-size:16px;">NAILS</span>
              </span>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e5e1db;padding:40px 40px 32px;">
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">
                Welcome, ${firstName}!
              </h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#6b7280;">
                Your free trial has started. Here's what you get access to:
              </p>
              <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;line-height:2.2;color:#374151;">
                <li><strong>AI detection</strong> — real-time on-device nail biting detection via your webcam</li>
                <li><strong>Instant alerts</strong> — gentle reminders the moment a bite attempt is detected</li>
                <li><strong>Streak tracking</strong> — see your progress and build lasting habits</li>
              </ul>
              <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;">
                Your trial ends on <strong style="color:#374151;">${trialEnd}</strong>.
              </p>
              <div style="margin-top:32px;text-align:center;">
                <a href="${APP_URL}" style="display:inline-block;background:#1D5C38;color:#F7F3EE;font-weight:600;font-size:15px;text-decoration:none;padding:14px 36px;border-radius:14px;">
                  Open the App
                </a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 0;text-align:center;font-size:12px;color:#9ca3af;">
              You're receiving this because you signed up for Stop Biting Nails.<br>
              <a href="https://stopbiting.today" style="color:#9ca3af;">stopbiting.today</a>
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
  const signedUpAt = new Date(created_at).toUTCString();
  const trialEnd = new Date(trial_end_date).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `New signup: ${name}`,
    text: `New user signed up on Stop Biting Nails.\n\nName: ${name}\nEmail: ${email}\nSigned up: ${signedUpAt}\nTrial ends: ${trialEnd}`,
  });
}
