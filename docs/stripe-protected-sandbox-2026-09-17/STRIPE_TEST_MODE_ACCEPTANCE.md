# Sandbox acceptance plan — September 17, 2026

## Execution boundary

**Stripe provider acceptance: NOT RUN, deliberately not started.** This stage authorizes the protected UI and dynamic-method implementation only. Do not mark any database qualification timestamp or enable a money gate on the basis of local synthetic tests.

The isolated database is fully replayed: 74 migrations through `20260915070000`. The September 16 replay packet remains authoritative for ledger/schema/RLS/function checks; no new SQL justifies repeating that audit. The separate frontend and backend are deployed against this sandbox only. Owner Access setup, an actual authorized Access login and the private identity backend binding remain prerequisites. Stripe test configuration comes afterward, under a separately resumed acceptance task.

## Completed application qualification

- Full `test:stripe-first-party` suite: integer money, server-owned amounts, all first-party adapter lanes, signatures, durable inbox/deduplication contracts, outbound idempotency, recurring/event ordering, refunds/disputes, mode isolation, third-party boundaries, provisioning/preflight, legal and navigation contracts.
- Dynamic-method policy tests: non-card methods propagate; no `payment_method_types` request; missing/wrong-mode/default/Connect/inactive configurations fail; unavailable/BNPL/OXXO/crypto/unknown enabled methods fail; managed-config sync is idempotent; global-preference drift fails preflight.
- Protected Worker tests: synthetic signed RS256 Access JWT; absent/forged/expired/wrong-AUD/wrong-issuer denial; private assets and APIs; exact raw-body webhook exception; direct billing protection; no production database/origin fallback.
- Built browser tests: homepage, Forge, Creator Studio, account, Support and account billing pages render behind synthetic signed Access; sandbox banner/publication disabled; no production Supabase or Stripe requests.
- Application and function type checks, auth/Turnstile contract and Artisan smoke checks passed. Clean source build and all three deployment dry runs passed.
- Deployed unauthenticated/forged assertions and path variants: 19 checks passed. Exact webhook POST reaches the disabled billing guard (503); other routes are denied (403). This proves current remote fail-closed behavior, not actual provider HMAC delivery or authorized remote Access sign-in.

An extra historical `routePreservationContractTest.mjs` run found its old exact-equality header snapshot does not include the already-approved Creator Studio discoverability link. This is a pre-existing mismatch; neither the route contract nor the public navigation was modified in this stage. Current navigation and sandbox browser tests pass. No historical route was removed or rewritten to satisfy the obsolete snapshot.

## Future provider cases after prerequisites and renewed task authorization

Use the [master-plan case list and original acceptance packet](../stripe-first-party-2026-09-15/STRIPE_TEST_MODE_ACCEPTANCE.md) for the economic assertions, with the card-only section superseded here. Record expected/actual state, opaque sandbox object/event IDs, mode, DB ledger effects and artifact hashes. Retain no credentials, full webhook bodies, customer PII, receipt URLs, cookies or Access assertions.

| Area | Required provider evidence |
|---|---|
| Own-account configuration | Restricted runtime key exercises each required endpoint; account, API version, sandbox catalog/Portal/PMC IDs match; wrong-mode keys/objects denied |
| Dynamic methods | Dedicated own-account PMC reflects enabled and available default preferences; enabled eligible non-card method appears; ineligible currency/geography/recurrence method is filtered by Stripe; no hard-coded card list |
| Exclusions | BNPL/financing, OXXO and crypto never offered; tampered/unknown/unavailable/default/Connect PMC fails before Checkout; changing global preferences causes preflight drift until controlled sync |
| Recurring eligibility | Recurring Support uses the same validated PMC; Stripe offers only subscription-compatible methods; signup, renewal, failed invoice and customer/subscription metadata settle correctly |
| One-time Support | Preset/custom bounds; server amount/currency vs browser tampering; success/cancel/decline; receipt/acknowledgment; zero governance/status/compute effects |
| Delayed methods | Session completion while unpaid stays pending; async success/failure and late settlement converge; replay/out-of-order events never duplicate ledger entries; redirects never set success |
| Webhook transport | Exact registered URL reaches backend without Access interaction; valid raw-body HMAC accepted only in separately authorized test mode; invalid/missing/old signatures and version/mode mismatches denied |
| Retry/idempotency | Repeated outbound action reuses idempotency key; inbox survives retry; duplicates, retries and out-of-order subscription/invoice/refund/dispute events converge |
| Portal | Protected return origin; invoice history and method update; cancellation at period end without proration; plan updates OFF; ordinary account membership preserved |
| Refunds/disputes | Provider-confirmed receipt/payment/refund truth; partial/full/failure/late updates; disputes and funds reinstatement; reconciliation of fees/net; no redirect-based accounting |
| Commercial Job Post | Free/exempt/waived/reduced/$10/declined/refunded paths; authorized governance controls; payment cannot buy publication, priority or ranking |
| Organization/service | Only existing approved server-owned agreement/catalog; ownership and capability denial; no fabricated business terms or browser prices; payment/refund/invoice evidence |
| Sponsorship | Only actually defined governed first-party lane; separate eligibility/recognition controls; if no approved record exists, keep lane OFF and record not applicable |
| Isolation and kill switches | Only synthetic sandbox users/data; every lane can be independently disabled; test/live mismatch rejected; production unchanged |
| Third-party boundary | Connect, connected sellers, KYC/bank onboarding, paid creator offers, third-party checkout, payouts/settlement, paid compute/credits and hardware commerce remain impossible; free creator flows work |

The current economic catalog is USD. Do not invent foreign-currency products or unsupported orders just to make a local method appear. Qualify methods applicable to the real catalog and record provider-filtered methods as ineligible/not exercised. Globally enabled methods do not override provider rules. Do not broaden capabilities or permissions to force a method.

Use Stripe-hosted test interactions and provider-documented delayed-payment scenarios; separate synthetic event fixtures from actual provider evidence. No test PAN is collected by the application. No method is declared qualified just because a PMC GET or a local test passed.

## Acceptance gate remains closed

The read-only preflight explicitly reports `paymentAcceptance=NOT_RUN`. Access, rate-limit and first-party preflight confirmation flags remain false until supported by actual evidence. This plan opens no lane, creates no Stripe objects and requests no live credentials. Tax dispositions, production business/payout/receipt checks and live activation remain later independent gates.
