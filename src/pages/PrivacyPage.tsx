import { LegalPage } from './LegalPage';

export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="April 9, 2026"
      sections={[
        {
          heading: '1. Overview',
          content:
            'Stop Biting is designed from the ground up to protect your privacy. The core principle is simple: your camera feed never leaves your device. This policy explains what data we collect, why, and how we handle it.',
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
            'Usage data: your habit streaks, incident logs, and detection session timestamps — stored on our server linked to your account.',
            'Subscription data: your PayPal subscription ID and subscription status — used to manage your access.',
            'We do not collect biometric data, browsing history, or any data from your camera.',
          ],
        },
        {
          heading: '4. How We Use Your Data',
          content: [
            'To authenticate you and maintain your session.',
            'To store and display your habit tracking history, streaks, and incident log.',
            'To manage your subscription and payment status via PayPal.',
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
            'Payments are processed by PayPal. We do not store your credit card number or full payment details. We receive and store your PayPal subscription ID to verify your subscription status. PayPal\'s privacy policy applies to all payment transactions.',
        },
        {
          heading: '7. Data Storage',
          content:
            'Your account data (name, email, habit streaks, incident logs) is stored on our secure server. We take reasonable technical and organisational measures to protect your data. We do not use third-party analytics that track you across websites.',
        },
        {
          heading: '8. Data Retention',
          content:
            'We retain your account data for as long as your account is active. If you wish to delete your account and all associated data, contact us at hello@stopbiting.today and we will process the deletion within 30 days.',
        },
        {
          heading: '9. Cookies',
          content:
            'We use a single HttpOnly session cookie (nh_session) to keep you logged in. This cookie is not accessible to JavaScript and is used solely for authentication. We do not use advertising cookies or third-party tracking cookies.',
        },
        {
          heading: '10. Your Rights',
          content: [
            'Access: you may request a copy of the personal data we hold about you.',
            'Correction: you may request that we correct inaccurate data.',
            'Deletion: you may request that we delete your account and all associated data.',
            'Portability: you may request your data in a machine-readable format.',
            'To exercise any of these rights, contact hello@stopbiting.today.',
          ],
        },
        {
          heading: '11. Children\'s Privacy',
          content:
            'Stop Biting is not directed at children under the age of 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such data, please contact us immediately.',
        },
        {
          heading: '12. Changes to This Policy',
          content:
            'We may update this Privacy Policy from time to time. We will notify users of significant changes by updating the "Last updated" date. Continued use of the Service after changes constitutes acceptance of the revised Policy.',
        },
        {
          heading: '13. Contact',
          content:
            'For any privacy-related questions or requests, contact us at hello@stopbiting.today.',
        },
      ]}
    />
  );
}
