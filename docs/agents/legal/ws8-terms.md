NEEDS HUMAN REVIEW

# WS8 draft: Terms and Conditions changes for the extra sign-in methods

Status: DRAFT. Not published. `src/pages/TermsPage.tsx` has not been edited. Publish together with turning on the
matching sign-in flag(s).

## Current text that becomes inaccurate

Section 6, "User Accounts": *"You must sign in with a Google account to use the Service. You are responsible for
maintaining the security of your account. We reserve the right to terminate accounts that violate these Terms."*

## Proposed replacement for section 6

> **6. User Accounts**
> To use the Service you sign in with Google, with Apple, with Microsoft, or with a link we send to your email
> address, depending on the options available when you sign in. You are responsible for the accounts and the email
> inbox you use to sign in: anyone who can sign in to those, or who can open an emailed sign-in link sent to your
> address, can use your Stop Biting account. Keep them secure and tell us at hello@stopbiting.today if you think
> someone else has access.
>
> If you sign in with more than one method and each confirms the same email address, they open the same account. You
> may have only one account for the same email address; we may merge accounts that belong to the same person at your
> request. We reserve the right to terminate accounts that violate these Terms.

## Points for the reviewer

1. "Anyone who can open an emailed sign-in link" is a plain statement of how a link works (it signs in whoever
   opens and confirms it, once, within 15 minutes). Confirm you are comfortable with that being stated.
2. The sentence about merging accounts at the user's request describes a support process that does not exist in code
   yet (there is no merge tool). Remove it if you do not want to promise it.
3. The "one account per email address" sentence reflects the linking rule only for addresses the provider confirms.
   Someone who signs in with a Microsoft work or school account that does not confirm its email address gets a
   separate account. If that matters for the terms, say so.
4. Section on termination, subscriptions and refunds: no change is needed for the new methods, but note that a
   subscription belongs to the account, not to the sign-in method.
