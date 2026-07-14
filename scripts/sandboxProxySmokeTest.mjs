import { PublicHttpError, fetchWithTimeout } from "../functions/api/sandbox/_shared/http.ts";
import { authenticateRequest } from "../functions/api/sandbox/_shared/auth.ts";
import { startRun } from "../functions/api/sandbox/_shared/database.ts";
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
    start: async (_auth, runId, clientRequestId) => ({ runId, clientRequestId, status: "running", leaseExpiresAt: new Date(Date.now() + 60_000).toISOString() }),
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
assert((await handleSandboxRun(request({}, { ...env, SANDBOX_ENABLED: "TRUE" }), { ...env, SANDBOX_ENABLED: "TRUE" }, dependencies())).status === 503, "Malformed enabled values must fail closed.");
assert((await handleSandboxRun(request({ method: "GET" }), env, dependencies())).status === 405, "Unsupported proxy methods must fail closed.");
assert((await handleSandboxRun(request({ contentType: "text/plain" }), env, dependencies())).status === 415, "Non-JSON execution requests must fail closed.");
assert((await handleSandboxRun(request({ origin: "https://attacker.example" }), env, dependencies())).status === 403, "Cross-origin sandbox requests must fail closed.");

for (const [name, misconfigured] of [
  ["runner endpoint", { SANDBOX_SERVICE_URL: "" }],
  ["runner token", { SANDBOX_SERVICE_TOKEN: "" }],
  ["Access client id", { CLOUDFLARE_ACCESS_CLIENT_ID: "" }],
  ["Access client secret", { CLOUDFLARE_ACCESS_CLIENT_SECRET: "" }],
  ["database finalizer token", { SANDBOX_DB_FINALIZER_TOKEN: "" }],
  ["placeholder runner token", { SANDBOX_SERVICE_TOKEN: "replace-with-a-placeholder-runner-token-value" }],
  ["placeholder Access secret", { CLOUDFLARE_ACCESS_CLIENT_SECRET: "REPLACE_WITH_ACCESS_CLIENT_SECRET" }],
  ["placeholder finalizer", { SANDBOX_DB_FINALIZER_TOKEN: "REPLACE_WITH_SANDBOX_FINALIZER_TOKEN" }]
]) {
  let dependencyTouched = false;
  const brokenEnv = { ...env, ...misconfigured };
  const response = await handleSandboxRun(request({}, brokenEnv), brokenEnv, dependencies({
    authenticate: async () => { dependencyTouched = true; return auth; },
    reserve: async () => { dependencyTouched = true; throw new Error("must not reserve"); }
  }));
  assert(response.status === 503 && !dependencyTouched, `Missing ${name} must fail before authentication or reservation.`);
}
let anonymousRejected = false;
try {
  await authenticateRequest(new Request(`${env.SANDBOX_PUBLIC_ORIGIN}/api/sandbox/health`), env);
} catch (error) {
  anonymousRejected = error instanceof PublicHttpError && error.status === 401 && error.code === "authentication_required";
}
assert(anonymousRejected, "An anonymous request must fail before any Supabase or runner call.");
assert((await handleSandboxRun(request(), env, dependencies({ authenticate: async () => { throw new PublicHttpError(401, "authentication_invalid"); } }))).status === 401, "Invalid Supabase tokens must fail closed.");
let untrustedSupabaseOriginRejected = false;
try {
  await authenticateRequest(new Request(`${env.SANDBOX_PUBLIC_ORIGIN}/api/sandbox/health`, { headers: { authorization: "Bearer synthetic-user-token" } }), { ...env, SUPABASE_URL: "https://attacker.example" });
} catch (error) {
  untrustedSupabaseOriginRejected = error instanceof PublicHttpError && error.status === 503 && error.code === "sandbox_misconfigured";
}
assert(untrustedSupabaseOriginRejected, "Supabase user JWTs must never be forwarded to an untrusted configured origin.");
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
  start: async (_auth, runId, clientRequestId) => {
    startKey = clientRequestId;
    return { runId, clientRequestId, status: "running", leaseExpiresAt: new Date(Date.now() + 60_000).toISOString() };
  },
  finalize: async (_auth, _runId, clientRequestId) => { finalizeKey = clientRequestId; return true; }
}));
assert(keyedResult.status === 200 && startKey === body.clientRequestId && finalizeKey === body.clientRequestId, "Start and finalization must bind the exact reservation idempotency key.");

