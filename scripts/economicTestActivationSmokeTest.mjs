import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  bootstrapEconomicOperator,
  DISABLE_TEST_ECONOMIC_FEATURE_CONFIRMATION,
  ECONOMIC_OPERATOR_BOOTSTRAP_CONFIRMATION,
  ENABLE_TEST_ECONOMIC_FEATURE_CONFIRMATION,
  REVIEWED_TEST_ECONOMIC_FEATURE_KEYS,
  safeActivationCliOutput,
  setEconomicTestFeature
} from "./economicTestActivation.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function rejects(operation, pattern, message) {
  let matched = false;
  try {
    await operation();
  } catch (error) {
    matched = pattern.test(String(error));
  }
  assert(matched, message);
}

const actorUserId = "11111111-1111-4111-8111-111111111111";
const assignmentId = "22222222-2222-4222-8222-222222222222";
const clientRequestId = "33333333-3333-4333-8333-333333333333";
const serviceRoleKey = "synthetic-service-role-key-never-log-this-value";
const bootstrapReason = "Independent dual-admin review completed for first test operator.";
const featureReason = "Reviewed test webhook endpoint and rollback path are confirmed.";
const supabaseUrl = "https://fixture-project.supabase.co";
const runtime = { billingMode: "test", stripeLiveEnabled: "false" };

let calls = 0;
const dryBootstrap = await bootstrapEconomicOperator({
  actorUserId,
  apply: false,
  billingMode: undefined,
  stripeLiveEnabled: undefined,
  fetcher: async () => { calls += 1; throw new Error("dry run must not fetch"); }
});
assert(calls === 0 && dryBootstrap.apply === false && dryBootstrap.browserAccessible === false, "Bootstrap dry run used the network or implied browser access.");

const dryFeature = await setEconomicTestFeature({
  actorUserId,
  featureKey: "economic_webhooks",
  enabled: true,
  apply: false,
  fetcher: async () => { calls += 1; throw new Error("dry run must not fetch"); }
});
assert(calls === 0 && dryFeature.featureKey === "economic_webhooks" && dryFeature.testModeOnly === true, "Feature dry run used the network or lost its test-only boundary.");

await rejects(
  () => bootstrapEconomicOperator({ actorUserId, apply: false, billingMode: "live", stripeLiveEnabled: "false" }),
  /refuses live or non-test/i,
  "Bootstrap dry run accepted a live billing mode."
);
await rejects(
  () => setEconomicTestFeature({ actorUserId, featureKey: "economic_webhooks", enabled: true, apply: false, billingMode: "test", stripeLiveEnabled: "true" }),
  /refuses live or non-test/i,
  "Feature dry run accepted live Stripe activation."
);
await rejects(
  () => bootstrapEconomicOperator({ actorUserId: "not-a-user", apply: false }),
  /UUID/i,
  "Bootstrap accepted an invalid actor UUID."
);
await rejects(
  () => setEconomicTestFeature({ actorUserId, featureKey: "live_stripe", enabled: true, apply: false }),
  /allowlist/i,
  "Feature tool exposed live Stripe activation."
);
await rejects(
  () => setEconomicTestFeature({ actorUserId, featureKey: "unreviewed_new_flag", enabled: true, apply: false }),
  /allowlist/i,
  "Feature tool accepted a flag outside the reviewed repository allowlist."
);
assert(!REVIEWED_TEST_ECONOMIC_FEATURE_KEYS.includes("live_stripe"), "The reviewed CLI feature allowlist contains live_stripe.");
assert(
  ["organization_contract_workflow", "sponsorship_review_workflow", "sponsorship_checkout", "economic_assistance_workflow"]
    .every((feature) => REVIEWED_TEST_ECONOMIC_FEATURE_KEYS.includes(feature)),
  "The reviewed CLI feature allowlist cannot activate the prerequisite workflows."
);
assert(
  !REVIEWED_TEST_ECONOMIC_FEATURE_KEYS.includes("marketplace_payouts"),
  "Activation CLI implies provider payout execution that this repository does not implement."
);

await rejects(
  () => bootstrapEconomicOperator({
    actorUserId,
    reason: bootstrapReason,
    apply: true,
    confirmation: "wrong",
    ...runtime,
    supabaseUrl,
    serviceRoleKey,
    fetcher: async () => { calls += 1; throw new Error("must not fetch"); }
  }),
  /Refusing operator bootstrap/,
  "Bootstrap applied without its exact independent confirmation."
);
await rejects(
  () => bootstrapEconomicOperator({
    actorUserId,
    reason: bootstrapReason,
    apply: true,
    confirmation: ECONOMIC_OPERATOR_BOOTSTRAP_CONFIRMATION,
    ...runtime,
    supabaseUrl: "https://attacker.example",
    serviceRoleKey,
    fetcher: async () => { calls += 1; throw new Error("must not fetch"); }
  }),
  /canonical hosted Supabase/i,
  "Bootstrap would send a service-role key to an arbitrary HTTPS origin."
);
await rejects(
  () => bootstrapEconomicOperator({
    actorUserId,
    reason: bootstrapReason,
    apply: true,
    confirmation: ECONOMIC_OPERATOR_BOOTSTRAP_CONFIRMATION,
    ...runtime,
    supabaseUrl,
    serviceRoleKey: "placeholder",
    fetcher: async () => { calls += 1; throw new Error("must not fetch"); }
  }),
  /service-role key/i,
  "Bootstrap accepted a placeholder service-role key."
);

