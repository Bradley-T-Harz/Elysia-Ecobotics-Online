import fs from "node:fs/promises";
import { Readable } from "node:stream";
import {
  createAndRunSnapshotRun,
  doctor,
  inspectBundle,
  readBundle,
  validateHandoffBundle,
  validateSnapshotRunPayload
} from "../services/sandbox-runner/runner.mjs";
import { defaultAllowedOrigins, handleSandboxRunnerRequest, headers as sandboxCorsHeaders, httpStatusForRunResult, isAllowedCorsOrigin } from "../services/sandbox-runner/server.mjs";

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const doctorState = await doctor();
assert(doctorState.local_only === true, "doctor must report local_only=true.");
assert(doctorState.network_default === "disabled", "doctor must report network_default=disabled.");
assert(doctorState.host_execution_fallback === false, "doctor must report host_execution_fallback=false.");
assert(doctorState.image_pull_automatic === false, "doctor must report image_pull_automatic=false.");
assert(doctorState.runtime_directory_ready === true, "doctor must report runtime_directory_ready=true.");
assert(typeof doctorState.note === "string" && doctorState.note.includes("local-only"), "doctor must explain local-only boundary.");

class MockResponse {
  status = 0;
  headers = {};
  body = "";

  writeHead(status, headers) {
    this.status = status;
    this.headers = headers;
  }

  end(body = "") {
    this.body = String(body);
  }
}

function mockRequest(method, url, origin, body) {
  const request = Readable.from(body ? [typeof body === "string" ? body : JSON.stringify(body)] : []);
  request.method = method;
  request.url = url;
  request.headers = {
    host: "sandbox.test",
    ...(origin ? { origin } : {})
  };
  return request;
}

async function callSandboxServer(method, url, origin, options = {}) {
  const response = new MockResponse();
  await handleSandboxRunnerRequest(mockRequest(method, url, origin, options.body), response, {
    confirmServiceExecution: false,
    host: "127.0.0.1",
    allowedOrigins: [...defaultAllowedOrigins],
    ...options.config
  });
  return response;
}

const productionOrigin = "https://elysiaecobotics.com";
const previewOrigin = "https://branch-name.elysia-ecobotics-online.pages.dev";
const disallowedOrigin = "https://not-elysia.example";
assert(isAllowedCorsOrigin(productionOrigin), "production origin should be allowed for sandbox runner CORS.");
assert(isAllowedCorsOrigin(previewOrigin), "Cloudflare Pages preview origin should be allowed only through the strict project-domain pattern.");
assert(!isAllowedCorsOrigin(disallowedOrigin), "unrelated origins must not be allowed for sandbox runner CORS.");

const directCorsHeaders = sandboxCorsHeaders(mockRequest("GET", "/health", productionOrigin));
assert(directCorsHeaders["Access-Control-Allow-Origin"] === productionOrigin, "allowed production origin should receive Access-Control-Allow-Origin.");
assert(directCorsHeaders["Vary"] === "Origin", "CORS responses should vary by Origin.");
assert(directCorsHeaders["Access-Control-Allow-Methods"] === "GET, POST, OPTIONS", "CORS methods should include GET, POST, OPTIONS.");
assert(directCorsHeaders["Access-Control-Allow-Headers"] === "Content-Type, Authorization", "CORS headers should include Content-Type and Authorization.");
assert(directCorsHeaders["Access-Control-Max-Age"] === "600", "CORS preflight max-age should be 600 seconds.");
assert(!sandboxCorsHeaders(mockRequest("GET", "/health", disallowedOrigin))["Access-Control-Allow-Origin"], "disallowed origin must not receive Access-Control-Allow-Origin.");

const optionsRunResponse = await callSandboxServer("OPTIONS", "/v1/runs", productionOrigin);
assert(optionsRunResponse.status === 204, "OPTIONS /v1/runs should return 204 for preflight.");
assert(optionsRunResponse.headers["Access-Control-Allow-Origin"] === productionOrigin, "OPTIONS /v1/runs should echo the allowed production origin.");
assert(optionsRunResponse.headers["Access-Control-Allow-Headers"] === "Content-Type, Authorization", "OPTIONS /v1/runs should allow Content-Type and Authorization.");

const optionsHealthResponse = await callSandboxServer("OPTIONS", "/health", productionOrigin);
assert(optionsHealthResponse.status === 204, "OPTIONS /health should return 204 for preflight.");
assert(optionsHealthResponse.headers["Access-Control-Allow-Origin"] === productionOrigin, "OPTIONS /health should echo the allowed production origin.");

