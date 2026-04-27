# App Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Stop Biting app UI to match the provided design mockup — light cream background, Instrument Serif display headers, mono streak ticker, split dashboard layout, and polished sidebar.

**Architecture:** Each screen gets a `PageHeader` with serif heading + eyebrow label. The Dashboard becomes a `grid-cols-[1.35fr_1fr]` split with StreakHero + CameraPanel on the left and TodayStats + SessionGoal + ReplacementPrompt on the right. Settings replaces `Pills` with a `SegmentedControl` component.

**Tech Stack:** React, TypeScript, Tailwind CSS (OKLCH colors), Lucide icons, Recharts

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `index.html` | Modify | Add Inter + JetBrains Mono Google Fonts |
| `tailwind.config.js` | Modify | Add `paper`/`cream2` colors, switch UI font to Inter, add `mono` font family |
| `src/components/layout/TabBar.tsx` | Modify | Shield logo icon, "Navigate" overline, updated active-item style |
| `src/components/layout/PageHeader.tsx` | Create | Shared eyebrow + serif h1 + optional right slot |
| `src/App.tsx` | Modify | Update page bg to cream-200 |
| `src/pages/Dashboard.tsx` | Modify | New 1.35:1 grid, integrate new sub-components |
| `src/components/dashboard/StreakHero.tsx` | Create | Mono ticker with D/H/M segments, replaces StreakCard |
| `src/components/dashboard/CameraPanel.tsx` | Create | Unified CameraToggle + CameraView wrapper card |
| `src/components/dashboard/TodayStats.tsx` | Create | Single card with 2-column stat grid |
| `src/components/dashboard/SessionGoal.tsx` | Create | 25-min session timer with progress bar |
| `src/components/dashboard/ReplacementPrompt.tsx` | Create | Habit-replacement card shown on alert |
| `src/components/dashboard/StreakCard.tsx` | Keep | Unchanged (still used as fallback / mobile) |
| `src/pages/Log.tsx` | Modify | Add PageHeader |
| `src/pages/Settings.tsx` | Modify | Add PageHeader, replace Pills with SegmentedControl |
| `src/components/ui/SegmentedControl.tsx` | Create | Segmented-pill control, replaces Pills in Settings |

---

## Task 1: Fonts & Tailwind Tokens

**Files:**
- Modify: `index.html`
- Modify: `tailwind.config.js`

- [ ] **Step 1: Add Inter + JetBrains Mono to index.html**

In `index.html`, replace the existing Google Fonts `<link>` tags (or add after existing ones) with:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

Find the existing font link in `index.html` (search for `googleapis`) and replace it with the above. If none exists, add before `</head>`.

- [ ] **Step 2: Update tailwind.config.js**

Replace the `fontFamily` block in `tailwind.config.js` with:

```js
fontFamily: {
  sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
  display: ['"Instrument Serif"', 'Georgia', 'serif'],
  mono: ['"JetBrains Mono"', '"SF Mono"', 'ui-monospace', 'monospace'],
},
```

Also extend the `colors` block to add `paper` and `cream2`:

```js
// Inside colors → extend:
paper: 'oklch(99% 0.005 80)',
cream2: 'oklch(95% 0.013 80)',
```

Add this inside the existing `colors: { ... }` object in `theme.extend`.

- [ ] **Step 3: Commit**

```bash
git add index.html tailwind.config.js
git commit -m "feat: switch to Inter/JetBrains Mono fonts, add paper/cream2 tokens"
```

---

## Task 2: Sidebar Visual Polish

**Files:**
- Modify: `src/components/layout/TabBar.tsx`

The sidebar is already 216px (w-56). These are styling tweaks only — no structural change.

- [ ] **Step 1: Replace logo `<img>` with inline SVG shield icon**

In `TabBar.tsx`, find the brand section (around line 42–48) and replace:

```tsx
<div className="px-5 py-5 border-b border-stone-200 dark:border-ink-400">
  <div className="flex items-center gap-2.5">
    <img src="/logo.svg" alt="Stop Biting logo" className="w-8 h-8 flex-shrink-0" />
    <p className="text-sm font-semibold tracking-tight text-stone-800 dark:text-stone-100">Stop Biting</p>
  </div>
  <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5 tracking-wide">AI nail biting detector</p>
</div>
```

