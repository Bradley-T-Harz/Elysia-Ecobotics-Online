import fs from "node:fs/promises";
import { createEconomicPublicClient, createEconomicServerClient } from "../functions/api/billing/_shared/auth.ts";
import { BillingHttpError } from "../functions/api/billing/_shared/http.ts";
import { beginCheckout, loadCurrentEconomicAccount, loadEconomicPublicCapabilities, sanitizeEconomicSummary } from "../functions/api/billing/_shared/database.ts";
import { parseOneTimeCheckout, parseRecurringCheckout } from "../functions/api/billing/_shared/schema.ts";
import { handleBillingAccount } from "../functions/api/billing/account.ts";
import { handleBillingCapabilities } from "../functions/api/billing/capabilities.ts";
import { handleOneTimeCheckout } from "../functions/api/billing/checkout.ts";
import { handleOrderStatus } from "../functions/api/billing/order.ts";
import { handleCustomerPortal } from "../functions/api/billing/portal.ts";
import { handleRecurringCheckout } from "../functions/api/billing/recurring-checkout.ts";
import { handleSellerOnboarding } from "../functions/api/billing/seller/onboarding.ts";
import { handleSellerStatus } from "../functions/api/billing/seller/status.ts";
import {
  billingLegalConsentBundleIntegrityExpectations,
  billingLegalDocumentIntegrityExpectations
} from "../src/pages/Legal/economicLegalContentManifest.ts";
import { loadBillingCapabilities, loadBillingOrder } from "../src/shared/billing/billingClient.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const origin = "https://elysiaecobotics.com";
const env = {
  BILLING_ENABLED: "true",
  BILLING_MODE: "test",
  BILLING_PUBLIC_ORIGIN: origin,
  BILLING_SUPPORT_CHECKOUT_ENABLED: "true",
  BILLING_RECURRING_ENABLED: "true",
  BILLING_WEBHOOK_FULFILLMENT_ENABLED: "true",
  BILLING_NOTIFICATION_RETRY_ENABLED: "true",
  BILLING_PORTAL_ENABLED: "true",
  BILLING_ACCOUNT_LIFECYCLE_ENABLED: "true",
  BILLING_SELLER_ONBOARDING_ENABLED: "true",
  BILLING_MARKETPLACE_COMMERCE_ENABLED: "true",
  BILLING_ORGANIZATION_SERVICES_ENABLED: "true",
  BILLING_SPONSORSHIP_CHECKOUT_ENABLED: "true",
  BILLING_STAGING_ACCESS_CONFIRMED: "true",
  BILLING_EDGE_RATE_LIMIT_CONFIRMED: "true",
  STRIPE_CONNECT_ENABLED: "true",
  STRIPE_LIVE_ENABLED: "false",
  STRIPE_SECRET_KEY_TEST: `sk_test_${"s".repeat(40)}`,
  STRIPE_WEBHOOK_SECRET_TEST: `whsec_${"w".repeat(40)}`,
  STRIPE_API_VERSION: "2025-02-24.acacia",
  STRIPE_WEBHOOK_API_VERSION: "2025-02-24.acacia",
  SUPABASE_URL: "https://fixture.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "fixture-publishable-key",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role-key-with-safe-length"
};
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const clientRequestId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";
const publicReference = "opaque_order_reference_1234567890";
const auth = { accessToken: "synthetic", userId, email: "test@example.invalid", supabase: {} };

