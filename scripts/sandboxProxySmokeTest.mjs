import { PublicHttpError } from "../functions/api/sandbox/_shared/http.ts";
import { authenticateRequest } from "../functions/api/sandbox/_shared/auth.ts";
import { executeRunner } from "../functions/api/sandbox/_shared/runner.ts";
import { parseSandboxRunRequest } from "../functions/api/sandbox/_shared/schema.ts";
import { resolveAuthorizedSource } from "../functions/api/sandbox/_shared/source.ts";
import { handleSandboxHealth } from "../functions/api/sandbox/health.ts";
import { handleSandboxRun } from "../functions/api/sandbox/run.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const env = {
  SANDBOX_ENABLED: "true",
  SANDBOX_DEPLOYMENT_ENV: "production",
  SANDBOX_PUBLIC_ORIGIN: "https://elysiaecobotics.com",
  SANDBOX_SERVICE_URL: "https://sandbox.elysiaecobotics.com",
  SANDBOX_SERVICE_TOKEN: "private-runner-token-with-at-least-thirty-two-characters",
  SANDBOX_DB_FINALIZER_TOKEN: "private-finalizer-token-with-at-least-thirty-two-characters",
  CLOUDFLARE_ACCESS_CLIENT_ID: "access-client-id",
  CLOUDFLARE_ACCESS_CLIENT_SECRET: "access-client-secret",
  SUPABASE_URL: "https://project-ref.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable-key"
};

const body = {
  clientRequestId: "00000000-0000-4000-8000-000000000001",
  snapshotId: "manual-snapshot-one",
  sourceType: "manual_snapshot",
  sourceId: null,
  language: "javascript",
  fileName: "main.js",
  code: "console.log('safe')"
};

function request(overrides = {}, requestEnv = env) {
  const payload = { ...body, ...(overrides.body || {}) };
  return new Request(`${requestEnv.SANDBOX_PUBLIC_ORIGIN}/api/sandbox/run`, {
    method: overrides.method || "POST",
    headers: {
      authorization: `Bearer ${overrides.token || "verified-user-jwt"}`,
      "content-type": overrides.contentType || "application/json",
      origin: overrides.origin === undefined ? requestEnv.SANDBOX_PUBLIC_ORIGIN : overrides.origin
    },
    body: (overrides.method || "POST") === "POST" ? JSON.stringify(payload) : undefined
  });
}

const auth = { accessToken: "verified-user-jwt", userId: "00000000-0000-4000-8000-000000000099", supabase: {} };
const source = {
  sourceType: "manual_snapshot",
  sourceId: null,
  snapshotId: body.snapshotId,
  language: "javascript",
  fileName: "main.js",
  code: body.code,
  postId: null,
  codeDocumentId: null,
  codeVersionId: null
};
const runnerResult = {
  ok: true,
  status: "completed",
  language: "javascript",
  file: "main.js",
  snapshotId: body.snapshotId,
  stdout: "safe\n",
  stderr: "",
  exitCode: 0,
  durationMs: 12,
  outputTruncated: false,
  diagnostics: [],
  message: "Execution completed. This is evidence only, never trust or approval."
};

function dependencies(overrides = {}) {
  return {
    authenticate: async () => auth,
    resolveSource: async () => source,
    reserve: async () => ({ accepted: true, idempotentReplay: false, runId: "00000000-0000-4000-8000-000000000010", status: "queued", leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(), reason: null, retryAfter: null, result: null }),
    start: async () => {},
    execute: async () => runnerResult,
    finalize: async () => true,
    ...overrides
  };
}

assert((() => {
  try { parseSandboxRunRequest({ ...body, unexpected: true }); return false; }
  catch (error) { return error instanceof PublicHttpError && error.code === "request_schema_invalid"; }
})(), "Proxy request schema must reject unknown fields.");
assert((() => {
  try { parseSandboxRunRequest({ ...body, sourceType: "commune_post_snippet", sourceId: "not-a-uuid" }); return false; }
  catch (error) { return error instanceof PublicHttpError && error.code === "source_id_invalid"; }
})(), "Proxy request schema must reject unsupported source mappings.");

function sourceSupabase(rows) {
  return {
    from(table) {
      const query = {
        select() { return query; },
        eq() { return query; },
        async single() { return { data: rows[table] ?? null, error: rows[table] ? null : { code: "not_found" } }; }
      };
      return query;
    }
  };
}

