import { useState } from 'react';
import { Bell, ShieldCheck, Sliders, Trash2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { requestNotificationPermission } from '../hooks/useNotifications';
import type { DetectionSensitivity, AlertType, ReminderInterval } from '../types';

function Section({ title, icon: Icon, children }: {
  title: string;
  icon: typeof Bell;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100">
        <Icon size={15} className="text-stone-400" />
        <p className="text-sm font-medium text-stone-700">{title}</p>
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
        <p className="text-sm text-stone-800">{label}</p>
        {description && <p className="text-xs text-stone-400 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors ${value ? 'bg-forest-500' : 'bg-stone-200'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow ${value ? 'translate-x-6' : 'translate-x-0'}`} />
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
          className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
            value === opt.value
              ? 'bg-forest-600 text-white'
              : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function Settings() {
  const {
    detectionSensitivity, setSensitivity,
    alertType, setAlertType,
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
      <h1 className="text-xl font-semibold text-stone-800 mb-8">Settings</h1>
      <div className="grid grid-cols-2 gap-4">
      {/* Privacy */}
      <Section title="Privacy" icon={ShieldCheck}>
        <div className="flex items-start gap-3 bg-forest-50 border border-forest-200 rounded-xl p-3">
          <ShieldCheck size={18} className="text-forest-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-forest-800 font-medium">100% on-device processing</p>
            <p className="text-xs text-forest-600 mt-0.5">
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

      {/* Reminders */}
      <Section title="Periodic reminders" icon={Bell}>
        <Row label="Enable reminders" description="Get notified to check your hands">
          <Toggle value={remindersEnabled} onChange={handleReminderToggle} />
        </Row>
        {notifStatus && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
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
            <p className="text-sm text-red-700">This will erase your entire history, reset your streak, and cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => { clearAllData(); setShowConfirm(false); }}
                className="flex-1 bg-red-600 hover:bg-red-700 rounded-xl py-2 text-sm text-white transition-colors"
              >
                Yes, clear everything
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-xl py-2 text-sm text-stone-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="w-full flex items-center justify-center gap-2 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl py-2.5 text-sm transition-colors"
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
