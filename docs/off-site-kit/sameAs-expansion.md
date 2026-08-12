# sameAs Expansion Plan — Organization + Person JSON-LD

**⚠️ DO-NOT-DEPLOY-UNTIL-REAL: every URL below containing `REPLACE-ME` is a
placeholder slot. Add a URL to the deployed schema ONLY after that profile actually
exists and is publicly visible. A sameAs pointing at a 404 or an empty profile is
worse than no sameAs — it breaks the entity-verification loop these arrays exist to
create.**

Deploy incrementally: each time one profile goes live, add that one line, redeploy,
and validate with https://validator.schema.org/.

---

## Where the schemas live today

| Schema | File / location | Current sameAs |
|---|---|---|
| Organization "Stop Biting" | `index.html` (Structured Data: Organization block, ~line 67) | `["https://github.com/gazivoda/nail-biting"]` |
| Person (blog author `SCHEMA_AUTHOR`) | `server.js` (~line 838) | `['https://github.com/gazivoda/nail-biting']` |
| Person (/about page `personSchema`) | `server.js` (~line 1216, inside `app.get('/about', ...)`) | **none — this schema currently has NO sameAs property at all** |

Note: the GitHub URL doubles as both Organization and Person sameAs today. That's
acceptable while it's the only profile, but as real profiles appear, keep the split
clean: company-shaped profiles (PH product, AlternativeTo, Crunchbase org, LinkedIn
company page) go on Organization; person-shaped profiles (LinkedIn personal, PH user
profile) go on Person.

Also note: the GitHub repo is public but its README is still the default Vite
template (checked August 2026). Since three schemas point AI crawlers at it, giving
it a real README describing Stop Biting is a cheap authority win.

---

## 1. index.html — Organization sameAs (target state)

Replace the current array:

```json
"sameAs": [
  "https://github.com/gazivoda/nail-biting"
]
```

with (adding lines ONLY as each becomes real):

```json
"sameAs": [
  "https://github.com/gazivoda/nail-biting",
  "https://www.producthunt.com/products/REPLACE-ME-your-slug-after-launch",
  "https://alternativeto.net/software/REPLACE-ME-your-slug-after-approval/about/",
  "https://www.linkedin.com/company/REPLACE-ME-if-company-page-created",
  "https://www.crunchbase.com/organization/REPLACE-ME-if-profile-created"
]
```

Slot notes:
- **Product Hunt**: use the canonical product URL PH assigns after launch (see
  product-hunt-launch.md — the slug may not be exactly `stop-biting` because the
  existing "StopBite" listing occupies similar namespace).
- **AlternativeTo**: use the listing URL after moderator approval (see
  alternativeto-listing.md; expect a slug like `stop-biting`).
- **LinkedIn company page**: only if you actually create one; a personal LinkedIn
  belongs on Person, not Organization.
- **Crunchbase**: optional slot. Only add if you create the organization profile;
  we did not verify Crunchbase's current submission terms (their support page
  blocked automated checking in August 2026).

## 2. server.js — `SCHEMA_AUTHOR` (blog author Person) sameAs (target state)

```js
const SCHEMA_AUTHOR = {
  '@type': 'Person',
  name: 'Igor Gazivoda',
  url: 'https://stopbiting.today/about',
  jobTitle: 'Founder',
  sameAs: [
    'https://github.com/gazivoda/nail-biting',
    'https://www.linkedin.com/in/REPLACE-ME-igor-personal-profile',
    'https://www.producthunt.com/@REPLACE-ME-ph-username-after-signup',
  ],
  knowsAbout: ['onychophagia', 'nail biting', 'body-focused repetitive behaviors', 'habit reversal training', 'MediaPipe', 'on-device AI'],
};
```

- The PH **user** profile (`/@username`) is person-shaped — it goes here; the PH
  **product** page goes on Organization.
- If you make Reddit outreach (outreach-templates.md) a long-term disclosed founder
  presence, the Reddit user profile URL is a legitimate additional Person sameAs —
  optional, add only if the account is clearly founder-branded.

## 3. server.js — /about `personSchema` sameAs (currently missing entirely)

Inside `app.get('/about', ...)`, add a `sameAs` property to `personSchema` and keep
it **identical to SCHEMA_AUTHOR's array** (same entity → same sameAs set; divergent
arrays for the same person weaken entity resolution):

```js
const personSchema = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Igor Gazivoda',
  url: 'https://stopbiting.today/about',
  jobTitle: 'Founder',
  worksFor: { '@type': 'Organization', name: 'Stop Biting', url: 'https://stopbiting.today' },
  sameAs: [
    'https://github.com/gazivoda/nail-biting',
    'https://www.linkedin.com/in/REPLACE-ME-igor-personal-profile',
    'https://www.producthunt.com/@REPLACE-ME-ph-username-after-signup',
  ],
  knowsAbout: ['nail biting', 'onychophagia', 'habit reversal training', 'MediaPipe', 'WebAssembly', 'on-device AI'],
  description: 'Igor Gazivoda is the founder of Stop Biting, an on-device AI app for nail biting detection built with MediaPipe and WebAssembly.',
};
```

Even before any new profile exists, adding `sameAs: ['https://github.com/gazivoda/nail-biting']`
to this schema is a same-day improvement — it's real today and aligns /about with the
blog-author schema.

---

## Rollout order (matches realistic profile creation order)

| Step | Profile goes live | Schema edit |
|---|---|---|
| 0 (now) | — | Add GitHub-only `sameAs` to /about `personSchema` (section 3) — no placeholder risk |
| 1 | LinkedIn personal profile | Add LinkedIn URL to both Person schemas |
| 2 | PH account created (pre-launch) | Add `/@username` to both Person schemas |
| 3 | PH launch live | Add PH product URL to Organization |
| 4 | AlternativeTo listing approved | Add AlternativeTo URL to Organization |
| 5 | (optional) LinkedIn company page / Crunchbase org | Add to Organization |

## Why sameAs matters here specifically

The brand has active collisions: "StopBite" (different product, Product Hunt),
stopbiting.com (unrelated site), and competitors with adjacent names. sameAs is the
machine-readable statement of which off-site profiles are *this* Stop Biting. Every
profile added under a consistent name+domain, cross-linked from the site's own
schema, makes it harder for AI systems to conflate stopbiting.today with StopBite or
stopbiting.com — and easier for them to attach the PH launch, AlternativeTo listing,
and founder identity to one coherent entity.

## Validation checklist (after every schema edit)

- [ ] `npm run build` (or the project's usual check) still passes; JSON-LD in
      index.html is valid JSON (no trailing commas)
- [ ] https://validator.schema.org/ on `https://stopbiting.today/` and `/about`
- [ ] Every sameAs URL returns HTTP 200 and shows the profile publicly
      (open each in a private window)
- [ ] No `REPLACE-ME` string is present in deployed HTML:
      `grep -r "REPLACE-ME" dist/ index.html server.js`
