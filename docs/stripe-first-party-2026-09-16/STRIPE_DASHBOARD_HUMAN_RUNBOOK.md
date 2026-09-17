# Exact Stripe configuration handoff — September 16, 2026

## Present state and responsibility

All five first-party payment lanes are OFF. Both billing Workers exist, but neither has permanent secret bindings. Real Stripe sandbox acceptance has NOT RUN. Supabase rejected the automated schema-only sandbox branch with **Pro plan required**; no branch or production-data copy was created. No plan upgrade was performed. This is not yet a live-secret-entry-only handoff.

Bradley handles account/business decisions and creation/revelation of permanent credentials. **Save each credential in Bitwarden immediately, before continuing; enter it directly into the matching secure runtime. Never send a value to Codex or put it in command arguments, shell history, files, screenshots or logs.** Codex handles schema replay, configuration, objects, tests, evidence, migrations, deployment and gated activation when these prerequisites exist. Historical tags/releases and repository visibility remain unchanged.

## 1. Exact destinations and bindings

| Environment | Cloudflare Worker | Required encrypted bindings |
|---|---|---|
| Dedicated Stripe sandbox | `elysia-first-party-billing-sandbox` | `STRIPE_SECRET_KEY_TEST`, `STRIPE_WEBHOOK_SECRET_TEST`, `SUPABASE_SERVICE_ROLE_KEY` from the isolated test database |
| Approved live account | `elysia-first-party-billing` | `STRIPE_SECRET_KEY_LIVE`, `STRIPE_WEBHOOK_SECRET_LIVE`, `SUPABASE_SERVICE_ROLE_KEY` from production project `qwmcstyfegvpzjmjrylc` |

Keep opposite-mode Stripe secrets absent. Never bind production Supabase credentials to the sandbox Worker. Website/Pages and compute Workers receive none of these bindings. Hosted Checkout needs no browser Stripe publishable key or Stripe.js.

Non-secret bindings: `STRIPE_ACCOUNT_ID` (retrieve the exact ID separately for each environment), `STRIPE_API_VERSION=2025-02-24.acacia`, `STRIPE_WEBHOOK_API_VERSION=2025-02-24.acacia`, `STRIPE_WEBHOOK_TOLERANCE_SECONDS=300`, `STRIPE_PORTAL_CONFIGURATION_ID` (provisioner output), `BILLING_PUBLIC_ORIGIN`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. Production origin is exactly `https://elysiaecobotics.com`. Sandbox return origin must be its separately deployed, protected test UI; the current `.invalid` placeholder cannot pass provisioning. No production origin is accepted for test Portal provisioning.

**Setup process only, never Worker bindings:** `STRIPE_PROVISIONING_KEY_TEST` / `STRIPE_PROVISIONING_KEY_LIVE`. Use a separate restricted key, saved in Bitwarden and injected into an approved secure process environment without printing its value. The provisioning CLI intentionally does not read the runtime key bindings. Revoke setup keys when object setup and configuration checks are complete; re-create narrowly if later changes require them. A Worker secret cannot be read back for a local script.

Empty templates: [sandbox](templates/sandbox-bindings.example), [production](templates/production-bindings.example), [setup](templates/provisioning-bindings.example). They contain names only, and are documentation, not files to populate or commit.

Cloudflare Dashboard → Workers & Pages → exact Worker → Settings → Variables and Secrets → encrypted Secret. Alternatively, hidden interactive entry from the repository (never append a value):

```sh
node_modules/.bin/wrangler secret put STRIPE_SECRET_KEY_TEST --config wrangler.billing.sandbox.jsonc
node_modules/.bin/wrangler secret put STRIPE_WEBHOOK_SECRET_TEST --config wrangler.billing.sandbox.jsonc
node_modules/.bin/wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.billing.sandbox.jsonc
# Only after sandbox qualification, separately:
node_modules/.bin/wrangler secret put STRIPE_SECRET_KEY_LIVE --config wrangler.billing.production.jsonc
node_modules/.bin/wrangler secret put STRIPE_WEBHOOK_SECRET_LIVE --config wrangler.billing.production.jsonc
node_modules/.bin/wrangler secret put SUPABASE_SERVICE_ROLE_KEY --config wrangler.billing.production.jsonc
```

