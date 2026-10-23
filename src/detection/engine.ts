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

import type { DetectionSensitivity } from '../types';
import { BEHAVIORS, type Behavior } from '../storage/eventModel.ts';
import {
  RULES,
  createRuleState,
  evaluateRule,
  framesForDwell,
  resetRuleState,
  type RuleState,
  type ZoneRule,
} from './rules.ts';
import { ZONES, createResolvedZone, type ResolvedZone, type ZoneId } from './zones.ts';
import type { Landmark, LandmarkSource, VideoLike } from './types.ts';

export interface EngineOptions {
  getVideo: () => VideoLike | null;
  getSensitivity: () => DetectionSensitivity;
  source: LandmarkSource;
  /** The behaviours to watch for, read every frame. Defaults to nail biting alone. */
  getBehaviors?: () => readonly Behavior[];
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
}

const NAIL_ONLY: readonly Behavior[] = ['nail_biting'];

// Consecutive negative frames required before calling the episode over.
export const REQUIRED_MISSES_TO_CLEAR = 2;

export function createEngine(options: EngineOptions): Engine {
  const { getVideo, getSensitivity, source, getBehaviors, onBiteStart, onBiteEnd } = options;

  const slots = {} as Record<ZoneId, ZoneSlot>;
  for (const id of Object.keys(ZONES) as ZoneId[]) slots[id] = { zone: createResolvedZone(), frame: -1, resolve: ZONES[id].resolve };
  let frameNo = 0;

  // One runtime per behaviour, created on first use and kept.
  const runtimes = new Map<Behavior, ActiveRule>();
  const runtimeFor = (b: Behavior): ActiveRule => {
    let r = runtimes.get(b);
    if (!r) {
      r = { rule: RULES[b], required: framesForDwell(RULES[b].dwellMs), state: createRuleState(), slot: slots[RULES[b].zone] };
      runtimes.set(b, r);
    }
    return r;
  };

  let active: ActiveRule[] = [runtimeFor('nail_biting')];
  let lastWanted: readonly Behavior[] = NAIL_ONLY;

  let missedFrames = 0;
  const fired: ActiveRule[] = [];

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

        let anyContact = false;
        let firedCount = 0;
        if (hands.length > 0 && faces.length > 0) {
          const face = faces[0];
          for (let i = 0; i < active.length; i++) {
            const r = active[i];
            const slot = r.slot;
            if (slot.frame !== frameNo) { slot.resolve(face, slot.zone); slot.frame = frameNo; }
            if (evaluateRule(r.rule, hands, slot.zone, sensitivity, r.state)) {
              anyContact = true;
              r.state.hits++;
              if (r.state.hits >= r.required && r.state.gate) fired[firedCount++] = r;
            } else {
              // Only the dwell restarts. A movement rule keeps the recent contact points it
              // is still collecting (evaluateRule clears them itself when contact is lost).
              r.state.hits = 0;
            }
          }
        }

        if (anyContact) {
          missedFrames = 0;
          for (let i = 0; i < firedCount; i++) onBiteStart(fired[i].rule.behavior);
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
