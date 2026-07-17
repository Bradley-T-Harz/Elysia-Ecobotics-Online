import { reconcileStripeTestCatalog, recordStripeTestCatalogReferences, STRIPE_TEST_CATALOG } from "./billingStripeTestCatalog.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const secretKey = `sk_test_${"c".repeat(40)}`;
let networkCalls = 0;
const dryRun = await reconcileStripeTestCatalog({
  secretKey,
  apply: false,
  fetcher: async () => { networkCalls += 1; throw new Error("Dry run must not use the network."); }
});
assert(networkCalls === 0 && dryRun.length === STRIPE_TEST_CATALOG.length && dryRun.every((row) => row.action === "dry_run"), "Catalog dry run was not offline and complete.");

let liveRejected = false;
try { await reconcileStripeTestCatalog({ secretKey: `sk_live_${"x".repeat(40)}`, apply: false }); }
catch (error) { liveRejected = /test secret|live keys/i.test(String(error)); }
assert(liveRejected, "Catalog reconciler accepted a live Stripe key.");

let confirmationRejected = false;
try { await reconcileStripeTestCatalog({ secretKey, apply: true, confirmation: "wrong", fetcher: async () => { throw new Error("must not fetch"); } }); }
catch (error) { confirmationRejected = /Refusing catalog mutation/.test(String(error)); }
assert(confirmationRejected, "Catalog reconciler applied without its explicit test-only confirmation.");

const products = [];
const prices = [];
const idempotencyKeys = [];
let mutations = 0;
async function fakeFetch(input, init) {
  networkCalls += 1;
  const url = new URL(String(input));
  const body = new URLSearchParams(String(init?.body ?? ""));
  const headers = new Headers(init?.headers);
  if (headers.get("idempotency-key")) idempotencyKeys.push(headers.get("idempotency-key"));
  assert(url.origin === "https://api.stripe.com", "Catalog reconciler called an untrusted origin.");
  assert(headers.get("authorization") === `Bearer ${secretKey}`, "Catalog reconciler omitted its test secret.");
  assert(!String(init?.body ?? "").includes(secretKey), "Catalog reconciler placed its secret in a request body.");

  if (url.pathname === "/v1/products" && init?.method === "GET") {
    return new Response(JSON.stringify({ object: "list", data: products, has_more: false }), { status: 200 });
  }
  if (url.pathname === "/v1/products" && init?.method === "POST") {
    mutations += 1;
    const product = {
      id: `prod_${String(products.length + 1).padStart(6, "0")}`,
      object: "product",
      livemode: false,
      active: true,
      name: body.get("name"),
      description: body.get("description"),
      metadata: { elysia_catalog_code: body.get("metadata[elysia_catalog_code]"), elysia_environment: "test" }
    };
    products.push(product);
    return new Response(JSON.stringify(product), { status: 200 });
  }
  if (url.pathname.startsWith("/v1/products/") && init?.method === "POST") {
    mutations += 1;
    const product = products.find((entry) => entry.id === url.pathname.split("/").at(-1));
    product.name = body.get("name");
    product.description = body.get("description");
    return new Response(JSON.stringify(product), { status: 200 });
  }
  if (url.pathname === "/v1/prices" && init?.method === "GET") {
    const productId = url.searchParams.get("product");
    return new Response(JSON.stringify({ object: "list", data: prices.filter((price) => price.product === productId), has_more: false }), { status: 200 });
  }
  if (url.pathname === "/v1/prices" && init?.method === "POST") {
    mutations += 1;
    const price = {
      id: `price_${String(prices.length + 1).padStart(6, "0")}`,
      object: "price",
      livemode: false,
      active: true,
      product: body.get("product"),
      currency: body.get("currency"),
      unit_amount: Number(body.get("unit_amount")),
      lookup_key: body.get("lookup_key"),
      recurring: { interval: body.get("recurring[interval]") },
      metadata: { elysia_catalog_code: body.get("metadata[elysia_catalog_code]") }
    };
    prices.push(price);
    return new Response(JSON.stringify(price), { status: 200 });
  }
  throw new Error(`Unexpected catalog fixture request: ${init?.method} ${url.pathname}`);
}

const applied = await reconcileStripeTestCatalog({
  secretKey,
  apiVersion: "2025-02-24.acacia",
  apply: true,
  confirmation: "ELYSIA-STRIPE-TEST-CATALOG-ONLY",
  fetcher: fakeFetch
});
assert(applied.length === 6 && products.length === 6 && prices.length === 5, "Catalog reconciler did not create six reviewed support products and five fixed recurring prices.");
assert(products.every((product) => product.livemode === false) && prices.every((price) => price.livemode === false), "Catalog fixture created a live object.");
assert(prices.map((price) => price.unit_amount).join(",") === "100,500,1200,2500,5000", "Recurring support amounts drifted from the governing catalog.");
assert(
  STRIPE_TEST_CATALOG.filter((entry) => entry.recurring).every((entry) => /^\$\d+ monthly support$/.test(entry.name))
    && !JSON.stringify(STRIPE_TEST_CATALOG).includes("Seed Supporter")
    && !JSON.stringify(STRIPE_TEST_CATALOG).includes("Commons Patron"),
  "Stripe-hosted recurring support labels imply rank or social status."
);
const mutationsAfterFirstPass = mutations;
const secondPass = await reconcileStripeTestCatalog({
  secretKey,
  apiVersion: "2025-02-24.acacia",
  apply: true,
  confirmation: "ELYSIA-STRIPE-TEST-CATALOG-ONLY",
  fetcher: fakeFetch
});
assert(mutations === mutationsAfterFirstPass && secondPass.every((row) => row.action === "reused"), "Repeated catalog reconciliation created duplicates or mutated immutable prices.");

