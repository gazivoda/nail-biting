// DEVELOPMENT-ONLY flag overrides. This module is imported by flags.ts but only
// ever CALLED behind `import.meta.env.DEV`, which Vite replaces with `false` in a
// production build; the call, and with it this whole module, is then dropped.
// After every build, `grep -l "dev-override" dist/assets/*.js` must print
// nothing (see docs/agents/ARCHITECTURE.md, "Feature flags").
//
// Two ways to switch flags on locally without touching the server:
//
//   1. a URL parameter:   http://localhost:5173/?ff=event_sync,insights
//      Remembered across reloads. `?ff=` (empty) clears it.
//   2. the stored list:   localStorage['sb:flags:dev-override'] = '["event_sync"]'
//
// Names that are not in the registry are ignored.

import { kv } from '../storage/kv';
import { isFeatureName, type FeatureName } from './registry';

const KEY = 'dev-override';

function fromQuery(): string[] | null {
  const loc = (globalThis as { location?: { search?: string } }).location;
  if (!loc?.search) return null;
  const raw = new URLSearchParams(loc.search).get('ff');
  if (raw === null) return null;
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

/** Flags forced ON in this development session. Never turns a flag off. */
export function readDevOverrides(): Partial<Record<FeatureName, true>> {
  const query = fromQuery();
  if (query !== null) kv.set('flags', KEY, query); // remember; `?ff=` stores []
  const names = query ?? kv.get<unknown>('flags', KEY, []);
  const out: Partial<Record<FeatureName, true>> = {};
  if (!Array.isArray(names)) return out;
  for (const n of names) if (typeof n === 'string' && isFeatureName(n)) out[n] = true;
  return out;
}
