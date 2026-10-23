// The engine with more than one behaviour switched on. (With one it is the shipped
// detector, which equivalence.test.ts proves against the old code.) These cases have
// no old behaviour to compare with, so they state what the engine is meant to do.

import { describe, it, expect } from 'vitest';
import { createEngine } from './engine.ts';
import { buildHand, facePoint, neutralFace } from './synthetic.ts';
import { framesForDwell, RULES } from './rules.ts';
import type { Behavior } from '../storage/eventModel.ts';
import type { Landmark } from './types.ts';
import type { DetectionSensitivity } from '../types';

const face = neutralFace();

interface Frame { hands: Landmark[][]; face?: Landmark[] | null }
type Event = { frame: number; kind: 'start'; behavior: Behavior } | { frame: number; kind: 'end' };

function hand(pin: number, at: [number, number], extra: { pinch?: boolean; fingers?: boolean } = {}): Landmark[] {
  return buildHand({
    side: 'right', pin, at, angleDeg: 180,
    ext: extra.fingers ? undefined : { index: pin === 8 ? 1 : 0.3, middle: 0.3, ring: 0.3, pinky: pin === 20 ? 1 : 0.3, thumb: 0.4 },
    pinch: extra.pinch,
  });
}

function run(
  frames: Frame[],
  getBehaviors?: () => readonly Behavior[],
  sensitivity: DetectionSensitivity = 'medium',
  onFrame?: (i: number) => void,
): Event[] {
  const events: Event[] = [];
  let current: Frame = frames[0];
  let index = 0;
  const engine = createEngine({
    getVideo: () => ({ readyState: 4 }),
    getSensitivity: () => sensitivity,
    source: {
      detectHands: () => current.hands,
      detectFace: () => (current.face === null ? [] : [current.face ?? face]),
    },
    getBehaviors,
    onBiteStart: behavior => events.push({ frame: index, kind: 'start', behavior }),
    onBiteEnd: () => events.push({ frame: index, kind: 'end' }),
  });
  for (index = 0; index < frames.length; index++) {
    current = frames[index];
    onFrame?.(index);
    engine.step(1000 + index * 200);
  }
  return events;
}

const starts = (events: Event[]) => events.filter(e => e.kind === 'start') as Array<Extract<Event, { kind: 'start' }>>;
const repeat = (frame: Frame, n: number): Frame[] => Array.from({ length: n }, () => frame);
const noHand: Frame = { hands: [] };

const noseFinger = (): Frame => ({ hands: [hand(8, facePoint('noseBase'))] });
const mouthFinger = (): Frame => ({ hands: [hand(8, facePoint('mouth'))] });
const browPinch = (): Frame => ({ hands: [hand(8, facePoint('browRight'), { pinch: true })] });

describe('the default', () => {
  it('without getBehaviors only nail biting runs, even with a fingertip in the nose', () => {
    // The nose is within the mouth rule's reach (0.12 of the frame), so the old app alarms here too: unchanged.
    const e = run(repeat(noseFinger(), 12));
    expect(new Set(starts(e).map(s => s.behavior))).toEqual(new Set(['nail_biting']));
  });
});

