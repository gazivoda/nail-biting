import { describe, it, expect } from 'vitest';
import raw from '../data/hrtProgram.json';
import { PROGRAM, lessonByDay, lessonsOfWeek, programNeedsReview } from './program';
import { PROGRAM_LESSON_COUNT } from './programProgress';

// The lesson text is a draft that a person must review before the flag is turned
// on (docs/agents/ws2-notes.md). These tests do not judge the wording; they keep
// the draft inside the rules it was written under, so an edit cannot quietly
// add a statistic, a study, a promise or a medical claim.

describe('src/data/hrtProgram.json', () => {
  it('begins with the review marker and still carries it until a person signs it off', () => {
    expect(Object.keys(raw)[0]).toBe('status');
    expect(raw.status).toBe('NEEDS HUMAN REVIEW');
    expect(programNeedsReview()).toBe(true);
  });

  it('has 28 lessons, one per day, all unreviewed', () => {
    expect(PROGRAM.lessons).toHaveLength(PROGRAM_LESSON_COUNT);
    expect(PROGRAM.lessons.map(l => l.day)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
    for (const l of PROGRAM.lessons) expect(l.reviewed, `day ${l.day}`).toBe(false);
  });

  it('is four weeks of seven, in the order awareness, competing response, trigger mapping, relapse handling', () => {
    expect(PROGRAM.weeks.map(w => w.theme)).toEqual(['awareness', 'competing response', 'trigger mapping', 'relapse handling']);
    for (const w of PROGRAM.weeks) {
      const ls = lessonsOfWeek(w.week);
      expect(ls, `week ${w.week}`).toHaveLength(7);
      for (const l of ls) expect(l.theme).toBe(w.theme);
    }
    expect(lessonByDay(1)?.week).toBe(1);
    expect(lessonByDay(28)?.week).toBe(4);
  });

  it('every lesson is short and complete', () => {
    for (const l of PROGRAM.lessons) {
      expect(l.title.trim(), `day ${l.day}`).not.toBe('');
      expect(l.body.length, `day ${l.day}`).toBeGreaterThanOrEqual(1);
      expect(l.body.length, `day ${l.day}`).toBeLessThanOrEqual(4);
      expect(l.tryToday.trim(), `day ${l.day}`).not.toBe('');
      const words = [...l.body, l.tryToday].join(' ').split(/\s+/).length;
      expect(words, `day ${l.day} length`).toBeLessThanOrEqual(190);
    }
  });

  const allText = (): Array<[string, string]> =>
    PROGRAM.lessons.flatMap(l => [
      [`day ${l.day} title`, l.title] as [string, string],
      ...l.body.map((b, i) => [`day ${l.day} body ${i + 1}`, b] as [string, string]),
      [`day ${l.day} try`, l.tryToday] as [string, string],
    ]);

  it('makes no statistic, study, clinical or outcome claim', () => {
    const banned = [
      /\d+\s*%|percent|per cent/i,                                  // statistics
      /\bstud(y|ies)\b|research|evidence|trial|scientif|peer[- ]review|clinically|\bproven\b|\bproof\b/i, // sources
      /\bcure[sd]?\b|\bheal(s|ed|ing)?\b|\btreat(s|ed|ing|ment)?\b|\btherapy\b|\bdisorder\b|diagnos|\bsymptom|medical|medication|\bprescri/i, // medical
      /guarantee|always works|works for everyone|\bwill (stop|quit|end|beat|cure|fix|remove|free)\b|you(?:'| a)ll (stop|quit|be free|never)/i, // promises
      /\b(rewire|rewiring|neuroplastic|dopamine|brain chemistry)\b/i, // pseudo-science
      /[–—]/,                                              // no en or em dashes (house style)
    ];
    for (const [where, text] of allText()) {
      for (const re of banned) expect(text, `${where} matches ${re}`).not.toMatch(re);
    }
  });

  it('says plainly that it is not a clinician and not a medical treatment', () => {
    expect(PROGRAM.disclaimer).toMatch(/not a medical treatment/i);
    expect(PROGRAM.disclaimer).toMatch(/therapist or doctor/i);
    const text27 = [lessonByDay(27)!.title, ...lessonByDay(27)!.body].join(' ');
    expect(text27).toMatch(/not a clinician/i);
  });

  it('never describes a drawing, animation or picture of the habit (text only, no image fields)', () => {
    for (const l of PROGRAM.lessons) {
      expect(Object.keys(l).sort()).toEqual(['body', 'day', 'reviewed', 'theme', 'title', 'tryToday', 'week']);
    }
  });

  it('uses no word of the retired privacy claims', () => {
    const everything = JSON.stringify(raw);
    expect(everything).not.toMatch(/100% private|no cloud|zero network|nothing leaves/i);
  });
});
