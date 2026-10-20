// Funnel events for the one question the site cannot yet answer: where do
// visitors drop between "saw the page" and "started a trial".
//
// They go to the Google Analytics that index.html already loads and the privacy
// policy already discloses, as aggregate counts with no parameters. Nothing
// here identifies a person, and nothing is sent when gtag has not loaded
// (blocked, offline, or before the deferred load handler runs).
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
  | 'pricing_view';

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
