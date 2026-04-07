import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

// BeforeInstallPromptEvent is not in the standard TS lib yet
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'pwa_install_dismissed';

export function PWAInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show if user already dismissed or app is already installed
    if (localStorage.getItem(DISMISSED_KEY)) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!visible || !promptEvent) return null;

  const handleInstall = async () => {
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
      <div className="bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-xl shadow-card-md dark:shadow-card-md-dark p-4 flex items-start gap-3">
        <img
          src="/icons/icon-192x192.png"
          alt="Stop Biting"
          className="w-10 h-10 rounded-lg flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">Install Stop Biting</p>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Add to home screen for quick access — no app store needed.
          </p>
          <button
            onClick={handleInstall}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-forest-600 dark:text-forest-400 hover:text-forest-500 dark:hover:text-forest-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Install app
          </button>
        </div>
        <button
          onClick={handleDismiss}
          className="text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
