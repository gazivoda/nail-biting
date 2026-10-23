import { describe, it, expect } from 'vitest';
import {
  MS_PERSONAL_TENANT, appleAssertion, decideSignIn, googleAssertion, isLegacyGoogleUserId,
  microsoftAssertion, pickLinkTarget, truthy,
} from './linkPolicy.js';
import { normalizeEmail } from './emailAddress.js';

describe('normalizeEmail', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Ann.Lee@Example.COM ')).toBe('ann.lee@example.com');
  });
  it('keeps +tags (a different mailbox as far as we can tell)', () => {
    expect(normalizeEmail('ann+news@example.com')).toBe('ann+news@example.com');
  });
  it.each([
    [undefined], [null], [42], [''], ['plain'], ['a@b'], ['@example.com'], ['a@@example.com'],
    ['a b@example.com'], ['a@example.com\nBcc: x@y.com'], ['a@exam ple.com'], ['a,b@example.com'],
    ['a@example..com'], ['a@.example.com'], ['a@example.c'], ['<a@example.com>'], [`${'x'.repeat(65)}@example.com`],
  ])('rejects %j', raw => {
    expect(normalizeEmail(raw)).toBeNull();
  });
});

describe('what each provider vouches for', () => {
  it('truthy accepts the shapes providers use', () => {
    for (const v of [true, 'true', 1, '1']) expect(truthy(v)).toBe(true);
    for (const v of [false, 'false', 0, '0', undefined, null, '', 'yes']) expect(truthy(v)).toBe(false);
  });

  it('Google: verified only when email_verified is true', () => {
    expect(googleAssertion({ email: 'A@x.com', email_verified: true })).toEqual({ email: 'a@x.com', verified: true });
    expect(googleAssertion({ email: 'a@x.com', email_verified: false }).verified).toBe(false);
    expect(googleAssertion({ email: 'a@x.com' }).verified).toBe(false);
    expect(googleAssertion({}).verified).toBe(false);
  });

  it('Apple: email_verified arrives as boolean or string', () => {
    expect(appleAssertion({ email: 'a@x.com', email_verified: 'true' })).toMatchObject({ verified: true, isRelay: false });
    expect(appleAssertion({ email: 'a@x.com', email_verified: true }).verified).toBe(true);
    expect(appleAssertion({ email: 'a@x.com', email_verified: 'false' }).verified).toBe(false);
    expect(appleAssertion({ email_verified: 'true' })).toMatchObject({ email: null, verified: false });
  });

  it('Apple: a private relay address is flagged (by claim or by domain) and still counts as verified', () => {
    const byClaim = appleAssertion({ email: 'x@y.com', email_verified: 'true', is_private_email: 'true' });
    expect(byClaim).toMatchObject({ isRelay: true, verified: true });
    const byDomain = appleAssertion({ email: 'abc123@privaterelay.appleid.com', email_verified: true });
    expect(byDomain).toMatchObject({ isRelay: true, verified: true });
    // is_private_email is not always present: the domain alone is enough
    expect(appleAssertion({ email: 'abc@privaterelay.appleid.com', email_verified: true, is_private_email: undefined }).isRelay).toBe(true);
  });

  describe('Microsoft (nOAuth)', () => {
    const WORK_TENANT = '11111111-2222-3333-4444-555555555555';

    it('personal Microsoft accounts: the email counts as verified', () => {
      expect(microsoftAssertion({ email: 'Bob@Outlook.com', tid: MS_PERSONAL_TENANT }))
        .toEqual({ email: 'bob@outlook.com', verified: true, reason: 'personal_account' });
    });

    it('work or school tenant WITHOUT a verification signal: the email is only a hint', () => {
      expect(microsoftAssertion({ email: 'ceo@victim.com', tid: WORK_TENANT }))
        .toEqual({ email: 'ceo@victim.com', verified: false, reason: 'unverified' });
    });

    it('work or school tenant with xms_edov true: verified (boolean or string)', () => {
      expect(microsoftAssertion({ email: 'a@corp.com', tid: WORK_TENANT, xms_edov: true })).toMatchObject({ verified: true, reason: 'xms_edov' });
      expect(microsoftAssertion({ email: 'a@corp.com', tid: WORK_TENANT, xms_edov: '1' })).toMatchObject({ verified: true });
    });

    it('xms_edov false or absent does not verify', () => {
      expect(microsoftAssertion({ email: 'a@corp.com', tid: WORK_TENANT, xms_edov: false }).verified).toBe(false);
      expect(microsoftAssertion({ email: 'a@corp.com', tid: WORK_TENANT, xms_edov: 'false' }).verified).toBe(false);
    });

    it('preferred_username and upn are never used as a verified email', () => {
      expect(microsoftAssertion({ preferred_username: 'a@corp.com', upn: 'a@corp.com', tid: MS_PERSONAL_TENANT }))
        .toEqual({ email: null, verified: false, reason: 'no_email' });
    });

    it('no email claim: nothing to link on', () => {
      expect(microsoftAssertion({ tid: MS_PERSONAL_TENANT })).toMatchObject({ email: null, verified: false });
    });
  });
});

