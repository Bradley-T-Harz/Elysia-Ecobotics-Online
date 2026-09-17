import { generateKeyPairSync, sign } from "node:crypto";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { clearAccessJwksCacheForTests, verifyCloudflareAccessAssertion, cloudflareAccessVerificationReason } from "../services/sandbox-runner/accessValidator.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = publicKey.export({ format: "jwk" });
publicJwk.kid = "synthetic-access-key";
publicJwk.alg = "RS256";
publicJwk.use = "sig";

const config = {
  accessRequired: true,
  accessTeamDomain: "https://sandbox-access-test.cloudflareaccess.com",
  accessAudience: "sandbox-access-audience-0001"
};
const now = Date.now();

function assertion(overrides = {}, headerOverrides = {}) {
  const header = { alg: "RS256", typ: "JWT", kid: publicJwk.kid, ...headerOverrides };
  const payload = {
    iss: config.accessTeamDomain,
    aud: config.accessAudience,
    iat: Math.floor(now / 1000) - 1,
    nbf: Math.floor(now / 1000) - 1,
    exp: Math.floor(now / 1000) + 300,
    sub: "synthetic-service-token-fixture",
    ...overrides
  };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  return `${signingInput}.${sign("RSA-SHA256", Buffer.from(signingInput, "ascii"), privateKey).toString("base64url")}`;
}

