import { LayoutDashboard, History, Settings, ShieldCheck, LogOut, Zap, Download } from 'lucide-react';
import { trialLeft } from '../../utils/trial';
import { useAuth } from '../../contexts/AuthContext';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Rings } from '../site/Rings';
import { usePhoneViewActive } from '../../phone/activeStore';
import { useT, type messages } from '../../i18n/scopes/shell';

type Tab = 'dashboard' | 'log' | 'settings';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  onUpgrade: () => void;
}

const tabs: { id: Tab; label: keyof typeof messages; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'tabs.watch', icon: LayoutDashboard },
  { id: 'log', label: 'tabs.history', icon: History },
  { id: 'settings', label: 'tabs.settings', icon: Settings },
];

// The big number and its unit for the sidebar card, worked out from the end date with the same thresholds as
// trialLeft() (a day or more: days, rounded up; inside the last day: whole hours). Under an hour there is no number.
// Not read back out of trialLeft()'s sentence, which is in the language showing.
function trialCountdown(trialEndIso: string | null | undefined, now = Date.now()): { n: number; unit: 'day' | 'hour' } | null {
  if (!trialEndIso) return null;
  const ms = new Date(trialEndIso).getTime() - now;
  if (!(ms > 0)) return null;
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  if (ms >= day) return { n: Math.ceil(ms / day), unit: 'day' };
  if (ms >= hour) return { n: Math.floor(ms / hour), unit: 'hour' };
  return null;
}

export function TabBar({ active, onChange, onUpgrade }: Props) {
  const { user, accessStatus, signOut } = useAuth();
  const { canInstall, triggerInstall } = usePWAInstall();
  const t = useT();
  // WS6: while the phone view is showing, the first tab is not about watching.
  const phoneView = usePhoneViewActive();
  const items = tabs.map(tab => ({ ...tab, text: t(phoneView && tab.id === 'dashboard' ? 'tabs.today' : tab.label) }));

  const trialLeftText = trialLeft(user?.trial_end_date);
  const trialNumber = trialCountdown(user?.trial_end_date);

  const avatarUrl = user?.avatar;
  const displayName = user?.name ?? user?.email ?? '';
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      {/* ── Desktop sidebar (lg+) ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex fixed top-0 left-0 h-screen w-56 bg-white dark:bg-ink-200 border-r border-stone-200 dark:border-ink-400 flex-col z-50 ">
        {/* Brand: the same lockup as the site header (mark + Bricolage wordmark). */}
        <div className="flex h-16 items-center px-5 border-b border-stone-200 dark:border-ink-400">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="" className="h-8 w-8 flex-shrink-0 dark:hidden" />
            <img src="/logo-dark.svg" alt="" className="hidden h-8 w-8 flex-shrink-0 dark:block" />
            <span className="whitespace-nowrap font-display text-xl font-extrabold tracking-[-0.03em] text-stone-900 dark:text-stone-100">Stop Biting</span>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-3 space-y-0.5" aria-label={t('nav.main')}>
          {items.map(({ id, text, icon: Icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                data-tour={id === 'log' ? 'history-tab' : undefined}
                onClick={() => onChange(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative w-full flex items-center gap-3 px-4 min-h-12 rounded-full text-[0.9375rem] transition-colors duration-150 text-left overflow-hidden ${
                  isActive
                    ? 'bg-deep text-white dark:bg-lime-300 dark:text-deep font-semibold'
                    : 'font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-ink-50/60'
                }`}
              >
                <Icon size={18} aria-hidden="true" />
                {text}
              </button>
            );
          })}
        </nav>

        {/* Trial card: deep, bitten, ringed, with the days left as the numeral. */}
        {accessStatus === 'trial_active' && (
          <div className="sg-dark bite relative mx-3 mb-3 overflow-hidden rounded-2xl bg-deep p-4 text-white" style={{ ['--bite' as string]: '26px' }}>
            <Rings className="-right-16 -top-4 h-48 w-48" />
            <div className="relative">
              <p className="text-xs font-semibold text-white/70">{t('trial.title')}</p>
              {trialNumber ? (
                <p className="mt-1 flex items-baseline gap-1.5 text-white">
                  <span className="font-display text-6xl font-extrabold leading-[0.9] tracking-[-0.045em]">{trialNumber.n}</span>
                  <span className="text-sm font-semibold text-lime-300">{t(trialNumber.unit === 'day' ? 'trial.daysLeft' : 'trial.hoursLeft', { count: trialNumber.n })}</span>
                </p>
              ) : (
                <p className="mt-1 font-display text-2xl font-extrabold leading-tight tracking-[-0.03em]">{trialLeftText ?? t('trial.endsToday')}</p>
              )}
              <button
                onClick={onUpgrade}
                className="mt-4 flex w-full min-h-11 items-center justify-center gap-1.5 rounded-full bg-lime-300 px-3 py-2 font-display text-sm font-bold text-deep transition-colors duration-150 hover:bg-lime-200"
              >
                <Zap size={13} aria-hidden="true" />
                {t('trial.upgrade')}
              </button>
            </div>
          </div>
        )}

        {/* User + theme section */}
        {user && (
          <div className="px-3 pb-3 border-t border-stone-200 dark:border-ink-400 pt-3 space-y-2">
            <div className="flex items-center gap-2">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover ring-1 ring-stone-200 dark:ring-ink-400" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-deep text-white dark:bg-lime-300 dark:text-deep dark:bg-ink-50 flex items-center justify-center font-display text-xs font-bold">
                  {initials || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">{displayName}</p>
                {accessStatus === 'subscribed' && (
                  <p className="text-xs text-forest-600 dark:text-forest-400 font-medium tracking-wide">{t('account.subscribed')}</p>
                )}
              </div>
            </div>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-2 min-h-11 px-2 py-2 rounded-full text-xs text-stone-600 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-ink-50 transition-colors"
            >
              <LogOut size={12} />
              {t('account.signOut')}
            </button>
          </div>
        )}

        {/* Install app button */}
        {canInstall && (
          <div className="mx-3 mb-2">
            <button
              onClick={triggerInstall}
              className="w-full flex items-center gap-2 min-h-11 px-3 py-2.5 rounded-full text-xs text-stone-600 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-ink-50 transition-colors border border-stone-200 dark:border-ink-400"
            >
              <Download size={13} />
              {t('install.app')}
            </button>
          </div>
        )}

        {/* Privacy footer */}
        <div className="p-4 border-t border-stone-200 dark:border-ink-400">
          <div className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400 text-xs">
            <ShieldCheck size={11} />
            <span>{t('privacy.footer')}</span>
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom nav (< lg) ──────────────────────────────────────── */}
      <nav
        aria-label={t('nav.main')}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-ink-200 border-t border-stone-200 dark:border-ink-400 flex items-stretch"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {items.map(({ id, text, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              data-tour={id === 'log' ? 'history-tab' : undefined}
              onClick={() => onChange(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 flex min-h-14 flex-col items-center justify-center gap-1 py-2 transition-colors ${
                isActive
                  ? 'text-deep dark:text-lime-300'
                  : 'text-stone-500 dark:text-stone-400 active:text-stone-600 dark:active:text-stone-300'
              }`}
            >
              <span className={`flex h-8 items-center rounded-full px-6 transition-colors ${isActive ? 'bg-deep text-white dark:bg-lime-300 dark:text-deep' : ''}`}>
                <Icon size={20} aria-hidden="true" />
              </span>
              <span className={`text-xs ${isActive ? 'font-bold' : 'font-medium'}`}>{text}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
