import { LayoutDashboard, History, Settings, ShieldCheck, LogOut, Zap, Download } from 'lucide-react';
import { trialLeft } from '../../utils/trial';
import { useAuth } from '../../contexts/AuthContext';
import { usePWAInstall } from '../../hooks/usePWAInstall';

type Tab = 'dashboard' | 'log' | 'settings';

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  onUpgrade: () => void;
}

const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Watch', icon: LayoutDashboard },
  { id: 'log', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function TabBar({ active, onChange, onUpgrade }: Props) {
  const { user, accessStatus, signOut } = useAuth();
  const { canInstall, triggerInstall } = usePWAInstall();

  const trialLeftText = trialLeft(user?.trial_end_date);

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
        {/* Brand */}
        <div className="px-5 py-5 border-b border-stone-200 dark:border-ink-400">
          <div className="flex items-center gap-2.5">
            {/* The site's arch mark, as on every marketing page and the
                paywall, so the brand doesn't change the moment you sign in. */}
            <img src="/logo.svg" alt="" className="w-8 h-8 flex-shrink-0 dark:hidden" />
            <img src="/logo-dark.svg" alt="" className="hidden w-8 h-8 flex-shrink-0 dark:block" />
            <div>
              <p className="font-display text-lg font-extrabold tracking-[-0.03em] text-stone-900 dark:text-stone-100">Stop Biting</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-3 space-y-0.5" aria-label="Main navigation">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                data-tour={id === 'log' ? 'history-tab' : undefined}
                onClick={() => onChange(id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative w-full flex items-center gap-3 px-3 py-3 rounded-full text-sm transition-all duration-150 text-left overflow-hidden ${
                  isActive
                    ? 'bg-deep text-white dark:bg-lime-300 dark:text-deep font-semibold'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100/70 dark:hover:bg-ink-50/60'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Trial upgrade prompt */}
        {accessStatus === 'trial_active' && (
          <div className="mx-3 mb-3 bg-deep rounded-3xl p-4">
            <p className="text-sm text-white font-display font-bold mb-0.5">Free trial</p>
            <p className="text-xs text-white/70 mb-3">
              {trialLeftText ?? 'Ends today'}
            </p>
            <button
              onClick={onUpgrade}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-lime-300 hover:bg-lime-200 text-deep text-xs font-bold transition-colors duration-150"
            >
              <Zap size={11} />
              Upgrade
            </button>
          </div>
        )}

        {/* User + theme section */}
        {user && (
          <div className="px-3 pb-3 border-t border-stone-200 dark:border-ink-400 pt-3 space-y-2">
            <div className="flex items-center gap-2">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover ring-1 ring-stone-200 dark:ring-ink-400" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-stone-200 dark:bg-ink-50 flex items-center justify-center text-xs font-medium text-stone-600 dark:text-stone-300">
                  {initials || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-stone-700 dark:text-stone-200 truncate">{displayName}</p>
                {accessStatus === 'subscribed' && (
                  <p className="text-xs text-forest-600 dark:text-forest-400 font-medium tracking-wide">Subscribed</p>
                )}
              </div>
            </div>
            <button
              onClick={signOut}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-stone-500 dark:text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-ink-50 transition-colors"
            >
              <LogOut size={12} />
              Sign out
            </button>
          </div>
        )}

        {/* Install app button */}
        {canInstall && (
          <div className="mx-3 mb-2">
            <button
              onClick={triggerInstall}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-ink-50 transition-colors border border-stone-200 dark:border-ink-400"
            >
              <Download size={13} />
              Install app
            </button>
          </div>
        )}

        {/* Privacy footer */}
        <div className="p-4 border-t border-stone-200 dark:border-ink-400">
          <div className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400 text-xs">
            <ShieldCheck size={11} />
            <span>Camera stays on-device</span>
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom nav (< lg) ──────────────────────────────────────── */}
      <nav
        aria-label="Main navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-ink-200/95 backdrop-blur-md border-t border-stone-200 dark:border-ink-400 flex items-stretch"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              data-tour={id === 'log' ? 'history-tab' : undefined}
              onClick={() => onChange(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                isActive
                  ? 'text-deep dark:text-lime-300 font-bold'
                  : 'text-stone-500 dark:text-stone-400 active:text-stone-600 dark:active:text-stone-300'
              }`}
            >
              <Icon size={20} />
              <span className="text-xs font-medium">{label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
