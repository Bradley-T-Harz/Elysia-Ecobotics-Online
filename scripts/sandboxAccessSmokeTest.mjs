import { generateKeyPairSync, sign } from "node:crypto";
import { clearAccessJwksCacheForTests, verifyCloudflareAccessAssertion } from "../services/sandbox-runner/accessValidator.mjs";

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
  assert(init.redirect === "error", "Access JWKS retrieval must refuse redirects.");
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

console.log("Sandbox Cloudflare Access assertion smoke test ok.");
