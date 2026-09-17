import {paymentMethodsFixture} from './fixtures/paymentMethodConfiguration.mjs';
import { BillingHttpError } from "../functions/api/billing/_shared/http.ts";
import { deliverEconomicNotificationOutbox, processProviderEvent } from "../functions/api/billing/_shared/database.ts";
import { createStripeTestProvider, STRIPE_ECONOMIC_MUTATION_EVENT_TYPES, StripeTestProvider } from "../functions/api/billing/_shared/stripe.ts";
import { handleStripeWebhook } from "../functions/api/billing/webhook.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const nowSeconds = 1_800_000_000;
const webhookSecret = `whsec_${"w".repeat(40)}`;
const secretKey = `sk_test_${"s".repeat(40)}`;
const env = {
  STRIPE_PAYMENT_METHOD_CONFIGURATION_ID: "pmc_synthetic",
  BILLING_ENABLED: "true",
  BILLING_MODE: "test",
  BILLING_PUBLIC_ORIGIN: "https://elysiaecobotics.com",
  BILLING_STAGING_ACCESS_CONFIRMED: "true",
  BILLING_EDGE_RATE_LIMIT_CONFIRMED: "true",
  BILLING_WEBHOOK_FULFILLMENT_ENABLED: "true",
  STRIPE_LIVE_ENABLED: "false",
  STRIPE_SECRET_KEY_TEST: secretKey,
  STRIPE_WEBHOOK_SECRET_TEST: webhookSecret,
  STRIPE_API_VERSION: "2025-02-24.acacia",
  STRIPE_WEBHOOK_API_VERSION: "2025-02-24.acacia",
  STRIPE_WEBHOOK_TOLERANCE_SECONDS: "300"
};

const calls = [];
async function fakeFetch(input, init) {
  const url = new URL(String(input));
  const headers = new Headers(init?.headers);
  const body = new URLSearchParams(String(init?.body ?? ""));
  calls.push({ url, init, headers, body });
  assert(url.origin === "https://api.stripe.com", "Stripe adapter called an untrusted API origin.");
  assert(headers.get("authorization") === `Bearer ${secretKey}`, "Stripe adapter omitted its test key.");
  assert(headers.get("stripe-version") === env.STRIPE_API_VERSION, "Stripe API version was not pinned by configuration.");
  assert(!String(init?.body ?? "").includes(secretKey) && !String(init?.body ?? "").includes(webhookSecret), "A Stripe secret entered the request body.");

  if (url.pathname === "/v1/payment_method_configurations/pmc_synthetic") return Response.json(paymentMethodsFixture());
  if (url.pathname === "/v1/checkout/sessions") {
    return new Response(JSON.stringify({ id: "cs_test_fixture", object: "checkout.session", customer: null, url: "https://checkout.stripe.com/c/pay/fixture" }), { status: 200 });
  }
  if (url.pathname === "/v1/customers") {
    return new Response(JSON.stringify({ id: "cus_fixture", object: "customer" }), { status: 200 });
  }
  if (url.pathname === "/v1/billing_portal/sessions") {
    return new Response(JSON.stringify({ id: "bps_fixture", url: "https://billing.stripe.com/p/session/fixture" }), { status: 200 });
  }
  if (url.pathname === "/v1/refunds") {
    return new Response(JSON.stringify({
      id: "re_fixture",
      object: "refund",
      amount: Number(body.get("amount")),
      currency: "usd",
      status: "succeeded",
      created: nowSeconds
    }), { status: 200 });
  }
  if (url.pathname === "/v1/accounts" && init?.method === "POST") {
    return new Response(JSON.stringify({ id: "acct_fixture", object: "account" }), { status: 200 });
  }
  if (url.pathname === "/v1/account_links") {
    return new Response(JSON.stringify({ object: "account_link", url: "https://connect.stripe.com/setup/fixture" }), { status: 200 });
  }
  if (url.pathname === "/v1/accounts/acct_fixture" && init?.method === "GET") {
    return new Response(JSON.stringify({
      id: "acct_fixture",
      details_submitted: true,
      charges_enabled: false,
      payouts_enabled: false,
      requirements: { currently_due: ["external_account"], eventually_due: ["individual.verification.document"], disabled_reason: "requirements.past_due" }
    }), { status: 200 });
  }
  if (url.pathname === "/v1/products" && init?.method === "POST") {
    return new Response(JSON.stringify({ id: "prod_marketplacefixture", object: "product", livemode: false }), { status: 200 });
  }
  if (url.pathname === "/v1/prices" && init?.method === "POST") {
    return new Response(JSON.stringify({ id: "price_marketplacefixture", object: "price", livemode: false }), { status: 200 });
  }
  throw new Error(`Unexpected synthetic Stripe request: ${url.pathname}`);
}

