import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { BillingHttpError } from "../functions/api/billing/_shared/http.ts";
import billingWorker, { BILLING_ROUTES, handleBillingScheduled } from "../services/billing-worker/worker.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = resolve(new URL("..", import.meta.url).pathname);
const billingFunctionsRoot = join(root, "functions", "api", "billing");

async function routeModules(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "_shared") result.push(...await routeModules(path));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      result.push(path);
    }
  }
  return result;
}

const expectedRoutes = (await routeModules(billingFunctionsRoot)).map((path) => {
  const modulePath = relative(billingFunctionsRoot, path).split(sep).join("/").replace(/\.ts$/, "");
  return `/api/billing/${modulePath}`;
}).sort();
const actualRoutes = Object.keys(BILLING_ROUTES).sort();
assert(
  JSON.stringify(actualRoutes) === JSON.stringify(expectedRoutes),
  "The dedicated billing Worker route manifest differs from the billing Function modules."
);
assert(actualRoutes.length === 60, "The dedicated billing Worker must expose the complete reviewed 60-route contract.");
assert(actualRoutes.every((path) => path.startsWith("/api/billing/") && !path.includes("/_shared/")), "Billing Worker route escaped its namespace.");

const [
  workerSource, pagesConfig, billingConfig, pagesRoutes, pagesDevVars, billingDevVars,
  billingRunbook, economicThreatModel, sandboxBoundary, sandboxRunbook
] = await Promise.all([
  readFile(join(root, "services", "billing-worker", "worker.ts"), "utf8"),
  readFile(join(root, "wrangler.example.jsonc"), "utf8"),
  readFile(join(root, "wrangler.billing.example.jsonc"), "utf8"),
  readFile(join(root, "public", "_routes.json"), "utf8"),
  readFile(join(root, ".dev.vars.example"), "utf8"),
  readFile(join(root, ".dev.vars.billing.example"), "utf8"),
  readFile(join(root, "docs", "deployment", "stripe-test-mode-economic-system.md"), "utf8"),
  readFile(join(root, "docs", "security", "economic-system-threat-model.md"), "utf8"),
  readFile(join(root, "docs", "security", "coding-cornucopia-sandbox-boundary.md"), "utf8"),
  readFile(join(root, "docs", "deployment", "governed-sandbox-deployment.md"), "utf8")
]);

assert(!workerSource.includes("/api/sandbox/") && !workerSource.includes("functions/api/sandbox") && !workerSource.includes("sandbox-runner"), "Billing Worker imports or dispatches sandbox execution code.");
assert(!/"(?:BILLING|STRIPE)_[A-Z0-9_]+"\s*:/.test(pagesConfig), "Pages/sandbox Wrangler config contains a billing or Stripe binding.");
assert(!/"SUPABASE_SERVICE_ROLE_KEY"\s*:/.test(pagesConfig), "Pages/sandbox Wrangler config contains a Supabase service-role binding.");
assert(!/^(?:BILLING|STRIPE)_[A-Z0-9_]+=/m.test(pagesDevVars), "Pages/sandbox local variables contain billing or Stripe values.");
assert(!/^SUPABASE_SERVICE_ROLE_KEY=/m.test(pagesDevVars), "Pages/sandbox local variables contain the service-role value.");
assert(!/"(?:SANDBOX|CLOUDFLARE_ACCESS)_[A-Z0-9_]+"\s*:/.test(billingConfig), "Billing Worker Wrangler config contains a sandbox or Access binding.");
assert(!/^(?:SANDBOX|CLOUDFLARE_ACCESS)_[A-Z0-9_]+=/m.test(billingDevVars), "Billing Worker local variables contain sandbox or Access values.");
assert(billingConfig.includes('"main": "services/billing-worker/worker.ts"'), "Dedicated billing Worker entry is missing.");
assert(
  !/"routes"\s*:/.test(billingConfig)
    && !/"triggers"\s*:/.test(billingConfig)
    && !billingConfig.includes("elysiaecobotics.com/api/billing/*")
    && billingConfig.includes('"workers_dev": false')
    && billingConfig.includes('"BILLING_PUBLIC_ORIGIN": "https://billing-test.example.invalid"'),
  "The checked-in billing example must remain unattached to production and use a non-routable test origin placeholder.",
);
assert(pagesRoutes.includes('"/api/sandbox/*"') && !pagesRoutes.includes('"/api/billing/*"'), "Pages Functions must own only the sandbox API namespace.");
assert(
  /`wrangler\.billing\.example\.jsonc` and `\.dev\.vars\.billing\.example` are the\s+billing-Worker examples/.test(billingRunbook)
    && /`wrangler\.example\.jsonc` and\s+`\.dev\.vars\.example` belong only to the website\/Pages and sandbox process/.test(billingRunbook)
    && billingRunbook.includes("billing_route_not_found")
    && billingRunbook.includes("verify route ownership")
    && /intentionally declares\s+no `routes`/.test(billingRunbook)
    && billingRunbook.includes("no scheduled trigger")
    && billingRunbook.includes("BILLING_NOTIFICATION_RETRY_ENABLED=false")
    && billingRunbook.includes("never merge `.dev.vars.billing` into `.dev.vars`"),
  "Billing runbook does not preserve the exact separate-config, route-ownership, or local-runtime boundary."
);
assert(
  economicThreatModel.includes("separate Cloudflare deployments")
    && economicThreatModel.includes("A binding configured on the wrong runtime is an exposure")
    && economicThreatModel.includes("do not fall through to Pages"),
  "Economic threat model does not treat route or binding misplacement as an exposure."
);
assert(
  sandboxBoundary.includes("website/Pages project owns this `/api/sandbox/*` boundary only")
    && sandboxBoundary.includes("separately deployed billing Worker with a disjoint binding set")
    && sandboxRunbook.includes("does not include `/api/billing/*`")
    && sandboxRunbook.includes("never configure `BILLING_*`, `STRIPE_*`"),
  "Sandbox documentation does not prohibit billing routes and credentials on Pages."
);

