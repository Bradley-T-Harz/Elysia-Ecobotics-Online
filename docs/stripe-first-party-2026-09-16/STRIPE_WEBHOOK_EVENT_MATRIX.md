# Webhook contract

The exact 20 events, separate registered URLs and 2025-02-24.acacia version are in [the human runbook](STRIPE_DASHBOARD_HUMAN_RUNBOOK.md#3-exact-webhooks) and [executable contract](../../functions/api/billing/_shared/stripeContract.ts). Existing [event semantics and durable inbox](../stripe-first-party-2026-09-15/STRIPE_WEBHOOK_EVENT_MATRIX.md) remain authoritative.

New regression: subscription-created PaymentIntents can lack subscription metadata. Valid signed events enter the inbox; known provider references resolve them, and unmatched events retry after invoices establish references. Recurring Checkout/invoice enrichment permits absent inherited PaymentIntent metadata, rejects explicit conflicting metadata and checks exact amount/currency/mode/status. One-time metadata remains mandatory when associating its enrichment. No unverified provider body or customer-only match can produce money truth.

Provider reference: [Stripe metadata propagation rules](https://docs.stripe.com/metadata). The lack of automatic subscription-to-PaymentIntent metadata is why exact durable provider references remain necessary.
