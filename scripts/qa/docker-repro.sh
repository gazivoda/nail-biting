#!/usr/bin/env bash
# Reproduces the Dockerfile by hand (the docker daemon is not used): stage 1 builds the frontend from ONLY what the
# Dockerfile copies, stage 3 runs the server from ONLY what the Dockerfile copies, then key routes are probed.
# It catches "works in the repo, breaks in the image" (a new top-level directory or file the Dockerfile does not COPY).
#
#   bash scripts/qa/docker-repro.sh [PORT]      # default port 3213
#
# node_modules is symlinked from the repo (stage 2 does `npm ci --omit=dev` in the real image, which cannot be
# reproduced offline): a missing PRODUCTION dependency is therefore not caught here.
set -u
cd "$(dirname "$0")/../.."
ROOT=$(pwd)
PORT="${1:-3213}"
WORK=$(mktemp -d)
FAILS=0
ok() { echo "PASS  $1"; }
bad() { echo "FAIL  $1"; FAILS=$((FAILS + 1)); }

# ── Stage 1: the frontend build, from the files the Dockerfile copies ──
S1="$WORK/stage1"; mkdir -p "$S1"
cp package.json package-lock.json "$S1/"
for d in src public scripts shared; do cp -R "$d" "$S1/$d"; done
cp index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts tailwind.config.js postcss.config.js "$S1/"
ln -s "$ROOT/node_modules" "$S1/node_modules"
if (cd "$S1" && VITE_BUILD_TARGET=web npx vite build --mode production >"$WORK/stage1.log" 2>&1); then ok "stage 1: VITE_BUILD_TARGET=web npx vite build --mode production from only the Dockerfile's COPY set"; else bad "stage 1 build failed (see $WORK/stage1.log)"; tail -15 "$WORK/stage1.log"; fi
[ -f "$S1/dist/index.html" ] && ok "stage 1 produced dist/index.html ($(ls "$S1/dist/assets" | wc -l | tr -d ' ') assets)" || bad "no dist/index.html"

# ── Stage 3: the runtime image: server.js email.js trialFollowup.js server shared + dist ──
S3="$WORK/stage3"; mkdir -p "$S3/data"
cp server.js email.js trialFollowup.js "$S3/"
cp -R server "$S3/server"; cp -R shared "$S3/shared"; cp -R "$S1/dist" "$S3/dist"
ln -s "$ROOT/node_modules" "$S3/node_modules"
FLAGS="${DOCKER_REPRO_FLAGS:-}"
(cd "$S3" && exec env -i PATH="$PATH" PORT="$PORT" DATA_DIR="$S3/data" GOOGLE_CLIENT_ID=x GOOGLE_CLIENT_SECRET=x JWT_SECRET=docker-repro-secret-docker-repro-0123456789 APP_URL="http://localhost:$PORT" FEATURE_FLAGS="$FLAGS" node server.js >"$WORK/server.log" 2>&1) &
SERVER=$!
for i in $(seq 1 60); do curl -fs "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && break; sleep 0.5; done
probe() {
  local path="$1" want="$2" code
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT$path")
  if [ "$code" = "$want" ]; then ok "GET $path -> $code"; else bad "GET $path -> $code (wanted $want)"; fi
}
probe /health 200
probe / 200
probe /pricing 200
probe /how-it-works 200
probe /about 200
probe /blog 200
probe /signin 404   # 404 while all three sign-in flags are off
probe /privacy 200
probe /terms-and-conditions 200
probe /refund-policy 200
probe /sitemap.xml 200
probe /robots.txt 200
probe /llms.txt 200
probe /manifest.webmanifest 200
probe /sw.js 200
probe /api/features 200
probe /api/user/me 401
probe /compare/hands-off 404
probe /features/habit-reversal-coaching 404
probe /api/events/sync 404
probe /share/doesnotexist 404
probe /mediapipe-models/hand_landmarker.task 200
probe /mediapipe-wasm/vision_wasm_internal.wasm 200
FEATS=$(curl -s "http://127.0.0.1:$PORT/api/features")
echo "$FEATS" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const f=j.flags??j;const on=Object.entries(f).filter(([,v])=>v===true).map(([k])=>k);console.log(on.length===0?"PASS  /api/features: all flags off ("+Object.keys(f).length+" flags)":"FAIL  flags on: "+on.join(","));process.exit(on.length?1:0)})' || FAILS=$((FAILS + 1))
grep -qi "error\|cannot find" "$WORK/server.log" && { bad "server log has errors"; head -8 "$WORK/server.log"; } || ok "server log clean ($(wc -l <"$WORK/server.log" | tr -d ' ') lines)"
kill "$SERVER" 2>/dev/null; wait "$SERVER" 2>/dev/null
rm -rf "$WORK"
if [ "$FAILS" = 0 ]; then echo "DOCKER REPRODUCTION OK"; else echo "$FAILS CHECK(S) FAILED"; exit 1; fi
