NEEDS HUMAN REVIEW

# WS10 draft: Privacy Policy changes for read-only share links

Status: DRAFT. Not published. `src/pages/PrivacyPage.tsx` has not been edited. Publish together with turning on the
`share_links` flag (which is only useful with `event_sync` on, because a link shows the synced history). Sentences that
describe the code are checked against the code (`server/routes/share.js`, `server/share/*`); everything else (legal
basis, retention periods you promise, what counts as health data where you operate, how access logs are kept by your
host) is for the owner or a lawyer to confirm.

## What the code actually does (facts to check the wording against)

- **Off by default, and a person's choice every time.** A link exists only because the signed-in person pressed "Make a
  share link" in Settings > Sharing. Nobody else can make one for them. Nothing is shared until a link has been made and
  its address given to someone.
- **What a link shows** (the whole list; the page and the data address are built from this and nothing else,
  `server/share/summary.js`):
  - counts of logged bites per day (last 4 weeks) and per week (last 12 weeks);
  - the number of whole days since the last logged bite;
  - the bite reasons the person picked, grouped into stress, deep focus, boredom, not sure and "other" (any reason the
    person wrote themselves is counted as "other"; its words are never shown);
  - how often the person finished a competing response after an alarm, as a percentage of alarms.
  With "Include calendar dates" switched on (off by default) it also shows calendar dates on the charts, the date of the
  last logged bite, and a time-of-day chart (bites per hour of the day). It never shows a time of day for one entry.
- **What a link never shows**: the person's name, email address or account id; photos (nail photos never leave the
  browser); anything from the camera; notes; the names of custom bite reasons; any single entry, its id, its exact time or
  the id of the device it came from; the person's time zone (it is used to decide where a day starts and is not shown); the
  private note the person typed for themselves when making the link. The sharing code cannot read the account table at
  all (checked by tests).
- **Where the figures come from.** Only the history the person has chosen to sync to their account (`event_sync`). It is
  worked out on our server when the link is opened; the figures are not stored anywhere.
- **Who can see it.** Anyone who has the link. The address contains a random secret (32 random bytes). There is no sign-in
  on the shared page. Search engines are asked not to list it (`noindex` in the header and the page), the page is never
  cached (`no-store`) and sends no referrer. The page uses no cookies, no analytics, and loads nothing from other sites;
  it is served separately from the rest of the site so that the Google Analytics tag the site uses is not present on it.
  The person should only give a link to people they trust: whoever has it can pass it on while it is active.
- **Stored on our server, per link**: a one-way fingerprint (SHA-256) of the secret (the secret itself is not kept, so we
  cannot show a link again or recover a lost one); which account made it; the private note; whether dates are included;
  the time zone the person was in; when it was made, when it expires, when it was revoked; and when it was last opened
  (to the minute, shown to the owner only). We do not record who opened it or from where.
- **Opening a link** is a request to our server like any page. Our host's server or proxy logs may record the address
  (which contains the secret) and the visitor's IP address, as for any request. See "Owner TODOs" in `ws10-notes.md`.
- **Expiry and revocation.** The person chooses 7, 30 or 90 days, or no expiry, and can revoke a link at any time in
  Settings > Sharing. A revoked or expired link stops working at once and gives the same "this link does not work" page as
  a link that never existed. At most 5 links can be active per account.
- **Retention.** A revoked or expired link's record is deleted once it is more than 30 days old, when the next share link
  is made by anyone (the code clears them out then, not on a timer; the owner may prefer a scheduled job). Deleting the synced
  history ("Delete synced data") makes every link show "no history yet" but does not revoke the links; revoking is separate.
  Deleting an account by hand should also delete its `share_links` rows (not automatic today).
- **Not medical.** The page says it is a log the person kept, not a diagnosis or clinical assessment, and that Stop Biting
  is an app, not a clinician.

## Proposed text

### Section 3, "Data We Collect": add a bullet

> Share links: if you choose to make a share link, we store a fingerprint of the link (not the link itself), the private
> note you typed, whether you chose to include dates, your time zone, and when the link was made, opened last, set to
> expire, or revoked. People who open the link see a summary built from the history you have synced: counts, the groups
> your bite reasons fall into, how often you finished a competing response, and your streak. With "Include calendar
> dates" on they also see dates and a time-of-day chart. They never see your name, email, photos or camera data, notes,
> or any single entry.

### New section, "Sharing a summary"

> Sharing is your choice and off until you make a link. Anyone who has a link can open it without signing in, so send it
> only to people you trust. You can stop sharing at any time by revoking the link in Settings; it stops working straight
> away. The shared page is not indexed by search engines, does not use cookies or analytics, and does not load anything
> from other sites. A share link is a way to show a summary of a log you kept. It is not medical advice, a diagnosis or
> a clinical assessment.

### Section 8 ("How long we keep data" or equivalent)

> Share link records are kept until you revoke the link or it expires, and are deleted after a further 30 days.

## Open questions for the owner or a lawyer

1. Does a habit log shared with a therapist count as health data under the rules that apply to you? If so, is the
   person's explicit choice to make a link enough consent for the processing the link causes, and what record of it do you
   want to keep?
2. The proxy or host logs request paths: decide whether to exclude `/share/` from access logs, or accept that and say so.
3. Whether to promise deletion of expired link records on a schedule (today: when anyone next makes a link).
4. Whether the 30-day retention of revoked/expired records is needed at all (it exists so the owner can audit; it can be
   set to 0 in `STALE_RETENTION_MS`).
