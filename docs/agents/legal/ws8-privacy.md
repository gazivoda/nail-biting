NEEDS HUMAN REVIEW

# WS8 draft: Privacy Policy changes for the extra sign-in methods

Status: DRAFT. Not published. `src/pages/PrivacyPage.tsx` has not been edited. Publish these together with turning
on the matching flag (`signin_magic_link`, `signin_apple`, `signin_microsoft`), not before. Wording that describes
facts about the code is checked against the code; everything else (legal basis, retention periods you promise,
processor names) is for the owner or a lawyer to confirm.

## What the code actually does (facts to check the wording against)

- **Emailed link.** We store the address you type, a one-way hash of the link's secret (never the secret itself),
  when the link was created and when it expires, whether it was used, and the IP address of the device that asked
  for it. These rows are deleted about 24 hours after the link expires. The email is sent through Resend (the same
  provider as the welcome email). A valid address always receives a link, whether or not it has an account.
- **Sign in with Apple.** We receive Apple's identifier for you, your name (only the first time you use it) and either
  your email address or, if you choose "Hide My Email", an Apple relay address that forwards to you. We do not
  receive your Apple password.
- **Sign in with Microsoft.** We receive an identifier made of your Microsoft tenant and user id, your display name,
  and your email address when Microsoft provides one. We do not receive your Microsoft password. For work or school
  accounts Microsoft may not confirm the email address; then we do not store it on your Stop Biting account.
- **Accounts and linking.** If you sign in with two methods that both confirm the same email address, they open the
  same account. We keep a record of which methods you have used (`auth_identities`: method, the provider's id for you,
  the address the provider gave us, whether it was confirmed, when).
- **Cookies.** The session cookie `nh_session` is the same as for Google sign-in. During Apple or Microsoft sign-in a
  short-lived HttpOnly cookie (`sb_oauth_apple` or `sb_oauth_microsoft`, 10 minutes) protects the sign-in against forgery.
  The emailed link needs no extra cookie.
- **State kept during sign-in.** While an Apple or Microsoft sign-in is in progress we keep a random state value, a
  nonce and (Microsoft) a code verifier in our database for at most 10 minutes. They are deleted when the sign-in
  finishes or expires.
- Camera data and your habit log are not involved in any sign-in method and are not sent.

## Proposed replacement text

### Section 5, "Authentication" (replaces the current paragraph)

> You can sign in with Google, with Apple, with Microsoft, or with a link we email you, depending on which options
> are available when you sign in. Google, Apple and Microsoft tell us who you are without sharing your password with
> us: we receive your name and email address (or an Apple relay address if you choose to hide your email), a
> provider-specific identifier, and, from Google, your profile picture. If you use the emailed link we receive only
> the email address you enter. If you sign in with more than one method and each confirms the same email address,
> they open the same Stop Biting account. If a provider does not confirm your email address, we do not store it on
> your account and do not join the account to another one by email. Your session is maintained via a secure,
> HttpOnly cookie that expires after 14 days.

### Section 7, "Third Parties" (add to the list)

> Apple: sign-in with Apple, if you choose it.
> Microsoft: sign-in with Microsoft, if you choose it.
> Resend: sends the emails we send you, including sign-in links.

(Keep "None of them receive camera data or your habit log." Do not add wording such as "nothing leaves your device".)

### Section 8, "Data Storage" (add)

> For sign-in we also store, for as long as your account is active, a record of the sign-in methods you have used
> (the method, the provider's identifier for you, and the email address it gave us). Emailed sign-in links are stored
> only as a one-way hash, together with the address they were sent to and the requesting IP address, and are deleted
> about 24 hours after they expire.

### Section 9, "Data Retention" (add, if the owner agrees to the period)

> Sign-in link records are deleted about 24 hours after the link expires.

### Section 10, "Cookies" (replace the Google sign-in sentence)

> During sign-in with Google, Apple or Microsoft a short-lived HttpOnly cookie (5 to 10 minutes) protects the login
> against forgery. It is removed when the sign-in finishes.

## Questions for the owner / reviewer

1. Is keeping the requesting IP address for the emailed link (about 24 hours, for abuse handling) acceptable, and is it
   described adequately? (It can be removed: `created_ip` is only an audit column.)
2. Apple and Microsoft act as independent controllers of their own sign-in data: confirm how you want to refer to
   their policies.
3. If you serve users where consent or a stated legal basis is required, the basis for processing sign-in data
   (performance of a contract) belongs here; the current policy does not state bases, so none are drafted.
4. The Apple relay address: confirm you register your sending domain with Apple's private relay service (see
   `docs/agents/ws8-notes.md`); otherwise emails to those users are not delivered and the policy should not promise
   them.
