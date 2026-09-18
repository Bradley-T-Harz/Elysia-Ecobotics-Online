# One-time Support activation — 2026-09-18

**ONE_TIME_SUPPORT_ACTIVE — READY_FOR_FIRST_GENUINE_WEBSITE_TRANSACTION**

Bradley Harz's explicit one-time-only authorization is recorded in the canonical production economic audit. The coordinated production database, Worker and frontend publication gates are active. [Verification](verification.json) records the exact state; [authorization and rollback](authorization.md) preserve scope and the acquisition kill switch.

## Release and checks

- Code: `5dd83a48755f970d562d4820b0a9684f374aaf1c`, pushed to private `online/main`, `online/stripe-first-party-2026-09-15`, `legacy/stripe-first-party-2026-09-15`.
- Worker deployment `1c8a450f-b92c-43a6-8e04-83b724138cc7`; active version `4e5269c9-0631-4004-95bb-fcaa6542b90e` at 100%.
- Production Pages deployment `d1c6bb47-01ef-4c48-8837-41c1e58aa13c`, source `5dd83a4`; production origin `https://elysiaecobotics.com`.
- Focused activation/publication isolation regression, production environment boundaries, functions typecheck, production build and artifact/auth/public-config verification passed. Sandbox artifact publication remains disabled by default; no sandbox deployment or configuration changed.
- Public `/support` exposed the enabled one-time button with recurring disabled. The real website returned HTTP 201 and created exactly one unpaid LIVE $5 Checkout and its canonical `support_one_time`, USD 500-cent order. Reusing the same request returned the same session; no duplicate order/payment was created.
- Stripe-hosted page displayed the business and $5 amount, with no recurring/test/BNPL offering visible. Successful adapter execution checked the LIVE account and dedicated PMC policy. Its qualified request uses `mode=payment`, `automatic_tax[enabled]=false`, adaptive pricing disabled, database-authoritative integer amounts and Support metadata. No separate privileged Stripe Session GET was performed.
- Other acquisition endpoints rejected requests; the signed-webhook endpoint rejected an unsigned body with `webhook_signature_invalid`. Existing signature/raw-body/deduplication/idempotency protections are unchanged.
- Database confirms owner authorization, one `checkout_created` order, no paid timestamp and **zero payment transactions**. The unpaid session expires automatically; verification submitted no payment or synthetic paid event. The browser harness lost the initial response body on navigation; hosted verification reused the same session successfully.
- No migrations, Stripe objects, credentials, Access policies or unrelated lanes changed.

## Exact gate state

| Layer | ON | OFF |
|---|---|---|
| Worker | `BILLING_ENABLED`, `BILLING_SUPPORT_CHECKOUT_ENABLED`, `BILLING_WEBHOOK_FULFILLMENT_ENABLED`, `BILLING_NOTIFICATION_RETRY_ENABLED`, `BILLING_TEST_REFUNDS_ENABLED`, `BILLING_EDGE_RATE_LIMIT_CONFIRMED`, `BILLING_FIRST_PARTY_PREFLIGHT_CONFIRMED`, `STRIPE_LIVE_ENABLED` | Every other `_ENABLED` and `_CONFIRMED` flag |
| Database | `support_checkout`, `live_stripe`, `economic_webhooks`, `test_refund_execution`; preexisting free `sandbox_credit_display` / `sandbox_credit_enforcement` unchanged | Every other feature flag |
| Public | Billing publication `live`; one-time Support | Recurring Support, Job Posts, professional services, sponsorship |

`BILLING_MODE=live`. Five-minute schedule enabled for bounded retry/reconciliation/expiry/notification processing. Refund flag's historical `TEST` name also controls the qualified LIVE refund route; economic capability/dual-control checks remain mandatory. Customer Portal stays OFF because recurring acquisition is not authorized. Automatic tax remains OFF. Marketplace, Connect, seller onboarding/KYC, creator payouts, paid compute and physical commerce remain HARD OFF.

## Next owner step

Bradley opens the production website and makes the first genuine Support payment. Then verify the signed webhook, provider-confirmed internal payment, receipt/acknowledgment, Stripe payout, Canvas Credit Union deposit and reconciliation. None of those completed-payment outcomes are claimed here. Recurring Support requires separate later authorization after one-time proves live.