describe('pickLinkTarget', () => {
  it('prefers a paying account, then the oldest', () => {
    const users = [
      { id: 'b', created_at: '2026-02-01', subscription_status: 'trial' },
      { id: 'a', created_at: '2026-01-01', subscription_status: 'trial' },
      { id: 'c', created_at: '2026-03-01', subscription_status: 'active' },
    ];
    expect(pickLinkTarget(users).id).toBe('c');
    expect(pickLinkTarget(users.slice(0, 2)).id).toBe('a');
    expect(pickLinkTarget([])).toBeNull();
  });
});

describe('isLegacyGoogleUserId', () => {
  it('Google subjects are decimal strings; our own ids are not', () => {
    expect(isLegacyGoogleUserId('112233445566778899001')).toBe(true);
    expect(isLegacyGoogleUserId('6f1c2e1a-0000-4000-8000-000000000000')).toBe(false);
    expect(isLegacyGoogleUserId('')).toBe(false);
    expect(isLegacyGoogleUserId(undefined)).toBe(false);
  });
});

describe('decideSignIn', () => {
  const verified = { email: 'ann@x.com', verified: true };
  const unverified = { email: 'ann@x.com', verified: false };
  const target = { id: 'user-1', created_at: '2026-01-01' };

  it('an identity we already know always wins', () => {
    expect(decideSignIn({ identityUserId: 'u9', assertion: unverified, linkTargets: [target], emailInUse: true }))
      .toEqual({ action: 'existing', userId: 'u9' });
  });

  it('verified email + a verified-backed account with that email: link', () => {
    expect(decideSignIn({ identityUserId: null, assertion: verified, linkTargets: [target], emailInUse: true }))
      .toEqual({ action: 'link', userId: 'user-1' });
  });

  it('verified email, nobody has it: create, and the account may carry the email', () => {
    expect(decideSignIn({ identityUserId: null, assertion: verified, linkTargets: [], emailInUse: false }))
      .toEqual({ action: 'create', storeEmail: true });
  });

  it('verified email, but the only account with it is NOT verified-backed: do not link, create', () => {
    expect(decideSignIn({ identityUserId: null, assertion: verified, linkTargets: [], emailInUse: true }))
      .toEqual({ action: 'create', storeEmail: true });
  });

  it('UNVERIFIED email that matches an existing account: blocked, never linked', () => {
    expect(decideSignIn({ identityUserId: null, assertion: unverified, linkTargets: [target], emailInUse: true }))
      .toEqual({ action: 'blocked_unverified' });
  });

  it('UNVERIFIED email nobody has: create, but the account must not carry the email', () => {
    expect(decideSignIn({ identityUserId: null, assertion: unverified, linkTargets: [], emailInUse: false }))
      .toEqual({ action: 'create', storeEmail: false });
  });

  it('no email at all: create an email-less account', () => {
    expect(decideSignIn({ identityUserId: null, assertion: { email: null, verified: false }, linkTargets: [], emailInUse: false }))
      .toEqual({ action: 'create', storeEmail: false });
  });
});
