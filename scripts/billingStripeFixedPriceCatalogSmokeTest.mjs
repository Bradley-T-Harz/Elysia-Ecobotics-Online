import { readFile } from "node:fs/promises";
import {
  configureStripeFixedTestPriceInSupabase,
  FIXED_PRICE_APPLY_CONFIRMATION,
  FIXED_PRICE_DATABASE_CONFIRMATION,
  normalizeStripeFixedTestPriceSpec,
  reconcileStripeFixedTestPrice
} from "./billingStripeTestCatalog.mjs";
import { safeFixedPriceCliOutput } from "./billingStripeFixedPriceTestCatalog.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function rejects(operation, pattern, message) {
  let matched = false;
  try { await operation(); }
  catch (error) { matched = pattern.test(String(error)); }
  assert(matched, message);
}

const sandboxSpec = {
  productKey: "sandbox_credits",
  priceCode: "sandbox_test_small_pack_usd",
  amountMinor: 500,
  currency: "usd",
  disclosureVersion: "sandbox-credit-terms-test-v1",
  packCode: "sandbox_test_small_pack",
  grantedUnits: 20_000,
  expiresAfterDays: 90
};
const organizationSpec = {
  productKey: "organization_service",
  priceCode: "organization_test_watershed_review_v1",
  amountMinor: 50_000,
  currency: "usd",
  disclosureVersion: "organization-service-disclosure-test-v1"
};
assert(normalizeStripeFixedTestPriceSpec(sandboxSpec).grantedUnits === 20_000, "Reviewed sandbox fixed-price specification was rejected.");
for (const unsafe of [
  { ...sandboxSpec, productKey: "marketplace_purchase" },
  { ...sandboxSpec, currency: "eur" },
  { ...sandboxSpec, amountMinor: 0 },
  { ...organizationSpec, grantedUnits: 100 },
  { ...organizationSpec, priceCode: "../../provider-price" }
]) {
  await rejects(
    () => Promise.resolve(normalizeStripeFixedTestPriceSpec(unsafe)),
    /(allowlist|USD|bounds|Sandbox pack fields|invalid)/i,
    "Fixed-price specification accepted an unreviewed flow, client provider field, or unsafe amount."
  );
}

let calls = 0;
const dryRun = await reconcileStripeFixedTestPrice({
  spec: sandboxSpec,
  apply: false,
  fetcher: async () => { calls += 1; throw new Error("dry run must not fetch"); }
});
assert(calls === 0 && dryRun.action === "dry_run" && dryRun.testMode === true, "Fixed-price dry run was not offline and test-only.");
await rejects(
  () => reconcileStripeFixedTestPrice({ spec: sandboxSpec, apply: false, billingMode: "live", stripeLiveEnabled: "false" }),
  /refuses live/i,
  "Fixed-price dry run accepted live billing mode."
);
await rejects(
  () => reconcileStripeFixedTestPrice({
    spec: sandboxSpec, secretKey: `sk_test_${"x".repeat(40)}`, apply: true,
    confirmation: "wrong", billingMode: "test", stripeLiveEnabled: "false",
    fetcher: async () => { throw new Error("must not fetch"); }
  }),
  /Refusing fixed-price mutation/,
  "Fixed-price Stripe mutation ignored its exact confirmation."
);

