#!/usr/bin/env bash
# Builds a PROBE copy of the app in a scratch directory, so the privacy audit can exercise the alarm path with
# real landmark data in the page (WS7a's measurement hook: `window.__sbProbe.inject = true` makes the detector see a
# 21-point hand and a 478-point face on the mouth, so the alarm, the coaching prompt, the "Not a bite" toast and the
# event records they create all happen, with no real hand).
#
#   bash scripts/privacy-audit/probe-root.sh /tmp/probe-root
#   node scripts/privacy-audit/run.mjs --root /tmp/probe-root --probe --mode on
#
# The probe exists ONLY in that scratch build: the repository's dist/ and sources are not touched, and a normal
# `npm run build:web` strips it (the dev-leak grep for __sbProbe over dist/assets must print nothing).
set -eu
cd "$(dirname "$0")/../.."
REPO=$(pwd)
DEST="${1:?usage: probe-root.sh <empty scratch dir>}"
rm -rf "$DEST"; mkdir -p "$DEST"
cp package.json package-lock.json index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts tailwind.config.js postcss.config.js server.js email.js trialFollowup.js "$DEST/"
for d in src public scripts shared server; do cp -R "$d" "$DEST/$d"; done
ln -s "$REPO/node_modules" "$DEST/node_modules"
(cd "$DEST" && VITE_WS7A_PROBE=1 VITE_BUILD_TARGET=web npx vite build --mode production >"$DEST/probe-build.log" 2>&1) || { tail -20 "$DEST/probe-build.log"; exit 1; }
grep -lq "__sbProbe" "$DEST"/dist/assets/*.js && echo "probe build ready in $DEST (contains the probe hook, as intended)"
