import fs from "node:fs/promises";
import { exactUsdDecimalToMinor } from "../src/shared/billing/exactMoney.ts";
import {
  BillingRequestError as BrowserBillingRequestError,
  configureMarketplaceSellerOffer as configureMarketplaceSellerOfferInBrowser,
  linkMarketplaceSellerPublisher as linkMarketplaceSellerPublisherInBrowser,
  loadMarketplaceSellerStatus as loadMarketplaceSellerStatusInBrowser,
  setMarketplaceSellerOfferStatus as setMarketplaceSellerOfferStatusInBrowser
} from "../src/shared/billing/billingClient.ts";
import { BillingHttpError } from "../functions/api/billing/_shared/http.ts";
import {
  acceptMarketplaceFreeLicense,
  acceptMarketplaceFreeSellerAgreement,
  setMarketplaceOfferStatus,
  configureMarketplaceCommercialTerms,
  configureMarketplaceOffer,
  linkMarketplacePublisher,
  loadCurrentMarketplacePurchases,
  loadCurrentSellerStatus,
  loadMarketplaceOfferCatalog,
  prepareMarketplaceCheckout,
  prepareOperatorMarketplaceTestPayout,
  prepareSellerOnboarding
} from "../functions/api/billing/_shared/database.ts";
import {
  parseMarketplaceCommercialTerms,
  parseMarketplaceFreeSellerAgreement,
  parseMarketplaceOfferStatus,
  parseMarketplaceOfferConfiguration,
  parseMarketplacePublisherLink,
  parseMarketplacePurchase,
  parseOperatorMarketplacePayoutPreparation,
  parseSellerOnboardingRequest
} from "../functions/api/billing/_shared/schema.ts";
import { handleMarketplaceCatalog } from "../functions/api/billing/marketplace/catalog.ts";
import { handleMarketplaceCheckout } from "../functions/api/billing/marketplace/checkout.ts";
import { handleMarketplaceFreeLicense } from "../functions/api/billing/marketplace/free-license.ts";
import { handleMarketplacePurchases } from "../functions/api/billing/marketplace/purchases.ts";
import { handleOperatorMarketplaceTerms } from "../functions/api/billing/operator/marketplace-commercial-terms.ts";
import { handleOperatorMarketplacePayoutPreparation } from "../functions/api/billing/operator/marketplace-payout-preparation.ts";
import { handleSellerOffer } from "../functions/api/billing/seller/offer.ts";
import { handleMarketplaceFreeSellerAgreement } from "../functions/api/billing/seller/free-agreement.ts";
import { handleSellerOfferActivation } from "../functions/api/billing/seller/offer-activation.ts";
import { handleSellerOnboarding } from "../functions/api/billing/seller/onboarding.ts";
import { handleSellerPublisherLink } from "../functions/api/billing/seller/publisher-link.ts";
import { handleSellerStatus } from "../functions/api/billing/seller/status.ts";
import { handleSellerStatusRefresh } from "../functions/api/billing/seller/status-refresh.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const origin = "https://elysiaecobotics.com";
const env = {
  BILLING_ENABLED: "true",
  BILLING_MODE: "test",
  BILLING_PUBLIC_ORIGIN: origin,
  BILLING_STAGING_ACCESS_CONFIRMED: "true",
  BILLING_EDGE_RATE_LIMIT_CONFIRMED: "true",
  BILLING_MARKETPLACE_COMMERCE_ENABLED: "true",
  BILLING_MARKETPLACE_PAYOUT_PREPARATION_ENABLED: "true",
  BILLING_SELLER_ONBOARDING_ENABLED: "true",
  BILLING_WEBHOOK_FULFILLMENT_ENABLED: "true",
  BILLING_NOTIFICATION_RETRY_ENABLED: "true",
  STRIPE_CONNECT_ENABLED: "true",
  STRIPE_LIVE_ENABLED: "false"
};
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const offerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const listingId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const addonVersionId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const licenseId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const clientRequestId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const sellerAccountId = "11111111-1111-4111-8111-111111111111";
const onboardingRequestId = "22222222-2222-4222-8222-222222222222";
const publisherId = "33333333-3333-4333-8333-333333333333";
const termsVersionId = "44444444-4444-4444-8444-444444444444";
const orderId = "55555555-5555-4555-8555-555555555555";
const purchaseContractId = "66666666-6666-4666-8666-666666666666";
const auth = { accessToken: "synthetic", userId, email: "private@example.invalid", supabase: {} };

function request(path, body, options = {}) {
  return new Request(`${origin}${path}`, {
    method: "POST",
    headers: {
      origin: options.origin ?? origin,
      "content-type": "application/json",
      ...(options.authorization === false ? {} : { authorization: "Bearer synthetic" })
    },
    body: JSON.stringify(body)
  });
}

const freeSellerAgreementBody = {
  clientRequestId,
  agreementVersion: "2026-07-16",
  sourceRoute: "/marketplace/account",
  acceptAgreement: true,
  confirmation: "ACCEPT FREE MARKETPLACE SELLER AGREEMENT"
};
assert(parseMarketplaceFreeSellerAgreement(freeSellerAgreementBody).agreementVersion === "2026-07-16", "Canonical free-seller agreement was rejected.");
for (const invalid of [
  { ...freeSellerAgreementBody, acceptAgreement: false },
  { ...freeSellerAgreementBody, sourceRoute: "/developer-forge/dashboard" },
  { ...freeSellerAgreementBody, confirmation: "accept" },
  { ...freeSellerAgreementBody, stripeConnectDisclosureVersion: "not-required" },
  { ...freeSellerAgreementBody, payoutsEnabled: true }
]) {
  let rejected = false;
  try { parseMarketplaceFreeSellerAgreement(invalid); }
  catch (error) { rejected = error instanceof BillingHttpError; }
  assert(rejected, "Free-seller agreement accepted Connect/payout fields, weak consent, or an invalid route.");
}
let freeAgreementRpc = null;
const acceptedFreeAgreement = await acceptMarketplaceFreeSellerAgreement({ rpc: async (name, args) => {
  freeAgreementRpc = { name, args };
  return { data: {
    sellerAccountId,
    agreementVersion: "2026-07-16",
    connectRequiredForFreeOffers: false,
    testMode: true,
    idempotentReplay: false
  }, error: null };
} }, userId, parseMarketplaceFreeSellerAgreement(freeSellerAgreementBody));
assert(acceptedFreeAgreement.connectRequiredForFreeOffers === false, "Free-seller agreement was coupled to Stripe Connect.");
assert(freeAgreementRpc.name === "accept_marketplace_free_seller_agreement" && freeAgreementRpc.args.p_actor_user_id === userId, "Free-seller agreement did not bind authenticated identity to the service-only RPC.");
assert(!Object.keys(freeAgreementRpc.args).some((key) => /stripe|provider|payout/i.test(key)), "Free-seller agreement forwarded provider or payout state.");
let agreementActor = null;
const freeAgreementResponse = await handleMarketplaceFreeSellerAgreement(
  request("/api/billing/seller/free-agreement", freeSellerAgreementBody), env, {
    authenticate: async () => auth,
    accept: async (_env, actor) => { agreementActor = actor; return acceptedFreeAgreement; }
  }
);
const freeAgreementPayload = await freeAgreementResponse.json();
assert(freeAgreementResponse.status === 201 && agreementActor === userId, "Authenticated eligible developer could not accept free-offer seller terms.");
assert(freeAgreementPayload.agreement.connectRequiredForFreeOffers === false && !JSON.stringify(freeAgreementPayload).includes("stripe"), "Free-seller response leaked or implied a Connect requirement.");
assert((await handleMarketplaceFreeSellerAgreement(
  request("/api/billing/seller/free-agreement", freeSellerAgreementBody, { authorization: false }), env, {
    authenticate: async () => { throw new BillingHttpError(401, "authentication_required"); },
    accept: async () => { throw new Error("must not accept"); }
  }
)).status === 401, "Anonymous caller accepted a free-seller agreement.");