let bootstrapRequest;
const bootstrapResult = await bootstrapEconomicOperator({
  actorUserId,
  reason: bootstrapReason,
  apply: true,
  confirmation: ECONOMIC_OPERATOR_BOOTSTRAP_CONFIRMATION,
  ...runtime,
  supabaseUrl,
  serviceRoleKey,
  fetcher: async (input, init) => {
    calls += 1;
    bootstrapRequest = { url: new URL(String(input)), init, headers: new Headers(init.headers), body: JSON.parse(init.body) };
    return new Response(JSON.stringify({
      assignmentId,
      userId: actorUserId,
      capability: "economic_operator_assignments_manage",
      active: true,
      testMode: true
    }), { status: 200 });
  }
});
assert(bootstrapRequest.url.origin === supabaseUrl && bootstrapRequest.url.pathname === "/rest/v1/rpc/bootstrap_economic_operator", "Bootstrap called an unexpected endpoint.");
assert(bootstrapRequest.init.method === "POST" && bootstrapRequest.init.redirect === "error", "Bootstrap RPC transport was not a bounded POST.");
assert(bootstrapRequest.headers.get("authorization") === `Bearer ${serviceRoleKey}` && bootstrapRequest.headers.get("apikey") === serviceRoleKey, "Bootstrap omitted server-only RPC authentication.");
assert(JSON.stringify(bootstrapRequest.body) === JSON.stringify({ p_actor_user_id: actorUserId, p_reason: bootstrapReason }), "Bootstrap request body drifted from its frozen database signature.");
assert(!bootstrapRequest.init.body.includes(serviceRoleKey), "Bootstrap placed its service-role key in the body.");
assert(bootstrapResult.assignmentId === assignmentId && bootstrapResult.testMode === true, "Bootstrap rejected or altered its frozen exact result.");

await rejects(
  () => bootstrapEconomicOperator({
    actorUserId,
    reason: bootstrapReason,
    apply: true,
    confirmation: ECONOMIC_OPERATOR_BOOTSTRAP_CONFIRMATION,
    ...runtime,
    supabaseUrl,
    serviceRoleKey,
    fetcher: async () => new Response(JSON.stringify({ ...bootstrapResult, providerReference: "must-not-pass" }), { status: 200 })
  }),
  /unexpected response shape/i,
  "Bootstrap accepted an extra provider/private response field."
);

let featureRequest;
const featureResult = await setEconomicTestFeature({
  actorUserId,
  clientRequestId,
  featureKey: "economic_webhooks",
  enabled: true,
  reason: featureReason,
  apply: true,
  confirmation: ENABLE_TEST_ECONOMIC_FEATURE_CONFIRMATION,
  ...runtime,
  supabaseUrl,
  serviceRoleKey,
  fetcher: async (input, init) => {
    featureRequest = { url: new URL(String(input)), init, headers: new Headers(init.headers), body: JSON.parse(init.body) };
    return new Response(JSON.stringify({
      featureKey: "economic_webhooks",
      enabled: true,
      testModeOnly: true,
      idempotentReplay: false
    }), { status: 200 });
  }
});
assert(featureRequest.url.pathname === "/rest/v1/rpc/set_economic_test_feature", "Feature tool called an unexpected endpoint.");
assert(JSON.stringify(featureRequest.body) === JSON.stringify({
  p_actor_user_id: actorUserId,
  p_client_request_id: clientRequestId,
  p_feature_key: "economic_webhooks",
  p_enabled: true,
  p_confirmation: ENABLE_TEST_ECONOMIC_FEATURE_CONFIRMATION,
  p_reason: featureReason
}), "Feature request body drifted from its frozen database signature.");
assert(featureResult.testModeOnly === true && featureResult.idempotentReplay === false, "Feature tool rejected or altered its frozen exact result.");

