const API_ORIGIN = "https://api.stripe.com";
const APPLY_CONFIRMATION = "ELYSIA-STRIPE-TEST-CATALOG-ONLY";
const RECORD_CONFIRMATION = "ELYSIA-SUPABASE-TEST-CATALOG-REFERENCES-ONLY";
export const FIXED_PRICE_APPLY_CONFIRMATION = "ELYSIA-STRIPE-FIXED-PRICE-TEST-CATALOG-ONLY";
export const FIXED_PRICE_DATABASE_CONFIRMATION = "ELYSIA-SUPABASE-FIXED-PRICE-TEST-CONFIGURATION-ONLY";
export const RECURRING_SANDBOX_PROGRAM_CONFIRMATION = "ELYSIA-SUPABASE-RECURRING-SANDBOX-PROGRAM-TEST-ONLY";
export const ACTIVATE_SANDBOX_TEST_PROGRAM_CONFIRMATION = "ACTIVATE UNAPPROVED SANDBOX TEST PROGRAM";
export const DEACTIVATE_SANDBOX_TEST_PROGRAM_CONFIRMATION = "DEACTIVATE UNAPPROVED SANDBOX TEST PROGRAM";

const FIXED_PRICE_PRODUCTS = Object.freeze({
  sandbox_credits: {
    name: "Elysia online sandbox credits (test mode)",
    description: "Prepaid test credits for measured use of the separate online coding sandbox. Credits do not change sandbox safety limits, network permissions, trust, membership, or authority."
  },
  job_post_fee: {
    name: "Commercial Job Post fee (test mode)",
    description: "Test-mode commercial Job Post processing. Payment satisfies only the economic condition and never approves content or publication."
  },
  organization_service: {
    name: "Elysia organization service (test mode)",
    description: "A test-mode payment under a separately reviewed organization service agreement. Payment grants no Commons authority, trust, moderation power, or endorsement."
  },
  sponsorship: {
    name: "Ethical Elysia sponsorship (test mode)",
    description: "A test-mode payment under an independently reviewed no-control sponsorship agreement. Payment grants no governance, moderation, editorial, tracking, ranking, or endorsement rights."
  }
});

export const STRIPE_TEST_CATALOG = Object.freeze([
  {
    code: "support_one_time",
    productKey: "support_one_time",
    priceCode: null,
    name: "Support Elysia Ecobotics",
    description: "Voluntary support for local-first development, security, documentation, community infrastructure, and subsidized online services. Support grants no authority, approval, or preferential treatment.",
    recurring: null
  },
  { code: "support_monthly_seed_usd", productKey: "support_recurring", priceCode: "support_monthly_seed_usd", name: "$1 monthly support", description: "Optional recurring support toward shared infrastructure. This grants no authority, rank, membership tier, or public financial status.", recurring: { amountMinor: 100, currency: "usd", interval: "month" } },
  { code: "support_monthly_commons_usd", productKey: "support_recurring", priceCode: "support_monthly_commons_usd", name: "$5 monthly support", description: "Optional recurring support for maintenance and documentation. This grants no authority, rank, membership tier, or public financial status.", recurring: { amountMinor: 500, currency: "usd", interval: "month" } },
  { code: "support_monthly_infrastructure_usd", productKey: "support_recurring", priceCode: "support_monthly_infrastructure_usd", name: "$12 monthly support", description: "Optional recurring support for hosting, security, and release work. This grants no authority, rank, membership tier, or public financial status.", recurring: { amountMinor: 1_200, currency: "usd", interval: "month" } },
  { code: "support_monthly_sandbox_usd", productKey: "support_recurring", priceCode: "support_monthly_sandbox_usd", name: "$25 monthly support", description: "Optional recurring support for online sandbox and other infrastructure costs. This does not promise credits or grant safety privileges, authority, rank, or public financial status.", recurring: { amountMinor: 2_500, currency: "usd", interval: "month" } },
  { code: "support_monthly_50_usd", productKey: "support_recurring", priceCode: "support_monthly_50_usd", name: "$50 monthly support", description: "Optional recurring support that helps subsidize broader public-interest access. This grants no authority, rank, membership tier, or public financial status.", recurring: { amountMinor: 5_000, currency: "usd", interval: "month" } }
]);

