import { LayoutDashboard, History, Settings, ShieldCheck, LogOut, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

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
    <aside className="fixed top-0 left-0 h-screen w-56 bg-slate-900 border-r border-slate-800 flex flex-col z-50">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <p className="text-sm font-semibold text-slate-100">Nail Habit</p>
        </div>
        <p className="text-xs text-slate-600 mt-0.5">AI nail biting detector</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-3 space-y-1" aria-label="Main navigation">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors text-left border ${
              active === id
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-900/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-transparent'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      {/* Trial upgrade prompt */}
      {accessStatus === 'trial_active' && (
        <div className="mx-3 mb-3 border border-emerald-900/50 bg-emerald-950/30 rounded-xl p-3">
          <p className="text-xs text-emerald-400 font-medium mb-0.5">Free trial</p>
          <p className="text-xs text-slate-500 mb-2">
            {trialDaysLeft > 0
              ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} remaining`
              : 'Expires today'}
          </p>
          <button
            onClick={onUpgrade}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors"
          >
            <Zap size={11} />
            Upgrade
          </button>
        </div>
      )}

      {/* User section */}
      {user && (
        <div className="px-3 pb-3 border-t border-slate-800 pt-3">
          <div className="flex items-center gap-2 mb-2">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-300">
                {initials || '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate">{displayName}</p>
              {accessStatus === 'subscribed' && (
                <p className="text-xs text-emerald-500">Pro</p>
              )}
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <LogOut size={12} />
            Sign out
          </button>
        </div>
      )}

      {/* Privacy footer */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-1.5 text-slate-700 text-xs">
          <ShieldCheck size={11} />
          <span>Camera stays on-device</span>
        </div>
      </div>
    </aside>
  );
}
