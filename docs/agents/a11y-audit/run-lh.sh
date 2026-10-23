#!/bin/bash
# Lighthouse accessibility category against the local rig only (port 3216). Never against production.
# Chrome is started here on debug port 4217 (fake camera, headless) and Lighthouse connects to it with --port.
SP=${A11Y_DIR:-/tmp/ws13-a11y}
TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$SP/rig.json','utf8')).token)")
SHARE=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$SP/rig.json','utf8')).share.body.url)")
mkdir -p $SP/lh
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE=$(mktemp -d)
"$CHROME" --headless=new --remote-debugging-port=4217 --user-data-dir=$PROFILE --no-first-run --use-fake-device-for-media-stream --use-fake-ui-for-media-stream about:blank > /dev/null 2>&1 &
CPID=$!
sleep 3
run() { # name url extra...
  name=$1; url=$2; shift 2
  echo "== $name $url"
  npx --yes lighthouse "$url" --port=4217 --only-categories=accessibility --quiet --output=json --output-path=$SP/lh/$name.json "$@" > $SP/lh/$name.log 2>&1
  echo "exit $?"
}
run signin-mobile http://localhost:3216/signin
run signin-desktop http://localhost:3216/signin --preset=desktop
run share-mobile "$SHARE"
run share-desktop "$SHARE" --preset=desktop
run landing-signedout-mobile http://localhost:3216/
run pricing-mobile http://localhost:3216/pricing
run app-watch-desktop http://localhost:3216/ --preset=desktop --extra-headers "{\"Cookie\":\"nh_session=$TOKEN\"}"
run app-watch-mobile http://localhost:3216/ --extra-headers "{\"Cookie\":\"nh_session=$TOKEN\"}"
run redeem-mobile http://localhost:3216/redeem --extra-headers "{\"Cookie\":\"nh_session=$TOKEN\"}"
kill $CPID 2>/dev/null
rm -rf $PROFILE
echo ALLDONE