const provider = new StripeTestProvider(env, fakeFetch, () => nowSeconds * 1_000);
const ensuredCustomer = await provider.ensureCustomer({
  idempotencyKey: "billing-customer:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
});
const customerCall = calls.at(-1);
assert(ensuredCustomer.providerCustomerReference === "cus_fixture", "The Stripe adapter did not normalize the pre-Checkout canonical Customer.");
assert(customerCall.url.pathname === "/v1/customers" && customerCall.headers.get("idempotency-key") === "billing-customer:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "Canonical Customer creation was not stable and idempotent per Website Account.");
assert(!customerCall.body.has("email") && !customerCall.body.has("name") && !customerCall.body.has("phone"), "Canonical Customer creation sent unnecessary account contact data to Stripe.");
const baseCheckout = {
  orderId: "22222222-2222-4222-8222-222222222222",
  publicReference: "opaque_order_reference_1234567890",
  idempotencyKey: "checkout:11111111-1111-4111-8111-111111111111",
  amountMinor: 500,
  currency: "usd",
  providerProductReference: "prod_fixture",
  providerPriceReference: null,
  providerCustomerReference: null,
  flow: "support_one_time",
  accountLinked: false,
  successUrl: "https://elysiaecobotics.com/support/thank-you?order=opaque_order_reference_1234567890",
  cancelUrl: "https://elysiaecobotics.com/support?checkout=canceled"
};

const oneTime = await provider.createCheckout(baseCheckout);
assert(oneTime.providerSessionId === "cs_test_fixture" && oneTime.checkoutUrl.startsWith("https://checkout.stripe.com/"), "One-time hosted Checkout was not normalized.");
assert(calls.at(-1)?.body.get("expires_at") === String(nowSeconds + 30 * 60), "Hosted Checkout did not receive the reviewed 30-minute abandoned-session bound.");
let nondefaultPortRejected = false;
try {
  await new StripeTestProvider(env, async (url) => new URL(url).pathname.startsWith("/v1/payment_method_configurations/") ? Response.json(paymentMethodsFixture()) : new Response(JSON.stringify({
    id: "cs_test_fixture",
    customer: null,
    url: "https://checkout.stripe.com:444/c/pay/fixture"
  }), { status: 200 })).createCheckout(baseCheckout);
} catch (error) {
  nondefaultPortRejected = error instanceof BillingHttpError && error.code === "payment_provider_invalid";
}
assert(nondefaultPortRejected, "A hosted Stripe redirect with a nondefault explicit port was accepted.");
const oneTimeCall = calls.at(-1);
assert(oneTimeCall.body.get("mode") === "payment", "One-time support did not use Stripe payment mode.");
assert(oneTimeCall.body.get("line_items[0][price_data][unit_amount]") === "500", "Server-validated minor-unit amount was not forwarded.");
assert(oneTimeCall.body.get("line_items[0][price_data][product]") === "prod_fixture", "Server catalog product was not used.");
assert(oneTimeCall.body.get("payment_method_configuration") === "pmc_synthetic" && !oneTimeCall.body.has("payment_method_types[0]"), "One-time support did not select the reviewed dynamic payment method configuration.");
assert(oneTimeCall.body.get("allow_promotion_codes") === "false" && oneTimeCall.body.get("automatic_tax[enabled]") === "false", "Initial support checkout enabled an unsupported commercial feature.");
assert(!oneTimeCall.body.has("shipping_address_collection[allowed_countries][0]") && oneTimeCall.body.get("phone_number_collection[enabled]") === "false", "One-time support requested unnecessary shipping or phone data.");
assert(oneTimeCall.headers.get("idempotency-key") === baseCheckout.idempotencyKey, "Checkout idempotency key was omitted.");

await provider.createCheckout({
  ...baseCheckout,
  flow: "support_recurring",
  accountLinked: true,
  amountMinor: 500,
  providerProductReference: null,
  providerPriceReference: "price_fixture",
  providerCustomerReference: "cus_fixture"
});
const recurringCall = calls.at(-1);
assert(recurringCall.body.get("mode") === "subscription" && recurringCall.body.get("line_items[0][price]") === "price_fixture", "Recurring checkout did not use the fixed server catalog price.");
assert(!recurringCall.body.has("line_items[0][price_data][unit_amount]"), "Client-like recurring amount reached Stripe.");
assert(recurringCall.body.get("customer") === "cus_fixture", "Account-linked recurring support did not reuse its private billing customer.");
assert(recurringCall.body.get("payment_method_configuration") === "pmc_synthetic" && !recurringCall.body.has("payment_method_types[0]"), "Recurring support did not select the reviewed dynamic payment method configuration.");
assert(recurringCall.body.get("allow_promotion_codes") === "false" && recurringCall.body.get("automatic_tax[enabled]") === "false" && recurringCall.body.get("phone_number_collection[enabled]") === "false", "Recurring support enabled promotion codes, automatic tax, or phone collection.");
assert(!recurringCall.body.has("shipping_address_collection[allowed_countries][0]"), "Recurring support requested shipping data.");

for (const flow of ["job_post_fee", "organization_service", "sponsorship"]) {
  await provider.createCheckout({
    ...baseCheckout,
    flow,
    accountLinked: true,
    amountMinor: 9_999_999,
    providerProductReference: null,
    providerPriceReference: "price_fixedfixture",
    providerCustomerReference: "cus_fixture"
  });
  const fixedOneTimeCall = calls.at(-1);
  assert(fixedOneTimeCall.body.get("mode") === "payment", `${flow} did not use one-time Stripe payment mode.`);
  assert(fixedOneTimeCall.body.get("line_items[0][price]") === "price_fixedfixture", `${flow} did not use its server catalog price.`);
  assert(!fixedOneTimeCall.body.has("line_items[0][price_data][unit_amount]"), `${flow} forwarded a mutable amount instead of its fixed price.`);
  assert(fixedOneTimeCall.body.get("payment_method_configuration") === "pmc_synthetic" && !fixedOneTimeCall.body.has("payment_method_types[0]"), `${flow} did not select the reviewed dynamic payment method configuration.`);
  assert(fixedOneTimeCall.body.get("allow_promotion_codes") === "false" && fixedOneTimeCall.body.get("automatic_tax[enabled]") === "false" && fixedOneTimeCall.body.get("phone_number_collection[enabled]") === "false", `${flow} enabled promotion codes, automatic tax, or phone collection.`);
  assert(!fixedOneTimeCall.body.has("shipping_address_collection[allowed_countries][0]"), `${flow} requested shipping data.`);
  assert(fixedOneTimeCall.body.get("payment_intent_data[metadata][economic_order_id]") === baseCheckout.orderId, `${flow} lost its durable order association.`);
  assert(!fixedOneTimeCall.body.has("subscription_data[metadata][economic_order_id]"), `${flow} was accidentally treated as recurring support.`);
}

let missingCanonicalCustomerRejected = false;
try {
  await provider.createCheckout({
    ...baseCheckout,
    flow: "job_post_fee",
    accountLinked: true,
    providerProductReference: null,
    providerPriceReference: "price_fixedfixture",
    providerCustomerReference: null
  });
} catch (error) {
  missingCanonicalCustomerRejected = error instanceof BillingHttpError && error.code === "billing_customer_required";
}
assert(missingCanonicalCustomerRejected, "An account-linked payable Checkout was created before its canonical Stripe Customer was durably attached.");

const portal = await provider.createCustomerPortalSession({
  providerCustomerReference: "cus_fixture",
  idempotencyKey: "portal:11111111-1111-4111-8111-111111111111",
  returnUrl: "https://elysiaecobotics.com/commons-circle/support-billing"
});
assert(portal.portalUrl.startsWith("https://billing.stripe.com/"), "Customer Portal URL was not host-validated.");

const refund = await provider.createRefund({
  orderId: baseCheckout.orderId,
  providerPaymentReference: "pi_privatefixture",
  amountMinor: 200,
  currency: "usd",
  idempotencyKey: "refund:77777777-7777-4777-8777-777777777777"
});
const refundCall = calls.at(-1);
assert(refund.providerRefundReference === "re_fixture" && refund.status === "succeeded", "Test refund provider result was not strictly normalized.");
assert(refundCall.url.pathname === "/v1/refunds" && refundCall.body.get("payment_intent") === "pi_privatefixture" && refundCall.body.get("amount") === "200", "Test refund did not use its private server preparation.");
assert(refundCall.headers.get("idempotency-key") === "refund:77777777-7777-4777-8777-777777777777", "Test refund omitted its DB-derived idempotency key.");
assert(!refundCall.body.has("reason") && /^[0-9a-f]{64}$/.test(refund.providerResponseSha256), "Private operator reason was forwarded to Stripe or provider result integrity was not recorded.");

const callsBeforeHardOff = calls.length;
for (const action of [
  () => provider.createSellerOnboarding({}), () => provider.retrieveSellerStatus("acct_fixture"),
  () => provider.ensureMarketplaceCatalog({}),
  () => provider.createCheckout({ ...baseCheckout, flow: "marketplace_purchase" }),
  () => provider.createCheckout({ ...baseCheckout, flow: "sandbox_credits" })
]) {
  let rejected = false;
  try { await action(); } catch (error) { rejected = error.code === "third_party_money_hard_off"; }
  assert(rejected, "A prohibited third-party or compute provider operation was accepted.");
}
assert(calls.length === callsBeforeHardOff, "A prohibited operation contacted Stripe.");

let liveRejected = false;
try {
  createStripeTestProvider({ ...env, STRIPE_SECRET_KEY_TEST: `sk_live_${"x".repeat(40)}` });
} catch (error) {
  liveRejected = error instanceof BillingHttpError && error.code === "billing_live_disabled";
}
assert(liveRejected, "A live Stripe secret was accepted by the test-only provider.");
let liveModeRejected = false;
try { createStripeTestProvider({ ...env, BILLING_MODE: "live" }); }
catch (error) { liveModeRejected = error instanceof BillingHttpError && error.code === "billing_live_disabled"; }
assert(liveModeRejected, "Live billing mode was accepted by the test-only provider.");
let unpinnedVersionRejected = false;
try { createStripeTestProvider({ ...env, STRIPE_API_VERSION: undefined }); }
catch (error) { unpinnedVersionRejected = error instanceof BillingHttpError && error.code === "billing_misconfigured"; }
assert(unpinnedVersionRejected, "Stripe provider construction accepted an unpinned account-default API version.");
let unpinnedWebhookVersionRejected = false;
try { createStripeTestProvider({ ...env, STRIPE_WEBHOOK_API_VERSION: undefined }); }
catch (error) { unpinnedWebhookVersionRejected = error instanceof BillingHttpError && error.code === "billing_misconfigured"; }
assert(unpinnedWebhookVersionRejected, "Stripe provider construction accepted an unpinned webhook endpoint API version.");

async function signature(rawBody, timestamp = nowSeconds) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(webhookSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`)));
  const hex = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `t=${timestamp},v1=${hex}`;
}

const eventBody = JSON.stringify({
  id: "evt_123456789",
  object: "event",
  type: "checkout.session.completed",
  api_version: env.STRIPE_WEBHOOK_API_VERSION,
  created: nowSeconds,
  livemode: false,
  data: {
    object: {
      id: "cs_test_fixture",
      object: "checkout.session",
      customer: "cus_fixture",
      payment_intent: "pi_fixture",
      subscription: null,
      amount_total: 500,
      currency: "usd",
      status: "complete",
      payment_status: "paid",
      customer_details: { email: "private@example.invalid" },
      metadata: { economic_order_id: baseCheckout.orderId, private_note: "must-not-normalize" }
    }
  }
});
const signatureHeader = await signature(eventBody);
const normalized = await provider.verifyAndNormalizeWebhook(eventBody, signatureHeader);
assert(normalized.providerEventId === "evt_123456789" && normalized.orderId === baseCheckout.orderId, "Verified webhook did not retain its safe idempotency/order association.");
assert(normalized.amountMinor === 500 && normalized.paymentStatus === "paid", "Verified webhook lost normalized payment state.");
assert(normalized.providerCustomerId === "cus_fixture" && normalized.providerPaymentId === "pi_fixture" && normalized.livemode === false, "Verified webhook did not match the economic RPC's normalized provider-reference contract.");
assert(!JSON.stringify(normalized).includes("private@example.invalid") && !JSON.stringify(normalized).includes("must-not-normalize"), "Webhook normalization retained private or arbitrary provider fields.");
assert(/^[0-9a-f]{64}$/.test(normalized.payloadSha256), "Webhook raw-payload hash was not recorded.");
assert(normalized.mutationEligible === true, "Reviewed Checkout event was not marked mutation-eligible by the adapter.");

const connectedAccountEventBody = JSON.stringify({
  ...JSON.parse(eventBody),
  id: "evt_connected_account_rejected_123",
  account: "acct_untrusted_fixture"
});
let connectedAccountEventRejected = false;
try {
  await provider.verifyAndNormalizeWebhook(connectedAccountEventBody, await signature(connectedAccountEventBody));
} catch (error) {
  connectedAccountEventRejected = error instanceof BillingHttpError && error.code === "webhook_event_invalid";
}
assert(connectedAccountEventRejected, "A Stripe Connect-context event reached the platform economic webhook processor.");

const subscriptionCheckoutBody = JSON.stringify({
  id: "evt_subscription_checkout_123",
  object: "event",
  type: "checkout.session.completed",
  api_version: env.STRIPE_WEBHOOK_API_VERSION,
  created: nowSeconds,
  livemode: false,
  data: { object: {
    id: "cs_test_subscription_fixture",
    object: "checkout.session",
    customer: "cus_fixture",
    subscription: "sub_fixture",
    amount_total: 500,
    currency: "usd",
    status: "complete",
    payment_status: "paid",
    metadata: { economic_order_id: baseCheckout.orderId }
  } }
});
const normalizedSubscriptionCheckout = await provider.verifyAndNormalizeWebhook(
  subscriptionCheckoutBody,
  await signature(subscriptionCheckoutBody)
);
assert(
  normalizedSubscriptionCheckout.providerSubscriptionId === "sub_fixture"
    && normalizedSubscriptionCheckout.providerPaymentId === null
    && normalizedSubscriptionCheckout.orderId === baseCheckout.orderId
    && normalizedSubscriptionCheckout.subscriptionStatus === "active",
  "Subscription Checkout completion required or minted a PaymentIntent instead of retaining the session/order/subscription association."
);

const invoiceBody = JSON.stringify({
  id: "evt_invoice_123",
  object: "event",
  type: "invoice.paid",
  api_version: env.STRIPE_WEBHOOK_API_VERSION,
  created: nowSeconds,
  livemode: false,
  data: { object: {
    id: "in_fixture",
    object: "invoice",
    customer: "cus_fixture",
    payment_intent: "pi_renewal_fixture",
    subscription: "sub_fixture",
    amount_paid: 500,
    currency: "usd",
    status: "paid",
    subscription_details: { metadata: { economic_order_id: baseCheckout.orderId } }
  } }
});
const normalizedInvoice = await provider.verifyAndNormalizeWebhook(invoiceBody, await signature(invoiceBody));
assert(
  env.STRIPE_WEBHOOK_API_VERSION === "2025-02-24.acacia"
    && normalizedInvoice.orderId === baseCheckout.orderId
    && normalizedInvoice.providerSubscriptionId === "sub_fixture"
    && normalizedInvoice.providerInvoiceId === "in_fixture"
    && normalizedInvoice.providerPaymentId === "pi_renewal_fixture"
    && normalizedInvoice.subscriptionStatus === "active",
  "Reviewed Acacia paid-invoice shape did not preserve its direct PaymentIntent, subscription/order association, and economic status."
);

const renewalEvents = [];
for (const cycle of [2, 3]) {
  const renewalBody = JSON.stringify({
    ...JSON.parse(invoiceBody),
    id: `evt_invoice_cycle_${cycle}`,
    created: nowSeconds + cycle,
    data: { object: {
      ...JSON.parse(invoiceBody).data.object,
      id: `in_cycle_${cycle}`,
      payment_intent: `pi_cycle_${cycle}`
    } }
  });
  renewalEvents.push(await provider.verifyAndNormalizeWebhook(renewalBody, await signature(renewalBody)));
}
assert(
  new Set(renewalEvents.map((event) => event.providerEventId)).size === 2
    && new Set(renewalEvents.map((event) => event.providerInvoiceId)).size === 2
    && new Set(renewalEvents.map((event) => event.providerPaymentId)).size === 2
    && renewalEvents.every((event) => event.orderId === baseCheckout.orderId && event.subscriptionStatus === "active"),
  "Second and third recurring invoice payments were flattened or lost their unique transaction identity."
);

const failedInvoiceBody = JSON.stringify({
  id: "evt_invoice_failed_123",
  object: "event",
  type: "invoice.payment_failed",
  api_version: env.STRIPE_WEBHOOK_API_VERSION,
  created: nowSeconds,
  livemode: false,
  data: { object: {
    id: "in_failed_fixture",
    object: "invoice",
    customer: "cus_fixture",
    payment_intent: "pi_failed_fixture",
    subscription: "sub_fixture",
    amount_due: 500,
    currency: "usd",
    status: "open",
    metadata: { economic_order_id: baseCheckout.orderId }
  } }
});
const normalizedFailedInvoice = await provider.verifyAndNormalizeWebhook(failedInvoiceBody, await signature(failedInvoiceBody));
assert(normalizedFailedInvoice.subscriptionStatus === "past_due" && normalizedFailedInvoice.amountMinor === 500 && normalizedFailedInvoice.status === null, "Failed recurring invoice did not preserve amount due/become a scoped economic past-due state or leaked generic status into payment handling.");

const cancelingSubscriptionBody = JSON.stringify({
  id: "evt_subscription_canceling_123",
  object: "event",
  type: "customer.subscription.updated",
  api_version: env.STRIPE_WEBHOOK_API_VERSION,
  created: nowSeconds,
  livemode: false,
  data: { object: {
    id: "sub_fixture",
    object: "subscription",
    customer: "cus_fixture",
    status: "active",
    cancel_at_period_end: true,
    current_period_start: nowSeconds - 3600,
    current_period_end: nowSeconds + 86400,
    metadata: { economic_order_id: baseCheckout.orderId }
  } }
});
const normalizedCanceling = await provider.verifyAndNormalizeWebhook(cancelingSubscriptionBody, await signature(cancelingSubscriptionBody));
assert(normalizedCanceling.subscriptionStatus === "canceling" && normalizedCanceling.cancelAtPeriodEnd === true, "Active-through-period cancellation was mistaken for an ended subscription.");

const deletedSubscriptionBody = JSON.stringify({
  id: "evt_subscription_deleted_123",
  object: "event",
  type: "customer.subscription.deleted",
  api_version: env.STRIPE_WEBHOOK_API_VERSION,
  created: nowSeconds,
  livemode: false,
  data: { object: {
    id: "sub_fixture",
    object: "subscription",
    customer: "cus_fixture",
    status: "canceled",
    cancel_at_period_end: false,
    metadata: { economic_order_id: baseCheckout.orderId }
  } }
});
const normalizedDeleted = await provider.verifyAndNormalizeWebhook(deletedSubscriptionBody, await signature(deletedSubscriptionBody));
assert(normalizedDeleted.subscriptionStatus === "ended", "Deleted Stripe subscription did not become the durable internal ended state.");

const refundBody = JSON.stringify({
  id: "evt_refund_123",
  object: "event",
  type: "refund.updated",
  api_version: env.STRIPE_WEBHOOK_API_VERSION,
  created: nowSeconds,
  livemode: false,
  data: { object: { id: "re_fixture", object: "refund", payment_intent: "pi_fixture", amount: 200, currency: "usd", status: "succeeded", metadata: {} } }
});
const normalizedRefund = await provider.verifyAndNormalizeWebhook(refundBody, await signature(refundBody));
assert(normalizedRefund.orderId === null && normalizedRefund.providerPaymentId === "pi_fixture" && normalizedRefund.providerRefundId === "re_fixture" && normalizedRefund.refundAmountMinor === 200 && normalizedRefund.status === null, "Refund event lost its durable payment fallback or leaked its status into payment-success handling.");

const disputeBody = JSON.stringify({
  id: "evt_dispute_123",
  object: "event",
  type: "charge.dispute.created",
  api_version: env.STRIPE_WEBHOOK_API_VERSION,
  created: nowSeconds,
  livemode: false,
  data: { object: { id: "dp_fixture", object: "dispute", payment_intent: "pi_fixture", amount: 500, currency: "usd", status: "needs_response", reason: "fraudulent" } }
});
const normalizedDispute = await provider.verifyAndNormalizeWebhook(disputeBody, await signature(disputeBody));
assert(normalizedDispute.providerDisputeId === "dp_fixture" && normalizedDispute.disputeStatus === "needs_response" && normalizedDispute.disputeReason === "fraudulent" && normalizedDispute.status === null, "Dispute event lost its safe lifecycle state or leaked it into payment handling.");

const currentDisputeBody = JSON.stringify({
  id: "evt_dispute_current_123",
  object: "event",
  type: "charge.dispute.updated",
  api_version: env.STRIPE_WEBHOOK_API_VERSION,
  created: nowSeconds,
  livemode: false,
  data: { object: { id: "du_fixture", object: "dispute", payment_intent: "pi_fixture", amount: 500, currency: "usd", status: "warning_closed", reason: "fraudulent" } }
});
const normalizedCurrentDispute = await provider.verifyAndNormalizeWebhook(currentDisputeBody, await signature(currentDisputeBody));
assert(normalizedCurrentDispute.providerDisputeId === "du_fixture" && normalizedCurrentDispute.disputeStatus === "warning_closed", "Current du_ dispute identifiers or warning lifecycle state were discarded.");

const preventedDisputeBody = JSON.stringify({
  id: "evt_dispute_prevented_123",
  object: "event",
  type: "charge.dispute.updated",
  api_version: env.STRIPE_WEBHOOK_API_VERSION,
  created: nowSeconds,
  livemode: false,
  data: { object: { id: "du_prevented_fixture", object: "dispute", payment_intent: "pi_fixture", amount: 500, currency: "usd", status: "prevented", reason: "fraudulent" } }
});
const normalizedPreventedDispute = await provider.verifyAndNormalizeWebhook(preventedDisputeBody, await signature(preventedDisputeBody));
assert(normalizedPreventedDispute.disputeStatus === "prevented", "Documented prevented dispute state was flattened into a generic closed or response state.");

function reviewedEventObject(eventType, index) {
  if (eventType.startsWith("checkout.session.")) return {
    id: `cs_test_reviewed_${index}`,
    object: "checkout.session",
    customer: "cus_fixture",
    payment_intent: `pi_reviewed_${index}`,
    subscription: eventType === "checkout.session.completed" ? "sub_fixture" : null,
    amount_total: 500,
    currency: "usd",
    payment_status: ["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(eventType) ? "paid" : "unpaid",
    metadata: { economic_order_id: baseCheckout.orderId }
  };
  if (eventType.startsWith("payment_intent.")) return {
    id: `pi_reviewed_${index}`,
    object: "payment_intent",
    amount: 500,
    currency: "usd",
    status: eventType.endsWith("succeeded") ? "succeeded" : eventType.endsWith("canceled") ? "canceled" : "requires_payment_method",
    metadata: { economic_order_id: baseCheckout.orderId }
  };
  if (eventType.startsWith("invoice.")) return {
    id: `in_reviewed_${index}`,
    object: "invoice",
    customer: "cus_fixture",
    payment_intent: `pi_reviewed_${index}`,
    subscription: "sub_fixture",
    amount_paid: eventType === "invoice.paid" ? 500 : 0,
    amount_due: 500,
    currency: "usd",
    status: eventType === "invoice.paid" ? "paid" : "open",
    metadata: { economic_order_id: baseCheckout.orderId }
  };
  if (eventType.startsWith("customer.subscription.")) return {
    id: "sub_fixture",
    object: "subscription",
    customer: "cus_fixture",
    status: eventType.endsWith("deleted") ? "canceled" : "active",
    cancel_at_period_end: eventType.endsWith("updated"),
    current_period_start: nowSeconds - 3_600,
    current_period_end: nowSeconds + 86_400,
    metadata: { economic_order_id: baseCheckout.orderId }
  };
  if (eventType.startsWith("refund.")) return {
    id: `re_reviewed_${index}`,
    object: "refund",
    payment_intent: "pi_fixture",
    amount: 200,
    currency: "usd",
    status: eventType.endsWith("failed") ? "failed" : eventType.endsWith("created") ? "pending" : "succeeded"
  };
  return {
    id: `du_reviewed_${index}`,
    object: "dispute",
    payment_intent: "pi_fixture",
    amount: 500,
    currency: "usd",
    status: eventType.endsWith("closed") ? "won" : eventType.endsWith("funds_reinstated") ? "prevented" : "needs_response",
    reason: "fraudulent"
  };
}

assert(new Set(STRIPE_ECONOMIC_MUTATION_EVENT_TYPES).size === STRIPE_ECONOMIC_MUTATION_EVENT_TYPES.length, "Reviewed Stripe mutation allowlist contains a duplicate.");
for (const [index, eventType] of STRIPE_ECONOMIC_MUTATION_EVENT_TYPES.entries()) {
  const reviewedBody = JSON.stringify({
    id: `evt_reviewed_${index}`,
    object: "event",
    type: eventType,
    api_version: env.STRIPE_WEBHOOK_API_VERSION,
    created: nowSeconds,
    livemode: false,
    data: { object: reviewedEventObject(eventType, index) }
  });
  const reviewed = await provider.verifyAndNormalizeWebhook(reviewedBody, await signature(reviewedBody));
  assert(reviewed.eventType === eventType && reviewed.mutationEligible === true, `Reviewed Stripe event was not shape-validated as mutation-eligible: ${eventType}`);
}

const unsupportedBody = JSON.stringify({
  id: "evt_unsupported_upcoming",
  object: "event",
  type: "invoice.upcoming",
  api_version: env.STRIPE_WEBHOOK_API_VERSION,
  created: nowSeconds,
  livemode: false,
  data: { object: {
    id: "in_upcoming_fixture", object: "invoice", subscription: "sub_fixture",
    amount_due: 500, currency: "usd", metadata: { economic_order_id: baseCheckout.orderId }
  } }
});
const unsupported = await provider.verifyAndNormalizeWebhook(unsupportedBody, await signature(unsupportedBody));
assert(unsupported.mutationEligible === false, "Signed but unsupported Stripe event was marked mutation-eligible.");

const malformedPaidInvoiceBody = JSON.stringify({
  id: "evt_malformed_paid_invoice",
  object: "event",
  type: "invoice.paid",
  api_version: env.STRIPE_WEBHOOK_API_VERSION,
  created: nowSeconds,
  livemode: false,
  data: { object: { id: "in_malformed", object: "invoice", payment_intent: "pi_fixture", amount_paid: 500, currency: "usd" } }
});
let malformedSupportedEventRejected = false;
try { await provider.verifyAndNormalizeWebhook(malformedPaidInvoiceBody, await signature(malformedPaidInvoiceBody)); }
catch (error) { malformedSupportedEventRejected = error instanceof BillingHttpError && error.code === "webhook_event_shape_invalid"; }
assert(malformedSupportedEventRejected, "Malformed reviewed Stripe event reached the database mutation boundary.");

for (const [label, apiVersion] of [["missing", null], ["mismatched", "2026-02-25.clover"]]) {
  const versionBody = JSON.stringify({ ...JSON.parse(eventBody), id: `evt_version_${label}`, api_version: apiVersion });
  let rejected = false;
  try { await provider.verifyAndNormalizeWebhook(versionBody, await signature(versionBody)); }
  catch (error) { rejected = error instanceof BillingHttpError && error.code === "webhook_api_version_mismatch"; }
  assert(rejected, `Webhook verifier accepted a ${label} event API version.`);
}

for (const [label, body, header] of [
  ["tampered body", `${eventBody} `, signatureHeader],
  ["wrong signature", eventBody, `t=${nowSeconds},v1=${"0".repeat(64)}`],
  ["stale timestamp", eventBody, await signature(eventBody, nowSeconds - 901)]
]) {
  let rejected = false;
  try { await provider.verifyAndNormalizeWebhook(body, header); }
  catch (error) { rejected = error instanceof BillingHttpError && error.code === "webhook_signature_invalid"; }
  assert(rejected, `Webhook verifier accepted ${label}.`);
}
const liveEventBody = JSON.stringify({ ...JSON.parse(eventBody), id: "evt_live_rejected", livemode: true });
let liveEventRejected = false;
try { await provider.verifyAndNormalizeWebhook(liveEventBody, await signature(liveEventBody)); }
catch (error) { liveEventRejected = error instanceof BillingHttpError && error.code === "webhook_event_invalid"; }
assert(liveEventRejected, "A validly signed live-mode Stripe event entered the test-only economic system.");

function webhookRequest(body = eventBody, header = signatureHeader) {
  return new Request("https://elysiaecobotics.com/api/billing/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": header },
    body
  });
}

let processedEvent = null;
let notificationDrainAttempts = 0;
const processedResponse = await handleStripeWebhook(webhookRequest(), env, {
  provider: () => provider,
  process: async (_env, event) => { processedEvent = event; return "processed"; },
  deliver: async () => {
    notificationDrainAttempts += 1;
    throw new Error("synthetic convenience-delivery failure");
  }
});
const processedPayload = await processedResponse.json();
assert(processedResponse.status === 200 && processedPayload.received === true && processedEvent.providerEventId === normalized.providerEventId, "Verified webhook was not handed to the idempotent database processor.");
assert(notificationDrainAttempts === 1, "Processed webhook did not attempt a bounded best-effort notification drain.");
assert(!JSON.stringify(processedPayload).includes("evt_") && !JSON.stringify(processedPayload).includes("cus_"), "Webhook response exposed provider references.");

const duplicateResponse = await handleStripeWebhook(webhookRequest(), env, { provider: () => provider, process: async () => "duplicate" });
assert(duplicateResponse.status === 200, "Duplicate webhook delivery was not acknowledged idempotently.");
let ignoredDeliveryAttempts = 0;
const unsupportedResponse = await handleStripeWebhook(webhookRequest(unsupportedBody, await signature(unsupportedBody)), env, {
  provider: () => provider,
  process: async (_env, event) => event.mutationEligible ? "retry" : "ignored",
  deliver: async () => { ignoredDeliveryAttempts += 1; }
});
assert(unsupportedResponse.status === 200 && ignoredDeliveryAttempts === 0, "Unsupported signed event was retried, mutated convenience projections, or failed acknowledgement.");
const retryResponse = await handleStripeWebhook(webhookRequest(), env, {
  provider: () => provider,
  process: async () => "retry",
  deliver: async () => { throw new Error("retrying canonical webhook must not drain notifications"); }
});
assert(retryResponse.status === 503, "Retryable webhook processing failure was incorrectly acknowledged.");
const disabledResponse = await handleStripeWebhook(webhookRequest(), { ...env, BILLING_WEBHOOK_FULFILLMENT_ENABLED: "false" }, { provider: () => provider, process: async () => "processed" });
assert(disabledResponse.status === 503, "Webhook fulfillment kill switch did not preserve provider retry behavior.");
const invalidResponse = await handleStripeWebhook(webhookRequest(eventBody, `t=${nowSeconds},v1=${"0".repeat(64)}`), env, { provider: () => provider, process: async () => "processed" });
assert(invalidResponse.status === 400, "Invalid webhook signature did not fail closed.");

async function mappedDatabaseStatus(data) {
  return processProviderEvent({ rpc: async () => ({ data, error: null }) }, normalized);
}
assert(await mappedDatabaseStatus({ status: "processed", idempotentReplay: false }) === "processed", "Fresh processed webhook status was not accepted.");
assert(await mappedDatabaseStatus({ status: "duplicate", idempotentReplay: true }) === "duplicate", "True duplicate webhook status was not acknowledged idempotently.");
assert(await mappedDatabaseStatus({ status: "ignored", idempotentReplay: false }) === "ignored", "Unknown terminal provider event was not acknowledged as ignored.");
assert(await mappedDatabaseStatus({ status: "ignored_out_of_order", idempotentReplay: false }) === "ignored", "Out-of-order terminal provider event was not acknowledged as ignored.");
assert(await mappedDatabaseStatus({ status: "retry", retryable: true }) === "retry", "Transient webhook failure did not retain retry semantics.");
let unknownDatabaseStatusRejected = false;
try { await mappedDatabaseStatus({ status: "mystery" }); }
catch (error) { unknownDatabaseStatusRejected = error instanceof BillingHttpError && error.code === "webhook_processing_unavailable"; }
assert(unknownDatabaseStatusRejected, "An unknown database webhook status was silently acknowledged.");

let deliveryRpc = null;
const deliveryResult = await deliverEconomicNotificationOutbox({ rpc: async (name, args) => {
  deliveryRpc = { name, args };
  return { data: { delivered: 3, failed: 1, canonicalFinancialTruth: false }, error: null };
} }, 25);
assert(deliveryResult.delivered === 3 && deliveryResult.canonicalFinancialTruth === false, "Bounded notification delivery result was not strictly normalized.");
assert(deliveryRpc.name === "deliver_economic_notification_outbox" && deliveryRpc.args.p_limit === 25, "Notification outbox used the wrong service-only RPC contract.");
let unsafeDeliveryRejected = false;
try {
  await deliverEconomicNotificationOutbox({ rpc: async () => ({
    data: { delivered: 1, failed: 0, canonicalFinancialTruth: true }, error: null
  }) }, 25);
} catch (error) {
  unsafeDeliveryRejected = error instanceof BillingHttpError && error.code === "billing_database_invalid";
}
assert(unsafeDeliveryRejected, "Notification delivery was allowed to claim canonical financial truth.");

console.log("Billing Stripe adapter and webhook smoke test ok.");
