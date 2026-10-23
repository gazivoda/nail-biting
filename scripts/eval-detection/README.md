# Detection evaluation (`scripts/eval-detection`)

Replays recorded **landmark** sequences through the app's own detection engine and prints precision and recall for each
rule. Plain Node ES modules, no dependencies. It imports the TypeScript in `src/detection` directly (Node strips the
types; Node 22.18 or newer, the repo uses 24), so it tests the rules that ship, not a copy.

```
npm run eval:detection                                   # table; exit 1 if a validated rule is below its bar
npm run eval:detection -- --report docs/agents/ws1-eval-report.md
npm run eval:detection -- --controls-report docs/agents/ws3-eval-report.md   # the false-alarm controls, before and after
npm run eval:detection -- --sensitivity high             # gate on another sensitivity
npm run eval:detection -- --json
node scripts/eval-detection/generate-fixtures.mjs        # rewrite the synthetic fixtures from scenes.mjs
node scripts/eval-detection/generate-fixtures.mjs --check
node scripts/eval-detection/bench.mjs                    # CPU cost of the rules per frame
```

## What is, and is not, in a fixture

**Landmarks only**: numbers. For every frame: a timestamp, the 21 hand landmarks of each hand MediaPipe found, and the
face-mesh landmarks the rules read. **Never video, never images, never audio.** A fixture is still the shape of one
person's face and hands, so treat a recording of a real person as personal data: `fixtures/real/*.json` is git-ignored;
commit one only on purpose, with the person's agreement.

## Fixture format (version 1)

One JSON file per recording, in `fixtures/` (synthetic, committed) or `fixtures/real/` (recorded, not committed by
default). Files are written one frame per line so they diff well.

```jsonc
{
  "format": "stop-biting-landmark-fixture",
  "version": 1,
  "id": "mouth_bite_steady",              // lower_snake_case, unique, same as the file name
  "description": "Thumb and index held at the lips for 4.6 s",
  "source": "synthetic",                  // "synthetic" or "real"
  "tags": ["positive", "mouth"],          // see "Tags"
  "knownIssue": "optional: where a rule is expected to be wrong, and why",
  "generator": { "script": "...", "scene": "...", "seed": 1101 },   // synthetic only
  "image": { "width": 640, "height": 480 },     // landmarks are normalised 0..1 by these
  "frameIntervalMs": 200,                 // must be 200: the app detects at 5 frames per second
  "faceIndices": [1, 2, 10, 13, ...],     // which face-mesh landmarks each "face" lists, in order
  "labels": [                             // what a rule SHOULD find; [] for a fixture with nothing to find
    { "behaviors": ["nail_biting", "cuticle_skin_biting"], "startMs": 2400, "endMs": 7000 }
  ],
  "frames": [
    { "t": 0,   "hands": [], "face": [[0.5,0.3], ...] },                 // first frame must give "face"
    { "t": 200, "hands": [ [[x,y] x 21], ... ] },                        // "face" absent = same as the previous frame
    { "t": 400, "hands": [], "face": null }                              // null = no face detected
  ]
}
```

- `hands`: a list of hands, each exactly 21 `[x, y]` pairs in MediaPipe's order (0 wrist, 4 thumb tip, 8 index tip,
  12 middle tip, 16 ring tip, 20 little tip). The app runs MediaPipe with `numHands: 1`, so a real recording has at most
  one; the engine accepts more.
- `face`: one `[x, y]` per entry of `faceIndices`, in that order, MediaPipe face-mesh indices (0 to 477). `faceIndices`
  must include every index the zones read (`FACE_LANDMARKS_USED` in `src/detection/zones.ts`); the loader says which one
  is missing. Coordinates are what MediaPipe returns: x and y as fractions of the frame, **not** mirrored.
- `labels`: an interval in which an alarm for any of `behaviors` is **correct**. Label from when the behaviour starts to
  when it ends, not from when you expect the alarm. A hand at the mouth is correct for both `nail_biting` and
  `cuticle_skin_biting`, so list both. Anything not inside a label that makes a rule alarm is a false alarm.
- `t`: milliseconds, strictly increasing, 200 apart in a real recording.

## How the numbers are worked out (`lib/score.mjs`)

Each rule is run **alone** over every fixture, at each sensitivity, the way `useDetection` drives it (one alarm until it
stops). An *alarm* is what a person would hear. An alarm is *correct* if it starts inside a label that lists that rule's
behaviour (up to `graceMs` after the label ends); otherwise it is a *false alarm*. A label is *found* if a correct alarm
falls in it.

- **precision** = correct alarms / all alarms
- **recall** = labels found / all labels

A fingertip at the nose is inside the mouth rule's reach, so a nose-picking fixture counts as a false alarm for
`nail_biting`. That is true of the shipped rule, and the report shows it; "own scenes" columns count only the fixtures
tagged for a rule's own family (`FAMILY_TAG` in `lib/evaluate.mjs`).

## Thresholds (`thresholds.json`, yours to edit)

| key | meaning |
|---|---|
| `gateSensitivity` | the sensitivity judged by the exit code (`medium`, the default) |
| `graceMs` | how long after a label ends an alarm still counts as correct |
| `rules.<behavior>.minPrecision`, `.minRecall` | the bar for that rule |
| `promotion.minRealEvents` | labelled events from **real** fixtures a rule needs before it can be promoted |