const healthResponse = await callSandboxServer("GET", "/health", productionOrigin);
assert(healthResponse.status === 200, "GET /health should still return 200.");
assert(healthResponse.headers["Access-Control-Allow-Origin"] === productionOrigin, "GET /health should include CORS for the production site.");

const disallowedHealthResponse = await callSandboxServer("GET", "/health", disallowedOrigin);
assert(disallowedHealthResponse.status === 200, "GET /health should still work without CORS for disallowed origins.");
assert(!disallowedHealthResponse.headers["Access-Control-Allow-Origin"], "disallowed origins must not receive permissive CORS.");

const deniedPostResponse = await callSandboxServer("POST", "/v1/runs", productionOrigin);
assert(deniedPostResponse.status === 403, "POST /v1/runs should remain policy-bound when service execution is not confirmed.");
assert(deniedPostResponse.headers["Access-Control-Allow-Origin"] === productionOrigin, "denied POST should still include CORS for the allowed browser origin.");
assert(httpStatusForRunResult({ status: "completed", ok: true }) === 200, "completed run results should use HTTP 200.");
assert(httpStatusForRunResult({ status: "failed", ok: false }) === 200, "normal user-code failed run results should use HTTP 200.");
assert(httpStatusForRunResult({ status: "policy_blocked", ok: false }) === 422, "policy-blocked runs should use HTTP 422.");
assert(httpStatusForRunResult({ status: "sandbox_unavailable", ok: false }) === 503, "sandbox infrastructure unavailability should use HTTP 503.");

const successfulRunResponse = await callSandboxServer("POST", "/v1/runs", productionOrigin, {
  body: { snapshot_id: "ok-js", language: "javascript", file_name: "main.js", code: "console.log('ok')" },
  config: {
    confirmServiceExecution: true,
    runSnapshot: async () => ({
      ok: true,
      status: "completed",
      language: "javascript",
      file: "main.js",
      snapshotId: "ok-js",
      stdout: "ok\n",
      stderr: "",
      exitCode: 0,
      durationMs: 12,
      diagnostics: [{ severity: "info", phase: "runtime", category: "policy_info", language: "javascript", file: "main.js", line: null, column: null, message: "Sandbox run completed without runtime errors.", source: "Sandbox runner" }],
      message: "Sandbox run completed. This is not a trust or Marketplace approval signal."
    })
  }
});
assert(successfulRunResponse.status === 200, "successful JS run should return HTTP 200.");
assert(JSON.parse(successfulRunResponse.body).status === "completed", "successful JS run should return completed status.");

const referenceErrorResponse = await callSandboxServer("POST", "/v1/runs", productionOrigin, {
  body: { snapshot_id: "bad-js", language: "javascript", file_name: "main.js", code: "console.warn('before crash');\nshanonDiversity(counts);" },
  config: {
    confirmServiceExecution: true,
    runSnapshot: async () => ({
      ok: false,
      status: "failed",
      language: "javascript",
      file: "main.js",
      snapshotId: "bad-js",
      stdout: "",
      stderr: "before crash\nReferenceError: shanonDiversity is not defined\n",
      exitCode: 1,
      durationMs: 18,
      diagnostics: [{ severity: "error", phase: "runtime", category: "runtime_error", language: "javascript", file: "main.js", line: null, column: null, message: "ReferenceError: shanonDiversity is not defined", source: "Container runtime" }],
      message: "Sandbox run failed."
    })
  }
});
const referenceErrorPayload = JSON.parse(referenceErrorResponse.body);
assert(referenceErrorResponse.status === 200, "JS ReferenceError should return HTTP 200 with a failed run payload, not HTTP 500.");
assert(referenceErrorPayload.status === "failed", "JS ReferenceError payload should be status=failed.");
assert(referenceErrorPayload.exitCode !== 0, "JS ReferenceError payload should include nonzero exit code.");
assert(referenceErrorPayload.stderr.includes("ReferenceError: shanonDiversity is not defined"), "JS ReferenceError stderr should preserve the exception.");
assert(referenceErrorPayload.stderr.includes("before crash"), "JS ReferenceError stderr should preserve warning output emitted before crash.");
assert(referenceErrorPayload.diagnostics.some((item) => item.category === "runtime_error"), "JS ReferenceError should include runtime_error diagnostics.");

const policyBlockedResponse = await callSandboxServer("POST", "/v1/runs", productionOrigin, {
  body: { snapshot_id: "shell-blocked", language: "shell", file_name: "run.sh", code: "echo no" },
  config: {
    confirmServiceExecution: true,
    runSnapshot: async () => ({ ok: false, status: "policy_blocked", language: "shell", file: "run.sh", snapshotId: "shell-blocked", diagnostics: [], message: "Snapshot run blocked by language or safety policy." })
  }
});
assert(policyBlockedResponse.status === 422, "policy-blocked runs should remain non-500 and policy-classified.");

