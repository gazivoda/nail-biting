// The home hero screenshot's candidates, `sizes` and preload (shared/heroShot.js). The page's <img> (src/pages/Landing.tsx)
// and the preload in the HTML (server.js, server/marketing/localePages.js) are written from this one constant, and these
// tests pin what a mobile Lighthouse run showed: the picture is the page's LCP element, the browser must be offered a
// file that is not much bigger than the picture it draws, and every candidate must be the same real capture.

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import * as heroShot from './heroShot.js';
import { HERO_SHOT, heroShotPreloadTag } from './heroShot.js';

const PUBLIC = fileURLToPath(new URL('../public', import.meta.url));

/** Pixel size of a WebP file, from its header (lossy VP8 or extended VP8X). */
function webpSize(file) {
  const b = readFileSync(file);
  expect(b.toString('ascii', 0, 4), `${file} is RIFF`).toBe('RIFF');
  expect(b.toString('ascii', 8, 12), `${file} is WebP`).toBe('WEBP');
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (kind === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  throw new Error(`${file}: unsupported WebP chunk ${kind}`);
}

const candidates = HERO_SHOT.srcSet.split(',').map(c => {
  const [url, descriptor] = c.trim().split(/\s+/);
  return { url, w: Number(descriptor.replace('w', '')), file: join(PUBLIC, url) };
});

describe('the hero screenshot constant', () => {
  it('exports exactly what heroShot.d.ts declares', () => {
    expect(Object.keys(heroShot).sort()).toEqual(['HERO_SHOT', 'heroShotPreloadTag']);
    expect(Object.keys(HERO_SHOT).sort()).toEqual(['height', 'sizes', 'src', 'srcSet', 'width']);
  });

  it('offers three files, smallest first, each as wide as its descriptor says, all one capture (one aspect ratio)', () => {
    expect(candidates.map(c => c.w)).toEqual([640, 1280, 2560]);
    const ratio = HERO_SHOT.width / HERO_SHOT.height;
    for (const c of candidates) {
      expect(existsSync(c.file), `${c.url} exists in public/`).toBe(true);
      const { width, height } = webpSize(c.file);
      expect(width, `${c.url} width`).toBe(c.w);
      expect(width / height, `${c.url} aspect ratio`).toBeCloseTo(ratio, 2);
    }
  });

  it('the fallback src is the largest file and the width/height are the 1280 file\'s, so the box is reserved before the picture arrives', () => {
    expect(HERO_SHOT.src).toBe(candidates.at(-1).url);
    expect(webpSize(join(PUBLIC, HERO_SHOT.src))).toEqual({ width: 2560, height: 1584 });
    expect(webpSize(candidates[1].file)).toEqual({ width: HERO_SHOT.width, height: HERO_SHOT.height });
  });

  it('every file is a real screenshot with its provenance beside it (never a drawing of the habit)', () => {
    for (const c of candidates) {
      const sidecar = c.file + '.json';
      expect(existsSync(sidecar), `${c.url}.json`).toBe(true);
      expect(JSON.parse(readFileSync(sidecar, 'utf8')).prompt, c.url).toMatch(/^ORIGIN: screenshot of the real Stop Biting web app \(not generated\)/);
    }
  });

  it('sizes is the picture\'s real width: the desktop arm unchanged, the one-column arm narrower than the viewport', () => {
    // 100vw asked for 84 px more than the picture drew, so a 412 px phone at 1.75x (574 px of picture) fetched the 1280 px file.
    expect(HERO_SHOT.sizes).toMatch(/^\(min-width: 1024px\) 36rem, calc\(100vw - \d+(\.\d+)?rem\)$/);
    expect(HERO_SHOT.sizes).not.toMatch(/(^|, )100vw$/);
  });

  it('the picture of a 412 px phone at 1.75x is a 640 px file, and a 2x desktop screen still gets the 1280 px one', () => {
    // The browser takes the smallest candidate that is at least (drawn CSS px x device pixel ratio) wide.
    const pick = (cssWidth, dpr) => candidates.find(c => c.w >= cssWidth * dpr)?.w ?? candidates.at(-1).w;
    expect(pick(412 - 88, 1.75)).toBe(640);
    expect(pick(360 - 88, 2)).toBe(640);
    expect(pick(390 - 88, 3)).toBe(1280);
    expect(pick(36 * 16, 1)).toBe(640);
    expect(pick(36 * 16, 2)).toBe(1280);
    expect(pick(36 * 16, 3)).toBe(2560);
  });
});

describe('the preload', () => {
  const tag = heroShotPreloadTag();
  it('names the <img>\'s own src, candidates and sizes, so the browser fetches one copy', () => {
    expect(tag).toBe(
      `<link rel="preload" as="image" href="${HERO_SHOT.src}" imagesrcset="${HERO_SHOT.srcSet}" imagesizes="${HERO_SHOT.sizes}" fetchpriority="high">`,
    );
  });
  it('is one tag, with nothing in an attribute that would end it', () => {
    expect(tag.match(/</g)).toHaveLength(1);
    expect(tag.match(/>/g)).toHaveLength(1);
    expect(tag.match(/"/g)).toHaveLength(12);   // six attributes
  });
});

// The two servers' routes cannot be run from a unit test (the localized pages need a language switched on and a reviewed
// file), so the rule is pinned at the source: the preload is the shared one, and no second hand-written copy can drift.
describe('where the preload comes from', () => {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));
  for (const file of ['server.js', 'server/marketing/localePages.js']) {
    it(`${file} writes it with heroShotPreloadTag() and carries no srcset of its own`, () => {
      const source = readFileSync(join(ROOT, file), 'utf8');
      expect(source).toMatch(/import \{ heroShotPreloadTag \} from '[./]+\/shared\/heroShot\.js'/);
      expect(source).toContain('heroShotPreloadTag()');
      expect(source).not.toMatch(/imagesrcset|imagesizes/i);
    });
  }
});
