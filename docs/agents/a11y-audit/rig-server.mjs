// A long-lived rig on 3216 for every scenario script and for Lighthouse. Writes rig.json {url, token}.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startRig } from './rig2.mjs';
import { SP, DIST, ALL_FLAGS } from './lib.mjs';
const rig = await startRig({ dist: DIST, port: 3216, flags: ALL_FLAGS });
// a share link for the public page (created through the real API, as the signed-in user)
const headers = { 'content-type': 'application/json', cookie: `nh_session=${rig.token}`, origin: rig.url };
let share = null;
try {
  const r = await fetch(rig.url + '/api/share/links', { method: 'POST', headers, body: JSON.stringify({ label: 'My therapist', expiresInDays: 30, detailed: true, timezone: 'UTC' }) });
  share = { status: r.status, body: await r.json().catch(() => null) };
} catch (e) { share = { error: String(e) }; }
writeFileSync(join(SP, 'rig.json'), JSON.stringify({ url: rig.url, token: rig.token, share }, null, 1));
console.log('rig up', rig.url, JSON.stringify(share));
process.on('SIGTERM', () => { rig.stop(); process.exit(0); });
setInterval(() => {}, 1 << 30);
