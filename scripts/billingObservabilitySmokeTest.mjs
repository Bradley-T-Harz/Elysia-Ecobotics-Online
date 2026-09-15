import { handleCheckout } from "../functions/api/billing/_shared/checkout.ts";
import { emitBillingEvent } from "../functions/api/billing/_shared/observability.ts";
import { handleCustomerPortal } from "../functions/api/billing/portal.ts";
import { handleOperatorReconciliation } from "../functions/api/billing/operator/reconciliation.ts";
import { handleOperatorRefundHold } from "../functions/api/billing/operator/refund-hold.ts";
import { handleOperatorTestRefundExecution } from "../functions/api/billing/operator/refund-execution.ts";
import { handleSellerOnboarding } from "../functions/api/billing/seller/onboarding.ts";
import { handleStripeWebhook } from "../functions/api/billing/webhook.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const origin = "https://elysiaecobotics.com";
const correlationId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const secretMaterial = [
  `sk_test_${"s".repeat(40)}`,
  `whsec_${"w".repeat(40)}`,
  "Bearer private-access-token",
  "private@example.invalid",
  "cus_private",
  "pi_private",
  "re_private",
  "cs_test_private",
  "acct_private",
  "Private refund reason must never be logged",
  "raw webhook private body"
];
const env = {
  BILLING_ENABLED: "true",
  BILLING_MODE: "test",
  BILLING_PUBLIC_ORIGIN: origin,
  BILLING_STAGING_ACCESS_CONFIRMED: "true",
  BILLING_EDGE_RATE_LIMIT_CONFIRMED: "true",
  BILLING_SUPPORT_CHECKOUT_ENABLED: "true",
  BILLING_WEBHOOK_FULFILLMENT_ENABLED: "true",
  BILLING_NOTIFICATION_RETRY_ENABLED: "true",
  BILLING_PORTAL_ENABLED: "true",
  BILLING_SELLER_ONBOARDING_ENABLED: "true",
  BILLING_TEST_REFUNDS_ENABLED: "true",
  STRIPE_CONNECT_ENABLED: "true",
  STRIPE_LIVE_ENABLED: "false",
  STRIPE_SECRET_KEY_TEST: secretMaterial[0],
  STRIPE_WEBHOOK_SECRET_TEST: secretMaterial[1],
  STRIPE_API_VERSION: "2025-02-24.acacia",
  STRIPE_WEBHOOK_API_VERSION: "2025-02-24.acacia"
};
const auth = { accessToken: "private-access-token", userId, email: secretMaterial[3], supabase: {} };
const events = [];
const logger = (event) => events.push(event);

