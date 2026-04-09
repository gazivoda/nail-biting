import { LegalPage } from './LegalPage';

export function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      lastUpdated="April 9, 2026"
      sections={[
        {
          heading: '1. Acceptance of Terms',
          content:
            'By accessing or using Stop Biting ("the Service") at stopbiting.today, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.',
        },
        {
          heading: '2. Description of Service',
          content:
            'Stop Biting is a web-based habit tracking application that uses on-device AI (MediaPipe, running in WebAssembly) to detect nail-biting behaviour via your device\'s webcam. No camera data is transmitted to any server. The Service is provided for personal, non-commercial use.',
        },
        {
          heading: '3. Free Trial',
          content:
            'New users receive a 7-day free trial with full access to all features. No credit card is required to start the trial. At the end of the trial period, continued access requires a paid subscription.',
        },
        {
          heading: '4. Subscriptions and Billing',
          content: [
            'Subscriptions are billed through Paddle, our merchant of record. By subscribing, you authorise recurring charges via your chosen payment method.',
            'Monthly plan: $2.99 per month, billed monthly.',
            'Yearly plan: $29.00 per year, billed annually.',
            'Subscriptions automatically renew unless cancelled at least 24 hours before the renewal date.',
            'You may cancel your subscription at any time from within the app or via the cancellation link in your Paddle receipt email.',
          ],
        },
        {
          heading: '5. Refunds',
          content:
            'Please refer to our Refund Policy at stopbiting.today/refund-policy for information on refunds and cancellations.',
        },
        {
          heading: '6. User Accounts',
          content:
            'You must sign in with a Google account to use the Service. You are responsible for maintaining the security of your account. We reserve the right to terminate accounts that violate these Terms.',
        },
        {
          heading: '7. Acceptable Use',
          content: [
            'You may not use the Service for any unlawful purpose.',
            'You may not attempt to reverse-engineer, copy, or redistribute the Service.',
            'You may not use the Service in any way that could damage, disable, or impair the Service.',
          ],
        },
        {
          heading: '8. Privacy',
          content:
            'Your privacy is important to us. Please review our Privacy Policy at stopbiting.today/privacy to understand how we handle your data. The core principle: your camera feed never leaves your device.',
        },
        {
          heading: '9. Disclaimer of Warranties',
          content:
            'The Service is provided "as is" without warranties of any kind, express or implied. We do not warrant that the Service will be uninterrupted, error-free, or that any defects will be corrected. Stop Biting is not a medical device and is not intended to diagnose, treat, or cure any condition.',
        },
        {
          heading: '10. Limitation of Liability',
          content:
            'To the fullest extent permitted by law, Stop Biting shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service. Our total liability for any claim shall not exceed the amount you paid us in the 12 months prior to the claim.',
        },
        {
          heading: '11. Changes to Terms',
          content:
            'We may update these Terms from time to time. We will notify users of significant changes by updating the "Last updated" date. Continued use of the Service after changes constitutes acceptance of the revised Terms.',
        },
        {
          heading: '12. Governing Law',
          content:
            'These Terms are governed by and construed in accordance with the laws of the European Union and applicable local law. Any disputes shall be resolved through good-faith negotiation, and if unresolved, through the appropriate courts of jurisdiction.',
        },
        {
          heading: '13. Contact',
          content:
            'If you have any questions about these Terms, please contact us at hello@stopbiting.today.',
        },
      ]}
    />
  );
}