function parserRejects(parser, value) {
  try { parser(value); }
  catch (error) { return error instanceof BillingHttpError; }
  return false;
}

const purchaseInput = {
  offerId,
  clientRequestId,
  sourceRoute: "/marketplace",
  consentVersion: "marketplace-buyer-terms-v1"
};
assert(parseMarketplacePurchase(purchaseInput).offerId === offerId, "Valid Marketplace purchase input was rejected.");
for (const invalid of [
  { ...purchaseInput, amountMinor: 500 },
  { ...purchaseInput, providerPriceReference: "price_attacker" },
  { ...purchaseInput, installAuthorized: true },
  { ...purchaseInput, trustTier: "official" },
  { ...purchaseInput, actorUserId: userId },
  { ...purchaseInput, sourceRoute: "/admin/economic-operations" },
  { ...purchaseInput, consentVersion: "terms with spaces" }
]) assert(parserRejects(parseMarketplacePurchase, invalid), "Marketplace purchase accepted economic, provider, authority, actor, route, or invalid consent fields.");

const onboardingInput = {
  clientRequestId,
  sellerAgreementVersion: "marketplace-seller-v1",
  stripeConnectDisclosureVersion: "stripe-connect-disclosure-v1",
  sourceRoute: "/marketplace/account",
  acceptSellerAgreement: true,
  acceptStripeConnectDisclosure: true
};
assert(parseSellerOnboardingRequest(onboardingInput).acceptStripeConnectDisclosure, "Valid dual-consent seller onboarding was rejected.");
for (const invalid of [
  { ...onboardingInput, acceptSellerAgreement: false },
  { ...onboardingInput, acceptStripeConnectDisclosure: false },
  { ...onboardingInput, providerAccountReference: "acct_attacker" },
  { ...onboardingInput, publisherVerified: true },
  { ...onboardingInput, sourceRoute: "/marketplace/browse" }
]) assert(parserRejects(parseSellerOnboardingRequest, invalid), "Seller onboarding accepted absent consent, provider IDs, authority, or an invalid route.");

const paidOfferInput = {
  clientRequestId,
  addonVersionId,
  publisherId,
  offerKind: "paid",
  amountMinor: 1_500,
  licenseKey: "elysia-addon-commercial",
  licenseVersion: "license-v1",
  buyerTermsVersion: "marketplace-buyer-terms-v1",
  commercialTermsCode: "marketplace_test_standard_v1",
  sellerAgreementVersion: "marketplace-seller-v1",
  confirmation: "CONFIGURE MARKETPLACE TEST OFFER",
  reason: "Configure a version-bound test offer without changing review authority."
};
assert(parseMarketplaceOfferConfiguration(paidOfferInput).amountMinor === 1_500, "Valid paid offer configuration was rejected.");
for (const invalid of [
  { ...paidOfferInput, commissionBps: 500 },
  { ...paidOfferInput, providerPriceReference: "price_attacker" },
  { ...paidOfferInput, listingStatus: "published" },
  { ...paidOfferInput, installAuthorized: true },
  { ...paidOfferInput, confirmation: "yes" },
  { ...paidOfferInput, buyerTermsVersion: "bad terms" },
  { ...paidOfferInput, offerKind: "free", amountMinor: 0, commercialTermsCode: null }
]) assert(parserRejects(parseMarketplaceOfferConfiguration, invalid), "Offer configuration accepted commission, provider, review, install, confirmation, terms, or free-price authority.");

const offerRow = {
  offerId, listingId, addonVersionId,
  listingSlug: "living-soil", listingName: "Living Soil", version: "1.0.0",
  offerKind: "paid", amountMinor: 1_500, currency: "usd",
  licenseKey: "elysia-addon-commercial", licenseVersion: "license-v1",
  buyerTermsVersion: "marketplace-buyer-terms-v1",
  paymentGrantsTrust: false, purchaseInstallsAddon: false, testMode: true,
  providerPriceReference: "price_private_should_be_stripped",
  sellerAccountId: "private_should_be_stripped"
};
const normalizedCatalog = await loadMarketplaceOfferCatalog({ rpc: async () => ({ data: [offerRow], error: null }) });
assert(normalizedCatalog.length === 1 && normalizedCatalog[0].currency === "usd", "Marketplace catalog was not strictly normalized.");
assert(!JSON.stringify(normalizedCatalog).includes("price_private") && !JSON.stringify(normalizedCatalog).includes("sellerAccount"), "Marketplace catalog leaked provider or seller financial identifiers.");
const catalogResponse = await handleMarketplaceCatalog(new Request(`${origin}/api/billing/marketplace/catalog`), env, { load: async () => normalizedCatalog });
assert(catalogResponse.status === 200 && (await catalogResponse.json()).catalog.offers.length === 1, "Enabled Marketplace catalog was not returned.");
let disabledCatalogLoads = 0;
const disabledCatalogResponse = await handleMarketplaceCatalog(
  new Request(`${origin}/api/billing/marketplace/catalog`),
  { ...env, BILLING_MARKETPLACE_COMMERCE_ENABLED: "false" },
  { load: async () => { disabledCatalogLoads += 1; return normalizedCatalog; } }
);
const disabledCatalog = await disabledCatalogResponse.json();
assert(disabledCatalog.catalog.available === false && disabledCatalog.catalog.offers.length === 0 && disabledCatalogLoads === 0, "Marketplace environment kill switch queried or exposed its catalog.");
const freeOffer = {
  ...normalizedCatalog[0],
  offerId: "99999999-9999-4999-8999-999999999998",
  offerKind: "free",
  amountMinor: null,
  currency: null
};
const acquisitionShutdownCatalog = await handleMarketplaceCatalog(
  new Request(`${origin}/api/billing/marketplace/catalog`),
  { ...env, BILLING_ENABLED: "false" },
  { load: async () => [normalizedCatalog[0], freeOffer] }
);
const acquisitionShutdownPayload = await acquisitionShutdownCatalog.json();
assert(
  acquisitionShutdownPayload.catalog.available === true
    && acquisitionShutdownPayload.catalog.offers.length === 1
    && acquisitionShutdownPayload.catalog.offers[0].offerKind === "free",
  "Global payment-acquisition shutdown hid a legitimate free Marketplace license or exposed a paid offer."
);

