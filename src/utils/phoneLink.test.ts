import { describe, it, expect, vi } from 'vitest';
import { canShare, shareToComputer, PHONE_SHARE } from './phoneLink';

describe('phoneLink', () => {
  it('detects Web Share support', () => {
    expect(canShare({ share: () => Promise.resolve() })).toBe(true);
    expect(canShare({})).toBe(false);
    expect(canShare(undefined)).toBe(false);
  });

  it('shares the site link and does not fall back on success', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const fallback = vi.fn();
    await shareToComputer(share, fallback);
    expect(share).toHaveBeenCalledWith({ ...PHONE_SHARE });
    expect(PHONE_SHARE.url).toBe('https://stopbiting.today');
    expect(fallback).not.toHaveBeenCalled();
  });

  it('does not open mail when the visitor closes the sheet', async () => {
    const fallback = vi.fn();
    await shareToComputer(() => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' })), fallback);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('falls back to mail when sharing genuinely fails', async () => {
    const fallback = vi.fn();
    await shareToComputer(() => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' })), fallback);
    expect(fallback).toHaveBeenCalledTimes(1);
  });
});
