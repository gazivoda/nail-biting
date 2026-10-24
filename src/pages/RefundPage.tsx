import { LegalPage } from './LegalPage';

export function RefundPage() {
  return (
    <LegalPage
      title="Refund Policy"
      lastUpdated="October 24, 2026"
      sections={[
        {
          heading: '1. Overview',
          content:
            'We want you to be satisfied with Stop Biting. This policy outlines when and how refunds are issued for subscription payments and for the one-time Lifetime plan.',
        },
        {
          heading: '2. Free Trial',
          content:
            'All new users receive a 3-day free trial with full access to all features. No credit card is required to start the trial. We encourage you to fully evaluate the Service during the trial period before subscribing.',
        },
        {
          heading: '3. Refund Eligibility',
          content: [
            'You may request a full refund within 14 days of your initial subscription payment, or of your Lifetime plan payment, if you are not satisfied with the Service.',
            'Refunds are available for the first payment of a new subscription, or for a Lifetime plan payment.',
            'Refunds are not available for renewal payments on an existing subscription.',
            'Refunds are not available if your account has been terminated for violating our Terms of Service.',
          ],
        },
        {
          heading: '4. Lifetime Plan',
          content:
            'You may request a full refund of the Lifetime plan within 14 days of payment, the same way as for subscriptions (see "How to Request a Refund"). When a refund is issued, Lifetime access ends and your account returns to whatever other access it has, such as a trial or a subscription.',
        },
        {
          heading: '5. Referral Bonus Access',
          content:
            'Bonus access earned through the referral program has no cash value and is not refundable. If the payment that earned it is refunded or charged back, the bonus access it earned is removed from both accounts.',
        },
        {
          heading: '6. How to Request a Refund',
          content:
            'To request a refund, email hello@stopbiting.today within 14 days of your payment with the subject line "Refund Request". Please include the email address associated with your account and your Paddle transaction ID. We will process your request within 5 business days.',
        },
        {
          heading: '7. Processing',
          content:
            'Approved refunds are processed back to your original payment method via Paddle. Processing time is typically 3–5 business days, depending on your payment provider and bank. Once a refund is issued, your subscription will be cancelled, or your Lifetime access will end, and access to paid features will end.',
        },
        {
          heading: '8. Cancellation',
          content:
            'You may cancel your subscription at any time from within the app or via the cancellation link in your Paddle receipt email. Cancellation stops future charges. You will retain access to the Service until the end of your current billing period. Cancellation alone does not trigger a refund.',
        },
        {
          heading: '9. Exceptional Circumstances',
          content:
            'If you were charged due to a technical error or other exceptional circumstance not covered above, please contact us at hello@stopbiting.today and we will review your case individually.',
        },
        {
          heading: '10. Contact',
          content:
            'For refund requests or billing questions, contact hello@stopbiting.today. We aim to respond within 1 business day.',
        },
      ]}
    />
  );
}
