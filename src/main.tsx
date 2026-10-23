import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// The packaged desktop app (window.desktop, set by electron/preload.ts) gets its
// tray bridge and camera explanation. A browser never loads this chunk.
if (window.desktop) {
  import('./desktop/desktopHost').then((m) => m.mountDesktopHost());
}

// Register service worker after page load to keep it off the critical render path.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // SW registration failure is non-fatal — app works without it.
    });
  });
}