With:

```tsx
<div className="px-5 py-5 border-b border-stone-200 dark:border-ink-400">
  <div className="flex items-center gap-2.5">
    <div className="w-[26px] h-[26px] rounded-lg bg-forest-500 flex items-center justify-center flex-shrink-0">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 1.5l5 1.5v5c0 3-2.5 5.5-5 6.5-2.5-1-5-3.5-5-6.5v-5l5-1.5z" />
      </svg>
    </div>
    <div>
      <p className="text-[13.5px] font-semibold tracking-[-0.1px] text-stone-800 dark:text-stone-100">Stop Biting</p>
      <p className="text-[10.5px] text-stone-400 dark:text-stone-500 mt-[1px] tracking-[0.2px]">on-device · v2</p>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Add "Navigate" overline above nav items**

Inside the `<nav>` element, add before the `{tabs.map(...)}`:

```tsx
<p className="text-[10px] font-semibold tracking-[1.2px] uppercase text-stone-400 dark:text-stone-500 mb-2 px-1">Navigate</p>
```

- [ ] **Step 3: Update active nav item styling**

Replace the `isActive` className branch in the `tabs.map` button:

```tsx
className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-150 text-left overflow-hidden ${
  isActive
    ? 'bg-white dark:bg-ink-50 text-forest-700 dark:text-forest-300 font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)] border border-stone-200 dark:border-ink-400'
    : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100/70 dark:hover:bg-ink-50/60'
}`}
```

Remove the active left-bar indicator span (lines 65-70 in original) — it's no longer needed with the new styling.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/TabBar.tsx
git commit -m "feat: redesign sidebar — shield logo, Navigate overline, white active item"
```

---

## Task 3: PageHeader Component + App Background

**Files:**
- Create: `src/components/layout/PageHeader.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create PageHeader component**

Create `src/components/layout/PageHeader.tsx`:

```tsx
interface Props {
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, right }: Props) {
  return (
    <header className="flex items-end justify-between gap-6 mb-7">
      <div>
        <p className="text-[10px] font-semibold tracking-[1.2px] uppercase text-stone-400 dark:text-stone-500">
          {eyebrow}
        </p>
        <h1
          className="mt-2 font-display text-[32px] font-normal leading-[1.1] tracking-[-0.6px] text-stone-800 dark:text-stone-100"
        >
          {title}
        </h1>
      </div>
      {right && <div className="flex items-center gap-2 pb-1">{right}</div>}
    </header>
  );
}
```

- [ ] **Step 2: Update App.tsx background color**

In `src/App.tsx`, change the outer wrapper className:

```tsx
// Before:
<div className="flex bg-cream-100 dark:bg-ink-100 text-stone-800 dark:text-stone-200 min-h-dvh">

// After:
<div className="flex bg-cream-200 dark:bg-ink-100 text-stone-800 dark:text-stone-200 min-h-dvh">
```

Also update the loading state bg:
```tsx
// Before:
<div className="flex items-center justify-center min-h-dvh bg-cream-100 dark:bg-ink-100">
// After:
<div className="flex items-center justify-center min-h-dvh bg-cream-200 dark:bg-ink-100">
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/PageHeader.tsx src/App.tsx
git commit -m "feat: add PageHeader component with serif display title + update app bg"
```

---

## Task 4: StreakHero — Mono Ticker

**Files:**
- Create: `src/components/dashboard/StreakHero.tsx`
- Modify: `src/hooks/useStreak.ts`

The design shows each time segment as a large number (56px, JetBrains Mono, forest-700) with a label below (10.5px, stone-400, uppercase). Segments shown: days, hours, minutes (only show days if > 0; always show H and M).

- [ ] **Step 1: Update useStreak to tick every second**

In `src/hooks/useStreak.ts`, change the interval from `60_000` to `1_000`:

```ts
const id = setInterval(() => setTick(t => t + 1), 1_000);
```

