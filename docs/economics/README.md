# Elysia economic subsystem

This directory documents the additive economic subsystem. The subsystem pays for scarce services and compensates creators without turning money into community standing. It is deliberately separate from Supabase Auth, Commons profiles, `user_roles`, badges, review authority, moderation state, Developer Forge identity, publisher identity, and local installation authority.

## Constitutional boundary

Money may support Elysia, pay for a scarce service, compensate a creator, or grant a narrowly scoped entitlement. It may not purchase truth, trust, dignity, governance, moderation, review, publication approval, search placement, a safety tier, local installation authority, or control of the Commons.

The following are independent relationships:

| Relationship | Canonical system | Financial effect |
| --- | --- | --- |
| Website authentication | Supabase Auth | Identifies an account; never proves payment or authority. |
| Commons identity | `profiles` and Commons onboarding | Remains free; financial fields never belong in `profiles`. |
| Recognition | badge definitions and user badge awards | Never a balance, payment method, or permission source. |
| Governance/review | role and review-domain systems | Never inferred from orders, subscriptions, seller state, or entitlements. |
| Economic customer | private economic tables | Links an account to safe billing summaries; it is not public identity. |
| Sandbox access | operational sandbox policy plus private credit ledger | Credits can fund bounded runs but cannot change runtime isolation or safety permissions. |
| Marketplace seller | private seller and payout-readiness records | Financial/KYC readiness is distinct from developer trust, publisher verification, listing review, and installation. |
| Marketplace buyer | private order and license records | A license never installs, executes, approves, or trusts an add-on. |
| Job Post customer | private fee sidecar | Payment can satisfy a fee gate only after independent content review. |

## Provider-neutral flow

```text
browser
  -> same-origin /api/billing/*
     -> dedicated billing Worker (billing-only bindings; no sandbox code)
     -> economic RPC (creates pending internal state)
     -> payment-provider adapter (Stripe test rail initially)
     -> hosted checkout or hosted portal

Stripe webhook
  -> raw-body signature verification
  -> normalized, bounded event
  -> idempotent database processor
  -> internal order/payment/subscription/entitlement state
  -> safe account summary / non-canonical notification
```

The browser return URL is never payment truth. Only a verified provider event may move provider-backed economic state to a fulfilled state. Provider IDs, webhook payloads, operator notes, disputes, waivers, balances, seller income, and billing contact data are private.

For an account-linked checkout, the billing Worker and database require a recoverable Supabase Auth identity: the account must exist, be non-anonymous, have a confirmed nonblank email, not be deleted, and not have an active Auth ban. This is an economic-value recovery boundary, not a new community role or profile-completeness rule. Guest one-time support remains a deliberately separate path and is never matched back to an account by email.

Before Stripe Checkout is created for an account, the Worker obtains one server-managed test Customer with the stable per-user idempotency key `billing-customer:<auth-user-uuid>` and attaches that exact Customer to the pending internal order through `attach_economic_checkout_billing_customer`. The database locks the order, checks recoverability and provider/reference consistency, and records the attachment before a provider Session can exist. The Stripe Customer request intentionally sends no profile name, profile fields, phone number, or account email. Existing account-linked orders reuse the canonical private customer reference; concurrent first checkouts cannot establish competing account customers.

Verified financial events may arrive out of order. Payment truth is written first, then the order is projected once from durable transactions, refunds, and disputes: complete verified refund takes precedence, then an active or lost dispute, then partial refund, then paid. A delayed success event therefore cannot temporarily revive a refunded or disputed order and retrigger downstream fulfillment.

The billing Worker and the website/Pages sandbox Functions are separate deployments with disjoint bindings. Pages owns `/api/sandbox/*` and must not receive billing/Stripe/service-role secrets; the billing Worker owns `/api/billing/*` and must not receive sandbox/runner/Access secrets. Same-origin routing is a public UX property, not permission to share a secret-bearing runtime.

## Public experience

- Local Elysia remains free and local-first and does not require a website account for ordinary local use.
- Every ordinary official Local Elysia release has a genuinely equal zero-dollar path: no account, Stripe request, tracking gate, support choice, or webhook wait may stand between the person and the artifact. A release/product surface may separately link to voluntary one-time support using the `support_one_time` flow with source route `/products`; that order never owns, unlocks, signs, redirects to, or fulfills a download. The repository currently has no public release artifact, so this is a release-gate contract rather than a claim that a binary exists.
- SearXNG is locally operated, while actual searches contact external internet services.
- The online Commune coding sandbox is a separate scarce online service.
- Free Member and ordinary community participation remain free.
- Support is voluntary. Recurring support is never preselected and has a visible cancellation route.
- Stripe receives the information needed to process a payment. Stripe does not receive local Elysia memory, local files, conversations, Commune content, profile interests, private messages, or sandbox source code from the billing subsystem.
- Free, sponsored, waived, and purchased access are equivalent within the same service scope and do not create public rank.