Keep `BILLING_MODE=disabled`, `BILLING_ENABLED=false` and all lane flags false during entry. Verify secret **names**, never values. Do not use command-line `echo`, a here-document, a committed `.env`, or `VITE_*` for secrets.

## 2. Minimum restricted-key permission matrix

Create **restricted** keys in each corresponding Stripe environment. Start with every resource at None. Grant the following resources for the actual adapter HTTP calls. Write includes read. No unrestricted/all-write fallback. The source uses the same matrix for test and live.

| Stripe resource / Dashboard grouping | Runtime key | Setup + read-only preflight key | Reason / actual operation |
|---|---:|---:|---|
| Account identity (own account) | Read | Read | `GET /v1/account`; match exact `STRIPE_ACCOUNT_ID` |
| Customers | Write | None | `POST /v1/customers` |
| Checkout Sessions | Write | None | `POST /v1/checkout/sessions` |
| Products | Read | Write | Checkout product references; setup `GET/POST /v1/products` |
| Prices | Read | Write | Runtime `GET /v1/prices/:id`; setup lookup/create |
| Payment Intents | Read | None | Validate refund source and enrich confirmed settlement |
| Charges and Refunds | Write | None | `POST /v1/refunds`; expanded latest charge/receipt. Stripe groups these resources; no standalone charge creation exists in this adapter |
| Balance | Read | None | Expanded charge balance transaction: fee/net/source currency |
| Customer Portal | Write | Write | Runtime sessions; setup list/create/read configurations |
| Webhook Endpoints | None | Read | Preflight lists endpoint URL/status/version/events. Dashboard creates the endpoint/signing secret |
| Subscriptions, Invoices | None for direct API access | None | Runtime consumes signed events; hosted Checkout/Portal manages subscription lifecycle. No direct subscription/invoice API calls |
| Payment Methods | None for direct API access | None | Stripe-hosted Checkout and Portal collect/update methods |
| Connected accounts / Connect, transfers, payouts, application fees, external bank accounts, account links | None | None | Prohibited third-party operations; no provisioning or runtime calls |
| Tax, Issuing, Treasury, Financial Connections, files and every other resource | None | None | No calls in this launch contract |