Also add raw segment values to the return:

```ts
const totalSeconds = Math.floor(currentStreakMs / 1000);
const streakSeconds = totalSeconds % 60;
const streakMinutes = Math.floor(totalSeconds / 60) % 60;
const streakHours = Math.floor(totalSeconds / 3600) % 24;
const streakDays = Math.floor(totalSeconds / 86400);

return {
  currentStreakMs,
  bestStreakMs,
  formattedCurrent: formatDuration(currentStreakMs),
  formattedBest: formatDuration(bestStreakMs),
  isGood: currentStreakMs > 60 * 60 * 1000,
  isGreat: currentStreakMs > 24 * 60 * 60 * 1000,
  streakDays,
  streakHours,
  streakMinutes,
  streakSeconds,
};
```

- [ ] **Step 2: Create StreakHero component**

Create `src/components/dashboard/StreakHero.tsx`:

```tsx
import { Trophy } from 'lucide-react';
import { useStreak } from '../../hooks/useStreak';

function Segment({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center min-w-[64px]">
      <span className="font-mono text-[56px] font-medium leading-none tracking-[-2px] tabular-nums text-forest-700 dark:text-forest-300">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[10.5px] font-medium tracking-[1.5px] uppercase text-stone-400 dark:text-stone-500 mt-1.5">
        {label}
      </span>
    </div>
  );
}

function Colon() {
  return (
    <span className="font-mono text-[40px] font-light text-stone-300 dark:text-stone-600 leading-none self-start mt-1 select-none">
      :
    </span>
  );
}

export function StreakHero() {
  const { streakDays, streakHours, streakMinutes, formattedBest, isGreat } = useStreak();

  const ringClass = isGreat
    ? 'ring-2 ring-forest-400/40 dark:ring-forest-500/30 shadow-[0_0_24px_oklch(58%_0.130_148/0.15)]'
    : '';

  return (
    <div
      className={`bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-[18px] p-9 shadow-card dark:shadow-card-dark transition-shadow duration-700 ${ringClass}`}
      data-tour="streak-card"
    >
      {/* Overline */}
      <div className="flex items-center gap-2 mb-6">
        <span className="w-2 h-2 rounded-full bg-forest-500 animate-pulse" />
        <p className="text-[10px] font-semibold tracking-[1.2px] uppercase text-stone-400 dark:text-stone-500">
          Current streak
        </p>
      </div>

      {/* Mono ticker */}
      <div className="flex items-start gap-4">
        {streakDays > 0 && (
          <>
            <Segment value={streakDays} label="days" />
            <Colon />
          </>
        )}
        <Segment value={streakHours} label="hrs" />
        <Colon />
        <Segment value={streakMinutes} label="min" />
      </div>

      {/* Best streak */}
      <div className="mt-6 pt-5 border-t border-stone-100 dark:border-ink-400 flex items-center gap-2 text-stone-500 dark:text-stone-400 text-sm">
        <Trophy size={14} className="text-amber-400" />
        <span>Best: <span className="text-amber-500 font-semibold">{formattedBest || '—'}</span></span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/StreakHero.tsx src/hooks/useStreak.ts
git commit -m "feat: StreakHero with 56px mono D:H:M ticker, second-level updates"
```

---

## Task 5: CameraPanel — Unified Camera Card

**Files:**
- Create: `src/components/dashboard/CameraPanel.tsx`

Wraps CameraToggle + CameraView in a single card so they read as one unit. When camera is off, shows a light stone background. When camera is on, the existing dark CameraView fills it naturally.

- [ ] **Step 1: Create CameraPanel**

Create `src/components/dashboard/CameraPanel.tsx`:

```tsx
import { useAppStore } from '../../store/useAppStore';
import { CameraToggle } from './CameraToggle';
import { CameraView } from '../detection/CameraView';
import { useCamera } from '../../hooks/useCamera';

export function CameraPanel() {
  const { cameraEnabled } = useAppStore();
  const { videoRef } = useCamera(cameraEnabled);

  return (
    <div className="bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-[18px] overflow-hidden shadow-card dark:shadow-card-dark">
      {/* Toggle header */}
      <div className="p-4 border-b border-stone-100 dark:border-ink-400">
        <CameraToggle />
      </div>

      {/* Camera feed — only visible when enabled */}
      {cameraEnabled && (
        <div className="p-0">
          <CameraView videoRef={videoRef} />
        </div>
      )}

      {/* Idle placeholder */}
      {!cameraEnabled && (
        <div className="flex items-center justify-center h-24 bg-stone-50 dark:bg-ink-300">
          <p className="text-xs text-stone-400 dark:text-stone-500">Camera off — start detection above</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/CameraPanel.tsx
git commit -m "feat: CameraPanel — unified toggle + feed card"
```

---

## Task 6: TodayStats, SessionGoal & ReplacementPrompt

**Files:**
- Create: `src/components/dashboard/TodayStats.tsx`
- Create: `src/components/dashboard/SessionGoal.tsx`
- Create: `src/components/dashboard/ReplacementPrompt.tsx`

### TodayStats

- [ ] **Step 1: Create TodayStats**

Create `src/components/dashboard/TodayStats.tsx`:

```tsx
import { useAppStore } from '../../store/useAppStore';

export function TodayStats() {
  const { incidents } = useAppStore();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIncidents = incidents.filter(i => i.timestamp >= today.getTime());
  const todayCount = todayIncidents.length;
  const autoCount = todayIncidents.filter(i => i.tag === 'auto-detected').length;

  return (
    <div className="bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-[18px] p-7 shadow-card dark:shadow-card-dark">
      <p className="text-[10px] font-semibold tracking-[1.2px] uppercase text-stone-400 dark:text-stone-500 mb-5">Today</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[28px] font-semibold tabular-nums tracking-tight text-alert-600 dark:text-alert-400 leading-none">
            {todayCount}
          </p>
          <p className="text-[10px] uppercase tracking-[1px] text-stone-400 dark:text-stone-500 mt-2 font-medium">
            bites logged
          </p>
        </div>
        <div>
          <p className="text-[28px] font-semibold tabular-nums tracking-tight text-stone-600 dark:text-stone-300 leading-none">
            {autoCount}
          </p>
          <p className="text-[10px] uppercase tracking-[1px] text-stone-400 dark:text-stone-500 mt-2 font-medium">
            auto-detected
          </p>
        </div>
      </div>
    </div>
  );
}
```

### SessionGoal

- [ ] **Step 2: Create SessionGoal**

Create `src/components/dashboard/SessionGoal.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';

const GOAL_MS = 25 * 60 * 1000; // 25 minutes

export function SessionGoal() {
  const { cameraEnabled } = useAppStore();
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (cameraEnabled) {
      if (!startRef.current) startRef.current = Date.now() - elapsedMs;
      const id = setInterval(() => {
        setElapsedMs(Date.now() - startRef.current!);
      }, 1000);
      return () => clearInterval(id);
    } else {
      startRef.current = null;
    }
  }, [cameraEnabled]);

  const progress = Math.min(elapsedMs / GOAL_MS, 1);
  const minutes = Math.floor(elapsedMs / 60000);
  const seconds = Math.floor((elapsedMs % 60000) / 1000);
  const goalMinutes = 25;
  const done = progress >= 1;

  return (
    <div className="bg-white dark:bg-ink-50 border border-stone-200 dark:border-ink-400 rounded-[18px] p-7 shadow-card dark:shadow-card-dark">
      <p className="text-[10px] font-semibold tracking-[1.2px] uppercase text-stone-400 dark:text-stone-500 mb-4">Session</p>

      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="font-mono text-[32px] font-medium leading-none tabular-nums text-stone-800 dark:text-stone-100 tracking-tight">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
        <span className="text-sm text-stone-400 dark:text-stone-500">/ {goalMinutes}m goal</span>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-1.5 bg-stone-100 dark:bg-ink-400 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${progress * 100}%`,
            background: done ? 'oklch(46% 0.130 148)' : 'oklch(58% 0.130 148)',
          }}
        />
      </div>

      {done && (
        <p className="text-[11px] text-forest-600 dark:text-forest-400 font-medium mt-2">
          Goal reached! 🎉
        </p>
      )}

      {!cameraEnabled && (
        <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-2">
          Start detection to begin session
        </p>
      )}
    </div>
  );
}
```

### ReplacementPrompt

- [ ] **Step 3: Create ReplacementPrompt**

Create `src/components/dashboard/ReplacementPrompt.tsx`:

```tsx
import { useState } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const SUGGESTIONS = [
  'Press thumb to each fingertip',
  'Clench and release fist · 5×',
  'Exhale slowly through your nose',
  'Sip water mindfully',
];