const secretKey = `sk_test_${"k".repeat(40)}`;
const products = [];
const prices = [];
const stripeBodies = [];
async function stripeFetch(input, init) {
  calls += 1;
  const url = new URL(String(input));
  const headers = new Headers(init?.headers);
  const body = new URLSearchParams(String(init?.body ?? ""));
  assert(url.origin === "https://api.stripe.com" && headers.get("authorization") === `Bearer ${secretKey}`, "Fixed-price catalog called an untrusted Stripe origin or omitted its test credential.");
  assert(!String(init?.body ?? "").includes(secretKey), "Fixed-price catalog placed its secret in a request body.");
  if (url.pathname === "/v1/products" && init?.method === "GET") {
    return new Response(JSON.stringify({ data: products, has_more: false }), { status: 200 });
  }
  if (url.pathname === "/v1/products" && init?.method === "POST") {
    stripeBodies.push(Object.fromEntries(body));
    const product = {
      id: `prod_fixed${products.length + 1}`, livemode: false, active: true,
      name: body.get("name"), description: body.get("description"),
      metadata: { elysia_fixed_price_code: body.get("metadata[elysia_fixed_price_code]") }
    };
    products.push(product);
    return new Response(JSON.stringify(product), { status: 200 });
  }
  if (url.pathname === "/v1/prices" && init?.method === "GET") {
    return new Response(JSON.stringify({ data: prices.filter((price) => price.product === url.searchParams.get("product")), has_more: false }), { status: 200 });
  }
  if (url.pathname === "/v1/prices" && init?.method === "POST") {
    stripeBodies.push(Object.fromEntries(body));
    const price = {
      id: `price_fixed${prices.length + 1}`, livemode: false, active: true,
      product: body.get("product"), currency: body.get("currency"),
      unit_amount: Number(body.get("unit_amount")), lookup_key: body.get("lookup_key"), recurring: null
    };
    prices.push(price);
    return new Response(JSON.stringify(price), { status: 200 });
  }
  throw new Error(`Unexpected fixed-price Stripe fixture request: ${init?.method} ${url.pathname}`);
}

const runtime = { billingMode: "test", stripeLiveEnabled: "false" };
const appliedSandbox = await reconcileStripeFixedTestPrice({
  spec: sandboxSpec, secretKey, apply: true, confirmation: FIXED_PRICE_APPLY_CONFIRMATION,
  ...runtime, fetcher: stripeFetch
});
assert(appliedSandbox.action === "created_product_and_price" && products.length === 1 && prices.length === 1, "Sandbox fixed-price catalog did not create one immutable test product and price.");
assert(stripeBodies.every((body) => body["metadata[elysia_environment]"] === "test"), "Fixed-price Stripe objects lost their explicit test metadata.");
const repeatSandbox = await reconcileStripeFixedTestPrice({
  spec: sandboxSpec, secretKey, apply: true, confirmation: FIXED_PRICE_APPLY_CONFIRMATION,
  ...runtime, fetcher: stripeFetch
});
assert(repeatSandbox.action === "reused" && products.length === 1 && prices.length === 1, "Fixed-price retry created duplicate Stripe objects.");
prices[0].unit_amount = 999;
await rejects(
  () => reconcileStripeFixedTestPrice({ spec: sandboxSpec, secretKey, apply: true, confirmation: FIXED_PRICE_APPLY_CONFIRMATION, ...runtime, fetcher: stripeFetch }),
  /immutable reviewed definition/,
  "Fixed-price setup silently rewrote an immutable amount drift."
);
prices[0].unit_amount = sandboxSpec.amountMinor;

const serviceRoleKey = "synthetic-service-role-key-never-log-this-value";
const supabaseCalls = [];
const sandboxConfigured = await configureStripeFixedTestPriceInSupabase({
  catalogResult: appliedSandbox,
  reason: "Reviewed sandbox test pack amount, units, expiry, and disclosure.",
  confirmation: FIXED_PRICE_DATABASE_CONFIRMATION,
  supabaseUrl: "https://fixture-project.supabase.co",
  serviceRoleKey,
  ...runtime,
  fetcher: async (input, init) => {
    const url = new URL(String(input));
    const body = JSON.parse(String(init?.body));
    const headers = new Headers(init?.headers);
    assert(headers.get("authorization") === `Bearer ${serviceRoleKey}` && !String(init?.body).includes(serviceRoleKey), "Fixed-price Supabase call mishandled its server-only credential.");
    supabaseCalls.push({ path: url.pathname, body });
    if (url.pathname.endsWith("/configure_sandbox_test_credit_pack")) return new Response(JSON.stringify({
      packVersionId: "11111111-1111-4111-8111-111111111111",
      packCode: sandboxSpec.packCode, priceCode: sandboxSpec.priceCode,
      amountMinor: sandboxSpec.amountMinor, currency: "usd", grantedUnits: sandboxSpec.grantedUnits,
      expiresAfterDays: sandboxSpec.expiresAfterDays, approvedForLiveUse: false, testMode: true
    }), { status: 200 });
    if (url.pathname.endsWith("/record_economic_test_catalog_reference")) return new Response(JSON.stringify({ testMode: true }), { status: 200 });
    throw new Error(`Unexpected Supabase fixture RPC ${url.pathname}`);
  }
});
assert(sandboxConfigured.providerReferencesRecorded && supabaseCalls.length === 2, "Sandbox fixed price was not configured and linked without ad hoc SQL.");
assert(supabaseCalls[0].body.p_confirmation === "CONFIGURE UNAPPROVED SANDBOX TEST PACK" && supabaseCalls[1].body.p_provider === "stripe", "Sandbox configuration lost its unapproved-test confirmation or provider-neutral catalog link.");

