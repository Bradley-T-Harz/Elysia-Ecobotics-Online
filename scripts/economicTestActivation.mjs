const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FEATURE_KEY_PATTERN = /^[a-z][a-z0-9_]{2,80}$/;
const MAX_RESPONSE_BYTES = 65_536;
const REQUEST_TIMEOUT_MS = 15_000;

export const ECONOMIC_OPERATOR_BOOTSTRAP_CONFIRMATION =
  "ELYSIA-ECONOMIC-OPERATOR-BOOTSTRAP-TEST-ONLY";
export const ENABLE_TEST_ECONOMIC_FEATURE_CONFIRMATION =
  "ENABLE TEST ECONOMIC FEATURE";
export const DISABLE_TEST_ECONOMIC_FEATURE_CONFIRMATION =
  "DISABLE TEST ECONOMIC FEATURE";

// This is intentionally an exact repository-reviewed list. `live_stripe` and
// `marketplace_payouts` are absent because this release may activate neither
// live money movement nor a provider payout execution path it does not have.
export const REVIEWED_TEST_ECONOMIC_FEATURE_KEYS = Object.freeze([
  "support_checkout",
  "recurring_support",
  "economic_webhooks",
  "test_refund_execution",
  "customer_portal",
  "sandbox_credit_purchase",
  "sandbox_credit_display",
  "sandbox_credit_enforcement",
  "job_post_fee_enforcement",
  "marketplace_paid_offers",
  "marketplace_seller_onboarding",
  "marketplace_payout_preparation",
  "organization_contract_workflow",
  "organization_billing",
  "sponsorship_review_workflow",
  "sponsorship_checkout",
  "sponsorship_display",
  "economic_assistance_workflow",
  "public_support_recognition"
]);

function assertUuid(value, label) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new Error(`${label} must be a UUID.`);
  }
  return value.toLowerCase();
}

function assertPrivateReason(value) {
  if (
    typeof value !== "string"
    || value !== value.trim()
    || value.length < 8
    || value.length > 1_000
    || /[\r\n]/.test(value)
  ) {
    throw new Error("A private activation reason of 8-1000 single-line characters is required in the server environment.");
  }
  return value;
}

function assertTestOnlyRuntime({ apply, billingMode, stripeLiveEnabled }) {
  if (stripeLiveEnabled === "true" || (billingMode && billingMode !== "test")) {
    throw new Error("Economic activation refuses live or non-test configuration, including dry runs.");
  }
  if (apply && (billingMode !== "test" || stripeLiveEnabled !== "false")) {
    throw new Error("Applying economic activation requires BILLING_MODE=test and STRIPE_LIVE_ENABLED=false.");
  }
}

function rpcUrl(supabaseUrl, functionName) {
  let base;
  try {
    base = new URL(supabaseUrl);
  } catch {
    throw new Error("SUPABASE_URL is invalid.");
  }
  const loopback = base.hostname === "localhost" || base.hostname === "127.0.0.1" || base.hostname === "::1";
  const hostedSupabase = /^[a-z0-9-]+\.supabase\.co$/i.test(base.hostname);
  const safeProtocol = base.protocol === "https:" || (loopback && base.protocol === "http:");
  if (
    !safeProtocol
    || (!loopback && !hostedSupabase)
    || base.username
    || base.password
    || (base.pathname !== "/" && base.pathname !== "")
    || base.search
    || base.hash
  ) {
    throw new Error("SUPABASE_URL must be a canonical hosted Supabase HTTPS origin or loopback HTTP origin.");
  }
  return new URL(`/rest/v1/rpc/${functionName}`, base);
}

function assertServiceRoleKey(value) {
  if (
    typeof value !== "string"
    || value.length < 20
    || value.length > 4_096
    || /[\r\n]/.test(value)
    || /(replace|placeholder|changeme|enter[_ -]?directly)/i.test(value)
  ) {
    throw new Error("A server-only Supabase service-role key is required for an apply operation.");
  }
  return value;
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
}

