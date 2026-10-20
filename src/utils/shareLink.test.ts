import { describe, it, expect } from 'vitest';
import { buildShareUrl, cleanChoiceParam, cleanNumberParam } from './shareLink';

describe('shareLink', () => {
  it('accepts plain non-negative numbers only', () => {
    expect(cleanNumberParam('10')).toBe('10');
    expect(cleanNumberParam('2.5')).toBe('2.5');
    expect(cleanNumberParam('-3')).toBe('');
    expect(cleanNumberParam('1e9')).toBe('');
    expect(cleanNumberParam('<script>')).toBe('');
    expect(cleanNumberParam('1234567')).toBe('');
    expect(cleanNumberParam('1.234')).toBe('');
    expect(cleanNumberParam(null)).toBe('');
  });

  it('falls back for unknown choices', () => {
    expect(cleanChoiceParam('toe', ['finger', 'toe'] as const, 'finger')).toBe('toe');
    expect(cleanChoiceParam('hand', ['finger', 'toe'] as const, 'finger')).toBe('finger');
    expect(cleanChoiceParam(null, ['finger', 'toe'] as const, 'finger')).toBe('finger');
  });

  it('builds the bare path when there are no inputs and skips empty ones', () => {
    const base = 'https://stopbiting.today';
    const path = '/tools/nail-growth-timeline-calculator';
    expect(buildShareUrl(base, path, { mm: '', type: '' })).toBe(base + path);
    expect(buildShareUrl(base, path, { mm: '10', type: 'toe' })).toBe(`${base}${path}?mm=10&type=toe`);
    expect(buildShareUrl(base, path, { mm: ' 4 ', type: '' })).toBe(`${base}${path}?mm=4`);
  });
});
