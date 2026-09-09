# Account lifecycle and financial retention

This is the repository operating contract for account closure when economic records exist. Final retention periods and legal bases require approved privacy, tax, accounting, consumer-protection, and Marketplace policies before live payments.

## Separate actions

An account request can involve several independent actions. No single browser button may collapse them:

1. stop recurring billing through the provider-hosted cancellation path;
2. revoke active sessions where supported;
3. deactivate the public Commons profile;
4. stop new community activity while applying the existing content-retention/moderation policy;
5. revoke or expire narrowly scoped unused entitlements under their terms;
6. unlink a provider customer from active account use where legally and operationally possible;
7. preserve required accounting, refund, dispute, fraud-prevention, seller-payable, tax, consent, and audit records under restricted access;
8. anonymize optional account linkage after retention requirements and unsettled obligations permit it.

Closing or deactivating a Commons identity does not rewrite settled transaction history. A failed payment or chargeback does not become a general community ban. A community suspension does not silently cancel, refund, confiscate, or publicly reveal private economic value.

## Implemented economic-only request handling

The repository now implements an assisted, audited request workflow for an economic data export and for closure of new economic acquisition. It is not general account deletion, Commons deactivation, an Auth-user deletion request, or a promise of immediate erasure. The authenticated owner sees a bounded closure-readiness projection and must explicitly acknowledge that financial records are retained and the Auth/Profile identity is unchanged. The operator workflow uses a separate economic capability, private reason, idempotency key, and immutable audit event.

`BILLING_ACCOUNT_LIFECYCLE_ENABLED` must remain `false` until an approved private artifact process exists for user exports. The repository records only the request, workflow state, artifact SHA-256, and expiration; it intentionally stores no artifact bytes, storage locator, or signed download URL. An operator must not mark an export completed merely because a syntactically valid hash exists: completion requires an artifact prepared and delivered through an approved private process outside this repository. This release does not claim repository-verifiable artifact generation or delivery.

Economic closure may complete only after the database reports no blocking active subscription, unsettled order, refund, dispute, reconciliation, seller payable/payout preparation, Marketplace or Job Post fulfillment, or organization/sponsorship signer duty. A recurring subscription with an authoritative end-of-period cancellation is shown separately as `scheduledSubscriptionCancellations`; it is informational rather than blocking. Cancellation must remain available through the provider-hosted Customer Portal even when new checkout acquisition is disabled.

On completion, the system imposes only the exact `billing` service restriction used to stop new economic acquisition. It does not ban or suspend the Commons account, remove a profile, delete posts, change governance or moderation roles, revoke earned Marketplace licenses, or confiscate remaining sandbox credits. Transaction, consent, refund, dispute, payable, audit, receipt-summary, license, and credit history stays privately retained under the applicable policy. Any later general identity deactivation or deletion remains a separate account-system process and legal decision.

The UI must continue to direct broader privacy, Auth, profile, content, or erasure requests to the appropriate support/privacy route and must not imply that this economic workflow handles them. Staff must verify control of the account, enumerate affected scopes, disclose retained records, and keep private reasons out of public content.

The locally prepared Job Post participant intake adds `private.job_post_economic_requests` to this inventory: Job Post/account references, optional reason category, bounded explanation, latest operator reply, handling state and timestamps. Include the owner's records in any authorized assisted economic export. Its minimal action history is in the existing economic audit events; it is not public profile or content-review data. Withdrawal retains the request and does not erase financial evidence or revoke assistance. Do not infer a retention duration, automatically delete these rows, or promise complete account erasure. The owner workspace provides account-scoped, paginated access while the account remains eligible; wider export/deactivation handling retains the existing assisted privacy route and authorization requirements.

## Content and licenses

Posts, comments, reviews, moderation evidence, Marketplace publication history, buyer licenses, security revocations, and audit events have separate retention rules. Public identity may be deactivated or anonymized without falsely attributing historical content to another person. A Marketplace refund does not automatically erase a security revocation; a security revocation does not by itself decide the refund.

## Recovery and continuity

Password recovery restores access to the same Supabase Auth identity. It must not create a new `profiles` row, infer identity from a checkout email, transfer value by matching email text, or bootstrap a replacement billing customer. Manual value transfer requires a separately authorized, audited process with strong evidence and no public disclosure.

New account-linked economic acquisition requires that same Auth identity to remain recoverable: it must be non-deleted, non-anonymous, have a confirmed nonblank email, and have no active Auth ban. This check protects continuity of paid value and is independent of Commons onboarding, profile completion, Free Member recognition, badges, or governance. A recovery flow must restore the original identity and its canonical private billing-customer linkage; it must never create a second Stripe Customer by matching an email string.

## Prohibited shortcuts

- deleting `auth.users` before dependent identity/economic relationships are inventoried;
- cascading deletion of accounting or payout history;
- orphaning storage, profile, seller, license, entitlement, or ledger rows;
- reusing an old public handle or economic reference without an explicit policy;
- exposing a closure reason, waiver, dispute, or financial status on a public profile;
- claiming complete erasure while processors or legally retained records still exist.
