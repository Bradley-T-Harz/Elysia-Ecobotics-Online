# Webhook event matrix

Endpoint: `/api/billing/webhook`. Raw body HMAC-SHA256, constant-time digest comparison, ±300 seconds, exact API version `2025-02-24.acacia`, selected environment and no connected-account envelope. Signature verification precedes any inbox write. A durable inbox commit precedes provider enrichment or convenience notification. Retry failures never turn a redirect into paid state.

| Events | Economic effect |
|---|---|
| checkout.session.completed | Reconcile owned order; unpaid completion stays pending |
| checkout.session.async_payment_succeeded / async_payment_failed | Confirm eventual settlement or failure |
| checkout.session.expired | Expiry, never payment success |
| payment_intent.succeeded / payment_failed / canceled | Provider-confirmed payment outcome |
| invoice.paid / payment_failed | Recurring invoice payment/failure; no compute or governance effect |
| customer.subscription.created / updated / deleted | Subscription state and cancellation timing |
| refund.created / updated / failed | Provider-confirmed refund outcome |
| charge.dispute.created / updated / closed / funds_withdrawn / funds_reinstated | Dispute holds, resolution and recorded-basis accounting |

Provider+event uniqueness and payload hash detect duplicate/conflicting delivery. Event ordering checks avoid older subscription/order state overwrites. Processor fee and receipt enrichment is append-only; unknown fees remain unknown. Receipt links must use HTTPS pay.stripe.com and are returned only with authorized account records. The retry scheduler claims at most 25 failed inbox events, up to 20 attempts with exponential backoff capped at one hour; then operator review. Up to five incomplete settlements are claimed every run with a 15-minute retry delay. Activate the cron only with secure runtime/DB bindings and verified webhook capability.

[Stripe signatures](https://docs.stripe.com/webhooks/signature), [idempotency](https://docs.stripe.com/api/idempotent_requests), [Checkout](https://docs.stripe.com/payments/checkout).
