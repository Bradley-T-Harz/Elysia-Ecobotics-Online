import fs from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { buildContainerArgs, engineInfoSupportsIsolation, parseCgroupV2Metrics } from "../services/sandbox-runner/dockerRunner.mjs";
import { assertJobId, ensureRuntime, jobDir } from "../services/sandbox-runner/jobStore.mjs";
import { decodeUtf8Prefix, defaultLimits, runtimeForLanguage, sanitizeOutput } from "../services/sandbox-runner/policy.mjs";
import {
  createAndRunSnapshotRun,
  inspectBundle,
  readBundle,
  validateHandoffBundle,
  validateSnapshotRunPayload
} from "../services/sandbox-runner/runner.mjs";
import { handleSandboxRunnerRequest, httpStatusForRunResult } from "../services/sandbox-runner/server.mjs";
import { loadRunnerConfig, safeEngineEnvironment } from "../services/sandbox-runner/serviceConfig.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const runtimeRoot = await fs.mkdtemp(join(os.tmpdir(), "elysia-sandbox-test-"));
const config = loadRunnerConfig({
  ELYSIA_SANDBOX_MODE: "development",
  ELYSIA_SANDBOX_ENABLED: "true",
  ELYSIA_SANDBOX_CONFIRM_SERVICE_EXECUTION: "true",
  ELYSIA_SANDBOX_HOST: "127.0.0.1",
  ELYSIA_SANDBOX_PORT: "8788",
  ELYSIA_SANDBOX_ENGINE: "podman",
  ELYSIA_SANDBOX_RUNTIME_ROOT: runtimeRoot,
  ELYSIA_SANDBOX_SERVICE_TOKEN: "runner-test-token-with-at-least-thirty-two-characters",
  ELYSIA_SANDBOX_PYTHON_IMAGE: "docker.io/library/python:3.12-alpine",
  ELYSIA_SANDBOX_NODE_IMAGE: "docker.io/library/node:22-alpine",
  ELYSIA_SANDBOX_ACCESS_TEAM_DOMAIN: "https://sandbox-test.cloudflareaccess.com",
  ELYSIA_SANDBOX_ACCESS_AUDIENCE: "sandbox-test-audience-0001",
  HOME: "/non-sensitive-service-home",
  XDG_RUNTIME_DIR: "/run/user/1234",
  FORBIDDEN_SECRET: "must-not-be-forwarded"
});

assert(config.engine === "podman", "Podman must be the deterministic configured engine.");
assert(config.host === "127.0.0.1" && config.port === 8788, "Runner must be loopback-only on port 8788.");
assert(config.limits.timeoutSeconds === 5 && config.limits.pidsLimit === "32", "Fixed timeout and PID limits changed unexpectedly.");
await ensureRuntime(config);
assert(((await fs.stat(config.runtimeRoot)).mode & 0o077) === 0, "Runtime state must not be group/world accessible.");
let traversalRejected = false;
try { jobDir("../../private", config); } catch (error) { traversalRejected = error.message === "job_id_invalid"; }
assert(traversalRejected, "Job identifiers must reject path traversal before any filesystem operation.");
assert(assertJobId("job-00000000-0000-4000-8000-000000000001").startsWith("job-"), "Canonical job UUIDs should be accepted.");
const linkedRuntimeTarget = await fs.mkdtemp(join(os.tmpdir(), "elysia-sandbox-linked-target-"));
const linkedRuntimeRoot = `${linkedRuntimeTarget}-link`;
await fs.symlink(linkedRuntimeTarget, linkedRuntimeRoot);
let linkedRuntimeRejected = false;
try {
  await ensureRuntime({ ...config, runtimeRoot: linkedRuntimeRoot, jobsRoot: join(linkedRuntimeRoot, "jobs"), auditRoot: join(linkedRuntimeRoot, "audit") });
} catch (error) {
  linkedRuntimeRejected = error.message === "runtime_path_invalid";
} finally {
  await fs.rm(linkedRuntimeRoot, { force: true });
  await fs.rm(linkedRuntimeTarget, { recursive: true, force: true });
}
assert(linkedRuntimeRejected, "Runtime state must reject symlinked directory paths.");
assert(engineInfoSupportsIsolation("podman", { host: { security: { rootless: true }, cgroupVersion: "v2" } }), "Rootless Podman with cgroup v2 should satisfy the resource-control prerequisite.");
assert(!engineInfoSupportsIsolation("podman", { host: { security: { rootless: true }, cgroupVersion: "v1" } }), "Podman without cgroup v2 must fail readiness.");
assert(engineInfoSupportsIsolation("docker", { SecurityOptions: ["name=rootless"], CgroupVersion: "2" }), "Rootless Docker standby with cgroup v2 should satisfy the resource-control prerequisite.");
assert(!("FORBIDDEN_SECRET" in safeEngineEnvironment("podman", { FORBIDDEN_SECRET: "x", HOME: "/home/service" })), "Engine environment must be allowlisted.");
assert(!("DOCKER_HOST" in safeEngineEnvironment("podman", { DOCKER_HOST: "secret-socket", HOME: "/home/service" })), "Podman must not receive a Docker socket environment variable.");