const checkoutPreparation = {
  alreadyOwned: false,
  orderId,
  publicReference: "opaque_marketplace_order_reference_123456789",
  idempotencyKey: `checkout:${clientRequestId}`,
  amountMinor: 1_500,
  currency: "usd",
  providerProductReference: "prod_marketplacefixture",
  providerPriceReference: "price_marketplacefixture",
  providerCustomerReference: null,
  purchaseContractId,
  offerId, listingId, addonVersionId,
  licenseKey: "elysia-addon-commercial", licenseVersion: "license-v1",
  installAuthorized: false, publicationOrTrustChanged: false, testMode: true
};
let checkoutActor = null;
let providerCheckoutInput = null;
let attached = 0;
let customerAttached = 0;
const checkoutResponse = await handleMarketplaceCheckout(
  request("/api/billing/marketplace/checkout", purchaseInput), env,
  {
    authenticate: async () => auth,
    prepare: async (_env, actor) => { checkoutActor = actor; return checkoutPreparation; },
    provider: () => ({
      ensureCustomer: async () => ({ providerCustomerReference: "cus_marketplacefixture" }),
      createCheckout: async (input) => {
      providerCheckoutInput = input;
      return { providerSessionId: "cs_test_marketplace", providerCustomerReference: null, checkoutUrl: "https://checkout.stripe.com/c/pay/marketplace" };
      }
    }),
    attachCustomer: async (_env, exactOrderId, reference) => {
      assert(exactOrderId === orderId && reference === "cus_marketplacefixture", "Marketplace attached the wrong canonical Customer.");
      customerAttached += 1;
    },
    attach: async () => { attached += 1; },
    fail: async () => undefined
  }
);
const checkoutPayload = await checkoutResponse.json();
assert(checkoutResponse.status === 201 && checkoutActor === userId && customerAttached === 1 && attached === 1, "Marketplace checkout did not bind its owner, establish its canonical Customer, and attach the Session.");
assert(providerCheckoutInput.flow === "marketplace_purchase" && providerCheckoutInput.providerPriceReference === "price_marketplacefixture", "Marketplace checkout did not use its fixed server catalog price.");
assert(providerCheckoutInput.successUrl.startsWith(`${origin}/marketplace/account?commerce=success&reference=`) && providerCheckoutInput.cancelUrl.startsWith(`${origin}/marketplace/account?commerce=canceled&reference=`), "Marketplace return URLs did not preserve the private order reference on the account surface.");
assert(checkoutPayload.license.installAuthorized === false && checkoutPayload.license.paymentGrantsAuthority === false, "Marketplace checkout granted installation or authority.");
assert(!JSON.stringify(checkoutPayload).includes("1500") && !JSON.stringify(checkoutPayload).includes("price_marketplacefixture") && !JSON.stringify(checkoutPayload).includes("cs_test"), "Marketplace checkout exposed amounts or provider identifiers.");

let marketplaceRetryAttachAttempts = 0;
const marketplaceRetryFailures = [];
const retryMarketplaceDependencies = {
  authenticate: async () => auth,
  prepare: async () => checkoutPreparation,
  provider: () => ({
    ensureCustomer: async () => ({ providerCustomerReference: "cus_marketplacefixture" }),
    createCheckout: async () => ({
    providerSessionId: "cs_test_marketplace_retry", providerCustomerReference: null,
    checkoutUrl: "https://checkout.stripe.com/c/pay/marketplace_retry"
    })
  }),
  attachCustomer: async () => undefined,
  attach: async () => {
    marketplaceRetryAttachAttempts += 1;
    if (marketplaceRetryAttachAttempts === 1) throw new Error("simulated attach transport failure");
  },
  fail: async (_env, _order, failureCode) => { marketplaceRetryFailures.push(failureCode); }
};
const firstMarketplaceAttachAttempt = await handleMarketplaceCheckout(
  request("/api/billing/marketplace/checkout", purchaseInput), env, retryMarketplaceDependencies
);
const secondMarketplaceAttachAttempt = await handleMarketplaceCheckout(
  request("/api/billing/marketplace/checkout", purchaseInput), env, retryMarketplaceDependencies
);
assert(
  firstMarketplaceAttachAttempt.status >= 500 && secondMarketplaceAttachAttempt.status === 201
    && marketplaceRetryAttachAttempts === 2 && marketplaceRetryFailures.length === 0,
  "Marketplace attach uncertainty poisoned the recoverable idempotent Checkout retry."
);
let marketplaceCreationFailureCode = null;
const marketplaceCreationFailure = await handleMarketplaceCheckout(
  request("/api/billing/marketplace/checkout", purchaseInput), env,
  {
    authenticate: async () => auth, prepare: async () => checkoutPreparation,
    provider: () => ({
      ensureCustomer: async () => ({ providerCustomerReference: "cus_marketplacefixture" }),
      createCheckout: async () => { throw new Error("simulated provider creation failure"); }
    }),
    attachCustomer: async () => undefined,
    attach: async () => { throw new Error("must not attach"); },
    fail: async (_env, _order, code) => { marketplaceCreationFailureCode = code; }
  }
);
assert(
  marketplaceCreationFailure.status === 502 && marketplaceCreationFailureCode === "provider_checkout_creation_failed",
  "Marketplace provider-creation failure was not recorded with the sole recoverable failure code."
);

let providerCalledForOwned = 0;
const ownedResponse = await handleMarketplaceCheckout(request("/api/billing/marketplace/checkout", purchaseInput), env, {
  authenticate: async () => auth,
  prepare: async () => ({
    alreadyOwned: true, checkoutPrepared: false, licenseId, offerId, listingId, addonVersionId,
    economicStatus: "active", installAuthorized: false, testMode: true
  }),
  provider: () => ({ createCheckout: async () => { providerCalledForOwned += 1; throw new Error("must not call"); } }),
  attach: async () => undefined,
  fail: async () => undefined
});
assert(ownedResponse.status === 200 && providerCalledForOwned === 0 && (await ownedResponse.json()).alreadyOwned === true, "Already-owned Marketplace license opened a second checkout.");
assert((await handleMarketplaceCheckout(request("/api/billing/marketplace/checkout", purchaseInput), { ...env, BILLING_WEBHOOK_FULFILLMENT_ENABLED: "false" }, {
  authenticate: async () => auth, prepare: async () => { throw new Error("must not prepare"); }, provider: () => ({}), attach: async () => undefined, fail: async () => undefined
})).status === 503, "Marketplace paid checkout opened without durable webhook fulfillment.");

