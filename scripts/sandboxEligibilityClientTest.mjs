import assert from "node:assert/strict";
import {
  initialSandboxEligibility,
  parseSandboxPublicErrorCode,
  requestSandboxEligibility,
  SANDBOX_PROFILE_SETUP_PATH,
  sandboxEligibilityFromCode
} from "../src/pages/The-Elysia-Commune/sandboxEligibilityClient.ts";

const fixtureToken = "synthetic-user-token-that-is-never-a-production-credential";

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "cache-control": "no-store", "content-type": "application/json" }
  });
}

assert.equal(initialSandboxEligibility(true, fixtureToken).state, "checking", "A signed-in UI must check server eligibility instead of assuming it.");
assert.equal(initialSandboxEligibility(false, null).state, "authentication_required", "An anonymous UI must remain unavailable.");
assert.equal(SANDBOX_PROFILE_SETUP_PATH, "/commons-circle/setup/profile", "The sandbox prerequisite must use the canonical Commons Profile setup route.");
assert.equal(parseSandboxPublicErrorCode({ error: "profile_required" }), "profile_required");
assert.equal(parseSandboxPublicErrorCode({ error: "private_database_detail" }), null, "Unknown server details must not become public error categories.");

const profileState = sandboxEligibilityFromCode("profile_required");
assert.equal(profileState.available, false);
assert.equal(profileState.title, "Commons Profile required");
assert.match(profileState.message, /Create or finish your Commons Profile/);
assert.doesNotMatch(profileState.message, /internal failure/i);

for (const [status, error, expected] of [
  [401, "authentication_required", "authentication_required"],
  [401, "authentication_invalid", "authentication_invalid"],
  [403, "profile_required", "profile_required"],
  [403, "account_inactive", "account_inactive"],
  [403, "sandbox_not_authorized", "sandbox_not_authorized"],
  [403, "source_unauthorized", "source_unauthorized"],
  [403, "origin_denied", "origin_denied"],
  [503, "sandbox_disabled", "sandbox_disabled"],
  [503, "sandbox_service_unavailable", "sandbox_service_unavailable"],
  [503, "runner_unavailable", "runner_unavailable"],
  [500, "internal_failure", "internal_failure"]
]) {
  let observedRequest;
  const eligibility = await requestSandboxEligibility(fixtureToken, async (input, init) => {
    observedRequest = { input, init };
    return json({ ok: false, error }, status);
  });
  assert.equal(eligibility.state, expected, `${error} must survive the authenticated health response.`);
  assert.equal(observedRequest.input, "/api/sandbox/health");
  assert.equal(observedRequest.init.method, "GET");
  assert.equal(observedRequest.init.credentials, "same-origin");
  assert.equal(observedRequest.init.cache, "no-store");
  assert.equal(observedRequest.init.headers.authorization, `Bearer ${fixtureToken}`);
}

const available = await requestSandboxEligibility(fixtureToken, async () => json({ ok: true, status: "available" }, 200));
assert.equal(available.state, "available");
assert.equal(available.available, true);

const unknownUnauthorized = await requestSandboxEligibility(fixtureToken, async () => json({ private: "detail" }, 401));
assert.equal(unknownUnauthorized.state, "authentication_invalid", "A malformed 401 must still remain an authentication failure.");
const oversized = await requestSandboxEligibility(fixtureToken, async () => new Response("x".repeat(9_000), { status: 503 }));
assert.equal(oversized.state, "sandbox_service_unavailable", "An oversized health response must be discarded safely.");

let missingTokenFetches = 0;
const missingToken = await requestSandboxEligibility(null, async () => {
  missingTokenFetches += 1;
  throw new Error("must not fetch");
});
assert.equal(missingToken.state, "authentication_required");
assert.equal(missingTokenFetches, 0, "Missing authentication must not contact the health route.");

console.log("Sandbox eligibility and safe-error client state test ok.");
