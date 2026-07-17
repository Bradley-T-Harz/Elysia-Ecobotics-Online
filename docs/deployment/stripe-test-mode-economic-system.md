# Stripe test-mode economic system

This runbook is for repository and Stripe sandbox validation only. It does not authorize live charges, payouts, production migration, or deployment.

## Hard prerequisites

Before enabling even test mutations:

1. Review the forward migrations against a disposable Supabase-compatible database.
2. Complete the read-only live inventory in [supabase-read-only-economic-preflight.md](./supabase-read-only-economic-preflight.md) using a database role that cannot write.
3. Resolve every reported collision, signature mismatch, policy difference, and manual-SQL unknown with a new reviewed forward migration. Never edit or replay the captured baseline.
4. Confirm both Cloudflare deployment boundaries: the existing website/Pages project owns only `/api/sandbox/*`, while the dedicated billing Worker owns `/api/billing/*` on the custom origin. Preview and production bindings must not be silently shared.
5. Create Stripe products/prices in test mode only and record their test references through the private catalog process.
6. Configure a platform-account-only test webhook endpoint, not a Connect/connected-account endpoint, restricted to the event types the handler normalizes. The adapter rejects every event with a non-null top-level Stripe `account` context.
7. Run `npm run test:release` in an authorized environment with a usable
   rootless Podman or user-scoped Docker runtime before any provider call. This
   runs the container-free `test:all` suite first and
   then the disposable-database migration/RLS/function-ACL gate. A passing
   `test:all` alone is not a release result. If the current workstation or CI
   runner cannot provide Docker, the disposable phase remains an external gate
   that must pass elsewhere before activation; do not weaken or skip it.

## Checkout and receipt configuration

Every repository-created Checkout Session explicitly permits only `card`. Buy-now-pay-later, cryptocurrency, promotion codes, automatic tax, shipping-address collection, and phone-number collection are outside this test release and remain disabled even if broader payment methods are enabled in the Stripe Dashboard. Any future payment-method expansion requires a separate ethical, privacy, refund, dispute, and accounting review plus new tests.

Hosted Checkout collects the payer email when no Customer with a valid email is supplied. Before test activation, enable and verify Stripe's successful-payment email receipts in the test/sandbox Dashboard and confirm the sender and support details are accurate. Dashboard receipt settings are external state and cannot be proven by repository tests. Account-linked and guest flows must still treat webhook-confirmed database state—not an email receipt or browser return—as the fulfillment authority.

This release does not expose a repository receipt-download endpoint or persist a Stripe-hosted receipt URL. The authenticated Support & Billing room shows only bounded owner-scoped payment summaries and deliberately reports `receiptAvailable: false`; it must not render a dead receipt button or imply that the summary itself is a tax invoice. Stripe's successful-payment email is the current receipt path, while the authenticated Stripe Customer Portal is the current recurring-support billing-management path when enabled. A future hosted-receipt route requires a separate server-side ownership lookup, a short-lived Stripe retrieval, an explicit `https` Stripe-host allowlist, no provider identifiers in the response, and dedicated privacy tests before any UI control may appear.

The repository intentionally pins outbound requests with `STRIPE_API_VERSION` and independently requires signed events to match `STRIPE_WEBHOOK_API_VERSION`. The adapter fixtures currently review `2025-02-24.acacia`. In that Acacia shape, an Invoice exposes its associated PaymentIntent through the direct nullable `invoice.payment_intent` field; the adapter reads that field for the transaction identity of `invoice.paid`. Stripe removed that direct field in the later `2025-03-31.basil` invoice-payment change, so do not change the pinned endpoint to Basil or a newer version without implementing and testing the newer `invoice.payments` relationship first. Subscription-mode `checkout.session.completed` is separately accepted without a direct PaymentIntent: it establishes the order/session/subscription association, while each `invoice.paid` event is the monetary truth for its own renewal transaction. Do not mint a synthetic PaymentIntent when Checkout omits one.

Do not substitute whatever version is newest without reviewing event-shape changes and rerunning the adapter and webhook suites. In Stripe Workbench, configure the dedicated platform-account test webhook endpoint to emit exactly the reviewed `STRIPE_WEBHOOK_API_VERSION`; a missing or mismatched `event.api_version` receives HTTP 400 and remains unprocessed so Stripe retries instead of letting an unknown shape mutate economic records. Do not configure this URL as a Connect webhook or subscribe it to events on connected accounts. A non-null top-level `event.account` receives HTTP 400 before order metadata or provider references reach the database. Connect readiness in this release is retrieved through the authenticated seller-status path and does not require connected-account events at the economic webhook.

