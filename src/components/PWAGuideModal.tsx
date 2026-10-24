import { useEffect, useState } from 'react';
import { Download, X, Share, Plus, Check, Activity, Zap, Wifi } from 'lucide-react';
import { usePWAGuide } from '../hooks/usePWAGuide';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { usePhoneViewActive } from '../phone/activeStore';
import { useT, type messages } from '../i18n/scopes/shell';

type Key = keyof typeof messages;

const BENEFITS: { icon: React.ReactNode; title: Key; desc: Key }[] = [
  {
    icon: <Activity size={15} />,
    title: 'pwa.benefit.background.title',
    desc: 'pwa.benefit.background.desc',
  },
  {
    icon: <Zap size={15} />,
    title: 'pwa.benefit.instant.title',
    desc: 'pwa.benefit.instant.desc',
  },
  {
    icon: <Wifi size={15} />,
    title: 'pwa.benefit.device.title',
    desc: 'pwa.benefit.device.desc',
  },
];

// WS6: on the phone view there is no detection to keep running, so the first benefit
// and the last one are about what the phone view actually does.
const PHONE_BENEFITS: { icon: React.ReactNode; title: Key; desc: Key }[] = [
  {
    icon: <Zap size={15} />,
    title: 'pwa.benefit.instant.title',
    desc: 'pwa.benefit.instant.desc',
  },
  {
    icon: <Activity size={15} />,
    title: 'pwa.benefit.log.title',
    desc: 'pwa.benefit.log.desc',
  },
  {
    icon: <Wifi size={15} />,
    title: 'pwa.benefit.offline.title',
    desc: 'pwa.benefit.offline.desc',
  },
];

const IOS_STEPS: { icon: React.ReactNode; label: Key; sub: Key }[] = [
  {
    icon: <Share size={16} />,
    label: 'pwa.ios.share.label',
    sub: 'pwa.ios.share.sub',
  },
  {
    icon: <Plus size={16} />,
    label: 'pwa.ios.add.label',
    sub: 'pwa.ios.add.sub',
  },
  {
    icon: <Check size={16} />,
    label: 'pwa.ios.confirm.label',
    sub: 'pwa.ios.confirm.sub',
  },
];

export function PWAGuideModal() {
  const { visible, platform, snooze, dismiss } = usePWAGuide();
  const { canInstall, triggerInstall } = usePWAInstall();
  const phoneView = usePhoneViewActive();
  const t = useT();
  const [mounted, setMounted] = useState(false);

  // Trigger enter animation on next frame after mount
  useEffect(() => {
    if (!visible) { setMounted(false); return; }
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  // For Chromium, only show when the browser has actually offered the install prompt.
  // The 4-second timer fires before beforeinstallprompt in many sessions — showing
  // the modal with a disabled button is confusing and looks broken.
  if (!visible || (platform === 'chromium' && !canInstall)) return null;

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
        className="absolute inset-0 bg-black/60"
        onClick={() => snooze(3)}
      />

      {/* Sheet */}
      <div
        className={`relative w-full sm:max-w-md mx-0 sm:mx-4 bg-white dark:bg-ink-50 rounded-t-2xl sm:rounded-2xl border border-stone-200 dark:border-ink-400 transition-transform duration-300 ease-out ${
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
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center text-stone-500 hover:text-stone-600 dark:text-stone-400 dark:hover:text-stone-300 transition-colors"
          aria-label={t('pwa.dismiss')}
        >
          <X size={18} />
        </button>

        <div className="px-6 pt-4 pb-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5 pr-6">
            <img
              src="/icons/icon-192x192.png"
              alt={t('pwa.iconAlt')}
              className="w-12 h-12 rounded-2xl flex-shrink-0"
            />
            <div>
              <h2 className="font-display text-xl font-extrabold text-stone-900 dark:text-stone-100 tracking-[-0.035em] leading-[1.05]">
                {t('pwa.title.line1')}<br />{t('pwa.title.line2')}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                {t('pwa.subtitle')}
              </p>
            </div>
          </div>

          {/* Benefits */}
          <div className="space-y-2.5 mb-6">
            {(phoneView ? PHONE_BENEFITS : BENEFITS).map(({ icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-deep dark:bg-lime-300 flex items-center justify-center text-lime-300 dark:text-deep flex-shrink-0 mt-0.5">
                  {icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-700 dark:text-stone-200 leading-snug">{t(title)}</p>
                  <p className="text-xs text-stone-500 dark:text-stone-400 leading-snug">{t(desc)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-stone-100 dark:border-ink-400 mb-5" />

          {/* Platform-specific instructions */}
          {platform === 'ios' ? (
            <>
              <p className="font-display text-base font-extrabold tracking-[-0.03em] text-stone-900 dark:text-stone-100 mb-3">
                {t('pwa.ios.heading')}
              </p>
              <ol className="space-y-3 mb-5">
                {IOS_STEPS.map((step, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-deep dark:bg-lime-300 flex items-center justify-center text-white dark:text-deep flex-shrink-0 text-xs font-bold">
                      {i + 1}
                    </div>
                    <div className="flex-1 flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg border border-stone-200 dark:border-ink-400 flex items-center justify-center text-stone-500 dark:text-stone-400 flex-shrink-0">
                        {step.icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-stone-700 dark:text-stone-200">{t(step.label)}</p>
                        <p className="text-xs text-stone-500 dark:text-stone-400">{t(step.sub)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl px-4 py-3 text-xs text-amber-700 dark:text-amber-400 mb-5">
                {t.rich('pwa.ios.warning', {}, { b: chunks => <strong>{chunks}</strong> })}
              </div>
            </>
          ) : (
            <>
              <p className="font-display text-base font-extrabold tracking-[-0.03em] text-stone-900 dark:text-stone-100 mb-3">
                {t('pwa.install.heading')}
              </p>
              <button
                onClick={handleInstall}
                disabled={!canInstall}
                className="w-full flex items-center justify-center gap-2 bg-deep hover:bg-forest-500 dark:bg-lime-300 dark:hover:bg-lime-200 disabled:opacity-40 disabled:cursor-not-allowed text-white dark:text-deep font-display font-bold rounded-full px-5 min-h-12 text-sm transition-colors duration-150 mb-5"
              >
                <Download size={15} />
                {t('pwa.install.button')}
              </button>
            </>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {platform === 'ios' ? t('pwa.footer.ios') : t('pwa.footer.other')}
            </p>
            <button
              onClick={() => snooze(7)}
              className="min-h-11 px-2 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
            >
              {t('pwa.later')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
