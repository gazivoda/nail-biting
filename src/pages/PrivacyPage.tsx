import { LegalPage } from './LegalPage';

export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="September 26, 2026"
      sections={[
        {
          heading: '1. Overview',
          content:
            'Stop Biting is designed so that your camera feed never leaves your device, and your habit log stays in your own browser. This policy explains exactly what data exists, where it is kept, which third parties see any of it, and why.',
        },
        {
          heading: '2. Camera and Video Data',
          content: [
            'Your webcam feed is processed entirely on your device using MediaPipe running in WebAssembly.',
            'No video frames, images, or camera data are ever transmitted to any server.',
            'You can verify this yourself: disconnect from the internet and the detection continues to work exactly the same.',
            'Camera access can be revoked at any time from your browser or system settings.',
          ],
        },
        {
          heading: '3. Data We Collect',
          content: [
            'Account information: your name, email address, and profile picture — provided by Google when you sign in.',
            'Habit data: your alarm and bite log, trigger tags, streaks, custom bite reasons and app settings. These are stored only in your browser (local storage) on the device you use. They are not sent to our server and do not follow you to another computer.',
            'Subscription data: your trial end date, subscription plan and status, renewal date, and Paddle subscription and customer IDs, used to manage your access.',
            'Website analytics: Google Analytics records page visits (pages viewed, approximate location, device and browser type) so we can see how people find and use the site. It never receives anything from your camera or your habit log.',
            'Messages you send us through the contact form: your name, email address and message.',
            'We do not collect biometric data or any data from your camera.',
          ],
        },
        {
          heading: '4. How We Use Your Data',
          content: [
            'To authenticate you and maintain your session.',
            'To give you access during your free trial and while your subscription is active.',
            'To manage your subscription and payment status via Paddle.',
            'To understand, in aggregate, which pages people visit (Google Analytics).',
            'To answer messages you send us.',
            'We do not sell, rent, or share your personal data with third parties for marketing purposes.',
          ],
        },
        {
          heading: '5. Authentication',
          content:
            'We use Google OAuth 2.0 for authentication. We receive your name, email address, and profile picture from Google. We do not receive or store your Google password. Your session is maintained via a secure, HttpOnly cookie that expires after 14 days.',
        },
        {
          heading: '6. Payment Processing',
          content:
            'Payments are processed by Paddle, who acts as the merchant of record. We do not store your credit card number or full payment details. We receive and store your Paddle subscription ID to verify your subscription status. Paddle\'s privacy policy applies to all payment transactions.',
        },
        {
          heading: '7. Third Parties',
          content: [
            'Google: sign-in (Google OAuth) and website analytics (Google Analytics).',
            'Paddle: payments, as merchant of record.',
            'Formspree: delivers messages sent through the contact form to our inbox.',
            'None of them receive camera data or your habit log.',
          ],
        },
        {
          heading: '8. Data Storage',
          content:
            'Your account and subscription data (name, email, profile picture, trial and subscription details) are stored on our server. We take reasonable technical and organisational measures to protect them. Your habit data is stored only in your browser: clearing this site\'s data in your browser, or using "Clear all data" in Settings, deletes it permanently, and we cannot recover it.',
        },
        {
          heading: '9. Data Retention',
          content:
            'We retain your account data for as long as your account is active. If you wish to delete your account and all associated data, contact us at hello@stopbiting.today and we will process the deletion within 30 days. Your habit data is on your device, so you can delete it yourself at any time.',
        },
        {
          heading: '10. Cookies',
          content:
            'We use an HttpOnly session cookie (nh_session) to keep you logged in; it is not accessible to JavaScript and is used solely for authentication. During Google sign-in a short-lived HttpOnly cookie (oauth_state, 5 minutes) protects the login against forgery. Google Analytics sets its own cookies on this site (named _ga and _ga_*) to count visits. We do not use advertising cookies. You can block or delete cookies in your browser; the app needs the session cookie to keep you signed in.',
        },
        {
          heading: '11. Your Rights',
          content: [
            'Access: you may request a copy of the personal data we hold about you.',
            'Correction: you may request that we correct inaccurate data.',
            'Deletion: you may request that we delete your account and all associated data.',
            'Portability: you may request your account data in a machine-readable format. Your habit data never leaves your browser, so we do not hold a copy of it.',
            'To exercise any of these rights, contact hello@stopbiting.today.',
          ],
        },
        {
          heading: '12. Children\'s Privacy',
          content:
            'Stop Biting is not directed at children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such data, please contact us immediately.',
        },
        {
          heading: '13. Changes to This Policy',
          content:
            'We may update this Privacy Policy from time to time. We will notify users of significant changes by updating the "Last updated" date. Continued use of the Service after changes constitutes acceptance of the revised Policy.',
        },
        {
          heading: '14. Contact',
          content:
            'For any privacy-related questions or requests, contact us at hello@stopbiting.today.',
        },
      ]}
    />
  );
}
