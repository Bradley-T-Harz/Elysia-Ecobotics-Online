import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const productionOrigin = "https://elysiaecobotics.com";
const projectName = "elysia-ecobotics-online";
const maximumResponseBytes = 120_000;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ordinaryVariables = new Map([
  ["SANDBOX_ENABLED", "true"],
  ["SANDBOX_DEPLOYMENT_ENV", "production"],
  ["SANDBOX_PUBLIC_ORIGIN", productionOrigin],
  ["SANDBOX_SERVICE_URL", "https://sandbox.elysiaecobotics.com"],
  ["SUPABASE_URL", null],
  ["SUPABASE_PUBLISHABLE_KEY", null]
]);
const secretVariables = new Set([
  "SANDBOX_SERVICE_TOKEN",
  "SANDBOX_DB_FINALIZER_TOKEN",
  "CLOUDFLARE_ACCESS_CLIENT_ID",
  "CLOUDFLARE_ACCESS_CLIENT_SECRET"
]);
const serviceBindings = new Set(["IDENTITY_SERVICE"]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function exactKeys(actual, expected, context) {
  const actualKeys = Object.keys(record(actual) ?? {}).sort();
  const expectedKeys = [...expected].sort();
  assert(JSON.stringify(actualKeys) === JSON.stringify(expectedKeys), `${context}_inventory_mismatch`);
}

export function verifyProjectContract(project, expectedCommit) {
  const value = record(project);
  assert(value?.name === projectName, "pages_project_mismatch");
  assert(value.production_branch === "main", "pages_production_branch_mismatch");
  const configs = record(value.deployment_configs);
  const production = record(configs?.production);
  const preview = record(configs?.preview);
  const envVars = record(production?.env_vars);
  const services = record(production?.services);
  exactKeys(envVars, [...ordinaryVariables.keys(), ...secretVariables], "production_variable");
  exactKeys(services, serviceBindings, "production_service_binding");

  for (const [name, expectedValue] of ordinaryVariables) {
    const binding = record(envVars?.[name]);
    assert(binding?.type === "plain_text", `production_${name.toLowerCase()}_type_mismatch`);
    if (expectedValue !== null) assert(binding.value === expectedValue, `production_${name.toLowerCase()}_value_mismatch`);
  }
  for (const name of secretVariables) {
    const binding = record(envVars?.[name]);
    assert(binding?.type === "secret_text", `production_${name.toLowerCase()}_must_be_secret`);
  }
  const previewVars = record(preview?.env_vars) ?? {};
  assert(record(previewVars.SANDBOX_ENABLED)?.value !== "true", "preview_sandbox_must_remain_disabled");
  for (const name of secretVariables) assert(!(name in previewVars), `preview_${name.toLowerCase()}_must_not_exist`);

  const deployment = record(value.canonical_deployment);
  const trigger = record(deployment?.deployment_trigger);
  const metadata = record(trigger?.metadata);
  assert(deployment?.environment === "production", "canonical_deployment_not_production");
  assert(record(deployment?.latest_stage)?.status === "success", "canonical_deployment_not_successful");
  assert(metadata?.branch === "main", "canonical_deployment_branch_mismatch");
  assert(metadata?.commit_dirty === false, "canonical_deployment_was_dirty");
  assert(metadata?.commit_hash === expectedCommit, "canonical_deployment_commit_mismatch");
  return { deploymentId: deployment.id, commitHash: metadata.commit_hash };
}

async function readBoundedJson(response) {
  const declared = Number(response.headers.get("content-length") || "0");
  assert(Number.isFinite(declared) && declared >= 0 && declared <= maximumResponseBytes, "response_size_invalid");
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert(bytes.byteLength <= maximumResponseBytes, "response_too_large");
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new Error("response_encoding_invalid"); }
  try { return JSON.parse(text); }
  catch { throw new Error("response_json_invalid"); }
}

async function fetchJson(fetcher, url, init, expectedStatus, requireNoStore = true) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetcher(url, { ...init, redirect: "error", signal: controller.signal });
    const body = await readBoundedJson(response);
    assert(response.status === expectedStatus, `unexpected_http_status_${response.status}`);
    if (requireNoStore) assert(response.headers.get("cache-control")?.toLowerCase().includes("no-store"), "response_must_not_be_cached");
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

function authorization(token) {
  return { accept: "application/json", authorization: `Bearer ${token}` };
}