const malformedRunResponse = await callSandboxServer("POST", "/v1/runs", productionOrigin, {
  body: "{",
  config: { confirmServiceExecution: true }
});
assert(malformedRunResponse.status === 400, "malformed run requests should return HTTP 400.");

const serviceCrashResponse = await callSandboxServer("POST", "/v1/runs", productionOrigin, {
  body: { snapshot_id: "infra-failure", language: "javascript", file_name: "main.js", code: "console.log('ok')" },
  config: {
    confirmServiceExecution: true,
    runSnapshot: async () => {
      throw new Error("simulated sandbox infrastructure failure");
    }
  }
});
const serviceCrashPayload = JSON.parse(serviceCrashResponse.body);
assert(serviceCrashResponse.status === 500, "unexpected sandbox service failures should remain HTTP 500 infrastructure failures.");
assert(serviceCrashPayload.status === "sandbox_unavailable", "unexpected sandbox service failures should be classified as sandbox_unavailable.");
assert(serviceCrashPayload.diagnostics.some((item) => item.category === "sandbox_internal_failure"), "unexpected sandbox service failures should include sandbox_internal_failure diagnostics.");

if (!doctorState.engine) {
  assert(doctorState.host_execution_fallback === false, "missing Docker/Podman must fail closed with no host fallback.");
} else {
  for (const imageMap of Object.values(doctorState.images || {})) {
    for (const available of Object.values(imageMap || {})) {
      assert(typeof available === "boolean", "doctor image availability should be advisory boolean state.");
    }
  }
}

const cliSource = await fs.readFile(new URL("../services/sandbox-runner/cli.mjs", import.meta.url), "utf8");
assert(cliSource.includes("elysia-sandbox-runner local CLI"), "help text missing CLI heading.");
assert(cliSource.includes("never runs code"), "help text must state non-execution boundary.");
assert(cliSource.includes("run-snapshot"), "help text should expose snapshot run command.");
const dockerRunnerSource = await fs.readFile(new URL("../services/sandbox-runner/dockerRunner.mjs", import.meta.url), "utf8");
assert(dockerRunnerSource.includes("stdoutWrite = stdoutWrite.then") && dockerRunnerSource.includes("stderrWrite = stderrWrite.then") && dockerRunnerSource.includes("Promise.allSettled([stdoutWrite, stderrWrite])"), "sandbox runner should serialize and flush stdout/stderr writes before returning run results.");

const approvedFixture = await readBundle("services/sandbox-runner/fixtures/approved-python.elysia-sandbox-request.json");
const approvedValidateState = validateHandoffBundle(approvedFixture);
assert(approvedValidateState.ok === true, "approved fixture validator result should be ok=true.");
assert(approvedValidateState.info.some((item) => item.code === "local_only"), "approved fixture validation should report local-only non-execution info.");

const approvedInspectState = inspectBundle(approvedFixture);
assert(approvedInspectState.runnable_after_confirmation === true, "approved fixture inspect should be runnable only after explicit confirmation.");
assert(approvedInspectState.network_policy === "disabled", "approved fixture inspect should show network disabled.");

const snapshotFixture = JSON.parse(await fs.readFile(new URL("../services/sandbox-runner/fixtures/snapshot-javascript-run.json", import.meta.url), "utf8"));
const snapshotValidateState = validateSnapshotRunPayload(snapshotFixture);
assert(snapshotValidateState.ok === true, "snapshot fixture validator result should be ok=true.");
assert(snapshotValidateState.language === "javascript", "snapshot fixture should normalize to javascript.");

const snapshotRunDeniedState = await createAndRunSnapshotRun(snapshotFixture);
assert(snapshotRunDeniedState.status === "denied", "snapshot run without confirmation should return denied.");

const unapprovedFixture = await readBundle("services/sandbox-runner/fixtures/unapproved-python.elysia-sandbox-request.json");
const unapprovedState = validateHandoffBundle(unapprovedFixture);
assert(unapprovedState.ok === false, "unapproved fixture validator result should be ok=false.");
assert(unapprovedState.errors.some((item) => item.code === "not_approved"), "unapproved fixture should fail because it is not approved.");

const blockedSecretFixture = await readBundle("services/sandbox-runner/fixtures/blocked-secret.elysia-sandbox-request.json");
const blockedSecretState = validateHandoffBundle(blockedSecretFixture);
assert(blockedSecretState.ok === false, "secret-like fixture validator result should be ok=false.");
assert(blockedSecretState.errors.some((item) => item.code.startsWith("secret_")), "secret-like fixture should fail on secret detection.");

console.log("Sandbox runner smoke test ok.");