The command **exits 1 only when a rule marked `validated` in `src/detection/registry.ts` is below its bar.** Experimental
rules are reported against their bar and never fail the command. The two validated bars are a ratchet: just under what
the unchanged nail-biting rule scores on the committed fixtures (they include scenes drawn to fool it). Raise
`minPrecision` when a change really improves it (WS3 should).

## The false-alarm controls (WS3): three ways to play the same fixtures

Everything above is the shipped detector (the `false_positive_controls` flag OFF). `npm run eval:detection` also plays
the fixtures with the controls on, and prints and gates both:

| variant | what it is | fixtures | bar in `thresholds.json` |
|---|---|---|---|
| `shipped` | the flag off: the detector that has always shipped | every fixture except `sequence` | `rules.<behavior>` |
| `controls` | the flag on, a person who has not yet tapped "Not a bite": the chin-rest rule, both hands | the same | `withControls.<behavior>` |
| `learning` | as `controls`, and a simulated person who taps "Not a bite" after every false alarm (judged by the fixture's own labels), so the pose is remembered | only the `sequence` fixtures (one pose five times, then a real bite) | `withLearning.<behavior>` |

Plus the plan's acceptance line, checked in the same command: fewer false alarms on the `chin-rest-rule` fixtures, and
recall no more than `controlsMaxRecallDrop` (5 points) below the shipped detector's.

- The `withControls` / `withLearning` precision bars are a ratchet set just under what was measured when WS3 landed.
  Raise them when the controls improve. Never lower one to make a change pass.
- Fixtures tagged `ws3` are WS3's (`scenes-ws3.mjs`). `chin-rest-rule` marks the scenes drawn to match the rule (the
  back of the hand or the knuckles on the chin, no fingertip near the lips); `hand-near-chin` marks real bites with the
  palm close to the chin and a fingertip at the lips, which the rule must leave alone. The older `neg_chin_rest` and
  `neg_cheek_rest_thinking` are drawn with the fingers along the jaw and the palm far from the chin, so the rule rightly
  does not touch them; they are what the learning is for.
- A `real` recording of a chin rest goes in `fixtures/real/` with the tags `negative`, `mouth`, `chin-rest-rule`, and
  counts in both variants like any other.
- `bench.mjs` has `controls` and `controls+40` variants: the rules' cost per frame with the flag on, and with 40
  remembered poses to compare against.

## Adding a real recording, and promoting a rule (owner)

1. Record with the dev recorder (below) or write the JSON yourself. Aim for a handful of each, per behaviour: the thing
   itself, held for several seconds and several times; and the things it must not fire on (resting your chin or cheek on
   your hand, scratching, drinking, talking with your hands, adjusting glasses or hair, yawning). Vary the light, the
   distance and the sensitivity you would really use.
2. Save to `scripts/eval-detection/fixtures/real/<id>.json` and run `npm run eval:detection`. The report lists real and
   synthetic fixtures separately for promotion.
3. A rule is **promotable** when the fixtures with `"source": "real"` alone contain at least `promotion.minRealEvents`
   labelled events for it and meet its `minPrecision` and `minRecall`. The table says "can be promoted".
4. Only then change `validation: 'experimental'` to `'validated'` for that behaviour in `src/detection/registry.ts` (and
   nothing else can: `registry.test.ts` pins the list, update it in the same commit). Tune the rule's thresholds in
   `src/detection/rules.ts` first if the numbers are close. A behaviour is **not** to be advertised on the website until
   this has been done (docs/agents/PLAN.md, rule 4).

## Dev recorder

`recorder/record.html` is a page for **you** to record fixtures in your own browser. It is not part of the app: it is
not imported by anything in `src/`, `vite build` only bundles `index.html`, and `dist/` never contains it. Run the Vite
dev server (`npx vite --port 5201`) and open `http://localhost:5201/scripts/eval-detection/recorder/record.html`. It runs
MediaPipe with the same models and settings as the app, shows the camera to you, and keeps **only the landmark numbers**.
Nothing is uploaded; "Save" downloads the JSON file. Choose what you are doing, press **Start event** when it begins and
**End event** when it ends (or the space bar), press **Stop** and **Save fixture**; a recording with no events is a
negative.

## Files

```
run.mjs                  the command (table, exit code, --report)
bench.mjs                CPU cost of rule evaluation per frame, before vs after WS1 and with the WS3 controls on
generate-fixtures.mjs    scenes.mjs -> fixtures/*.json (deterministic)
scenes.mjs               the synthetic scenes (positives and hard negatives) as data
scenes-ws3.mjs           WS3's scenes: chin rests, bites near the chin, and repeated-pose sequences
thresholds.json          your bars
lib/fixtures.mjs         read, check and write fixtures
lib/replay.mjs           play one through src/detection/engine.ts (shipped, controls, or controls + simulated taps)
lib/score.mjs            precision and recall
lib/evaluate.mjs         every rule x every fixture x every sensitivity, and the gate
lib/report.mjs           the table and the markdown report
lib/controlsReport.mjs   the WS3 comparison (console and docs/agents/ws3-eval-report.md)
recorder/                the dev-only recorder
fixtures/                synthetic fixtures (committed); fixtures/real/ for yours (git-ignored)
```

The synthetic face and hand come from `src/detection/synthetic.ts`. They are a neutral set of proportions and a stick
model of a hand, **not** measured from anyone. A good result on them means "the rule does what its author imagined".
