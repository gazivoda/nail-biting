// Funnel events for the one question the site cannot yet answer: where do
// visitors drop between "saw the page" and "started a trial".
//
// They go to the Google Analytics that index.html already loads and the privacy
// policy already discloses, as aggregate counts with no parameters. Nothing
// here identifies a person. index.html queues gtag calls from the first line of the
// page (only the gtag.js download waits for `load`), so an early event is kept, and
// nothing is sent when the tag is absent (an automated browser, navigator.webdriver).
// The in-app milestones (signin_complete and the flagged camera events) are sent from
// src/utils/appAnalytics.ts through this same function.
export type FunnelEvent =
  | 'demo_start'
  | 'demo_complete'
  | 'demo_camera_failed'
  | 'trial_click'
  | 'signin_click'
  | 'phone_link_click'
  | 'demo_link_click'
  | 'tracker_pdf_download'
  | 'calculator_use'
  | 'pricing_view'
  | 'share_click'
  // In-app milestones, sent with no parameters (src/utils/appAnalytics.ts).
  // detection_start and first_alarm come from the camera and the detector, so
  // they stay off behind the app_analytics flag until the privacy wording is updated.
  | 'signin_complete'
  | 'detection_start'
  | 'first_alarm';

// Which button was clicked, so the demo-to-trial rate can be separated from the
// plain landing-page rate. A fixed label, never anything about the visitor.
type Gtag = (command: 'event', name: string, params?: { source: string }) => void;

export function track(name: FunnelEvent, source?: string): void {
  try {
    const gtag = (window as unknown as { gtag?: Gtag }).gtag;
    if (typeof gtag === 'function') gtag('event', name, source ? { source } : undefined);
  } catch {
    // Analytics must never break the page.
  }
}