let changedSnapshotRejected = false;
try {
  await resolveAuthorizedSource(sourceSupabase({
    commune_code_snippets: {
      id: "00000000-0000-4000-8000-000000000020",
      post_id: "00000000-0000-4000-8000-000000000021",
      language: "javascript",
      file_name: "main.js",
      code_text: "console.log('authoritative')",
      accepted_revision_id: null
    }
  }), {
    ...body,
    sourceType: "commune_post_snippet",
    sourceId: "00000000-0000-4000-8000-000000000020",
    snapshotId: "00000000-0000-4000-8000-000000000099"
  });
} catch (error) {
  changedSnapshotRejected = error instanceof PublicHttpError && error.code === "source_snapshot_changed";
}
assert(changedSnapshotRejected, "A stale browser snapshot identifier must be rejected after RLS-authorized source reload.");

const previewEnv = { ...env, SANDBOX_DEPLOYMENT_ENV: "preview", SANDBOX_ENABLED: "false" };
assert((await handleSandboxRun(request({}, previewEnv), previewEnv, dependencies())).status === 503, "Preview deployments must remain disabled.");
assert((await handleSandboxRun(request({ origin: "https://attacker.example" }), env, dependencies())).status === 403, "Cross-origin sandbox requests must fail closed.");
let anonymousRejected = false;
try {
  await authenticateRequest(new Request(`${env.SANDBOX_PUBLIC_ORIGIN}/api/sandbox/health`), env);
} catch (error) {
  anonymousRejected = error instanceof PublicHttpError && error.status === 401 && error.code === "authentication_required";
}
assert(anonymousRejected, "An anonymous request must fail before any Supabase or runner call.");
assert((await handleSandboxRun(request(), env, dependencies({ authenticate: async () => { throw new PublicHttpError(401, "authentication_invalid"); } }))).status === 401, "Invalid Supabase tokens must fail closed.");
assert((await handleSandboxRun(request(), env, dependencies({ resolveSource: async () => { throw new PublicHttpError(403, "source_unauthorized"); } }))).status === 403, "Unauthorized sources must fail closed.");
const quotaResponse = await handleSandboxRun(request(), env, dependencies({ reserve: async () => ({ accepted: false, idempotentReplay: false, runId: null, status: null, leaseExpiresAt: null, reason: "quota_exceeded", retryAfter: 3600, result: null }) }));
assert(quotaResponse.status === 429 && quotaResponse.headers.get("retry-after") === "3600", "Quota rejection must return 429 and Retry-After.");

let started = 0;
let executed = 0;
const replay = await handleSandboxRun(request(), env, dependencies({
  reserve: async () => ({
    accepted: true,
    idempotentReplay: true,
    runId: "00000000-0000-4000-8000-000000000010",
    status: "completed",
    leaseExpiresAt: null,
    reason: null,
    retryAfter: null,
    result: {
      ...runnerResult,
      stdout: "Bearer replay-secret /opt/internal",
      message: "raw replay message /home/private",
      diagnostics: [{ severity: "error", phase: "sandbox", category: "private_engine", message: "/root/private token=hidden", source: "Private engine" }]
    }
  }),
  start: async () => { started += 1; },
  execute: async () => { executed += 1; return runnerResult; }
}));
const replayPayload = await replay.json();
assert(replay.status === 200 && replayPayload.idempotentReplay === true, "Finalized retries must return the recorded idempotent result.");
assert(started === 0 && executed === 0, "An idempotent replay must never execute code again.");
assert(!JSON.stringify(replayPayload).includes("/opt/") && !JSON.stringify(replayPayload).includes("/home/") && !JSON.stringify(replayPayload).includes("/root/") && !JSON.stringify(replayPayload).includes("replay-secret"), "Recorded idempotent replays must pass through the same public sanitizer as live results.");
assert(replayPayload.diagnostics[0]?.category === "sandbox_internal_failure" && replayPayload.diagnostics[0]?.source === "Coding Cornucopia sandbox", "Recorded diagnostics must not bypass proxy allowlists.");

const recordingFailure = await handleSandboxRun(request(), env, dependencies({ finalize: async () => false }));
const recordingPayload = await recordingFailure.json();
assert(recordingFailure.status === 200 && recordingPayload.ok === true && recordingPayload.recordingStatus === "failed", "Database recording failure must remain distinct from execution failure.");

let startKey = null;
let finalizeKey = null;
const keyedResult = await handleSandboxRun(request(), env, dependencies({
  start: async (_auth, _runId, clientRequestId) => { startKey = clientRequestId; },
  finalize: async (_auth, _runId, clientRequestId) => { finalizeKey = clientRequestId; return true; }
}));
assert(keyedResult.status === 200 && startKey === body.clientRequestId && finalizeKey === body.clientRequestId, "Start and finalization must bind the exact reservation idempotency key.");

