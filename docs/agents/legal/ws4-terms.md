NEEDS HUMAN REVIEW

# WS4 draft: Terms and Conditions changes for optional sync, export and import

Status: DRAFT. Not published. `src/pages/TermsPage.tsx` has not been edited. Publish together with turning on the
`event_sync` and `data_backup` flags. Small: sync does not change what the Service is, it adds a convenience and some
limits the person should know about.

## Proposed additions

### Section 2, "Description of Service": add a sentence

> You can choose to sync your history (the log of alarms and bites you record) to your account so that it appears on
> your other devices. Syncing is optional and is off until you switch it on. No camera data is ever synced.

### New section after "8. Privacy" (or inside it): "Your history, sync, export and import"

> Your history is yours. You can export it at any time as a file (Settings > Data), and import a file back. Sync is a
> convenience, not a backup service: we do not promise that synced data will always be available or free of loss, so
> keep an export if your history matters to you. We may limit how much one account can store (currently 50,000
> entries) and how often it can sync, to keep the Service reliable for everyone. You can delete your synced data at any
> time in Settings > Data. If you import a file, you confirm that you have the right to use its contents; entries you
> import are treated like entries you record yourself.

### Section 9, "Disclaimer of Warranties": nothing to change

The existing "as is" wording already covers sync. Have it read with the "not a backup service" sentence above in mind.

## Questions for the owner or a lawyer

1. Whether the quota (50,000 entries per account) should be stated in the Terms or only in the app.
2. Whether to commit to a retention period for synced data of accounts that have ended or lapsed (trial expired, no
   subscription). The code keeps synced rows until the person deletes them or the owner deletes the account; it does
   not remove them when a trial or subscription ends. Decide whether that is what you want to promise.