const parsedCgroupMetrics = parseCgroupV2Metrics("usage_usec 50259\nuser_usec 33847\nsystem_usec 16411\n", "7307264\n", "6\n", "oom 1\noom_kill 1\n");
assert(
  parsedCgroupMetrics.actualCpuTimeMs === 51
  && parsedCgroupMetrics.peakMemoryBytes === 7_307_264
  && parsedCgroupMetrics.peakPids === 6
  && parsedCgroupMetrics.oomKilled === true,
  "Cgroup-v2 execution measurements must parse exact bounded CPU, memory-peak, PID-peak, and OOM counters."
);
const invalidCgroupMetrics = parseCgroupV2Metrics("usage_usec invalid\n", "max\n", "-1\n");
assert(
  invalidCgroupMetrics.actualCpuTimeMs === null
  && invalidCgroupMetrics.peakMemoryBytes === null
  && invalidCgroupMetrics.peakPids === null
  && invalidCgroupMetrics.oomKilled === false,
  "Malformed or unbounded cgroup measurements must degrade to null rather than invent resource usage."
);

assert((() => {
  try {
    loadRunnerConfig({ ELYSIA_SANDBOX_MODE: "production", ELYSIA_SANDBOX_ENABLED: "true", ELYSIA_SANDBOX_CONFIRM_SERVICE_EXECUTION: "true", ELYSIA_SANDBOX_ENGINE: "podman", ELYSIA_SANDBOX_SERVICE_TOKEN: "a".repeat(40) });
    return false;
  } catch (error) { return error.message === "immutable_image_digest_required"; }
})(), "Production config must reject mutable image tags.");

