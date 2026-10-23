NEEDS HUMAN REVIEW

# WS5 draft: Privacy Policy changes for the weekly summary email, the local photo diary, charts and the share card

Status: DRAFT. Not published. `src/pages/PrivacyPage.tsx`, `TermsPage.tsx`, `LegalPage.tsx` and `RefundPage.tsx` have not
been edited. Publish the relevant part with the flag it belongs to: `weekly_email` (email), `photo_diary` (photos),
`insights` (charts, milestones, share card). Statements of fact below are checked against the code (the files are named);
legal basis, retention you promise, processor names and the hosting provider are for the owner or a lawyer to confirm.
Do not reuse the words "100% private", "no cloud, no server" or "nothing leaves your device" anywhere: the approved line is
"Detection runs on your device. No camera data is sent while it runs."

Depends on `docs/agents/legal/ws4-privacy.md` (the weekly email reads the synced history that WS4 introduces: it only works
for a person who has switched sync on).

## 1. Weekly summary email (flag `weekly_email`)

### What the code actually does

- **Off by default, opt-in only.** A person turns on "Weekly summary email" in Settings > Account & Sync
  (`src/pages/settings/WeeklyEmailCard.tsx`). Nothing is sent to anyone who has not. The address is always the account's own
  address; the browser never sends an address (`server/routes/weeklyEmail.js`).
- **Needs sync.** The summary is built only from the entries the person chose to sync (`habit_events`, WS4). A person with no
  synced entries gets nothing (`server/jobs/weeklyEmail.js`). The card says so.
- **What the server reads to build it**: the person's synced entries for the last two weeks (when, alarm or hand-logged,
  whether confirmed, whether marked "Not a bite", the bite reason, whether deleted), the account's email address, and the time
  zone the browser reported when the person turned it on.
- **What is stored for it** (table `email_preferences`, additive migration `ws5_001`): account id, on/off, the time zone, the
  moment it was turned on, the last week a summary was sent for (so a restart never sends twice), a random per-account secret
  used to sign the unsubscribe link, and the time of the last change. No email content is stored.
- **What the email contains**: the week's dates, the number of bites logged that week, the change against the week before in
  whole percent (left out when the week before had none), the reason picked most often (only when at least three bites carry a
  reason and one appears twice; only the built-in reasons are named, custom reasons are not synced), the weekdays with the fewest
  bites, and how many alarms are waiting for review. No name, no address in the body, no image, no tracking pixel, no link
  tracking. One link opens the app; one link unsubscribes.
- **What it never contains or reads**: video, frames, images, tracking points, photos from the photo diary, settings, custom reason
  labels.
- **How often**: at most one per person per ISO week, sent between 8 and 72 hours after that person's own week ended (Monday to
  Sunday in their time zone), and only if the week ended after they turned it on and there was at least one bite in either week.
- **Unsubscribe**: every email has a link (and `List-Unsubscribe` / one-click headers). Opening it shows a confirmation page;
  pressing the button, or a mail program's one-click request, switches the summary off. Opening the link alone changes nothing.
  The unsubscribe works for as long as the account exists, whether or not the feature flag is still on. Turning it off in Settings
  does the same.
- **Processor**: the email is sent through Resend (the provider `email.js` already uses for welcome and trial emails). A summary
  therefore passes through Resend's systems like the other emails. Owner: confirm the provider's data-processing terms and where
  it processes data.