let checkoutRpc = null;
const preparedCheckout = await prepareMarketplaceCheckout({ rpc: async (name, args) => {
  checkoutRpc = { name, args };
  return { data: checkoutPreparation, error: null };
} }, userId, parseMarketplacePurchase(purchaseInput));
assert(!preparedCheckout.alreadyOwned && checkoutRpc.name === "prepare_marketplace_purchase_checkout", "Marketplace checkout did not use its service preparation RPC.");
assert(checkoutRpc.args.p_actor_user_id === userId && !Object.keys(checkoutRpc.args).some((key) => /amount|provider|trust|install|approv/i.test(key)), "Marketplace checkout RPC accepted client pricing, provider IDs, trust, installation, or approval.");

const licenseRow = {
  licenseId, offerId, listingId, addonVersionId,
  licenseKey: "elysia-addon-free", licenseVersion: "free-license-v1",
  economicStatus: "active", installAuthorized: false, testMode: true
};
let freeActor = null;
const freeResponse = await handleMarketplaceFreeLicense(request("/api/billing/marketplace/free-license", purchaseInput), env, {
  authenticate: async () => auth,
  accept: async (_env, actor) => { freeActor = actor; return licenseRow; }
});
const freePayload = await freeResponse.json();
assert(freeResponse.status === 201 && freeActor === userId && freePayload.license.paymentRequired === false, "Free Marketplace license acceptance did not remain account-bound and payment-free.");
assert(freePayload.license.installAuthorized === false && freePayload.license.paymentGrantsAuthority === false, "Free license acceptance granted installation or authority.");
let freeRpc = null;
await acceptMarketplaceFreeLicense({ rpc: async (name, args) => {
  freeRpc = { name, args }; return { data: licenseRow, error: null };
} }, userId, parseMarketplacePurchase(purchaseInput));
assert(freeRpc.name === "accept_marketplace_free_license" && freeRpc.args.p_consent_version === purchaseInput.consentVersion, "Free license did not bind exact buyer terms through its service RPC.");

const purchaseProjection = {
  licenses: [{
    licenseId, listingId, addonVersionId, listingSlug: "living-soil", listingName: "Living Soil",
    version: "1.0.0", licenseKey: "elysia-addon-commercial", licenseVersion: "license-v1",
    acquisitionKind: "paid_order", economicStatus: "active", safetyStatus: "available",
    installAuthorized: false, acquiredAt: "2026-07-16T12:00:00.000Z",
    providerPaymentReference: "pi_private_should_be_stripped"
  }],
  testMode: true
};
const purchases = await loadCurrentMarketplacePurchases({ rpc: async () => ({ data: purchaseProjection, error: null }) });
assert(purchases.licenses.length === 1 && !JSON.stringify(purchases).includes("pi_private"), "Owner purchase projection leaked provider payment data.");
const purchasesResponse = await handleMarketplacePurchases(new Request(`${origin}/api/billing/marketplace/purchases`), env, {
  authenticate: async () => auth, load: async () => purchases
});
assert(purchasesResponse.status === 200 && (await purchasesResponse.json()).licenses[0].installAuthorized === false, "Owner purchases did not preserve the installation boundary.");

let onboardingRpc = null;
const sellerPreparation = await prepareSellerOnboarding({ rpc: async (name, args) => {
  onboardingRpc = { name, args };
  return { data: {
    sellerAccountId, developerProfileId: "77777777-7777-4777-8777-777777777777",
    status: "onboarding", providerAccountAttached: true, providerAccountReference: "acct_privatefixture",
    providerIdempotencyKey: `seller-account:${sellerAccountId}`, onboardingRequestId,
    sellerAgreementVersion: onboardingInput.sellerAgreementVersion,
    stripeConnectDisclosureVersion: onboardingInput.stripeConnectDisclosureVersion,
    testMode: true, idempotentReplay: true
  }, error: null };
} }, userId, parseSellerOnboardingRequest(onboardingInput));
assert(onboardingRpc.args.p_seller_agreement_version === onboardingInput.sellerAgreementVersion && onboardingRpc.args.p_stripe_connect_disclosure_version === onboardingInput.stripeConnectDisclosureVersion, "Seller onboarding did not durably pass both consent versions.");
assert(sellerPreparation.providerAccountReference === "acct_privatefixture", "Internal seller onboarding retry lost its existing connected account.");
assert(sellerPreparation.idempotentReplay === true, "Seller preparation discarded its durable request replay marker.");
assert(sellerPreparation.accountIdempotencyKey === `seller-account:${sellerAccountId}` && sellerPreparation.linkIdempotencyKey === `seller-link:${onboardingRequestId}`, "Seller preparation did not separate connected-account and single-use Account Link idempotency.");
let providerOnboardingInput = null;
const onboardingResponse = await handleSellerOnboarding(request("/api/billing/seller/onboarding", onboardingInput), env, {
  authenticate: async () => auth,
  prepare: async () => ({ ...sellerPreparation, idempotentReplay: false }),
  provider: () => ({ createSellerOnboarding: async (input) => { providerOnboardingInput = input; return { providerAccountReference: "acct_privatefixture", onboardingUrl: "https://connect.stripe.com/setup/fixture" }; } }),
  attach: async () => { throw new Error("Existing account must not be reattached."); }
});
const onboardingPayload = await onboardingResponse.json();
assert(onboardingResponse.status === 201 && onboardingPayload.consentRecorded === true, "Seller onboarding did not report its durable consent boundary.");
assert(providerOnboardingInput.accountIdempotencyKey === `seller-account:${sellerAccountId}` && providerOnboardingInput.linkIdempotencyKey === `seller-link:${onboardingRequestId}`, "Seller route flattened Account and Account Link idempotency into one retry key.");
assert(!JSON.stringify(onboardingPayload).includes("acct_") && !JSON.stringify(onboardingPayload).includes(sellerAccountId), "Seller onboarding leaked internal provider or seller identifiers.");
let replayedOnboardingProviderCalled = false;
const replayedOnboarding = await handleSellerOnboarding(request("/api/billing/seller/onboarding", onboardingInput), env, {
  authenticate: async () => auth,
  prepare: async () => sellerPreparation,
  provider: () => ({ createSellerOnboarding: async () => { replayedOnboardingProviderCalled = true; throw new Error("must not call provider"); } }),
  attach: async () => { throw new Error("must not attach a replay"); }
});
assert(replayedOnboarding.status === 409 && !replayedOnboardingProviderCalled, "A replayed seller-onboarding request consumed another Account Link provider call.");

