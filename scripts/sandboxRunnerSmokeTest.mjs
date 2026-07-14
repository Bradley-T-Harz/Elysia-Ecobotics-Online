import fs from "node:fs/promises";
import os from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { buildContainerArgs, engineInfoSupportsIsolation } from "../services/sandbox-runner/dockerRunner.mjs";
import { inputDir } from "../services/sandbox-runner/jobStore.mjs";
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
  HOME: "/non-sensitive-service-home",
  XDG_RUNTIME_DIR: "/run/user/1234",
  FORBIDDEN_SECRET: "must-not-be-forwarded"
});

assert(config.engine === "podman", "Podman must be the deterministic configured engine.");
assert(config.host === "127.0.0.1" && config.port === 8788, "Runner must be loopback-only on port 8788.");
assert(config.limits.timeoutSeconds === 5 && config.limits.pidsLimit === "32", "Fixed timeout and PID limits changed unexpectedly.");
assert(engineInfoSupportsIsolation("podman", { host: { security: { rootless: true }, cgroupVersion: "v2" } }), "Rootless Podman with cgroup v2 should satisfy the resource-control prerequisite.");
assert(!engineInfoSupportsIsolation("podman", { host: { security: { rootless: true }, cgroupVersion: "v1" } }), "Podman without cgroup v2 must fail readiness.");
assert(engineInfoSupportsIsolation("docker", { SecurityOptions: ["name=rootless"], CgroupVersion: "2" }), "Rootless Docker standby with cgroup v2 should satisfy the resource-control prerequisite.");
assert(!("FORBIDDEN_SECRET" in safeEngineEnvironment("podman", { FORBIDDEN_SECRET: "x", HOME: "/home/service" })), "Engine environment must be allowlisted.");
assert(!("DOCKER_HOST" in safeEngineEnvironment("podman", { DOCKER_HOST: "secret-socket", HOME: "/home/service" })), "Podman must not receive a Docker socket environment variable.");

assert((() => {
  try {
    loadRunnerConfig({ ELYSIA_SANDBOX_MODE: "production", ELYSIA_SANDBOX_ENABLED: "true", ELYSIA_SANDBOX_CONFIRM_SERVICE_EXECUTION: "true", ELYSIA_SANDBOX_ENGINE: "podman", ELYSIA_SANDBOX_SERVICE_TOKEN: "a".repeat(40) });
    return false;
  } catch (error) { return error.message === "immutable_image_digest_required"; }
})(), "Production config must reject mutable image tags.");