export function ReplacementPrompt() {
  const { incidents } = useAppStore();
  const [dismissed, setDismissed] = useState<number>(0);

  // Show when there's a recent auto-detected incident (within last 8 seconds)
  const lastAuto = [...incidents]
    .reverse()
    .find(i => i.tag === 'auto-detected');

  const shouldShow = lastAuto && (Date.now() - lastAuto.timestamp < 8000) && dismissed < lastAuto.timestamp;

  if (!shouldShow) return null;

  const suggestion = SUGGESTIONS[lastAuto.timestamp % SUGGESTIONS.length];

  return (
    <div className="bg-white dark:bg-ink-50 border border-forest-200 dark:border-forest-800 rounded-[18px] p-7 shadow-card-md dark:shadow-card-md-dark animate-fade-up">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[1.2px] uppercase text-forest-500 dark:text-forest-400">
            Interrupt detected
          </p>
          <p className="text-[15px] font-semibold text-stone-800 dark:text-stone-100 mt-1">
            Try this instead
          </p>
        </div>
        <button
          onClick={() => setDismissed(lastAuto.timestamp)}
          className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-ink-400 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <p className="text-[13px] text-stone-700 dark:text-stone-200 leading-relaxed bg-forest-50 dark:bg-forest-900/20 rounded-xl px-4 py-3 border border-forest-100 dark:border-forest-800/50">
        {suggestion}
      </p>

      <button
        onClick={() => setDismissed(lastAuto.timestamp)}
        className="mt-3 w-full py-2.5 rounded-xl text-[13px] font-medium text-forest-700 dark:text-forest-300 bg-forest-50 dark:bg-forest-900/20 hover:bg-forest-100 dark:hover:bg-forest-900/40 border border-forest-200 dark:border-forest-800 transition-colors"
      >
        Got it
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/TodayStats.tsx src/components/dashboard/SessionGoal.tsx src/components/dashboard/ReplacementPrompt.tsx
git commit -m "feat: TodayStats, SessionGoal, and ReplacementPrompt components"
```

---

## Task 7: Dashboard Page Overhaul

**Files:**
- Modify: `src/pages/Dashboard.tsx`

Wire everything together. Remove old imports, use new components, set up the 1.35:1 grid.

- [ ] **Step 1: Rewrite Dashboard.tsx**

Replace the entire contents of `src/pages/Dashboard.tsx` with:

```tsx
import { ShieldCheck } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { StreakHero } from '../components/dashboard/StreakHero';
import { CameraPanel } from '../components/dashboard/CameraPanel';
import { TodayStats } from '../components/dashboard/TodayStats';
import { SessionGoal } from '../components/dashboard/SessionGoal';
import { ReplacementPrompt } from '../components/dashboard/ReplacementPrompt';
import { PanicButton } from '../components/dashboard/PanicButton';
import { useAuth } from '../contexts/AuthContext';

export function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="p-8 pb-10">
      <PageHeader
        eyebrow="Today"
        title={`${greeting}, ${firstName}.`}
        right={
          <div className="flex items-center gap-1.5 text-forest-600 dark:text-forest-400 text-[11.5px] py-1.5 px-3 bg-forest-50 dark:bg-forest-900/30 border border-forest-200 dark:border-forest-800 rounded-full">
            <ShieldCheck size={12} />
            <span>On-device</span>
          </div>
        }
      />

      {/* Split grid: left 1.35fr, right 1fr */}
      <div className="grid gap-5 items-start" style={{ gridTemplateColumns: '1.35fr 1fr' }}>
        {/* Left column */}
        <div className="flex flex-col gap-5">
          <StreakHero />
          <CameraPanel />
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          <SessionGoal />
          <TodayStats />
          <ReplacementPrompt />
          <PanicButton />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Remove old useCamera call from Dashboard (now inside CameraPanel)**

Verify `CameraPanel` calls `useCamera` internally. The Dashboard no longer imports `useCamera`, `CameraView`, `StreakCard`, `StatsRow`, or `CameraToggle`. Check that no imports remain from those.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: Dashboard — 1.35:1 split layout with StreakHero, CameraPanel, SessionGoal, TodayStats"
```

---

## Task 8: Log Page Header

**Files:**
- Modify: `src/pages/Log.tsx`

- [ ] **Step 1: Add PageHeader to Log**

At the top of the JSX returned by the `Log` component, add:

```tsx
import { PageHeader } from '../components/layout/PageHeader';

// Inside the return, before the existing content:
<PageHeader eyebrow="Progress" title="Patterns & milestones" />
```

The existing `<p className="text-stone-700 font-semibold mb-1">Last 7 days</p>` in `WeekChart` can stay — it's inside the chart card.

Also remove the standalone outer padding div if it conflicts; the outer div in `Log.tsx` should be `<div className="p-8 pb-10">`.

- [ ] **Step 2: Commit**

```bash
git add src/pages/Log.tsx
git commit -m "feat: Log page — add Progress page header with serif title"
```

---

## Task 9: Settings — SegmentedControl + Header

**Files:**
- Create: `src/components/ui/SegmentedControl.tsx`
- Modify: `src/pages/Settings.tsx`

### SegmentedControl

- [ ] **Step 1: Create SegmentedControl**

Create `src/components/ui/SegmentedControl.tsx`:

```tsx
interface Option<T extends string> {
  label: string;
  value: T;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <div className="inline-flex items-center gap-0.5 p-[3px] bg-stone-100 dark:bg-ink-300 border border-stone-200 dark:border-ink-400 rounded-[11px]">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-[5px] text-[12px] rounded-[8px] transition-all duration-[140ms] ${
            value === opt.value
              ? 'bg-white dark:bg-ink-50 text-forest-700 dark:text-forest-300 font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
              : 'text-stone-500 dark:text-stone-400 font-medium hover:text-stone-700 dark:hover:text-stone-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add PageHeader to Settings**

In `src/pages/Settings.tsx`, at the top of the return JSX:

```tsx
import { PageHeader } from '../components/layout/PageHeader';

// Before the existing <div className="grid ...">:
<PageHeader eyebrow="Settings" title="Tune detection to your rhythm" />
```

Wrap the existing content in `<div className="p-8 pb-10">` if not already.

- [ ] **Step 3: Replace Pills with SegmentedControl in Settings**

In `src/pages/Settings.tsx`:

1. Import `SegmentedControl`:
```tsx
import { SegmentedControl } from '../components/ui/SegmentedControl';
```

2. Replace every `<Pills` usage with `<SegmentedControl`. The props are identical (`options`, `value`, `onChange`) — it's a drop-in replacement. Find all instances in the Detection section rows.

3. Keep the existing `Pills` component in the file (it may be used in the sound picker) — just don't use it for the Detection/Alert/Sound rows.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/SegmentedControl.tsx src/pages/Settings.tsx
git commit -m "feat: Settings — SegmentedControl, serif page header"
```

---

## Task 10: Final Polish & Push

- [ ] **Step 1: Verify no broken imports**

```bash
cd /Users/igorgazivoda/nail-habit-app && npx tsc --noEmit 2>&1 | head -40
```

Fix any type errors found.

- [ ] **Step 2: Verify build succeeds**

```bash
npm run build 2>&1 | tail -20
```

Fix any build errors before pushing.

- [ ] **Step 3: Final commit and push**

```bash
git add -A
git commit -m "feat: complete app redesign — serif headers, mono streak ticker, split dashboard, segmented controls"
git push
```
