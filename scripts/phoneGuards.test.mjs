// Source-level guards for WS6 (the phone companion). Structural promises that are easy to break by
// accident and hard to notice in a browser; they read the source files.
//
//  1. Nothing under src/phone draws the habit: no hand, mouth, face or figure icon, no image, SVG,
//     canvas or video (DESIGN.md, the owner's rule).
//  2. Nothing under src/phone uses the network or browser storage directly. Writes go through the storage module.
//  3. The three files that sit in the bundle every visitor downloads stay light: AuthContext imports only
//     offlineGrant, TabBar only activeStore, and those two pull in neither the store, the flags registry nor React Query-like weight.
//  4. Every entry point is behind the flag: the phone view is chosen by decidePhoneView (flag first), the webcam probe
//     only runs with the flag on, the offline copy is saved and used only for the flag, and the manifest route reads it.
//  5. Touch targets: every button and link in the phone view carries a min-h of 44px or more.
//  6. Logging goes through the storage module: events.add / update / softDelete, and WS2's urge helpers; never the store's
//     incidents directly (a direct write would skip the update stamp and never sync).

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => readFileSync(join(root, rel), 'utf8');
const strip = src => src.replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const phoneDir = join(root, 'src', 'phone');
const sources = readdirSync(phoneDir)
  .filter(f => /\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f))
  .map(f => ({ file: `src/phone/${f}`, code: strip(read(`src/phone/${f}`)) }));

const importsOf = code => [...code.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,]+?\s+from\s+)?['"]([^'"]+)['"]/g)].map(m => m[1]);

describe('the phone view never draws the habit', () => {
  it('imports no icon library and no image, SVG, canvas or video', () => {
    for (const { file, code } of sources) {
      expect(importsOf(code).filter(i => /lucide|icons|\.svg|\.png|\.webp|\.jpe?g/.test(i)), file).toEqual([]);
      expect(code, file).not.toMatch(/<(img|svg|canvas|video|picture)\b/);
      expect(code, file).not.toMatch(/\b(Hand|Mouth|Finger|Fingerprint|Smile|Frown|Face|Lips?|Bone)\w*\b/);
    }
  });
  it('uses the one existing glyph helper for tag marks (line icons chosen in triggerTags.ts), nothing of its own', () => {
    const tagMarks = sources.filter(s => /TagMark/.test(s.code)).map(s => s.file);
    expect(tagMarks).toEqual(['src/phone/LogToast.tsx']);
  });
});

describe('the phone view stays off the network and off raw storage', () => {
  it('no fetch, XHR, beacon, WebSocket, apiFetch, localStorage, sessionStorage or indexedDB', () => {
    for (const { file, code } of sources) {
      expect(code, file).not.toMatch(/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket|apiFetch|localStorage|sessionStorage|indexedDB)\b/);
    }
  });
});

describe('the files in the main bundle stay light', () => {
  const only = (rel, allowed) => {
    const found = importsOf(strip(read(rel))).filter(i => i.includes('phone'));
    expect(found.sort(), rel).toEqual(allowed.sort());
  };
  it('AuthContext imports only offlineGrant from src/phone, and TabBar only activeStore', () => {
    only('src/contexts/AuthContext.tsx', ['../phone/offlineGrant']);
    only('src/components/layout/TabBar.tsx', ['../../phone/activeStore']);
    only('src/components/PWAGuideModal.tsx', ['../phone/activeStore']);
  });
  it('offlineGrant imports only kv, the access util and types', () => {
    const code = sources.find(s => s.file === 'src/phone/offlineGrant.ts').code;
    expect(importsOf(code).sort()).toEqual(['../storage/kv', '../types/access', '../utils/access']);
  });
  it('activeStore imports only React', () => {
    const code = sources.find(s => s.file === 'src/phone/activeStore.ts').code;
    expect(importsOf(code)).toEqual(['react']);
  });
  it('Dashboard loads the phone view lazily, so a visitor who never sees it never downloads it', () => {
    const code = strip(read('src/pages/Dashboard.tsx'));
    expect(code).toMatch(/lazy\(\(\) => import\('\.\.\/phone\/PhoneView'\)\)/);
    expect(importsOf(code).filter(i => i.includes('phone/PhoneView'))).toEqual(['../phone/PhoneView']); // the one static import is `import type`
    expect(code).toMatch(/import type \{ PhoneTab \} from '\.\.\/phone\/PhoneView'/);
  });
});

