// The 4-week program's content, typed (WS2). The text lives in
// src/data/hrtProgram.json so it can be reviewed and edited without touching
// code. It is bundled with the app, so reading it never needs the network.
//
// NEEDS HUMAN REVIEW: the file's top-level `status` and every lesson's
// `reviewed` are the review gate. See docs/agents/ws2-notes.md.

import raw from '../data/hrtProgram.json';
import { PROGRAM_LESSON_COUNT } from './programProgress';

export interface Lesson {
  day: number;
  week: number;
  theme: string;
  title: string;
  body: string[];
  tryToday: string;
  reviewed: boolean;
}

export interface ProgramWeek {
  week: number;
  title: string;
  theme: string;
  summary: string;
}

export interface ProgramData {
  status: string;
  reviewNote: string;
  title: string;
  intro: string;
  pace: string;
  disclaimer: string;
  weeks: ProgramWeek[];
  lessons: Lesson[];
}

export const PROGRAM: ProgramData = raw as unknown as ProgramData;

/** True while the content has not been signed off (dev builds show a banner). */
export function programNeedsReview(p: ProgramData = PROGRAM): boolean {
  return p.status !== 'reviewed' || p.lessons.some(l => !l.reviewed);
}

export function lessonByDay(day: number, p: ProgramData = PROGRAM): Lesson | undefined {
  return p.lessons.find(l => l.day === day);
}

export function lessonsOfWeek(week: number, p: ProgramData = PROGRAM): Lesson[] {
  return p.lessons.filter(l => l.week === week);
}

export { PROGRAM_LESSON_COUNT };
