// The per-frame detection engine: runs the zone rules of the behaviours being
// monitored over MediaPipe's landmarks and reports when an alarm should start
// or stop. src/hooks/biteDetector.ts (createBiteDetector) is the public face of
// this; the counting here is the shipped detector's, generalised to N rules.
//
// WITH ONE RULE it is the shipped detector, call for call (src/detection/
// equivalence.test.ts replays 120,000 random frames against a verbatim copy of
// the old one):
//   - a hit frame adds one to the rule's dwell counter, a miss resets it;
//   - once the counter reaches the rule's dwell, onBiteStart is called on EVERY
//     further hit frame (the caller dedupes);
//   - two misses in a row call onBiteEnd, and then again every two misses while
//     nothing is there (the caller dedupes that too);
//   - no usable video, or an exception anywhere in a frame, counts as a miss, so
//     a sounding alarm can always be stopped.
//
// WITH SEVERAL RULES each keeps its own dwell counter (and its own recent
// movement), while the miss counter is shared: an episode ends after two frames
// in which NO rule has contact. onBiteStart receives the behaviour whose dwell
// was met (and, for a movement rule, whose movement gate is open); if two are
// met on one frame it is called once for each, in registry order, and the caller
// (useDetection) lets the first one win the alarm.
//
// WS3 (false-alarm controls). `getControls` is optional and, when it returns null or is not given,
// everything below runs exactly as before: the only cost is one null check per frame. With controls
// (the `false_positive_controls` flag, set up by src/falsePositive) three things change, all of them
// only able to REMOVE or DELAY an alarm, never to add one: the hand filter drops hands before any
// rule sees them; the mouth rules ask judgeContact (chin rest, learned poses) about each hand that
// touches; and "Not a bite" can silence the alarm that is sounding. See controls.ts.

import type { DetectionSensitivity } from '../types';
import { BEHAVIORS, type Behavior, type Hand } from '../storage/eventModel.ts';
import {
  RULES,
  createRuleState,
  evaluateRule,
  fingertipContact,
  framesForDwell,
  resetRuleState,
  type RuleState,
  type ZoneRule,
} from './rules.ts';
import { ZONES, createResolvedZone, type ResolvedZone, type ZoneId } from './zones.ts';
import type { Landmark, LandmarkSource, VideoLike } from './types.ts';
import { handIsWatched, judgeContact, type DetectionControls } from './controls.ts';
import { extractPose, type PoseFeatures } from './pose.ts';
import { noteFire, takeSilenceRequest } from './controlsRegistry.ts';
import { sidesOf } from './handedness.ts';

export interface EngineOptions {
  getVideo: () => VideoLike | null;
  getSensitivity: () => DetectionSensitivity;
  source: LandmarkSource;
  /** The behaviours to watch for, read every frame. Defaults to nail biting alone. */
  getBehaviors?: () => readonly Behavior[];
  /** The false-alarm controls (WS3), read every frame. Null or absent: the engine behaves exactly as it always has. */
  getControls?: () => DetectionControls | null;
  /** Called on every frame once a rule's dwell is met; dedupe upstream. */
  onBiteStart: (behavior: Behavior) => void;
  /** Called once the episode has cleared. */
  onBiteEnd: () => void;
}

export interface Engine {
  /** Process one frame. `timestampMs` is a monotonic clock for MediaPipe. */
  step(timestampMs: number): void;
}

/** A zone resolved at most once per frame, however many rules read it. Shared by the rules of one engine. */
interface ZoneSlot {
  zone: ResolvedZone;
  /** The frame number the zone was last resolved for. */
  frame: number;
  resolve: (face: readonly Landmark[], out: ResolvedZone) => void;
}

interface ActiveRule {
  rule: ZoneRule;
  required: number;
  state: RuleState;
  slot: ZoneSlot;
  /** Controls only: the last frame's contact was entirely judged a chin rest (see judgeContact's hysteresis). */
  chinRest: boolean;
}

const NAIL_ONLY: readonly Behavior[] = ['nail_biting'];

// Consecutive negative frames required before calling the episode over.
export const REQUIRED_MISSES_TO_CLEAR = 2;

/** What judging one rule on one frame comes to when controls are on. */
interface ControlledResult {
  hit: boolean;
  /** Frames to wait on top of the rule's dwell (a pose like ones the person rejected). */
  extra: number;
  hand: Hand;
  pose: PoseFeatures | null;
}

