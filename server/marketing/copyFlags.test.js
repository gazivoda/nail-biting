import { describe, it, expect } from 'vitest';
import { createFlags } from '../features.js';
import { createCopyIsOn } from './copyFlags.js';

const quiet = { warn: () => {} };

describe('copyIsOn("lifetime_plan"): the flag AND a Lifetime price id, like the card on the page', () => {
  const on = (featureFlags, env = {}) => createCopyIsOn(createFlags({ FEATURE_FLAGS: featureFlags }, quiet), env)('lifetime_plan');

  it('is off with the flag off, whatever the environment says', () => {
    expect(on('', {})).toBe(false);
    expect(on('', { PADDLE_PRICE_ID_LIFETIME: 'pri_01' })).toBe(false);
    expect(on('', { VITE_PADDLE_PRICE_ID_LIFETIME: 'pri_01' })).toBe(false);
  });

  it('is off with the flag on but no price id: the page shows no Lifetime card then', () => {
    expect(on('lifetime_plan', {})).toBe(false);
    expect(on('lifetime_plan', { PADDLE_PRICE_ID_LIFETIME: '' })).toBe(false);
    expect(on('lifetime_plan', { PADDLE_PRICE_ID_LIFETIME: '   ' })).toBe(false);
  });

  it('is on with the flag on and the id given to the server (either spelling)', () => {
    expect(on('lifetime_plan', { PADDLE_PRICE_ID_LIFETIME: 'pri_01' })).toBe(true);
    expect(on('lifetime_plan', { VITE_PADDLE_PRICE_ID_LIFETIME: 'pri_01' })).toBe(true);
  });

  it('does not change how the other flags are decided', () => {
    const copyIsOn = createCopyIsOn(createFlags({ FEATURE_FLAGS: 'event_sync,signin_apple' }, quiet), { PADDLE_PRICE_ID_LIFETIME: 'pri_01' });
    expect(copyIsOn('event_sync')).toBe(true);
    expect(copyIsOn('signin_apple')).toBe(false);   // no Apple keys
    expect(copyIsOn('phone_companion')).toBe(false);
  });
});
