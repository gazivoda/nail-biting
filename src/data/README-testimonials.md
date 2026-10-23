# Testimonials: how to add real ones

The testimonial section on the homepage and `/pricing` shows nothing until this
folder's `testimonials.json` holds at least one entry that you have written
permission to publish. It ships as an empty list (`[]`), and **no one, human or
AI, writes an entry here that a real person did not say and agree to publish.**
No composites, no tidied-up paraphrases, no "example" entries.

## What an entry looks like

```json
[
  {
    "quote": "Exactly what they said, in their words.",
    "firstName": "Sam",
    "howLongTheyBit": "about ten years",
    "consent": true
  }
]
```

| Field | Required | Notes |
|---|---|---|
| `quote` | yes | Their words, up to 600 characters. Cut with an ellipsis if you must; never reword. Do not publish a quote that claims a medical result or a cure. |
| `firstName` | yes | First name only, one word. Use a name they are happy to see, not necessarily their legal one. |
| `howLongTheyBit` | yes | Their words, shown as "Bit their nails: about ten years". |
| `consent` | yes | `true` only when they have agreed, in writing, to this quote and first name appearing on stopbiting.today. Without `"consent": true` the entry is ignored. |
| `beforeAfterPhoto` | no | A path starting `/testimonials/`, for a file you put in `public/testimonials/` (`.jpg`, `.png`, `.webp`, `.avif`). |
| `photoConsent` | only with a photo | `true` only when they agreed, in writing, to this specific photo being published. Without it the photo is dropped and the quote still shows. |
| `photoAlt` | no | What the photo shows, for screen readers. Default: "Before and after photo of NAME's nails, shared with their permission". |

## Consent rules

1. Ask first, in writing (email is fine), and keep the message. Say exactly what
   will be shown: the quote, the first name, how long they bit, and the photo if any.
2. Consent is per item. Agreeing to a quote is not agreeing to a photo.
3. They can withdraw at any time. Delete the entry (and the photo file) and deploy.
4. Do not add anyone under 18, or quote a parent about a child.
5. Do not edit a quote to make it say more than it said. If they said "it helped me
   notice", do not publish "it cured my nail biting".
6. Do not pay for or reward testimonials without saying so next to them.

## Photo rules

- Nails and hands only. No face, no name tags, no background that identifies a home or workplace.
- A hand held away from the body, nails visible. **Never a hand at the mouth, and never anyone biting.**
- Strip EXIF/location data before you add the file. Aim for under 150 KB.
- Before and after in one image (side by side).

## Turning it on

1. Add entries (and photos) and deploy. The file is bundled at build time, so the
   site must be rebuilt for a change to show.
2. In Coolify set `FEATURE_FLAGS=social_proof` (comma-separate it from any other
   flags you already use) and restart. Remove it and restart to hide the section
   again without touching the data.
3. Check the homepage and `/pricing` in a private window, and view the page source:
   the same quotes are in the no-JavaScript copy that search engines read.

With the list empty, or the flag off, the section renders nothing: no heading, no
gap, no extra network request.

## What this does not do

It adds no star ratings, review counts or "as seen in" claims, and it adds no
structured data (no `Review` or `AggregateRating` markup). Do not add them: they
would be claims about the product that nothing here can back up.