let fetchCount = 0;
const fetcher = async (url, init) => {
  fetchCount += 1;
  assert(url === `${config.accessTeamDomain}/cdn-cgi/access/certs`, "Access verifier must fetch only the configured team-domain JWKS endpoint.");
  assert(init.redirect === "follow", "Access JWKS retrieval must support the cert endpoint's redirects.");
  return new Response(JSON.stringify({ keys: [publicJwk] }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
};

clearAccessJwksCacheForTests();
assert(await verifyCloudflareAccessAssertion(assertion(), config, { fetcher, now }), "A correctly signed Access assertion should verify.");
assert(await verifyCloudflareAccessAssertion(assertion(), config, { fetcher, now }), "A cached correctly signed Access assertion should continue to verify.");
assert(fetchCount === 1, "Access signing keys should be cached for a bounded interval.");
assert(!await verifyCloudflareAccessAssertion("not-a-jwt", config, { fetcher, now }), "Malformed Access assertions must fail closed.");
const validAssertion = assertion();
const invalidSignatureParts = validAssertion.split(".");
invalidSignatureParts[2] = `${invalidSignatureParts[2].startsWith("A") ? "B" : "A"}${invalidSignatureParts[2].slice(1)}`;
const invalidSignature = invalidSignatureParts.join(".");
assert(!await verifyCloudflareAccessAssertion(invalidSignature, config, { fetcher, now }), "Invalid Access signatures must fail closed.");
assert(!await verifyCloudflareAccessAssertion("a".repeat(16_385), config, { fetcher, now }), "Oversized Access assertions must fail before key retrieval.");
assert(!await verifyCloudflareAccessAssertion(assertion({ aud: "wrong-audience" }), config, { fetcher, now }), "Wrong Access audiences must fail closed.");
assert(!await verifyCloudflareAccessAssertion(assertion({ iss: "https://attacker.cloudflareaccess.com" }), config, { fetcher, now }), "Wrong Access issuers must fail closed.");
assert(!await verifyCloudflareAccessAssertion(assertion({ exp: Math.floor(now / 1000) - 1 }), config, { fetcher, now }), "Expired Access assertions must fail closed.");
assert(!await verifyCloudflareAccessAssertion(assertion({ nbf: Math.floor(now / 1000) + 30 }), config, { fetcher, now }), "Not-yet-valid Access assertions must fail closed.");
assert(!await verifyCloudflareAccessAssertion(assertion({}, { alg: "none" }), config, { fetcher, now }), "Unexpected JWT algorithms must fail closed.");
assert(!await verifyCloudflareAccessAssertion(assertion({}, { kid: "unknown-key" }), config, { fetcher, now }), "Unknown Access signing keys must fail closed after one safe refresh.");
assert(fetchCount === 2, "An unknown Access key id should trigger exactly one JWKS refresh.");
assert(!await verifyCloudflareAccessAssertion(assertion(), { ...config, accessRequired: false }, { fetcher, now }), "Origin validation must never report success when Access is not required by configuration.");
assert(!await verifyCloudflareAccessAssertion(assertion(), config, {
  fetcher: async () => new Response("unavailable", { status: 503 }),
  cache: new Map(),
  now
}), "Unavailable Access signing keys must fail closed.");
assert(!await verifyCloudflareAccessAssertion(assertion(), config, {
  fetcher: async () => new Response("x".repeat(65_537), { status: 200, headers: { "content-length": "65537" } }),
  cache: new Map(),
  now
}), "Oversized Access JWKS responses must fail closed.");

const reasonCases = [
  [assertion(), { ...config, accessAudience: "" }, fetcher, "access_config_invalid"],
  [null, config, fetcher, "access_assertion_missing"],
  ["SENSITIVE_TOKEN_CANARY", config, fetcher, "access_assertion_malformed"],
  [assertion({ aud: "wrong-audience", sub: "SENSITIVE_CLAIM_CANARY" }), config, fetcher, "access_claims_invalid"],
  [assertion(), config, async () => { throw new Error("SENSITIVE_EXCEPTION_CANARY"); }, "access_jwks_unavailable"],
  [assertion({}, { kid: "unknown-key" }), config, fetcher, "access_kid_not_found"],
  [assertion(), config, async () => Response.json({ keys: [{ ...publicJwk, key_ops: ["sign"] }] }), "access_jwks_invalid"],
  [invalidSignature, config, fetcher, "access_signature_invalid"],
  [assertion(), config, fetcher, "access_verified"]
];
for (const [token, settings, provider, expected] of reasonCases) {
  const result = await cloudflareAccessVerificationReason(token, settings, { fetcher: provider, now, cache: new Map() });
  assert(result === expected, `Access diagnostic mismatch: expected ${expected}, received ${result}.`);
  assert(await verifyCloudflareAccessAssertion(token, settings, { fetcher: provider, now, cache: new Map() }) === (expected === "access_verified"), "The existing boolean contract must remain fail closed.");
}

// Exercise the actual Workers runtime without Node globals. Ordinary Node
// tests cannot catch a validator that implicitly depends on global Buffer.
const bundle = await build({ stdin: {
  resolveDir: fileURLToPath(new URL("../services/sandbox-runner/", import.meta.url)),
  contents: `import { verifyCloudflareAccessAssertion, cloudflareAccessVerificationReason } from "./accessValidator.mjs";
    // Some local workerd versions expose Buffer even without nodejs_compat.
    // Remove it explicitly so local shims cannot hide a deployed dependency.
    Object.defineProperty(globalThis, "Buffer", { value: undefined, configurable: true });
    export default { async fetch(request) {
      const { token, invalidToken, config, now, jwk } = await request.json();
      let fetches = 0;
      const cache = new Map();
      const fetcher = async () => {
        fetches++;
        const bytes = new TextEncoder().encode(JSON.stringify({ note: "synthetic-雪", keys: [jwk] }));
        const split = bytes.indexOf(0xe9) + 1; // Split a multibyte UTF-8 character.
        return new Response(new ReadableStream({ start(controller) {
          controller.enqueue(bytes.slice(0, split));
          controller.enqueue(bytes.slice(split));
          controller.close();
        } }));
      };
      const options = { fetcher, cache, now };
      const valid = await verifyCloudflareAccessAssertion(token, config, options);
      const cached = await verifyCloudflareAccessAssertion(token, config, options);
      const invalid = await verifyCloudflareAccessAssertion(invalidToken, config, options);
      const reason = await cloudflareAccessVerificationReason(token, config, options);
      const invalidReason = await cloudflareAccessVerificationReason(invalidToken, config, options);
      const oversized = await verifyCloudflareAccessAssertion(token, config, {
        now, cache: new Map(), fetcher: async () => new Response(new Uint8Array(65_537))
      });
      const badKey = await verifyCloudflareAccessAssertion(token, config, {
        now, cache: new Map(), fetcher: async () => Response.json({ keys: [{ ...jwk, n: "!" }] })
      });
      // Native fetch against a synthetic redirecting cert endpoint, not a stub
      // that accepts redirect options without exercising Workers semantics.
      const redirectError = await cloudflareAccessVerificationReason(token, config, {
        now, cache: new Map(), fetcher: (url, init) => fetch(url, { ...init, redirect: "error" })
      });
      const redirectFollow = await cloudflareAccessVerificationReason(token, config, {
        now, cache: new Map(), fetcher: (url, init) => fetch(url, { ...init, redirect: "follow" })
      });
      const redirectCache = new Map();
      const redirectActual = await cloudflareAccessVerificationReason(token, config, { now, cache: redirectCache });
      const redirectCached = await cloudflareAccessVerificationReason(token, config, { now, cache: redirectCache });
      return Response.json({ bufferAbsent: typeof Buffer === "undefined", valid, cached, invalid, oversized, badKey, fetches, reason, invalidReason, redirectError, redirectFollow, redirectActual, redirectCached });
    } };`
}, bundle: true, write: false, format: "esm", platform: "browser" });
const runtime = new Miniflare(convertV4MiniflareOptions({ cf: false, workers: [{
  name: "access-regression", modules: true, script: bundle.outputFiles[0].text,
  // Pinned to the installed workerd binary; no Node compatibility/polyfills.
  compatibilityDate: "2026-08-27", compatibilityFlags: [],
  outboundService: "access-jwks-upstream"
}, {
  name: "access-jwks-upstream", modules: true, compatibilityDate: "2026-08-27",
  bindings: { JWK: publicJwk },
  script: `export default { fetch(request, env) {
    if (["authorization", "cookie", "cf-access-jwt-assertion"].some(name => request.headers.has(name))) return new Response(null, { status: 400 });
    const endpoint = "${config.accessTeamDomain}/cdn-cgi/access/certs";
    if (request.url === endpoint) return Response.redirect(endpoint + "/", 302);
    if (request.url === endpoint + "/") return Response.json({ keys: [env.JWK] });
    return new Response(null, { status: 404 });
  } };`,
  outboundService: async () => { throw new Error("External network is forbidden in this test"); }
}] }));
try {
  const response = await runtime.dispatchFetch("https://access-regression.invalid/", {
    method: "POST", body: JSON.stringify({ token: assertion({ sub: "synthetic-雪" }), invalidToken: invalidSignature, config, now, jwk: publicJwk })
  });
  const result = await response.json();
  assert(result.bufferAbsent, `Workers regression must run without global Buffer: ${JSON.stringify(result)}`);
  assert(result.valid && result.cached, "Valid Access assertions and chunked JWKS must verify in workerd without Node globals.");
  assert(result.fetches === 1, "Workers verification must preserve the JWKS cache.");
  assert(result.reason === "access_verified" && result.invalidReason === "access_signature_invalid", "Workers diagnostics must expose only fixed verification reasons.");
  assert(!result.invalid && !result.oversized && !result.badKey, "Workers signature, streamed size and invalid JWK checks must fail closed.");
  assert(result.redirectError === "access_jwks_unavailable" && result.redirectFollow === "access_verified", "Native Workers fetch must reproduce the redirect-mode failure and successful control.");
  assert(result.redirectActual === "access_verified" && result.redirectCached === "access_verified", "JWKS retrieval must support the legitimate cert redirect and cache the validated keys.");
} finally { await runtime.dispose(); }

console.log("Sandbox Cloudflare Access assertion smoke test ok, including native workerd without Buffer.");