The reviewed mutation subscription is deliberately exact: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `refund.created`, `refund.updated`, `refund.failed`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `charge.dispute.funds_withdrawn`, and `charge.dispute.funds_reinstated`. The adapter shape-checks these events and the database independently enforces the same allowlist. Any other correctly signed/versioned event is retained in the private event journal and acknowledged as ignored without mutating economic state or creating an endless Stripe retry; do not broaden the Dashboard subscription with the expectation that a wildcard family will be processed.

The Stripe Customer Portal has separate sandbox configuration outside this repository. Before enabling `BILLING_PORTAL_ENABLED`, verify in the same sandbox that authenticated customers can update their payment method, inspect recurring support, and cancel it without contacting EcoSyneva. Configure the cancellation timing and customer-facing consequences to match the published recurring-support terms, and test both cancellation and return navigation. Disable plan switching, quantity changes, prorations, customer-balance spending, retention coupons, cancellation obstruction, and unrelated upsells: the current versioned subscription contract accepts only the fixed amount originally chosen, and these external Portal features are not implemented or reconciled by this release. The repository creates short-lived portal sessions on demand and supplies a same-site return URL; it cannot prove what the external Portal configuration permits.

Recurring support is intentionally account-linked in this release. `/api/billing/recurring-checkout` requires a verified Website Account session because durable subscription ownership, private renewal history, recovery, and authenticated Customer Portal access depend on `economic_subscriptions.user_id`. Anonymous visitors may use guest one-time support instead; the system must not silently create an account, infer subscription ownership from an email address, or accept a guest recurring Checkout that cannot be recovered safely.

## Recoverable accounts and canonical Stripe Customers

Every account-linked economic checkout is gated twice. The billing Worker verifies the bearer token with Supabase Auth and rejects an anonymous identity, an account without a confirmed nonblank email, or an account with an active Auth ban. `private.begin_economic_checkout_core` and the pre-Session attachment RPC independently require the Auth row to exist, have `deleted_at is null`, `is_anonymous is false`, a confirmed nonblank email, and no active `banned_until`. This requirement protects recovery of paid value; it does not require a Commons profile, completed Commons onboarding, a badge, membership, or a governance role. It must never be weakened into email-text matching. Guest one-time support remains unlinked.

An account-linked Checkout Session must never ask Stripe to create an unbound Customer implicitly. The reviewed sequence is:

1. create or idempotently replay the pending internal order;
2. reuse its canonical private `billing_customer_id`, or create one Stripe test Customer with the stable key `billing-customer:<auth-user-uuid>`;
3. call the service-role-only `attach_economic_checkout_billing_customer` RPC, which locks the order and verifies account, provider, reference, and transition consistency;
4. only after the attachment commits, create the hosted Checkout Session with that Customer;
5. attach the Session to the same order, with provider-customer equality enforced again.

The Customer creation request sends only server-managed test metadata. It does not copy the Supabase email, profile name, phone, Commons fields, or public identity into Stripe. Stripe may collect billing contact information on its hosted surface, but repository code must not use that contact text to transfer ownership. If Customer creation fails, the order records `provider_customer_creation_failed` and a retry safely reuses the same order and per-user Stripe idempotency key. Before activation, run concurrent first-checkout tests and verify that one Auth identity cannot acquire two active canonical provider customers.

## Out-of-order events and downstream holds

The webhook processor persists normalized provider evidence and transaction/refund/dispute rows before calculating one final order status. Its precedence is full verified refund, active or lost dispute, partial verified refund, then paid. This single post-persistence projection is required because Stripe can deliver payment success after refund or dispute evidence. Never restore the older pattern of setting an order to `paid` before durable financial state is considered; even a transient paid update can fire fulfillment triggers.

Downstream systems re-check current eligibility at settlement time and quarantine unsafe races in private tables:

| Scope | Hold and withheld effect | Resolution |
| --- | --- | --- |
| Marketplace paid offer | `private.marketplace_fulfillment_holds`; no license, entitlement, commission, seller payable, or installation authority | Durable successful refunds must cover the full verified paid amount. |
| Commercial Job Post | `private.job_post_payment_holds`; publication remains withheld/private and no moderation punishment is created | The order must reach the full-refund projection. |
| Organization service or sponsorship | `private.organization_sponsorship_settlement_holds` plus immutable hold events; service activation is suspended, and sponsorship activation/recognition is withheld | Durable successful refunds must cover all verified payments; the target returns only to its recorded canceled/rejected resolution state. |

