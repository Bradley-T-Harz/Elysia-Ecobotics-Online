# First-party Stripe sandbox acceptance — 2026-09-17

Scope: isolated Supabase `kdtqyxlrkpmlpupzgmwv`, Stripe sandbox `acct_1UGdHORrIWWoUVPh`, billing Worker `elysia-first-party-billing-sandbox`. Protected UI origin: https://elysia-ecobotics-online-sandbox.bradleytharz3407.workers.dev. Production, Access policies, free creator workflows, public releases and live credentials were not changed.

**Status: BLOCKED — canonical webhook-configuration preflight requires the owner-held setup key; runtime correctly returns HTTP 403.** All executed payment acceptance cases below passed.

## Provider verification

[References](provider-references.json) are non-secret, supplied by Bradley and checked against the bound runtime key: three active test Products, five USD monthly Prices, period-end cancellation Portal configuration and dedicated dynamic Payment Method Configuration all passed. Seven canonical database catalog mappings were recorded. No additional provider Products/Prices or Portal configurations were invented.

The hosted USD Checkout offered card, Cash App, WeChat Pay and US bank account. Dynamic eligibility remains provider-controlled. The dedicated configuration excludes BNPL, crypto and OXXO. See [provider inspection](provider-inspection.json).

**Preflight gap:** `GET /v1/webhook_endpoints` returns HTTP 403 with the intentionally restricted runtime key. Bradley attested the exact 20-event account endpoint and Acacia version; this execution independently proved signed deliveries and pinned-version parsing, but cannot certify endpoint configuration through the canonical GET-only preflight. Do not expand runtime permissions or disclose the setup key.

## Acceptance evidence

| Case | Result / evidence |
|---|---|
| One-time Support, successful card | Real hosted $5 test payment; signed events produced exactly one payment and provider receipt |
| Declined card | Real test decline and processed `payment_intent.payment_failed`; no success inferred |
| Recurring Support | Real $5/month subscription and `invoice.paid`; one recurring payment |
| Customer Portal / cancellation | Real Portal session and cancellation; signed subscription update confirms `cancel_at_period_end=true`, canonical status `canceling` |
| Full refund / replay | Real $5 refund through two-operator approval; provider-confirmed succeeded, repeat request returns idempotent replay |
| Dispute | Stripe dispute test card; signed dispute-created and funds-withdrawn events processed; canonical dispute needs_response |
| Job Post $10 | Real canonical assessed fee and paid hosted Checkout; satisfied condition. Content had separate prior reviewed_clear approval; payment did not create review/ranking |
| Governed reduction / waiver | Remote rollback-only canonical RPC tests; $10 to $5 reduction, idempotent retry, scoped waiver without order/payment; neither can publish a draft |
| Async successful/failed payment | Real signed async-success and async-failure events. Both initial completions were unpaid; success produced exactly one payment, failure zero payments and one failure record. See async-provider-outcomes.json |
| Webhook security | Real exact webhook route rejects missing/invalid signature with 400; real signed events processed with pinned API contract |
| Durable duplicates / ordering | Previously verified payment event replayed twice after its refund: duplicate, unchanged payment count/refund truth. Rollback test: older expiration cannot erase paid state |
| Pricing / isolation / kills | Remote handler checks reject price injection, fractional units, wrong currency/origin and global/lane kill; [safe results](negative-checks.json) |
| Rate limiting | Native Cloudflare binding sequential burst: 61 accepted / 59 rejected. Limit is approximate 60 per minute; no exact-60 claim |
| Money / accounting | Integer arithmetic tests; real provider receipt and fee/net enrichment; append-only settlement and integer fee/net rollback checks |
| Support boundaries | Rollback proof: no badges/status or compute credit grants. No third-party provider operations |
| Schema / privileges | 76 sandbox migrations, head 20260917020000; financial RLS enabled, both patched functions remain security-definer and inaccessible to anon, all payment rows test-only |

Focused checks: `npm run test:stripe-first-party` (19 programs), `npm run typecheck:functions`, `node scripts/stripeSandboxAcceptanceTest.mjs` all passed. Remote SQL regression files in this directory qualify actual database functions. No unrelated suite or historical audit was rerun.

No renewal clock advance or final period-end deletion was performed. Cancellation verification is the actual period-end cancellation policy, not an invented immediate termination. Organization/service and sponsorship provider acceptance is not claimed: no applicable approved agreements/catalog were supplied. Existing focused tests cover their boundaries.

## Defects fixed

1. Checkout inherited Adaptive Pricing and presented PLN for a canonical USD order. The adapter now sends `adaptive_pricing[enabled]=false`, preserving server-authoritative currency while retaining dynamic payment methods. Adapter regression covers all first-party lanes.
2. A signed refund webhook advanced a projection timestamp, breaking an otherwise identical cached provider response retry. Migration `20260917010000_refund_replay_webhook_timestamp.sql` preserves immutable fingerprint checks and allows the projection's later timestamp. Failed before / passed after; real refund replay passed.
3. Provider-session attachment changed Checkout expiry, making a retry reuse an idempotency key with different Stripe parameters. Migration `20260917020000_checkout_retry_stable_expiry.sql` preserves the original deadline. Full prepare/attach/retry regression failed before / passed after; real Job Post retry and payment passed.

Both migrations were qualified, applied atomically with sandbox migration ledger entries, and copied into the isolated CLI migration directory. Production migrations were not applied. No Supabase project settings changed.

