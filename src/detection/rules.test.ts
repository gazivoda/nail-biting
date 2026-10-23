import { describe, it, expect } from 'vitest';
import {
  CUTICLE_SKIN_BITING_RULE,
  EYE_AREA_PULLING_RULE,
  FACE_SKIN_PICKING_RULE,
  FRAME_INTERVAL_MS,
  HAIR_PULLING_RULE,
  NAIL_BITING_RULE,
  NOSE_PICKING_RULE,
  RULES,
  createRuleState,
  evaluateRule,
  framesForDwell,
  type RuleState,
  type ZoneRule,
} from './rules.ts';
import { ZONES, createResolvedZone } from './zones.ts';
import { buildHand, facePoint, neutralFace, type HandOptions } from './synthetic.ts';
import { BEHAVIORS } from '../storage/eventModel.ts';
import type { DetectionSensitivity } from '../types';
import type { Landmark } from './types.ts';

const face = neutralFace();

function contact(rule: ZoneRule, hands: Landmark[][], sensitivity: DetectionSensitivity = 'medium', state: RuleState = createRuleState()) {
  const zone = createResolvedZone();
  ZONES[rule.zone].resolve(face, zone);
  return evaluateRule(rule, hands, zone, sensitivity, state);
}

const at = (name: Parameters<typeof facePoint>[0], dx = 0, dy = 0): [number, number] => {
  const p = facePoint(name);
  return [p[0] + dx, p[1] + dy];
};

/** A hand with one landmark pinned on a point; the other fingers curled so only the pinned one is near. */
function handAt(pin: number, point: [number, number], extra: Partial<HandOptions> = {}): Landmark[] {
  return buildHand({
    side: 'right', pin, at: point, angleDeg: 180, // fingers pointing left, the rest of the hand off to the right
    ext: { index: 0.3, middle: 0.3, ring: 0.3, pinky: 0.3, thumb: 0.4, ...(pin === 8 ? { index: 1 } : {}), ...(pin === 20 ? { pinky: 1 } : {}), ...(pin === 12 ? { middle: 1 } : {}) },
    ...extra,
  });
}

const pinchAt = (point: [number, number]) => handAt(8, point, { ext: { index: 0.7, middle: 0.3, ring: 0.3, pinky: 0.3 }, pinch: true });

describe('the rule table', () => {
  it('has one rule per behaviour, each labelled with its own behaviour', () => {
    for (const b of BEHAVIORS) expect(RULES[b].behavior).toBe(b);
    expect(Object.keys(RULES).sort()).toEqual([...BEHAVIORS].sort());
  });

  it('nail biting keeps the shipped numbers: mouth, five fingertips, 0.18 / 0.12 / 0.08, 600 ms = 3 frames', () => {
    expect(NAIL_BITING_RULE.zone).toBe('mouth');
    expect(NAIL_BITING_RULE.fingerFilter).toEqual([4, 8, 12, 16, 20]);
    expect(NAIL_BITING_RULE.distanceThreshold).toEqual({ low: 0.18, medium: 0.12, high: 0.08 });
    expect(NAIL_BITING_RULE.dwellMs).toBe(600);
    expect(NAIL_BITING_RULE.gesture).toBeUndefined();
    expect(framesForDwell(NAIL_BITING_RULE.dwellMs)).toBe(3);
    expect(FRAME_INTERVAL_MS).toBe(200);
  });

  it('cuticle and skin biting is the same mouth rule under another name', () => {
    expect({ ...CUTICLE_SKIN_BITING_RULE, behavior: 'nail_biting' }).toEqual(NAIL_BITING_RULE);
    expect(CUTICLE_SKIN_BITING_RULE.behavior).toBe('cuticle_skin_biting');
  });

  it('every other rule scales with sensitivity like the mouth does (low 1.5x, high 2/3)', () => {
    for (const rule of [NOSE_PICKING_RULE, EYE_AREA_PULLING_RULE, FACE_SKIN_PICKING_RULE, HAIR_PULLING_RULE]) {
      const t = rule.distanceThreshold;
      expect(t.low / t.medium, rule.behavior).toBeCloseTo(1.5, 10);
      expect(t.high / t.medium, rule.behavior).toBeCloseTo(2 / 3, 10);
    }
  });

  it('dwell turns into whole frames, never zero', () => {
    expect(framesForDwell(1)).toBe(1);
    expect(framesForDwell(1600)).toBe(8);
    expect(framesForDwell(2000)).toBe(10);
    expect(framesForDwell(3000)).toBe(15);
  });
});

describe('nose picking', () => {
  it('a fingertip in the nostril area is contact; the lips and the cheek are not', () => {
    expect(contact(NOSE_PICKING_RULE, [handAt(8, at('noseBase'))])).toBe(true);
    expect(contact(NOSE_PICKING_RULE, [handAt(20, at('noseBase', 3, 2))])).toBe(true);
    expect(contact(NOSE_PICKING_RULE, [handAt(8, at('mouth'))])).toBe(false);
    expect(contact(NOSE_PICKING_RULE, [handAt(8, at('cheekRight'))])).toBe(false);
  });

  it('only the index and little fingertips count', () => {
    expect(contact(NOSE_PICKING_RULE, [handAt(4, at('noseBase'))])).toBe(false);
    expect(contact(NOSE_PICKING_RULE, [handAt(12, at('noseBase'))])).toBe(false);
  });

  it('a little further away is contact on low sensitivity and not on medium; closer in, medium and not high', () => {
    // Distances are normalised x/y, so a step up the frame is longer than the same
    // step across it (4:3 camera): vertical reach here is about 21 / 14 / 9 px on low / medium / high.
    const p = at('noseBase', 0, -19);
    expect(contact(NOSE_PICKING_RULE, [handAt(8, p)], 'low')).toBe(true);
    expect(contact(NOSE_PICKING_RULE, [handAt(8, p)], 'medium')).toBe(false);
    const q = at('noseBase', 0, -12);
    expect(contact(NOSE_PICKING_RULE, [handAt(8, q)], 'medium')).toBe(true);
    expect(contact(NOSE_PICKING_RULE, [handAt(8, q)], 'high')).toBe(false);
  });
});