const digest = `registry.example.invalid/elysia/runtime@sha256:${"a".repeat(64)}`;
const productionConfig = {
  ELYSIA_SANDBOX_MODE: "production",
  ELYSIA_SANDBOX_ENABLED: "false",
  ELYSIA_SANDBOX_CONFIRM_SERVICE_EXECUTION: "false",
  ELYSIA_SANDBOX_HOST: "127.0.0.1",
  ELYSIA_SANDBOX_PORT: "8788",
  ELYSIA_SANDBOX_ENGINE: "podman",
  ELYSIA_SANDBOX_RUNTIME_ROOT: "/home/elysia-sandbox/.local/state/elysia-sandbox-runner",
  ELYSIA_SANDBOX_PYTHON_IMAGE: digest,
  ELYSIA_SANDBOX_NODE_IMAGE: digest,
  ELYSIA_SANDBOX_SERVICE_TOKEN: "a".repeat(40),
  ELYSIA_SANDBOX_ACCESS_TEAM_DOMAIN: "https://sandbox-test.cloudflareaccess.com",
  ELYSIA_SANDBOX_ACCESS_AUDIENCE: "sandbox-production-audience-0001"
};
const loadedProductionConfig = loadRunnerConfig(productionConfig);
assert(loadedProductionConfig.accessRequired === true && loadedProductionConfig.accessAudience === productionConfig.ELYSIA_SANDBOX_ACCESS_AUDIENCE, "Production must require the exact configured Access trust identity.");
for (const [name, env, expectedError] of [
  ["missing Access issuer", { ...productionConfig, ELYSIA_SANDBOX_ACCESS_TEAM_DOMAIN: "" }, "access_team_domain_invalid"],
  ["placeholder Access issuer", { ...productionConfig, ELYSIA_SANDBOX_ACCESS_TEAM_DOMAIN: "https://REPLACE_WITH_TEAM.cloudflareaccess.com" }, "access_team_domain_invalid"],
  ["nested Access issuer", { ...productionConfig, ELYSIA_SANDBOX_ACCESS_TEAM_DOMAIN: "https://nested.team.cloudflareaccess.com" }, "access_team_domain_invalid"],
  ["missing Access audience", { ...productionConfig, ELYSIA_SANDBOX_ACCESS_AUDIENCE: "" }, "access_audience_invalid"],
  ["placeholder service token", { ...productionConfig, ELYSIA_SANDBOX_SERVICE_TOKEN: "replace-with-placeholder-service-token-value" }, "service_token_invalid"],
  ["mutable runtime state", { ...productionConfig, ELYSIA_SANDBOX_RUNTIME_ROOT: runtimeRoot }, "runtime_root_invalid"],
  ["rootful Docker socket", { ...productionConfig, ELYSIA_SANDBOX_ENGINE: "docker", DOCKER_HOST: "unix:///var/run/docker.sock" }, "rootless_docker_host_invalid"]
]) {
  let rejected = false;
  try { loadRunnerConfig(env); } catch (error) { rejected = error.message === expectedError; }
  assert(rejected, `Production config must reject ${name}.`);
}

