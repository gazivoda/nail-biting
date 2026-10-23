import { describe, it, expect } from 'vitest';
import { FEATURE_PAGE_MAP } from './featurePages';
import { FEATURE_PAGE_FLAGS, FEATURE_PAGE_PATHS, isFeaturePagePath } from './featurePagePaths';
import { FEATURES } from '../features/registry';
import { BLOG_INDEX } from './blogIndex';
import { PAGE_MAP, MEDICAL_DISCLAIMER_SECTION } from './comparePages';
import { dropEmptySections, fillCopyTokensDeep, flagAwareDeep } from '../../shared/flagCopy.js';
import { TRIAL_HYPHEN } from '../../shared/plans.js';

// The words on the six pages that exist only while a feature flag is on. These checks are about what the
// copy may and may not say (docs/agents/SWARM_RULES.md); how it is gated and served is in
// scripts/featurePages.test.mjs.

type Page = ReturnType<(typeof FEATURE_PAGE_MAP)[string]>;

const PATHS = Object.keys(FEATURE_PAGE_MAP);
const text = (page: Page) => JSON.stringify(page);
const prose = (page: Page): string[] => [
  page.title, page.subtitle, page.intro,
  ...page.sections.flatMap(s => (s.heading === MEDICAL_DISCLAIMER_SECTION.heading ? [] : [s.heading, s.body, s.html ?? ''])),
];
const plain = (html: string) => html.replace(/<[^>]*>/g, ' ');

// Every flag a page's markers name, so each page is checked in every combination of them.
function markerFlags(page: Page): string[] {
  return [...new Set([...text(page).matchAll(/\{\{if ([a-z_0-9]+)\}\}/g)].map(m => m[1]))];
}
function combos(names: string[]): ((flag: string) => boolean)[] {
  const out: ((flag: string) => boolean)[] = [];
  for (let mask = 0; mask < 1 << names.length; mask++) {
    const on = names.filter((_, i) => mask & (1 << i));
    out.push(flag => on.includes(flag));
  }
  return out;
}
const resolve = (page: Page, isOn: (flag: string) => boolean) =>
  dropEmptySections(flagAwareDeep(fillCopyTokensDeep(page, { REFERRAL_CREDIT: 'one month' }), isOn));

describe('the feature page registry', () => {
  it('lists the same six paths in the copy and in the flag map, each with a flag that exists', () => {
    expect(PATHS.sort()).toEqual([...FEATURE_PAGE_PATHS].sort());
    expect(PATHS).toHaveLength(6);
    for (const [path, flag] of Object.entries(FEATURE_PAGE_FLAGS)) {
      expect(Object.keys(FEATURES), `${path}: ${flag}`).toContain(flag);
      expect(isFeaturePagePath(path)).toBe(true);
    }
    expect(isFeaturePagePath('/pricing')).toBe(false);
  });

  it('gates each page with the flag of the feature it describes, and no two pages share the wrong one', () => {
    expect(FEATURE_PAGE_FLAGS).toEqual({
      '/features/habit-reversal-coaching': 'hrt_coaching',
      '/features/phone-companion': 'phone_companion',
      '/features/share-with-therapist': 'share_links',
      '/features/referral-program': 'referrals',
      '/features/desktop-app': 'desktop_app',
      '/solutions/cuticle-biting': 'detection_behaviors',
    });
  });

  it('never gates a page that is already published', () => {
    for (const path of PATHS) expect(PAGE_MAP[path], path).toBeUndefined();
  });
});

