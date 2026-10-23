// What the detector is told to watch, and what the Settings list shows, for each combination of
// flags and stored choice. Rendered in node with react-dom/server (no DOM, no effects), which is
// enough because the hooks are pure functions of kv + flags.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { resetFlagsForTests } from '../features/flags';
import { kv } from '../storage/kv';
import { setStorageAdapter } from '../storage/adapter';
import { createMemoryAdapter, resetStorage } from '../../test-utils/memoryStorage';
import { BehaviorsSection } from '../pages/settings/sections/BehaviorsSection';
import { useActiveBehaviors } from './useBehaviors';
import { readStoredBehaviors, writeStoredBehaviors } from './selection';

function setFlags(...on: string[]) {
  kv.set('flags', 'last-known', { at: Date.now(), flags: Object.fromEntries(on.map(n => [n, true])) });
  resetFlagsForTests();
}

function Active() {
  return <p>{useActiveBehaviors().join(',')}</p>;
}
const active = () => renderToStaticMarkup(<Active />).replace(/<\/?p>/g, '');

beforeEach(() => {
  setStorageAdapter(createMemoryAdapter());
  resetFlagsForTests();
});
afterEach(() => {
  resetStorage();
  resetFlagsForTests();
});

describe('useActiveBehaviors', () => {
  it('is nail biting with nothing stored and every flag off', () => {
    expect(active()).toBe('nail_biting');
  });

  it('stays nail biting with every flag off, however much is stored', () => {
    kv.set('detection', 'behaviors', ['cuticle_skin_biting']);
    expect(active()).toBe('nail_biting');
    kv.set('detection', 'behaviors', ['nail_biting', 'nose_picking', 'hair_pulling']);
    setFlags('experimental'); // experimental alone is not enough: it depends on detection_behaviors
    expect(active()).toBe('nail_biting');
  });

  it('follows the stored choice once detection_behaviors is on', () => {
    kv.set('detection', 'behaviors', ['cuticle_skin_biting']);
    setFlags('detection_behaviors');
    expect(active()).toBe('cuticle_skin_biting');
  });

  it('only lets experimental behaviours through when that flag is on too', () => {
    kv.set('detection', 'behaviors', ['nail_biting', 'nose_picking']);
    setFlags('detection_behaviors');
    expect(active()).toBe('nail_biting');
    setFlags('detection_behaviors', 'experimental');
    expect(active()).toBe('nail_biting,nose_picking');
  });

  it('is nail biting when the stored value is garbage', () => {
    setFlags('detection_behaviors', 'experimental');
    for (const junk of ['nose_picking', 7, { a: 1 }, ['nope'], []]) {
      kv.set('detection', 'behaviors', junk);
      expect(active()).toBe('nail_biting');
    }
  });
});

describe('storing the choice', () => {
  it('round-trips through the storage module', () => {
    expect(readStoredBehaviors()).toBeNull();
    expect(writeStoredBehaviors(['nail_biting', 'nose_picking'])).toBe(true);
    expect(readStoredBehaviors()).toEqual(['nail_biting', 'nose_picking']);
    expect(kv.keys('detection')).toEqual(['behaviors']);
  });
});

describe('<BehaviorsSection />', () => {
  const toggles = (html: string) => [...html.matchAll(/aria-label="Watch for ([^"]+)"[^>]*aria-checked="(true|false)"|aria-checked="(true|false)"[^>]*aria-label="Watch for ([^"]+)"/g)]
    .map(m => [m[1] ?? m[4], (m[2] ?? m[3]) === 'true'] as const);

  it('lists the two validated behaviours with nail biting on by default, and no experimental heading', () => {
    setFlags('detection_behaviors');
    const html = renderToStaticMarkup(<BehaviorsSection />);
    expect(toggles(html)).toEqual([['nail biting', true], ['cuticle and skin biting', false]]);
    expect(html).not.toContain('Experimental');
    expect(html).not.toContain('Hair pulling');
  });

  it('adds the experimental behaviours, off, under their own heading when that flag is on', () => {
    setFlags('detection_behaviors', 'experimental');
    const html = renderToStaticMarkup(<BehaviorsSection />);
    expect(toggles(html).map(([n]) => n)).toEqual([
      'nail biting', 'cuticle and skin biting', 'nose picking', 'eyelash and eyebrow pulling', 'face skin picking', 'hair pulling',
    ]);
    expect(toggles(html).filter(([, on]) => on).map(([n]) => n)).toEqual(['nail biting']);
    expect(html).toContain('Experimental');
    expect(html).toContain('have not been tried on real footage');
  });

  it('shows the stored choice', () => {
    setFlags('detection_behaviors', 'experimental');
    kv.set('detection', 'behaviors', ['cuticle_skin_biting', 'hair_pulling']);
    const html = renderToStaticMarkup(<BehaviorsSection />);
    expect(toggles(html).filter(([, on]) => on).map(([n]) => n)).toEqual(['cuticle and skin biting', 'hair pulling']);
  });

  it('says why the last behaviour cannot be switched off', () => {
    setFlags('detection_behaviors');
    expect(renderToStaticMarkup(<BehaviorsSection />)).toContain('At least one stays on.');
  });
});