async function postRpc({ url, serviceRoleKey, body, fetcher }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
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
  if (new TextEncoder().encode(responseText).byteLength > MAX_RESPONSE_BYTES) {
    throw new Error("Economic activation response was oversized.");
  }
  if (!response.ok) {
    // The response body can contain private database detail. Do not print it.
    throw new Error(`Economic activation failed safely (${response.status}).`);
  }
  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error("Economic activation returned invalid JSON.");
  }
}

function validateBootstrapResult(value, actorUserId) {
  const expected = ["assignmentId", "userId", "capability", "active", "testMode"];
  if (
    !exactKeys(value, expected)
    || !UUID_PATTERN.test(value.assignmentId)
    || value.userId !== actorUserId
    || value.capability !== "economic_operator_assignments_manage"
    || value.active !== true
    || value.testMode !== true
  ) {
    throw new Error("Economic operator bootstrap returned an unexpected response shape.");
  }
  return value;
}

function validateFeatureResult(value, featureKey, enabled) {
  const expected = ["featureKey", "enabled", "testModeOnly", "idempotentReplay"];
  if (
    !exactKeys(value, expected)
    || value.featureKey !== featureKey
    || value.enabled !== enabled
    || value.testModeOnly !== true
    || typeof value.idempotentReplay !== "boolean"
  ) {
    throw new Error("Economic feature activation returned an unexpected response shape.");
  }
  return value;
}

export async function bootstrapEconomicOperator({
  actorUserId,
  reason = "",
  apply = false,
  confirmation = "",
  billingMode,
  stripeLiveEnabled,
  supabaseUrl = "",
  serviceRoleKey = "",
  fetcher = fetch
}) {
  assertTestOnlyRuntime({ apply, billingMode, stripeLiveEnabled });
  actorUserId = assertUuid(actorUserId, "Actor user ID");
  if (!apply) {
    return {
      action: "bootstrap_economic_operator",
      apply: false,
      testMode: true,
      browserAccessible: false
    };
  }
  if (confirmation !== ECONOMIC_OPERATOR_BOOTSTRAP_CONFIRMATION) {
    throw new Error(`Refusing operator bootstrap without --confirm=${ECONOMIC_OPERATOR_BOOTSTRAP_CONFIRMATION}.`);
  }
  reason = assertPrivateReason(reason);
  const url = rpcUrl(supabaseUrl, "bootstrap_economic_operator");
  serviceRoleKey = assertServiceRoleKey(serviceRoleKey);
  const result = await postRpc({
    url,
    serviceRoleKey,
    fetcher,
    body: { p_actor_user_id: actorUserId, p_reason: reason }
  });
  return validateBootstrapResult(result, actorUserId);
}

export async function setEconomicTestFeature({
  actorUserId,
  clientRequestId,
  featureKey,
  enabled,
  reason = "",
  apply = false,
  confirmation = "",
  billingMode,
  stripeLiveEnabled,
  supabaseUrl = "",
  serviceRoleKey = "",
  fetcher = fetch
}) {
  assertTestOnlyRuntime({ apply, billingMode, stripeLiveEnabled });
  actorUserId = assertUuid(actorUserId, "Actor user ID");
  if (typeof featureKey !== "string" || !FEATURE_KEY_PATTERN.test(featureKey) || !REVIEWED_TEST_ECONOMIC_FEATURE_KEYS.includes(featureKey)) {
    throw new Error("Feature key is not in the repository-reviewed test-only allowlist.");
  }
  if (typeof enabled !== "boolean") throw new Error("Feature activation requires exactly one of --enable or --disable.");
  const requiredConfirmation = enabled
    ? ENABLE_TEST_ECONOMIC_FEATURE_CONFIRMATION
    : DISABLE_TEST_ECONOMIC_FEATURE_CONFIRMATION;
  if (!apply) {
    return {
      action: "set_economic_test_feature",
      apply: false,
      featureKey,
      enabled,
      testModeOnly: true,
      browserAccessible: false
    };
  }
  clientRequestId = assertUuid(clientRequestId, "Client request ID");
  if (confirmation !== requiredConfirmation) {
    throw new Error(`Refusing feature mutation without --confirm=${requiredConfirmation}.`);
  }
  reason = assertPrivateReason(reason);
  const url = rpcUrl(supabaseUrl, "set_economic_test_feature");
  serviceRoleKey = assertServiceRoleKey(serviceRoleKey);
  const result = await postRpc({
    url,
    serviceRoleKey,
    fetcher,
    body: {
      p_actor_user_id: actorUserId,
      p_client_request_id: clientRequestId,
      p_feature_key: featureKey,
      p_enabled: enabled,
      p_confirmation: requiredConfirmation,
      p_reason: reason
    }
  });
  return validateFeatureResult(result, featureKey, enabled);
}

