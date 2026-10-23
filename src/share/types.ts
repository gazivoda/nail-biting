// Share links, client side (WS10). The server's answers, as the Settings card uses them.
// A link is never stored on this device: the full address exists in memory for as long as
// the "Your link" panel is open and is gone after that (the server keeps only a hash).

export interface ShareLink {
  id: string;
  /** The owner's private note. Never shown to the person who opens the link. */
  label: string;
  createdAt: number;
  /** Epoch ms, or null for a link that does not expire. */
  expiresAt: number | null;
  /** Epoch ms of the last time someone opened it, or null if nobody has. */
  lastViewedAt: number | null;
  /** True when the link also shows calendar dates and a time-of-day chart. */
  detailed: boolean;
}

/** What creating a link returns, once. `url` contains the secret. */
export interface CreatedLink extends ShareLink {
  token: string;
  url: string;
}

export interface ShareList {
  links: ShareLink[];
  /** How many active links one account may have. */
  max: number;
  /** How many live entries of this account's history the server holds (0: nothing synced). */
  syncedEntries: number;
}

export type ExpiryChoice = 7 | 30 | 90 | null;

export interface CreateInput {
  label: string;
  expiresInDays: ExpiryChoice;
  detailed: boolean;
  /** IANA zone, so "a day" on the shared page is the owner's day. */
  timezone: string;
}

/** `status` 0 means no answer at all (offline). */
export type ShareResult<T> = { ok: true; value: T } | { ok: false; status: number };