export async function runHttpAcceptance({ fetcher = fetch, profilelessToken, eligibleToken }) {
  assert(profilelessToken !== eligibleToken, "acceptance_accounts_must_be_distinct");
  const healthUrl = `${productionOrigin}/api/sandbox/health`;
  const runUrl = `${productionOrigin}/api/sandbox/run`;

  const anonymous = await fetchJson(fetcher, healthUrl, { method: "GET", headers: { accept: "application/json" } }, 401);
  assert(anonymous?.ok === false && anonymous.error === "authentication_required", "anonymous_health_contract_failed");

  const profileless = await fetchJson(fetcher, healthUrl, { method: "GET", headers: authorization(profilelessToken) }, 403);
  assert(profileless?.ok === false && profileless.error === "profile_required", "profileless_health_contract_failed");

  const eligible = await fetchJson(fetcher, healthUrl, { method: "GET", headers: authorization(eligibleToken) }, 200);
  assert(eligible?.ok === true && eligible.status === "available", "eligible_health_contract_failed");

  const marker = `elysia-release-gate-${randomUUID()}`;
  const clientRequestId = randomUUID();
  const requestBody = JSON.stringify({
    clientRequestId,
    snapshotId: `release-gate-${clientRequestId}`,
    sourceType: "manual_snapshot",
    sourceId: null,
    language: "python",
    fileName: "release_gate.py",
    code: `print(${JSON.stringify(marker)})\n`
  });
  const runInit = {
    method: "POST",
    headers: { ...authorization(eligibleToken), "content-type": "application/json", origin: productionOrigin },
    body: requestBody
  };
  const completed = await fetchJson(fetcher, runUrl, runInit, 200);
  assert(completed?.ok === true && completed.status === "completed", "bounded_run_did_not_complete");
  assert(typeof completed.runId === "string" && uuidPattern.test(completed.runId), "bounded_run_id_invalid");
  assert(completed.recordingStatus === "recorded", "bounded_run_finalization_not_recorded");
  assert(completed.idempotentReplay === false, "first_bounded_run_was_unexpected_replay");
  assert(completed.outputTruncated === false, "bounded_run_output_was_truncated");
  assert(typeof completed.stdout === "string" && completed.stdout.trim() === marker, "bounded_run_output_mismatch");
  assert(!JSON.stringify(completed).includes(profilelessToken) && !JSON.stringify(completed).includes(eligibleToken), "credential_reflected_in_response");

  const replay = await fetchJson(fetcher, runUrl, runInit, 200);
  assert(replay?.runId === completed.runId && replay.idempotentReplay === true, "idempotent_replay_contract_failed");
  const afterRun = await fetchJson(fetcher, healthUrl, { method: "GET", headers: authorization(eligibleToken) }, 200);
  assert(afterRun?.ok === true && afterRun.status === "available", "post_run_health_contract_failed");
  return { runId: completed.runId };
}

async function readCredentialFile(environmentName, kind) {
  const configured = process.env[environmentName];
  assert(configured && path.isAbsolute(configured), `${environmentName.toLowerCase()}_must_be_absolute`);
  const configuredStat = await fs.lstat(configured);
  assert(!configuredStat.isSymbolicLink(), `${environmentName.toLowerCase()}_must_not_be_symlink`);
  const realPath = await fs.realpath(configured);
  const relative = path.relative(repositoryRoot, realPath);
  assert(relative.startsWith("..") && !path.isAbsolute(relative), `${environmentName.toLowerCase()}_must_be_outside_repository`);
  const stat = await fs.stat(realPath);
  assert(stat.isFile(), `${environmentName.toLowerCase()}_must_be_regular_file`);
  assert((stat.mode & 0o077) === 0, `${environmentName.toLowerCase()}_must_be_owner_only`);
  if (typeof process.getuid === "function") assert(stat.uid === process.getuid(), `${environmentName.toLowerCase()}_owner_mismatch`);
  assert(stat.size > 20 && stat.size <= 16_384, `${environmentName.toLowerCase()}_size_invalid`);
  const value = (await fs.readFile(realPath, "utf8")).trim();
  assert(value.length > 20 && !/[\r\n\s]/.test(value), `${environmentName.toLowerCase()}_format_invalid`);
  if (kind === "jwt") assert(value.split(".").length === 3, `${environmentName.toLowerCase()}_must_be_jwt`);
  return value;
}

function git(...args) {
  return execFileSync("git", args, { cwd: repositoryRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

async function cloudflareProject(accountId, apiToken, fetcher = fetch) {
  assert(/^[A-Za-z0-9_-]{1,64}$/.test(accountId), "cloudflare_account_id_invalid");
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/${projectName}`;
  const body = await fetchJson(fetcher, url, { method: "GET", headers: { accept: "application/json", authorization: `Bearer ${apiToken}` } }, 200, false);
  assert(body?.success === true && record(body.result), "cloudflare_project_query_failed");
  return body.result;
}

export async function runProductionGate({ fetcher = fetch } = {}) {
  assert(git("status", "--porcelain") === "", "release_gate_requires_clean_tree");
  const head = git("rev-parse", "HEAD");
  const remoteMain = git("rev-parse", "online/main");
  assert(head === remoteMain, "release_gate_requires_online_main_alignment");

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
  const [apiToken, profilelessToken, eligibleToken] = await Promise.all([
    readCredentialFile("CLOUDFLARE_API_TOKEN_FILE", "api"),
    readCredentialFile("ELYSIA_SANDBOX_PROFILELESS_TOKEN_FILE", "jwt"),
    readCredentialFile("ELYSIA_SANDBOX_ELIGIBLE_TOKEN_FILE", "jwt")
  ]);
  const project = await cloudflareProject(accountId, apiToken, fetcher);
  const deployment = verifyProjectContract(project, head);
  const acceptance = await runHttpAcceptance({ fetcher, profilelessToken, eligibleToken });

  console.log("Production sandbox release gate passed.");
  console.log(`Commit: ${head}`);
  console.log(`Deployment: ${deployment.deploymentId}`);
  console.log(`Bounded finalized run: ${acceptance.runId}`);
  console.log("Credential material was read only from owner-only files outside Git and was not printed or retained by this command.");
  return { head, deploymentId: deployment.deploymentId, runId: acceptance.runId };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runProductionGate().catch((error) => {
    console.error(`Production sandbox release gate failed: ${error instanceof Error ? error.message : "unknown_failure"}`);
    process.exitCode = 1;
  });
}
