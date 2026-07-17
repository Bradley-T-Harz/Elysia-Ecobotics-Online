import fs from "node:fs/promises";
import { BillingHttpError } from "../functions/api/billing/_shared/http.ts";
import { loadSandboxCreditPackCatalog, prepareSandboxCreditCheckout } from "../functions/api/billing/_shared/database.ts";
import { parseSandboxCreditCheckout } from "../functions/api/billing/_shared/schema.ts";
import { handleSandboxCreditCatalog } from "../functions/api/billing/sandbox-credits/catalog.ts";
import { handleSandboxCreditCheckout } from "../functions/api/billing/sandbox-credits/checkout.ts";

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
  BILLING_SANDBOX_PURCHASES_ENABLED: "true",
  BILLING_WEBHOOK_FULFILLMENT_ENABLED: "true",
  BILLING_NOTIFICATION_RETRY_ENABLED: "true",
  STRIPE_LIVE_ENABLED: "false"
};
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const clientRequestId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const orderId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const packCode = "sandbox_test_reviewed_small";
const auth = { accessToken: "synthetic", userId, email: "private@example.invalid", supabase: {} };

function post(body, options = {}) {
  return new Request(`${origin}/api/billing/sandbox-credits/checkout`, {
    method: "POST",
    headers: {
      origin: options.origin ?? origin,
      "content-type": "application/json",
      ...(options.authorization === false ? {} : { authorization: "Bearer synthetic" })
    },
    body: JSON.stringify(body)
  });
}

const checkoutBody = {
  clientRequestId,
  packCode,
  sourceRoute: "/commons-circle/support-billing",
  consentVersion: "sandbox-credit-terms-v1"
};
assert(parseSandboxCreditCheckout(checkoutBody).packCode === packCode, "Valid configured sandbox pack checkout was rejected.");
for (const invalidBody of [
  { ...checkoutBody, amountMinor: 500 },
  { ...checkoutBody, grantedUnits: 5000 },
  { ...checkoutBody, providerPriceId: "price_attacker" },
  { ...checkoutBody, packCode: "sandbox_default" },
  { ...checkoutBody, packCode: "sandbox_test_bad__code" },
  { ...checkoutBody, sourceRoute: "/admin/economic-operations" },
  { ...checkoutBody, changesSafetyPrivileges: true },
  { ...checkoutBody, actorUserId: userId }
]) {
  let rejected = false;
  try { parseSandboxCreditCheckout(invalidBody); } catch (error) { rejected = error instanceof BillingHttpError; }
  assert(rejected, "Sandbox checkout accepted client pricing, units, provider IDs, privileges, actor, or an unconfigured-code shape.");
}

const catalogRow = {
  available: true,
  testMode: true,
  packs: [{
    packCode,
    amountMinor: 500,
    currency: "usd",
    grantedUnits: 10_000,
    expiresAfterDays: 365,
    disclosureVersion: "sandbox-credit-terms-v1",
    testMode: true,
    providerPriceReference: "price_private"
  }]
};
const catalog = await loadSandboxCreditPackCatalog({ rpc: async () => ({ data: catalogRow, error: null }) });
assert(catalog.available && catalog.packs[0].amountMinor === 500 && catalog.packs[0].currency === "usd", "Configured sandbox pack catalog was not strictly normalized.");
assert(!JSON.stringify(catalog).includes("price_private"), "Sandbox pack catalog leaked a provider identifier.");
const catalogResponse = await handleSandboxCreditCatalog(new Request(`${origin}/api/billing/sandbox-credits/catalog`), env, {
  load: async () => catalog
});
assert(catalogResponse.status === 200 && (await catalogResponse.json()).catalog.packs.length === 1, "Enabled configured sandbox pack catalog was not available.");
let disabledCatalogLoads = 0;
const disabledCatalogResponse = await handleSandboxCreditCatalog(
  new Request(`${origin}/api/billing/sandbox-credits/catalog`),
  { ...env, BILLING_SANDBOX_PURCHASES_ENABLED: "false" },
  { load: async () => { disabledCatalogLoads += 1; return catalog; } }
);
const disabledCatalog = await disabledCatalogResponse.json();
assert(disabledCatalog.catalog.available === false && disabledCatalog.catalog.packs.length === 0 && disabledCatalogLoads === 0, "Environment kill switch exposed or queried sandbox pack pricing.");
const dbDisabledCatalog = await loadSandboxCreditPackCatalog({ rpc: async () => ({ data: { available: false, testMode: true, packs: [] }, error: null }) });
assert(!dbDisabledCatalog.available && dbDisabledCatalog.packs.length === 0, "Database-disabled sandbox catalog did not fail closed.");

