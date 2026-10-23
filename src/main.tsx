import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { captureReferralFromLocation } from './billing/referralCapture'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// WS9: remember a ?ref= referral link, if the referrals flag is on. Does nothing for a visit without ?ref=.
void captureReferralFromLocation(window.location.search)

// Register service worker after page load to keep it off the critical render path.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // SW registration failure is non-fatal — app works without it.
    });
  });
}
