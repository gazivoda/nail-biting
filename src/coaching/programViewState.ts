// Whether the 4-week program view is open (WS2). A tiny external store so the
// Dashboard's discreet entry and the coaching settings can open it, and the one
// ProgramHost mounted in App.tsx can show it.
//
// Why a view and not a URL: server.js answers any path it does not know with the
// branded 404 (KNOWN_ROUTES), and a flagged page would also have to 404 while
// its flag is off. Both need server.js changes this workstream may not make, and
// a path would be a new indexable surface for a feature that is off. An in-app
// view needs none of that, works offline, and cannot be reached with the flag off.
//
// The browser Back button closes it: opening pushes one history entry (same
// URL), and a popstate that lands on an entry without the marker closes it.

type Listener = () => void;

const MARK = 'sbProgram';
let open = false;
const listeners = new Set<Listener>();

const emit = () => listeners.forEach(fn => { try { fn(); } catch { /* ignore */ } });
const hasHistory = () => typeof window !== 'undefined' && typeof window.history?.pushState === 'function';
const marked = () => hasHistory() && (window.history.state as Record<string, unknown> | null)?.[MARK] === true;

export function isProgramOpen(): boolean { return open; }

export function subscribeProgramView(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function openProgram(): void {
  if (open) return;
  open = true;
  if (hasHistory()) {
    try { window.history.pushState({ ...(window.history.state ?? {}), [MARK]: true }, ''); } catch { /* the view still works without it */ }
  }
  emit();
}

export function closeProgram(): void {
  if (!open) return;
  if (marked()) {
    // Going back lands on the entry we came from; the popstate handler closes the view.
    window.history.back();
    return;
  }
  open = false;
  emit();
}

/** Installed once by ProgramHost: the Back button closes the view. Returns the cleanup. */
export function installProgramPopstate(): () => void {
  if (typeof window === 'undefined') return () => {};
  const onPop = () => {
    if (open && !marked()) { open = false; emit(); }
  };
  window.addEventListener('popstate', onPop);
  return () => window.removeEventListener('popstate', onPop);
}

/** For tests. */
export function resetProgramViewForTests(): void {
  open = false;
  listeners.clear();
}