const startLease = new Date(Date.now() + 60_000).toISOString();
const startReceipt = await startRun({
  rpc: async () => ({ data: { runId: "00000000-0000-4000-8000-000000000010", status: "running", leaseExpiresAt: startLease }, error: null })
}, "00000000-0000-4000-8000-000000000010", body.clientRequestId, env.SANDBOX_DB_FINALIZER_TOKEN);
assert(startReceipt.status === "running" && startReceipt.leaseExpiresAt === startLease, "The proxy must preserve the database-issued start receipt.");
let invalidStartReceiptRejected = false;
try {
  await startRun({
    rpc: async () => ({ data: { runId: "00000000-0000-4000-8000-000000000099", status: "running", leaseExpiresAt: startLease }, error: null })
  }, "00000000-0000-4000-8000-000000000010", body.clientRequestId, env.SANDBOX_DB_FINALIZER_TOKEN);
} catch (error) {
  invalidStartReceiptRejected = error instanceof PublicHttpError && error.code === "reservation_start_invalid";
}
assert(invalidStartReceiptRejected, "A mismatched database start receipt must fail closed before runner execution.");

let forwardedHeaders;
let forwardedBody;
const startedReservation = {
  runId: "00000000-0000-4000-8000-000000000010",
  clientRequestId: body.clientRequestId,
  status: "running",
  leaseExpiresAt: new Date(Date.now() + 60_000).toISOString()
};
const actualRunnerResult = await executeRunner(env, startedReservation, source, async (_url, init) => {
  forwardedHeaders = new Headers(init.headers);
  forwardedBody = JSON.parse(String(init.body));
  return new Response(JSON.stringify({
    ok: true,
    status: "completed",
    language: "javascript",
    stdout: `safe ${env.SANDBOX_SERVICE_TOKEN} ${env.CLOUDFLARE_ACCESS_CLIENT_SECRET}\n`,
    stderr: "",
    exitCode: 0,
    durationMs: 4,
    outputTruncated: false,
    diagnostics: [{ severity: "error", phase: "sandbox", category: "podman_internal", message: "token=private /opt/internal", source: "Podman engine" }],
    message: `Podman raw exception at /opt/private token=hidden ${env.SANDBOX_DB_FINALIZER_TOKEN}`,
    engine: "must-not-reach-browser",
    internalPath: "/private/path"
  }), { status: 200, headers: { "content-type": "application/json" } });
});
assert(forwardedHeaders.get("authorization") === `Bearer ${env.SANDBOX_SERVICE_TOKEN}`, "Proxy must attach only the private runner bearer token upstream.");
assert(forwardedHeaders.get("cf-access-client-id") === env.CLOUDFLARE_ACCESS_CLIENT_ID && forwardedHeaders.get("cf-access-client-secret") === env.CLOUDFLARE_ACCESS_CLIENT_SECRET, "Proxy must attach both Cloudflare Access service-auth headers.");
assert(!JSON.stringify(forwardedHeaders).includes(auth.accessToken) && !JSON.stringify(forwardedBody).includes(auth.accessToken), "User JWT must never reach Hetzner.");
assert(!("sourceType" in forwardedBody) && !("sourceId" in forwardedBody) && !("userId" in forwardedBody), "Private source/account context must not reach Hetzner.");
assert(!JSON.stringify(forwardedBody).includes(env.SANDBOX_DB_FINALIZER_TOKEN) && !JSON.stringify(forwardedBody).includes(env.CLOUDFLARE_ACCESS_CLIENT_SECRET), "Finalizer and Access credentials must never enter the runner request body.");
assert(forwardedBody.reservation_id === startedReservation.runId && forwardedBody.client_request_id === body.clientRequestId && forwardedBody.lease_expires_at === startedReservation.leaseExpiresAt, "Runner requests must bind the exact started reservation and lease.");
assert(forwardedBody.code_bytes === new TextEncoder().encode(source.code).byteLength && /^[0-9a-f]{64}$/.test(forwardedBody.code_sha256), "Runner requests must carry verified code byte count and SHA-256 association metadata.");
assert(!("engine" in actualRunnerResult) && !JSON.stringify(actualRunnerResult).includes("/private/path") && !JSON.stringify(actualRunnerResult).includes("Podman") && !JSON.stringify(actualRunnerResult).includes("/opt/"), "Runner internals must be stripped from the public result.");
assert(!JSON.stringify(actualRunnerResult).includes(env.SANDBOX_SERVICE_TOKEN) && !JSON.stringify(actualRunnerResult).includes(env.CLOUDFLARE_ACCESS_CLIENT_SECRET) && !JSON.stringify(actualRunnerResult).includes(env.SANDBOX_DB_FINALIZER_TOKEN), "Configured credentials must be redacted even if a compromised upstream reflects them.");
assert(actualRunnerResult.diagnostics[0]?.category === "sandbox_internal_failure" && actualRunnerResult.diagnostics[0]?.source === "Coding Cornucopia sandbox", "Runner-chosen diagnostic metadata must be replaced by proxy allowlists.");