function assertTestSecret(secretKey) {
  if (typeof secretKey !== "string" || !secretKey.startsWith("sk_test_") || secretKey.length < 16 || /[\r\n]/.test(secretKey)) {
    throw new Error("A valid Stripe test secret is required; live keys are refused.");
  }
}

function safeApiVersion(apiVersion) {
  if (!apiVersion) return null;
  if (!/^\d{4}-\d{2}-\d{2}(?:\.[a-z][a-z0-9_]*)?$/.test(apiVersion)) throw new Error("STRIPE_API_VERSION is invalid.");
  return apiVersion;
}

async function readJson(response) {
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > 262_144) throw new Error("Stripe catalog response was oversized.");
  let value;
  try { value = JSON.parse(text); } catch { throw new Error("Stripe catalog response was invalid."); }
  if (!response.ok || !value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Stripe catalog request failed safely (${response.status}).`);
  return value;
}

async function requestStripe({ secretKey, apiVersion, fetcher }, path, { method = "GET", body, idempotencyKey } = {}) {
  const headers = new Headers({ authorization: `Bearer ${secretKey}` });
  if (apiVersion) headers.set("stripe-version", apiVersion);
  if (body) headers.set("content-type", "application/x-www-form-urlencoded");
  if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await readJson(await fetcher(new URL(path, API_ORIGIN), {
      method,
      headers,
      body: body?.toString(),
      redirect: "error",
      signal: controller.signal
    }));
  } finally {
    clearTimeout(timeout);
  }
}

function form(fields) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) if (value !== null && value !== undefined) body.set(key, String(value));
  return body;
}

function objectList(value) {
  return Array.isArray(value?.data) ? value.data.filter((item) => item && typeof item === "object" && !Array.isArray(item)) : [];
}

async function listAll(client, path) {
  const result = [];
  let startingAfter = null;
  for (let page = 0; page < 10; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const query = `${path}${separator}limit=100${startingAfter ? `&starting_after=${encodeURIComponent(startingAfter)}` : ""}`;
    const response = await requestStripe(client, query);
    const rows = objectList(response);
    result.push(...rows);
    if (response.has_more !== true || rows.length === 0) return result;
    const next = rows.at(-1)?.id;
    if (typeof next !== "string") throw new Error("Stripe catalog pagination was invalid.");
    startingAfter = next;
  }
  throw new Error("Stripe catalog pagination exceeded its safety bound.");
}

function productId(value) {
  return typeof value === "string" && /^prod_[A-Za-z0-9]+$/.test(value) ? value : null;
}

function priceId(value) {
  return typeof value === "string" && /^price_[A-Za-z0-9]+$/.test(value) ? value : null;
}

function uuid(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${label} must be a UUID.`);
  }
  return value.toLowerCase();
}

