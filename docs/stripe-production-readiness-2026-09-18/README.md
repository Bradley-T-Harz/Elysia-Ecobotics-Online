# Production readiness — 2026-09-18

**READY_FOR_ONE_TIME_SUPPORT_ACTIVATION.** The owner securely added `SUPABASE_SERVICE_ROLE_KEY`. Its name is present in the active production version; the existing runtime reports `economicServerConfigured=true`, `economicPublicConfigured=true`, and successfully loads the LIVE database readiness record. No credential value was retrieved, copied or exposed. No new application deployment was necessary. All acquisition remains OFF pending explicit authorization. See [binding closeout](binding-closeout.json).

## Completed

- Owner LIVE GET-only preflight accepted as authoritative: account `acct_1TtlldRvM2Bq0oxr`, API `2025-02-24.acacia`, production webhook `/api/billing/webhook`, exact canonical 20 events, active payments/payouts, Portal, dedicated PMC, three Products and five Prices. No objects were recreated.
- Seven LIVE catalog rows reconciled through the canonical RPC. Production economic runtime is LIVE; Worker runtime stays disabled. No test catalog rows are active in production.
- Already-qualified migrations `20260917010000` and `20260917020000` applied to production with canonical ledger entries. No unrelated migrations.
- [Owner disposition](OWNER_DISPOSITION.md) recorded in production audit history, including both pending municipal-license follow-ups. No tax research, registration, advice or universal conclusion was added.
- Existing sandbox packet closed using owner preflight and prior real acceptance. Webhook/event coverage recorded; one-time Support, recurring Support and Job Post marked sandbox-qualified. No provider acceptance repeated.
- Production readiness records contain the qualified webhook handler/contract, owner-confirmed endpoint/configuration, receipts/Portal settings, sandbox evidence and owner tax/legal disposition for the first three lanes. Rollout authorization remains unset. `webhookVerified` denotes transferred sandbox handler qualification plus owner-verified LIVE endpoint, **not an already observed real LIVE payment**. First LIVE delivery and bank deposit remain unverified until the owner's first transaction.
- Removed temporary Access reason logging from shared sandbox authentication and UI origin validation. Generic denial, HMAC/signature validation, issuer/AUD/time/key checks, limits and caching remain unchanged. Ordinary billing operational diagnostics remain.
- Added an explicit database-mode guard: LIVE clients require the production Supabase project; test clients reject it. New focused regression proves mismatch rejection, missing backend-binding rejection, no test-key fallback and provider kill-switch behavior.

## Readiness matrix and proof limits

| Area | Result |
|---|---|
| One-time Support | Qualified implementation and sandbox success/decline/async/refund evidence; backend binding blocker resolved; ready for explicit activation authorization. Presets/custom amounts are server-validated integer cents; 5% rounding and tampering tests pass |
| Recurring Support | Qualified Checkout/customer/invoice/Portal/period-end cancellation; no loss of free access. OFF until one-time proves live |
| Job Posts | Qualified $10 fee, governed free/waived/reduced handling; independent content review, no applicant payment or purchased ranking/publication. OFF |
| Professional/organization services | Existing authorized-engagement bridge only: owned customer/scope/amount/terms/order and provider settlement. No generic storefront or engagement qualification invented; OFF |
| Sponsorship | Existing governed request path only; no generic public product. No governance/moderation/data/research/editorial entitlement; agreement-specific and OFF |
| Refunds/disputes | Capability-gated, dual-control/idempotent refund flow and provider event synchronization qualified; no ordinary moderator authority. LIVE refund execution not attempted |
| Webhook/inbox | Raw-body HMAC, version/event contract, durable deduplication, replay/order/failure handling and bounded retry tests pass; existing real sandbox evidence reused |
| Rate limit/kills | Native production 60/minute rate-limit binding configured, equivalent runtime qualified in sandbox; global/lane/provider kills and missing-binding behavior fail closed |
| Tax/BNPL | Support `automatic_tax[enabled]=false`; no registration required by application and no tax silently added. Validated dedicated PMC excludes BNPL/installments, crypto and OXXO; eligible alternatives remain dynamic |
| Accounting/payout | Provider-confirmed payment/pending/refund/dispute records, receipts and fee/net/balance-transaction identifiers supported. Stripe automatic payout and Canvas deposit remain provider/bank facts to reconcile against those identifiers; no bank deposit is claimed. The canonical 20-event contract does not ingest payout.* automatically; retain Stripe payout/bank evidence in governed reconciliation/audit records |
| Public legal | Privacy, terms-of-use and Support/billing terms resolve HTTP 200. Owner confirms account legal configuration; qualified Portal policy uses the specific Support/billing terms URL. No legal pages rewritten |
| Free creators | Creator Studio/Forge/free authoring, review and publication code untouched; existing focused navigation/frontend and protected-browser tests pass |
| Third-party | Marketplace money, Connect, onboarding/KYC, seller bank linking, creator payouts/transfers/settlement, paid compute and hardware remain HARD OFF |

## Tests

