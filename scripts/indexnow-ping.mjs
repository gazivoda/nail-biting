// Submit all sitemap URLs to IndexNow (Bing/Copilot, Seznam, Naver, Yandex).
// Run AFTER a deploy: node scripts/indexnow-ping.mjs
// The key file public/<KEY>.txt must stay deployed at the site root.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KEY = '21f3175251594edf918c599f5bdee19f';
const HOST = 'stopbiting.today';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sitemap = readFileSync(join(root, 'public', 'sitemap.xml'), 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (urls.length === 0) throw new Error('No URLs found in public/sitemap.xml');

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList: urls,
  }),
});
console.log(`IndexNow: submitted ${urls.length} URLs — HTTP ${res.status}`);
if (!res.ok && res.status !== 202) process.exit(1);
