# Internal economic preparation

This layer prepares internal records and review decisions without providing a payment-provider dispatcher. It does not make the existing test-only Stripe adapter production-capable. No new provider, banking fields, credentials or payment methods are introduced.

## Existing operations are preserved

The Commons Circle Admin Console gains one Economic Operations card. `/admin/economic-operations` retains all existing queues and controls. Sixteen additive subpages organize readiness, Support, sellers, offers, onboarding, settlement, refunds, records, organizations, sponsorship, Job Post fees, hosted allowance, legal versions, provider qualification, owned-fee waivers and audit history. Organization, sponsorship, Job Post and allowance pages link to their existing governed tools; those systems have not been replaced.

`/marketplace/account` adds seller preparation alongside the existing account, free-license and billing UI. `/commons-circle/support-billing` adds private verified records and follow-up requests. Ordinary community roles or donations do not confer economic operator capabilities.

## Independent disabled boundaries

The browser marker `elysia-economic-preparation-publication` ships as `disabled`. Only the exact value `pre_provider` permits the new client to dispatch. It is separate from `elysia-billing-api-publication`, which remains disabled. `public/_routes.json` publishes neither `/api/economic-preparation/*` nor `/api/billing/*`.

The new Pages handlers require all of these exact values before authentication or database work:

| Setting | Required value for a separately authorized internal environment |
|---|---|
| `ECONOMIC_PREPARATION_ENABLED` | `true` |
| `ECONOMIC_PREPARATION_MODE` | `pre_provider` |
| `ECONOMIC_PREPARATION_ACCESS_CONFIRMED` | `true` after access-control verification |
| `ECONOMIC_PREPARATION_RATE_LIMIT_CONFIRMED` | `true` after edge rate-control verification |
| `ECONOMIC_PREPARATION_PUBLIC_ORIGIN` | Exact approved origin for mutations |

No configuration file sets these flags. Confirmation flags attest to separately verified edge controls; they do not install those controls. The server also requires the existing Supabase server authentication configuration. The database master gate and each seller/settlement/waiver/Support preparation gate default to false. Its mode is constrained to `pre_provider`; `provider_execution_enabled` is constrained to false.

Even satisfying every preparation gate provides no ability to execute a payment, refund, cancellation, onboarding or payout. Current billing/provider guards, routes, examples and adapter remain unchanged.

## Private protocol and authority

`GET /api/economic-preparation/state?audience=seller|operator|account` returns a strict, bounded projection. `POST /api/economic-preparation/command` accepts a strict action union. The server authenticates the bearer and supplies the actor; clients cannot supply one. Mutation origin, JSON shape, amount bounds, text lengths and prohibited identifier patterns are checked before dispatch. There are no raw bank/card/tax-ID fields.

Requests are limited to 16 KiB and responses to 128 KiB. Browser requests have a 10-second abort, reject redirects, omit cookies, and require exact validated JSON envelopes. Private failures return generic messages. React clears private state on authentication changes and ignores stale or unmounted asynchronous results. Ambiguous retries reuse a request UUID; success is never inferred from an unconfirmed response.

Both RPCs are service-role-only with a fixed empty SQL search path and explicit function ownership. All eight private tables have RLS enabled and direct grants revoked even from the service role. The RPC checks a confirmed, recoverable, unbanned actor, existing seller eligibility/restrictions, narrow operator capabilities, record ownership and current revisions. Audit/proposal history is append-only. Idempotency keys bind actor and exact payload; row/advisory locks serialize contested actions.

| Work | Authority |
|---|---|
| Seller application, terms, publisher link, offerings | Eligible creator owning the seller and reviewed add-on version |
| Seller/offer review and settlement preparation | `marketplace_payout_manage`; seller/offer reviews must be independent of the creator |
| Owned-fee waiver approval/revocation | `economic_assistance_manage` |
| Own Support follow-up | Owner of the verified Support order/subscription |
| Support follow-up review | `economic_refunds_manage` |
| Policy proposal creation | `economic_feature_flags_manage`; no adoption operation |
| Private records and audit | Existing payment/audit/settlement capabilities as appropriate |

## Seller lifecycle

An eligible developer can create a pending seller-linked preparation, acknowledge the immutable `2026-09-08-readiness` Marketplace terms, link an existing owned publisher, and submit internal review. The publisher must already be verified. This layer cannot verify a publisher, approve an add-on, grant community authority or mark the existing provider seller account active.