const preparation = {
  orderId,
  publicReference: "opaque_sandbox_order_reference_1234567",
  idempotencyKey: `checkout:${clientRequestId}`,
  amountMinor: 500,
  currency: "usd",
  providerProductReference: "prod_sandboxfixture",
  providerPriceReference: "price_sandboxfixture",
  providerCustomerReference: null,
  packCode,
  grantedUnits: 10_000,
  expiresAfterDays: 365,
  testMode: true
};
let checkoutActor = null;
let providerInput = null;
let attached = 0;
let customerAttached = 0;
const checkoutResponse = await handleSandboxCreditCheckout(post(checkoutBody), env, {
  authenticate: async () => auth,
  prepare: async (_env, actor) => { checkoutActor = actor; return preparation; },
  provider: () => ({
    ensureCustomer: async () => ({ providerCustomerReference: "cus_sandboxfixture" }),
    createCheckout: async (input) => {
    providerInput = input;
    return { providerSessionId: "cs_test_sandbox", providerCustomerReference: null, checkoutUrl: "https://checkout.stripe.com/c/pay/sandbox" };
    }
  }),
  attachCustomer: async (_env, exactOrderId, reference) => {
    assert(exactOrderId === orderId && reference === "cus_sandboxfixture", "Sandbox checkout attached the wrong canonical Customer.");
    customerAttached += 1;
  },
  attach: async () => { attached += 1; },
  fail: async () => undefined
});
const checkoutPayload = await checkoutResponse.json();
assert(checkoutResponse.status === 201 && checkoutActor === userId && customerAttached === 1 && attached === 1, "Sandbox checkout did not authenticate its owner, establish its canonical Customer, and attach the hosted session.");
assert(providerInput.flow === "sandbox_credits" && providerInput.providerPriceReference === "price_sandboxfixture", "Sandbox checkout did not use its fixed server catalog price.");
assert(providerInput.successUrl.startsWith(`${origin}/commons-circle/support-billing?`) && providerInput.cancelUrl.startsWith(`${origin}/commons-circle/support-billing?`), "Sandbox checkout redirects were not server-derived.");
assert(checkoutPayload.pack.grantedUnits === 10_000 && checkoutPayload.pack.changesSafetyPrivileges === false, "Sandbox checkout obscured units or changed safety privileges.");
assert(!JSON.stringify(checkoutPayload).includes("500") && !JSON.stringify(checkoutPayload).includes("price_sandboxfixture") && !JSON.stringify(checkoutPayload).includes("cs_test"), "Sandbox checkout response exposed amount or provider identifiers.");
assert((await handleSandboxCreditCheckout(post(checkoutBody, { authorization: false }), env, {
  authenticate: async () => { throw new BillingHttpError(401, "authentication_required"); },
  prepare: async () => { throw new Error("must not prepare"); }, provider: () => ({}), attach: async () => undefined, fail: async () => undefined
})).status === 401, "Anonymous sandbox credit purchase was accepted.");
assert((await handleSandboxCreditCheckout(post(checkoutBody), { ...env, BILLING_SANDBOX_PURCHASES_ENABLED: "false" }, {
  authenticate: async () => auth,
  prepare: async () => { throw new Error("must not prepare"); }, provider: () => ({}), attach: async () => undefined, fail: async () => undefined
})).status === 503, "Sandbox purchase environment kill switch did not fail closed.");
assert((await handleSandboxCreditCheckout(post(checkoutBody), { ...env, BILLING_WEBHOOK_FULFILLMENT_ENABLED: "false" }, {
  authenticate: async () => auth,
  prepare: async () => { throw new Error("must not prepare"); }, provider: () => ({}), attach: async () => undefined, fail: async () => undefined
})).status === 503, "Sandbox purchase opened without durable webhook fulfillment.");

let prepareRpc = null;
const prepared = await prepareSandboxCreditCheckout({ rpc: async (name, args) => {
  prepareRpc = { name, args };
  return { data: {
    ...preparation,
    rateApprovedForLiveUse: false,
    automaticPurchase: false,
    safetyPrivilegesChanged: false
  }, error: null };
} }, userId, parseSandboxCreditCheckout(checkoutBody));
assert(prepared.packCode === packCode && prepareRpc.name === "prepare_sandbox_credit_checkout" && prepareRpc.args.p_actor_user_id === userId, "Sandbox checkout did not use its owner-bound service RPC.");
assert(!Object.keys(prepareRpc.args).some((key) => /amount|unit|provider|safety|network|privilege/i.test(key)), "Sandbox checkout preparation accepted mutable economics or safety permissions.");

const migration = await fs.readFile("supabase/migrations/20260716034000_sandbox_credit_commerce_and_compensation.sql", "utf8");
const prepareFunction = migration.slice(
  migration.indexOf("create or replace function public.prepare_sandbox_credit_checkout"),
  migration.indexOf("alter function public.prepare_sandbox_credit_checkout")
);
assert(prepareFunction.includes("sandbox_credit_display") && prepareFunction.includes("sandbox_credit_purchase"), "Sandbox checkout can bypass the paired database display/purchase gates.");
assert(migration.includes("safetyPrivilegesChanged', false") && migration.includes("approved_for_live_use = false"), "Sandbox commerce no longer proves test-only and safety privilege separation.");

console.log("Billing sandbox commerce boundary smoke test ok.");
