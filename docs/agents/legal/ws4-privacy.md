NEEDS HUMAN REVIEW

# WS4 draft: Privacy Policy changes for optional sync of history, export and import

Status: DRAFT. Not published. `src/pages/PrivacyPage.tsx` has not been edited. Publish these together with turning on
the `event_sync` flag (sync) and, for the export/import wording, `data_backup`. Wording that describes facts about the
code is checked against the code (`server/routes/events.js`, `server/events/`, `src/sync/`); everything else (legal
basis, retention periods you promise, processor names, the hosting provider) is for the owner or a lawyer to confirm.

Also see the "Other places that say history is local-only" list in `docs/agents/ws4-notes.md`: those sentences become
untrue for a person who switches sync on and must change at the same time.

## What the code actually does (facts to check the wording against)

- **Off by default.** Nothing about a person's history is sent unless they switch "Sync my history across devices" on in
  Settings. Switching it off stops all sync requests at once. Export and import (Settings > Data) work with no account and
  no network request: the file is made and read in the browser.
- **What is sent, per entry** (the `HabitEvent` record, whitelisted field by field in `src/sync/payload.ts` and refused
  by the server if anything else is present): a random entry id; when it happened; whether it was an alarm or logged by
  hand; which behavior; the bite reason(s) chosen (including the names of any custom bite reasons the person created,
  stored as an id such as `custom-ab12cd34`, not the label); which hand, if known; whether an alarm was confirmed as a
  real bite; whether it was marked a false alarm; whether the person finished the "competing response" timer and for
  how many seconds; the random id of the browser it came from; the time it was last changed; and whether it was
  deleted.
- **What is never sent**: video, camera frames, images, hand or face tracking points, calibration or learning data for
  false-alarm handling, nail photos (they never leave the browser's local store), custom bite reason labels, settings,
  streak figures (they are worked out again from the entries), or the name given to a device in Settings.
- **Where it is stored.** One table (`habit_events`) in the same database as the account and subscription records, keyed
  by account. Each row is one entry as above, plus the time the server stored it. A deleted entry is kept as a bare
  marker (id, time, type, behavior, deletion time and device id; its content is erased) so that other devices learn
  about the deletion.
- **How long.** Until the person deletes it. "Delete synced data" in Settings > Data removes every row for the account
  immediately; "Delete everything" can do the same together with the data on that device. Switching sync off alone does
  not delete the server copy (the person is told this next to the switch).
- **Who can read it.** The account holder, signed in. The server answers only for the signed-in account; another
  account cannot read or delete it (covered by tests). The owner of the service can read the database. Later features
  that read the synced entries on the server (the weekly email, share links) are separate opt-ins and need their own
  wording.
- **Limits.** At most 50,000 stored entries per account (the owner may change this with `EVENTS_QUOTA_PER_USER`). Requests
  are rate limited per account.
- **Transport.** Over HTTPS, with the session cookie (`nh_session`) that already exists for sign-in. No new cookie.
- **Another device.** The server hands an entry to any other browser signed in to the same account that has switched
  sync on. A random device id (not a name, not a fingerprint) is stored with each entry so devices can be told apart.

## Proposed text

### Section 3, "Data We Collect": replace the "Habit data" bullet

> Habit data: your alarm and bite log, trigger tags, streaks, custom bite reasons and app settings. By default these are
> stored only in your browser (local storage) on the device you use, and they do not follow you to another computer. If
> you switch on "Sync my history across devices" in Settings, a copy of your log entries (when each happened, whether it
> was an alarm or logged by hand, the behavior, the bite reasons you picked, which hand if known, whether you
> confirmed it or marked it a false alarm, whether you finished a competing-response timer, and when it was last
> changed) is also stored on our server, linked to your account, so you can see the same history on your other devices.
> Your settings, your streak figures and the labels of your own custom bite reasons are not synced.

### Section 2, "Camera and Video Data": add a final sentence

> Syncing never includes camera data: no video, frames, images or hand and face tracking points are ever sent, with sync
> on or off.

(The existing statement that no video frames, images or camera data are transmitted stays as it is.)

### Section 8, "Data Storage": replace the last sentence

> Your habit data is stored in your browser. If you switch on sync, a copy of your log entries is also stored on our
> server, in the same database as your account data, until you delete it. You can delete the synced copy at any time
> in Settings > Data ("Delete synced data"). Clearing this site's data in your browser, or using "Clear all data" in
> Settings, deletes the copy on that device; it does not delete a synced copy on our server.

### Section 9, "Data Retention": replace the last sentence

> Your habit data is on your device, so you can delete it yourself at any time. If you use sync, we keep the synced
> copy until you delete it (Settings > Data > "Delete synced data") or ask us to delete your account.

### Section 11, "Your Rights": replace the "Portability" bullet and extend "Deletion"

> Portability: you can export your habit data yourself at any time as a JSON or CSV file (Settings > Data), with or
> without sync, and you can import a file back. You may also request your account data in a machine-readable format.
> Deletion: you may delete your synced habit data yourself in Settings > Data, or ask us to delete your account and all
> associated data.

### New sentence for "7. Third Parties" (needs the owner's input)

> The synced copy is stored on our own server, hosted by `TODO(owner): hosting provider and region`. It is not shared
> with any other third party.

### Section 4, "How We Use Your Data": add

> To show you the same history on your other devices, if you switch on sync.

## Questions for the owner or a lawyer

1. **Legal basis and consent.** Sync is opt-in and explained next to the switch; confirm that is the consent you want
   to rely on, and whether the data is "health data" under the rules that apply to you (habit logs about a
   body-focused repetitive behavior may be treated as such). If so, the plain wording above and the opt-in may need to
   be more explicit.
2. **Retention after account deletion.** The code has no "delete my account" action yet: deletion is by email
   (`hello@stopbiting.today`, 30 days per the current policy). When that is done by hand, the rows in `habit_events` for
   that account must be deleted too (`DELETE FROM habit_events WHERE user_id = ?`, and the row in `habit_event_epochs`).
3. **Backups.** If the database is backed up, deleted rows survive in backups until they expire. State the backup period
   if you promise "immediately".
4. **Data location / hosting provider** (see the `TODO(owner)` above).
5. **Children.** No change: the service is still not directed at children under 13.