## Reproduction and secret boundary

`services/billing-worker/sandbox.worker.ts` adds a private Cloudflare service-binding entrypoint only to the sandbox Worker. The loopback driver in `scripts/stripe-sandbox-acceptance` rejects external hosts, Origin-bearing requests, GETs and unknown paths. Runtime credentials stay inside Cloudflare; synthetic account passwords and session tokens stay in Worker memory; hosted Checkout/Portal capability URLs stay in browser-driver memory. No public diagnostic or acceptance route was added.

Use the isolated Supabase CLI workdir `/tmp/elysia-stripe-sandbox-kdtqyxlrkpmlpupzgmwv` only. Its project-ref is sandbox; the repository's ordinary linked project is production and must not be used. Read/replay the narrow SQL tests only after sandbox scope guards pass. `database-behavior.sql`, `job-post-behavior.sql`, both regressions roll back synthetic changes; `verified-event-replay.sql` replays only previously verified provider facts.

The safe-state procedure is [restore-safe-state.sql](restore-safe-state.sql), followed by deployment of the committed disabled sandbox Worker config. Never roll back to an acceptance version with flags enabled. Preserve financial/audit history; hide the synthetic Job Post, revoke fixture operator permissions and expire abandoned unpaid test Checkouts. The test subscription is scheduled to cancel; its initial period remains active. The test dispute remains evidence, not a live dispute.

## Remaining human-only preflight

Using the **existing** provisioning credential already saved in Bitwarden, inject `STRIPE_PROVISIONING_KEY_TEST` into a trusted local process using the same secure mechanism used for provisioning. Do not paste it into Codex, command arguments, files or logs. Run the existing GET-only command below and share only the non-secret result:

```sh
BILLING_MODE=test \
STRIPE_ACCOUNT_ID=acct_1UGdHORrIWWoUVPh \
STRIPE_API_VERSION=2025-02-24.acacia \
BILLING_PUBLIC_ORIGIN=https://elysia-ecobotics-online-sandbox.bradleytharz3407.workers.dev \
STRIPE_CATALOG_REFERENCES_FILE=docs/stripe-sandbox-acceptance-2026-09-17/provider-references.json \
node scripts/stripeFirstPartyPreflight.mjs --check
```

This does not enable any gate or make a provider mutation. Do not create or request live credentials. No production activation is authorized by this evidence.

## Final deployment and safe state

Qualified code candidate: `ef6baa9`. Final billing deployment `0e7e6a3a-8dd6-40e6-9a1a-3a82060a1e43`, version `f6be7bc5-aa9b-4127-8d8f-c86a3c4de956`, 100% at 2026-09-17T14:13:11Z. The UI was not redeployed (existing version `0b24bdf4-240d-4adc-8575-f413cb051927`, deployment `88489f9f-e90a-47b4-8f2e-57974bc77d32`).

Remote version metadata verifies `BILLING_MODE=disabled`, `BILLING_ENABLED=false`, every billing lane/processing switch and live/Connect switch false. Access protection remains required. Private remote one-time/recurring calls return `acceptance_disabled`. Database first-party acquisition and webhook/refund processing flags are OFF. Existing free `sandbox_credit_display` / `sandbox_credit_enforcement` flags are unchanged; they do not enable paid compute.

Final aggregate state: five successful test payments, two failed-payment records, one succeeded full refund, one test dispute, one period-end-canceling subscription, no unprocessed inbox events and no open canonical Checkout orders. All financial rows remain test-only. Thirty-two abandoned/declined test orders ended canceled; 21 open sessions were explicitly expired during cleanup and the others expired naturally. Synthetic operator assignments are revoked and the Job Post is private draft. Provider/audit facts are retained; no production data was copied.

Provider review approval remains September 15. `webhookVerified=true` now records actual signed delivery. `eventCoverageVerified`, lane `sandboxQualified`, and preflight confirmation remain false until the missing owner-run configuration check and final qualification review are complete. Late sandbox provider events may retry while processing is OFF; resume only controlled sandbox processing and reconcile when continuing. No live activation is implied.

[Deployment](deployment.json), [deployed gates](deployed-gates.json), [remote disabled checks](disabled-remote-checks.json), [final database state](final-state.json).

Private checkpoints (all pushed):


- `b00b2aba2886e16b9255efca84eaab0f74fc7ffb` Add private sandbox provider inspection and catalog references
- `8ef0f43ce0ab31611ec955d62cdbe4b184ff0eea` Preserve canonical Checkout currency and exercise sandbox boundaries
- `12fc158f2cbb7083bc14931b1f1ae494a55a8fe3` Fix refund replay after signed webhook projection updates
- `5b98ba354a7c2d7bf3d25bdfc0e3de9c244749a5` Keep Checkout expiry stable across provider attachment and retry
- `5318d31f8d8e021fd55901755930a725093ddeaf` Verify sandbox rate limits and governed fee waivers
- `ef6baa94530690943081ca6c838da438cb0104a2` Record real Stripe sandbox payment and async acceptance evidence

Approved private refs: `online/main`, `online/stripe-first-party-2026-09-15` (Elysia-Ecobotics-Online), and `legacy/stripe-first-party-2026-09-15` (elysia-marketplace). The final evidence-only commit follows the qualified code candidate. Legacy main, tags, releases and visibility were preserved.
