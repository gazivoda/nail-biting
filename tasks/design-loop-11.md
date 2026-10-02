# Design loop, round 11 (10 iterations, commit + push each; UX/UI + SEO/GEO on the landing page)

iterations: 10

## Backlog

## Log
- 1/10: install prompt sits bottom-right on desktop (was centred over content); dismiss target 16px -> 44px
- 2/10: SEO: meta description 202 -> 153 chars (shell, server const, llms.txt resynced); og:image:alt/type, og:locale, twitter:image:alt on the homepage shell (stripped on pages with their own og image)
- 3/10: promo video (promo-video skill, 30 s 1920x1080, silent, brand forest palette; only facts the page already states: 3-day trial, ~20 MB one-time model download, on-device): click-to-play section between History and How to start, preload=none (mp4 not requested until click, verified headless), poster, VideoObject JSON-LD on '/'. Copy: ~/Movies/stop-biting-promo.mp4. Not built: music (unheard), 1:1/9:16 cuts.
- 4/10: SEO: the no-JS homepage article now mirrors the rendered page (h1 'Stop biting your nails.', same section headings and copy in the same order: History, Video, How to start + limits, Science, Privacy, Why this exists, pricing heading); was 'Stop Nail Biting with AI' / 'How it works' / 'Pricing' (cloaking exposure). All schema types still emitted (verified by fetching).
- 5/10: GEO: first FAQ is now 'What is Stop Biting and how does it work?', a 158-word self-contained answer (visible + FAQPage + no-JS article); 'zero network requests' softened to match the privacy section; WebPage schema gains about/author/primaryImageOfPage/inLanguage; stale softwareVersion 1.1 / releaseNotes dropped. Open: comparePages.ts + llms.txt still say 'zero network requests during detection'.
- 6/10: video play control moved to the poster's empty bottom-right corner (was centred over the card text), label in a pill, no middle dot; playback re-verified headless
- 7/10: tap targets measured (390 + 1440): header nav links 23 -> 44px tall, install prompt 'Install app' 16 -> 44px; only the inline footer name link stays small (inline text, exempt)
- 8/10: GEO consistency: the retired 'zero network requests during detection' claim (a FAQ answer, llms.txt, 5 sentences in comparePages.ts) now matches the privacy section: 'once the models have downloaded, nothing carrying camera data is sent while it watches'. Grepped to zero in src, llms.txt, built seo-content/llms-full.