function post(path, body) {
  return new Request(`${origin}${path}`, {
    method: "POST",
    headers: {
      origin,
      authorization: secretMaterial[2],
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

const preparation = {
  orderId,
  publicReference: "opaque_order_reference_1234567890",
  idempotencyKey: `checkout:${correlationId}`,
  amountMinor: 500,
  currency: "usd",
  providerProductReference: "prod_private",
  providerPriceReference: null,
  providerCustomerReference: secretMaterial[4]
};
await handleCheckout(post("/api/billing/checkout", {
  clientRequestId: correlationId,
  amountMinor: 500,
  currency: "usd",
  sourceRoute: "/support",
  consentVersion: "support-v1"
}), env, "support_one_time", {
  authenticateOptional: async () => auth,
  authenticateRequired: async () => auth,
  begin: async () => preparation,
  provider: () => ({ createCheckout: async () => ({ providerSessionId: secretMaterial[7], providerCustomerReference: secretMaterial[4], checkoutUrl: "https://checkout.stripe.com/c/pay/private" }) }),
  attach: async () => undefined,
  fail: async () => undefined,
  logger
});

await handleCustomerPortal(post("/api/billing/portal", { clientRequestId: correlationId }), env, {
  authenticate: async () => auth,
  prepare: async () => ({ portalRequestId: orderId, billingCustomerId: userId, providerCustomerReference: secretMaterial[4] }),
  provider: () => ({ createCustomerPortalSession: async () => ({ providerSessionId: "bps_private", portalUrl: "https://billing.stripe.com/p/session/private" }) }),
  record: async () => undefined,
  logger
});

await handleOperatorRefundHold(post("/api/billing/operator/refund-hold", {
  orderId,
  paymentTransactionId: userId,
  amountMinor: 500,
  clientRequestId: correlationId,
  confirmation: "PLACE TEST REFUND HOLD",
  reason: secretMaterial[9]
}), env, {
  authenticate: async () => auth,
  mutate: async () => ({ refundRequestId: userId, orderId, amountMinor: 500, currency: "usd", status: "held_for_review", idempotentReplay: false }),
  logger
});

await handleOperatorReconciliation(post("/api/billing/operator/reconciliation", {
  orderId,
  clientRequestId: correlationId,
  confirmation: "OPEN ECONOMIC RECONCILIATION CASE",
  reason: "Private reconciliation notes never enter observability."
}), env, {
  authenticate: async () => auth,
  mutate: async () => ({ reconciliationCaseId: userId, orderId, status: "open", idempotentReplay: true }),
  logger
});

await handleOperatorTestRefundExecution(post("/api/billing/operator/refund-execution", {
  refundRequestId: orderId,
  approvalClientRequestId: correlationId,
  providerAttachClientRequestId: userId,
  confirmation: "AUTHORIZE TEST REFUND",
  reason: "Private test refund execution reason must remain outside observability."
}), env, {
  authenticate: async () => auth,
  prepare: async () => ({
    refundRequestId: orderId,
    orderId,
    providerPaymentReference: "pi_private",
    amountMinor: 500,
    currency: "usd",
    providerIdempotencyKey: `refund:${orderId}`,
    idempotentReplay: false
  }),
  provider: () => ({ createRefund: async () => ({
    providerRefundReference: "re_private",
    status: "succeeded",
    providerEventCreatedAt: "2026-07-16T12:00:00.000Z",
    providerResponseSha256: "b".repeat(64)
  }) }),
  attach: async () => ({
    refundRequestId: orderId,
    orderId,
    economicRefundId: userId,
    status: "completed",
    providerStatus: "succeeded",
    idempotentReplay: false,
    testMode: true
  }),
  logger
});

const deniedOnboarding = await handleSellerOnboarding(post("/api/billing/seller/onboarding", {
  clientRequestId: correlationId,
  sellerAgreementVersion: "marketplace-seller-v1",
  stripeConnectDisclosureVersion: "stripe-connect-disclosure-v1",
  sourceRoute: "/marketplace/account",
  acceptSellerAgreement: true,
  acceptStripeConnectDisclosure: true
}), env, {
  authenticate: async () => auth,
  prepare: async () => ({
    sellerAccountId: orderId,
    providerAccountReference: secretMaterial[8],
    accountIdempotencyKey: `seller-account:${orderId}`,
    linkIdempotencyKey: `seller-link:${userId}`,
    status: "onboarding",
    onboardingRequestId: userId,
    testMode: true
  }),
  provider: () => ({ createSellerOnboarding: async () => ({ providerAccountReference: secretMaterial[8], onboardingUrl: "https://connect.stripe.com/setup/private" }) }),
  attach: async () => undefined,
  logger
});

assert(deniedOnboarding.status === 503, "Hard-off onboarding unexpectedly dispatched.");
await handleStripeWebhook(new Request(`${origin}/api/billing/webhook`, {
  method: "POST",
  headers: { "content-type": "application/json", "stripe-signature": secretMaterial[1] },
  body: JSON.stringify({ private: secretMaterial[10], email: secretMaterial[3] })
}), env, {
  provider: () => ({ verifyAndNormalizeWebhook: async () => ({
    provider: "stripe",
    providerEventId: "evt_private",
    eventType: "checkout.session.completed",
    eventCreatedAt: new Date().toISOString(),
    livemode: false,
    objectType: "checkout.session",
    providerObjectReference: secretMaterial[7],
    orderId,
    providerCustomerId: secretMaterial[4],
    providerPaymentId: secretMaterial[5]
  }) }),
  process: async () => "processed",
  logger
});

emitBillingEvent(logger, "billing.checkout", "failed", "not-a-safe-correlation");

const serialized = JSON.stringify(events);
for (const forbidden of secretMaterial) {
  assert(!serialized.includes(forbidden), `Structured billing observability leaked forbidden material: ${forbidden.slice(0, 12)}`);
}
assert(events.length >= 12, "Expected billing lifecycle events were not emitted.");
assert(events.every((event) => Object.keys(event).every((key) => ["event", "outcome", "correlationId"].includes(key))), "Billing logs contained fields beyond the strict allowlist.");
assert(events.every((event) => event.correlationId === undefined || event.correlationId === correlationId || event.correlationId === orderId), "Billing logs accepted an unsafe correlation value.");
for (const eventName of [
  "billing.checkout",
  "billing.customer_portal",
  "billing.operator_refund_hold",
  "billing.operator_refund_execution",
  "billing.operator_reconciliation",
  "billing.webhook"
]) assert(events.some((event) => event.event === eventName && event.outcome === "attempted"), `Missing attempted observability for ${eventName}.`);

console.log("Billing structured observability smoke test ok.");