- **Retention**: the preference row stays until deleted by hand (the owner deletes `email_preferences` rows together with the
  account's `habit_events` rows when deleting an account). Turning the summary off keeps the row with the flag off.

### Proposed text

Section 3, "Data We Collect", add a bullet:

> Weekly summary email (optional, off by default): if you switch it on in Settings, we use the history you chose to sync to send
> you one email a week with the number of bites you logged, how that compares with the week before, the reason you picked most
> often and the days with the fewest bites. To do this we store that you opted in, your time zone and the date of the last email.
> We send it to the email address of your account through our email provider. Every email has an unsubscribe link, and you can
> turn it off in Settings at any time. The summary needs "Sync my history across devices" to be on.

Section on how we use data: add "to send you the weekly summary email if you ask for it".

Section on service providers: add that the weekly email is delivered by the same email provider as the welcome email (name it
once the owner has confirmed the provider's terms).

## 2. Nail photo diary (flag `photo_diary`)

### What the code actually does

- **Local only.** Photos are taken with the person's camera by a separate camera request used only for the photo, and are
  stored in this browser: the picture files in IndexedDB (database `stop-biting-local-blobs`, collection `photo-diary`) through
  `src/storage/blobs.ts`, and a small list (id, time taken, width, height, size, plus a "remind me later" time) in local storage
  (`sb:insights:photo-diary`, `sb:insights:photo-reminder-snooze`). One JPEG per photo, at most 1,280 pixels on the long side, at
  most 104 photos.
- **Never uploaded.** No request carries a photo (spy test around capture, save, view, compare and delete:
  `src/photos/photoNetwork.test.tsx`; source guard: `scripts/photoGuard.test.mjs`; real-browser run with the network watched and
  with the network switched off). Photos are not part of sync (the sync whitelist has no such field and the server refuses
  unknown fields), not in the JSON or CSV export, not in the weekly email, not in the share card, not cached by the service
  worker. They are drawn on a canvas in the page, never from a `blob:` address.
- **Hands only, by instruction.** The screen asks for the hands, with a neutral frame and one sentence. The software does not
  detect or check what is in the picture: a person could point the camera at anything. The text does not claim otherwise.
- **The camera** is opened only while the capture screen is open, and every track is stopped on save, discard, cancel, error,
  closing the page or hiding the tab.
- **Deleting**: per photo and "delete all", in the diary and in Settings > Data. Clearing the browser's site data, or a private
  window closing, also removes them. **"Delete everything" in Settings > Data does not remove photos** (the card says so); see
  "Open question" below.
- **Reminders** are in the app only (a strip above the History list when the newest photo is a week old). No push notification,
  no email, no Notification permission.

### Proposed text

Section 3, "Data We Collect", add a bullet:

> Photo diary (optional, off by default): if you use it, the photos you take are saved only in this browser on this device. They
> are not uploaded, synced, exported, emailed or shared by us, and we cannot see them. Clearing your browser's site data, or
> using a private window, removes them, and you can delete one photo or all of them in the app.

Section 2, "Camera and Video Data": add

> The photo diary asks for the camera separately, only while you are taking a photo.

### Open question for the owner

"Delete everything" (WS4) removes history, settings and the synced copy but leaves the photo diary. Decide whether it should also
remove photos. The change is one call to the diary's delete-all from `src/pages/settings/DataSettings.tsx` (WS4's file, which
this workstream was told not to edit, and `scripts/syncGuard.test.mjs` forbids `src/sync` from touching the blob store, so it
has to be called from the page, not the sync code).

## 3. Charts, milestones and the share card (flag `insights`)

### What the code actually does

- **Charts and milestones are worked out in the browser** from the history already on the device. They send nothing. The page
  makes no request of its own.
- **Milestones** are remembered on the device (`sb:insights:milestones`: which milestones were celebrated and when). Nothing is
  sent.
- **The share card** is a picture drawn on the device with the milestone's figure ("7 days"), a plain sentence, the date it was
  reached, the app's name and website. It contains no photo (this version cannot add one), no name, no email address and no other
  number. It leaves the device only when the person chooses to send it: through the system share sheet where the browser has
  one, or as a downloaded file. We do not receive it.

### Proposed text

Section 3, "Data We Collect", add:

> Charts, milestones and share pictures (optional, off by default): these are made on your device from the history stored there.
> A share picture shows only the milestone itself and the app's name; it is created on your device and goes only where you send it.

### Wording to avoid

- "Anonymous" for the weekly email or the diary: the email is tied to the account, and a hand photo can identify a person.
- Any claim that the summary, a milestone or a streak shows that the app works, improves a condition or changes behaviour. The
  copy in the app says "logged", "bite" and counts; it claims no cause and no outcome, and the email says "A log is a way to
  notice a habit, not a treatment."
- That the photo diary "checks" nails or "tracks nail health".

## 4. Owner to confirm before turning the flags on

- Whether the weekly email needs a separate consent record beyond the toggle (the toggle, its date and the unsubscribe are what
  is stored).
- The email provider's terms, region and sub-processors; the sender domain (`EMAIL_FROM`) is verified.
- Whether habit counts are "health data" where you operate, which would change the consent wording for sync and the email.
- The retention promise for `email_preferences` and for `habit_events` after an account is deleted.
- Whether "Delete everything" should remove photos (above).
