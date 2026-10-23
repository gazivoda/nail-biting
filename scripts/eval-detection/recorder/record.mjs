// DEV-ONLY landmark recorder. Served by the Vite dev server at
//   /scripts/eval-detection/recorder/record.html
// It is not imported by anything in src/, so `vite build` (whose only entry is index.html) never includes it.
//
// Runs MediaPipe with the same models and settings as the app (src/hooks/useDetection.ts), five times a
// second, and keeps ONLY the landmark numbers the rules read. No frame, picture, video or sound is stored
// or sent: the camera feed is shown in a <video> on this page and nowhere else. "Save" downloads a JSON
// file in the fixture format (scripts/eval-detection/README.md).

import { FaceLandmarker, FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { FACE_LANDMARKS_USED } from '../../../src/detection/zones.ts';
import { BEHAVIORS } from '../../../src/storage/eventModel.ts';
import { BEHAVIOR_REGISTRY } from '../../../src/detection/registry.ts';

const FRAME_MS = 200;
const $ = id => document.getElementById(id);
const round4 = v => Math.round(v * 10000) / 10000;
const pairs = list => list.map(p => [round4(p.x), round4(p.y)]);

// ── behaviour checkboxes ────────────────────────────────────────────────────
for (const b of BEHAVIORS) {
  const label = document.createElement('label');
  label.innerHTML = `<input type="checkbox" value="${b}"> ${BEHAVIOR_REGISTRY[b].label} (<code>${b}</code>)`;
  $('behaviors').append(label);
}
const chosenBehaviors = () => [...document.querySelectorAll('#behaviors input:checked')].map(i => i.value);

// ── state ───────────────────────────────────────────────────────────────────
let hand = null;
let face = null;
let timer = null;
let recording = false;
let frames = [];
let labels = [];
let openEvent = null;
let previousFaceKey = 'unset';
let handsSeen = 0;
let facesSeen = 0;

const video = $('video');

function status() {
  const secs = (frames.length * FRAME_MS / 1000).toFixed(1);
  $('status').textContent = recording
    ? `Recording: ${secs} s, ${frames.length} frames (hand seen in ${handsSeen}, face in ${facesSeen}), ${labels.length} event(s)${openEvent ? ', event running' : ''}.`
    : frames.length > 0 ? `Stopped: ${secs} s, ${frames.length} frames, ${labels.length} event(s). Save, or Record to start over.` : 'Not recording.';
}

// ── camera and models, set up exactly like the app ──────────────────────────
$('start').addEventListener('click', async () => {
  $('start').disabled = true;
  $('load').textContent = 'Starting the camera and loading the models...';
  try {
    video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    await video.play();
    const vision = await FilesetResolver.forVisionTasks('/mediapipe-wasm');
    hand = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: '/mediapipe-models/hand_landmarker.task' },
      runningMode: 'VIDEO', numHands: 1,
      minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.4, minTrackingConfidence: 0.4,
    });
    face = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: '/mediapipe-models/face_landmarker.task' },
      runningMode: 'VIDEO', numFaces: 1,
      minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.4, minTrackingConfidence: 0.4,
    });
    $('load').textContent = 'Ready.';
    $('record').disabled = false;
    timer = setInterval(tick, FRAME_MS);
  } catch (error) {
    $('load').textContent = `Could not start: ${error.message}`;
    $('start').disabled = false;
  }
});

function tick() {
  if (!hand || !face || video.readyState < 2) return;
  const now = performance.now();
  const hands = hand.detectForVideo(video, now).landmarks ?? [];
  const faces = face.detectForVideo(video, now + 0.1).faceLandmarks ?? [];
  if (!recording) return;

  const frame = { t: frames.length * FRAME_MS, hands: hands.map(pairs) };
  const faceList = faces[0] ? pairs(FACE_LANDMARKS_USED.map(i => faces[0][i])) : null;
  const key = JSON.stringify(faceList);
  if (key !== previousFaceKey) frame.face = faceList; // an absent key means "same as the last frame"
  previousFaceKey = key;
  if (hands.length > 0) handsSeen++;
  if (faces.length > 0) facesSeen++;
  frames.push(frame);
  status();
}

// ── controls ────────────────────────────────────────────────────────────────
$('record').addEventListener('click', () => {
  frames = []; labels = []; openEvent = null; previousFaceKey = 'unset'; handsSeen = 0; facesSeen = 0;
  recording = true;
  $('record').disabled = true; $('stop').disabled = false; $('event').disabled = false; $('save').disabled = true;
  status();
});

function toggleEvent() {
  if (!recording) return;
  const t = frames.length * FRAME_MS;
  if (!openEvent) {
    const behaviors = chosenBehaviors();
    if (behaviors.length === 0) { $('status').textContent = 'Tick the behaviour(s) in step 3 first.'; return; }
    openEvent = { behaviors, startMs: t };
    $('event').textContent = 'End event (space)';
  } else {
    labels.push({ ...openEvent, endMs: t });
    openEvent = null;
    $('event').textContent = 'Start event (space)';
  }
  status();
}
$('event').addEventListener('click', toggleEvent);
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); toggleEvent(); }
});

$('stop').addEventListener('click', () => {
  if (openEvent) toggleEvent();
  recording = false;
  $('record').disabled = false; $('stop').disabled = true; $('event').disabled = true; $('save').disabled = frames.length === 0;
  status();
});

// ── saving ──────────────────────────────────────────────────────────────────
export function buildFixtureText() {
  const id = $('id').value.trim();
  if (!/^[a-z0-9_]+$/.test(id)) throw new Error('The id must be lower_snake_case: letters, digits and underscores.');
  const extra = $('tags').value.split(',').map(s => s.trim()).filter(Boolean);
  const header = {
    format: 'stop-biting-landmark-fixture',
    version: 1,
    id,
    description: $('description').value.trim(),
    source: 'real',
    tags: [labels.length > 0 ? 'positive' : 'negative', ...extra],
    image: { width: video.videoWidth || 640, height: video.videoHeight || 480 },
    frameIntervalMs: FRAME_MS,
    faceIndices: [...FACE_LANDMARKS_USED],
    labels,
  };
  const head = Object.entries(header).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n');
  const lines = frames.map(f => '    ' + JSON.stringify(f)).join(',\n');
  return `{\n${head},\n  "frames": [\n${lines}\n  ]\n}\n`;
}

$('save').addEventListener('click', () => {
  try {
    const text = buildFixtureText();
    window.__lastFixtureText = text; // handy for scripted checks; it is the same text as the download
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${$('id').value.trim()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    $('status').textContent = `Saved ${a.download}. Move it to scripts/eval-detection/fixtures/real/ and run: npm run eval:detection`;
  } catch (error) {
    $('status').textContent = error.message;
  }
});

window.addEventListener('beforeunload', () => { if (timer) clearInterval(timer); });
