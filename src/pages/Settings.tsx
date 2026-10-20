import { useEffect, useState, useRef } from 'react';
import { Bell, BellRing, Bird, Music, Vibrate, Sun, ShieldCheck, Sliders, Trash2, Volume2, VolumeX, ExternalLink, Zap, RefreshCw, Tag, Plus, X, type LucideIcon } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { requestNotificationPermission } from '../hooks/useNotifications';
import { useAuth, apiFetch } from '../contexts/AuthContext';
import type { CustomTag, DetectionSensitivity, AlertType, AlertSound, ReminderInterval, Theme } from '../types';
import { PageTitle } from '../components/ui/PageTitle';
import { Rings } from '../components/site/Rings';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { trialLeft } from '../utils/trial';
import { radioGroupKeyDown, radioTabIndex } from '../components/ui/radioKeys';

function Section({ title, icon: Icon, children, fullWidth, danger }: {
  title: string;
  icon: typeof Bell;
  children: React.ReactNode;
  fullWidth?: boolean;
  danger?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border bg-white p-5 sm:p-6 dark:bg-ink-50 ${
        danger ? 'border-alert-400 dark:border-alert-800' : 'border-stone-200 dark:border-ink-400'
      } ${fullWidth ? 'md:col-span-2' : ''}`}
    >
      <div className="mb-5 flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
            danger ? 'bg-alert-100 text-alert-600 dark:bg-alert-900/30 dark:text-alert-400' : 'bg-stone-100 text-stone-700 dark:bg-ink-fill dark:text-stone-200'
          }`}
        >
          <Icon size={16} />
        </span>
        <h2 className="font-display text-xl font-bold tracking-[-0.02em] text-stone-900 dark:text-stone-100">{title}</h2>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Row({ label, description, children }: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-stone-900 dark:text-stone-100">{label}</p>
        {description && <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-300">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  // The button is the 44px target; the pill inside is the visible track.
  return (
    <button
      type="button"
      aria-label={label}
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="group flex h-11 w-16 flex-shrink-0 items-center justify-center rounded-full"
    >
      <span className={`relative h-8 w-14 rounded-full transition-colors duration-200 ${value ? 'bg-deep dark:bg-lime-300' : 'bg-stone-300 dark:bg-ink-400'}`}>
        <span className={`absolute left-1 top-1 h-6 w-6 rounded-full transition-transform duration-200 ${value ? 'translate-x-6 bg-lime-300 dark:bg-deep' : 'translate-x-0 bg-white dark:bg-stone-300'}`} />
      </span>
    </button>
  );
}


// --------------------------------------------------------------------------
// Web Audio preview — fires a one-shot preview of a sound
// --------------------------------------------------------------------------
function previewSound(sound: AlertSound, volume: number) {
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
        gain.gain.setValueAtTime(0.5 * volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
        break;
      case 'chime':
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.4 * volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 1.2);
        break;
      case 'buzz':
        osc.type = 'sawtooth';
        osc.frequency.value = 120;
        gain.gain.setValueAtTime(0.35 * volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.18);
        break;
      case 'chirp':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.45 * volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
        break;
      case 'whistle':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.4 * volume, ctx.currentTime);
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
  icon: LucideIcon;
}[] = [
  { value: 'alarm',   label: 'Beeps',   description: 'Rapid alternating beeps', icon: BellRing },
  { value: 'chime',   label: 'Chime',   description: 'Soft decaying bell',      icon: Bell },
  { value: 'buzz',    label: 'Buzz',    description: 'Low harsh rumble',        icon: Vibrate },
  { value: 'chirp',   label: 'Chirp',   description: 'Ascending sweep tone',    icon: Bird },
  { value: 'whistle', label: 'Whistle', description: 'Descending pure tone',    icon: Music },
];

function SoundPicker({ value, onChange, volume }: { value: AlertSound; onChange: (s: AlertSound) => void; volume: number }) {
  const [previewing, setPreviewing] = useState<AlertSound | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handlePreview(sound: AlertSound) {
    previewSound(sound, volume);
    setPreviewing(sound);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPreviewing(null), 700);
  }

  // Each card is two sibling controls: the card body picks the sound, the
  // Preview button under it plays it. A button nested in a button is invalid
  // HTML and screen readers announced the pair as one control.
  return (
    <div
      role="radiogroup"
      aria-label="Alarm sound"
      onKeyDown={e => { if ((e.target as HTMLElement).getAttribute('role') === 'radio') radioGroupKeyDown(e, SOUND_OPTIONS.map(o => o.value), value, onChange); }}
      className="grid grid-cols-2 gap-2 sm:grid-cols-5"
    >
      {SOUND_OPTIONS.map(opt => {
        const isSelected = value === opt.value;
        const isPreviewing = previewing === opt.value;
        const Icon = opt.icon;
        return (
          <div
            key={opt.value}
            className={`flex flex-col items-center rounded-2xl border text-center transition-colors duration-150 last:col-span-2 sm:last:col-span-1 ${
              isSelected
                ? 'bg-deep border-deep dark:bg-deep-2 dark:border-lime-300'
                : 'bg-stone-50 dark:bg-ink-100 border-stone-200 dark:border-ink-400 hover:border-stone-400 dark:hover:border-ink-300'
            }`}
          >
            <button
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={radioTabIndex(isSelected)}
              onClick={() => onChange(opt.value)}
              className="flex w-full flex-col items-center gap-2 rounded-2xl px-3 pt-4 pb-2"
            >
              <Icon
                size={22}
                aria-hidden="true"
                className={isSelected ? 'text-white dark:text-lime-300' : 'text-stone-600 dark:text-stone-300'}
              />
              <span className="space-y-0.5">
                <span className={`block font-display text-base font-bold ${isSelected ? 'text-white' : 'text-stone-800 dark:text-stone-200'}`}>
                  {opt.label}
                </span>
                <span className={`block text-xs leading-snug ${isSelected ? 'text-white/80' : 'text-stone-600 dark:text-stone-300'}`}>{opt.description}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => handlePreview(opt.value)}
              aria-label={`Preview ${opt.label}`}
              className={`mb-3 flex min-h-11 items-center gap-1 rounded-full px-4 text-xs font-semibold transition-colors duration-150 ${
                isPreviewing
                  ? 'bg-brand text-white'
                  : isSelected
                    ? 'bg-white text-deep hover:bg-lime-100'
                    : 'bg-stone-200 dark:bg-ink-fill text-stone-700 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-ink-400'
              }`}
            >
              <Volume2 size={11} aria-hidden="true" />
              {isPreviewing ? 'Playing' : 'Preview'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// --------------------------------------------------------------------------
// Volume slider — controls alarm loudness, previews at the current sound
// --------------------------------------------------------------------------
function VolumeSlider({ value, onChange, sound }: { value: number; onChange: (v: number) => void; sound: AlertSound }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value) / 100;
    onChange(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => previewSound(sound, v), 120);
  }

  return (
    <div className="flex items-center gap-3">
      {value === 0 ? (
        <VolumeX size={15} className="text-stone-500 dark:text-stone-400 flex-shrink-0" />
      ) : (
        <Volume2 size={15} className="text-stone-500 dark:text-stone-400 flex-shrink-0" />
      )}
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        onChange={handleChange}
        aria-label="Alarm volume"
        className="h-11 flex-1 accent-forest-500 dark:accent-lime-300"
      />
      <span className="text-xs tabular-nums text-stone-500 dark:text-stone-400 w-9 text-right">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

// --------------------------------------------------------------------------
// Custom bite reasons — user-defined tags shown alongside the built-in presets
// --------------------------------------------------------------------------
function ReasonsSection() {
  const { customTags, addCustomTag, removeCustomTag, restoreCustomTag } = useAppStore();
  const [label, setLabel] = useState('');
  const [emoji, setEmoji] = useState('');
  // Removing a reason was a 24px tap with no way back; the last removal can be
  // undone for a few seconds, same id and place, so tagged bites keep it.
  const [removed, setRemoved] = useState<{ tag: CustomTag; index: number } | null>(null);
  const removedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (removedTimer.current) clearTimeout(removedTimer.current); }, []);
  const remove = (tag: CustomTag) => {
    const index = customTags.findIndex(t => t.id === tag.id);
    removeCustomTag(tag.id);
    setRemoved({ tag, index });
    if (removedTimer.current) clearTimeout(removedTimer.current);
    removedTimer.current = setTimeout(() => setRemoved(null), 6000);
  };
  const undoRemove = () => {
    if (removed) restoreCustomTag(removed.tag, removed.index);
    if (removedTimer.current) clearTimeout(removedTimer.current);
    setRemoved(null);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    addCustomTag(label, emoji);
    setLabel('');
    setEmoji('');
  };

  return (
    <Section title="Bite reasons" icon={Tag} fullWidth>
      <p className="-mt-2 text-sm text-stone-600 dark:text-stone-300">
        Add your own reasons to choose from when logging a bite, alongside the built-in options (stress, focus, boredom, not sure).
      </p>

      {customTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customTags.map(tag => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1.5 pl-4 pr-1 rounded-full text-sm font-medium bg-stone-100 dark:bg-ink-fill border border-stone-200 dark:border-ink-400 text-stone-700 dark:text-stone-300"
            >
              <span aria-hidden="true">{tag.emoji}</span>
              <span>{tag.label}</span>
              <button
                type="button"
                onClick={() => remove(tag)}
                aria-label={`Remove ${tag.label}`}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-stone-500 dark:text-stone-400 hover:text-alert-600 dark:hover:text-alert-400 hover:bg-stone-200 dark:hover:bg-ink-400 transition-colors"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div role="status" aria-live="polite">
        {removed && (
          <p className="flex flex-wrap items-center gap-x-3 text-sm text-stone-600 dark:text-stone-300">
            <span>Removed “{removed.tag.label}”.</span>
            <button
              type="button"
              onClick={undoRemove}
              className="inline-flex min-h-10 items-center font-semibold text-forest-700 underline underline-offset-4 hover:text-forest-600 dark:text-forest-400 dark:hover:text-forest-300"
            >
              Undo
            </button>
          </p>
        )}
      </div>

      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <input
          type="text"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="🏷️"
          maxLength={4}
          aria-label="Emoji"
          className="w-14 text-center text-lg bg-stone-50 dark:bg-ink-100 border border-stone-200 dark:border-ink-400 rounded-full min-h-11 px-2 text-sm placeholder:text-stone-500 dark:placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-forest-400"
        />
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Tiredness"
          maxLength={30}
          aria-label="Reason label"
          className="flex-1 min-w-0 bg-stone-50 dark:bg-ink-100 border border-stone-200 dark:border-ink-400 rounded-full min-h-11 px-4 text-sm text-stone-700 dark:text-stone-300 placeholder:text-stone-500 dark:placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-forest-400"
        />
        <button
          type="submit"
          disabled={!label.trim()}
          className="flex-shrink-0 inline-flex min-h-11 items-center gap-1.5 bg-deep hover:bg-forest-500 dark:bg-lime-300 dark:hover:bg-lime-200 disabled:bg-stone-200 disabled:text-stone-500 disabled:hover:bg-stone-200 dark:disabled:bg-ink-400 dark:disabled:text-stone-400 dark:disabled:hover:bg-ink-400 text-white dark:text-deep font-semibold rounded-full px-5 text-sm transition-colors"
        >
          <Plus size={14} aria-hidden="true" />
          Add
        </button>
      </form>
    </Section>
  );
}

// ── Plan section ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string }> = {
  trial:     { label: 'Free trial' },
  active:    { label: 'Active' },
  paused:    { label: 'Paused' },
  cancelled: { label: 'Cancelled' },
  expired:   { label: 'Expired' },
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

  const trialLeftText = trialLeft(trial_end_date);

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

  const headline = subscription_status === 'trial'
    ? (trialLeftText ?? 'Trial ended')
    : subscription_status === 'active' || subscription_status === 'paused'
      ? (subscription_plan === 'yearly' ? 'Yearly' : subscription_plan === 'monthly' ? 'Monthly' : badge.label)
      : badge.label;
  const detail = subscription_status === 'trial' && trial_end_date
    ? (trialLeftText ? `In your free trial, ends ${fmt(trial_end_date)}` : 'Your free trial has ended')
    : subscription_status === 'active' && subscription_end_date
      ? `Renews ${fmt(subscription_end_date)}`
      : (subscription_status === 'paused' || subscription_status === 'cancelled') && subscription_end_date
        ? `Access until ${fmt(subscription_end_date)}`
        : '';

  // The plan plate, like the landing page's: deep forest, the status in big
  // Bricolage type. The one lime action (Choose a plan) sits at the bottom, so
  // the bitten top-right corner stays empty.
  return (
    <section className="bite sg-dark relative overflow-hidden rounded-2xl border border-transparent bg-deep p-6 text-white sm:p-8 md:col-span-2 dark:border-ink-400">
      <Rings className="-bottom-28 right-0 h-80 w-80 sm:h-[26rem] sm:w-[26rem]" />
      <div className="relative">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl font-bold tracking-[-0.02em]">Plan</h2>
          <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
            {badge.label}
          </span>
        </div>
        <p className="mt-4 font-display text-5xl font-extrabold leading-none tracking-[-0.045em] sm:text-6xl">{headline}</p>
        {detail && <p className="mt-3 text-base text-white/80">{detail}</p>}

        {(accessStatus === 'trial_active' && onUpgrade) || canManage ? (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {accessStatus === 'trial_active' && onUpgrade && (
              <button
                onClick={onUpgrade}
                type="button"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-lime-300 px-6 font-display text-base font-bold text-deep transition-colors hover:bg-lime-200"
              >
                <Zap size={15} aria-hidden="true" />
                Choose a plan
              </button>
            )}
            {canManage && (
              <button
                onClick={openPortal}
                disabled={portalLoading}
                type="button"
                className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/40 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                {portalLoading ? <RefreshCw size={13} className="animate-spin" aria-hidden="true" /> : <ExternalLink size={13} aria-hidden="true" />}
                {portalLoading ? 'Opening…' : 'Manage subscription'}
              </button>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function Settings({ onUpgrade }: { onUpgrade?: () => void }) {
  const {
    detectionSensitivity, setSensitivity,
    theme, setTheme,
    alertType, setAlertType,
    alertSound, setAlertSound,
    alertVolume, setAlertVolume,
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
        setNotifStatus("Notifications are blocked. Allow them in your browser's site settings, then turn this on again.");
        return;
      }
    }
    setNotifStatus('');
    setRemindersEnabled(val);
  };

  return (
    <div className="p-5 sm:p-8 pb-10 max-w-5xl">
      <PageTitle mark="Settings" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

      {/* Plan */}
      <PlanSection onUpgrade={onUpgrade} />

      {/* Ordered by how often people change things: detection and reminders
          first, the information-only Privacy card near the end beside
          Appearance, Data last. Two-column pairs stay balanced. */}
      {/* Detection */}
      <Section title="Detection and alarm" icon={Sliders}>
        <Row label="Sensitivity" description="How close your hand must get before the alarm sounds">
          <SegmentedControl
            ariaLabel="Sensitivity"
            value={detectionSensitivity}
            onChange={(v) => setSensitivity(v as DetectionSensitivity)}
            options={[
              { label: 'Low', value: 'low' },
              { label: 'Med', value: 'medium' },
              { label: 'High', value: 'high' },
            ]}
          />
        </Row>
        <Row label="Alarm type">
          <SegmentedControl
            ariaLabel="Alarm type"
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

      {/* Reminders */}
      <Section title="Periodic reminders" icon={Bell}>
        <Row label="Enable reminders" description="A check-in on your hands while detection is off">
          <Toggle label="Enable reminders" value={remindersEnabled} onChange={handleReminderToggle} />
        </Row>
        {notifStatus && (
          <p className="text-sm text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl px-4 py-3">
            {notifStatus}
          </p>
        )}
        {remindersEnabled && (
          <Row label="Interval">
            <SegmentedControl<string>
              ariaLabel="Reminder interval"
              value={String(reminderIntervalMinutes)}
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

      {/* Alarm sound, full width */}
      <Section title="Alarm sound" icon={Volume2} fullWidth>
        <p className="-mt-2 text-sm text-stone-600 dark:text-stone-300">The sound the alarm makes when your hand reaches your mouth. Press Preview to hear each one.</p>
        <SoundPicker value={alertSound} onChange={(s) => setAlertSound(s as AlertSound)} volume={alertVolume} />
        <Row label="Volume" description="How loud the alarm plays">
          <div className="w-full sm:w-56">
            <VolumeSlider value={alertVolume} onChange={setAlertVolume} sound={alertSound} />
          </div>
        </Row>
      </Section>

      {/* Bite reasons — full width */}
      <ReasonsSection />

      {/* Appearance: the one place to set the theme, on every screen size. */}
      <Section title="Appearance" icon={Sun}>
        <Row label="Theme" description="Light, dark, or follow your system">
          <SegmentedControl
            ariaLabel="Theme"
            value={theme}
            onChange={(v) => setTheme(v as Theme)}
            options={[
              { label: 'Light', value: 'light' },
              { label: 'System', value: 'system' },
              { label: 'Dark', value: 'dark' },
            ]}
          />
        </Row>
      </Section>

      {/* Privacy */}
      <Section title="Privacy" icon={ShieldCheck}>
        <div className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 dark:border-ink-400 dark:bg-ink-100">
          <ShieldCheck size={18} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-brand dark:text-lime-300" />
          <div>
            <p className="text-[15px] font-semibold text-stone-900 dark:text-stone-100">Detection runs on your computer</p>
            <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-300">
              Your camera is processed in this browser. No camera data is sent while it runs; your alarm and bite log stays in this browser too.
            </p>
          </div>
        </div>
      </Section>

      {/* Danger zone */}
      <Section title="Data" icon={Trash2} fullWidth danger>
        {showConfirm ? (
          <div className="space-y-3">
            <p className="text-sm text-alert-600 dark:text-alert-400">This erases your history, streak, bite reasons and every setting on this device. It can't be undone.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { clearAllData(); setShowConfirm(false); }}
                className="min-h-11 px-6 font-semibold bg-alert-600 hover:bg-alert-800 rounded-full text-sm text-cream-100 transition-colors"
              >
                Yes, clear everything
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => setShowConfirm(false)}
                className="min-h-11 px-6 font-semibold border border-stone-300 dark:border-ink-400 hover:bg-stone-100 dark:hover:bg-ink-fill rounded-full text-sm text-stone-700 dark:text-stone-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-2 px-6 font-semibold text-alert-600 dark:text-alert-400 hover:text-alert-800 dark:hover:text-alert-100 bg-alert-100 dark:bg-alert-900/20 hover:bg-alert-100 dark:hover:bg-alert-900/30 border border-alert-400 dark:border-alert-800 rounded-full text-sm transition-colors"
          >
            <Trash2 size={14} aria-hidden="true" />
            Clear all data
          </button>
        )}
      </Section>

      </div>
    </div>
  );
}
