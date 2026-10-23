import { describe, it, expect } from 'vitest';
import { findUnmarkedEnglish, mark, describeLeaks } from './scan';

describe('findUnmarkedEnglish', () => {
  it('passes HTML whose every word is inside the marks', () => {
    const html = `<div><h2>${mark('Einstellungen')}</h2><p>${mark('Hallo Ana')} <b>${mark('fett')}</b></p><button aria-label="${mark('Schließen')}">×</button></div>`;
    expect(findUnmarkedEnglish(html)).toEqual([]);
  });

  it('finds English text outside the marks', () => {
    const leaks = findUnmarkedEnglish(`<p>${mark('Hallo')} Save your changes</p>`);
    expect(leaks.map(l => l.word)).toEqual(['Save', 'your', 'changes']);
  });

  it('finds English in the attributes a person reads or hears, not in the others', () => {
    const html = '<button aria-label="Close dialog" title="Help me" placeholder="Type here" alt="A chart" class="rounded-full text-sm" data-testid="close-button" id="the-id">x</button>';
    expect(findUnmarkedEnglish(html).map(l => l.word)).toEqual(['Close', 'dialog', 'Help', 'me', 'Type', 'here', 'A', 'chart'].filter(w => w.length >= 2));
    expect(findUnmarkedEnglish(html).every(l => l.where === 'attribute')).toBe(true);
  });

  it('ignores numbers, punctuation, symbols, scripts, styles and comments', () => {
    const html = '<p>12 / 30 · 4:05 — 99% (3×) …</p><script>const x = "English words";</script><style>.a{content:"words"}</style><!-- a comment -->';
    expect(findUnmarkedEnglish(html)).toEqual([]);
  });

  it('decodes entities before judging', () => {
    expect(findUnmarkedEnglish(`<p>${mark('Don&#x27;t')} &amp; &quot;${mark('ok')}&quot;</p>`)).toEqual([]);
    expect(findUnmarkedEnglish('<p>Don&#x27;t stop</p>').map(l => l.word)).toEqual(["Don't", 'stop']);
  });

  it('allows product names, units, German month and day names, and what a test lists', () => {
    expect(findUnmarkedEnglish('<p>Stop Biting · Google · 5 min · Okt 23 · Montag, 3. Dezember 14:05 Uhr</p>')).toEqual([]);
    expect(findUnmarkedEnglish('<p>Commute</p>')).toHaveLength(1);
    expect(findUnmarkedEnglish('<p>Commute</p>', { allow: ['Commute'] })).toEqual([]);
    expect(findUnmarkedEnglish('<p>Commute</p>', { allow: [/^Comm/] })).toEqual([]);
  });

  it('describes leaks readably', () => {
    expect(describeLeaks([])).toBe('no unmarked English');
    expect(describeLeaks(findUnmarkedEnglish('<p>Hello there</p>'))).toContain('"Hello"');
  });
});