function legacyKey(role) {
  return `e30.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
}
for (const unsafeEnv of [
  { ...env, SUPABASE_PUBLISHABLE_KEY: `sb_secret_${"x".repeat(32)}` },
  { ...env, SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY },
  { ...env, SUPABASE_PUBLISHABLE_KEY: legacyKey("service_role") }
]) {
  let rejected = false;
  try { createEconomicPublicClient(unsafeEnv); }
  catch (error) { rejected = error instanceof BillingHttpError && error.code === "billing_misconfigured"; }
  assert(rejected, "A privileged Supabase key was accepted as the browser/auth publishable key.");
}
createEconomicPublicClient({ ...env, SUPABASE_PUBLISHABLE_KEY: legacyKey("anon") });
for (const unsafeEnv of [
  { ...env, SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_PUBLISHABLE_KEY },
  { ...env, SUPABASE_SERVICE_ROLE_KEY: `sb_publishable_${"x".repeat(32)}` },
  { ...env, SUPABASE_SERVICE_ROLE_KEY: legacyKey("anon") }
]) {
  let rejected = false;
  try { createEconomicServerClient(unsafeEnv); }
  catch (error) { rejected = error instanceof BillingHttpError && error.code === "billing_misconfigured"; }
  assert(rejected, "A publishable or anonymous key was accepted as the economic server credential.");
}
createEconomicServerClient({ ...env, SUPABASE_SERVICE_ROLE_KEY: `sb_secret_${"s".repeat(32)}` });

const provider = {
  checkoutInput: null,
  customerInput: null,
  portalInput: null,
  sellerInput: null,
  async ensureCustomer(input) {
    this.customerInput = input;
    return { providerCustomerReference: "cus_fixture" };
  },
  async createCheckout(input) {
    this.checkoutInput = input;
    return { providerSessionId: "cs_test_fixture", providerCustomerReference: null, checkoutUrl: "https://checkout.stripe.com/c/pay/test" };
  },
  async createCustomerPortalSession(input) {
    this.portalInput = input;
    return { providerSessionId: "bps_fixture", portalUrl: "https://billing.stripe.com/p/session/test" };
  },
  async verifyAndNormalizeWebhook() { throw new Error("unused"); },
  async createSellerOnboarding(input) {
    this.sellerInput = input;
    return { providerAccountReference: "acct_fixture", onboardingUrl: "https://connect.stripe.com/setup/test" };
  },
  async retrieveSellerStatus() {
    return { providerAccountReference: "acct_fixture", detailsSubmitted: true, chargesEnabled: false, payoutsEnabled: false, currentlyDue: ["external_account"], eventuallyDue: [], disabledReason: null };
  }
};

const preparation = {
  orderId,
  publicReference,
  idempotencyKey: `checkout:${clientRequestId}`,
  amountMinor: 500,
  currency: "usd",
  providerProductReference: "prod_fixture",
  providerPriceReference: null,
  providerCustomerReference: null
};

function checkoutRequest(body, overrides = {}) {
  return new Request(`${origin}/api/billing/checkout`, {
    method: overrides.method ?? "POST",
    headers: {
      "content-type": overrides.contentType ?? "application/json",
      origin: overrides.origin ?? origin,
      ...(overrides.authorization ? { authorization: overrides.authorization } : {})
    },
    body: (overrides.method ?? "POST") === "POST" ? JSON.stringify(body) : undefined
  });
}

const oneTimeBody = { clientRequestId, amountMinor: 500, currency: "usd", sourceRoute: "/support", consentVersion: "support-terms-v1" };
assert(parseOneTimeCheckout(oneTimeBody).amountMinor === 500, "One-time request parser rejected a valid bounded amount.");
const optionalDownloadSupportBody = {
  ...oneTimeBody,
  sourceRoute: "/products",
  consentVersion: "optional-download-support-v1"
};
assert(
  parseOneTimeCheckout(optionalDownloadSupportBody).sourceRoute === "/products",
  "A separate optional support action from the release/product surface was rejected."
);
for (const amountMinor of [99, 50_001, 1.5, Number.NaN]) {
  let rejected = false;
  try { parseOneTimeCheckout({ ...oneTimeBody, amountMinor }); } catch (error) { rejected = error instanceof BillingHttpError && error.code === "amount_invalid"; }
  assert(rejected, `Invalid one-time amount was accepted: ${amountMinor}`);
}
for (const invalid of [
  { ...oneTimeBody, currency: "eur" },
  { ...oneTimeBody, sourceRoute: "https://attacker.example" },
  { ...oneTimeBody, stripePriceId: "price_attacker" },
  { ...optionalDownloadSupportBody, downloadUrl: "https://attacker.example/elysia" },
  { ...optionalDownloadSupportBody, artifactId: "paid-release" },
  { ...optionalDownloadSupportBody, unlockDownload: true }
]) {
  let rejected = false;
  try { parseOneTimeCheckout(invalid); } catch (error) { rejected = error instanceof BillingHttpError; }
  assert(rejected, "One-time request parser accepted currency, route, or provider-controlled fields.");
}

let checkoutRpcArgs = null;
const oneTimeDatabasePreparation = await beginCheckout({
  rpc: async (_name, args) => {
    checkoutRpcArgs = args;
    return { data: preparation, error: null };
  }
}, null, "support_one_time", oneTimeBody);
assert(oneTimeDatabasePreparation.providerProductReference === "prod_fixture" && checkoutRpcArgs.p_price_code === "support_one_time_custom_usd" && checkoutRpcArgs.p_amount_minor === 500, "One-time Checkout did not bind the private custom-price catalog entry and trusted amount.");

let beginActor = "unset";
let attached = 0;
let customerAttached = 0;
const oneTimeDependencies = {
  authenticateOptional: async () => null,
  authenticateRequired: async () => auth,
  provider: () => provider,
  begin: async (_env, actorUserId) => { beginActor = actorUserId; return preparation; },
  attachCustomer: async (_env, _orderId, customerReference) => {
    assert(customerReference === "cus_fixture", "A noncanonical Customer was attached before Checkout.");
    customerAttached += 1;
  },
  attach: async () => { attached += 1; },
  fail: async () => undefined
};
const oneTimeResponse = await handleOneTimeCheckout(checkoutRequest(oneTimeBody), env, oneTimeDependencies);
const oneTimePayload = await oneTimeResponse.json();
assert(oneTimeResponse.status === 201 && oneTimePayload.orderReference === publicReference, "Guest checkout did not return its opaque order reference.");
assert(beginActor === null && attached === 1, "Guest checkout should not fabricate an account and should record its provider session once.");
assert(provider.checkoutInput.idempotencyKey === preparation.idempotencyKey, "Guest Checkout lost the database-derived Stripe idempotency key.");
assert(provider.checkoutInput.successUrl === `${origin}/support/thank-you?order=${publicReference}`, "Checkout success URL must be server-derived.");
assert(provider.checkoutInput.cancelUrl === `${origin}/support?checkout=canceled`, "Checkout cancellation URL must be server-derived.");
assert(!JSON.stringify(oneTimePayload).includes("cs_test") && !JSON.stringify(oneTimePayload).includes("prod_"), "Provider references reached the checkout response.");
assert(oneTimeResponse.headers.get("cache-control") === "no-store", "Billing responses must never be cached.");

const optionalDownloadSupportResponse = await handleOneTimeCheckout(
  checkoutRequest(optionalDownloadSupportBody), env, oneTimeDependencies
);
const optionalDownloadSupportPayload = await optionalDownloadSupportResponse.json();
assert(optionalDownloadSupportResponse.status === 201, "Separate optional release-surface support could not open hosted test Checkout.");
assert(
  !Object.keys(optionalDownloadSupportPayload).some((key) => /download|artifact|release|unlock/i.test(key)),
  "Optional support response claimed or gated a release artifact."
);
assert(
  provider.checkoutInput.successUrl.startsWith(`${origin}/support/thank-you`) && provider.checkoutInput.cancelUrl.startsWith(`${origin}/support`),
  "Optional release-surface support was incorrectly coupled to a download return path."
);

assert((await handleOneTimeCheckout(checkoutRequest(oneTimeBody, { origin: "https://attacker.example" }), env, oneTimeDependencies)).status === 403, "Cross-origin checkout was accepted.");
assert((await handleOneTimeCheckout(checkoutRequest(oneTimeBody, { contentType: "text/plain" }), env, oneTimeDependencies)).status === 415, "Non-JSON checkout was accepted.");
assert((await handleOneTimeCheckout(checkoutRequest(oneTimeBody), { ...env, BILLING_SUPPORT_CHECKOUT_ENABLED: "false" }, oneTimeDependencies)).status === 503, "Disabled one-time checkout did not fail closed.");
for (const missingGuard of ["BILLING_STAGING_ACCESS_CONFIRMED", "BILLING_EDGE_RATE_LIMIT_CONFIRMED"]) {
  assert((await handleOneTimeCheckout(checkoutRequest(oneTimeBody), { ...env, [missingGuard]: "false" }, oneTimeDependencies)).status === 503, `Guest checkout opened without ${missingGuard}.`);
}
assert((await handleOneTimeCheckout(checkoutRequest(oneTimeBody), { ...env, BILLING_WEBHOOK_FULFILLMENT_ENABLED: "false" }, oneTimeDependencies)).status === 503, "Checkout opened while durable webhook fulfillment was disabled.");
assert((await handleOneTimeCheckout(checkoutRequest(oneTimeBody), { ...env, BILLING_NOTIFICATION_RETRY_ENABLED: "false" }, oneTimeDependencies)).status === 503, "Checkout opened while durable notification retry scheduling was disabled.");
assert((await handleOneTimeCheckout(checkoutRequest(oneTimeBody), { ...env, BILLING_MODE: "live" }, oneTimeDependencies)).status === 503, "Live billing mode was not hard-disabled.");
assert((await handleOneTimeCheckout(checkoutRequest(oneTimeBody), { ...env, STRIPE_LIVE_ENABLED: "true" }, oneTimeDependencies)).status === 503, "Live Stripe flag was not hard-disabled.");

const recurringBody = { clientRequestId, priceCode: "support_monthly_commons_usd", sourceRoute: "/commons-circle/support-billing", consentVersion: "recurring-v1" };
assert(parseRecurringCheckout(recurringBody).priceCode === "support_monthly_commons_usd", "Recurring request parser rejected a known internal price code.");
let arbitraryPriceRejected = false;
try { parseRecurringCheckout({ ...recurringBody, priceCode: "price_123" }); } catch (error) { arbitraryPriceRejected = error instanceof BillingHttpError && error.code === "price_code_invalid"; }
assert(arbitraryPriceRejected, "Client-controlled Stripe price identifiers were accepted.");
const recurringPreparation = { ...preparation, amountMinor: 500, providerProductReference: null, providerPriceReference: "price_fixture" };
const recurringDatabasePreparation = await beginCheckout({
  rpc: async (_name, args) => {
    checkoutRpcArgs = args;
    return { data: recurringPreparation, error: null };
  }
}, userId, "support_recurring", recurringBody);
assert(recurringDatabasePreparation.providerPriceReference === "price_fixture" && checkoutRpcArgs.p_price_code === "support_monthly_commons_usd" && checkoutRpcArgs.p_amount_minor === 500, "Recurring Checkout did not derive its fixed amount from the canonical internal price code.");
const recurringDependencies = {
  ...oneTimeDependencies,
  authenticateRequired: async () => auth,
  begin: async (_env, actorUserId) => { beginActor = actorUserId; return recurringPreparation; }
};
const recurringResponse = await handleRecurringCheckout(checkoutRequest(recurringBody, { authorization: "Bearer synthetic" }), env, recurringDependencies);
assert(recurringResponse.status === 201 && beginActor === userId, "Recurring checkout did not require and bind authenticated identity.");
assert(customerAttached === 1 && provider.customerInput.idempotencyKey === `billing-customer:${userId}`, "Recurring Checkout did not durably establish one canonical Customer before creating its payable Session.");
assert(provider.checkoutInput.flow === "support_recurring" && provider.checkoutInput.providerPriceReference === "price_fixture", "Recurring checkout did not use the server catalog price.");
assert(
  (await handleRecurringCheckout(
    checkoutRequest(recurringBody, { authorization: "Bearer synthetic" }),
    { ...env, BILLING_PORTAL_ENABLED: "false" },
    recurringDependencies
  )).status === 503,
  "Recurring checkout opened while its independent cancellation and billing-management path was disabled."
);
const deniedRecurring = await handleRecurringCheckout(checkoutRequest(recurringBody), env, {
  ...recurringDependencies,
  authenticateRequired: async () => { throw new BillingHttpError(401, "authentication_required"); }
});
assert(deniedRecurring.status === 401, "Anonymous recurring support was accepted.");

const portalRequestId = "55555555-5555-4555-8555-555555555555";
let recordedPortalRequestId = null;
const portalResponse = await handleCustomerPortal(checkoutRequest({ clientRequestId }, { authorization: "Bearer synthetic" }), env, {
  authenticate: async () => auth,
  provider: () => provider,
  prepare: async () => ({ portalRequestId, billingCustomerId: "33333333-3333-4333-8333-333333333333", providerCustomerReference: "cus_fixture", idempotentReplay: false }),
  record: async (_env, requestId) => { recordedPortalRequestId = requestId; }
});
const portalPayload = await portalResponse.json();
assert(portalResponse.status === 201 && portalPayload.portalUrl.startsWith("https://billing.stripe.com/"), "Customer Portal response was not returned.");
assert(provider.portalInput.returnUrl === `${origin}/commons-circle/support-billing`, "Portal return URL was not server-derived.");
assert(recordedPortalRequestId === portalRequestId, "Portal provider session was not attached to the exact prepared request.");
assert(!JSON.stringify(portalPayload).includes("cus_fixture"), "Customer provider reference leaked through portal response.");
let replayedPortalProviderCalled = false;
const replayedPortal = await handleCustomerPortal(checkoutRequest({ clientRequestId }, { authorization: "Bearer synthetic" }), env, {
  authenticate: async () => auth,
  provider: () => ({ createCustomerPortalSession: async () => { replayedPortalProviderCalled = true; throw new Error("must not call provider"); } }),
  prepare: async () => ({ portalRequestId, billingCustomerId: "33333333-3333-4333-8333-333333333333", providerCustomerReference: "cus_fixture", idempotentReplay: true }),
  record: async () => { throw new Error("must not record a replay"); }
});
assert(replayedPortal.status === 409 && !replayedPortalProviderCalled, "A replayed Portal request consumed another provider call.");
const portalWithAcquisitionDisabled = await handleCustomerPortal(
  checkoutRequest({ clientRequestId: "56565656-5656-4656-8656-565656565656" }, { authorization: "Bearer synthetic" }),
  { ...env, BILLING_ENABLED: "false" },
  {
    authenticate: async () => ({ accessToken: "synthetic", userId, email: null, supabase: {} }),
    provider: () => provider,
    prepare: async () => ({ portalRequestId, billingCustomerId: "33333333-3333-4333-8333-333333333333", providerCustomerReference: "cus_fixture", idempotentReplay: false }),
    record: async () => {}
  }
);
assert(portalWithAcquisitionDisabled.status === 201, "Global checkout kill switch removed the existing-customer cancellation path.");

const accountResponse = await handleBillingAccount(new Request(`${origin}/api/billing/account`, { headers: { authorization: "Bearer synthetic" } }), env, {
  authenticate: async () => auth,
  load: async () => ({ orders: [{ reference: publicReference, amountMinor: 500, currency: "usd", status: "paid" }] })
});
assert(accountResponse.status === 200, "Authenticated billing account summary was unavailable.");
assert((await handleBillingAccount(
  new Request(`${origin}/api/billing/account`, { headers: { authorization: "Bearer synthetic" } }),
  { ...env, BILLING_PUBLIC_ORIGIN: undefined },
  { authenticate: async () => auth, load: async () => ({ orders: [] }) }
)).status === 200, "Read-only owner history incorrectly required a redirect origin.");
assert((await handleBillingAccount(new Request(`${origin}/api/billing/account`), env, {
  authenticate: async () => { throw new BillingHttpError(401, "authentication_required"); },
  load: async () => { throw new Error("must not load an owner summary"); }
})).status === 401, "Anonymous caller could read an owner-scoped economic account or receipt summary.");

const orderResponse = await handleOrderStatus(new Request(`${origin}/api/billing/order?reference=${publicReference}`), env, {
  authenticateOptional: async () => null,
  lookup: async (_env, reference, actorUserId) => ({
    publicReference: reference,
    actorUserId,
    flow: "support_one_time",
    cadence: "one_time",
    status: "processing",
    createdAt: "2026-07-16T12:00:00.000Z",
    paidAt: null,
    failedAt: null,
    refundedAt: null,
    testMode: true
  })
});
const orderPayload = await orderResponse.json();
assert(orderResponse.status === 200 && orderPayload.order.status === "processing" && orderPayload.order.flow === "support_one_time" && orderPayload.order.actorUserId === null, "Guest opaque order lookup failed or omitted its canonical flow.");
assert((await handleOrderStatus(new Request(`${origin}/api/billing/order?reference=short`), env, { authenticateOptional: async () => null, lookup: async () => ({}) })).status === 400, "Weak order reference was accepted.");

const originalFetch = globalThis.fetch;
let browserOrderFixture = {
  publicReference,
  flow: "support_one_time",
  cadence: "one_time",
  status: "processing",
  createdAt: "2026-07-16T12:00:00.000Z",
  paidAt: null,
  failedAt: null,
  refundedAt: null,
  testMode: true
};
globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, order: browserOrderFixture }), {
  status: 200,
  headers: { "content-type": "application/json" }
});
try {
  const browserOrder = await loadBillingOrder(publicReference);
  assert(browserOrder.flow === "support_one_time" && browserOrder.status === "processing", "Browser order lookup discarded a valid canonical server flow.");
  browserOrderFixture = { ...browserOrderFixture, flow: "sandbox_credit_purchase" };
  const unknownFlowOrder = await loadBillingOrder(publicReference);
  assert(unknownFlowOrder.flow === null && unknownFlowOrder.status === "unavailable", "Browser order lookup accepted a feature-flag key as an economic order flow.");
  browserOrderFixture = { ...browserOrderFixture, flow: "job_post_fee", unexpected: true };
  const extraFieldOrder = await loadBillingOrder(publicReference);
  assert(extraFieldOrder.flow === null && extraFieldOrder.status === "unavailable", "Browser order lookup accepted fields outside its exact private response contract.");
  browserOrderFixture = { ...browserOrderFixture, flow: "job_post_fee" };
  delete browserOrderFixture.unexpected;
  browserOrderFixture.publicReference = "another_opaque_order_reference_123456";
  const wrongReferenceOrder = await loadBillingOrder(publicReference);
  assert(wrongReferenceOrder.flow === null && wrongReferenceOrder.status === "unavailable", "Browser order lookup accepted a different returned private reference.");
} finally {
  globalThis.fetch = originalFetch;
}

let unsafeSummaryRejected = false;
try { sanitizeEconomicSummary({ status: "paid", providerCustomerReference: "cus_private" }); } catch (error) { unsafeSummaryRejected = error instanceof BillingHttpError; }
assert(unsafeSummaryRejected, "Owner-safe summary defense allowed a provider reference.");
const finalAccountProjection = {
  testMode: true,
  orders: [],
  paymentTransactions: [{
    transactionId: "91919191-9191-4191-8191-919191919191",
    publicReference,
    flow: "support_one_time",
    status: "succeeded",
    amountMinor: 500,
    currency: "usd",
    occurredAt: "2026-07-16T12:00:00.000Z",
    receiptAvailable: false,
    providerIdentifiersExposed: false
  }],
  subscriptions: [],
  receipts: [{
    transactionId: "91919191-9191-4191-8191-919191919191",
    publicReference,
    flow: "support_one_time",
    status: "succeeded",
    amountMinor: 500,
    currency: "usd",
    occurredAt: "2026-07-16T12:00:00.000Z",
    receiptAvailable: false,
    providerIdentifiersExposed: false
  }],
  sandboxCredits: { available: true, test_mode: true },
  marketplacePurchases: { licenses: [], testMode: true },
  marketplaceSeller: {
    eligible: true,
    configured: true,
    status: "onboarding",
    stripeConnectDisclosureVersion: "stripe-connect-disclosure-v1",
    providerIdentifiersExposed: false,
    testMode: true
  },
  jobPosts: [],
  assistance: [],
  recognition: { optedIn: false, publicDisplayEnabled: false, amountsPublic: false },
  accountRequests: [],
  activeRestrictions: [],
  closureReadiness: {
    canComplete: true,
    blockingCount: 0,
    activeSubscriptions: 0,
    scheduledSubscriptionCancellations: 1,
    unsettledOrders: 0,
    openRefunds: 0,
    openDisputes: 0,
    openReconciliationCases: 0,
    pendingSellerPayouts: 0,
    sellerPayableObligations: 0,
    pendingMarketplaceFulfillment: 0,
    pendingJobPostFulfillment: 0,
    organizationSignerDuties: 0,
    sponsorshipSignerDuties: 0,
    preservesEarnedLicenses: true,
    preservesRemainingSandboxCredits: true,
    financialRecordsRetained: true,
    authProfileUnchanged: true,
    guidance: [
      "Cancel recurring support through the Customer Portal before closure.",
      "Resolve open refunds, disputes, reconciliation, fulfillment, signer, and seller obligations.",
      "Already-earned licenses, remaining credits, receipts, and financial history are retained."
    ]
  },
  warnings: [{
    code: "order_failed",
    publicReference: "opaque_failed_reference_1234567890",
    guidance: "Review the failed checkout or begin a new checkout. Community standing is unchanged."
  }, {
    code: "subscription_attention_required",
    guidance: "Open billing management to review or cancel recurring support. Community standing is unchanged."
  }, {
    code: "marketplace_fulfillment_review",
    publicReference: "opaque_marketplace_reference_1234567890",
    guidance: "Payment completed, but Marketplace fulfillment was safely held for private review and refund. No add-on was installed and community standing is unchanged."
  }, {
    code: "organization_service_payment_review",
    publicReference: "opaque_organization_reference_1234567890",
    guidance: "Payment settled after the organization service engagement became ineligible or terminal. Service activation was withheld and a private full-refund review is required; community standing is unchanged."
  }, {
    code: "sponsorship_payment_review",
    publicReference: "opaque_sponsorship_reference_1234567890",
    guidance: "Payment settled after the sponsorship agreement became ineligible or terminal. Sponsorship activation and recognition were withheld and a private full-refund review is required; community standing is unchanged."
  }],
  providerIdentifiersExposed: false,
  moneyDoesNotGrantAuthority: true
};
const normalizedFinalAccount = await loadCurrentEconomicAccount({ rpc: async () => ({ data: finalAccountProjection, error: null }) });
assert(normalizedFinalAccount.marketplaceSeller.stripeConnectDisclosureVersion === "stripe-connect-disclosure-v1" && normalizedFinalAccount.providerIdentifiersExposed === false, "Final 70000 account projection rejected its safe disclosure version or provider-omission assertion.");
assert(normalizedFinalAccount.receipts[0].receiptAvailable === false && normalizedFinalAccount.receipts[0].providerIdentifiersExposed === false, "Owner-scoped receipt projection did not preserve its no-link/no-provider boundary.");
assert(normalizedFinalAccount.paymentTransactions[0].transactionId === finalAccountProjection.receipts[0].transactionId && normalizedFinalAccount.closureReadiness.scheduledSubscriptionCancellations === 1, "Transaction history or nonblocking scheduled cancellation readiness was discarded.");
assert(normalizedFinalAccount.warnings.length === 5, "Bounded owner-facing billing warnings were discarded.");
const enhancedReceipt = { ...finalAccountProjection.receipts[0], recordVersion: "payment-record-v1", payee: "EcoSyneva Commons LLC", orderStatus: "partially_refunded", refundedAmountMinor: 100 };
const enhancedAccount = await loadCurrentEconomicAccount({ rpc: async () => ({ data: { ...finalAccountProjection, receipts: [enhancedReceipt] }, error: null }) });
assert(enhancedAccount.receipts[0].refundedAmountMinor === 100 && enhancedAccount.receipts[0].orderStatus === "partially_refunded", "Enhanced verified refund state was lost by the server parser.");
for (const patch of [{ refundedAmountMinor: 501 }, { payee: "Other merchant" }, { orderStatus: "payout_completed" }]) {
  let rejected = false;
  try { await loadCurrentEconomicAccount({ rpc: async () => ({ data: { ...finalAccountProjection, receipts: [{ ...enhancedReceipt, ...patch }] }, error: null }) }); }
  catch (error) { rejected = error instanceof BillingHttpError && error.code === "billing_database_invalid"; }
  assert(rejected, "Enhanced receipt accepted an unverified merchant/refund/payout claim.");
}
for (const unsafeReceipt of [
  { ...finalAccountProjection.receipts[0], providerPaymentReference: "pi_private" },
  { ...finalAccountProjection.receipts[0], receiptAvailable: true },
  { ...finalAccountProjection.receipts[0], receiptUrl: "https://example.invalid/private" }
]) {
  let unsafeReceiptRejected = false;
  try {
    await loadCurrentEconomicAccount({ rpc: async () => ({ data: { ...finalAccountProjection, receipts: [unsafeReceipt] }, error: null }) });
  } catch (error) {
    unsafeReceiptRejected = error instanceof BillingHttpError && error.code === "billing_database_invalid";
  }
  assert(unsafeReceiptRejected, "Receipt projection accepted an unverified link or provider identifier.");
}
let unsafeWarningRejected = false;
try {
  await loadCurrentEconomicAccount({ rpc: async () => ({ data: {
    ...finalAccountProjection,
    warnings: [{ code: "order_failed", publicReference: "opaque_failed_reference_1234567890", guidance: "<script>unsafe</script>" }]
  }, error: null }) });
} catch (error) {
  unsafeWarningRejected = error instanceof BillingHttpError && error.code === "billing_database_invalid";
}
assert(unsafeWarningRejected, "Account projection accepted noncanonical warning content.");
const accountProjectionMigration = await fs.readFile("supabase/migrations/20260716070000_economic_projections_reporting_notifications_lifecycle.sql", "utf8");
const accountProjectionSql = accountProjectionMigration.slice(
  accountProjectionMigration.indexOf("create or replace function public.current_user_economic_account_summary"),
  accountProjectionMigration.indexOf("alter function public.current_user_economic_account_summary")
);
const receiptProjectionSql = accountProjectionSql.slice(
  accountProjectionSql.indexOf("'receipts'"),
  accountProjectionSql.indexOf("'sandboxCredits'")
);
assert(accountProjectionSql.includes("v_actor uuid := auth.uid()") && receiptProjectionSql.includes("where economic_order.user_id = v_actor"), "Receipt summaries are not visibly constrained to the authenticated account owner.");
assert(receiptProjectionSql.includes("'receiptAvailable', false") && receiptProjectionSql.includes("'providerIdentifiersExposed', false"), "Receipt summaries claimed an unverified repository receipt path or lost their provider-identifier omission assertion.");
assert(!/receipt_url|hosted_invoice|provider_(?:payment|invoice|customer|subscription|session)/i.test(receiptProjectionSql), "Receipt summaries exposed a provider reference or unreviewed hosted URL.");
let unsafeFinalAccountRejected = false;
try {
  await loadCurrentEconomicAccount({ rpc: async () => ({ data: {
    ...finalAccountProjection,
    marketplaceSeller: { ...finalAccountProjection.marketplaceSeller, providerAccountReference: "acct_private" }
  }, error: null }) });
} catch (error) {
  unsafeFinalAccountRejected = error instanceof BillingHttpError && error.code === "billing_database_invalid";
}
assert(unsafeFinalAccountRejected, "Final account projection accepted an actual seller provider reference.");

let sellerAttached = 0;
const sellerOnboardingBody = {
  clientRequestId,
  sellerAgreementVersion: "marketplace-seller-v1",
  stripeConnectDisclosureVersion: "stripe-connect-disclosure-v1",
  sourceRoute: "/marketplace/account",
  acceptSellerAgreement: true,
  acceptStripeConnectDisclosure: true
};
const sellerResponse = await handleSellerOnboarding(checkoutRequest(sellerOnboardingBody, { authorization: "Bearer synthetic" }), env, {
  authenticate: async () => auth,
  provider: () => provider,
  prepare: async () => ({
    sellerAccountId: "44444444-4444-4444-8444-444444444444",
    providerAccountReference: null,
    accountIdempotencyKey: "seller-account:44444444-4444-4444-8444-444444444444",
    linkIdempotencyKey: "seller-link:66666666-6666-4666-8666-666666666666",
    status: "pending",
    onboardingRequestId: "66666666-6666-4666-8666-666666666666",
    testMode: true
  }),
  attach: async () => { sellerAttached += 1; }
});
const sellerPayload = await sellerResponse.json();
assert(sellerResponse.status === 201 && sellerAttached === 1 && sellerPayload.onboardingUrl.startsWith("https://connect.stripe.com/"), "Test-mode seller onboarding did not bind its new account.");
assert(!JSON.stringify(sellerPayload).includes("acct_fixture"), "Connected account reference leaked through onboarding response.");
assert((await handleSellerOnboarding(checkoutRequest(sellerOnboardingBody, { authorization: "Bearer synthetic" }), { ...env, BILLING_SELLER_ONBOARDING_ENABLED: "false" }, {
  authenticate: async () => auth, provider: () => provider, prepare: async () => { throw new Error("must not run"); }, attach: async () => undefined
})).status === 503, "Seller onboarding feature kill switch did not fail closed.");

const sellerStatusResponse = await handleSellerStatus(new Request(`${origin}/api/billing/seller/status`, { headers: { authorization: "Bearer synthetic" } }), env, {
  authenticate: async () => auth,
  loadSafe: async () => ({
    eligible: true, configured: true, status: "onboarding",
    detailsSubmitted: true, chargesEnabled: false, payoutsEnabled: false,
    sellerAgreementVersion: "marketplace-seller-v1",
    freeSellerAgreementVersion: "marketplace-seller-v1",
    stripeConnectDisclosureVersion: "stripe-connect-disclosure-v1",
    activeOfferCount: 0, totalOwnedOfferCount: 0, offersTruncated: false, ownedOffers: [],
    eligibleReviewedVersionCount: 0, eligibleReviewedVersionsTruncated: false, eligibleReviewedVersions: [],
    publisherOptionCount: 0, publisherOptionsTruncated: false, publisherOptions: [],
    availablePayableByCurrency: {}, payableByCurrency: {}, payoutPreparationEnabled: false,
    payoutsEnabledByFeature: false, payoutExecutionAvailable: false, balancesAreTestRecords: true,
    providerIdentifiersExposed: false, testMode: true
  })
});
const sellerStatusPayload = await sellerStatusResponse.json();
assert(sellerStatusResponse.status === 200 && sellerStatusPayload.seller.detailsSubmitted === true, "Seller status was not normalized.");
assert(!JSON.stringify(sellerStatusPayload).includes("acct_fixture"), "Connected account reference leaked through seller status.");
assert((await handleSellerStatus(new Request(`${origin}/api/billing/seller/status`, { headers: { authorization: "Bearer synthetic" } }), {
  ...env, BILLING_SELLER_ONBOARDING_ENABLED: "false", STRIPE_CONNECT_ENABLED: "false"
}, {
  authenticate: async () => auth,
  loadSafe: async () => ({ ...sellerStatusPayload.seller, freeSellerAgreementVersion: "marketplace-seller-v1" })
})).status === 200, "Free Marketplace seller status was coupled to disabled Stripe Connect onboarding.");
assert((await handleSellerStatus(new Request(`${origin}/api/billing/seller/status`, { headers: { authorization: "Bearer synthetic" } }), {
  ...env, BILLING_MARKETPLACE_COMMERCE_ENABLED: "false"
}, {
  authenticate: async () => auth,
  loadSafe: async () => { throw new Error("must not load"); }
})).status === 503, "Seller status ignored the Marketplace commerce kill switch.");

const enabledDatabaseCapabilities = {
  supportCheckoutEnabled: true,
  recurringSupportEnabled: true,
  economicWebhooksEnabled: true,
  customerPortalEnabled: true,
  marketplaceSellerOnboardingEnabled: true,
  organizationServiceCheckoutEnabled: true,
  sponsorshipCheckoutEnabled: true,
  legalDocumentVersions: structuredClone(billingLegalDocumentIntegrityExpectations),
  legalConsentBundles: structuredClone(billingLegalConsentBundleIntegrityExpectations)
};
const parsedDatabaseCapabilities = await loadEconomicPublicCapabilities({
  rpc: async () => ({
    data: {
      testModeOnly: true,
      livePaymentsEnabled: false,
      paymentGrantsAuthority: false,
      ...enabledDatabaseCapabilities
    },
    error: null
  })
});
assert(parsedDatabaseCapabilities?.economicWebhooksEnabled === true, "Database capability parser rejected safe test-only invariants.");
assert(parsedDatabaseCapabilities?.legalDocumentVersions.supportOneTime.version === "2026-07-16", "Canonical active support terms were dropped from the safe capabilities projection.");
assert(parsedDatabaseCapabilities?.legalDocumentVersions.supportOneTime.contentSha256 === billingLegalDocumentIntegrityExpectations.supportOneTime.contentSha256, "Canonical active support content hash was dropped from the safe capabilities projection.");
assert(parsedDatabaseCapabilities?.legalConsentBundles.job_post_fee_checkout_bundle.documents.refundPolicy.path === "/legal/refund-and-cancellation-policy", "Canonical multi-document checkout consent bundle was dropped.");
assert(parsedDatabaseCapabilities?.legalConsentBundles.job_post_fee_checkout_bundle.documents.refundPolicy.contentSha256 === billingLegalConsentBundleIntegrityExpectations.job_post_fee_checkout_bundle.documents.refundPolicy.contentSha256, "Consent bundle dropped its immutable refund-policy content hash.");
const mismatchedLegalPath = await loadEconomicPublicCapabilities({
  rpc: async () => ({ data: {
    testModeOnly: true, livePaymentsEnabled: false, paymentGrantsAuthority: false,
    ...enabledDatabaseCapabilities,
    legalDocumentVersions: {
      ...enabledDatabaseCapabilities.legalDocumentVersions,
      supportOneTime: { ...enabledDatabaseCapabilities.legalDocumentVersions.supportOneTime, path: "https://attacker.example/terms" }
    }
  }, error: null })
});
assert(mismatchedLegalPath === null, "Capabilities accepted a non-canonical external legal-document path.");
for (const [label, mutate] of [
  ["missing legal-document hash", (value) => { delete value.legalDocumentVersions.supportOneTime.contentSha256; }],
  ["extra legal-document field", (value) => { value.legalDocumentVersions.supportOneTime.provider = "stripe"; }],
  ["malformed legal-document hash", (value) => { value.legalDocumentVersions.supportOneTime.contentSha256 = "A".repeat(64); }],
  ["mismatched legal-document hash", (value) => { value.legalDocumentVersions.supportOneTime.contentSha256 = "0".repeat(64); }],
  ["stale legal-document version", (value) => { value.legalDocumentVersions.supportOneTime.version = "2026-07-15"; }],
  ["missing bundle-document hash", (value) => { delete value.legalConsentBundles.support_one_time_checkout_bundle.documents.supportTerms.contentSha256; }],
  ["extra bundle-document field", (value) => { value.legalConsentBundles.support_one_time_checkout_bundle.documents.supportTerms.digestAlgorithm = "sha256"; }],
  ["mismatched bundle-document hash", (value) => { value.legalConsentBundles.support_one_time_checkout_bundle.documents.supportTerms.contentSha256 = "0".repeat(64); }],
  ["stale consent-bundle version", (value) => { value.legalConsentBundles.support_one_time_checkout_bundle.version = "2026-07-15"; }]
]) {
  const candidate = structuredClone(enabledDatabaseCapabilities);
  mutate(candidate);
  const rejected = await loadEconomicPublicCapabilities({ rpc: async () => ({ data: {
    testModeOnly: true, livePaymentsEnabled: false, paymentGrantsAuthority: false, ...candidate
  }, error: null }) });
  assert(rejected === null, `Capabilities accepted ${label}.`);
}
const unsafeDatabaseCapabilities = await loadEconomicPublicCapabilities({
  rpc: async () => ({ data: { testModeOnly: true, livePaymentsEnabled: true, paymentGrantsAuthority: false }, error: null })
});
assert(unsafeDatabaseCapabilities === null, "Database capability parser accepted a live-payment contradiction.");
const capabilities = await (await handleBillingCapabilities(
  new Request(`${origin}/api/billing/capabilities`),
  env,
  { load: async () => enabledDatabaseCapabilities }
)).json();
assert(
  capabilities.livePayments === false && capabilities.mode === "test"
    && capabilities.features.oneTimeSupport === true
    && capabilities.features.recurringSupport === true
    && capabilities.features.customerPortal === true
    && capabilities.features.accountLifecycle === true
    && capabilities.features.organizationServiceCheckout === true
    && capabilities.features.sponsorshipCheckout === true,
  "Capabilities did not intersect configured test-mode environment and database state."
);
assert(capabilities.legalDocumentVersions.supportRecurring.path === "/legal/support-and-billing-terms", "Capabilities response did not expose the canonical active recurring terms document.");
assert(capabilities.legalConsentBundles.support_one_time_checkout_bundle.version === "2026-07-16", "Capabilities response dropped the active support consent bundle version.");
assert(capabilities.legalDocumentVersions.supportRecurring.contentSha256 === billingLegalDocumentIntegrityExpectations.supportRecurring.contentSha256, "Capabilities response dropped the canonical legal content hash.");
let browserCapabilitiesFixture = capabilities;
const originalCapabilitiesFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(JSON.stringify(browserCapabilitiesFixture), { status: 200, headers: { "content-type": "application/json" } });
try {
  const parsedBrowserCapabilities = await loadBillingCapabilities();
  assert(parsedBrowserCapabilities.legalDocumentVersions?.supportOneTime.contentSha256 === billingLegalDocumentIntegrityExpectations.supportOneTime.contentSha256, "Browser capability parser dropped a canonical legal content hash.");
  assert(parsedBrowserCapabilities.legalConsentBundles?.support_one_time_checkout_bundle.documents.supportTerms?.contentSha256 === billingLegalConsentBundleIntegrityExpectations.support_one_time_checkout_bundle.documents.supportTerms.contentSha256, "Browser capability parser dropped a canonical bundle-document hash.");
  for (const [label, mutate] of [
    ["missing content hash", (value) => { delete value.legalDocumentVersions.supportOneTime.contentSha256; }],
    ["extra content field", (value) => { value.legalDocumentVersions.supportOneTime.unexpected = true; }],
    ["malformed content hash", (value) => { value.legalDocumentVersions.supportOneTime.contentSha256 = "A".repeat(64); }],
    ["mismatched content hash", (value) => { value.legalDocumentVersions.supportOneTime.contentSha256 = "0".repeat(64); }],
    ["missing bundle hash", (value) => { delete value.legalConsentBundles.support_one_time_checkout_bundle.documents.supportTerms.contentSha256; }],
    ["extra bundle field", (value) => { value.legalConsentBundles.support_one_time_checkout_bundle.documents.supportTerms.unexpected = true; }],
    ["mismatched bundle hash", (value) => { value.legalConsentBundles.support_one_time_checkout_bundle.documents.supportTerms.contentSha256 = "0".repeat(64); }],
    ["stale bundle version", (value) => { value.legalConsentBundles.support_one_time_checkout_bundle.version = "2026-07-15"; }]
  ]) {
    browserCapabilitiesFixture = structuredClone(capabilities);
    mutate(browserCapabilitiesFixture);
    const rejected = await loadBillingCapabilities();
    assert(rejected.mode === "disabled" && rejected.legalDocumentVersions === null && rejected.legalConsentBundles === null, `Browser capabilities accepted ${label}.`);
  }
} finally {
  globalThis.fetch = originalCapabilitiesFetch;
}
const recurringWithoutPortalCapabilities = await (await handleBillingCapabilities(
  new Request(`${origin}/api/billing/capabilities`),
  { ...env, BILLING_PORTAL_ENABLED: "false" },
  { load: async () => enabledDatabaseCapabilities }
)).json();
assert(
  recurringWithoutPortalCapabilities.features.recurringSupport === false
    && recurringWithoutPortalCapabilities.features.customerPortal === false,
  "Capabilities advertised a renewable subscription without its independent cancellation/management path."
);
for (const missingRouteProtection of ["BILLING_STAGING_ACCESS_CONFIRMED", "BILLING_EDGE_RATE_LIMIT_CONFIRMED"]) {
  const unprotectedEnv = { ...env, [missingRouteProtection]: "false" };
  const unprotectedCapabilities = await (await handleBillingCapabilities(
    new Request(`${origin}/api/billing/capabilities`),
    unprotectedEnv,
    { load: async () => enabledDatabaseCapabilities }
  )).json();
  assert(
    Object.values(unprotectedCapabilities.features).every((value) => value === false),
    `Capabilities advertised a billing mutation while ${missingRouteProtection} was not attested.`
  );
  const unprotectedMutation = await handleOneTimeCheckout(checkoutRequest(oneTimeBody), unprotectedEnv, oneTimeDependencies);
  assert(unprotectedMutation.status === 503, `A billing mutation ignored missing ${missingRouteProtection}.`);
}
const acquisitionDisabledCapabilities = await (await handleBillingCapabilities(
  new Request(`${origin}/api/billing/capabilities`),
  { ...env, BILLING_ENABLED: "false" },
  { load: async () => enabledDatabaseCapabilities }
)).json();
assert(
  acquisitionDisabledCapabilities.mode === "test"
    && acquisitionDisabledCapabilities.features.oneTimeSupport === false
    && acquisitionDisabledCapabilities.features.recurringSupport === false
    && acquisitionDisabledCapabilities.features.customerPortal === true,
  "Capabilities tied recurring cancellation/management to the new-acquisition kill switch."
);
const missingRedirectOriginCapabilities = await (await handleBillingCapabilities(
  new Request(`${origin}/api/billing/capabilities`),
  { ...env, BILLING_PUBLIC_ORIGIN: undefined },
  { load: async () => enabledDatabaseCapabilities }
)).json();
assert(
  missingRedirectOriginCapabilities.mode === "test"
    && missingRedirectOriginCapabilities.features.oneTimeSupport === false
    && missingRedirectOriginCapabilities.features.recurringSupport === false
    && missingRedirectOriginCapabilities.features.customerPortal === false
    && missingRedirectOriginCapabilities.features.sellerOnboarding === false
    && missingRedirectOriginCapabilities.features.organizationServiceCheckout === false
    && missingRedirectOriginCapabilities.features.sponsorshipCheckout === false
    && missingRedirectOriginCapabilities.legalDocumentVersions !== null,
  "Missing redirect origin disabled read-only economic mode or advertised an unsafe hosted redirect."
);
const missingProviderCredentialsCapabilities = await (await handleBillingCapabilities(
  new Request(`${origin}/api/billing/capabilities`),
  {
    ...env,
    STRIPE_SECRET_KEY_TEST: undefined,
    STRIPE_WEBHOOK_SECRET_TEST: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined
  },
  { load: async () => enabledDatabaseCapabilities }
)).json();
assert(
  missingProviderCredentialsCapabilities.mode === "test"
    && Object.values(missingProviderCredentialsCapabilities.features).every((value) => value === false)
    && missingProviderCredentialsCapabilities.legalDocumentVersions !== null
    && missingProviderCredentialsCapabilities.legalConsentBundles !== null,
  "Missing provider credentials hid read-only economic state or advertised a hosted provider action."
);
const dbDisabledCapabilities = await (await handleBillingCapabilities(
  new Request(`${origin}/api/billing/capabilities`),
  env,
  { load: async () => ({ ...enabledDatabaseCapabilities, supportCheckoutEnabled: false }) }
)).json();
assert(dbDisabledCapabilities.features.oneTimeSupport === false, "Capabilities advertised checkout while its database feature flag was disabled.");
const sponsorshipDisabledCapabilities = await (await handleBillingCapabilities(
  new Request(`${origin}/api/billing/capabilities`),
  env,
  { load: async () => ({ ...enabledDatabaseCapabilities, sponsorshipCheckoutEnabled: false }) }
)).json();
assert(
  sponsorshipDisabledCapabilities.features.organizationServiceCheckout === true
    && sponsorshipDisabledCapabilities.features.sponsorshipCheckout === false,
  "Sponsorship Checkout did not retain an independent environment/database kill switch."
);
const unavailableCapabilities = await (await handleBillingCapabilities(
  new Request(`${origin}/api/billing/capabilities`),
  env,
  { load: async () => null }
)).json();
assert(unavailableCapabilities.mode === "disabled" && Object.values(unavailableCapabilities.features).every((value) => value === false), "Capabilities did not fail closed when database truth was unavailable.");
assert(unavailableCapabilities.legalDocumentVersions === null, "Unavailable database truth left stale legal-document versions enabled.");
assert(unavailableCapabilities.legalConsentBundles === null, "Unavailable database truth left stale consent bundles enabled.");

const sanitizedFailure = await handleOneTimeCheckout(checkoutRequest(oneTimeBody), env, {
  ...oneTimeDependencies,
  begin: async () => { throw new Error("private provider secret sk_test_must_not_leak"); }
});
assert(!JSON.stringify(await sanitizedFailure.json()).includes("must_not_leak"), "Unexpected billing errors exposed private internals.");

console.log("Billing proxy smoke test ok.");
