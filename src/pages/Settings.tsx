import { useState, useRef } from 'react';
import { Bell, ShieldCheck, Sliders, Trash2, Volume2, CreditCard, ExternalLink, Zap, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { requestNotificationPermission } from '../hooks/useNotifications';
import { useAuth, apiFetch } from '../contexts/AuthContext';
import type { DetectionSensitivity, AlertType, AlertSound, ReminderInterval } from '../types';

function Section({ title, icon: Icon, children, fullWidth }: {
  title: string;
  icon: typeof Bell;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={`bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-2xl overflow-hidden shadow-card dark:shadow-card-dark ${fullWidth ? 'col-span-2' : ''}`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100 dark:border-ink-400">
        <Icon size={15} className="text-stone-400 dark:text-stone-500" />
        <p className="text-sm font-medium text-stone-700 dark:text-stone-300">{title}</p>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function Row({ label, description, children }: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-stone-800 dark:text-stone-200">{label}</p>
        {description && <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors duration-200 ${value ? 'bg-forest-500' : 'bg-stone-200 dark:bg-ink-400'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 shadow-sm ${value ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  );
}

function Pills<T extends string>({ options, value, onChange }: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap justify-end">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 rounded-lg text-xs transition-colors duration-150 ${
            value === opt.value
              ? 'bg-forest-600 text-white'
              : 'bg-stone-100 dark:bg-ink-300 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-ink-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// --------------------------------------------------------------------------
// Web Audio preview — fires a one-shot preview of a sound
// --------------------------------------------------------------------------
function previewSound(sound: AlertSound) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (sound) {
      case 'alarm':
        osc.type = 'square';
        osc.frequency.value = 1000;
        gain.gain.setValueAtTime(0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
        break;
      case 'chime':
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 1.2);
        break;
      case 'buzz':
        osc.type = 'sawtooth';
        osc.frequency.value = 120;
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.18);
        break;
      case 'chirp':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.45, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
        break;
      case 'whistle':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
        break;
    }

    setTimeout(() => ctx.close(), 1500);
  } catch { /* ignore */ }
}

const SOUND_OPTIONS: {
  value: AlertSound;
  label: string;
  description: string;
  emoji: string;
}[] = [
  { value: 'alarm',   label: 'Alarm',   description: 'Rapid alternating beeps',    emoji: '🔔' },
  { value: 'chime',   label: 'Chime',   description: 'Soft decaying bell',         emoji: '🎵' },
  { value: 'buzz',    label: 'Buzz',    description: 'Low harsh rumble',            emoji: '📳' },
  { value: 'chirp',   label: 'Chirp',   description: 'Ascending sweep tone',       emoji: '🐦' },
  { value: 'whistle', label: 'Whistle', description: 'Descending pure tone',       emoji: '🎶' },
];

function SoundPicker({ value, onChange }: { value: AlertSound; onChange: (s: AlertSound) => void }) {
  const [previewing, setPreviewing] = useState<AlertSound | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handlePreview(sound: AlertSound, e: React.MouseEvent) {
    e.stopPropagation();
    previewSound(sound);
    setPreviewing(sound);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPreviewing(null), 700);
  }

  return (
    <div className="grid grid-cols-5 gap-2">
      {SOUND_OPTIONS.map(opt => {
        const isSelected = value === opt.value;
        const isPreviewing = previewing === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`group flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all duration-150 ${
              isSelected
                ? 'bg-forest-50 dark:bg-forest-900/40 border-forest-400 dark:border-forest-700 shadow-sm'
                : 'bg-stone-50 dark:bg-ink-100 border-stone-200 dark:border-ink-400 hover:border-stone-300 dark:hover:border-ink-300'
            }`}
          >
            <span className="text-2xl leading-none">{opt.emoji}</span>
            <div className="space-y-0.5">
              <p className={`text-xs font-medium ${isSelected ? 'text-forest-700 dark:text-forest-300' : 'text-stone-700 dark:text-stone-300'}`}>
                {opt.label}
              </p>
              <p className="text-[10px] text-stone-400 dark:text-stone-500 leading-snug">{opt.description}</p>
            </div>
            <button
              onClick={(e) => handlePreview(opt.value, e)}
              aria-label={`Preview ${opt.label}`}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] transition-all duration-150 ${
                isPreviewing
                  ? 'bg-forest-500 text-white'
                  : 'bg-stone-200 dark:bg-ink-300 text-stone-500 dark:text-stone-400 hover:bg-stone-300 dark:hover:bg-ink-200'
              }`}
            >
              <Volume2 size={9} />
              {isPreviewing ? 'Playing' : 'Preview'}
            </button>
          </button>
        );
      })}
    </div>
  );
}

// ── Plan section ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  trial:     { label: 'Free Trial', className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700' },
  active:    { label: 'Active',     className: 'bg-forest-100 dark:bg-forest-900/30 text-forest-700 dark:text-forest-400 border border-forest-200 dark:border-forest-700' },
  paused:    { label: 'Paused',     className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700' },
  cancelled: { label: 'Cancelled',  className: 'bg-stone-100 dark:bg-ink-300 text-stone-500 dark:text-stone-400 border border-stone-200 dark:border-ink-400' },
  expired:   { label: 'Expired',    className: 'bg-stone-100 dark:bg-ink-300 text-stone-500 dark:text-stone-400 border border-stone-200 dark:border-ink-400' },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function PlanSection({ onUpgrade }: { onUpgrade?: () => void }) {
  const { user, accessStatus } = useAuth();
  const [portalLoading, setPortalLoading] = useState(false);

  if (!user) return null;

  const { subscription_status, subscription_plan, subscription_end_date, trial_end_date } = user;
  const badge = STATUS_BADGE[subscription_status] ?? STATUS_BADGE.expired;

  const trialDaysLeft = trial_end_date
    ? Math.max(0, Math.ceil((new Date(trial_end_date).getTime() - Date.now()) / 86_400_000))
    : 0;

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { url } = await apiFetch('/api/paddle/portal-session') as { url: string };
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      window.open('https://customer.paddle.com/', '_blank', 'noopener,noreferrer');
    } finally {
      setPortalLoading(false);
    }
  };

  const canManage = subscription_status === 'active' || subscription_status === 'paused' || subscription_status === 'cancelled';

  return (
    <Section title="Plan" icon={CreditCard} fullWidth>
      <div className="flex items-center justify-between gap-4 flex-wrap">

        {/* Status + detail */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-forest-100 dark:bg-forest-900/40 flex items-center justify-center text-forest-600 dark:text-forest-400 flex-shrink-0">
            <CreditCard size={17} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${badge.className}`}>
                {badge.label}
              </span>
              {(subscription_status === 'active' || subscription_status === 'paused') && subscription_plan && (
                <span className="text-sm font-semibold text-stone-800 dark:text-stone-100">
                  Stop Biting Pro · {subscription_plan === 'yearly' ? 'Yearly' : 'Monthly'}
                </span>
              )}
              {subscription_status === 'trial' && (
                <span className="text-sm font-semibold text-stone-800 dark:text-stone-100">Stop Biting</span>
              )}
              {subscription_status === 'cancelled' && (
                <span className="text-sm font-semibold text-stone-800 dark:text-stone-100">Stop Biting Pro</span>
              )}
            </div>
            <p className="text-xs text-stone-400 dark:text-stone-500">
              {subscription_status === 'trial' && trial_end_date && (
                trialDaysLeft > 0
                  ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left in trial — ends ${fmt(trial_end_date)}`
                  : 'Trial has ended'
              )}
              {subscription_status === 'active' && subscription_end_date && `Renews ${fmt(subscription_end_date)}`}
              {subscription_status === 'paused' && subscription_end_date && `Access until ${fmt(subscription_end_date)}`}
              {subscription_status === 'cancelled' && subscription_end_date && `Access until ${fmt(subscription_end_date)}`}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {accessStatus === 'trial_active' && onUpgrade && (
            <button
              onClick={onUpgrade}
              className="inline-flex items-center gap-1.5 bg-forest-600 hover:bg-forest-500 text-cream-100 font-semibold rounded-xl px-4 py-2 text-xs transition-all duration-150 hover:-translate-y-0.5"
            >
              <Zap size={12} />
              Upgrade to Pro
            </button>
          )}
          {canManage && (
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="inline-flex items-center gap-1.5 border border-stone-200 dark:border-ink-400 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-ink-100 rounded-xl px-4 py-2 text-xs transition-colors disabled:opacity-50"
            >
              {portalLoading ? <RefreshCw size={12} className="animate-spin" /> : <ExternalLink size={12} />}
              {portalLoading ? 'Opening…' : 'Manage subscription'}
            </button>
          )}
        </div>

      </div>
    </Section>
  );
}

export function Settings({ onUpgrade }: { onUpgrade?: () => void }) {
  const {
    detectionSensitivity, setSensitivity,
    alertType, setAlertType,
    alertSound, setAlertSound,
    remindersEnabled, setRemindersEnabled,
    reminderIntervalMinutes, setReminderInterval,
    clearAllData,
  } = useAppStore();

  const [showConfirm, setShowConfirm] = useState(false);
  const [notifStatus, setNotifStatus] = useState<string>('');

  const handleReminderToggle = async (val: boolean) => {
    if (val && 'Notification' in window && Notification.permission !== 'granted') {
      const perm = await requestNotificationPermission();
      if (perm !== 'granted') {
        setNotifStatus('Notifications blocked — enable in browser settings');
        return;
      }
    }
    setNotifStatus('');
    setRemindersEnabled(val);
  };

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-xl font-semibold text-stone-800 dark:text-stone-100 mb-8 tracking-tight">Settings</h1>
      <div className="grid grid-cols-2 gap-4">

      {/* Plan */}
      <PlanSection onUpgrade={onUpgrade} />

      {/* Privacy */}
      <Section title="Privacy" icon={ShieldCheck}>
        <div className="flex items-start gap-3 bg-forest-50 dark:bg-forest-900/30 border border-forest-200 dark:border-forest-800 rounded-xl p-3">
          <ShieldCheck size={18} className="text-forest-600 dark:text-forest-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-forest-800 dark:text-forest-300 font-medium">100% on-device processing</p>
            <p className="text-xs text-forest-600 dark:text-forest-500 mt-0.5">
              Your camera feed is processed locally using WebAssembly. No video frames, images, or personal data are ever sent to any server.
            </p>
          </div>
        </div>
      </Section>

      {/* Detection */}
      <Section title="Detection" icon={Sliders}>
        <Row label="Sensitivity" description="How close hand must be to trigger alert">
          <Pills
            value={detectionSensitivity}
            onChange={(v) => setSensitivity(v as DetectionSensitivity)}
            options={[
              { label: 'Low', value: 'low' },
              { label: 'Med', value: 'medium' },
              { label: 'High', value: 'high' },
            ]}
          />
        </Row>
        <Row label="Alert type">
          <Pills
            value={alertType}
            onChange={(v) => setAlertType(v as AlertType)}
            options={[
              { label: 'Sound', value: 'sound' },
              { label: 'Flash', value: 'flash' },
              { label: 'Both', value: 'both' },
            ]}
          />
        </Row>
      </Section>

      {/* Alert sound — full width */}
      <Section title="Alert sound" icon={Volume2} fullWidth>
        <p className="text-xs text-stone-400 dark:text-stone-500 -mt-1">Choose the sound played when nail-biting is detected. Click Preview to hear each option.</p>
        <SoundPicker value={alertSound} onChange={(s) => setAlertSound(s as AlertSound)} />
      </Section>

      {/* Reminders */}
      <Section title="Periodic reminders" icon={Bell}>
        <Row label="Enable reminders" description="Get notified to check your hands">
          <Toggle value={remindersEnabled} onChange={handleReminderToggle} />
        </Row>
        {notifStatus && (
          <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-3 py-2">
            {notifStatus}
          </p>
        )}
        {remindersEnabled && (
          <Row label="Interval">
            <Pills
              value={String(reminderIntervalMinutes) as any}
              onChange={(v) => setReminderInterval(Number(v) as ReminderInterval)}
              options={[
                { label: '5m', value: '5' },
                { label: '10m', value: '10' },
                { label: '15m', value: '15' },
                { label: '30m', value: '30' },
                { label: '60m', value: '60' },
              ]}
            />
          </Row>
        )}
      </Section>

      {/* Danger zone */}
      <Section title="Data" icon={Trash2}>
        {showConfirm ? (
          <div className="space-y-3">
            <p className="text-sm text-alert-600 dark:text-alert-400">This will erase your entire history, reset your streak, and cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => { clearAllData(); setShowConfirm(false); }}
                className="flex-1 bg-alert-600 hover:bg-alert-800 rounded-xl py-2 text-sm text-cream-100 transition-colors"
              >
                Yes, clear everything
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-stone-100 dark:bg-ink-300 hover:bg-stone-200 dark:hover:bg-ink-200 border border-stone-200 dark:border-ink-400 rounded-xl py-2 text-sm text-stone-600 dark:text-stone-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full flex items-center justify-center gap-2 text-alert-600 dark:text-alert-400 hover:text-alert-800 dark:hover:text-alert-100 bg-alert-100 dark:bg-alert-900/20 hover:bg-alert-100 dark:hover:bg-alert-900/30 border border-alert-400 dark:border-alert-800 rounded-xl py-2.5 text-sm transition-colors"
          >
            <Trash2 size={14} />
            Clear all data
          </button>
        )}
      </Section>

      </div>
    </div>
  );
}
