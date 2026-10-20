import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallPrompt() {
  const { canInstall, bannerDismissed, triggerInstall, dismissBanner } = usePWAInstall();
  const [show, setShow] = useState(false);

  // Slide in after a short delay once the prompt is available
  useEffect(() => {
    if (!canInstall || bannerDismissed) return;
    const timer = setTimeout(() => setShow(true), 800);
    return () => clearTimeout(timer);
  }, [canInstall, bannerDismissed]);

  if (!canInstall || bannerDismissed) return null;

  const handleInstall = async () => {
    const accepted = await triggerInstall();
    if (accepted) setShow(false);
  };

  const handleDismiss = () => {
    setShow(false);
    // Wait for slide-out animation to finish before removing from DOM
    setTimeout(dismissBanner, 300);
  };

  return (
    <div
      className={`app-type fixed bottom-4 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4 transition-all duration-300 ease-out sm:left-auto sm:right-2 sm:translate-x-0 ${
        show ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      }`}
    >
      <div className="bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-2xl p-4 flex items-start gap-3">
        <img
          src="/icons/icon-192x192.png"
          alt="Stop Biting"
          className="w-11 h-11 rounded-xl flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="font-display text-base font-extrabold tracking-[-0.03em] text-stone-900 dark:text-stone-100">Install Stop Biting</p>
          <p className="text-sm text-stone-600 dark:text-stone-400 mt-0.5">
            Add to home screen for quick access, no app store needed.
          </p>
          <button
            onClick={handleInstall}
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-deep px-5 font-display text-sm font-bold text-white transition-colors hover:bg-forest-500 dark:bg-lime-300 dark:text-deep dark:hover:bg-lime-200"
          >
            <Download className="w-3.5 h-3.5" />
            Install app
          </button>
        </div>
        <button
          onClick={handleDismiss}
          className="-mr-2 -mt-2 flex h-11 w-11 flex-shrink-0 items-center justify-center text-stone-500 transition-colors hover:text-stone-600 dark:text-stone-400 dark:hover:text-stone-300"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