describe('every entry point is behind the flag', () => {
  it('decidePhoneView answers false before anything else when the flag is off', () => {
    const code = sources.find(s => s.file === 'src/phone/phoneDecision.ts').code;
    expect(code).toMatch(/if \(!flagOn \|\| fullApp\) return false;/);
  });
  it('the hook reads the flag, probes for a webcam only with it on, and saves the offline copy only with it on', () => {
    const code = sources.find(s => s.file === 'src/phone/usePhoneView.ts').code;
    expect(code).toMatch(/useFeature\('phone_companion'\)/);
    expect(code).toMatch(/if \(flagOn && !phoneLike\) probeWebcam\(\);/);
    expect(code).toMatch(/if \(flagOn && signedInWithAccess && user\) saveGrant\(user\);/);
  });
  it('the offline copy is used only while the last-known flag is on', () => {
    const code = sources.find(s => s.file === 'src/phone/offlineGrant.ts').code;
    expect(code).toMatch(/if \(!phoneFlagWasOn\(\)\) return null;/);
  });
  it('the manifest route calls next() while the flag is off', () => {
    const code = strip(read('server/routes/phone.js'));
    expect(code).toMatch(/if \(!flags\.isOn\('phone_companion'\)\) return next\(\);/);
  });
});

describe('PWA metadata', () => {
  const html = read('index.html');
  it('the light status-bar colour the phone view restores is the one index.html ships', () => {
    const light = /LIGHT_THEME_COLOR = '(#[0-9A-Fa-f]{6})'/.exec(read('src/phone/themeColor.ts'))?.[1];
    expect(light).toBeTruthy();
    expect(html).toContain(`<meta name="theme-color" content="${light}" />`);
  });
  it('index.html has the iOS home-screen tags and full-bleed touch icons in the sizes iPhone and iPad use', () => {
    for (const tag of ['mobile-web-app-capable', 'apple-mobile-web-app-capable', 'apple-mobile-web-app-title', 'apple-mobile-web-app-status-bar-style']) {
      expect(html, tag).toContain(`name="${tag}"`);
    }
    for (const size of ['152x152', '167x167', '180x180']) {
      expect(html).toContain(`rel="apple-touch-icon" sizes="${size}" href="/icons/apple-touch-icon-${size}.png"`);
    }
  });
  it('every icon the head and the shortcuts name exists in public/icons', () => {
    const named = [...html.matchAll(/href="(\/icons\/[^"]+)"/g)].map(m => m[1]);
    expect(named.length).toBeGreaterThanOrEqual(4);
    for (const f of named) expect(() => readFileSync(join(root, 'public', f)), f).not.toThrow();
  });
});

describe('touch targets', () => {
  const BIG = /\bmin-h-(11|12|14|16)\b/;
  it('every button and link in the phone view has a class giving it at least 44px', () => {
    for (const file of ['src/phone/PhoneView.tsx', 'src/phone/LogToast.tsx', 'src/phone/RecentList.tsx', 'src/phone/SyncNoteView.tsx']) {
      const code = read(file);
      const starts = [...code.matchAll(/<button\b|<a\b/g)].map(m => m.index);
      expect(starts.length, file).toBeGreaterThan(0);
      for (const at of starts) {
        const tag = code.slice(at, at + 900);
        const cls = /className=(?:"([^"]*)"|\{`([^`]*)`\}|\{([A-Z_]+)\})/.exec(tag);
        expect(cls, `${file}: a button or link without a className near "${tag.slice(0, 60)}"`).not.toBeNull();
        const text = cls[1] ?? cls[2] ?? '';
        const viaConst = cls[3] ? new RegExp(`const ${cls[3]}\\s*=\\s*([\\s\\S]*?);`).exec(code)?.[1] ?? '' : '';
        const inline = `${text}${viaConst}`;
        // a template class like `${TEXT_BUTTON} -mx-3` or `${CHIP} ...` takes its size from the constant
        const consts = [...inline.matchAll(/\$\{([A-Z_]+)\}/g)].map(m => new RegExp(`const ${m[1]}\\s*=\\s*([\\s\\S]*?);`).exec(code)?.[1] ?? '').join(' ');
        expect(BIG.test(`${inline} ${consts}`), `${file}: ${inline.slice(0, 70)}`).toBe(true);
      }
    }
  });
  it('the two big buttons are 64px', () => {
    const code = read('src/phone/PhoneView.tsx');
    expect(code).toMatch(/I bit\s*<\/button>/);
    expect(code).toMatch(/I feel an urge\s*<\/button>/);
    expect((code.match(/min-h-16/g) ?? []).length).toBeGreaterThanOrEqual(3); // bite, urge fallback, and the wrapper rule for WS2's timer button
  });
});

describe('logging goes through the storage module', () => {
  it('the log flow is bound to events.* and WS2\'s urge helpers, and never touches incidents or the store', () => {
    const bound = sources.find(s => s.file === 'src/phone/useLogFlow.ts').code;
    expect(importsOf(bound).sort()).toEqual(['../coaching/urgeLog', '../storage', './logFlow', 'react']);
    const flow = sources.find(s => s.file === 'src/phone/logFlow.ts').code;
    expect(importsOf(flow)).toEqual([]); // pure: everything it touches is passed in
    for (const { file, code } of sources) {
      expect(code, file).not.toMatch(/\bsetState\b|\binsertEvent\b|\breplaceEvents\b|\bpatchEvent\b|\blogIncident\b|\.incidents\s*=/);
    }
  });
});