const safeSeller = {
  eligible: true, configured: true, status: "ready", detailsSubmitted: true,
  chargesEnabled: true, payoutsEnabled: true,
  sellerAgreementVersion: "marketplace-seller-v1",
  freeSellerAgreementVersion: "marketplace-seller-v1",
  stripeConnectDisclosureVersion: "stripe-connect-disclosure-v1",
  activeOfferCount: 1,
  totalOwnedOfferCount: 1, offersTruncated: false,
  ownedOffers: [{
    offerId, listingId, addonVersionId, listingSlug: "owned-reviewed-addon", listingName: "Owned reviewed add-on",
    version: "1.0.0", publisherId, offerKind: "paid", status: "active",
    priceCode: `marketplace_test_${addonVersionId.replaceAll("-", "")}_1500_usd`, amountMinor: 1_500, currency: "usd",
    licenseKey: "elysia.fixture", licenseVersion: "1.0", buyerTermsVersion: "marketplace-buyer-terms-v1",
    sellerAgreementVersion: "marketplace-seller-v1", commercialTermsCode: "marketplace_test_standard_v1",
    commissionBps: 1_000, canRevise: false, activatedAt: "2026-07-16T12:00:00.000Z", retiredAt: null,
    updatedAt: "2026-07-16T12:00:00.000Z"
  }],
  eligibleReviewedVersionCount: 1, eligibleReviewedVersionsTruncated: false,
  eligibleReviewedVersions: [{ addonVersionId, listingId, listingSlug: "owned-reviewed-addon", listingName: "Owned reviewed add-on", version: "1.0.0" }],
  publisherOptionCount: 1, publisherOptionsTruncated: false,
  publisherOptions: [{ publisherId, name: "Owned publisher", slug: "owned-publisher", verified: false, linked: false }],
  availablePayableByCurrency: { usd: 1_000 }, payableByCurrency: { usd: 1_000 },
  payoutPreparationEnabled: true, payoutsEnabledByFeature: false,
  payoutExecutionAvailable: false, balancesAreTestRecords: true,
  providerIdentifiersExposed: false, testMode: true
};
const browserActivationInput = {
  clientRequestId: "99999999-9999-4999-8999-999999999999", offerId, targetStatus: "active",
  confirmation: "ACTIVATE MARKETPLACE TEST OFFER",
  reason: "Activate only after provider, terms, seller, and review prerequisites pass."
};
const originalBrowserFetch = globalThis.fetch;
try {
  globalThis.fetch = async (resource, init = {}) => {
    const path = String(resource);
    if (path === "/api/billing/seller/status") return new Response(JSON.stringify({ ok: true, seller: safeSeller }), { status: 200, headers: { "content-type": "application/json" } });
    if (path === "/api/billing/seller/publisher-link") {
      const body = JSON.parse(String(init.body));
      assert(body.clientRequestId === clientRequestId && body.publisherId === publisherId, "Browser publisher link lost its durable request or owned publisher identity.");
      return new Response(JSON.stringify({ ok: true, publisherLink: { publisherId, linked: true, publisherVerifiedChanged: false, idempotentReplay: true, testMode: true } }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (path === "/api/billing/seller/offer") {
      const body = JSON.parse(String(init.body));
      assert(body.clientRequestId === paidOfferInput.clientRequestId && body.amountMinor === 1_500, "Browser offer configuration lost its durable request or exact minor-unit price.");
      return new Response(JSON.stringify({ ok: true, offer: {
        offerId, listingId, addonVersionId, offerKind: "paid", status: "draft", commissionBps: 1_000,
        commercialTermsCode: paidOfferInput.commercialTermsCode, buyerTermsVersion: paidOfferInput.buyerTermsVersion,
        idempotentReplay: true, providerCatalogConfigured: true, paymentGrantsTrust: false,
        purchaseInstallsAddon: false, testMode: true
      } }), { status: 201, headers: { "content-type": "application/json" } });
    }
    if (path === "/api/billing/seller/offer-activation") {
      const body = JSON.parse(String(init.body));
      assert(body.clientRequestId === browserActivationInput.clientRequestId && body.targetStatus === "active" && body.confirmation === "ACTIVATE MARKETPLACE TEST OFFER", "Browser offer status lost its durable request, target, or exact confirmation.");
      return new Response(JSON.stringify({ ok: true, offer: { offerId, status: "active", offerKind: "paid", idempotentReplay: true, testMode: true, paymentGrantsTrust: false, purchaseInstallsAddon: false } }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`Unexpected browser Marketplace request: ${path}`);
  };
  const browserSeller = await loadMarketplaceSellerStatusInBrowser("synthetic");
  assert(browserSeller.ownedOffers[0]?.offerId === offerId && browserSeller.totalOwnedOfferCount === 1 && !browserSeller.offersTruncated, "Browser seller parser did not recover the bounded durable owned-offer projection.");
  assert(browserSeller.eligibleReviewedVersionCount === 1 && browserSeller.publisherOptionCount === 1, "Browser seller parser discarded exact bounded projection counts.");
  const browserPublisherLink = await linkMarketplaceSellerPublisherInBrowser({ publisherId, clientRequestId, confirmation: "LINK MARKETPLACE SELLER TO PUBLISHER", reason: "Retain the durable owned publisher relationship." }, "synthetic");
  assert(browserPublisherLink.idempotentReplay === true, "Browser publisher link discarded the durable replay marker.");
  const browserConfiguredOffer = await configureMarketplaceSellerOfferInBrowser(paidOfferInput, "synthetic");
  assert(browserConfiguredOffer.idempotentReplay === true && browserConfiguredOffer.status === "draft", "Browser offer configuration discarded durable replay or inactive state.");
  const browserOfferStatus = await setMarketplaceSellerOfferStatusInBrowser(browserActivationInput, "synthetic");
  assert(browserOfferStatus.idempotentReplay === true && browserOfferStatus.status === "active", "Browser offer status discarded durable replay or exact target state.");

  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, seller: { ...safeSeller, totalOwnedOfferCount: 2, offersTruncated: false } }), { status: 200, headers: { "content-type": "application/json" } });
  let inconsistentProjectionRejected = false;
  try { await loadMarketplaceSellerStatusInBrowser("synthetic"); }
  catch (error) { inconsistentProjectionRejected = error instanceof BrowserBillingRequestError; }
  assert(inconsistentProjectionRejected, "Browser seller parser accepted a count/truncation mismatch that could hide owned offers.");
} finally {
  globalThis.fetch = originalBrowserFetch;
}
const normalizedSeller = await loadCurrentSellerStatus({ rpc: async () => ({ data: safeSeller, error: null }) });
assert(
  normalizedSeller.providerIdentifiersExposed === false
    && normalizedSeller.freeSellerAgreementVersion === "marketplace-seller-v1"
    && normalizedSeller.payoutPreparationEnabled === true
    && normalizedSeller.payoutExecutionAvailable === false
    && normalizedSeller.balancesAreTestRecords === true,
  "Safe seller status did not prove provider omission, durable agreement, or preparation-only test balances."
);
assert(normalizedSeller.eligibleReviewedVersions[0]?.addonVersionId === addonVersionId && normalizedSeller.publisherOptions[0]?.publisherId === publisherId, "Seller status did not project only server-bounded owned versions and publisher options.");
assert(normalizedSeller.ownedOffers[0]?.offerId === offerId && normalizedSeller.totalOwnedOfferCount === 1 && normalizedSeller.offersTruncated === false, "Seller status did not expose its bounded owned-offer recovery projection.");
let safeLoads = 0;
const cachedStatusResponse = await handleSellerStatus(new Request(`${origin}/api/billing/seller/status`), env, {
  authenticate: async () => auth,
  loadSafe: async () => { safeLoads += 1; return safeSeller; }
});
assert(cachedStatusResponse.status === 200 && safeLoads === 1, "Cached seller GET did not remain a single read-only status projection.");
let providerRefreshes = 0;
let recordedRefreshes = 0;
const refreshResponse = await handleSellerStatusRefresh(request("/api/billing/seller/status-refresh", { clientRequestId }), env, {
  authenticate: async () => auth,
  loadProviderContext: async () => ({ sellerAccountId, status: "onboarding", providerAccountReference: "acct_privatefixture", idempotentReplay: false }),
  provider: () => ({ retrieveSellerStatus: async () => {
    providerRefreshes += 1;
    return {
      providerAccountReference: "acct_privatefixture", detailsSubmitted: true, chargesEnabled: true,
      payoutsEnabled: true, currentlyDue: [], eventuallyDue: [], disabledReason: null,
      providerEventCreatedAt: "2026-07-16T12:00:00.000Z", providerResponseSha256: "a".repeat(64)
    };
  } }),
  record: async () => { recordedRefreshes += 1; },
  loadSafe: async () => safeSeller
});
assert(refreshResponse.status === 200 && providerRefreshes === 1 && recordedRefreshes === 1, "Explicit seller status refresh did not retrieve and durably record readiness.");
const failedRefreshRequestId = "77777777-7777-4777-8777-777777777777";
let failedRetryProviderCalls = 0;
const failedRefresh = await handleSellerStatusRefresh(request("/api/billing/seller/status-refresh", { clientRequestId: failedRefreshRequestId }), env, {
  authenticate: async () => auth,
  loadProviderContext: async () => ({ sellerAccountId, status: "onboarding", providerAccountReference: "acct_privatefixture", idempotentReplay: false }),
  provider: () => ({ retrieveSellerStatus: async () => { failedRetryProviderCalls += 1; throw new Error("synthetic provider outage"); } }),
  record: async () => { throw new Error("failed provider retrieval must not be recorded"); },
  loadSafe: async () => safeSeller
});
assert(failedRefresh.status >= 500 && failedRefresh.status <= 599 && failedRetryProviderCalls === 1, "A provider retrieval failure was not reported without recording stale seller state.");
let failedRetryRecords = 0;
const retriedFailedRefresh = await handleSellerStatusRefresh(request("/api/billing/seller/status-refresh", { clientRequestId: failedRefreshRequestId }), env, {
  authenticate: async () => auth,
  loadProviderContext: async () => ({ sellerAccountId, status: "onboarding", providerAccountReference: "acct_privatefixture", idempotentReplay: false }),
  provider: () => ({ retrieveSellerStatus: async () => {
    failedRetryProviderCalls += 1;
    return {
      providerAccountReference: "acct_privatefixture", detailsSubmitted: true, chargesEnabled: true,
      payoutsEnabled: true, currentlyDue: [], eventuallyDue: [], disabledReason: null,
      providerEventCreatedAt: "2026-07-16T12:00:01.000Z", providerResponseSha256: "b".repeat(64)
    };
  } }),
  record: async (_env, _sellerId, requestId) => {
    assert(requestId === failedRefreshRequestId, "Seller status completion was not bound to the original client request ID.");
    failedRetryRecords += 1;
  },
  loadSafe: async () => safeSeller
});
assert(retriedFailedRefresh.status === 200 && failedRetryProviderCalls === 2 && failedRetryRecords === 1, "A failed same-key seller refresh was incorrectly treated as complete instead of retrying the provider and durable record.");
const replayedRefresh = await handleSellerStatusRefresh(request("/api/billing/seller/status-refresh", { clientRequestId }), env, {
  authenticate: async () => auth,
  loadProviderContext: async () => ({ sellerAccountId, status: "ready", providerAccountReference: "acct_privatefixture", idempotentReplay: true }),
  provider: () => ({ retrieveSellerStatus: async () => { throw new Error("must not call provider"); } }),
  record: async () => { throw new Error("must not record a replay"); },
  loadSafe: async () => safeSeller
});
assert(replayedRefresh.status === 200, "A replayed seller-status refresh did not return its safe cached projection.");
assert((await handleSellerStatusRefresh(request("/api/billing/seller/status-refresh", { clientRequestId }, { origin: "https://attacker.example" }), env, {
  authenticate: async () => auth, loadProviderContext: async () => { throw new Error("must not load"); }, provider: () => ({}), record: async () => undefined, loadSafe: async () => safeSeller
})).status === 403, "Cross-origin seller status refresh was accepted.");

let offerRpc = null;
const configuredOffer = await configureMarketplaceOffer({ rpc: async (name, args) => {
  offerRpc = { name, args };
  return { data: {
    offerId, listingId, addonVersionId, offerKind: "paid", status: "draft", commissionBps: 1_000,
    commercialTermsCode: paidOfferInput.commercialTermsCode,
    buyerTermsVersion: paidOfferInput.buyerTermsVersion, testMode: true, idempotentReplay: false
  }, error: null };
} }, userId, parseMarketplaceOfferConfiguration(paidOfferInput));
assert(offerRpc.name === "configure_marketplace_test_offer" && offerRpc.args.p_actor_user_id === userId, "Seller offer did not use its owner-bound service RPC.");
assert(offerRpc.args.p_price_code === `marketplace_test_${addonVersionId.replaceAll("-", "")}_1500_usd`, "Seller route did not derive its internal immutable test price code.");
assert(!Object.keys(offerRpc.args).some((key) => /commission|provider|trust|install|approv/i.test(key)), "Seller offer RPC accepted client commission, provider, trust, install, or approval authority.");
let catalogProviderInput = null;
let catalogRecorded = 0;
const offerResponse = await handleSellerOffer(request("/api/billing/seller/offer", paidOfferInput), env, {
  authenticate: async () => auth,
  configure: async () => configuredOffer,
  provider: () => ({ ensureMarketplaceCatalog: async (input) => {
    catalogProviderInput = input;
    return { providerProductReference: "prod_privatefixture", providerPriceReference: "price_privatefixture" };
  } }),
  recordCatalog: async () => { catalogRecorded += 1; }
});
const offerPayload = await offerResponse.json();
assert(offerResponse.status === 201 && catalogRecorded === 1 && catalogProviderInput.amountMinor === 1_500, "Paid offer did not reconcile its test provider catalog.");
assert(offerPayload.offer.commissionBps === 1_000 && offerPayload.offer.idempotentReplay === false && offerPayload.offer.paymentGrantsTrust === false && offerPayload.offer.purchaseInstallsAddon === false, "Seller offer obscured replay/commission state or changed trust/install state.");
assert(!JSON.stringify(offerPayload).includes("prod_private") && !JSON.stringify(offerPayload).includes("price_private"), "Seller offer response leaked provider identifiers.");

const activationInput = parseMarketplaceOfferStatus({
  clientRequestId: "99999999-9999-4999-8999-999999999999", offerId, targetStatus: "active",
  confirmation: "ACTIVATE MARKETPLACE TEST OFFER",
  reason: "Activate only after provider, terms, seller, and review prerequisites pass."
});
let activationRpc = null;
await setMarketplaceOfferStatus({ rpc: async (name, args) => {
  activationRpc = { name, args };
  return { data: { offerId, status: "active", offerKind: "paid", testMode: true, idempotentReplay: false }, error: null };
} }, userId, activationInput);
assert(activationRpc.name === "set_marketplace_test_offer_status" && activationRpc.args.p_actor_user_id === userId && activationRpc.args.p_client_request_id === activationInput.clientRequestId && activationRpc.args.p_target_status === "active" && activationRpc.args.p_confirmation === "ACTIVATE MARKETPLACE TEST OFFER", "Offer status mutation lost durable request identity, owner binding, target, or exact confirmation.");
const activationResponse = await handleSellerOfferActivation(request("/api/billing/seller/offer-activation", activationInput), env, {
  authenticate: async () => auth,
  mutate: async () => ({ offerId, status: "active", offerKind: "paid", idempotentReplay: false, testMode: true })
});
assert((await activationResponse.json()).offer.purchaseInstallsAddon === false, "Offer activation granted installation.");
for (const [targetStatus, confirmation] of [
  ["suspended", "SUSPEND MARKETPLACE TEST OFFER"],
  ["retired", "RETIRE MARKETPLACE TEST OFFER"]
]) {
  const parsed = parseMarketplaceOfferStatus({
    clientRequestId: crypto.randomUUID(), offerId, targetStatus, confirmation,
    reason: `Move the owned test offer to ${targetStatus} without changing review authority.`
  });
  assert(parsed.targetStatus === targetStatus, `Marketplace ${targetStatus} status request was rejected.`);
}
let mismatchedStatusRejected = false;
try {
  parseMarketplaceOfferStatus({
    clientRequestId: crypto.randomUUID(), offerId, targetStatus: "retired",
    confirmation: "ACTIVATE MARKETPLACE TEST OFFER",
    reason: "This mismatched destructive confirmation must be rejected."
  });
} catch (error) { mismatchedStatusRejected = error instanceof BillingHttpError; }
assert(mismatchedStatusRejected, "Marketplace offer status accepted a mismatched exact confirmation.");

const publisherInput = parseMarketplacePublisherLink({
  publisherId, clientRequestId, confirmation: "LINK MARKETPLACE SELLER TO PUBLISHER",
  reason: "Link the seller sidecar without changing publisher verification."
});
let publisherRpc = null;
await linkMarketplacePublisher({ rpc: async (name, args) => {
  publisherRpc = { name, args };
  return { data: { publisherId, linked: true, publisherVerifiedChanged: false, idempotentReplay: false, testMode: true }, error: null };
} }, userId, publisherInput);
assert(publisherRpc.args.p_actor_user_id === userId && !Object.keys(publisherRpc.args).some((key) => /verified|trust|approv/i.test(key)), "Seller/publisher linking accepted verification or trust authority.");
const publisherResponse = await handleSellerPublisherLink(request("/api/billing/seller/publisher-link", publisherInput), env, {
  authenticate: async () => auth,
  link: async () => ({ publisherId, linked: true, publisherVerifiedChanged: false, idempotentReplay: false, testMode: true })
});
assert((await publisherResponse.json()).publisherLink.publisherVerifiedChanged === false, "Seller/publisher route changed publisher verification.");

const termsInput = parseMarketplaceCommercialTerms({
  clientRequestId, termsCode: "marketplace_test_standard_v1", commissionBps: 1_000,
  sellerAgreementVersion: "marketplace-seller-v1", buyerTermsVersion: "marketplace-buyer-terms-v1",
  active: true, confirmation: "CONFIGURE MARKETPLACE TEST COMMERCIAL TERMS",
  reason: "Configure reviewed test-only Marketplace commercial terms and commission."
});
let termsRpc = null;
const termsResult = await configureMarketplaceCommercialTerms({ rpc: async (name, args) => {
  termsRpc = { name, args };
  return { data: {
    commercialTermsVersionId: termsVersionId, termsCode: termsInput.termsCode,
    commissionBps: termsInput.commissionBps, sellerAgreementVersion: termsInput.sellerAgreementVersion,
    buyerTermsVersion: termsInput.buyerTermsVersion, active: true,
    approvedForLiveUse: false, testMode: true
  }, error: null };
} }, userId, termsInput);
assert(termsRpc.name === "configure_marketplace_test_commercial_terms" && termsRpc.args.p_actor_user_id === userId, "Marketplace terms did not bind the economic operator.");
const termsResponse = await handleOperatorMarketplaceTerms(request("/api/billing/operator/marketplace-commercial-terms", termsInput), env, {
  authenticate: async () => auth, configure: async () => termsResult
});
assert((await termsResponse.json()).terms.approvedForLiveUse === false, "Test Marketplace terms claimed live approval.");

const payoutPreparationInput = {
  sellerAccountId,
  clientRequestId: "77777777-7777-4777-8777-777777777777",
  amountMinor: 750,
  currency: "usd",
  confirmation: "PREPARE TEST MARKETPLACE PAYOUT",
  reason: "Prepare a private test accounting record without executing a provider transfer."
};
assert(parseOperatorMarketplacePayoutPreparation(payoutPreparationInput).amountMinor === 750, "Payout-preparation schema was rejected.");
for (const invalid of [
  { ...payoutPreparationInput, amountMinor: 0 },
  { ...payoutPreparationInput, currency: "USD" },
  { ...payoutPreparationInput, confirmation: "SEND PAYOUT" },
  { ...payoutPreparationInput, providerTransferReference: "tr_private" }
]) {
  let rejected = false;
  try { parseOperatorMarketplacePayoutPreparation(invalid); } catch (error) { rejected = error instanceof BillingHttpError; }
  assert(rejected, "Payout preparation accepted money bounds, casing, execution confirmation, or provider-transfer fields unsafely.");
}
let payoutPreparationRpc = null;
const payoutPreparation = await prepareOperatorMarketplaceTestPayout({ rpc: async (name, args) => {
  payoutPreparationRpc = { name, args };
  return { data: {
    payoutPreparationId: "88888888-8888-4888-8888-888888888888",
    sellerAccountId, amountMinor: 750, currency: "usd", status: "prepared",
    providerExecutionAvailable: false, balancesAreTestRecords: true,
    testMode: true, idempotentReplay: false
  }, error: null };
} }, userId, parseOperatorMarketplacePayoutPreparation(payoutPreparationInput));
assert(
  payoutPreparationRpc.name === "operator_prepare_marketplace_test_payout"
    && payoutPreparationRpc.args.p_actor_user_id === userId
    && payoutPreparation.providerExecutionAvailable === false
    && !("providerTransferReference" in payoutPreparation),
  "Payout preparation lost its actor or implied provider execution."
);
const payoutPreparationResponse = await handleOperatorMarketplacePayoutPreparation(
  request("/api/billing/operator/marketplace-payout-preparation", payoutPreparationInput),
  { ...env, BILLING_ENABLED: "false" },
  { authenticate: async () => auth, mutate: async () => payoutPreparation }
);
const payoutPreparationPayload = await payoutPreparationResponse.json();
assert(
  payoutPreparationResponse.status === 201
    && payoutPreparationPayload.payoutPreparation.providerExecutionAvailable === false
    && payoutPreparationPayload.payoutPreparation.balancesAreTestRecords === true,
  "Test payout preparation was unavailable during acquisition shutdown or claimed real execution."
);

const migration = await fs.readFile("supabase/migrations/20260716050000_marketplace_commerce_licenses_and_seller_accounting.sql", "utf8");
const marketplaceAccount = await fs.readFile("src/pages/The-Elysia-Marketplace/components/MarketplaceCommerceAccountPanel.tsx", "utf8");
assert(migration.includes("'marketplace_seller_agreement'") && migration.includes("'stripe_connect_seller_disclosure'"), "Marketplace migration lost either durable seller consent record.");
const sellerOnboardingFunction = migration.slice(
  migration.indexOf("create or replace function public.prepare_economic_seller_onboarding"),
  migration.indexOf("alter function public.prepare_economic_seller_onboarding")
);
assert(
  sellerOnboardingFunction.includes("'marketplace_seller_agreement', p_seller_agreement_version")
    && !sellerOnboardingFunction.includes("p_offer_kind"),
  "Commercial seller onboarding references an undeclared offer kind or no longer requires its exact commercial agreement."
);
for (const marker of [
  "marketplace_seller_onboarding_rate_limited",
  "marketplace_seller_status_rate_limited",
  "economic_seller_provider_status_requests",
  "economic_seller_publisher_link_requests",
  "marketplace_offer_configuration_requests",
  "marketplace_offer_status_requests",
  "marketplace_offer_configuration_immutable",
  "marketplace_offer_status_idempotency_conflict",
  "set_marketplace_test_offer_status",
  "'totalOwnedOfferCount'",
  "'offersTruncated'",
  "'eligibleReviewedVersionCount'",
  "'eligibleReviewedVersionsTruncated'",
  "'publisherOptionCount'",
  "'publisherOptionsTruncated'",
  "pg_advisory_xact_lock"
]) assert(migration.includes(marker), `Marketplace provider quota guard is missing ${marker}.`);
const offerConfigurationFunction = migration.slice(
  migration.indexOf("create or replace function public.configure_marketplace_test_offer"),
  migration.indexOf("alter function public.configure_marketplace_test_offer")
);
assert(!offerConfigurationFunction.includes("'idempotentReplay', found"), "Fresh Marketplace offer configuration still depends on unstable PL/pgSQL FOUND state.");
assert(offerConfigurationFunction.includes("'idempotentReplay', false") && offerConfigurationFunction.includes("marketplace_test_offer_revised"), "Marketplace offer configuration lost explicit replay state or safe draft revision.");
for (const [functionName, nextMarker] of [
  ["public.accept_marketplace_free_seller_agreement", "alter function public.accept_marketplace_free_seller_agreement"],
  ["public.prepare_economic_seller_onboarding", "alter function public.prepare_economic_seller_onboarding"],
  ["public.operator_prepare_marketplace_test_payout", "alter function public.operator_prepare_marketplace_test_payout"]
]) {
  const body = migration.slice(
    migration.indexOf(`create or replace function ${functionName}`),
    migration.indexOf(nextMarker, migration.indexOf(`create or replace function ${functionName}`))
  );
  assert(body.includes("v_idempotent_replay := found") && body.includes("'idempotentReplay', v_idempotent_replay"), `${functionName} lost its captured fresh-versus-replay state.`);
  assert(!body.includes("'idempotentReplay', found"), `${functionName} still returns unstable PL/pgSQL FOUND state after later writes.`);
}
assert(migration.includes("p_consent_version <> v_offer.buyer_terms_version"), "Free Marketplace consent is no longer bound to the reviewed offer terms.");
assert(migration.includes("private.economic_feature_enabled('marketplace_paid_offers')"), "Paid Marketplace visibility/checkout lost its database gate.");
assert(migration.includes("private.economic_feature_enabled('marketplace_payout_preparation')") && migration.includes("'providerExecutionAvailable', false"), "Marketplace payout preparation lost its separate no-execution gate/result.");
assert(migration.includes("marketplace_seller_self_purchase_prohibited"), "Marketplace seller self-purchase protection disappeared.");
const paidFulfillmentFunction = migration.slice(
  migration.indexOf("create or replace function private.fulfill_paid_marketplace_license"),
  migration.indexOf("alter function private.fulfill_paid_marketplace_license")
);
assert(
  paidFulfillmentFunction.indexOf("hold.status = 'refund_required'") > -1
    && paidFulfillmentFunction.indexOf("hold.status = 'refund_required'") < paidFulfillmentFunction.indexOf("insert into private.marketplace_licenses")
    && paidFulfillmentFunction.indexOf("hold.status = 'refund_required'") < paidFulfillmentFunction.indexOf("insert into private.marketplace_commission_events"),
  "An unresolved Marketplace full-refund hold can re-enter license, entitlement, or payable fulfillment after a later paid transition."
);
assert(migration.includes("'installAuthorized', false") && migration.includes("'paymentGrantsTrust', false"), "Marketplace database projections no longer prove non-install/non-trust semantics.");
assert(migration.includes("configure_marketplace_test_commercial_terms") && migration.includes("require_economic_operator_capability"), "Marketplace commission configuration is no longer operator-separated.");
assert(exactUsdDecimalToMinor("0.29") === 29 && exactUsdDecimalToMinor("0.58") === 58 && exactUsdDecimalToMinor("1.01") === 101, "Marketplace exact USD parser changed a legitimate two-decimal value.");
for (const invalidAmount of ["0.001", "1e2", "-0.58", " 0.58", "0.58 ", "00.58"]) {
  assert(exactUsdDecimalToMinor(invalidAmount) === null, `Marketplace exact USD parser accepted a non-canonical amount: ${invalidAmount}.`);
}
assert(
  marketplaceAccount.includes("exactUsdDecimalToMinor(amountDollars)")
    && marketplaceAccount.includes("parsedAmountMinor >= 50")
    && marketplaceAccount.includes('expectedFlow="marketplace_purchase"')
    && !marketplaceAccount.includes("amount * 100")
    && !marketplaceAccount.includes("Math.round"),
  "Marketplace seller pricing or checkout return handling lost exact minor-unit conversion or canonical flow verification."
);
let payoutRouteExists = true;
try { await fs.access("functions/api/billing/operator/marketplace-payout.ts"); }
catch { payoutRouteExists = false; }
assert(!payoutRouteExists, "Marketplace payout execution route was exposed before explicit authorization.");

console.log("Billing Marketplace commerce boundary smoke test ok.");