Passed: `npm run test:stripe-first-party` (19 focused programs), `npm run typecheck:functions`, `node scripts/productionBillingBoundaryTest.mjs`, `node scripts/protectedSandboxUiTest.mjs`, `node scripts/sandboxAccessSmokeTest.mjs`, sandbox UI build and protected sandbox browser. Remote production rollback-only context/privilege/kill-switch checks passed. No production payment, provider object creation, sandbox card/ACH rerun or broad historical audit.

## Gates and activation handoff

All first-party acquisition switches remain OFF in Worker and database; rollout authorization is absent. `BILLING_MODE=disabled`, `BILLING_ENABLED=false`, `STRIPE_LIVE_ENABLED=false`; all processing switches remain OFF. Native LIVE Stripe bindings are retained. Production public billing publication marker remains disabled; existing website assets are unchanged.

The owner GET-only preflight is recorded (`lastPreflightAt`), and the backend-binding/runtime closeout now passes. `BILLING_FIRST_PARTY_PREFLIGHT_CONFIRMED` remains staged false with the disabled runtime; set it only in the coordinated authorized activation configuration. This is not a request to redo Dashboard setup or sandbox acceptance.

The missing binding is now installed and verified. Bradley can review and explicitly authorize **one-time Support only**. That authorization permits the coordinated existing activation switches: record Support rollout authorization, enable provider LIVE mode and required management/webhook/retry controls, enable only one-time Support in both database/Worker, publish the billing API marker and deploy the verified website. Keep recurring, Job Posts, services and sponsorship OFF. These actions are not performed in this pass.

The first genuine website transaction must establish: Checkout → signed LIVE event → provider-confirmed record → receipt/acknowledgment → Stripe balance/payout → Canvas deposit → reconciliation. Do not infer payment from redirect or payout from a successful charge. Recurring follows proven one-time Support; Job Posts follow recurring. No live credentials need to be recreated.

## Deployment

Deployment IDs and final safe smoke results are recorded in the adjacent evidence files after deployment. Production frontend assets were not changed by this pass; only the affected billing backend is redeployed. Both sandbox UI and billing import the changed Access helper and are redeployed with acquisition OFF.


Final qualified code commit: `583ab5e`.

| Component | Deployment ID | Version ID |
|---|---|---|
| Production billing | `c4ed1b97-e8c9-4022-9069-df3000d7c193` | `47a08df4-8fbb-470d-b4b8-96cd1ff76009` |
| Sandbox billing | `6198e39c-da66-4b69-b4e1-388ee8711254` | `654388d3-6221-4d89-8d64-8de13afba0f0` |
| Protected sandbox UI | `afea48a3-f7b0-4aab-92bd-13c9794533ab` | `babb4913-6231-4fad-b29b-deb95d018bb3` |

Post-deploy native metadata confirms exact versions at 100%, LIVE account/Portal/PMC IDs, pinned API, production Supabase URL, rate-limit binding, all enabled/confirmation flags false, and only the two LIVE Stripe secret binding names present. Production readiness/capabilities return 200; one-time/recurring/Job Post creation each return 503 with acquisition OFF. Browser confirms Support and both general legal pages render; public billing remains disabled. Production final ledger has 76 migrations, both patched function bodies confirmed, seven live catalog rows, no active test catalog, zero payments and no rollout authorization.

Rollback: preserve the qualified database patches and financial audit history. For code rollback, retain the disabled non-secret configuration and secure bindings; never enable a gate to test rollback. Prior production Worker version `be9243d8-a06d-4b4a-a408-021b78990404` is retained, but lacks the new environment guard/LIVE reference configuration. Prefer the current disabled candidate until explicit activation authorization.

Private refs: `online/main`, `online/stripe-first-party-2026-09-15`, `legacy/stripe-first-party-2026-09-15`. No tags/releases/visibility changes. Final evidence-only checkpoint follows the qualified code commit.


## Resolved backend-binding closeout

Owner-created deployment `fe9a1f1d-7670-43db-a1ac-e3b0c142c3e7`, version `53f9b951-082e-425f-a1a0-c1ff0e771556`, is active at 100% and supersedes the production deployment above. Inspected non-secret runtime configuration matches the prior qualified version; all three required secret binding names are present. No Codex redeployment or application changes were needed.

Minimal checks only: binding-name/active-version inspection; existing production readiness/capability endpoints; disabled one-time/recurring/Job Post endpoints (503); blocked Marketplace checkout/seller onboarding routes (404); existing production environment-boundary regression (passed). Runtime test Stripe bindings are absent, the Supabase URL is production, the database reports LIVE mode, and every acquisition feature is false. Backend configuration is validated by the existing runtime's safe boolean check; database readiness is loaded through the existing read-only public RPC. No privileged write, real Checkout, payment, refund or provider operation was attempted; those remain governed by explicit activation and the first genuine transaction.

Support automatic tax stays OFF and the unchanged qualified dedicated PMC excludes BNPL/installments. Recurring, Job Posts, services, sponsorship and third-party money remain OFF/HARD OFF. No settled acceptance, migration, catalog provisioning or broad audit was repeated. Remaining technical blockers: none. Next human step: Bradley explicitly authorizes one-time Support; the first genuine transaction then verifies the full receipt/payout/Canvas reconciliation chain. Municipal follow-ups remain separate owner tasks.