Partial refunds, dispute closure, restored eligibility, an operator status change, and a later paid projection do not clear these holds. Owner summaries expose only a safe warning and public order reference; provider references, evidence, reasons, amounts, and operator details remain private. Reconciliation queues require a separately assigned economic capability. A hold does not alter Auth status, Commons participation, badges, roles, review authority, moderation, developer/publisher trust, or local installation safety.

## Free Marketplace continuity

`BILLING_ENABLED` is the payment-acquisition kill switch, not a paid-membership switch. When the separately reviewed test-only `BILLING_MARKETPLACE_COMMERCE_ENABLED` boundary is on, disabling `BILLING_ENABLED` removes paid offers from the economic catalog while retaining free offers and authenticated free-license acceptance. The free-license route performs no Stripe call and still does not install, execute, approve, or trust an add-on. If the Marketplace commerce flag itself is off, the new economic catalog is unavailable; the global payment switch must not be used as a reason to hide otherwise eligible free offers.

## Dedicated runtime and route boundary

Billing does not run inside the website/Pages Functions runtime. The repository's reviewed boundary is:

```text
same-origin /api/billing/*
  -> dedicated billing Worker (`services/billing-worker/worker.ts`)
  -> billing-only bindings and encrypted secrets

same-origin /api/sandbox/*
  -> existing website/Pages Functions project
  -> sandbox-only bindings and encrypted secrets
```

`wrangler.billing.example.jsonc` and `.dev.vars.billing.example` are the
billing-Worker examples. The checked-in Wrangler example intentionally declares
no `routes` and no scheduled trigger, keeps `workers_dev` disabled, and uses the
non-routable
`billing-test.example.invalid` origin placeholder; deploying it unchanged cannot
attach the Worker to the production hostname. Add the exact protected non-live
`/api/billing/*` route, matching `BILLING_PUBLIC_ORIGIN`, and private
notification-retry cron only in a separately reviewed, environment-specific
deployment configuration. Never add the production hostname to the checked-in
example. `wrangler.example.jsonc` and
`.dev.vars.example` belong only to the website/Pages and sandbox process.
`public/_routes.json` intentionally includes `/api/sandbox/*` and does not
include `/api/billing/*`; the reviewed environment-specific billing Worker route
must own the billing namespace before a request can reach Pages. The billing
Worker statically dispatches every reviewed billing route and imports no sandbox
route or runner code.

Never put a `BILLING_*` or `STRIPE_*` variable, Stripe secret, webhook secret, payout credential, or `SUPABASE_SERVICE_ROLE_KEY` on the Pages project. Never put `SANDBOX_*`, `CLOUDFLARE_ACCESS_*`, runner, or finalizer credentials on the billing Worker. A source-level promise not to read a binding is insufficient isolation: a secret configured on a runtime is available to every invocation in that runtime. Local work must likewise use separate processes and separate ignored files; never merge `.dev.vars.billing` into `.dev.vars`.

The checked-in billing Worker example disables automatic invocation logs and traces. Keep only the Worker's allowlisted structured event name, outcome, and opaque correlation UUID by default. Do not log request URLs, query strings, request bodies, provider payloads, authorization headers, contact data, provider identifiers, or financial amounts. Verify route ownership through bounded response signatures and Cloudflare route configuration; if an operator temporarily enables richer staging diagnostics, it requires a separate privacy review and prompt removal after verification.

Before any test activation, verify all of the following without making a payment mutation:

1. The billing Worker is a distinct Cloudflare Worker with the reviewed entry file and a same-origin zone route for the exact `/api/billing/*` namespace.
2. The Pages Functions route manifest still owns only `/api/sandbox/*`; no billing route or billing secret is configured on Pages.
3. The billing Worker's bindings contain no sandbox/Access/runner secret, and its ordinary variables remain fail-closed.
4. `GET /api/billing/capabilities` is served by the billing Worker, reports test mode with provider mutations disabled, and exposes no configuration detail. An unknown `/api/billing/...` path returns the Worker's bounded `billing_route_not_found` JSON response rather than Pages HTML.
5. `/api/sandbox/*` continues to be served by Pages and cannot observe any billing binding. Confirm ownership from the route configuration and each Worker's distinct bounded response signature without enabling request URL/query logging.
6. The exact Stripe test webhook endpoint resolves to the billing Worker. If the route is missing, ambiguous, assigned to the wrong zone/environment, or falls through to Pages, leave webhook fulfillment and every acquisition flag disabled.

