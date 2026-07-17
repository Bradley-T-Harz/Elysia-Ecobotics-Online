import { readFile } from "node:fs/promises";
import {
  ACTIVATE_SANDBOX_TEST_PROGRAM_CONFIRMATION,
  configureRecurringSupportSandboxProgramInSupabase,
  DEACTIVATE_SANDBOX_TEST_PROGRAM_CONFIRMATION,
  normalizeRecurringSupportSandboxProgramSpec,
  RECURRING_SANDBOX_PROGRAM_CONFIRMATION,
  setRecurringSupportSandboxProgramStatus
} from "./billingStripeTestCatalog.mjs";
import { safeRecurringSandboxProgramOutput } from "./billingSandboxRecurringTestProgram.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function rejects(operation, pattern, message) {
  let matched = false;
  try { await operation(); }
  catch (error) { matched = pattern.test(String(error)); }
  assert(matched, message);
}

const spec = {
  programCode: "sandbox_test_recurring_support_v1",
  sourcePriceCode: "support_monthly_sandbox_usd",
  grantedUnits: 25_000,
  expiresAfterDays: 45
};
const normalized = normalizeRecurringSupportSandboxProgramSpec(spec);
assert(normalized.active === false && normalized.oneTimePerUser === false && normalized.sourceCategory === "recurring_support", "Recurring support program was not normalized to inactive/non-once-only test semantics.");
for (const unsafe of [
  { ...spec, sourcePriceCode: "organization_test_price" },
  { ...spec, grantedUnits: 0 },
  { ...spec, programCode: "production_program" }
]) {
  await rejects(
    () => Promise.resolve(normalizeRecurringSupportSandboxProgramSpec(unsafe)),
    /(reviewed recurring-support|bounds|invalid)/i,
    "Recurring sandbox program accepted an unreviewed source, invented unit bound, or production-like code."
  );
}

const runtime = { billingMode: "test", stripeLiveEnabled: "false" };
const supabaseUrl = "https://fixture-project.supabase.co";
const serviceRoleKey = "synthetic-service-role-key-never-log-this-value";
const reason = "Reviewed recurring support sandbox units and expiry without changing authority.";
await rejects(
  () => configureRecurringSupportSandboxProgramInSupabase({
    spec, reason, confirmation: "wrong", supabaseUrl, serviceRoleKey, ...runtime,
    fetcher: async () => { throw new Error("must not fetch"); }
  }),
  /Refusing recurring sandbox program configuration/,
  "Recurring sandbox configuration ignored its exact confirmation."
);
let configureRequest = null;
const configured = await configureRecurringSupportSandboxProgramInSupabase({
  spec, reason, confirmation: RECURRING_SANDBOX_PROGRAM_CONFIRMATION,
  supabaseUrl, serviceRoleKey, ...runtime,
  fetcher: async (input, init) => {
    configureRequest = { url: new URL(String(input)), body: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) };
    return new Response(JSON.stringify({
      programVersionId: "11111111-1111-4111-8111-111111111111",
      programCode: spec.programCode, sourceCategory: "recurring_support",
      sourcePriceCode: spec.sourcePriceCode, grantedUnits: spec.grantedUnits,
      expiresAfterDays: spec.expiresAfterDays, oneTimePerUser: false, active: false,
      approvedForLiveUse: false, testMode: true
    }), { status: 200 });
  }
});
assert(configureRequest.url.pathname.endsWith("/configure_sandbox_test_credit_program"), "Recurring sandbox tool called an unexpected RPC.");
assert(
  configureRequest.body.p_source_category === "recurring_support"
    && configureRequest.body.p_source_price_code === spec.sourcePriceCode
    && configureRequest.body.p_active === false
    && configureRequest.body.p_one_time_per_user === false
    && configureRequest.body.p_confirmation === "CONFIGURE UNAPPROVED SANDBOX TEST PROGRAM",
  "Recurring sandbox configuration bypassed the inactive/unapproved review boundary."
);
assert(configureRequest.headers.get("authorization") === `Bearer ${serviceRoleKey}` && !JSON.stringify(configureRequest.body).includes(serviceRoleKey), "Recurring sandbox configuration mishandled its server credential.");
assert(configured.active === false && configured.approvedForLiveUse === false, "Recurring sandbox configuration implied activation or live approval.");