## Safe defaults

Repository defaults are intentionally inert:

- billing mutations disabled;
- Stripe mode constrained to test keys;
- live Stripe disabled;
- webhook fulfillment disabled until an endpoint and secret are verified;
- paid sandbox enforcement disabled;
- Job Post fee enforcement disabled;
- paid Marketplace offers disabled;
- seller onboarding and payouts disabled;
- sponsorship display disabled;
- public support recognition disabled.

Free local use, existing community behavior, existing pre-economic Marketplace browsing, and existing sandbox safety controls do not depend on these flags.

The new economic Marketplace catalog has a narrower two-switch rule. `BILLING_MARKETPLACE_COMMERCE_ENABLED` must be enabled for that reviewed test-only catalog and free-license contract to exist at all. Once it is enabled, turning the global payment-acquisition switch `BILLING_ENABLED` off filters paid offers out but leaves free offers visible and free-license acceptance available. The free-license route does not call Stripe and does not grant installation authority. This allows financial acquisition to be stopped without turning a payment incident into loss of a reviewed free path.

## Settlement quarantine

Payment and fulfillment are separate facts. The repository has durable, private, RLS-enabled hold records for races in which eligibility changes while hosted Checkout is open:

- `private.marketplace_fulfillment_holds` prevents a paid offer from creating a license, entitlement, commission, seller payable, approval, or installation authority when the offer, seller readiness, publication, or reviewed version is no longer eligible. Later paid projections cannot revive a held purchase.
- `private.job_post_payment_holds` keeps the post unpublished when paid settlement arrives after anti-scam/content eligibility is lost or a scoped Job Post restriction applies. It does not create a moderation punishment.
- `private.organization_sponsorship_settlement_holds` quarantines late settlement and terminal-after-settlement races. Organization service activation is suspended; sponsorship activation and public recognition are withheld. Auth recoverability, current authorized-signer membership, organization state, price/consent versions, and independent review state remain authoritative.

These holds are not resolved by an operator assertion, partial refund, dispute outcome, later success event, or restored eligibility. Their automatic resolution path requires durable verified refunds covering the full verified payment. Organization/sponsorship hold events and shared economic audit events remain private and immutable under the repository ACL contract; the hold status rows change only through their bounded reconciliation functions. A hold never changes Commons identity, badges, governance, moderation, developer approval, or publisher trust.

## Marketplace seller offer lifecycle

The private Marketplace Account view recovers configured offers from the canonical seller-status projection; it does not rely on browser memory from the configuration response. The projection returns at most 100 owned offers, 100 eligible reviewed versions, and 50 owned publisher options together with exact total counts and truncation flags. The browser must say when a bounded list is incomplete and must never present omitted records as absent or deleted.

Configuration creates a new inactive draft or safely revises the existing revisable draft for the same reviewed version. A revision reloads the economic terms from the private projection, remains bound to the reviewed version, and is revalidated by the server. Offer availability is a separate durable, UUID-idempotent action with status-specific confirmation: a draft may become active or retired, an active offer may be suspended or retired, a suspended offer may be reactivated or retired, and retirement is terminal for that offer record. Ambiguous browser failures reuse the unchanged request UUID; changing an input starts a new request. No offer action changes developer status, publisher verification, listing review/publication, trust, rank, download eligibility, local installation authority, or governance.

## Operating rule

Every manual economic mutation needs a named capability, a bounded object, an actor, a reason, a timestamp, and an audit event. Community administrator or moderator status does not imply an economic capability. Economic operators do not receive moderation or publication authority.

See also:

- [Stripe test-mode activation](../deployment/stripe-test-mode-economic-system.md)
- [Economic threat model](../security/economic-system-threat-model.md)
- [Accounting export contract](./accounting-export-contract.md)
- [Account lifecycle and financial retention](./account-lifecycle-and-financial-retention.md)
- [Economic legal-content integrity](./legal-content-integrity.md)
- [Read-only Supabase preflight](../deployment/supabase-read-only-economic-preflight.md)
