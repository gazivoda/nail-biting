# Stop Biting

[Stop Biting](https://stopbiting.today/) is a webcam app that alerts you when your hand reaches your mouth, helping you notice nail biting while you work at a computer. Built by [Igor Gazivoda](https://github.com/gazivoda).

Try the [live detector demo](https://stopbiting.today/) without an account, or read [how it works](https://stopbiting.today/how-it-works). Current trial and subscription details are on the [pricing page](https://stopbiting.today/pricing).

## What it does

- Uses Google MediaPipe and WebAssembly to detect hand-to-mouth proximity on your device.
- Offers sound and visual alerts, incident history, trigger tags and streak tracking.
- Runs in a desktop browser with a webcam. Detection needs an open app window; it cannot cover time away from the camera.
- Sends no camera data while detection runs. Signing in, payments, analytics and other online features use the network; see the [privacy policy](https://stopbiting.today/privacy).

Hand-to-mouth proximity is a signal, so alerts can include false positives and miss some biting. Stop Biting has no clinical efficacy study and is not a medical treatment. The [accuracy explanation](https://stopbiting.today/blog/nail-biting-detection-accuracy) describes its limits.

## Guides and free tools

- [How to stop nail biting](https://stopbiting.today/blog/how-to-stop-nail-biting)
- [Body-focused repetitive behaviours explained](https://stopbiting.today/blog/bfrb-guide)
- [Apps that detect nail biting compared](https://stopbiting.today/compare/ai-detection-apps)
- [Nail growth timeline calculator](https://stopbiting.today/tools/nail-growth-timeline-calculator)
- [Printable 30-day nail biting tracker](https://stopbiting.today/tools/nail-biting-tracker-printable)
- [Editorial policy, sources and corrections](https://stopbiting.today/editorial-policy)

## Local development

Use Node.js 22.18 or newer; the content scripts import TypeScript directly.

```sh
npm ci
cp .env.example .env
npm run dev
```

Fill in the Google OAuth and JWT settings in `.env` to use sign-in locally. The example file documents the optional payment, email and contact-form settings. Keep credentials out of Git.

Vite serves the client at `http://localhost:5173` and proxies `/api` to the Express server on port 3000.

```sh
npm test
npm run build:web
npm run seo:check
npm start
```

`build:web` produces the website with absolute asset URLs. `build` uses the relative asset paths needed by Electron. `npm start` serves the production web bundle from `dist/`.

## Content and search metadata

Articles live in `src/data/blogPosts.ts`; comparison and solution pages live in `src/data/comparePages.ts`. The web build generates article JSON and the server-rendered content from those sources. After changing page metadata, run `npm run seo:sync` and `npm run seo:check` to keep the sitemap, article index and LLM index synchronized.

The [October 2026 audit](docs/seo/audits/2026-10-23/REPORT.md) records verified issues, implemented improvements and the measurement plan. Report product issues through this repository; send editorial corrections to [hello@stopbiting.today](mailto:hello@stopbiting.today).