const actorUserId = "22222222-2222-4222-8222-222222222222";
const clientRequestId = "33333333-3333-4333-8333-333333333333";
let statusRequest = null;
const activated = await setRecurringSupportSandboxProgramStatus({
  programCode: spec.programCode, actorUserId, clientRequestId, active: true, benefitReviewConfirmed: true, reason,
  confirmation: ACTIVATE_SANDBOX_TEST_PROGRAM_CONFIRMATION,
  supabaseUrl, serviceRoleKey, ...runtime,
  fetcher: async (input, init) => {
    statusRequest = { url: new URL(String(input)), body: JSON.parse(String(init?.body)) };
    return new Response(JSON.stringify({
      programVersionId: "11111111-1111-4111-8111-111111111111",
      programCode: spec.programCode, sourceCategory: "recurring_support", active: true,
      approvedForLiveUse: false, testMode: true, authorityChanged: false, idempotentReplay: false
    }), { status: 200 });
  }
});
assert(statusRequest.url.pathname.endsWith("/set_sandbox_test_credit_program_status"), "Sandbox program activation called an unexpected RPC.");
assert(
  statusRequest.body.p_actor_user_id === actorUserId && statusRequest.body.p_client_request_id === clientRequestId
    && statusRequest.body.p_confirmation === ACTIVATE_SANDBOX_TEST_PROGRAM_CONFIRMATION,
  "Sandbox program activation lost attributed operator review or idempotency."
);
assert(activated.active && activated.authorityChanged === false && activated.approvedForLiveUse === false, "Sandbox program activation changed authority or claimed live approval.");
await rejects(
  () => setRecurringSupportSandboxProgramStatus({
    programCode: spec.programCode, actorUserId,
    clientRequestId: "44444444-4444-4444-8444-444444444444",
    active: false, reason, confirmation: ACTIVATE_SANDBOX_TEST_PROGRAM_CONFIRMATION,
    supabaseUrl, serviceRoleKey, ...runtime,
    fetcher: async () => { throw new Error("must not fetch"); }
  }),
  new RegExp(DEACTIVATE_SANDBOX_TEST_PROGRAM_CONFIRMATION),
  "Sandbox program deactivation accepted the activation confirmation."
);
await rejects(
  () => setRecurringSupportSandboxProgramStatus({
    programCode: spec.programCode, actorUserId,
    clientRequestId: "55555555-5555-4555-8555-555555555555",
    active: true, reason, confirmation: ACTIVATE_SANDBOX_TEST_PROGRAM_CONFIRMATION,
    supabaseUrl, serviceRoleKey, ...runtime,
    fetcher: async () => { throw new Error("must not fetch"); }
  }),
  /reviewed recurring terms and UI/i,
  "Recurring sandbox benefit activation proceeded without the explicit disclosure-review prerequisite."
);
await rejects(
  () => configureRecurringSupportSandboxProgramInSupabase({
    spec, reason, confirmation: RECURRING_SANDBOX_PROGRAM_CONFIRMATION,
    supabaseUrl: "https://attacker.example", serviceRoleKey, ...runtime,
    fetcher: async () => { throw new Error("must not fetch"); }
  }),
  /canonical hosted Supabase/i,
  "Recurring sandbox tool would send its service credential to an arbitrary HTTPS origin."
);
await rejects(
  () => setRecurringSupportSandboxProgramStatus({
    programCode: spec.programCode, actorUserId, clientRequestId, active: true, benefitReviewConfirmed: true, reason,
    confirmation: ACTIVATE_SANDBOX_TEST_PROGRAM_CONFIRMATION,
    supabaseUrl, serviceRoleKey, billingMode: "live", stripeLiveEnabled: "false"
  }),
  /refuses live/i,
  "Sandbox program status tool accepted live billing mode."
);

const safe = JSON.stringify(safeRecurringSandboxProgramOutput("status", activated, true));
assert(!safe.includes(serviceRoleKey) && !safe.includes(reason) && !safe.includes(actorUserId), "Sandbox program CLI output exposed a secret, private reason, or actor ID.");
const source = await readFile(new URL("./billingSandboxRecurringTestProgram.mjs", import.meta.url), "utf8");
assert(!source.includes(".env.local") && !source.includes("dotenv") && !source.includes("readFile("), "Sandbox program CLI can load or alter an environment file.");

console.log("Billing recurring-support sandbox program smoke test ok.");