Create and review the environment-specific non-live route configuration, then
deploy the disabled billing Worker and verify route ownership before deploying
frontend code that depends on it. Never use the checked-in route-free example
unchanged as evidence that route ownership exists. A rollback must disable the
smallest Worker/database feature and preserve the isolated route; it must never
move billing secrets or handlers back onto Pages as a shortcut. Run
`npm run test:billing-isolation`, `npm run test:security`, and
`npm run typecheck:functions` after changing either route manifest or binding
example.

## Bindings

Non-secret variables for the dedicated billing Worker only:

- `BILLING_ENABLED=false` until test activation;
- `BILLING_SUPPORT_CHECKOUT_ENABLED=false`;
- `BILLING_RECURRING_ENABLED=false`;
- `BILLING_WEBHOOK_FULFILLMENT_ENABLED=false`;
- `BILLING_NOTIFICATION_RETRY_ENABLED=false`; this independent flag cannot
  substitute for a reviewed private Cron Trigger and alerting;
- `BILLING_PORTAL_ENABLED=false`;
- `BILLING_SELLER_ONBOARDING_ENABLED=false`;
- `BILLING_JOB_POST_FEES_ENABLED=false` until fixed test pricing, review separation, and webhook fulfillment are verified;
- `BILLING_SANDBOX_PURCHASES_ENABLED=false` until a reviewed test pack, metering, compensation, and webhook fulfillment are verified;
- `BILLING_MARKETPLACE_COMMERCE_ENABLED=false` until seller terms, offer review, license issuance, and webhook fulfillment are verified;
- `BILLING_MARKETPLACE_PAYOUT_PREPARATION_ENABLED=false`; this permits only private test-ledger preparation, never a provider transfer;
- `BILLING_ORGANIZATION_SERVICES_ENABLED=false` until signed service terms, a fixed test price, and the organization workflow are verified;
- `BILLING_SPONSORSHIP_ADMIN_ENABLED=false` until an independently reviewed economic operator can administer no-control sponsorship agreements;
- `BILLING_SPONSORSHIP_CHECKOUT_ENABLED=false` until a reviewed agreement and fixed test price exist; it is independent from organization services and public display;
- `BILLING_SPONSORSHIP_RECOGNITION_ENABLED=false`; this gates public display, not a signer's private opt-in or withdrawal preference;
- `BILLING_ASSISTANCE_ADMIN_ENABLED=false` until waiver, subsidy, and sponsored-access review is complete;
- `BILLING_SUPPORT_RECOGNITION_ENABLED=false`; this gates public display, not an authenticated supporter's private preference;
- `BILLING_ACCOUNT_LIFECYCLE_ENABLED=false` until the assisted economic-only request workflow and a private, access-controlled export artifact generation/storage/delivery process are reviewed; the repository does not generate or deliver user export artifacts by itself;
- `BILLING_ACCOUNTING_EXPORT_ENABLED=false` until private operator export handling is reviewed;
- `BILLING_TEST_REFUNDS_ENABLED=false` until transaction-scoped review, Stripe test refund execution, reconciliation, and webhook handling are verified;
- `BILLING_STAGING_ACCESS_CONFIRMED=false` until the test/preview hostname is protected by Cloudflare Access;
- `BILLING_EDGE_RATE_LIMIT_CONFIRMED=false` until a reviewed Cloudflare rate-limit/WAF rule covers `/api/billing/checkout`;
- `BILLING_MODE=test`;
- `BILLING_PUBLIC_ORIGIN` set to the exact same-origin site URL;
- `STRIPE_LIVE_ENABLED=false`;
- `STRIPE_CONNECT_ENABLED=false` until Connect test review;
- `STRIPE_API_VERSION` pinned to an explicitly reviewed Stripe test API version rather than silently following an account default;
- `STRIPE_WEBHOOK_API_VERSION` pinned to the independently reviewed version configured on the dedicated test webhook endpoint;
- `STRIPE_WEBHOOK_TOLERANCE_SECONDS=300`;
- `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for server-side user-token verification.

Encrypted secrets for the dedicated billing Worker only:

- `STRIPE_SECRET_KEY_TEST` beginning with the Stripe test prefix;
- `STRIPE_WEBHOOK_SECRET_TEST` for the exact test endpoint;
- `SUPABASE_SERVICE_ROLE_KEY` for narrowly scoped server economic RPC calls.

Never create `VITE_` versions of these secrets. Never add secret values to this file, repository config, browser bundles, logs, screenshots, the Pages project, or the sandbox runner. Populate the names only through encrypted bindings on the separately deployed billing Worker; the examples contain placeholders, not values.

Each deployment variable and database feature is an independent gate. The principal pairings are: support checkout with `support_checkout` plus `economic_webhooks`; recurring support with `recurring_support`, `support_checkout`, `customer_portal`, and `economic_webhooks`; sandbox purchase with `sandbox_credit_display`, `sandbox_credit_purchase`, and `economic_webhooks`; Job Post fees with `job_post_fee_enforcement` and `economic_webhooks`; paid Marketplace offers with `marketplace_paid_offers`, `marketplace_seller_onboarding`, and `economic_webhooks`; payout preparation with `marketplace_payout_preparation`; organization services with `organization_contract_workflow`, `organization_billing`, and `economic_webhooks`; sponsorship checkout with `sponsorship_review_workflow`, `sponsorship_checkout`, and `economic_webhooks`; sponsorship public recognition with `sponsorship_display`; assistance with `economic_assistance_workflow`; support public recognition with `public_support_recognition`; and test refunds with `test_refund_execution` plus `economic_webhooks`. Economic-operator capabilities remain a third, person-specific authorization boundary. An enabled edge variable never substitutes for its database flags or operator capability, and a database flag never substitutes for the edge kill switch.

Account export/closure requests and the two public recognition projections are deliberately executable only by the billing Worker service role. The Worker verifies the account-action bearer token, supplies that verified actor to the service-only RPC, and applies `BILLING_ACCOUNT_LIFECYCLE_ENABLED` before any mutation. Public support and sponsorship endpoints apply their respective environment display gate before creating the server client and return only the minimized recognition contracts. Do not grant `anon` or `authenticated` direct Data API execution on `request_economic_account_action`, `public_support_recognition`, or `public_sponsorship_recognition`: doing so bypasses the deployment kill switch. Authenticated owner summary, closure-readiness, and preference-withdrawal paths remain separate and available according to their documented self-only contracts.

## Guest checkout abuse-control gate

The repository does not store IP addresses or browser fingerprints for guest support. That privacy boundary means application code alone cannot safely implement a per-client guest velocity limit. Guest `/api/billing/checkout` therefore fails closed unless both `BILLING_STAGING_ACCESS_CONFIRMED=true` and `BILLING_EDGE_RATE_LIMIT_CONFIRMED=true`. These are operator attestations, not controls by themselves: before setting them, protect the non-live hostname with Cloudflare Access and deploy a conservative edge rate-limit/WAF rule for same-origin JSON POSTs to the guest checkout route. Keep the rule independent from authenticated community standing and never turn a checkout-limit event into an account ban.

The database separately applies bounded pending-checkout velocity guards without storing network identifiers, while repeated use of the same client request UUID remains an idempotent replay rather than a new order or Stripe charge. Monitor only aggregate rejection counts. If Access, the edge rule, webhook health, or the database guard cannot be verified, leave guest checkout disabled and retain the free/local and authenticated community paths.

## Test catalog reconciliation

The default catalog command is an offline dry run and does not require a credential:

```bash
npm run billing:stripe:test-catalog
```

Creating or reconciling Stripe objects is a separate, explicit test-mode operation. Recording the resulting test references in Supabase is another independently confirmed operation:

```bash
npm run billing:stripe:test-catalog -- --apply --confirm=ELYSIA-STRIPE-TEST-CATALOG-ONLY --record-supabase --record-confirm=ELYSIA-SUPABASE-TEST-CATALOG-REFERENCES-ONLY
```

The second command requires only test credentials in server environment variables, refuses a live Stripe key, and must not be run against an unverified Supabase project. It was not run during repository implementation. Product and price definitions are immutable by code; a changed amount requires a reviewed new catalog version rather than silently rewriting history.

### Reviewed fixed test prices

Sandbox packs, commercial Job Post fees, organization services, and sponsorships use fixed server-owned prices. Their amounts, sandbox unit quantities, expiry, and disclosure versions are deliberately not invented by migrations or this repository. The following command is an offline dry run by default and accepts only the four reviewed product domains, USD, bounded internal codes, and explicit reviewed values:

```bash
npm run billing:stripe:test-fixed-price -- --product=job_post_fee --price-code=<new-reviewed-test-price-code> --amount-minor=<reviewed-amount-minor> --disclosure-version=<active-job-post-terms-version>
```

After independent price/legal review, create or reconcile the immutable Stripe test product and price and configure/link it through the service-only RPCs—never ad hoc SQL:

```bash
ECONOMIC_TEST_PRICE_CONFIGURATION_REASON='<private reviewed reason>' npm run billing:stripe:test-fixed-price -- --apply --configure-supabase --product=job_post_fee --price-code=<new-reviewed-test-price-code> --amount-minor=<reviewed-amount-minor> --disclosure-version=<active-job-post-terms-version> --actor=<operator-user-uuid> --request-id=<new-uuid> --confirm=ELYSIA-STRIPE-FIXED-PRICE-TEST-CATALOG-ONLY --database-confirm=ELYSIA-SUPABASE-FIXED-PRICE-TEST-CONFIGURATION-ONLY
```

Use the same flow with `--product=organization_service` or `--product=sponsorship` only after the exact contract/agreement price and disclosure have been reviewed. A sandbox pack additionally requires `--product=sandbox_credits`, `--pack-code=sandbox_test_...`, `--granted-units=<reviewed-units>`, and optional `--expires-after-days=<reviewed-days>`; its service-only database RPC always records `approvedForLiveUse:false`. The tool creates only Stripe test objects, requires `BILLING_MODE=test` and `STRIPE_LIVE_ENABLED=false` before apply, sends the service-role credential only to a canonical Supabase origin, refuses immutable amount drift, uses idempotent Stripe keys, and prints neither provider references, actor IDs, private reasons, nor secrets. A partial provider/database failure is safely rerunnable. None of these operations enables a feature flag, creates a charge, approves content, grants authority, or activates live pricing.

Recurring-support sandbox credits are a separate, inactive program configuration—not an automatic meaning of any support purchase. Configure only reviewed units and expiry against one exact recurring-support catalog price; the dry run performs no network request:

```bash
npm run billing:sandbox:test-recurring-program -- configure --program-code=sandbox_test_<reviewed-program> --source-price-code=<reviewed-support-monthly-price-code> --granted-units=<reviewed-units> --expires-after-days=<reviewed-days>
SANDBOX_TEST_PROGRAM_CONFIGURATION_REASON='<private reviewed reason>' npm run billing:sandbox:test-recurring-program -- configure --apply --program-code=sandbox_test_<reviewed-program> --source-price-code=<reviewed-support-monthly-price-code> --granted-units=<reviewed-units> --expires-after-days=<reviewed-days> --confirm=ELYSIA-SUPABASE-RECURRING-SANDBOX-PROGRAM-TEST-ONLY
```

Configuration always stores `active:false`, `oneTimePerUser:false`, and `approvedForLiveUse:false`. Activation/deactivation is a different service-only, operator-attributed, UUID-idempotent action requiring `sandbox_credits_adjust`; recurring activation also requires database `economic_webhooks` and an unchanged immutable price snapshot. Most importantly, the current recurring-support terms and the $25 hosted-product copy explicitly do **not** promise credits, and the current Checkout UI does not disclose a unit/expiry benefit. Therefore leave the program inactive and do not set `SANDBOX_RECURRING_CREDIT_BENEFIT_REVIEWED=true`. Only after a later reviewed terms/UI change states the exact units, expiry, renewal behavior, refunds, cancellation consequences, and sandbox separation may an operator use the exact activation confirmation `ACTIVATE UNAPPROVED SANDBOX TEST PROGRAM`. Deactivation remains available with `DEACTIVATE UNAPPROVED SANDBOX TEST PROGRAM`. Money still cannot change safety privileges, network access, trust, or authority.

## Test-only operator bootstrap and feature activation

There is deliberately no browser route for `bootstrap_economic_operator` or `set_economic_test_feature`. The repository provides a separate server-operator CLI whose default is an offline dry run. It never imports dotenv, never reads `.env.local`, never accepts a private reason on the command line, and never prints the service-role key, private reason, actor UUID, assignment UUID, or database error body.

Dry-run examples require no secret and perform no network request:

```bash
npm run economic:test-activation -- bootstrap --actor=<reviewed-auth-user-uuid>
npm run economic:test-activation -- feature --actor=<operator-auth-user-uuid> --feature=economic_webhooks --enable
```

An apply operation requires `BILLING_MODE=test`, `STRIPE_LIVE_ENABLED=false`, a canonical hosted Supabase URL (or disposable loopback URL), and `SUPABASE_SERVICE_ROLE_KEY` supplied directly to the trusted server process. Supply `ECONOMIC_OPERATOR_BOOTSTRAP_REASON` or `ECONOMIC_FEATURE_CHANGE_REASON` through the operator's secret/runtime environment; do not type a private reason into shell arguments or commit it to a file. Bootstrap additionally requires the exact independent confirmation:

```bash
npm run economic:test-activation -- bootstrap --apply --actor=<reviewed-auth-user-uuid> --confirm=ELYSIA-ECONOMIC-OPERATOR-BOOTSTRAP-TEST-ONLY
```

The database permits the one-time bootstrap only when both current administrator sources agree and no active economic operator assignment exists. It grants only `economic_operator_assignments_manage`. Use that narrowly scoped, authenticated operator workflow to grant a separately reviewed `economic_feature_flags_manage` assignment before changing a flag.

Every feature mutation requires a new UUID kept as the durable idempotency key and one of the database's exact confirmations:

```bash
npm run economic:test-activation -- feature --apply --actor=<operator-auth-user-uuid> --request-id=<new-uuid> --feature=economic_webhooks --enable --confirm="ENABLE TEST ECONOMIC FEATURE"
npm run economic:test-activation -- feature --apply --actor=<operator-auth-user-uuid> --request-id=<new-uuid> --feature=economic_webhooks --disable --confirm="DISABLE TEST ECONOMIC FEATURE"
```

The CLI has an exact allowlist of repository-reviewed, test-only features and permanently excludes `live_stripe`. Organization billing must enable and verify `organization_contract_workflow` before `organization_billing`. Sponsorship acquisition must enable and verify `sponsorship_review_workflow` and `economic_webhooks` before the independent `sponsorship_checkout` flag; public sponsor display separately requires `sponsorship_review_workflow` before `sponsorship_display`. Assistance issuance must enable and verify `economic_assistance_workflow`. Enable prerequisites one at a time, exercise their tests and rollback, then enable the dependent feature with a different request UUID.

`marketplace_payouts` is also deliberately absent from this CLI. The repository records test seller readiness, commission and payable balances, and separately gates private `marketplace_payout_preparation`; it does not execute a provider transfer or payout. Preparation returns `providerExecutionAvailable: false` and `balancesAreTestRecords: true`, stores no fabricated transfer reference, and must be described in the UI as an accounting rehearsal only. The execution flag remains false until a future, separately reviewed payout-execution and reconciliation release; paid test offers may only accrue private test-mode payable balances.

The database independently rejects live activation, checks the operator capability and prerequisite dependency graph, records a private reason and audit event, and treats exact UUID replay idempotently while rejecting conflicting reuse. Database feature state and the corresponding deployment binding are independent kill switches; both must be reviewed and enabled for a feature to become available. Never use this tool against an unverified project, and never infer that successful test activation authorizes production.

## Activation sequence

1. Keep every feature flag false and deploy/review only after normal project approval.
2. Run `npm run test:release` with rootless Podman or user-scoped Docker and retain the complete passing result;
   do not activate from `test:all` alone.
3. Verify the dedicated billing Worker owns `/api/billing/*`, Pages owns only `/api/sandbox/*`, and neither runtime has the other's secret bindings.
4. Confirm `/api/billing/capabilities` reports test mode and disabled mutations without exposing configuration details.
5. Enable support checkout in a non-live environment.
6. Create one Stripe test Checkout Session with a Stripe test payment method.
7. Deliver the signed test webhook and verify exactly one internal event is processed.
8. Replay the event and verify the result is idempotent.
9. Verify the thank-you page shows processing until database state is webhook-confirmed.
10. Exercise refund, dispute, recurring renewal/failure/cancellation, and portal tests with test objects.
11. Verify an unrelated authenticated user cannot read the order and a guest receives only the deliberately narrow guest result.
12. Disable the mutation flag and confirm existing free/community behavior remains available.

## External activation ledger

Repository completion is not deployment approval. Keep every switch false until all applicable external facts below are recorded in a private release record:

1. **Database provenance:** run the read-only hosted inventory with a dedicated read-only database role; compare object signatures, RLS, policies, grants, function ACLs, Auth assumptions, storage policies, and the hosted migration ledger with the captured baseline and every forward migration. Explain all manual-SQL drift. Apply only separately approved forward migrations, never the captured baseline.
2. **Disposable database gate:** run `npm run test:release` with rootless Podman or user-scoped Docker and retain a complete pass of migration ordering, behavior fixtures, catalog integrity, `plpgsql_check`, RLS, and function ACLs. Static source tests alone do not satisfy this gate.
3. **Runtime isolation:** create a dedicated non-live billing Worker and exact `/api/billing/*` route, keep Pages on `/api/sandbox/*`, verify disjoint encrypted bindings, protect the hostname with Cloudflare Access, deploy reviewed rate limiting for guest checkout, and configure private Cron/alerting for notification retry. The checked-in route-free example proves none of these external facts.
4. **Stripe sandbox:** supply test keys only; pin and verify the API and webhook versions; create immutable reviewed test products/prices; configure the exact platform-account webhook event list and signing secret; verify receipts, hosted Checkout, idempotent replay, Customer Portal cancellation, refund/dispute/renewal ordering, and Connect onboarding readiness where applicable. Do not use connected-account webhooks for the platform economic processor.
5. **Legal and consent integrity:** approve the exact test-mode terms, privacy, refund, recurring-cancellation, Marketplace, organization, and sponsorship text; run `npm run test:economic-legal-integrity`; verify every active database document and consent-bundle SHA-256 against `src/pages/Legal/economicLegalContentManifest.ts`; and create a new immutable version/hash rather than editing historical consent meaning.
6. **Reconciliation and accounting:** establish private alert ownership, webhook replay procedures, fulfillment-hold review, refunds, disputes, cancellation, retention, export handling, and separation of economic operator capabilities. Stripe balance-transaction retrieval is not implemented: `processor_fee_minor` and `net_minor` remain `null` with `settlement_details_pending`. A reviewed, idempotent provider-settlement reconciliation path is a blocker for live accounting and payments; never estimate these values.
7. **Business activation:** complete the EIN, dedicated business bank account, Stripe live verification and payout setup, final legal/tax/accounting review, refund and customer-support operations, production privacy disclosures, and incident-response ownership. Never substitute a personal SSN or bank account.
8. **Release evidence:** exercise guest and account-linked test Checkout, canonical-customer concurrency, signed webhook replay and out-of-order events, full/partial refunds, disputes, recurring cancellation, free Marketplace continuity under the payment kill switch, all three settlement-hold families, sandbox ledger conservation, Job Post publication separation, Marketplace license/install separation, owner privacy, operator separation of duties, rollback, accessibility, and responsive behavior.

This repository deliberately has no supported live-activation path. `STRIPE_LIVE_ENABLED=true`, live keys, provider payout execution, and live catalog approval remain forbidden. Passing the ledger may justify a later reviewed forward release; it does not turn this test-only release live.

## Signal Console notification delivery

Canonical order, subscription, refund, dispute, license, balance, assistance, and account-request state remains in the private economic tables. Signal Console notifications are a non-canonical convenience projection. After a verified webhook commits canonical state, the handler makes one bounded, best-effort service-role call to `deliver_economic_notification_outbox(25)`. Delivery failure is deliberately swallowed so Stripe does not receive a false failure for an event that has already committed; the outbox records attempts and applies bounded backoff.

The checked-in Wrangler example contains no Cron Trigger, and
`BILLING_NOTIFICATION_RETRY_ENABLED` defaults false. Before test activation,
add a private Cron Trigger only to the reviewed environment-specific billing
Worker configuration, verify its schedule and billing-only bindings, set the
independent retry flag true, and verify private alerting for repeated `failed`
or `abandoned` rows. The scheduled handler calls the bounded
`deliver_economic_notification_outbox(25)` service-role operation until each
batch reports no work. The schedule must run inside the billing Worker, never
Pages or the sandbox runtime; it must never expose the service-role key and must
not be implemented as an unauthenticated public drain URL. A delayed or missing
notification must never be interpreted as a failed payment, lost credit,
revoked license, or changed account state; every UI must continue to load its
canonical user-scoped projection.

## Connect boundary

Stripe Connect is test-only and disabled by default. Hosted onboarding can establish payout readiness; it cannot establish developer trust, publisher verification, listing approval, or installation authority. Live onboarding and payouts remain blocked until EcoSyneva has completed EIN, dedicated business banking, Stripe live verification, contracts, tax/accounting review, and an approved payout runbook.

Account Links are single-use, short-lived onboarding URLs. Return them only to the authenticated eligible seller who requested onboarding; never email, message, persist in browser storage, or log them. A visit to the configured `return_url` proves only that the hosted flow was exited—not that requirements are complete or payouts are enabled. Readiness must come from a fresh authenticated server retrieval or a verified provider event and then be recorded privately. Connected-account creation uses a stable seller-account idempotency key, while each durable onboarding request owns a different Account Link key. A retry of the same request is idempotent; an expired or already-visited link requires a new same-origin request and must not be replayed from a stored URL.

## Live prohibition

This repository state must reject live secret keys and `STRIPE_LIVE_ENABLED=true`. Do not invent an EIN, substitute a personal SSN, connect a personal bank account, create a real charge, or infer that test success authorizes production.