const NO_POSE: ControlledResult = { hit: false, extra: 0, hand: 'unknown', pose: null };
const NO_SIDES: readonly (Hand | undefined)[] = [];
const oneHand: Landmark[][] = [[]];

/** Width over height of the picture, 4/3 when the source does not say (the app asks for 640x480). */
function aspectOf(video: VideoLike): number {
  const w = video.videoWidth;
  const h = video.videoHeight;
  return typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0 ? w / h : 4 / 3;
}

/**
 * One rule on one frame with the controls on. The mouth rules are judged hand by hand (which hand
 * touches, and in what pose); every other rule keeps its own evaluation over the hands that passed
 * the filter. Only called with at least one hand.
 */
function evaluateControlled(
  active: ActiveRule,
  hands: readonly Landmark[][],
  sides: readonly (Hand | undefined)[],
  face: readonly Landmark[],
  zone: ResolvedZone,
  sensitivity: DetectionSensitivity,
  state: RuleState,
  controls: DetectionControls,
  aspect: number,
  nowMs: number,
): ControlledResult {
  const rule = active.rule;
  if (rule.zone !== 'mouth' || rule.gesture) {
    const hit = evaluateRule(rule, hands, zone, sensitivity, state);
    return { hit, extra: 0, hand: hit && hands.length === 1 ? (sides[0] ?? 'unknown') : 'unknown', pose: null };
  }

  const threshold = rule.distanceThreshold[sensitivity] * zone.unit;
  let best: ControlledResult | null = null;
  let sawChinRest = false;
  for (let h = 0; h < hands.length; h++) {
    oneHand[0] = hands[h] as Landmark[];
    if (!fingertipContact(rule.fingerFilter, oneHand, zone, threshold)) continue;
    const pose = extractPose(hands[h], face, aspect);
    const side = sides[h] ?? 'unknown';
    // A pose that cannot be worked out is not a reason to stay quiet: the shipped rule decides.
    const verdict = pose === null ? null : judgeContact(pose, controls, nowMs, active.chinRest);
    if (verdict !== null && !verdict.ok) { if (verdict.reason === 'chin-rest') sawChinRest = true; continue; }
    const extra = verdict === null ? 0 : verdict.extraFrames;
    if (best === null || extra < best.extra) best = { hit: true, extra, hand: side, pose };
  }
  oneHand[0] = [];
  active.chinRest = best === null && sawChinRest;
  return best ?? NO_POSE;
}