let forwardedHeaders;
let forwardedBody;
const actualRunnerResult = await executeRunner(env, "00000000-0000-4000-8000-000000000010", source, async (_url, init) => {
  forwardedHeaders = new Headers(init.headers);
  forwardedBody = JSON.parse(String(init.body));
  return new Response(JSON.stringify({
    ok: true,
    status: "completed",
    language: "javascript",
    stdout: "safe\n",
    stderr: "",
    exitCode: 0,
    durationMs: 4,
    outputTruncated: false,
    diagnostics: [{ severity: "error", phase: "sandbox", category: "podman_internal", message: "token=private /opt/internal", source: "Podman engine" }],
    message: "Podman raw exception at /opt/private token=hidden",
    engine: "must-not-reach-browser",
    internalPath: "/private/path"
  }), { status: 200, headers: { "content-type": "application/json" } });
});
assert(forwardedHeaders.get("authorization") === `Bearer ${env.SANDBOX_SERVICE_TOKEN}`, "Proxy must attach only the private runner bearer token upstream.");
assert(forwardedHeaders.get("cf-access-client-id") === env.CLOUDFLARE_ACCESS_CLIENT_ID && forwardedHeaders.get("cf-access-client-secret") === env.CLOUDFLARE_ACCESS_CLIENT_SECRET, "Proxy must attach both Cloudflare Access service-auth headers.");
assert(!JSON.stringify(forwardedHeaders).includes(auth.accessToken) && !JSON.stringify(forwardedBody).includes(auth.accessToken), "User JWT must never reach Hetzner.");
assert(!("sourceType" in forwardedBody) && !("sourceId" in forwardedBody) && !("userId" in forwardedBody), "Private source/account context must not reach Hetzner.");
assert(!("engine" in actualRunnerResult) && !JSON.stringify(actualRunnerResult).includes("/private/path") && !JSON.stringify(actualRunnerResult).includes("Podman") && !JSON.stringify(actualRunnerResult).includes("/opt/"), "Runner internals must be stripped from the public result.");
assert(actualRunnerResult.diagnostics[0]?.category === "sandbox_internal_failure" && actualRunnerResult.diagnostics[0]?.source === "Coding Cornucopia sandbox", "Runner-chosen diagnostic metadata must be replaced by proxy allowlists.");

const utf8RunnerResult = await executeRunner(env, "00000000-0000-4000-8000-000000000010", source, async () => new Response(JSON.stringify({
  ok: true,
  status: "completed",
  stdout: "🙂".repeat(20_000),
  stderr: "",
  exitCode: 0,
  durationMs: 4,
  outputTruncated: true,
  diagnostics: []
}), { status: 200, headers: { "content-type": "application/json" } }));
assert(new TextEncoder().encode(utf8RunnerResult.stdout).byteLength <= 32_768 && !utf8RunnerResult.stdout.includes("\uFFFD"), "Proxy output caps must be UTF-8 byte-safe.");

let alternateRunnerHostRejected = false;
try {
  await executeRunner({ ...env, SANDBOX_SERVICE_URL: "https://attacker.example" }, "00000000-0000-4000-8000-000000000010", source, async () => {
    throw new Error("untrusted runner fetch must not occur");
  });
} catch (error) {
  alternateRunnerHostRejected = error instanceof PublicHttpError && error.code === "sandbox_misconfigured";
}
assert(alternateRunnerHostRejected, "The private runner token must be bound to the fixed sandbox hostname.");

let accessRejected = false;
try {
  await executeRunner(env, "00000000-0000-4000-8000-000000000010", source, async () => new Response("Access denied", { status: 403 }));
} catch (error) {
  accessRejected = error instanceof PublicHttpError && error.code === "sandbox_upstream_failed";
}
assert(accessRejected, "Wrong Cloudflare Access service credentials must fail closed.");

const healthRequest = new Request(`${env.SANDBOX_PUBLIC_ORIGIN}/api/sandbox/health`, { method: "GET", headers: { authorization: "Bearer verified-user-jwt" } });
assert((await handleSandboxHealth(healthRequest, env, { authenticate: async () => auth, health: async () => true })).status === 200, "Authenticated health should return only sanitized availability.");
assert((await handleSandboxHealth(healthRequest, env, { authenticate: async () => { throw new PublicHttpError(401, "authentication_invalid"); }, health: async () => true })).status === 401, "Anonymous or invalid-token health checks must fail closed.");

console.log("Sandbox proxy smoke test ok.");
