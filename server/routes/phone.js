// WS6 phone companion: the web app manifest while `phone_companion` is on.
//
// Why the manifest is served here instead of being one static file for everybody:
// the two Android long-press shortcuts ("I bit", "I feel an urge") are a visible
// change to every installed copy of the app, and the rule is that nothing is
// visible while the flag is off. So the build still writes dist/manifest.webmanifest
// exactly as before, and this route answers for it only while the flag is on,
// sending that same file plus `shortcuts`. With the flag off the route calls
// next() and express.static serves the unchanged file, byte for byte.
//
// Nothing else is a phone-specific URL: the phone view is the app's own `/`, chosen
// by the device (src/phone/phoneDecision.ts), so the manifest's start_url, scope
// and icons stay as they are and there is no page to 404 while the flag is off.
//
// The service worker does not precache the manifest (vite.config.ts,
// manifestTransforms): a precached copy would be served to every returning
// visitor and the flag-aware answer would never reach them.
//
// iOS ignores `shortcuts`; it only reads the icons and name when someone adds the
// app to the home screen. The shortcut URLs are handled by src/phone/quickAction.ts.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// dist/ is what `vite build` writes and the Docker image copies to /app/dist; this file is /app/server/routes/phone.js.
export const DEFAULT_MANIFEST_PATH = join(HERE, '..', '..', 'dist', 'manifest.webmanifest');

export const SHORTCUTS = [
  {
    name: 'I bit',
    short_name: 'I bit',
    description: 'Log a bite',
    url: '/?action=bite',
    icons: [{ src: '/icons/shortcut-bite-96x96.png', sizes: '96x96', type: 'image/png' }],
  },
  {
    name: 'I feel an urge',
    short_name: 'Urge',
    description: 'Log an urge and breathe with the timer',
    url: '/?action=urge',
    icons: [{ src: '/icons/shortcut-urge-96x96.png', sizes: '96x96', type: 'image/png' }],
  },
];

/** The built manifest plus the shortcuts. Nothing else about it changes. */
export function buildPhoneManifest(base) {
  return { ...base, shortcuts: SHORTCUTS };
}

export function createPhoneRoutes({ manifestPath = DEFAULT_MANIFEST_PATH } = {}) {
  return {
    name: 'phone',
    register({ app, flags }) {
      app.get('/manifest.webmanifest', async (_req, res, next) => {
        if (!flags.isOn('phone_companion')) return next();
        let base;
        try {
          base = JSON.parse(await readFile(manifestPath, 'utf8'));
        } catch {
          return next(); // no built manifest (or not JSON): let the static handler answer as it always did
        }
        res
          .type('application/manifest+json')
          .set('Cache-Control', 'no-cache')
          .send(JSON.stringify(buildPhoneManifest(base)));
      });
    },
  };
}

export default createPhoneRoutes();