const appliedOrganization = await reconcileStripeFixedTestPrice({
  spec: organizationSpec, secretKey, apply: true, confirmation: FIXED_PRICE_APPLY_CONFIRMATION,
  ...runtime, fetcher: stripeFetch
});
const actorUserId = "22222222-2222-4222-8222-222222222222";
const clientRequestId = "33333333-3333-4333-8333-333333333333";
let organizationConfigureBody = null;
const organizationConfigured = await configureStripeFixedTestPriceInSupabase({
  catalogResult: appliedOrganization, actorUserId, clientRequestId,
  reason: "Negotiated test organization service price received independent review.",
  confirmation: FIXED_PRICE_DATABASE_CONFIRMATION,
  supabaseUrl: "https://fixture-project.supabase.co", serviceRoleKey, ...runtime,
  fetcher: async (input, init) => {
    const url = new URL(String(input));
    const body = JSON.parse(String(init?.body));
    if (url.pathname.endsWith("/configure_economic_test_price")) {
      organizationConfigureBody = body;
      return new Response(JSON.stringify({
        priceCode: organizationSpec.priceCode, productKey: organizationSpec.productKey,
        amountMinor: organizationSpec.amountMinor, currency: "usd",
        disclosureVersion: organizationSpec.disclosureVersion, testMode: true, idempotentReplay: false
      }), { status: 200 });
    }
    if (url.pathname.endsWith("/record_economic_test_catalog_reference")) return new Response(JSON.stringify({ testMode: true }), { status: 200 });
    throw new Error(`Unexpected Supabase fixture RPC ${url.pathname}`);
  }
});
assert(organizationConfigured.configured && organizationConfigureBody.p_actor_user_id === actorUserId && organizationConfigureBody.p_client_request_id === clientRequestId, "Negotiated organization price lost operator identity or idempotency binding.");
assert(!Object.keys(organizationConfigureBody).some((key) => /provider|stripe/.test(key)), "Provider identifiers entered the economic price-definition RPC.");
await rejects(
  () => configureStripeFixedTestPriceInSupabase({
    catalogResult: appliedOrganization, actorUserId, clientRequestId,
    reason: "Reviewed organization test price configuration.", confirmation: FIXED_PRICE_DATABASE_CONFIRMATION,
    supabaseUrl: "https://attacker.example", serviceRoleKey, ...runtime,
    fetcher: async () => { throw new Error("must not fetch"); }
  }),
  /canonical hosted Supabase/i,
  "Fixed-price setup would send a service-role key to an arbitrary HTTPS origin."
);

const safeOutput = JSON.stringify(safeFixedPriceCliOutput(appliedOrganization, organizationConfigured));
assert(!safeOutput.includes(serviceRoleKey) && !safeOutput.includes(actorUserId) && !safeOutput.includes("prod_") && !safeOutput.includes("price_"), "Fixed-price CLI output exposed credentials, account IDs, or provider identifiers.");
const cliSource = await readFile(new URL("./billingStripeFixedPriceTestCatalog.mjs", import.meta.url), "utf8");
assert(!cliSource.includes(".env.local") && !cliSource.includes("dotenv") && !cliSource.includes("readFile("), "Fixed-price CLI can load or alter an environment file.");

console.log("Billing Stripe fixed test-price catalog smoke test ok.");
