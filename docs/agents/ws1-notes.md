# WS1 (Detect more behaviors) — notes

Short version for the owner and for WS13 (release notes). The reference is `docs/agents/ARCHITECTURE.md` (section 2
has a WS1 update) and `scripts/eval-detection/README.md`.

## What exists

- **Zone rules** in `src/detection/`: `zones.ts` (face-mesh zones), `rules.ts` (a `ZoneRule` per behaviour: zone,
  finger filter, distance threshold per sensitivity, dwell, optional pinch or repeated-movement gesture), `registry.ts`
  (label, description, and the `validated | experimental` level per behaviour), `engine.ts` (the frame loop that runs
  the selected rules). `src/hooks/biteDetector.ts` keeps all its old exports and delegates to the engine.
- **Six behaviours**: `nail_biting`, `cuticle_skin_biting`, `nose_picking`, `eye_area_pulling`, `face_skin_picking`,
  `hair_pulling` (the schema's list). Cuticle/skin biting is the *same mouth rule* as nail biting under another name, so
  the two are mutually exclusive in the list (turning one on turns the other off).
- **Settings > Behaviors** (`src/pages/settings/sections/BehaviorsSection.tsx`): a switch per behaviour. Default
  selection is nail biting alone, stored under `kv('detection', 'behaviors')`.
- **Every alarm records its behavior**: `CameraView.handleAlert` calls `logIncident('auto-detected', true, { behavior })`.
  The store's 30 s episode merge was already per behaviour (WS0); `src/detection/alarmLogging.test.ts` pins it.
- **History filter** (`src/pages/Log.tsx`, `src/utils/insights.ts`): a segmented control (All plus the behaviours that are
  in the history) that filters the list, the chart, the summary and the insights.
- **Evaluation harness** `scripts/eval-detection/` and `npm run eval:detection`, with 30 committed synthetic fixtures
  (landmarks only), a deterministic generator, precision and recall per rule at three sensitivities, and
  `docs/agents/ws1-eval-report.md` (generated, labelled SYNTHETIC). A dev-only recorder for the owner's real fixtures.
- **Tests**: 61 golden tests that pin the old nail-biting behaviour, a 120,000-frame frame-by-frame equivalence test
  against a verbatim copy of the old detector (`src/detection/__reference__/legacyBiteDetector.ts`; run both without
  `getBehaviors`, as the landing demo builds it, and with a fresh `['nail_biting']` array each frame, as the app builds
  it), rule, zone,
  registry, engine, selection and Settings/History render tests, and 32 harness tests.

## Nothing changes for anyone until you turn it on

| Flag (`FEATURE_FLAGS=` on the server, restart, no rebuild) | What it does |
|---|---|
| `detection_behaviors` | shows Settings > Behaviors and lets the detector run a selection other than nail biting; shows the History filter when more than one behaviour is in the history |
| `experimental` (needs `detection_behaviors`) | also lists the four behaviours that have no real-footage validation |

With both off, the detector runs nail biting alone whatever is stored (`effectiveBehaviors()` in `registry.ts`), the
Settings page and History render the same markup as before, and nothing new is requested from the server on the Watch
tab. Only for a device whose user already chose a non-default selection does the Watch tab ask for fresh flags (at most
every ten minutes, `ensureFlags`), so switching a flag off on the server reaches a device that is already detecting.

To try it locally: `?ff=detection_behaviors,experimental` on the Vite dev server (see ARCHITECTURE.md section 5), then
Settings > Behaviors.

## Validated vs experimental, honestly

Per `docs/agents/SWARM_RULES.md` only synthetic fixtures exist, so:

- `nail_biting` and `cuticle_skin_biting` are `validated`. That means: the rule is the one that shipped, unchanged
  (proved frame by frame against the old code), and it holds its numbers on the synthetic fixtures. It does **not** mean
  anyone measured it on real people. On the synthetic set at medium sensitivity it finds 7 of 7 events and its
  precision is 0.33, because the set contains scenes drawn to fool it (chin rest, drinking, covering a yawn, a fingertip
  at the nose). That is the false-alarm problem the site already warns about; WS3 is meant to reduce it, and the bar in
  `thresholds.json` is a ratchet just under today's number.
- `nose_picking`, `eye_area_pulling`, `face_skin_picking`, `hair_pulling` are `experimental`: the thresholds are first
  guesses, the zones are estimated from the face mesh, and none of them has seen real footage. The Behaviors card says so
  in words. Their synthetic scores (precision 0.43 to 1.00) are not evidence of anything about real people.
- **No marketing page may mention a new behaviour** (plan rule 4). Nothing on the site was changed.

## What you (owner) do to get a behaviour validated

1. Run the dev server (`npx vite --port 5201`) and open
   `http://localhost:5201/scripts/eval-detection/recorder/record.html`. It records **landmark numbers only** (never video
   or images) and downloads a JSON file. See `scripts/eval-detection/README.md`.
2. Record the behaviour several times (the thing itself, held, with the hand leaving and returning) and the things it
   must not fire on (chin or cheek resting on the hand, scratching, drinking, talking with your hands, adjusting glasses
   or hair, yawning). Save them in `scripts/eval-detection/fixtures/real/` (git-ignored by default: they are the shape
   of your face).
3. Edit `scripts/eval-detection/thresholds.json`: the bars (`minPrecision`, `minRecall`) and
   `promotion.minRealEvents` (default 10 labelled real events per rule). Run `npm run eval:detection`. A rule is
   "promotable" when the real fixtures alone meet its bar.
4. If the numbers are close, tune the rule in `src/detection/rules.ts` (distances are in face widths, 0.11 to 0.24).
5. Only then change the behaviour's `validation` to `'validated'` in `src/detection/registry.ts` and update the list in
   `src/detection/registry.test.ts` and `scripts/eval-detection/eval.test.mjs`.

## Seams in shared files (name them in review)

- `src/hooks/useDetection.ts`: **one seam**: an optional trailing `behaviors` parameter (held in a ref, passed to the
  detector as `getBehaviors`), and `onAlert` now receives the behaviour (`startBiting(behavior)`). 17 lines changed, most of
  them comments. The loop,
  scheduling and Picture-in-Picture are untouched. The notification text still says "Nail biting detected" whatever
  fired (copy, left for whoever owns it).
- `src/components/detection/CameraView.tsx`: `handleAlert` (the seam ARCHITECTURE.md section 12 names) passes
  `{ behavior }`; one hook call (`useActiveBehaviors`).
- `src/pages/Log.tsx` (the filter, `incidents` renamed locally to the filtered list; with the flag off it is the store's
  own array), `src/utils/insights.ts` (`behaviorsIn`, `filterByBehavior`).
- `src/pages/settings/settings.test.tsx`: one flag removed from the "sections are empty" test, because Behaviors now has
  content. WS2/WS3/WS4/WS7a/WS10 will each touch that same line when their section gets content.
- `package.json`: one line (`eval:detection`). `docs/agents/ARCHITECTURE.md`: two small edits (section 2 and 12).
- Not touched: `AlertOverlay.tsx`, `PiPWindow.tsx`, `usePictureInPicture.ts`, `server.js`, `server/**`, the event schema and
  storage modules (the selection goes through `kv`, namespace `detection`, which WS0 reserved for WS1).

## Decisions and things you might trip over

- **Selection is in `kv`, not `settings`.** The storage module's `settings` object only owns the core fields the
  store already persists; ARCHITECTURE.md section 4 sends new settings to `kv`.
- **Dwell is counted in frames**, as before (3 hits in a row, "about 600 ms at 5 fps"). `dwellMs` in a rule becomes
  frames at the nominal 200 ms. When the tab is hidden the loop runs slower and the same frame counts take longer; that
  is existing behaviour (WS7a's area).
- **Zones are measured in normalised x and y**, as the mouth rule always was, so on a 4:3 camera a vertical step is
  longer than the same step sideways, and on 16:9 the zones are not round. The new zones are in face widths (the scalp in
  face heights), so they scale with distance from the camera and with head tilt.
- **One alarm at a time.** `useDetection` keeps one alarm until the hand is away; while it sounds for one behaviour a
  second behaviour starting is part of the same alarm and is not logged separately.
- **`numHands: 1`** is unchanged (the models are configured exactly as before). Two-handed scenes are fixtures only.
- **Face-mesh indices.** The lip, eye, brow and face-oval indices were read out of MediaPipe's own exported sets
  (`FaceLandmarker.FACE_LANDMARKS_*`); `zones.ts` says which. **NEEDS HUMAN VERIFICATION:** the nose indices (1, nose tip;
  2, the point under it) are not in any exported set and were not checked against a rendered mesh. To dump the sets:
  `import('@mediapipe/tasks-vision/vision_bundle.mjs')` after `globalThis.self = globalThis`, then read
  `FaceLandmarker.FACE_LANDMARKS_LIPS` and friends (each is a list of `{start, end}`).
- The scalp zone is **estimated** above the top of the face mesh, so hair pulling needs the camera framed high enough to
  see the top of the head.
- **Bundle**: +13 KiB raw across chunks (precache 1219 to 1232 KiB, two new shared chunks); the landing demo loads about
  7 KB more JavaScript when a visitor starts it. The dev recorder, the synthetic generator and the fixtures are not in
  `dist/` (checked with grep).

## CPU cost

Per frame, rules only, Node 24 on this Mac (`node scripts/eval-detection/bench.mjs`, medians of 7 rounds of a million
frames, each variant in its own process):

| variant | ns per frame | vs old |
|---|---|---|
| old detector (verbatim reference) | 19 | |
| new engine, nail biting alone (the default) | 31 | +12 ns (+62 percent of 19 ns) |
| new engine, all six behaviours | 172 | +153 ns |

The rule evaluation itself is a little over half again as expensive for the default; in absolute terms that is 12
nanoseconds against a 200 ms frame slot (6e-6 percent). **MediaPipe inference is what takes the time and it is
unchanged.** Measured with real MediaPipe in headless Chrome on a fake camera (no person in frame, which is the
detectors' most expensive state), whole frames, variants chosen at random per frame, about 120 frames each: old
detector 23.2 ms mean, new nail-only 23.2 ms, new all-six 23.3 ms, of which inference was 23.2 ms; the difference is
inside the noise. So the plan's "no more than about 20 percent higher" holds for the frame; for the rule code alone the
relative figure is higher but it is nanoseconds.

## Not verified here

- Anything on a real camera or real hands: no real-footage numbers exist, which is the point of "experimental".
- The recorder was exercised end to end in headless Chrome on a fake camera (models load, frames are recorded, the file
  downloads, and the file parses and replays with the Node loader); it has not seen a real hand or face.
- Settings and History were checked by rendering in node (and byte comparison of the History markup with the flag off),
  not by a click-through in a browser.

## Owner TODOs

- Record real fixtures and set the bars (above). Decide what precision you want before any behaviour is promoted.
- Decide when to flip `detection_behaviors`. It needs no env var other than `FEATURE_FLAGS`; no `.env.example` change.
- Nose landmarks 1 and 2: confirm on a rendered mesh.