describe('eyelash and eyebrow pulling', () => {
  it('a pinch at an eye or a brow is contact', () => {
    expect(contact(EYE_AREA_PULLING_RULE, [pinchAt(at('browRight'))])).toBe(true);
    expect(contact(EYE_AREA_PULLING_RULE, [pinchAt(at('eyeLeft', 0, -4))])).toBe(true);
  });

  it('without a pinch it is not, even right on the eye', () => {
    const open = handAt(8, at('eyeRight'), { ext: { index: 1, middle: 1, ring: 1, pinky: 1, thumb: 1 } });
    expect(contact(EYE_AREA_PULLING_RULE, [open])).toBe(false);
  });

  it('a pinch at the mouth, the chin or the forehead is not', () => {
    expect(contact(EYE_AREA_PULLING_RULE, [pinchAt(at('mouth'))])).toBe(false);
    expect(contact(EYE_AREA_PULLING_RULE, [pinchAt(at('chinAnchor'))])).toBe(false);
    expect(contact(EYE_AREA_PULLING_RULE, [pinchAt(at('foreheadAnchor', 0, -30))])).toBe(false);
  });
});

describe('face skin picking', () => {
  /**
   * Feeds `n` frames of a fingertip wobbling around a point. `touching` is whether the fingertip is
   * in the zone on the last frame; `moving` is whether the rule's movement gate is open.
   */
  function wobble(point: [number, number], n: number, amp: [number, number], hz: number, sensitivity: DetectionSensitivity = 'medium') {
    const state = createRuleState();
    let touching = false;
    for (let i = 0; i < n; i++) {
      const phase = 2 * Math.PI * hz * ((i * 200) / 1000);
      const p: [number, number] = [point[0] + amp[0] * Math.sin(phase), point[1] + amp[1] * Math.sin(phase * 1.31 + 0.7)];
      touching = contact(FACE_SKIN_PICKING_RULE, [handAt(8, p)], sensitivity, state);
    }
    return { touching, moving: state.gate };
  }

  it('small repeated movement on the cheek, chin or forehead opens the gate once a window of frames has passed', () => {
    for (const where of ['cheekRight', 'cheekLeft', 'chinAnchor', 'foreheadAnchor'] as const) {
      expect(wobble(at(where), 8, [10, 8], 1.3), where).toEqual({ touching: true, moving: true });
      expect(wobble(at(where), 7, [10, 8], 1.3), `${where}, one frame short`).toEqual({ touching: true, moving: false });
    }
  });

  it('a resting fingertip touches but does not move (a hand propping the cheek)', () => {
    expect(wobble(at('cheekRight'), 12, [0.4, 0.4], 1.3)).toEqual({ touching: true, moving: false });
  });

  it('a big sweep across the face does not open the gate', () => {
    expect(wobble(at('cheekRight'), 12, [60, 40], 1.3).moving).toBe(false);
  });

  it('a fingertip away from the face neither touches nor moves', () => {
    expect(wobble([560, 420], 12, [10, 8], 1.3)).toEqual({ touching: false, moving: false });
  });

  it('losing contact clears the movement history', () => {
    const state = createRuleState();
    for (let i = 0; i < 7; i++) contact(FACE_SKIN_PICKING_RULE, [handAt(8, at('cheekRight', 8 * (i % 2 ? 1 : -1), 0))], 'medium', state);
    expect(state.trackCount).toBe(7);
    contact(FACE_SKIN_PICKING_RULE, [handAt(8, [600, 450])], 'medium', state);
    expect(state.trackCount).toBe(0);
  });
});

describe('hair pulling', () => {
  it('a pinch above the forehead is contact; the same pinch on the forehead or in front of the chest is not', () => {
    expect(contact(HAIR_PULLING_RULE, [pinchAt(at('scalpTop'))])).toBe(true);
    expect(contact(HAIR_PULLING_RULE, [pinchAt(at('scalpLeft'))])).toBe(true);
    expect(contact(HAIR_PULLING_RULE, [pinchAt(at('foreheadAnchor'))])).toBe(false);
    expect(contact(HAIR_PULLING_RULE, [pinchAt([320, 400])])).toBe(false);
  });

  it('an open hand in the hair is not (no pinch)', () => {
    const open = handAt(8, at('scalpTop'), { ext: { index: 1, middle: 1, ring: 1, pinky: 1, thumb: 1 } });
    expect(contact(HAIR_PULLING_RULE, [open])).toBe(false);
  });
});

describe('the mouth rules', () => {
  it('any fingertip near the lips is contact for both labels', () => {
    for (const rule of [NAIL_BITING_RULE, CUTICLE_SKIN_BITING_RULE]) {
      for (const tip of [4, 8, 12, 16, 20]) expect(contact(rule, [handAt(tip, at('mouth', 5, 3))])).toBe(true);
      expect(contact(rule, [handAt(8, at('foreheadAnchor'))])).toBe(false);
    }
  });
});