export function safeActivationCliOutput(action, result, apply) {
  if (action === "bootstrap") {
    return {
      mode: "test_only",
      action: "bootstrap_economic_operator",
      applied: apply,
      completed: apply ? result.active === true && result.testMode === true : false,
      capability: apply ? result.capability : undefined,
      browserAccessible: false
    };
  }
  return {
    mode: "test_only",
    action: "set_economic_test_feature",
    applied: apply,
    completed: apply,
    featureKey: result.featureKey,
    enabled: result.enabled,
    idempotentReplay: apply ? result.idempotentReplay : undefined,
    browserAccessible: false
  };
}

function readArg(args, name) {
  const prefix = `${name}=`;
  const matches = args.filter((arg) => arg.startsWith(prefix));
  if (matches.length > 1) throw new Error(`Duplicate ${name} argument.`);
  return matches[0]?.slice(prefix.length) ?? "";
}

function parseCli(argv) {
  const [action, ...args] = argv;
  if (!['bootstrap', 'feature'].includes(action)) {
    throw new Error("Usage: economic:test-activation <bootstrap|feature> [reviewed options].");
  }
  const valueNames = ["--actor", "--feature", "--request-id", "--confirm"];
  const booleans = ["--apply", "--enable", "--disable"];
  for (const arg of args) {
    if (!booleans.includes(arg) && !valueNames.some((name) => arg.startsWith(`${name}=`))) {
      throw new Error(`Unknown activation argument: ${arg}`);
    }
  }
  for (const booleanArg of booleans) {
    if (args.filter((arg) => arg === booleanArg).length > 1) throw new Error(`Duplicate ${booleanArg} argument.`);
  }
  const enable = args.includes("--enable");
  const disable = args.includes("--disable");
  if (action === "feature" && enable === disable) {
    throw new Error("Feature activation requires exactly one of --enable or --disable.");
  }
  return {
    action,
    apply: args.includes("--apply"),
    actorUserId: readArg(args, "--actor"),
    featureKey: readArg(args, "--feature"),
    clientRequestId: readArg(args, "--request-id"),
    confirmation: readArg(args, "--confirm"),
    enabled: enable
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  Promise.resolve().then(async () => {
    const options = parseCli(process.argv.slice(2));
    const common = {
      actorUserId: options.actorUserId,
      apply: options.apply,
      confirmation: options.confirmation,
      billingMode: process.env.BILLING_MODE,
      stripeLiveEnabled: process.env.STRIPE_LIVE_ENABLED,
      supabaseUrl: process.env.SUPABASE_URL ?? "",
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
    };
    const result = options.action === "bootstrap"
      ? await bootstrapEconomicOperator({
          ...common,
          reason: process.env.ECONOMIC_OPERATOR_BOOTSTRAP_REASON ?? ""
        })
      : await setEconomicTestFeature({
          ...common,
          clientRequestId: options.clientRequestId,
          featureKey: options.featureKey,
          enabled: options.enabled,
          reason: process.env.ECONOMIC_FEATURE_CHANGE_REASON ?? ""
        });
    console.log(JSON.stringify(safeActivationCliOutput(options.action, result, options.apply), null, 2));
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : "Economic activation failed safely.");
    process.exitCode = 1;
  });
}
