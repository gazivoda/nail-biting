import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import {
  FLAG_NAMES,
  FLAG_DEPENDS_ON,
  parseFlags,
  createFlags,
  createRequireFeature,
  unmetDependencies,
} from './features.js';
import { FEATURES } from '../src/features/registry.ts';
import { startTestServer } from '../test-utils/testServer.js';

describe('the flag registry', () => {
  it('server and client list exactly the same flags', () => {
    expect([...FLAG_NAMES].sort()).toEqual(Object.keys(FEATURES).sort());
  });

  it('has no duplicates and only lower snake_case names', () => {
    expect(new Set(FLAG_NAMES).size).toBe(FLAG_NAMES.length);
    for (const n of FLAG_NAMES) expect(n).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
  });

  it('covers every flag the swarm plan names', () => {
    const planned = [
      'detection_behaviors', 'experimental', 'hrt_coaching', 'urge_timer', 'false_positive_controls',
      'event_sync', 'data_backup', 'insights', 'photo_diary', 'weekly_email', 'phone_companion',
      'background_watching', 'desktop_app', 'signin_magic_link', 'signin_apple', 'signin_microsoft',
      'free_tier', 'lifetime_plan', 'gift_plan', 'referrals', 'regional_pricing', 'share_links',
      'compare_competitors', 'social_proof', 'locale_es', 'locale_de', 'locale_pt_br', 'app_analytics',
    ];
    expect([...FLAG_NAMES].sort()).toEqual([...planned].sort());
  });

  it('app_analytics exists, has no prerequisite and is off unless named (it sends camera-derived signals to Google Analytics)', () => {
    expect(FLAG_NAMES).toContain('app_analytics');
    expect(FLAG_DEPENDS_ON.app_analytics).toBeUndefined();
    expect(parseFlags('').flags.app_analytics).toBe(false);
    expect(parseFlags('event_sync,insights').flags.app_analytics).toBe(false);
    expect(parseFlags('App_Analytics').flags.app_analytics).toBe(true);
  });

  it('only declares dependencies on flags that exist, on both sides', () => {
    for (const [name, needs] of Object.entries(FLAG_DEPENDS_ON)) {
      expect(FLAG_NAMES).toContain(name);
      for (const n of needs) expect(FLAG_NAMES).toContain(n);
    }
    for (const [name, info] of Object.entries(FEATURES)) {
      expect(info.dependsOn ?? [], name).toEqual(FLAG_DEPENDS_ON[name] ?? []);
    }
  });
});

describe('parseFlags', () => {
  it('everything is off when unset, empty or blank', () => {
    for (const raw of [undefined, null, '', '   ', ',,,']) {
      const { flags, unknown } = parseFlags(raw);
      expect(Object.keys(flags)).toEqual(FLAG_NAMES);
      expect(Object.values(flags).every(v => v === false)).toBe(true);
      expect(unknown).toEqual([]);
    }
  });

  it('turns on exactly the names listed, tolerating spaces, commas and case', () => {
    const { flags } = parseFlags(' Event_Sync,insights  data_backup,, ');
    expect(Object.entries(flags).filter(([, v]) => v).map(([k]) => k).sort())
      .toEqual(['data_backup', 'event_sync', 'insights']);
  });

  it('ignores and reports unknown names, so a typo enables nothing', () => {
    const { flags, unknown } = parseFlags('event_syc,all,*,insights');
    expect(unknown).toEqual(['event_syc', 'all', '*']);
    expect(Object.values(flags).filter(Boolean)).toHaveLength(1);
    expect(flags.insights).toBe(true);
  });

  it('does not let prototype keys through', () => {
    const { flags, unknown } = parseFlags('__proto__,constructor,toString');
    expect(unknown).toHaveLength(3);
    expect(Object.values(flags).some(Boolean)).toBe(false);
  });
});

describe('createFlags', () => {
  it('reads FEATURE_FLAGS and is frozen after construction', () => {
    const warn = vi.fn();
    const flags = createFlags({ FEATURE_FLAGS: 'referrals,share_links' }, { warn });
    expect(flags.isOn('referrals')).toBe(true);
    expect(flags.isOn('event_sync')).toBe(false);
    expect(flags.isOn('not_a_flag')).toBe(false);
    expect(flags.enabled()).toEqual(['referrals', 'share_links']);
    const copy = flags.all();
    copy.event_sync = true; // a caller changing its copy changes nothing
    expect(flags.isOn('event_sync')).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns about unknown names and about unmet dependencies', () => {
    const warn = vi.fn();
    createFlags({ FEATURE_FLAGS: 'urge_timer,nope' }, { warn });
    const messages = warn.mock.calls.map(c => c[0]).join('\n');
    expect(messages).toMatch(/unknown flag.*nope/);
    expect(messages).toMatch(/urge_timer is on but hrt_coaching is off/);
  });

  it('unmetDependencies is empty when the prerequisites are on', () => {
    const { flags } = parseFlags('urge_timer,hrt_coaching');
    expect(unmetDependencies(flags)).toEqual([]);
  });

  it('with FEATURE_FLAGS unset, every flag is explicitly false', () => {
    const all = createFlags({}, { warn: () => {} }).all();
    expect(Object.keys(all)).toEqual(FLAG_NAMES);
    expect(Object.values(all).every(v => v === false)).toBe(true);
  });
});

describe('requireFeature', () => {
  async function appWith(env) {
    const flags = createFlags(env, { warn: () => {} });
    const requireFeature = createRequireFeature(flags);
    const app = express();
    app.get('/gated', requireFeature('event_sync'), (_req, res) => res.json({ secret: 'visible' }));
    return startTestServer(app);
  }

  it('answers 404 while the flag is off, without running the handler', async () => {
    const srv = await appWith({});
    try {
      const res = await fetch(`${srv.url}/gated`);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'Not found' });
    } finally {
      await srv.close();
    }
  });

  it('lets the request through once the flag is on', async () => {
    const srv = await appWith({ FEATURE_FLAGS: 'event_sync' });
    try {
      const res = await fetch(`${srv.url}/gated`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ secret: 'visible' });
    } finally {
      await srv.close();
    }
  });

  it('refuses a mistyped flag name when the route is registered', () => {
    const requireFeature = createRequireFeature(createFlags({}, { warn: () => {} }));
    expect(() => requireFeature('event_syncc')).toThrow(/unknown feature flag/);
  });
});