const unknown = await billingWorker.fetch(new Request("https://elysiaecobotics.com/api/billing/not-a-route"), {});
assert(unknown.status === 404, "Unknown billing Worker route did not fail closed.");
assert((await unknown.json()).error === "billing_route_not_found", "Unknown billing Worker route returned an unexpected body.");

let scheduledDeliveryCalls = 0;
const protectedTestEnv = {
  BILLING_MODE: "test",
  STRIPE_LIVE_ENABLED: "false",
  BILLING_STAGING_ACCESS_CONFIRMED: "true",
  BILLING_EDGE_RATE_LIMIT_CONFIRMED: "true",
  BILLING_WEBHOOK_FULFILLMENT_ENABLED: "true"
};
const disabledSchedule = await handleBillingScheduled(protectedTestEnv, {
  expire: async () => { scheduledDeliveryCalls += 1; throw new Error("disabled schedule must not expire"); },
  deliver: async () => { scheduledDeliveryCalls += 1; throw new Error("disabled schedule must not drain"); }
});
assert(disabledSchedule.enabled === false && scheduledDeliveryCalls === 0, "Disabled billing notification retry schedule touched the private outbox.");

const scheduledBatches = [
  { delivered: 25, failed: 0, canonicalFinancialTruth: false },
  { delivered: 2, failed: 1, canonicalFinancialTruth: false }
];
const enabledSchedule = await handleBillingScheduled(
  { ...protectedTestEnv, BILLING_NOTIFICATION_RETRY_ENABLED: "true" },
  {
    expire: async (_env, limit) => {
      assert(limit === 100, "Scheduled checkout expiry exceeded its bounded database contract.");
      return { expired: 2, canonicalFinancialTruth: false, testMode: true };
    },
    deliver: async (_env, limit) => {
    assert(limit === 25, "Scheduled notification retry exceeded its bounded database batch contract.");
    scheduledDeliveryCalls += 1;
    return scheduledBatches.shift();
    }
  }
);
assert(
  enabledSchedule.enabled === true && enabledSchedule.batches === 2
    && enabledSchedule.expiredCheckouts === 2
    && enabledSchedule.delivered === 27 && enabledSchedule.failed === 1
    && enabledSchedule.canonicalFinancialTruth === false,
  "Scheduled notification retries did not drain bounded batches or preserved a false financial-truth claim."
);
assert(typeof billingWorker.scheduled === "function", "Dedicated billing Worker does not export its private scheduled retry entrypoint.");

for (const unsafeScheduledEnv of [
  { ...protectedTestEnv, BILLING_NOTIFICATION_RETRY_ENABLED: "true", BILLING_STAGING_ACCESS_CONFIRMED: "false" },
  { ...protectedTestEnv, BILLING_NOTIFICATION_RETRY_ENABLED: "true", BILLING_EDGE_RATE_LIMIT_CONFIRMED: "false" },
  { ...protectedTestEnv, BILLING_NOTIFICATION_RETRY_ENABLED: "true", BILLING_WEBHOOK_FULFILLMENT_ENABLED: "false" },
  { ...protectedTestEnv, BILLING_NOTIFICATION_RETRY_ENABLED: "true", STRIPE_LIVE_ENABLED: "true" }
]) {
  let rejected = false;
  try {
    await handleBillingScheduled(unsafeScheduledEnv, {
      expire: async () => ({ expired: 0, canonicalFinancialTruth: false, testMode: true }),
      deliver: async () => ({ delivered: 0, failed: 0, canonicalFinancialTruth: false })
    });
  } catch (error) {
    rejected = error instanceof BillingHttpError;
  }
  assert(rejected, "Scheduled notification retry ignored a test-route, fulfillment, or live-mode safety boundary.");
}

console.log("Billing Worker binding-isolation and route-manifest smoke test ok.");
