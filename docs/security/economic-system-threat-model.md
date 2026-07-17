# Economic system threat model

## Protected assets

- payment and provider credentials;
- private economic identity and history;
- provider event integrity and idempotency;
- customer and seller privacy;
- sandbox balances and reservations;
- Marketplace licenses, commissions, payables, and payout state;
- Job Post fee state;
- economic operator capability and audit history;
- continued independence of community governance, review, moderation, and recognition.

## Trust boundaries

The browser is untrusted for amounts, price/provider identifiers, payment status, entitlement grants, refunds, licenses, balances, seller readiness, and operator authority. Stripe-hosted Checkout/Portal are external processors. A redirect back from Stripe is untrusted. Signed webhooks are provider evidence but still require bounded parsing, freshness checking, idempotency, lifecycle validation, and the expected Stripe account context. The economic webhook is platform-account-only and rejects any event with a non-null top-level `account`; Connect readiness is polled through a separate authenticated path. Supabase row policies are not a substitute for revoking direct table grants and public function execution.

The dedicated billing Worker must never execute user code. The Pages/sandbox runtime and external runner must never receive payment, webhook, provider, payout, or service-role secrets. Billing and sandbox are separate Cloudflare deployments, not merely separate URL handlers in one secret-bearing runtime: the billing Worker exclusively owns `/api/billing/*` and billing bindings, while Pages owns `/api/sandbox/*` and sandbox bindings. A binding configured on the wrong runtime is an exposure even when current source does not reference it.

## Required controls

- exact-origin checks for browser mutations;
- strict method, content-type, key, length, enum, amount, currency, and UUID validation;
- test-key enforcement and a hard live kill switch;
- server-side catalog resolution rather than browser-supplied provider IDs;
- hosted checkout and portal URLs validated as HTTPS provider URLs;
- raw-body webhook signature verification before parsing;
- bounded event normalization with no raw provider object stored as canonical state;
- provider-event uniqueness and transactionally idempotent fulfillment;
- safe handling of duplicate and out-of-order events by deriving final order state only after durable payment, refund, and dispute records exist;
- recoverable account gating for economic value: existing non-deleted, non-anonymous Auth identity with a confirmed nonblank email and no active Auth ban, without turning that check into community standing;
- one canonical server-managed provider Customer per account, attached to the internal order before hosted Checkout creation with a stable per-user idempotency key and no email-text ownership matching;
- append-only financial and operator audit events where practical;
- private tables with RLS, no public read, and no browser writes to financial truth;
- narrow security-definer RPCs with explicit actor checks, fixed search paths, qualified names, and revoked `PUBLIC` execution;
- service-role-only account-action mutation with the actor derived from a Worker-verified bearer token, never a browser-supplied actor field;
- service-role-only support and sponsorship recognition RPCs behind environment-gated, minimal public HTTP projections;
- economic capabilities independent of community roles;
- no logs containing secrets, signatures, tokens, card/KYC data, source code, or private evidence;
- a static, test-checked billing route manifest and a dedicated same-origin Worker route that cannot dispatch `/api/sandbox/*`;
- Pages Functions routing limited to `/api/sandbox/*`, with no `BILLING_*`, `STRIPE_*`, webhook, payout, or Supabase service-role binding;
- no `SANDBOX_*`, Access, runner, or finalizer credential on the billing Worker;
- deployment verification that unknown billing paths fail with the bounded Worker response and do not fall through to Pages;
- no negative sandbox balances, atomic reserve/consume/release, and no safety-tier changes from credit source;
- separate content review and fee satisfaction for Job Posts;
- separate review/publication, commercial offer, buyer license, and local installation for Marketplace add-ons;
- durable private Marketplace, Job Post, organization-service, and sponsorship settlement holds that withhold fulfillment after eligibility races and resolve only from complete verified refund evidence;
- continued free Marketplace offer and free-license availability when only the global payment-acquisition kill switch is disabled;
- SHA-256 binding between canonical economic legal text, active database document versions, consent bundles, server parsing, and browser parsing;

## Abuse cases that must fail

- changing a browser amount, price code, currency, or Stripe ID;
- treating a `success` query parameter as payment truth;
- replaying a checkout request or webhook to duplicate fulfillment;
- racing two first account checkouts to establish different Stripe Customers;
- sending an old but validly signed event outside the tolerance window;
- delivering payment success after a refund/dispute to transiently restore `paid` and retrigger fulfillment;
- restoring eligibility or winning a dispute to bypass an unresolved fulfillment/settlement hold;
- using a community administrator token to acquire finance access;
- using a payment to acquire a role, badge credit, review status, ranking, or publication;
- purchasing a Marketplace offer to install or execute an add-on;
- using a dispute or failed payment to ban a community account;
- learning another customer’s history through an opaque-reference lookup;
- learning waiver, subsidy, payout, balance, or support amount from public profile/notification data;
- exhausting credits concurrently below zero;
- changing paid enforcement to weaken the sandbox network, filesystem, runtime, or moderation policy;
- using the global payment-acquisition kill switch to remove a reviewed free Marketplace license path;
- treating a legal version label as consent while the displayed content SHA-256 differs;
- estimating processor fees or net settlement when Stripe balance-transaction evidence has not been recorded;
- attaching a billing or service-role secret to Pages because billing and sandbox share a public hostname;
- attaching a sandbox/Access credential to the billing Worker or routing either API namespace to the wrong runtime;

## Incident response

Disable the smallest affected financial feature first. Preserve provider events, internal audit, immutable accounting history, and evidence access controls. A billing incident must not automatically suspend unrelated Commons participation. A sandbox safety incident must use the sandbox kill switches and must not expose billing secrets. If route ownership or binding isolation is uncertain, disable billing mutations, remove the wrongly scoped binding in its owning control plane, rotate the affected credential, and re-run the isolation checks; never copy the secret to the other runtime to restore service. Remediation uses reviewed forward migrations and code changes, never destructive baseline rewriting.