const utf8RunnerResult = await executeRunner(env, startedReservation, source, async () => new Response(JSON.stringify({
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

let oversizedRunnerResponseRejected = false;
try {
  await executeRunner(env, startedReservation, source, async () => new Response(JSON.stringify({ ok: false, padding: "x".repeat(120_000) }), { status: 200 }));
} catch (error) {
  oversizedRunnerResponseRejected = error instanceof PublicHttpError && error.code === "upstream_response_invalid";
}
assert(oversizedRunnerResponseRejected, "Oversized runner responses must be rejected without reaching the browser.");

let timeoutRejected = false;
try {
  await fetchWithTimeout("https://sandbox.elysiaecobotics.com/health", {}, 1, async (_input, init) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }));
} catch (error) {
  timeoutRejected = error instanceof PublicHttpError && error.code === "upstream_timeout";
}
assert(timeoutRejected, "Upstream timeouts must abort and return a stable sanitized error.");

let alternateRunnerHostRejected = false;
try {
  await executeRunner({ ...env, SANDBOX_SERVICE_URL: "https://attacker.example" }, startedReservation, source, async () => {
    throw new Error("untrusted runner fetch must not occur");
  });
} catch (error) {
  alternateRunnerHostRejected = error instanceof PublicHttpError && error.code === "sandbox_misconfigured";
}
assert(alternateRunnerHostRejected, "The private runner token must be bound to the fixed sandbox hostname.");

let accessRejected = false;
try {
  await executeRunner(env, startedReservation, source, async () => new Response("Access denied", { status: 403 }));
} catch (error) {
  accessRejected = error instanceof PublicHttpError && error.code === "sandbox_upstream_failed";
}
assert(accessRejected, "Wrong Cloudflare Access service credentials must fail closed.");

const healthRequest = new Request(`${env.SANDBOX_PUBLIC_ORIGIN}/api/sandbox/health`, { method: "GET", headers: { authorization: "Bearer verified-user-jwt" } });
const healthResponse = await handleSandboxHealth(healthRequest, env, { authenticate: async () => auth, health: async () => true });
assert(healthResponse.status === 200 && healthResponse.headers.get("cache-control") === "no-store", "Authenticated health should return only non-cacheable sanitized availability.");
assert((await handleSandboxHealth(healthRequest, env, { authenticate: async () => { throw new PublicHttpError(401, "authentication_invalid"); }, health: async () => true })).status === 401, "Anonymous or invalid-token health checks must fail closed.");

const oversizedCodeResponse = await handleSandboxRun(request({ body: { code: "x".repeat(65_537) } }), env, dependencies());
assert(oversizedCodeResponse.status === 413, "Oversized submitted code must fail before reservation or runner execution.");

console.log("Sandbox proxy smoke test ok.");
