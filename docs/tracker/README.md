# Printable tracker

`nail-biting-30-day-tracker.html` is the source of the downloadable sheet. Regenerate the committed outputs with headless Chrome from this folder:

```
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf=../../public/files/nail-biting-30-day-tracker.pdf "file://$PWD/nail-biting-30-day-tracker.html"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size=816,1056 --screenshot=../../public/files/nail-biting-30-day-tracker-preview.png "file://$PWD/nail-biting-30-day-tracker.html"
```

The PDF must stay one US Letter page. Check the page count after editing.