function boundedInteger(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} is outside the reviewed test-only bounds.`);
  }
  return value;
}

function reviewedToken(value, pattern, maximum, label) {
  if (typeof value !== "string" || value.length > maximum || !pattern.test(value)) {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

export function normalizeStripeFixedTestPriceSpec(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("A fixed-price specification is required.");
  const productKey = value.productKey;
  if (!Object.hasOwn(FIXED_PRICE_PRODUCTS, productKey)) throw new Error("Product key is outside the fixed test-price allowlist.");
  const priceCode = reviewedToken(value.priceCode, /^[a-z][a-z0-9_]{2,120}$/, 121, "Price code");
  const amountMinor = boundedInteger(value.amountMinor, productKey === "sandbox_credits" ? 50 : 1, 100_000_000, "Amount");
  if (value.currency !== "usd") throw new Error("The initial fixed test-price tool supports USD only.");
  const disclosureVersion = reviewedToken(value.disclosureVersion, /^[A-Za-z0-9][A-Za-z0-9._:+-]{0,119}$/, 120, "Disclosure version");
  if (productKey === "sandbox_credits") {
    const packCode = reviewedToken(value.packCode, /^sandbox_test_[a-z0-9_]{3,80}$/, 93, "Sandbox pack code");
    if (!/^sandbox_test_[a-z0-9_]{3,100}_usd$/.test(priceCode)) throw new Error("Sandbox price code must use the reviewed sandbox test USD form.");
    return {
      productKey, priceCode, amountMinor, currency: "usd", disclosureVersion, packCode,
      grantedUnits: boundedInteger(value.grantedUnits, 1, 1_000_000_000, "Granted units"),
      expiresAfterDays: value.expiresAfterDays === null
        ? null
        : boundedInteger(value.expiresAfterDays, 1, 3_650, "Expiration days")
    };
  }
  if (value.packCode !== undefined || value.grantedUnits !== undefined || value.expiresAfterDays !== undefined) {
    throw new Error("Sandbox pack fields are not accepted for this product.");
  }
  return { productKey, priceCode, amountMinor, currency: "usd", disclosureVersion };
}

function assertFixedPriceTestRuntime({ apply, billingMode, stripeLiveEnabled }) {
  if (billingMode && billingMode !== "test" || stripeLiveEnabled === "true") {
    throw new Error("Fixed-price catalog setup refuses live or non-test configuration.");
  }
  if (apply && (billingMode !== "test" || stripeLiveEnabled !== "false")) {
    throw new Error("Applying a fixed price requires BILLING_MODE=test and STRIPE_LIVE_ENABLED=false.");
  }
}

export async function reconcileStripeFixedTestPrice({
  spec,
  secretKey = "",
  apiVersion = null,
  apply = false,
  confirmation = "",
  billingMode,
  stripeLiveEnabled,
  fetcher = fetch
}) {
  spec = normalizeStripeFixedTestPriceSpec(spec);
  assertFixedPriceTestRuntime({ apply, billingMode, stripeLiveEnabled });
  apiVersion = safeApiVersion(apiVersion);
  if (!apply) return { ...spec, action: "dry_run", testMode: true };
  assertTestSecret(secretKey);
  if (confirmation !== FIXED_PRICE_APPLY_CONFIRMATION) {
    throw new Error(`Refusing fixed-price mutation without --confirm=${FIXED_PRICE_APPLY_CONFIRMATION}.`);
  }
  const client = { secretKey, apiVersion, fetcher };
  const catalogCode = `fixed:${spec.productKey}:${spec.priceCode}`;
  const products = await listAll(client, "/v1/products?active=true");
  const productMatches = products.filter((product) => product.metadata?.elysia_fixed_price_code === catalogCode);
  if (productMatches.length > 1) throw new Error("Duplicate Stripe test products exist for this fixed price; reconcile manually.");
  const definition = FIXED_PRICE_PRODUCTS[spec.productKey];
  let product = productMatches[0] ?? null;
  let action = "reused";
  if (!product) {
    product = await requestStripe(client, "/v1/products", {
      method: "POST",
      idempotencyKey: `elysia-fixed-test-product:${spec.productKey}:${spec.priceCode}:v1`,
      body: form({
        name: definition.name,
        description: definition.description,
        "metadata[elysia_fixed_price_code]": catalogCode,
        "metadata[elysia_product_key]": spec.productKey,
        "metadata[elysia_price_code]": spec.priceCode,
        "metadata[elysia_environment]": "test"
      })
    });
    action = "created_product";
  }
  const resolvedProductId = productId(product.id);
  if (!resolvedProductId || product.livemode === true) throw new Error("Stripe returned a live or invalid fixed-price product.");
  const lookupKey = `elysia_test_${spec.productKey}_${spec.priceCode}_v1`;
  if (lookupKey.length > 200) throw new Error("Fixed-price lookup key exceeds the provider safety bound.");
  const prices = await listAll(client, `/v1/prices?active=true&product=${encodeURIComponent(resolvedProductId)}`);
  const priceMatches = prices.filter((price) => price.lookup_key === lookupKey);
  if (priceMatches.length > 1) throw new Error("Duplicate active Stripe test prices exist for this lookup key.");
  let price = priceMatches[0] ?? null;
  if (price) {
    if (price.unit_amount !== spec.amountMinor || price.currency !== spec.currency || price.recurring != null || price.livemode === true) {
      throw new Error("Existing Stripe price differs from the immutable reviewed definition; use a new reviewed price code.");
    }
  } else {
    price = await requestStripe(client, "/v1/prices", {
      method: "POST",
      idempotencyKey: `elysia-fixed-test-price:${spec.productKey}:${spec.priceCode}:v1`,
      body: form({
        product: resolvedProductId,
        currency: spec.currency,
        unit_amount: spec.amountMinor,
        lookup_key: lookupKey,
        "metadata[elysia_fixed_price_code]": catalogCode,
        "metadata[elysia_environment]": "test"
      })
    });
    action = action === "created_product" ? "created_product_and_price" : "created_price";
  }
  const resolvedPriceId = priceId(price.id);
  if (!resolvedPriceId || price.livemode === true) throw new Error("Stripe returned a live or invalid fixed price.");
  return {
    ...spec, action, testMode: true,
    testProductReference: resolvedProductId,
    testPriceReference: resolvedPriceId
  };
}

export async function reconcileStripeTestCatalog({
  secretKey,
  apiVersion = null,
  apply = false,
  confirmation = "",
  fetcher = fetch
}) {
  if (secretKey) assertTestSecret(secretKey);
  apiVersion = safeApiVersion(apiVersion);
  if (!apply) {
    return STRIPE_TEST_CATALOG.map((entry) => ({
      code: entry.code,
      productKey: entry.productKey,
      priceCode: entry.priceCode,
      action: "dry_run",
      testMode: true,
      amountMinor: entry.recurring?.amountMinor ?? null
    }));
  }
  assertTestSecret(secretKey);
  if (confirmation !== APPLY_CONFIRMATION) throw new Error(`Refusing catalog mutation without --confirm=${APPLY_CONFIRMATION}.`);
  const client = { secretKey, apiVersion, fetcher };
  const products = await listAll(client, "/v1/products?active=true");
  const summary = [];
  for (const entry of STRIPE_TEST_CATALOG) {
    const matches = products.filter((product) => product.metadata?.elysia_catalog_code === entry.code);
    if (matches.length > 1) throw new Error(`Duplicate Stripe test products exist for ${entry.code}; reconcile manually.`);
    let product = matches[0] ?? null;
    let action = "reused";
    if (!product) {
      product = await requestStripe(client, "/v1/products", {
        method: "POST",
        idempotencyKey: `elysia-test-product:${entry.code}:v1`,
        body: form({ name: entry.name, description: entry.description, "metadata[elysia_catalog_code]": entry.code, "metadata[elysia_environment]": "test" })
      });
      action = "created";
    } else if (product.name !== entry.name || product.description !== entry.description) {
      const id = productId(product.id);
      if (!id) throw new Error(`Stripe product reference was invalid for ${entry.code}.`);
      product = await requestStripe(client, `/v1/products/${id}`, {
        method: "POST",
        idempotencyKey: `elysia-test-product:${entry.code}:description-v2`,
        body: form({ name: entry.name, description: entry.description, "metadata[elysia_catalog_code]": entry.code, "metadata[elysia_environment]": "test" })
      });
      action = "updated";
    }
    const id = productId(product.id);
    if (!id || product.livemode === true) throw new Error(`Stripe returned a live or invalid product for ${entry.code}.`);
    let resolvedPriceId = null;
    if (entry.recurring) {
      const lookupKey = `elysia_${entry.code}_v1`;
      const prices = await listAll(client, `/v1/prices?active=true&product=${encodeURIComponent(id)}`);
      const lookupMatches = prices.filter((price) => price.lookup_key === lookupKey);
      if (lookupMatches.length > 1) throw new Error(`Duplicate active Stripe prices exist for ${lookupKey}.`);
      let price = lookupMatches[0] ?? null;
      if (price) {
        const matchesDefinition = price.unit_amount === entry.recurring.amountMinor
          && price.currency === entry.recurring.currency
          && price.recurring?.interval === entry.recurring.interval
          && price.livemode !== true;
        if (!matchesDefinition) throw new Error(`Existing Stripe price ${lookupKey} differs from the immutable catalog definition; create a reviewed v2 code.`);
      } else {
        price = await requestStripe(client, "/v1/prices", {
          method: "POST",
          idempotencyKey: `elysia-test-price:${entry.code}:v1`,
          body: form({
            product: id,
            currency: entry.recurring.currency,
            unit_amount: entry.recurring.amountMinor,
            "recurring[interval]": entry.recurring.interval,
            lookup_key: lookupKey,
            "metadata[elysia_catalog_code]": entry.code,
            "metadata[elysia_environment]": "test"
          })
        });
        action = action === "created" ? "created_product_and_price" : "created_price";
      }
      resolvedPriceId = priceId(price.id);
      if (!resolvedPriceId || price.livemode === true) throw new Error(`Stripe returned a live or invalid price for ${entry.code}.`);
    }
    summary.push({
      code: entry.code,
      productKey: entry.productKey,
      priceCode: entry.priceCode,
      action,
      testMode: true,
      testProductReference: id,
      testPriceReference: resolvedPriceId
    });
  }
  return summary;
}

function catalogRpcUrl(supabaseUrl) {
  let base;
  try { base = new URL(supabaseUrl); } catch { throw new Error("SUPABASE_URL is invalid."); }
  const loopback = base.hostname === "localhost" || base.hostname === "127.0.0.1" || base.hostname === "::1";
  const hostedSupabase = /^[a-z0-9-]+\.supabase\.co$/i.test(base.hostname);
  if (
    (base.protocol !== "https:" && !(base.protocol === "http:" && loopback))
    || (!loopback && !hostedSupabase)
    || base.username || base.password
    || (base.pathname !== "/" && base.pathname !== "") || base.search || base.hash
  ) {
    throw new Error("SUPABASE_URL must be a canonical hosted Supabase HTTPS origin or loopback HTTP origin.");
  }
  return new URL("/rest/v1/rpc/record_economic_test_catalog_reference", base);
}

function assertServiceRoleKey(serviceRoleKey) {
  if (
    typeof serviceRoleKey !== "string"
    || serviceRoleKey.length < 20
    || serviceRoleKey.length > 4_096
    || /[\r\n]/.test(serviceRoleKey)
    || /(replace|placeholder|changeme|enter[_ -]?directly)/i.test(serviceRoleKey)
  ) throw new Error("A server-only Supabase service-role key is required for catalog recording.");
}

async function recordCatalogRow({ rpcUrl, serviceRoleKey, fetcher }, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response;
  try {
    response = await fetcher(rpcUrl, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body),
      redirect: "error",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
  const responseText = await response.text();
  if (new TextEncoder().encode(responseText).byteLength > 65_536) {
    throw new Error("Supabase catalog-recording response was oversized.");
  }
  if (!response.ok) throw new Error(`Supabase catalog recording failed safely (${response.status}).`);
}

export async function recordStripeTestCatalogReferences({
  supabaseUrl,
  serviceRoleKey,
  catalogSummary,
  confirmation = "",
  fetcher = fetch
}) {
  if (confirmation !== RECORD_CONFIRMATION) {
    throw new Error(`Refusing Supabase catalog recording without --record-confirm=${RECORD_CONFIRMATION}.`);
  }
  assertServiceRoleKey(serviceRoleKey);
  const rpcUrl = catalogRpcUrl(supabaseUrl);
  if (!Array.isArray(catalogSummary) || catalogSummary.length !== STRIPE_TEST_CATALOG.length) {
    throw new Error("Stripe test catalog summary is incomplete; no references were recorded.");
  }
  const recorded = [];
  for (const expected of STRIPE_TEST_CATALOG) {
    const matches = catalogSummary.filter((entry) => entry?.code === expected.code);
    if (matches.length !== 1) throw new Error(`Stripe test catalog result is ambiguous for ${expected.code}.`);
    const resolved = matches[0];
    if (resolved.testMode !== true) throw new Error(`A non-test catalog result was refused for ${expected.code}.`);
    const providerProductId = productId(resolved.testProductReference);
    const providerPriceId = priceId(resolved.testPriceReference);
    if (!providerProductId || (expected.priceCode ? !providerPriceId : resolved.testPriceReference !== null)) {
      throw new Error(`Stripe test catalog references are invalid for ${expected.code}.`);
    }
    await recordCatalogRow({ rpcUrl, serviceRoleKey, fetcher }, {
      p_product_key: expected.productKey,
      p_price_code: expected.priceCode,
      p_provider: "stripe",
      p_provider_product_id: providerProductId,
      p_provider_price_id: providerPriceId
    });
    recorded.push({ productKey: expected.productKey, priceCode: expected.priceCode, provider: "stripe", recorded: true });
  }
  return recorded;
}

function assertPrivateConfigurationReason(value) {
  if (
    typeof value !== "string" || value !== value.trim() || value.length < 8 || value.length > 1_000
    || /[\r\n]/.test(value)
  ) throw new Error("A private fixed-price configuration reason of 8-1000 single-line characters is required in the server environment.");
  return value;
}

async function postCatalogConfigurationRpc({ url, serviceRoleKey, body, fetcher }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response;
  try {
    response = await fetcher(url, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body),
      redirect: "error",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
  const responseText = await response.text();
  if (new TextEncoder().encode(responseText).byteLength > 65_536) throw new Error("Supabase fixed-price response was oversized.");
  if (!response.ok) throw new Error(`Supabase fixed-price configuration failed safely (${response.status}).`);
  try { return JSON.parse(responseText); }
  catch { throw new Error("Supabase fixed-price configuration returned invalid JSON."); }
}

export async function configureStripeFixedTestPriceInSupabase({
  catalogResult,
  actorUserId = "",
  clientRequestId = "",
  reason = "",
  confirmation = "",
  billingMode,
  stripeLiveEnabled,
  supabaseUrl = "",
  serviceRoleKey = "",
  fetcher = fetch
}) {
  assertFixedPriceTestRuntime({ apply: true, billingMode, stripeLiveEnabled });
  if (confirmation !== FIXED_PRICE_DATABASE_CONFIRMATION) {
    throw new Error(`Refusing database configuration without --database-confirm=${FIXED_PRICE_DATABASE_CONFIRMATION}.`);
  }
  const spec = normalizeStripeFixedTestPriceSpec(catalogResult);
  if (catalogResult?.testMode !== true) throw new Error("A non-test fixed-price result was refused.");
  const providerProductId = productId(catalogResult.testProductReference);
  const providerPriceId = priceId(catalogResult.testPriceReference);
  if (!providerProductId || !providerPriceId) throw new Error("Fixed test provider references are missing or invalid.");
  assertServiceRoleKey(serviceRoleKey);
  reason = assertPrivateConfigurationReason(reason);
  const recordUrl = catalogRpcUrl(supabaseUrl);
  const configureUrl = new URL(recordUrl);
  let configureBody;
  let expectedResultKeys;
  if (spec.productKey === "sandbox_credits") {
    configureUrl.pathname = "/rest/v1/rpc/configure_sandbox_test_credit_pack";
    configureBody = {
      p_pack_code: spec.packCode,
      p_price_code: spec.priceCode,
      p_amount_minor: spec.amountMinor,
      p_currency: spec.currency,
      p_granted_units: spec.grantedUnits,
      p_expires_after_days: spec.expiresAfterDays,
      p_disclosure_version: spec.disclosureVersion,
      p_confirmation: "CONFIGURE UNAPPROVED SANDBOX TEST PACK",
      p_reason: reason
    };
    expectedResultKeys = ["packVersionId", "packCode", "priceCode", "amountMinor", "currency", "grantedUnits", "expiresAfterDays", "approvedForLiveUse", "testMode"];
  } else {
    actorUserId = uuid(actorUserId, "Actor user ID");
    clientRequestId = uuid(clientRequestId, "Client request ID");
    configureUrl.pathname = "/rest/v1/rpc/configure_economic_test_price";
    configureBody = {
      p_actor_user_id: actorUserId,
      p_price_code: spec.priceCode,
      p_product_key: spec.productKey,
      p_amount_minor: spec.amountMinor,
      p_currency: spec.currency,
      p_disclosure_version: spec.disclosureVersion,
      p_client_request_id: clientRequestId,
      p_reason: reason
    };
    expectedResultKeys = ["priceCode", "productKey", "amountMinor", "currency", "disclosureVersion", "testMode", "idempotentReplay"];
  }
  const configured = await postCatalogConfigurationRpc({
    url: configureUrl, serviceRoleKey, body: configureBody, fetcher
  });
  if (!configured || typeof configured !== "object" || Array.isArray(configured)
    || Object.keys(configured).sort().join(",") !== [...expectedResultKeys].sort().join(",")
    || configured.priceCode !== spec.priceCode || configured.amountMinor !== spec.amountMinor
    || configured.currency !== spec.currency || configured.testMode !== true
    || (spec.productKey === "sandbox_credits" && (
      configured.packCode !== spec.packCode || configured.grantedUnits !== spec.grantedUnits
      || configured.expiresAfterDays !== spec.expiresAfterDays || configured.approvedForLiveUse !== false
    ))
    || (spec.productKey !== "sandbox_credits" && (
      configured.productKey !== spec.productKey || configured.disclosureVersion !== spec.disclosureVersion
      || typeof configured.idempotentReplay !== "boolean"
    ))) {
    throw new Error("Supabase fixed-price configuration returned an unexpected response shape.");
  }
  await recordCatalogRow({ rpcUrl: recordUrl, serviceRoleKey, fetcher }, {
    p_product_key: spec.productKey,
    p_price_code: spec.priceCode,
    p_provider: "stripe",
    p_provider_product_id: providerProductId,
    p_provider_price_id: providerPriceId
  });
  return {
    productKey: spec.productKey,
    priceCode: spec.priceCode,
    configured: true,
    providerReferencesRecorded: true,
    approvedForLiveUse: false,
    testMode: true,
    idempotentReplay: spec.productKey === "sandbox_credits" ? null : configured.idempotentReplay
  };
}

export function normalizeRecurringSupportSandboxProgramSpec(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("A recurring sandbox program specification is required.");
  const programCode = reviewedToken(value.programCode, /^sandbox_test_[a-z0-9_]{3,80}$/, 93, "Sandbox program code");
  const sourcePriceCode = reviewedToken(value.sourcePriceCode, /^[a-z][a-z0-9_]{2,120}$/, 121, "Source price code");
  const reviewedRecurringPrices = STRIPE_TEST_CATALOG.filter((entry) => entry.productKey === "support_recurring").map((entry) => entry.priceCode);
  if (!reviewedRecurringPrices.includes(sourcePriceCode)) throw new Error("Source price code is outside the reviewed recurring-support catalog.");
  return {
    programCode,
    sourceCategory: "recurring_support",
    sourcePriceCode,
    grantedUnits: boundedInteger(value.grantedUnits, 1, 1_000_000_000, "Granted units"),
    expiresAfterDays: value.expiresAfterDays === null
      ? null
      : boundedInteger(value.expiresAfterDays, 1, 3_650, "Expiration days"),
    oneTimePerUser: false,
    active: false
  };
}

export async function configureRecurringSupportSandboxProgramInSupabase({
  spec,
  reason = "",
  confirmation = "",
  billingMode,
  stripeLiveEnabled,
  supabaseUrl = "",
  serviceRoleKey = "",
  fetcher = fetch
}) {
  assertFixedPriceTestRuntime({ apply: true, billingMode, stripeLiveEnabled });
  if (confirmation !== RECURRING_SANDBOX_PROGRAM_CONFIRMATION) {
    throw new Error(`Refusing recurring sandbox program configuration without --confirm=${RECURRING_SANDBOX_PROGRAM_CONFIRMATION}.`);
  }
  spec = normalizeRecurringSupportSandboxProgramSpec(spec);
  reason = assertPrivateConfigurationReason(reason);
  assertServiceRoleKey(serviceRoleKey);
  const url = catalogRpcUrl(supabaseUrl);
  url.pathname = "/rest/v1/rpc/configure_sandbox_test_credit_program";
  const configured = await postCatalogConfigurationRpc({
    url, serviceRoleKey, fetcher,
    body: {
      p_program_code: spec.programCode,
      p_source_category: spec.sourceCategory,
      p_source_price_code: spec.sourcePriceCode,
      p_granted_units: spec.grantedUnits,
      p_expires_after_days: spec.expiresAfterDays,
      p_one_time_per_user: false,
      p_active: false,
      p_confirmation: "CONFIGURE UNAPPROVED SANDBOX TEST PROGRAM",
      p_reason: reason
    }
  });
  const expectedKeys = ["programVersionId", "programCode", "sourceCategory", "sourcePriceCode", "grantedUnits", "expiresAfterDays", "oneTimePerUser", "active", "approvedForLiveUse", "testMode"];
  if (!configured || typeof configured !== "object" || Array.isArray(configured)
    || Object.keys(configured).sort().join(",") !== expectedKeys.sort().join(",")
    || typeof configured.programVersionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(configured.programVersionId)
    || configured.programCode !== spec.programCode || configured.sourceCategory !== "recurring_support"
    || configured.sourcePriceCode !== spec.sourcePriceCode || configured.grantedUnits !== spec.grantedUnits
    || configured.expiresAfterDays !== spec.expiresAfterDays || configured.oneTimePerUser !== false
    || configured.active !== false || configured.approvedForLiveUse !== false || configured.testMode !== true) {
    throw new Error("Recurring sandbox program configuration returned an unexpected response shape.");
  }
  return {
    programCode: spec.programCode,
    sourceCategory: "recurring_support",
    sourcePriceCode: spec.sourcePriceCode,
    grantedUnits: spec.grantedUnits,
    expiresAfterDays: spec.expiresAfterDays,
    active: false,
    approvedForLiveUse: false,
    testMode: true
  };
}

export async function setRecurringSupportSandboxProgramStatus({
  programCode,
  actorUserId,
  clientRequestId,
  active,
  benefitReviewConfirmed = false,
  reason = "",
  confirmation = "",
  billingMode,
  stripeLiveEnabled,
  supabaseUrl = "",
  serviceRoleKey = "",
  fetcher = fetch
}) {
  assertFixedPriceTestRuntime({ apply: true, billingMode, stripeLiveEnabled });
  programCode = reviewedToken(programCode, /^sandbox_test_[a-z0-9_]{3,80}$/, 93, "Sandbox program code");
  actorUserId = uuid(actorUserId, "Actor user ID");
  clientRequestId = uuid(clientRequestId, "Client request ID");
  if (typeof active !== "boolean") throw new Error("Sandbox program status requires exactly one of enable or disable.");
  if (active && benefitReviewConfirmed !== true) {
    throw new Error("Recurring sandbox credit activation is blocked until reviewed recurring terms and UI disclose the exact units and expiry.");
  }
  const requiredConfirmation = active ? ACTIVATE_SANDBOX_TEST_PROGRAM_CONFIRMATION : DEACTIVATE_SANDBOX_TEST_PROGRAM_CONFIRMATION;
  if (confirmation !== requiredConfirmation) throw new Error(`Refusing sandbox program status change without --confirm=${requiredConfirmation}.`);
  reason = assertPrivateConfigurationReason(reason);
  assertServiceRoleKey(serviceRoleKey);
  const url = catalogRpcUrl(supabaseUrl);
  url.pathname = "/rest/v1/rpc/set_sandbox_test_credit_program_status";
  const result = await postCatalogConfigurationRpc({
    url, serviceRoleKey, fetcher,
    body: {
      p_actor_user_id: actorUserId,
      p_client_request_id: clientRequestId,
      p_program_code: programCode,
      p_active: active,
      p_confirmation: requiredConfirmation,
      p_reason: reason
    }
  });
  const expectedKeys = ["programVersionId", "programCode", "sourceCategory", "active", "approvedForLiveUse", "testMode", "authorityChanged", "idempotentReplay"];
  if (!result || typeof result !== "object" || Array.isArray(result)
    || Object.keys(result).sort().join(",") !== expectedKeys.sort().join(",")
    || typeof result.programVersionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.programVersionId)
    || result.programCode !== programCode || result.sourceCategory !== "recurring_support"
    || result.active !== active || result.approvedForLiveUse !== false || result.testMode !== true
    || result.authorityChanged !== false || typeof result.idempotentReplay !== "boolean") {
    throw new Error("Sandbox program status change returned an unexpected response shape.");
  }
  return {
    programCode, sourceCategory: "recurring_support", active,
    approvedForLiveUse: false, authorityChanged: false,
    idempotentReplay: result.idempotentReplay, testMode: true
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const apply = process.argv.includes("--apply");
  const recordSupabase = process.argv.includes("--record-supabase");
  const confirmArg = process.argv.find((arg) => arg.startsWith("--confirm="));
  const recordConfirmArg = process.argv.find((arg) => arg.startsWith("--record-confirm="));
  const secretKey = process.env.STRIPE_SECRET_KEY_TEST ?? "";
  reconcileStripeTestCatalog({
    secretKey,
    apiVersion: process.env.STRIPE_API_VERSION ?? null,
    apply,
    confirmation: confirmArg?.slice("--confirm=".length) ?? ""
  }).then(async (summary) => {
    if (recordSupabase && !apply) throw new Error("Supabase catalog recording requires the explicit Stripe --apply pass.");
    const recorded = recordSupabase
      ? await recordStripeTestCatalogReferences({
          supabaseUrl: process.env.SUPABASE_URL ?? "",
          serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
          catalogSummary: summary,
          confirmation: recordConfirmArg?.slice("--record-confirm=".length) ?? ""
        })
      : [];
    console.log(JSON.stringify({ mode: "stripe_test_only", applied: apply, referencesRecorded: recordSupabase, catalog: summary, recorded }, null, 2));
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : "Stripe test catalog reconciliation failed safely.");
    process.exitCode = 1;
  });
}