products[1].name = "Seed Supporter";
const mutationsBeforeNeutralReconcile = mutations;
const neutralized = await reconcileStripeTestCatalog({
  secretKey,
  apiVersion: "2025-02-24.acacia",
  apply: true,
  confirmation: "ELYSIA-STRIPE-TEST-CATALOG-ONLY",
  fetcher: fakeFetch
});
assert(mutations === mutationsBeforeNeutralReconcile + 1 && neutralized[1].action === "updated", "Existing status-oriented Stripe product labels were not reconciled to neutral language.");
assert(idempotencyKeys.includes("elysia-test-product:support_monthly_seed_usd:description-v2"), "Neutral catalog copy did not use a new reconciliation idempotency marker.");

prices[0].unit_amount = 999;
let driftRejected = false;
try {
  await reconcileStripeTestCatalog({ secretKey, apply: true, confirmation: "ELYSIA-STRIPE-TEST-CATALOG-ONLY", fetcher: fakeFetch });
} catch (error) {
  driftRejected = /immutable catalog definition/.test(String(error));
}
assert(driftRejected, "Catalog reconciler silently rewrote an immutable price mismatch.");

let recordConfirmationRejected = false;
try {
  await recordStripeTestCatalogReferences({
    supabaseUrl: "https://fixture.supabase.co",
    serviceRoleKey: "synthetic-service-role-key-with-safe-length",
    catalogSummary: applied,
    confirmation: "wrong",
    fetcher: async () => { throw new Error("must not fetch"); }
  });
} catch (error) {
  recordConfirmationRejected = /Refusing Supabase catalog recording/.test(String(error));
}
assert(recordConfirmationRejected, "Catalog references were recorded without the independent Supabase confirmation.");

const serviceRoleKey = "synthetic-service-role-key-with-safe-length";
const recordedBodies = [];
const recorded = await recordStripeTestCatalogReferences({
  supabaseUrl: "https://fixture.supabase.co",
  serviceRoleKey,
  catalogSummary: applied,
  confirmation: "ELYSIA-SUPABASE-TEST-CATALOG-REFERENCES-ONLY",
  fetcher: async (input, init) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    assert(url.origin === "https://fixture.supabase.co" && url.pathname === "/rest/v1/rpc/record_economic_test_catalog_reference", "Catalog recorder called an untrusted Supabase endpoint.");
    assert(headers.get("authorization") === `Bearer ${serviceRoleKey}` && headers.get("apikey") === serviceRoleKey, "Catalog recorder omitted server-only RPC authentication.");
    assert(!String(init?.body).includes(serviceRoleKey), "Catalog recorder placed its service-role key in a body.");
    recordedBodies.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ testMode: true }), { status: 200 });
  }
});
assert(recorded.length === 6 && recordedBodies.length === 6, "Catalog recorder did not bind every reviewed Stripe test reference.");
const oneTimeRecord = recordedBodies.find((body) => body.p_product_key === "support_one_time");
assert(oneTimeRecord?.p_price_code === null && oneTimeRecord?.p_provider_price_id === null && /^prod_/.test(oneTimeRecord?.p_provider_product_id), "One-time support did not record its product-only custom-price reference.");
const recurringRecords = recordedBodies.filter((body) => body.p_product_key === "support_recurring");
assert(recurringRecords.length === 5 && recurringRecords.every((body) => /^support_monthly_.*_usd$/.test(body.p_price_code) && /^price_/.test(body.p_provider_price_id)), "Recurring catalog records did not use canonical internal price codes and fixed Stripe test prices.");

let nonTestSummaryRejected = false;
try {
  await recordStripeTestCatalogReferences({
    supabaseUrl: "https://fixture.supabase.co",
    serviceRoleKey,
    catalogSummary: applied.map((entry, index) => index === 0 ? { ...entry, testMode: false } : entry),
    confirmation: "ELYSIA-SUPABASE-TEST-CATALOG-REFERENCES-ONLY",
    fetcher: async () => { throw new Error("must not fetch"); }
  });
} catch (error) {
  nonTestSummaryRejected = /non-test catalog result/.test(String(error));
}
assert(nonTestSummaryRejected, "Catalog recorder accepted a result not proven to come from Stripe test mode.");

console.log("Billing Stripe test catalog smoke test ok.");
