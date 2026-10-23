NEEDS HUMAN REVIEW

# WS3 draft: Privacy Policy wording for "Not a bite", learned poses and the calibration

Status: DRAFT. Not published. `src/pages/PrivacyPage.tsx` has not been edited. Publish this together with turning on the
`false_positive_controls` flag, not before. The statements under "What the code does" are checked against the code and
tests; the wording under "Suggested text" is for the owner or a lawyer to adapt.

## What the code does (facts to check the wording against)

- **Pose features.** When you tap "Not a bite" on an alarm, the app keeps six small numbers describing where your hand was
  when that alarm started: which part of the hand was nearest your lips (a fingertip, a finger joint, a knuckle or the
  palm), how far the nearest fingertip was from your lips, how far the nearest knuckle or palm point was from your chin
  (both as a fraction of your face's width), the direction the hand pointed, how closed the hand was, and where the palm
  was relative to your mouth. It also keeps when that happened and which History entry it was about.
- **What it is not.** It is not a picture, a video, a frame, or the hand and face landmarks the camera model produces. No
  landmark is stored. The six numbers cannot be turned back into an image.
- **Where it lives.** In your browser's local storage on the device you are using (keys starting `sb:falsePositive:`).
  It is **not** a field of your history entry, is not in the history export file, is **not synced** (the sync sends only the
  history entry fields) and is not sent to any server. Tests pin this (`src/falsePositive/localOnly.test.ts`,
  `scripts/falsePositiveGuards.test.mjs`).
- **How long, how much.** At most 40 rejected poses, each forgotten after 30 days; at most 30 recent alarm poses, forgotten
  after 7 days; one calibration, kept until you delete it. Undoing "Not a bite", deleting the entry, or saying "this was a
  bite" forgets that tap's pose at once.
- **Your controls.** Settings > Detection: "Forget what it learned" (asks first), "Delete calibration" (one click), the hand
  filter and the chin-rest switch. Clearing your browser's site data removes everything.
- **Calibration.** Optional. While it runs the camera shows you your own picture on the screen, and the app's watching is
  paused. Nothing is recorded: the app keeps at most 12 + 12 distinct pose summaries (six numbers each) and two distances.
  The camera stream is stopped when the view closes.
- **The hand.** With the feature on, an alarm's History entry may also record which hand (left or right, as you see it, or
  unknown) was at your mouth. That is an ordinary field of the history entry, so it syncs with your history if you turn
  sync on, like the rest of an entry.
- **"Not a bite" itself** is an ordinary field of the history entry (`falsePositive`): it syncs with your history if you
  turn sync on, like a trigger tag. A marked alarm is not counted anywhere.
- **Network.** The feature makes no network request of its own. (Reading the list of feature flags, which every signed-in
  page does, is unchanged.)

## Suggested text (adapt, do not paste blindly)

> **What the app learns when you say "Not a bite".** If you mark an alarm "Not a bite", the app remembers a few numbers
> about where your hand was at that moment, so it can be more careful with a similar position next time. These are numbers
> such as how far a fingertip was from your lips as a fraction of your face's width. They are not a picture or a video, and
> the app cannot rebuild a picture from them. They are kept in your browser on this device for up to 30 days, are not part of
> your history, are not synced to your account and are not sent to us. You can erase them any time in Settings, under
> Detection, and they go when you clear this site's data in your browser. The optional one-minute calibration keeps a few
> more numbers of the same kind, until you delete it.

> The "Not a bite" mark itself, and which hand was at your mouth, are part of the entry in your history, the same as a
> trigger tag. If you turn on sync they are synced with the rest of that entry.

## Checks for the owner

- The text above must stay consistent with the approved line used elsewhere: "Detection runs on your device. No camera data
  is sent while it runs." Do not write "nothing leaves your device", "100% private" or "no cloud, no server": sign-in,
  payments and (when on) opt-in sync do use the network.
- Decide whether the 30-day and 7-day lifetimes are what you want to promise in the policy (they are constants:
  `CONTROLS_CONFIG.learned.ttlDays`, `ALARM_POSE_LIMITS.ttlDays`).
- The Settings card and the calibration view carry the same promise in one sentence each ("they are not part of your
  history, are not synced and are not uploaded"). If the policy wording changes, change those two sentences
  (`src/falsePositive/DetectionSettings.tsx`, `src/calibration/CalibrationView.tsx`) in the same release.
- If WS4's sync is ever extended past the HabitEvent fields, this feature's data must stay out of it.