const runtime = runtimeForLanguage("javascript");
const job = { job_id: "job-00000000-0000-4000-8000-000000000001", resource_limits: defaultLimits };
const built = buildContainerArgs({ job, runtime, inputDirectory: inputDir(job.job_id, config), config });
for (const required of ["--pull=never", "--network=none", "--read-only", "--label", "--cap-drop=ALL", "--security-opt=no-new-privileges", "--pids-limit", "--memory", "--cpus", "--user", "--ipc=none", "--tmpfs", "--mount"]) {
  assert(built.args.includes(required) || built.args.some((value) => value.startsWith(required)), `Container args missing ${required}.`);
}
assert(!built.args.some((value) => /docker\.sock|podman\.sock|\/home\/|\/root\//.test(value)), "Container args must not mount sockets, repositories, vaults, or service-account home paths.");
assert(built.args.includes("io.elysia.sandbox=true"), "Every execution container needs the strict orphan-cleanup label.");
assert(built.args.includes("core=0:0"), "Execution containers must disable core dumps.");
assert(built.args.slice(-runtime.allowedCommand.length).join("\0") === runtime.allowedCommand.join("\0"), "Runtime command must be fixed argv with no shell.");
const utf8Bounded = sanitizeOutput("🙂".repeat(20_000), 65_535);
assert(Buffer.byteLength(utf8Bounded, "utf8") <= 65_535 && !utf8Bounded.includes("\uFFFD"), "Runner output limits must be UTF-8 byte-safe.");
assert(decodeUtf8Prefix(Buffer.from([0x61, 0xf0, 0x9f, 0x99])) === "a", "A captured output prefix must discard an incomplete trailing UTF-8 sequence.");

const validPayload = {
  snapshot_id: "reservation-00000000-0000-4000-8000-000000000001",
  language: "javascript",
  file_name: "main.js",
  code: "console.log('ok')",
  network_policy: "disabled",
  filesystem_policy: "temporary_workspace_only"
};
assert(validateSnapshotRunPayload(validPayload).ok === true, "Valid governed JavaScript request should pass policy validation.");
assert(validateSnapshotRunPayload({ ...validPayload, language: "typescript", file_name: "main.ts" }).ok === true, "TypeScript .ts should be enabled.");
assert(validateSnapshotRunPayload({ ...validPayload, language: "typescript", file_name: "main.tsx" }).ok === false, "TSX must fail closed without a JSX transform.");
assert(validateSnapshotRunPayload({ ...validPayload, code: "console.log(process.env.SECRET)" }).ok === false, "Environment-secret access attempts must be blocked before execution.");
assert(validateSnapshotRunPayload({ ...validPayload, network_policy: "enabled" }).ok === false, "Network policy overrides must fail closed.");
assert(validateSnapshotRunPayload({ ...validPayload, extra: "field" }).ok === false, "Unknown runner request fields must be rejected.");
assert(validateSnapshotRunPayload({ ...validPayload, code: "console.log('before')\u0000console.log('after')" }).ok === false, "Null bytes must be rejected before a source file is written.");
for (const blockedCode of [
  "fetch('https://example.com')",
  "require('child_process').exec('id')",
  "npm install left-pad",
  "const privatePath = /home/private-user/secret"
]) {
  assert(validateSnapshotRunPayload({ ...validPayload, code: blockedCode }).ok === false, `Blocked network/shell/package/private-path fixture escaped policy: ${blockedCode}`);
}
const brokenJson = validateSnapshotRunPayload({ ...validPayload, language: "json", file_name: "data.json", code: "{" });
assert(brokenJson.ok === true && brokenJson.diagnostics.some((item) => item.category === "syntax_error"), "Static JSON diagnostics must report syntax errors truthfully without executing code.");
const brokenJsonRun = await createAndRunSnapshotRun({ ...validPayload, language: "json", file_name: "data.json", code: "{" }, { confirmLocalExecution: true, config });
assert(brokenJsonRun.ok === false && brokenJsonRun.status === "failed" && brokenJsonRun.exitCode === null, "Static syntax errors must never be finalized as successful evidence.");

let releaseExecution;
const executionBarrier = new Promise((resolve) => { releaseExecution = resolve; });
const mockContainer = async (runJob) => {
  await executionBarrier;
  const now = new Date().toISOString();
  return { ...runJob, status: "succeeded", started_at: now, finished_at: now, exit_code: 0, output_truncated: false, cleanup_ok: true };
};
const firstRun = createAndRunSnapshotRun(validPayload, { confirmLocalExecution: true, config, runContainer: mockContainer });
await new Promise((resolve) => setImmediate(resolve));
const concurrent = await createAndRunSnapshotRun({ ...validPayload, snapshot_id: "reservation-00000000-0000-4000-8000-000000000002" }, { confirmLocalExecution: true, config, runContainer: mockContainer });
assert(concurrent.busy === true && concurrent.retryAfter === 4, "A concurrent execution must receive immediate busy state without entering a queue.");
releaseExecution();
const completed = await firstRun;
assert(completed.ok === true && completed.status === "completed", "Mocked governed execution should complete.");
assert((await fs.readdir(config.jobsRoot)).length === 0, "Raw job input/output must be removed before the execution slot is released.");

class MockResponse {
  status = 0;
  headers = {};
  body = "";
  writeHead(status, headers) { this.status = status; this.headers = headers; }
  end(body = "") { this.body = String(body); }
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
    ...overrides
  });
  return response;
}

assert((await call(mockRequest("GET", "/health", "wrong-token"))).status === 401, "Wrong runner token must fail closed.");
assert((await call(mockRequest("GET", "/health", config.serviceToken, null, { origin: "https://elysiaecobotics.com" }))).status === 403, "Browser-origin requests must never reach the private runner API.");
assert((await call(mockRequest("GET", "/health", config.serviceToken))).status === 200, "Authenticated private health should work.");
const acceptedHttpRun = await call(mockRequest("POST", "/v1/runs", config.serviceToken, validPayload));
assert(acceptedHttpRun.status === 200, `Authenticated valid runner request should be accepted (received ${acceptedHttpRun.status}: ${acceptedHttpRun.body}).`);
assert((await call(mockRequest("POST", "/v1/runs", config.serviceToken, "{"))).status === 400, "Malformed runner JSON must be rejected safely.");
assert((await call(mockRequest("POST", "/v1/runs", config.serviceToken, Buffer.from([0xc3, 0x28])))).status === 400, "Invalid UTF-8 runner requests must be rejected safely.");
assert((await call(mockRequest("POST", "/v1/runs?unexpected=1", config.serviceToken, validPayload))).status === 404, "Runner endpoints must reject unexpected query parameters.");
const internalFailure = await call(mockRequest("POST", "/v1/runs", config.serviceToken, validPayload), { runSnapshot: async () => { throw new Error("/private/engine/path token=not-public"); } });
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
