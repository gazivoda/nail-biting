#!/usr/bin/env bash
# The release gates (WS13), in one place so they can be re-run after any merge.
#
#   bash scripts/qa/gates.sh                 # everything below
#   BASE=ffbf29a bash scripts/qa/gates.sh    # base for the secret scan (default: the merge-base with origin/main)
#   SKIP_BUILD=1 bash scripts/qa/gates.sh    # reuse dist/
#
# Prints one line per gate (PASS / FAIL / NOTE) and a summary. Exit 1 if any gate FAILS.
# Lint: the baseline is 22 errors / 4 warnings on real source (lowered from 23 on 2026-10-30 when useIsPhone lost its set-state-in-effect error) (scoped to src server scripts electron shared; the
# unscoped `npm run lint` also walks .claude/worktrees and counts other agents' trees).
set -u
cd "$(dirname "$0")/../.."
LOG="${GATES_LOG:-$(mktemp -d)}"
mkdir -p "$LOG"
FAILS=0
pass() { echo "PASS  $1"; }
fail() { echo "FAIL  $1"; FAILS=$((FAILS + 1)); }
note() { echo "NOTE  $1"; }

if [ -z "${SKIP_BUILD:-}" ]; then
  if npm run build:web >"$LOG/build.log" 2>&1; then pass "npm run build:web"; else fail "npm run build:web (see $LOG/build.log)"; tail -15 "$LOG/build.log"; fi
else note "build skipped (SKIP_BUILD=1)"; fi

npm test >"$LOG/test.log" 2>&1
if grep -q "Test Files .* passed" "$LOG/test.log" && ! grep -qE "Test Files .*failed|Tests .*failed" "$LOG/test.log"; then pass "npm test: $(grep -E 'Test Files' "$LOG/test.log" | sed 's/\x1b\[[0-9;]*m//g' | tr -s ' '), $(grep -E '^ *Tests' "$LOG/test.log" | sed 's/\x1b\[[0-9;]*m//g' | tr -s ' ')"; else fail "npm test (see $LOG/test.log)"; grep -E "FAIL|Error" "$LOG/test.log" | head -10; fi

npx eslint src server scripts electron shared >"$LOG/lint.log" 2>&1
SUMMARY=$(grep -E "problems \(" "$LOG/lint.log" | tail -1)
if echo "$SUMMARY" | grep -q "(22 errors, 4 warnings)"; then pass "lint scoped: $SUMMARY (baseline)"; else fail "lint scoped: ${SUMMARY:-no summary} (baseline is 22 errors, 4 warnings)"; fi

BAD=0
for f in server.js email.js trialFollowup.js $(find server shared -name '*.js'); do node --check "$f" 2>>"$LOG/check.log" || BAD=$((BAD + 1)); done
if [ "$BAD" = 0 ]; then pass "node --check on server.js, email.js, trialFollowup.js, server/**, shared/** ($(find server shared -name '*.js' | wc -l | tr -d ' ') files)"; else fail "node --check: $BAD file(s) (see $LOG/check.log)"; fi

if npm run electron:typecheck >"$LOG/electron.log" 2>&1; then pass "electron:typecheck"; else fail "electron:typecheck (see $LOG/electron.log)"; fi
if npm run seo:check >"$LOG/seo.log" 2>&1; then pass "seo:check"; else fail "seo:check (see $LOG/seo.log)"; tail -8 "$LOG/seo.log"; fi
if npm run og:check >"$LOG/og.log" 2>&1; then pass "og:check"; else fail "og:check (see $LOG/og.log)"; tail -8 "$LOG/og.log"; fi
if npm run eval:detection >"$LOG/eval.log" 2>&1; then pass "eval:detection"; else fail "eval:detection (see $LOG/eval.log)"; tail -8 "$LOG/eval.log"; fi

LEAK=$(grep -lE 'seedPreviewData|previewKind|dev-override|readDevOverrides|__sbProbe' dist/assets/*.js 2>/dev/null | wc -l | tr -d ' ')
if [ "$LEAK" = 0 ]; then pass "dev-leak grep over dist/assets (seedPreviewData|previewKind|dev-override|readDevOverrides|__sbProbe): 0 files"; else fail "dev-leak grep: $LEAK file(s) in dist/assets"; grep -lE 'seedPreviewData|previewKind|dev-override|readDevOverrides|__sbProbe' dist/assets/*.js; fi

# Secret scan of what the swarm changed: added lines only, no lockfile, no binary.
if [ -z "${BASE:-}" ]; then BASE=$(git merge-base HEAD origin/main 2>/dev/null || echo ""); fi
if [ -n "$BASE" ]; then
  git diff "$BASE"..HEAD -U0 -- . ':(exclude)package-lock.json' ':(exclude)*.png' ':(exclude)*.pdf' ':(exclude)docs/seo' | grep -E '^\+' | grep -vE '^\+\+\+' >"$LOG/added.txt"
  PATTERNS='AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk_(live|test)_[0-9A-Za-z]{16,}|pdl_(live|sdbx)_[0-9a-z_]{20,}|re_[A-Za-z0-9]{24,}|xox[abp]-[0-9A-Za-z-]{10,}|gh[pousr]_[A-Za-z0-9]{30,}|AIza[0-9A-Za-z_-]{35}|GOCSPX-[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}|apikey[=:] *["'"'"'][A-Za-z0-9]{24,}'
  HITS=$(grep -cE "$PATTERNS" "$LOG/added.txt" || true)
  if [ "$HITS" = 0 ]; then pass "secret scan of git diff $BASE..HEAD ($(wc -l <"$LOG/added.txt" | tr -d ' ') added lines): 0 hits"; else fail "secret scan: $HITS hit(s)"; grep -nE "$PATTERNS" "$LOG/added.txt" | cut -c1-160 | head; fi
else note "secret scan skipped: no merge-base with origin/main"; fi

echo "logs: $LOG"
if [ "$FAILS" = 0 ]; then echo "ALL GATES PASS"; else echo "$FAILS GATE(S) FAILED"; exit 1; fi