Application transitions are draft → submitted → approved / changes requested / rejected, with controlled suspension, corrections and withdrawal. Changes to an application return it to draft. Readiness rechecks developer eligibility, restrictions, publisher ownership/link and current terms; approval alone is insufficient. Review responses and revisions are retained.

An offering binds one reviewed published add-on version, buyer license identifier/version, currency and proposed price. Free drafts require zero price and no fee proposal. Commercial drafts require a positive integer USD price and an immutable fee proposal reference. Internal offering review rechecks identity and version eligibility; revocation becomes a visible blocker. Drafts do not create provider prices or purchasable commercial offers. Existing free catalog/release paths remain in place.

The final seller handoff always says payment onboarding and payouts are disabled. No banking information is requested or stored here.

## Settlement and records

A reconciliation snapshot derives from an existing Marketplace contract, verified internal payments, immutable commission events, refunds, disputes and payout allocations. It does not accept financial evidence through a manual form. It separates gross price, original platform fee, creator share, recorded creator ledger obligation, processor fee, refund and dispute exposure. Unknown processor data remains null.

States are awaiting payment, reconciliation required, refund hold, dispute hold, review required, held, handoff prepared and canceled. Fresh source evidence is hashed; both review and read projections detect changes. A handoff may be prepared only after the internal reconciliation blockers are clear. Fee/liability/tax adoption, qualified provider-account evidence and provider execution remain explicit blockers. A canceled preparation may be recomputed through an explicit audited refresh; history is preserved. No state represents a completed bank payout.

Partial refunds use the existing cumulative commission reversal ledger. Pending refunds, unresolved disputes, nonpositive obligations, restricted sellers and existing allocations block handoff. Creator obligations remain distinct from EcoSyneva operating funds. A lost dispute remains held pending the adopted liability/reconciliation process; this layer does not choose who funds a loss.

Support Acknowledgments, Marketplace Payment Records, Refund Records and Creator Payout Preparations have separate types and labels. They report existing internal test evidence or preparation only. None establishes provider email delivery, charitable deductibility, tax-invoice sufficiency or a completed creator payout. Cancellation/refund/delivery inquiries cannot alter verified subscription/refund/delivery truth. No Support request grants compute, recognition or governance authority.

## EcoSyneva-owned waivers

The scope is deliberately limited to EcoSyneva's Marketplace platform fee, its Job Post fee, or an organization-service charge where EcoSyneva is the provider. A pending order and its authoritative contract determine ownership and the maximum amount. Cumulative approved waivers cannot exceed that amount. Actor, reason, time, component, charge and amount are recorded, and revocation is audited.

A $10 creator price with a proposed $0.50 platform portion permits at most $0.50 of platform-fee waiver preparation. The creator's $10 price is never reduced; an illustrative full fee waiver leaves $10 before processor cost/tax. The original contract/order is not edited. Creator discounts require a separately governed future mechanism; there is no generic waive-everything action.

The existing checkout adapter cannot attach a provider session to an order carrying an active prepared waiver. Consumption of the waiver by the eventual qualified charge/ledger adapter is still required. This preparation is neither a completed price adjustment nor a refund, assistance allocation, sponsorship or public entitlement.

## Policy remains proposed

The seeded 500 basis-point Marketplace fee and 30-day optional-proof retention are unadopted, append-only proposals. The layer has no policy-adoption API, deletion scheduler or active legal-pointer update. Existing proof redaction/storage/attachment hardening and the Support-credit quarantine remain separate prepared migrations. Continuity Reserve, compensation and payment-independent allowance renewal remain owner budget/policy decisions.

## Local checks

Use `node scripts/runReadinessChecks.mjs <check>` to exclude dotenv, inherited provider credentials and external network access. Relevant checks: `build`, `functions`, `billing` (includes `preProvider`), `regression`, `readiness`, `legal`, `integration`, and `preProviderBrowser --output <directory-outside-repository>`.

The browser suite requires a synthetic build from this wrapper, serves loopback only, intercepts all external requests, and alters only the served copy of the preparation marker. The built artifact on disk retains both disabled markers. The database suite runs the ordered migrations and synthetic behavior fixtures in a disposable networkless PostgreSQL container. These checks do not establish provider-backed behavior or production deployment.

Do not deploy the synthetic `dist`, copy evidence into the public bundle, use an earlier 23-file publication overlay for these new dependencies, or apply these migrations as part of a public-copy release. Review a new exact manifest and rollback plan for each separate release. Provider activation requires approved activity, adopted responsibilities, qualified adapter implementation and distinct owner authorization.
