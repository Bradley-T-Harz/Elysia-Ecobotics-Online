// Reviewed first-party contract. Version changes require new event fixtures and qualification.
export const STRIPE_FIRST_PARTY_API_VERSION = "2025-02-24.acacia";
export const STRIPE_FIRST_PARTY_WEBHOOK_URLS = Object.freeze({
  test: "https://elysia-first-party-billing-sandbox.bradleytharz3407.workers.dev/api/billing/webhook",
  live: "https://elysiaecobotics.com/api/billing/webhook"
});
export const STRIPE_ECONOMIC_MUTATION_EVENT_TYPES = Object.freeze([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "refund.created",
  "refund.updated",
  "refund.failed",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "charge.dispute.funds_withdrawn",
  "charge.dispute.funds_reinstated"
] as const);