describe('several behaviours at once', () => {
  it('each rule uses its own dwell: the mouth rule after 3 frames, the nose rule after 8', () => {
    const e = run(repeat(noseFinger(), 12), () => ['nail_biting', 'nose_picking']);
    const first = (b: Behavior) => starts(e).find(s => s.behavior === b)?.frame;
    expect(first('nail_biting')).toBe(framesForDwell(RULES.nail_biting.dwellMs) - 1);
    expect(first('nose_picking')).toBe(framesForDwell(RULES.nose_picking.dwellMs) - 1);
  });

  it('with only the nose rule selected, the mouth rule does not run', () => {
    const e = run(repeat(noseFinger(), 12), () => ['nose_picking']);
    expect(new Set(starts(e).map(s => s.behavior))).toEqual(new Set(['nose_picking']));
    expect(starts(e)[0].frame).toBe(7);
  });

  it('a rule that is not selected never reports, however well the hand fits it', () => {
    const e = run(repeat(browPinch(), 20), () => ['nose_picking']);
    expect(starts(e)).toEqual([]);
  });

  it('reports the behaviour whose dwell was met, in registry order when two are met on one frame', () => {
    // Both rules fire on a fingertip at the nose; at frame 7 both are past their dwell.
    const e = run(repeat(noseFinger(), 9), () => ['nose_picking', 'nail_biting']);
    const atFrame7 = starts(e).filter(s => s.frame === 7).map(s => s.behavior);
    expect(atFrame7).toEqual(['nail_biting', 'nose_picking']);
  });

  it('an episode ends after two frames in which NO rule has contact', () => {
    const frames = [...repeat(noseFinger(), 9), noHand, noHand];
    const e = run(frames, () => ['nail_biting', 'nose_picking']);
    expect(e.filter(x => x.kind === 'end')).toEqual([{ frame: 10, kind: 'end' }]);
  });

  it('contact with a different rule between two frames keeps the episode alive', () => {
    // Frames: nose, mouth-only fingertip, nose ...: the shared miss counter never reaches 2.
    const frames: Frame[] = [];
    for (let i = 0; i < 10; i++) frames.push(i % 2 ? mouthFinger() : noseFinger());
    const e = run(frames, () => ['nail_biting', 'nose_picking']);
    expect(e.filter(x => x.kind === 'end')).toEqual([]);
  });

  it('the pinch rules need a pinch', () => {
    const open: Frame = { hands: [hand(8, facePoint('browRight'), { fingers: true })] };
    expect(starts(run(repeat(open, 20), () => ['eye_area_pulling']))).toEqual([]);
    const e = run(repeat(browPinch(), 20), () => ['eye_area_pulling']);
    expect(starts(e)[0]).toEqual({ frame: framesForDwell(RULES.eye_area_pulling.dwellMs) - 1, kind: 'start', behavior: 'eye_area_pulling' });
  });
});

describe('changing the selection while running', () => {
  it('a rule added mid-run starts its dwell from zero', () => {
    let wanted: readonly Behavior[] = ['nail_biting'];
    const frames = repeat(noseFinger(), 14);
    const e = run(frames, () => wanted, 'medium', i => { if (i === 4) wanted = ['nail_biting', 'nose_picking']; });
    // Added before frame 4's step: eight frames of contact are needed from there, so the first at frame 11.
    expect(starts(e).find(s => s.behavior === 'nose_picking')?.frame).toBe(4 + framesForDwell(RULES.nose_picking.dwellMs) - 1);
  });

  it('returning a new array with the same contents every frame does not disturb the dwell', () => {
    const e = run(repeat(noseFinger(), 12), () => ['nail_biting', 'nose_picking']);
    const e2 = run(repeat(noseFinger(), 12), (() => { const same = ['nail_biting', 'nose_picking'] as Behavior[]; return () => same; })());
    expect(e2).toEqual(e);
  });

  it('removing a rule silences it at once and resets it', () => {
    let wanted: readonly Behavior[] = ['nail_biting', 'nose_picking'];
    const e = run(repeat(noseFinger(), 12), () => wanted, 'medium', i => { if (i === 5) wanted = ['nail_biting']; });
    expect(starts(e).some(s => s.behavior === 'nose_picking')).toBe(false);
  });

  it('an empty selection watches for nothing and keeps clearing', () => {
    const e = run(repeat(noseFinger(), 6), () => []);
    expect(starts(e)).toEqual([]);
    expect(e.filter(x => x.kind === 'end').length).toBe(3);
  });
});

describe('face skin picking over time', () => {
  it('needs 15 frames of small repeated movement, then reports on every frame', () => {
    const frames: Frame[] = [];
    for (let i = 0; i < 20; i++) {
      const base = facePoint('cheekRight');
      const phase = 2 * Math.PI * 1.3 * (i * 0.2);
      frames.push({ hands: [hand(8, [base[0] + 10 * Math.sin(phase), base[1] + 8 * Math.sin(phase * 1.31 + 0.7)])] });
    }
    const e = run(frames, () => ['face_skin_picking']);
    expect(starts(e)[0].frame).toBe(14);
    expect(starts(e).length).toBe(6);
  });

  it('a hand that rests on the cheek never alarms', () => {
    const base = facePoint('cheekRight');
    const frames = repeat({ hands: [hand(8, [base[0], base[1]])] }, 40);
    expect(starts(run(frames, () => ['face_skin_picking']))).toEqual([]);
  });
});

describe('failure handling stays the same with several rules', () => {
  it('no face is a miss for every rule', () => {
    const e = run(repeat({ hands: [hand(8, facePoint('noseBase'))], face: null }, 6), () => ['nail_biting', 'nose_picking']);
    expect(starts(e)).toEqual([]);
    expect(e.filter(x => x.kind === 'end').length).toBe(3);
  });
});