const disabledResult = await setEconomicTestFeature({
  actorUserId,
  clientRequestId: "44444444-4444-4444-8444-444444444444",
  featureKey: "support_checkout",
  enabled: false,
  reason: featureReason,
  apply: true,
  confirmation: DISABLE_TEST_ECONOMIC_FEATURE_CONFIRMATION,
  ...runtime,
  supabaseUrl,
  serviceRoleKey,
  fetcher: async (_input, init) => {
    const body = JSON.parse(init.body);
    assert(body.p_confirmation === DISABLE_TEST_ECONOMIC_FEATURE_CONFIRMATION && body.p_enabled === false, "Disable path did not use the database's exact confirmation.");
    return new Response(JSON.stringify({ featureKey: "support_checkout", enabled: false, testModeOnly: true, idempotentReplay: true }), { status: 200 });
  }
});
assert(disabledResult.idempotentReplay === true, "Feature idempotent replay result was not retained.");

const printed = JSON.stringify([
  safeActivationCliOutput("bootstrap", bootstrapResult, true),
  safeActivationCliOutput("feature", featureResult, true)
]);
assert(!printed.includes(serviceRoleKey) && !printed.includes(bootstrapReason) && !printed.includes(featureReason), "Safe CLI output exposed a credential or private reason.");
assert(!printed.includes(actorUserId) && !printed.includes(assignmentId), "Safe CLI output exposed private account or assignment identifiers.");

async function filesBelow(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesBelow(path));
    else result.push(path);
  }
  return result;
}
const billingRouteFiles = await filesBelow(fileURLToPath(new URL("../functions/api/billing", import.meta.url)));
for (const path of billingRouteFiles) {
  const source = await readFile(path, "utf8");
  assert(!source.includes("bootstrap_economic_operator"), "Operator bootstrap became browser-accessible through a billing route.");
  assert(!source.includes("set_economic_test_feature"), "Economic feature mutation became browser-accessible through a billing route.");
}
const toolSource = await readFile(new URL("./economicTestActivation.mjs", import.meta.url), "utf8");
assert(!toolSource.includes(".env.local") && !toolSource.includes("dotenv") && !toolSource.includes("readFile("), "Activation tool can load an environment file.");
const requiredBillingBindings = [
  "BILLING_ENABLED", "BILLING_SUPPORT_CHECKOUT_ENABLED", "BILLING_RECURRING_ENABLED",
  "BILLING_WEBHOOK_FULFILLMENT_ENABLED", "BILLING_NOTIFICATION_RETRY_ENABLED",
  "BILLING_PORTAL_ENABLED", "BILLING_SELLER_ONBOARDING_ENABLED",
  "BILLING_JOB_POST_FEES_ENABLED", "BILLING_SANDBOX_PURCHASES_ENABLED", "BILLING_MARKETPLACE_COMMERCE_ENABLED",
  "BILLING_MARKETPLACE_PAYOUT_PREPARATION_ENABLED", "BILLING_ORGANIZATION_SERVICES_ENABLED",
  "BILLING_SPONSORSHIP_ADMIN_ENABLED", "BILLING_SPONSORSHIP_CHECKOUT_ENABLED",
  "BILLING_SPONSORSHIP_RECOGNITION_ENABLED", "BILLING_ASSISTANCE_ADMIN_ENABLED",
  "BILLING_SUPPORT_RECOGNITION_ENABLED", "BILLING_ACCOUNT_LIFECYCLE_ENABLED",
  "BILLING_ACCOUNTING_EXPORT_ENABLED", "BILLING_TEST_REFUNDS_ENABLED",
  "BILLING_STAGING_ACCESS_CONFIRMED", "BILLING_EDGE_RATE_LIMIT_CONFIRMED", "BILLING_MODE",
  "BILLING_PUBLIC_ORIGIN", "STRIPE_CONNECT_ENABLED", "STRIPE_LIVE_ENABLED",
  "STRIPE_WEBHOOK_TOLERANCE_SECONDS", "STRIPE_API_VERSION", "STRIPE_WEBHOOK_API_VERSION",
  "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"
];
const [billingWranglerExample, billingDevVarsExample, runbook] = await Promise.all([
  readFile(new URL("../wrangler.billing.example.jsonc", import.meta.url), "utf8"),
  readFile(new URL("../.dev.vars.billing.example", import.meta.url), "utf8"),
  readFile(new URL("../docs/deployment/stripe-test-mode-economic-system.md", import.meta.url), "utf8")
]);
for (const binding of requiredBillingBindings) {
  assert(
    billingWranglerExample.includes(`"${binding}"`) && billingDevVarsExample.includes(binding),
    `Dedicated billing-Worker binding examples omitted ${binding}.`
  );
}
for (const binding of requiredBillingBindings.filter((name) => name.startsWith("BILLING_") && name !== "BILLING_PUBLIC_ORIGIN" && name !== "BILLING_MODE")) {
  assert(runbook.includes(`\`${binding}=false\``), `Economic runbook omitted the fail-closed ${binding} binding.`);
}
assert(runbook.includes("sponsorship_checkout") && runbook.includes("sponsorship_review_workflow"), "Economic runbook omitted the sponsorship checkout dependency sequence.");

console.log("Economic test activation smoke test ok.");
