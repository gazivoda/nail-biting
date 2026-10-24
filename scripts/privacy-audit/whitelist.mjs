// WS4's event whitelist, read from the code that enforces it (never retyped here), so the audit fails if
// either side drifts: the server's validator (server/events/validate.js) and the client's payload builder
// (src/sync/payload.ts) must list exactly the same keys, and the audit holds every observed request to them.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const list = (src, name) => {
  const m = new RegExp(`${name}\\b[^=]*=\\s*(?:new Set\\()?\\[([\\s\\S]*?)\\]`).exec(src);
  if (!m) throw new Error(`could not find ${name}`);
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
};

/** @param {string} root the repository (or build) root to read the whitelist from */
export async function loadWhitelist(root) {
  const validatePath = join(root, 'server/events/validate.js');
  const { TOP_KEYS, EVENT_KEYS } = await import(pathToFileURL(validatePath).href);
  const validateSrc = readFileSync(validatePath, 'utf8');
  const response = list(validateSrc, 'RESPONSE_KEYS');
  const clientSrc = readFileSync(join(root, 'src/sync/payload.ts'), 'utf8');
  const clientEvent = list(clientSrc, 'SYNC_EVENT_FIELDS');
  const sorted = a => [...a].sort();
  const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
  return {
    top: new Set(TOP_KEYS),
    event: new Set(EVENT_KEYS),
    response: new Set(response),
    clientEvent: new Set(clientEvent),
    // client list === server list, exactly
    parity: same(EVENT_KEYS, clientEvent),
  };
}