export function createEngine(options: EngineOptions): Engine {
  const { getVideo, getSensitivity, source, getBehaviors, getControls, onBiteStart, onBiteEnd } = options;

  const slots = {} as Record<ZoneId, ZoneSlot>;
  for (const id of Object.keys(ZONES) as ZoneId[]) slots[id] = { zone: createResolvedZone(), frame: -1, resolve: ZONES[id].resolve };
  let frameNo = 0;

  // One runtime per behaviour, created on first use and kept.
  const runtimes = new Map<Behavior, ActiveRule>();
  const runtimeFor = (b: Behavior): ActiveRule => {
    let r = runtimes.get(b);
    if (!r) {
      r = { rule: RULES[b], required: framesForDwell(RULES[b].dwellMs), state: createRuleState(), slot: slots[RULES[b].zone], chinRest: false };
      runtimes.set(b, r);
    }
    return r;
  };

  let active: ActiveRule[] = [runtimeFor('nail_biting')];
  let lastWanted: readonly Behavior[] = NAIL_ONLY;

  let missedFrames = 0;
  const fired: ActiveRule[] = [];

  // Controls only. `alarmActive`: onBiteStart has been issued since the last onBiteEnd. `silenced`:
  // the person said "Not a bite" about the alarm that is sounding, so frames count as misses until
  // the hand has been away for REQUIRED_MISSES_TO_CLEAR frames.
  let alarmActive = false;
  let silenced = false;
  let silenceMisses = 0;

  /** Re-reads the wanted behaviours; the dwell of a rule survives unless the set of rules changes. */
  function refreshActive() {
    if (!getBehaviors) return;
    const wanted = getBehaviors();
    if (wanted === lastWanted) return;
    lastWanted = wanted;

    const next: ActiveRule[] = [];
    for (const b of BEHAVIORS) if (wanted.includes(b)) next.push(runtimeFor(b));
    const same = next.length === active.length && next.every((r, i) => r === active[i]);
    if (same) return;

    for (const r of runtimes.values()) resetRuleState(r.state);
    active = next;
  }

  function registerMiss() {
    for (let i = 0; i < active.length; i++) resetRuleState(active[i].state);
    missedFrames++;
    if (missedFrames >= REQUIRED_MISSES_TO_CLEAR) {
      alarmActive = false;
      onBiteEnd();
      missedFrames = 0;
    }
  }

  return {
    step(timestampMs: number) {
      const video = getVideo();

      // No usable frame: the stream stalled, ended, or another app took the
      // camera. This must count as a miss, not an early return: skipping the
      // accounting would leave an already-firing alarm with no way to stop.
      if (!video || video.readyState < 2) return registerMiss();

      try {
        const hands = source.detectHands(video, timestampMs) ?? [];
        const faces = source.detectFace(video, timestampMs + 0.1) ?? [];
        const sensitivity = getSensitivity();
        refreshActive();
        frameNo++;

        // WS3: null (the flag off, or nothing registered) = the path this file always had.
        const controls = getControls ? getControls() : null;
        let usable: readonly Landmark[][] = hands;
        let usableSides: readonly (Hand | undefined)[] = NO_SIDES;
        let aspect = 4 / 3;
        let nowMs = 0;
        if (controls !== null) {
          aspect = aspectOf(video);
          nowMs = controls.now ? controls.now() : Date.now();
          const sides = sidesOf(hands);
          if (controls.handFilter !== 'both') {
            const keptHands: Landmark[][] = [];
            const keptSides: Hand[] = [];
            for (let h = 0; h < hands.length; h++) {
              const side = sides?.[h];
              if (handIsWatched(controls.handFilter, side)) { keptHands.push(hands[h]); keptSides.push(side ?? 'unknown'); }
            }
            usable = keptHands;
            usableSides = keptSides;
          } else {
            usableSides = sides ?? NO_SIDES;
          }
          // Always consumed, acted on only while an alarm is active: a request with no alarm to silence is dropped here.
          if (takeSilenceRequest() && alarmActive) { silenced = true; silenceMisses = 0; }
        }

        let anyContact = false;
        let firedCount = 0;
        if (usable.length > 0 && faces.length > 0) {
          const face = faces[0];
          for (let i = 0; i < active.length; i++) {
            const r = active[i];
            const slot = r.slot;
            if (slot.frame !== frameNo) { slot.resolve(face, slot.zone); slot.frame = frameNo; }
            let hit: boolean;
            let extra = 0;
            let controlled: ControlledResult | null = null;
            if (controls === null) {
              hit = evaluateRule(r.rule, usable, slot.zone, sensitivity, r.state);
            } else {
              controlled = evaluateControlled(r, usable, usableSides, face, slot.zone, sensitivity, r.state, controls, aspect, nowMs);
              hit = controlled.hit;
              extra = controlled.extra;
            }
            if (hit) {
              anyContact = true;
              r.state.hits++;
              if (r.state.hits >= r.required + extra && r.state.gate) {
                fired[firedCount++] = r;
                if (controlled !== null && !alarmActive && !silenced && r.state.hits === r.required + extra) {
                  // The frame an alarm starts: tell the app which hand and what pose. A throw is swallowed: the alarm must sound whatever the app does with this.
                  try {
                    const info = { at: nowMs, behavior: r.rule.behavior, hand: controlled.hand, pose: controlled.pose };
                    noteFire(info);
                    controls?.onFire?.(info);
                  } catch { /* ignored */ }
                }
              }
            } else {
              // Only the dwell restarts. A movement rule keeps the recent contact points it
              // is still collecting (evaluateRule clears them itself when contact is lost).
              r.state.hits = 0;
            }
          }
        }

        // "Not a bite" was said about the alarm that is sounding: let it end, and keep it quiet until the hand has gone.
        if (silenced) {
          if (anyContact) silenceMisses = 0;
          else if (++silenceMisses >= REQUIRED_MISSES_TO_CLEAR) silenced = false;
          anyContact = false;
          firedCount = 0;
        }

        if (anyContact) {
          missedFrames = 0;
          for (let i = 0; i < firedCount; i++) { alarmActive = true; onBiteStart(fired[i].rule.behavior); }
        } else {
          registerMiss();
        }
      } catch {
        // Transient inference error. Also a miss: swallowing it outright would
        // wedge a firing alarm on indefinitely.
        registerMiss();
      }
    },
  };
}
