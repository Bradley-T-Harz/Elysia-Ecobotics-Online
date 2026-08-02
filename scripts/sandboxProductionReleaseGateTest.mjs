import assert from "node:assert/strict";
import { runHttpAcceptance, verifyProjectContract } from "./sandboxProductionReleaseGate.mjs";

const expectedCommit = "a".repeat(40);
const envVars = Object.fromEntries([
  ["SANDBOX_ENABLED", { type: "plain_text", value: "true" }],
  ["SANDBOX_DEPLOYMENT_ENV", { type: "plain_text", value: "production" }],
  ["SANDBOX_PUBLIC_ORIGIN", { type: "plain_text", value: "https://elysiaecobotics.com" }],
  ["SANDBOX_SERVICE_URL", { type: "plain_text", value: "https://sandbox.elysiaecobotics.com" }],
  ["SUPABASE_URL", { type: "plain_text", value: "https://fixture.supabase.co" }],
  ["SUPABASE_PUBLISHABLE_KEY", { type: "plain_text", value: "fixture-public-key" }],
  ["SANDBOX_SERVICE_TOKEN", { type: "secret_text", value: "hidden" }],
  ["SANDBOX_DB_FINALIZER_TOKEN", { type: "secret_text", value: "hidden" }],
  ["CLOUDFLARE_ACCESS_CLIENT_ID", { type: "secret_text", value: "hidden" }],
  ["CLOUDFLARE_ACCESS_CLIENT_SECRET", { type: "secret_text", value: "hidden" }]
]);
const project = {
  name: "elysia-ecobotics-online",
  production_branch: "main",
  deployment_configs: {
    production: { env_vars: envVars, services: { IDENTITY_SERVICE: { service: "fixture-identity", environment: "production" } } },
    preview: { env_vars: {}, services: {} }
  },
  canonical_deployment: {
    id: "00000000-0000-4000-8000-000000000001",
    environment: "production",
    latest_stage: { status: "success" },
    deployment_trigger: { metadata: { branch: "main", commit_dirty: false, commit_hash: expectedCommit } }
  }
};

assert.equal(verifyProjectContract(project, expectedCommit).deploymentId, project.canonical_deployment.id);
assert.throws(() => verifyProjectContract({ ...project, production_branch: "feature" }, expectedCommit), /pages_production_branch_mismatch/);
assert.throws(() => verifyProjectContract({
  ...project,
  deployment_configs: {
    ...project.deployment_configs,
    production: { ...project.deployment_configs.production, env_vars: { ...envVars, SANDBOX_ENABLED: { type: "plain_text", value: "false" } } }
  }
}, expectedCommit), /sandbox_enabled_value_mismatch/);
assert.throws(() => verifyProjectContract({
  ...project,
  deployment_configs: {
    ...project.deployment_configs,
    preview: { env_vars: { SANDBOX_DB_FINALIZER_TOKEN: { type: "secret_text", value: "hidden" } } }
  }
}, expectedCommit), /preview_sandbox_db_finalizer_token_must_not_exist/);

const profilelessToken = "header.profileless.signature";
const eligibleToken = "header.eligible.signature";
const calls = [];
let runId = "00000000-0000-4000-8000-000000000010";
let firstRunBody = null;
function response(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { "cache-control": "no-store", "content-type": "application/json" } });
}
const fetcher = async (url, init) => {
  const authorization = init.headers.authorization ?? null;
  calls.push({ url, method: init.method, authorization, body: init.body ?? null });
  if (url.endsWith("/health") && !authorization) return response({ ok: false, error: "authentication_required" }, 401);
  if (url.endsWith("/health") && authorization === `Bearer ${profilelessToken}`) return response({ ok: false, error: "profile_required" }, 403);
  if (url.endsWith("/health")) return response({ ok: true, status: "available" }, 200);
  if (!firstRunBody) {
    firstRunBody = init.body;
    return response({ ok: true, status: "completed", runId, stdout: JSON.parse(init.body).code.match(/elysia-release-gate-[0-9a-f-]+/)[0] + "\n", stderr: "", outputTruncated: false, recordingStatus: "recorded", idempotentReplay: false, diagnostics: [] }, 200);
  }
  assert.equal(init.body, firstRunBody, "The release gate must replay the byte-identical idempotent request.");
  return response({ ok: true, status: "completed", runId, stdout: "", stderr: "", outputTruncated: false, recordingStatus: "recorded", idempotentReplay: true, diagnostics: [] }, 200);
};

const accepted = await runHttpAcceptance({ fetcher, profilelessToken, eligibleToken });
assert.equal(accepted.runId, runId);
assert.equal(calls.filter((call) => call.url.endsWith("/run")).length, 2, "The gate must make one bounded run plus one idempotent replay.");
assert.equal(calls.filter((call) => call.url.endsWith("/health")).length, 4, "The gate must check anonymous, profile-less, eligible, and post-run health.");
assert(calls.every((call) => !String(call.body).includes(profilelessToken) && !String(call.body).includes(eligibleToken)), "Acceptance credentials must never enter request bodies.");

console.log("Production sandbox release-gate contract test ok.");
