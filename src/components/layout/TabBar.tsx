import { LayoutDashboard, History, Settings, ShieldCheck, LogOut, Zap, Download } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ThemeToggle } from '../ThemeToggle';
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

  const trialDaysLeft = user?.trial_end_date
    ? Math.max(0, Math.ceil((new Date(user.trial_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

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
      <aside className="hidden lg:flex fixed top-0 left-0 h-screen w-56 bg-white dark:bg-ink-200 border-r border-stone-200 dark:border-ink-400 flex-col z-50 shadow-[1px_0_0_0_oklch(88%_0.014_120/0.5)]">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-stone-200 dark:border-ink-400">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="Stop Biting logo" className="w-8 h-8 flex-shrink-0" />
            <p className="text-sm font-semibold tracking-tight text-stone-800 dark:text-stone-100">Stop Biting</p>
          </div>
          <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5 tracking-wide">AI nail biting detector</p>
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
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 text-left overflow-hidden ${
                  isActive
                    ? 'bg-forest-50 dark:bg-forest-900/40 text-forest-700 dark:text-forest-300 font-medium shadow-sm'
                    : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-ink-50'
                }`}
              >
                <span
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-forest-500 transition-all duration-200 ${
                    isActive ? 'h-5 opacity-100' : 'h-0 opacity-0'
                  }`}
                />
                <Icon size={15} />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Trial upgrade prompt */}
        {accessStatus === 'trial_active' && (
          <div className="mx-3 mb-3 border border-forest-200 dark:border-forest-800 bg-forest-50 dark:bg-forest-900/30 rounded-xl p-3">
            <p className="text-xs text-forest-700 dark:text-forest-400 font-medium mb-0.5">Free trial</p>
            <p className="text-xs text-stone-500 dark:text-stone-400 mb-2">
              {trialDaysLeft > 0
                ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} remaining`
                : 'Expires today'}
            </p>
            <button
              onClick={onUpgrade}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-forest-600 hover:bg-forest-500 text-cream-100 text-xs font-medium transition-all duration-150 hover:shadow-[0_2px_8px_oklch(38%_0.12_148/0.4)]"
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
                  <p className="text-[10px] text-forest-600 dark:text-forest-400 font-medium tracking-wide">Pro</p>
                )}
              </div>
            </div>
            <ThemeToggle fullWidth />
            <button
              onClick={signOut}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-ink-50 transition-colors"
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
          <div className="flex items-center gap-1.5 text-stone-400 dark:text-stone-500 text-[11px]">
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
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                isActive
                  ? 'text-forest-600 dark:text-forest-400'
                  : 'text-stone-400 dark:text-stone-500 active:text-stone-600 dark:active:text-stone-300'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
        {/* Theme toggle as icon in bottom bar */}
        <div className="flex items-center justify-center px-3 border-l border-stone-100 dark:border-ink-400">
          <ThemeToggle />
        </div>
      </nav>
    </>
  );
}