const runtime = runtimeForLanguage("javascript");
const job = { job_id: "job-00000000-0000-4000-8000-000000000001", resource_limits: defaultLimits };
const built = buildContainerArgs({ job, runtime, config });
for (const required of ["--interactive", "--pull=never", "--network=none", "--read-only", "--label", "--cap-drop=ALL", "--security-opt=no-new-privileges", "--pids-limit", "--memory", "--cpus", "--user", "--pid=private", "--ipc=none", "--tmpfs"]) {
  assert(built.args.includes(required) || built.args.some((value) => value.startsWith(required)), `Container args missing ${required}.`);
}
assert(!built.args.includes("--mount") && !built.args.some((value) => /type=bind|docker\.sock|podman\.sock|\/home\/|\/root\//.test(value)), "Container args must not mount host paths, sockets, repositories, or vaults.");
assert(!built.args.includes("--shm-size"), "IPC-none jobs must not request an incompatible shared-memory mount.");
assert(built.args.filter((value) => value === "--tmpfs").length === 2 && built.args.some((value) => value.startsWith("/workspace:rw,nosuid,nodev,noexec") && value.endsWith("mode=1777")), "Execution input and scratch space must use private bounded container tmpfs filesystems with a mode writable by the fixed non-root process.");
assert(built.args.includes("io.elysia.sandbox=true"), "Every execution container needs the strict orphan-cleanup label.");
assert(built.args.includes("core=0:0"), "Execution containers must disable core dumps.");
assert(built.args.includes(`fsize=${defaultLimits.fileSizeBytes}:${defaultLimits.fileSizeBytes}`), "Execution containers must enforce a hard file-size limit.");
assert(built.args.slice(-runtime.allowedCommand.length).join("\0") === runtime.allowedCommand.join("\0"), "Runtime command must be fixed argv with no shell.");
assert(runtime.allowedCommand.at(-1) === "-" && !built.args.includes("console.log('ok')"), "Submitted code must stream over stdin rather than appear in argv or a host mount.");
const utf8Bounded = sanitizeOutput("🙂".repeat(20_000), 65_535);
assert(Buffer.byteLength(utf8Bounded, "utf8") <= 65_535 && !utf8Bounded.includes("\uFFFD"), "Runner output limits must be UTF-8 byte-safe.");
assert(decodeUtf8Prefix(Buffer.from([0x61, 0xf0, 0x9f, 0x99])) === "a", "A captured output prefix must discard an incomplete trailing UTF-8 sequence.");

const validCode = "console.log('ok')";
const validPayload = {
  reservation_id: "00000000-0000-4000-8000-000000000001",
  client_request_id: "00000000-0000-4000-8000-000000000011",
  lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
  snapshot_id: "reservation-00000000-0000-4000-8000-000000000001",
  language: "javascript",
  file_name: "main.js",
  code: validCode,
  code_sha256: createHash("sha256").update(validCode).digest("hex"),
  code_bytes: Buffer.byteLength(validCode, "utf8"),
  network_policy: "disabled",
  filesystem_policy: "temporary_workspace_only"
};
function governedPayload(overrides = {}) {
  const payload = { ...validPayload, ...overrides };
  if (!Object.hasOwn(overrides, "code_sha256")) payload.code_sha256 = createHash("sha256").update(payload.code).digest("hex");
  if (!Object.hasOwn(overrides, "code_bytes")) payload.code_bytes = Buffer.byteLength(payload.code, "utf8");
  return payload;
}
assert(validateSnapshotRunPayload(validPayload).ok === true, "Valid governed JavaScript request should pass policy validation.");
assert(validateSnapshotRunPayload(validPayload, { requireReservation: true }).ok === true, "The public runner contract must accept a correctly bound live reservation.");
assert(validateSnapshotRunPayload({ ...validPayload, code_sha256: "0".repeat(64) }, { requireReservation: true }).ok === false, "A code-hash mismatch must fail before execution.");
assert(validateSnapshotRunPayload({ ...validPayload, code_bytes: validPayload.code_bytes + 1 }, { requireReservation: true }).ok === false, "A code-byte mismatch must fail before execution.");
assert(validateSnapshotRunPayload({ ...validPayload, lease_expires_at: new Date(Date.now() - 60_000).toISOString() }, { requireReservation: true }).ok === false, "An expired reservation lease must fail before execution.");
assert(validateSnapshotRunPayload({ ...validPayload, lease_expires_at: new Date(Date.now() + 5_000).toISOString() }, { requireReservation: true }).ok === false, "A lease too short for bounded execution must fail before execution.");
assert(validateSnapshotRunPayload({ ...validPayload, reservation_id: undefined, client_request_id: undefined, lease_expires_at: undefined, code_sha256: undefined, code_bytes: undefined }, { requireReservation: true }).ok === false, "The public runner must reject an unbound snapshot payload.");
assert(validateSnapshotRunPayload(governedPayload({ language: "typescript", file_name: "main.ts" })).ok === true, "TypeScript .ts should be enabled.");
assert(validateSnapshotRunPayload(governedPayload({ language: "typescript", file_name: "main.tsx" })).ok === false, "TSX must fail closed without a JSX transform.");
assert(validateSnapshotRunPayload(governedPayload({ code: "console.log(process.env.SECRET)" })).ok === false, "Environment-secret access attempts must be blocked before execution.");
assert(validateSnapshotRunPayload({ ...validPayload, network_policy: "enabled" }).ok === false, "Network policy overrides must fail closed.");
assert(validateSnapshotRunPayload({ ...validPayload, extra: "field" }).ok === false, "Unknown runner request fields must be rejected.");
assert(validateSnapshotRunPayload(governedPayload({ code: "console.log('before')\u0000console.log('after')" })).ok === false, "Null bytes must be rejected before execution.");
for (const blockedCode of [
  "fetch('https://example.com')",
  "require('child_process').exec('id')",
  "npm install left-pad",
  "const privatePath = /home/private-user/secret"
]) {
  assert(validateSnapshotRunPayload(governedPayload({ code: blockedCode })).ok === false, `Blocked network/shell/package/private-path fixture escaped policy: ${blockedCode}`);
}
const brokenJsonPayload = governedPayload({ language: "json", file_name: "data.json", code: "{" });
const brokenJson = validateSnapshotRunPayload(brokenJsonPayload);
assert(brokenJson.ok === true && brokenJson.diagnostics.some((item) => item.category === "syntax_error"), "Static JSON diagnostics must report syntax errors truthfully without executing code.");
const brokenJsonRun = await createAndRunSnapshotRun(brokenJsonPayload, { confirmLocalExecution: true, config });
assert(brokenJsonRun.ok === false && brokenJsonRun.status === "failed" && brokenJsonRun.exitCode === null, "Static syntax errors must never be finalized as successful evidence.");
assert(brokenJsonRun.usage.inputBytes === brokenJsonPayload.code_bytes && brokenJsonRun.usage.networkAccess === false, "Static diagnostics must report bounded non-network usage without pretending code executed.");

let releaseExecution;
const executionBarrier = new Promise((resolve) => { releaseExecution = resolve; });
const mockContainer = async (runJob) => {
  await executionBarrier;
  const now = new Date().toISOString();
  return { ...runJob, status: "succeeded", started_at: now, finished_at: now, exit_code: 0, output_truncated: false, cleanup_ok: true };
};
const firstRun = createAndRunSnapshotRun(validPayload, { confirmLocalExecution: true, config, runContainer: mockContainer });
await new Promise((resolve) => setImmediate(resolve));
const concurrent = await createAndRunSnapshotRun(governedPayload({
  reservation_id: "00000000-0000-4000-8000-000000000002",
  client_request_id: "00000000-0000-4000-8000-000000000012",
  snapshot_id: "reservation-00000000-0000-4000-8000-000000000002"
}), { confirmLocalExecution: true, config, runContainer: mockContainer });
assert(concurrent.busy === true && concurrent.retryAfter === 4, "A concurrent execution must receive immediate busy state without entering a queue.");
releaseExecution();
const completed = await firstRun;
assert(completed.ok === true && completed.status === "completed", "Mocked governed execution should complete.");
assert(completed.usage.inputBytes === validPayload.code_bytes && completed.usage.configuredCpuMillis === 500 && completed.usage.configuredMemoryBytes === 268_435_456 && completed.usage.networkAccess === false, "Governed execution must return its fixed measurement envelope separately from authority.");
assert((await fs.readdir(config.jobsRoot)).length === 0, "Raw job input/output must be removed before the execution slot is released.");

class MockResponse extends EventEmitter {
  status = 0;
  headers = {};
  body = "";
  writableEnded = false;
  writeHead(status, headers) { this.status = status; this.headers = headers; }
  end(body = "") { this.body = String(body); this.writableEnded = true; }
  destroy() {}
}

function mockRequest(method, url, token, body = null, extraHeaders = {}) {
  const encoded = body === null ? Buffer.alloc(0) : Buffer.isBuffer(body) ? body : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
  const request = Readable.from(encoded.byteLength ? [encoded] : []);
  request.method = method;
  request.url = url;
  request.headers = {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(body !== null ? { "content-type": "application/json", "content-length": String(encoded.byteLength) } : {}),
    ...extraHeaders
  };
  request.setTimeout = () => request;
  return request;
}

async function call(request, overrides = {}) {
  const response = new MockResponse();
  await handleSandboxRunnerRequest(request, response, {
    config,
    healthCheck: async () => ({ ready: true }),
    runSnapshot: async () => ({ ok: true, status: "completed", diagnostics: [], message: "complete" }),
    accessVerifier: async (assertion) => assertion === "synthetic-access-assertion",
    ...overrides
  });
  return response;
}

assert((await call(mockRequest("GET", "/health", "wrong-token"))).status === 401, "Wrong runner token must fail closed.");
assert((await call(mockRequest("GET", "/health", config.serviceToken, null, { origin: "https://elysiaecobotics.com" }))).status === 403, "Browser-origin requests must never reach the private runner API.");
assert((await call(mockRequest("GET", "/health", config.serviceToken))).status === 403, "A direct-origin request without an Access assertion must fail closed.");
assert((await call(mockRequest("GET", "/health", config.serviceToken, null, { "cf-access-jwt-assertion": "invalid" }))).status === 403, "An invalid Access assertion must fail closed.");
const accessHeader = { "cf-access-jwt-assertion": "synthetic-access-assertion" };
assert((await call(mockRequest("GET", "/health", config.serviceToken, null, accessHeader))).status === 200, "Bearer- and Access-authenticated private health should work.");
const acceptedHttpRun = await call(mockRequest("POST", "/v1/runs", config.serviceToken, validPayload, accessHeader));
assert(acceptedHttpRun.status === 200, `Authenticated valid runner request should be accepted (received ${acceptedHttpRun.status}: ${acceptedHttpRun.body}).`);
let disconnectSignal = null;
await call(mockRequest("POST", "/v1/runs", config.serviceToken, validPayload, accessHeader), {
  runSnapshot: async (_payload, options) => { disconnectSignal = options.signal; return { ok: true, status: "completed", diagnostics: [], message: "complete" }; }
});
assert(disconnectSignal instanceof AbortSignal, "Runner requests must propagate a disconnect cancellation signal to the execution boundary.");
assert((await call(mockRequest("POST", "/v1/runs", config.serviceToken, "{", accessHeader))).status === 400, "Malformed runner JSON must be rejected safely.");
assert((await call(mockRequest("POST", "/v1/runs", config.serviceToken, Buffer.from([0xc3, 0x28]), accessHeader))).status === 400, "Invalid UTF-8 runner requests must be rejected safely.");
assert((await call(mockRequest("POST", "/v1/runs?unexpected=1", config.serviceToken, validPayload, accessHeader))).status === 404, "Runner endpoints must reject unexpected query parameters.");
const internalFailure = await call(mockRequest("POST", "/v1/runs", config.serviceToken, validPayload, accessHeader), { runSnapshot: async () => { throw new Error("/private/engine/path token=not-public"); } });
assert(internalFailure.status === 503 && !internalFailure.body.includes("/private") && !internalFailure.body.includes("token="), "Unexpected runner failures must be sanitized.");
assert(httpStatusForRunResult({ busy: true }) === 429, "Busy runner results must map to HTTP 429.");
assert(httpStatusForRunResult({ status: "policy_blocked" }) === 422, "Policy blocks must map to HTTP 422.");

const approvedFixture = await readBundle("services/sandbox-runner/fixtures/approved-python.elysia-sandbox-request.json");
assert(validateHandoffBundle(approvedFixture).ok === true, "Approved local handoff fixture should remain valid.");
assert(inspectBundle(approvedFixture).runnable_after_confirmation === true, "Local handoff inspection must still require explicit confirmation.");
const unapprovedFixture = await readBundle("services/sandbox-runner/fixtures/unapproved-python.elysia-sandbox-request.json");
assert(validateHandoffBundle(unapprovedFixture).ok === false, "Unapproved handoff must remain blocked.");
const blockedFixture = await readBundle("services/sandbox-runner/fixtures/blocked-secret.elysia-sandbox-request.json");
assert(validateHandoffBundle(blockedFixture).ok === false, "Secret-like handoff must remain blocked.");
const snapshotPythonFixture = await readBundle("services/sandbox-runner/fixtures/snapshot-python-run.json");
const snapshotTimeoutFixture = await readBundle("services/sandbox-runner/fixtures/snapshot-timeout-run.json");
const snapshotSecretFixture = await readBundle("services/sandbox-runner/fixtures/snapshot-blocked-secret-run.json");
assert(validateSnapshotRunPayload(snapshotPythonFixture).ok === true, "Safe snapshot-style Python fixture must validate.");
assert(validateSnapshotRunPayload(snapshotTimeoutFixture).ok === true, "Timeout fixture must reach the isolated live acceptance test.");
assert(validateSnapshotRunPayload(snapshotSecretFixture).ok === false, "Snapshot-style secret fixture must fail policy validation.");

await fs.rm(runtimeRoot, { recursive: true, force: true });
console.log("Sandbox runner smoke test ok.");