This matrix is derived from the endpoint inventory, not a claim that a restricted key has already been exercised. Stripe Dashboard labels and permission dependencies can vary. If Stripe places **own-account retrieval** under a connected-account-named permission, scope the grant to Read and the approved own account only; no connected account may be created/listed/onboarded. Check the actual key request logs in sandbox for endpoint-specific dependency denials, record the necessary smallest adjustment, then requalify. Do not grant Connect writes or broad money-movement access. Expand permissions only where the provider requires access to an expanded resource. [Stripe key guidance](https://docs.stripe.com/keys), [permission resource vocabulary and expansion dependencies](https://docs.stripe.com/stripe-apps/reference/permissions). The latter documents Stripe Apps; the endpoint-derived matrix above must be verified against restricted-key Dashboard controls.

Account/customer/financial identity and payout ownership must be verified by Bradley in Dashboard. No IP allowlist is prescribed for dynamic Workers egress; configure one only if a verified stable-egress route is used.

## 3. Exact webhooks

Create one **account-event snapshot** endpoint in each matching Stripe environment. Do not select connected-account events or `*`.

- Sandbox: `https://elysia-first-party-billing-sandbox.bradleytharz3407.workers.dev/api/billing/webhook`
- Production: `https://elysiaecobotics.com/api/billing/webhook`
- Endpoint payload API version and request API version: **`2025-02-24.acacia`**. The adapter rejects other versions. Do not choose the latest default version without a separately qualified code change.

Subscribe to exactly these 20 events:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
payment_intent.succeeded
payment_intent.payment_failed
payment_intent.canceled
invoice.paid
invoice.payment_failed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
refund.created
refund.updated
refund.failed
charge.dispute.created
charge.dispute.updated
charge.dispute.closed
charge.dispute.funds_withdrawn
charge.dispute.funds_reinstated
```

The script [stripeContract.ts](../../functions/api/billing/_shared/stripeContract.ts) is the executable event/version/URL contract. Save each endpoint signing secret in Bitwarden before binding it. Do not reuse a CLI-forwarding signing secret, another sandbox's secret, or the live secret. The endpoint deliberately rejects delivery while disabled; Codex enables test processing only after isolated database, key, route protection and gates are verified. Protect the test UI/mutations with Cloudflare Access; exempt only the signed webhook path from interactive Access. Never weaken HMAC validation to accommodate Access.

[Stripe event types for the pinned version](https://docs.stripe.com/api/events/types?api-version=2025-02-24.acacia).

## 4. Payment methods, receipts and tax

The current adapter explicitly sends **`payment_method_types[0]=card`** for every Checkout Session. Enable Cards in the correct Stripe environment. Apple Pay / Google Pay are offered by Stripe-hosted Checkout only where eligible; verify each intended wallet in sandbox. This implementation does not request Link, ACH, BNPL or dynamic payment methods. Keep BNPL/financing and unqualified methods out of the launch. Enabling an extra method in Dashboard does not enable it in this adapter; adding one requires code and its asynchronous/refund/dispute acceptance cases.

Verify EcoSyneva Commons LLC business identity, support contact, statement descriptor, receipt sender and customer email settings. Sandbox receipt-email behavior differs from real delivery; keep Dashboard configuration evidence separate from actual receipt delivery. No redirect page creates payment success. The application shows provider-confirmed payment/receipt/refund state only.

Automatic Stripe Tax is **OFF** in this candidate. Each lane requires a recorded owner/adviser tax disposition. `tax_behavior=disabled` is a collection setting, not a tax exemption or a legal conclusion. If collection is required, keep that lane OFF pending the corresponding implementation and acceptance. Support is not represented as tax-deductible giving to a charity. Codex cannot invent registrations, taxability or accounting advice.

## 5. Products/Prices and Customer Portal — Codex executes

Do not hand-create catalog objects. The idempotent provisioner creates three first-party Products with deterministic IDs and five USD monthly Support Prices ($1/$5/$12/$25/$50), looked up by stable mode-specific keys. One-time Support and reviewed Job Post fees use Product + server-generated integer `price_data`; browser values never override the economic order. Standard commercial Job Post: 1000 cents; governed reduction: 50–999 cents; exempt/waived paths create no payment.

No organization/service or sponsorship Product is invented: production has no such approved records. Provisioning any later real agreement must use its approved server-owned catalog. No Connect, seller, paid-compute or physical-hardware objects are created.

Using secure setup-key process injection and non-secret account/mode/origin settings:

```sh
node scripts/stripeFirstPartyProvision.mjs                 # dry run, no network
node scripts/stripeFirstPartyProvision.mjs --apply > /tmp/stripe-catalog-references.json
node scripts/stripeFirstPartyControl.mjs catalog /tmp/stripe-catalog-references.json > /tmp/stripe-catalog.sql
# Codex reviews/applies catalog.sql to the matching economic database only.
```

Portal configuration: active, mode-matched, invoice history ON, payment-method updates ON, cancellation ON **at period end**, proration **none**, subscription/plan updates OFF. Privacy URL `https://elysiaecobotics.com/legal/privacy-policy`; terms URL `https://elysiaecobotics.com/legal/support-and-billing-terms`. Return URL is `<BILLING_PUBLIC_ORIGIN>/commons-circle/support-billing`. Both provisioning and preflight validate this policy; a conflicting existing configuration fails closed. Set `STRIPE_PORTAL_CONFIGURATION_ID` from the returned ID. No Support cancellation may remove ordinary membership or unrelated access.

## 6. Production preflight — Codex executes, all acquisition OFF

1. Complete the full [sandbox program](STRIPE_TEST_MODE_ACCEPTANCE.md); store exact evidence IDs/hashes. Never mark synthetic fixtures as provider acceptance.
2. Recheck account, secrets **presence only**, separate databases, current production migrations, immutable historical legal hashes, zero unauthorized third-party objects, catalog mode/amount/cadence, payout readiness, receipt configuration and Portal cancellation.
3. With the matching restricted setup key injected securely and `STRIPE_CATALOG_REFERENCES_FILE=/tmp/stripe-catalog-references.json`:

```sh
node scripts/stripeFirstPartyPreflight.mjs                 # prints exact read-only plan
node scripts/stripeFirstPartyPreflight.mjs --check > /tmp/stripe-provider-preflight.json
node_modules/.bin/wrangler secret list --config wrangler.billing.production.jsonc
curl --fail --silent https://elysiaecobotics.com/api/billing/provider-readiness
npm run test:stripe-first-party
npm run typecheck
npm run typecheck:functions
node scripts/firstPartyReadinessBrowserTest.mjs
```

The provider preflight uses GET only, validates own account/capabilities, exact endpoint/event/version contract, every seeded Product/Price, and Portal policy. It reports **paymentAcceptance=NOT_RUN** and never opens a gate. It cannot prove runtime restricted-key write permissions, signed delivery, live bank ownership, tax conclusions or customer receipt delivery.

4. The Worker has a native rate-limit binding for Checkout/Portal/refund execution (60 requests/minute per hashed edge IP and Cloudflare location, shared across those routes; separate namespaces per environment). Webhooks and free creator workflows are excluded. Missing/broken binding fails closed in test/live. This is abuse mitigation, not a globally exact financial limit. Confirm deployed behavior and any additional Access/WAF controls before setting `BILLING_EDGE_RATE_LIMIT_CONFIRMED=true`; no confirmation flag alone provides protection. [Cloudflare limitations](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
5. Record actual lane-specific sandbox/tax/legal/rollout evidence using `stripeFirstPartyControl.mjs qualify`; inspect SQL before applying. Enable webhook/retry/Portal/refund management and add the qualified five-minute retry cron before acquisition. Confirm invalid signatures fail, duplicates do not post twice, retries enrich settlement, and out-of-order invoice/subscription events converge.
6. Enable **one lane at a time** in both database and Worker: Support one-time → recurring → commercial Job Post → existing approved organization/service → existing governed sponsorship. No undefined lane is opened. Update the public billing publication setting and deploy the exact clean, pushed, verified build only when corresponding live gates pass. Observe the first genuine payments; never simulate a live sale.
7. For a lane pause, disable its acquisition switch in both layers; retain verified webhooks, retries, reconciliation, refunds and Portal for outstanding obligations. Preserve all evidence and historical accounting.

## Smallest human-only actions remaining

**Immediate:** arrange a branch-capable Supabase plan (the API explicitly rejected this Free-plan branch) or identify a separately authorized isolated test project; Codex will create/configure/replay it. Create the dedicated Stripe sandbox restricted runtime/setup keys and account-event endpoint above. Save every permanent credential in Bitwarden, enter the three sandbox runtime secrets securely, and make the setup key available through a secure execution context. Share only non-secret account/runtime references.

**After sandbox passes:** verify live business/payout/receipt settings and outstanding Dashboard requirements; obtain/record tax dispositions; create/save/bind the matching live restricted and endpoint credentials. Codex completes the remaining configuration, provider acceptance, preflight, controlled activation and verification. Bradley need not edit code/SQL, hand-create Products/Prices, run migrations or deploy.
