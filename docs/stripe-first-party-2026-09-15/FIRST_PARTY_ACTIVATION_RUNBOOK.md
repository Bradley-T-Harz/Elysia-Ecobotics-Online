# Controlled activation

## Prerequisites and reproducible tooling

Production is disabled. `wrangler.billing.production.jsonc` defines the isolated Worker route; it contains no permanent credentials. The disabled `wrangler.billing.sandbox.jsonc` Worker is deployed. Complete its separate Supabase project/schema replay and protected test configuration, with test-only credentials, API origin and Cloudflare Access (webhook path must allow Stripe signatures). Configure edge rate limits for checkout/Portal/refund/operator mutations; verify behavior before setting BILLING_EDGE_RATE_LIMIT_CONFIRMED. Do not treat that assertion variable as a rate limiter.

`node scripts/stripeFirstPartyProvision.mjs` is dry-run by default. In a secure environment, set mode, non-secret account ID, pinned version and injected corresponding secret, then use `--apply`. It verifies `/v1/account`, creates deterministic Products, looks up recurring Prices by stable key, checks existing objects and idempotently prepares Portal cancellation. It outputs non-secret catalog references and Portal configuration ID only, and never enables a lane. Default catalog covers Support and Jobs; existing service/sponsorship catalog is added only for an actually approved agreement.

`node scripts/stripeFirstPartyControl.mjs catalog references.json > catalog.sql` emits a reviewable transaction using the existing mode-aware catalog RPC. Set `STRIPE_PORTAL_CONFIGURATION_ID` from provisioning output. Apply catalog to the matching database only. In sandbox first set the authoritative account_reference with runtime_mode=test; keep production empty and disabled.

## Qualification and activation

After real sandbox acceptance, construct a reviewed JSON plan for `stripeFirstPartyControl.mjs qualify`: mode=live, account, evidenceRef, evidenceSha256, webhookVerifiedAt, eventCoverageVerifiedAt, receiptVerifiedAt, optional portalVerifiedAt, preflightAt, and lanes with key/sandboxQualifiedAt/sandboxEvidenceRef/taxDecisionRef/taxBehavior=disabled/legalQualifiedAt/rolloutAuthorizedAt. All dates must refer to actual evidence. This emits SQL only; it never manufactures evidence. Apply it to the empty production economic environment. Approval was already recorded; live mode cannot reuse a database with test records.

Enable management flags in both runtime/database: economic_webhooks, customer_portal, test_refund_execution (legacy name, now environment-scoped), with BILLING_WEBHOOK_FULFILLMENT_ENABLED, BILLING_NOTIFICATION_RETRY_ENABLED, BILLING_PORTAL_ENABLED, BILLING_TEST_REFUNDS_ENABLED. Add cron `*/5 * * * *` only after these bindings pass. Keep acquisition OFF during preflight. Configure lifecycle/accounting/assistance capabilities where needed, independently of money acquisition.

Set live runtime account/origin/API bindings and STRIPE_LIVE_ENABLED, BILLING_FIRST_PARTY_PREFLIGHT_CONFIRMED, BILLING_EDGE_RATE_LIMIT_CONFIRMED only when verified. Set BILLING_ENABLED and corresponding lane runtime switch only as that lane is released. Publish browser billing metadata in index.html as `live` only with the qualified live runtime, then build/deploy exact commit.

For each wave, prepare `{mode:"live",account,actor,lane,enabled:true,reason:"approved-evidence-reference"}` and emit `stripeFirstPartyControl.mjs lane plan.json`. The SQL verifies the operator capability, sets the global live permission, and calls the per-lane audited command. Any failed lane gate rolls back the transaction. Order: support_checkout → recurring_support → job_post_fee_enforcement → organization_billing → sponsorship_checkout, with undefined agreement lanes left OFF. Verify provider/runtime/DB/UI and management after each wave. Do not create an artificial live charge.

## Pause

Use the same lane command with enabled=false, and set its Worker switch false. Global acquisition pause: BILLING_ENABLED=false plus all five database lane flags false. Retain webhook verification/retries, Portal, refunds, reconciliation and history. The immovable third-party boundary remains enforced even if its old flags are toggled.
