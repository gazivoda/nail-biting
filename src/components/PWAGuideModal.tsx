import { useEffect, useState } from 'react';
import { Download, X, Share, Plus, Check, Activity, Zap, Wifi } from 'lucide-react';
import { usePWAGuide } from '../hooks/usePWAGuide';
import { usePWAInstall } from '../hooks/usePWAInstall';

const BENEFITS = [
  {
    icon: <Activity size={15} />,
    title: 'Background detection',
    desc: 'AI keeps monitoring even when you switch apps',
  },
  {
    icon: <Zap size={15} />,
    title: 'Instant launch',
    desc: 'One tap from your home screen, no browser',
  },
  {
    icon: <Wifi size={15} />,
    title: 'Works offline',
    desc: 'Detection runs fully on-device, no internet needed',
  },
];

const IOS_STEPS = [
  {
    icon: <Share size={16} />,
    label: 'Tap the Share button',
    sub: 'the ↑ icon at the bottom of Safari',
  },
  {
    icon: <Plus size={16} />,
    label: 'Tap "Add to Home Screen"',
    sub: 'scroll down in the share sheet',
  },
  {
    icon: <Check size={16} />,
    label: 'Tap "Add"',
    sub: 'top-right corner of the dialog',
  },
];

export function PWAGuideModal() {
  const { visible, platform, snooze, dismiss } = usePWAGuide();
  const { canInstall, triggerInstall } = usePWAInstall();
  const [mounted, setMounted] = useState(false);

  // Trigger enter animation on next frame after mount
  useEffect(() => {
    if (!visible) { setMounted(false); return; }
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  if (!visible) return null;

  const handleInstall = async () => {
    const accepted = await triggerInstall();
    if (accepted) dismiss();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center transition-opacity duration-300 ${
        mounted ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => snooze(3)}
      />

      {/* Sheet */}
      <div
        className={`relative w-full sm:max-w-md mx-0 sm:mx-4 bg-white dark:bg-ink-50 rounded-t-2xl sm:rounded-2xl shadow-2xl transition-transform duration-300 ease-out ${
          mounted ? 'translate-y-0' : 'translate-y-6'
        }`}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-stone-200 dark:bg-ink-400" />
        </div>

        {/* Close */}
        <button
          onClick={() => snooze(3)}
          className="absolute right-4 top-4 text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition-colors"
          aria-label="Dismiss"
        >
          <X size={18} />
        </button>

        <div className="px-6 pt-4 pb-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5 pr-6">
            <img
              src="/icons/icon-192x192.png"
              alt="Stop Biting icon"
              className="w-12 h-12 rounded-2xl shadow-card flex-shrink-0"
            />
            <div>
              <h2 className="text-base font-bold text-stone-800 dark:text-stone-100 tracking-tight leading-snug">
                Stop Biting works best<br />as an installed app
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Free · no App Store · takes 10 seconds
              </p>
            </div>
          </div>

          {/* Benefits */}
          <div className="space-y-2.5 mb-6">
            {BENEFITS.map(({ icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-forest-100 dark:bg-forest-900/40 flex items-center justify-center text-forest-600 dark:text-forest-400 flex-shrink-0 mt-0.5">
                  {icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-700 dark:text-stone-200 leading-snug">{title}</p>
                  <p className="text-xs text-stone-400 dark:text-stone-500 leading-snug">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-stone-100 dark:border-ink-400 mb-5" />

          {/* Platform-specific instructions */}
          {platform === 'ios' ? (
            <>
              <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-3">
                How to install on iOS
              </p>
              <ol className="space-y-3 mb-5">
                {IOS_STEPS.map((step, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-forest-600 dark:bg-forest-700 flex items-center justify-center text-cream-100 flex-shrink-0 text-xs font-bold">
                      {i + 1}
                    </div>
                    <div className="flex-1 flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg border border-stone-200 dark:border-ink-400 flex items-center justify-center text-stone-500 dark:text-stone-400 flex-shrink-0">
                        {step.icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-stone-700 dark:text-stone-200">{step.label}</p>
                        <p className="text-xs text-stone-400 dark:text-stone-500">{step.sub}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-2.5 text-xs text-amber-700 dark:text-amber-400 mb-5">
                Make sure you're using <strong>Safari</strong> — only Safari supports installation on iOS.
              </div>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-3">
                Install in one click
              </p>
              <button
                onClick={handleInstall}
                disabled={!canInstall}
                className="w-full flex items-center justify-center gap-2 bg-forest-600 hover:bg-forest-500 disabled:opacity-40 disabled:cursor-not-allowed text-cream-100 font-semibold rounded-xl px-5 py-3 text-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_oklch(38%_0.12_148/0.35)] mb-5"
              >
                <Download size={15} />
                Install Stop Biting
              </button>
            </>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-stone-400 dark:text-stone-500">
              {platform === 'ios' ? 'Open in Safari to install' : 'No app store required'}
            </p>
            <button
              onClick={() => snooze(7)}
              className="text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