describe.each(PATHS)('%s', path => {
  const page = FEATURE_PAGE_MAP[path]();

  it('has what a page needs: title, standfirst, sections, a visible FAQ and related links that exist', () => {
    expect(page.title.length).toBeGreaterThan(20);
    expect(page.subtitle.length).toBeGreaterThan(30);
    expect(page.intro.length).toBeGreaterThan(200);
    expect(page.sections.length).toBeGreaterThanOrEqual(5);
    const faq = page.sections.find(s => /frequently asked/i.test(s.heading));
    expect(faq?.html, 'FAQ section').toBeTruthy();
    expect([...faq!.html!.matchAll(/<h3[^>]*>/g)].length).toBeGreaterThanOrEqual(4);
    expect([...faq!.html!.matchAll(/<h3[^>]*>[^<]*<\/h3><p>[^<]*<\/p>/g)].length).toBe([...faq!.html!.matchAll(/<h3/g)].length);
    expect(page.relatedPosts.length).toBeGreaterThanOrEqual(2);
    const known = new Set([...BLOG_INDEX.map(p => `/blog/${p.slug}`), '/how-it-works', '/pricing', '/refund-policy', '/about', ...Object.keys(PAGE_MAP), ...PATHS]);
    for (const link of page.relatedPosts) expect(known.has(link.href), link.href).toBe(true);
  });

  it('makes no medical claim, invents no number, and quotes no study, testimonial or competitor', () => {
    const body = prose(page).join(' ');
    expect(body).not.toMatch(/\bcures?\b|\bcured\b|\bheals?\b|clinically|\bproven\b|guarantee|breakthrough|miracle/i);
    expect(body).not.toMatch(/\b(study|studies|clinical trials?|randomi[sz]ed|research|evidence)\b/i);
    expect(body).not.toMatch(/\d+\s*%/);
    expect(body).not.toMatch(/Hands Off|HabitAware|Pavlok|Nailed|SmartBehavior|NailKeeper|BiteLess|HabitCam|NailBiteMenu/);
    expect(body).not.toMatch(/"[^"]{20,}"\s*[-,]\s*[A-Z][a-z]+/);   // no attributed quotation
    // "treatment" only ever as something this is not.
    for (const sentence of body.split(/(?<=[.!?])\s+/)) {
      if (/\btreat(ment|s|ing)?\b/i.test(sentence)) expect(sentence, sentence).toMatch(/\bnot\b/i);
    }
  });

  it('uses only numbers the product itself has', () => {
    const allowed = new Set(['0.6', '15', '60', '90', '28', '12', '7', '30', '5', '4', '2']);
    // The free-trial length is the site's one constant (shared/plans.js), spelled out by the copy itself.
    const found = prose(page).flatMap(t => plain(t).split(TRIAL_HYPHEN).join(' ').match(/\d+(\.\d+)?/g) ?? []);
    for (const n of found) expect(allowed.has(n), `${path} says ${n}`).toBe(true);
  });

  it('uses the approved privacy words and none of the retired ones', () => {
    const all = text(page);
    expect(all).not.toMatch(/100% private|no cloud, no server|zero network requests|nothing leaves your device|everything stays on your device|nothing is transmitted|works? fully offline|no network access/i);
    expect(all).not.toMatch(/completely private|totally private|fully private/i);
    // A page that talks about the camera says what the site always says about it.
    if (/camera/i.test(prose(page).join(' ')) && !/no camera and no detection|never from the camera/i.test(all)) {
      expect(all).toContain('No camera data is sent while it runs');
    }
  });

  it('has no dash in its prose (the site\'s voice), no emoji and no image', () => {
    for (const piece of prose(page)) {
      expect(piece, piece.slice(0, 60)).not.toMatch(/[—–]/);
      expect(piece).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(piece).not.toMatch(/<img|<svg|<picture|<video/i);
    }
  });

  it('names only flags that exist in its markers and only placeholders the server fills', () => {
    for (const flag of markerFlags(page)) expect(Object.keys(FEATURES), flag).toContain(flag);
    const raw = text(page);
    expect([...raw.matchAll(/\{\{if /g)].length).toBe([...raw.matchAll(/\{\{end\}\}/g)].length);
    for (const m of raw.matchAll(/\{\{([A-Z][A-Z0-9_]*)\}\}/g)) expect(['REFERRAL_CREDIT']).toContain(m[1]);
  });

  it('resolves cleanly with every combination of the flags it mentions: no marker left, no empty section, a FAQ that is still a FAQ', () => {
    for (const isOn of combos(markerFlags(page))) {
      const resolved = resolve(page, isOn);
      expect(text(resolved)).not.toMatch(/\{\{/);
      for (const s of resolved.sections) {
        expect(s.heading.trim().length + s.body.trim().length + (s.html ?? '').trim().length).toBeGreaterThan(0);
        expect(s.heading.trim().length, `a section lost its heading: ${s.body.slice(0, 40)}`).toBeGreaterThan(0);
      }
      const faq = resolved.sections.find(s => /frequently asked/i.test(s.heading));
      expect([...faq!.html!.matchAll(/<h3/g)].length).toBeGreaterThanOrEqual(4);
      for (const q of faq!.html!.matchAll(/<h3[^>]*>([^<]*)<\/h3><p>([^<]*)<\/p>/g)) {
        expect(q[1].trim().length).toBeGreaterThan(10);
        expect(q[2].trim().length).toBeGreaterThan(5);
      }
    }
  });
});

describe('what particular pages must and must not say', () => {
  const copy = (path: string) => text(FEATURE_PAGE_MAP[path]());

  it('coaching: not a treatment, the alarm is never delayed, the lessons are described only in general', () => {
    const all = copy('/features/habit-reversal-coaching');
    expect(all).toMatch(/not a treatment/i);
    expect(all).toMatch(/an app is not a clinician/i);
    expect(all).toMatch(/never delays or silences the alarm/);
    expect(all).not.toMatch(/week 1|day 1|lesson 1\b|lesson 9|lesson 11/i);
  });

  it('phone: no detection on the phone, installable, and sync only if turned on', () => {
    const all = copy('/features/phone-companion');
    expect(all).toMatch(/no camera and no detection on the phone/);
    expect(all).toMatch(/Add to Home Screen/);
    expect(all).toMatch(/\{\{if event_sync\}\}[^{]*unless you turn on sync/);
  });

  it('sharing: what it never shows, how to revoke it, and no claim that it is private from the service', () => {
    const all = copy('/features/share-with-therapist');
    expect(all).toMatch(/What does it never show/);
    expect(all).toMatch(/Revoke any of them/);
    expect(all).not.toMatch(/end-to-end|encrypted|anonymous|HIPAA|confidential/i);
    expect(all).toMatch(/worked out on our server/);
  });

  it('referrals: the reward is a placeholder filled from the environment, never a number', () => {
    const all = copy('/features/referral-program');
    expect(all).toContain('{{REFERRAL_CREDIT}}');
    expect(all.replace(/for 30 days/g, '')).not.toMatch(/\b30 days\b|\bone month of\b|\bthirty days\b/);
  });

  it('desktop: names no download, no Windows build and no signing', () => {
    const all = copy('/features/desktop-app');
    expect(all).not.toMatch(/\/downloads|\.dmg|\.exe|notariz|signed|code.sign|certificate/i);
    expect(all).toContain('There is no Windows version yet');
    expect(all).toContain('Launch at login');
  });

  it('cuticle biting: the same mouth check, early, tested on made-up scenes only, with no accuracy figure and no other behavior claimed', () => {
    const all = copy('/solutions/cuticle-biting');
    expect(all).toMatch(/does not have a separate detector/);
    expect(all).toMatch(/This is early/);
    expect(all).toMatch(/scenes made up for testing/);
    expect(all).toMatch(/we publish no accuracy figure/i);
    expect(all).not.toMatch(/\d+\s*%|accurate to|precision|recall|\b(it|app|alarm) detects (nose|skin|hair)|\bdetects (nose|face skin|hair)/i);
    const page = FEATURE_PAGE_MAP['/solutions/cuticle-biting']();
    for (const s of prose(page).join(' ').split(/(?<=[.!?])\s+/)) {
      if (/nose picking|hair pulling|skin picking/i.test(s)) expect(s, s).toMatch(/no claim|does not claim|not claim/i);
    }
  });
});
