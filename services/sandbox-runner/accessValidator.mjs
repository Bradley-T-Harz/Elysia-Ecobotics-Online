const MAX_ASSERTION_BYTES = 16_384;
const MAX_JWKS_BYTES = 65_536;
const JWKS_CACHE_MS = 5 * 60_000;
const defaultCache = new Map();
const utf8Encoder = new TextEncoder();
// Preserve a leading BOM as Buffer's UTF-8 decoding did; JSON must reject it.
const utf8Decoder = new TextDecoder("utf-8", { ignoreBOM: true });

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function decodeSegment(segment) {
  if (typeof segment !== "string" || !segment || !/^[A-Za-z0-9_-]+$/.test(segment)) throw new Error("access_assertion_invalid");
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function parseAssertion(assertion) {
  if (typeof assertion !== "string" || assertion.length > MAX_ASSERTION_BYTES || utf8Encoder.encode(assertion).byteLength > MAX_ASSERTION_BYTES) {
    throw new Error("access_assertion_invalid");
  }
  const segments = assertion.split(".");
  if (segments.length !== 3) throw new Error("access_assertion_invalid");
  const header = object(JSON.parse(utf8Decoder.decode(decodeSegment(segments[0]))));
  const payload = object(JSON.parse(utf8Decoder.decode(decodeSegment(segments[1]))));
  const signature = decodeSegment(segments[2]);
  if (!header || !payload || header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid) {
    throw new Error("access_assertion_invalid");
  }
  return { header, payload, signature, signingInput: `${segments[0]}.${segments[1]}` };
}

async function readBoundedJson(response) {
  const length = response.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_JWKS_BYTES)) throw new Error("access_jwks_invalid");
  if (!response.body) throw new Error("access_jwks_invalid");
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_JWKS_BYTES) {
        await reader.cancel();
        throw new Error("access_jwks_invalid");
      }
      chunks.push(new Uint8Array(value));
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(utf8Decoder.decode(bytes));
}

function normalizeJwks(value) {
  const document = object(value);
  if (!document || !Array.isArray(document.keys) || document.keys.length < 1 || document.keys.length > 8) {
    throw new Error("access_jwks_invalid");
  }
  const keys = new Map();
  for (const candidate of document.keys) {
    const key = object(candidate);
    if (
      !key
      || key.kty !== "RSA"
      || typeof key.kid !== "string"
      || !key.kid
      || typeof key.n !== "string"
      || typeof key.e !== "string"
      || (key.alg !== undefined && key.alg !== "RS256")
      || (key.use !== undefined && key.use !== "sig")
    ) continue;
    keys.set(key.kid, key);
  }
  if (!keys.size) throw new Error("access_jwks_invalid");
  return keys;
}

async function fetchJwks(config, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_500);
  try {
    const response = await (options.fetcher ?? fetch)(`${config.accessTeamDomain}/cdn-cgi/access/certs`, {
      method: "GET",
      headers: { accept: "application/json" },
      redirect: "follow",
      signal: controller.signal
    });
    if (!response.ok) throw new Error("access_jwks_unavailable");
    return normalizeJwks(await readBoundedJson(response));
  } finally {
    clearTimeout(timeout);
  }
}

async function keyFor(assertionKid, config, options) {
  const cache = options.cache ?? defaultCache;
  const now = options.now ?? Date.now();
  const cacheKey = `${config.accessTeamDomain}|${config.accessAudience}`;
  let entry = cache.get(cacheKey);
  if (!entry || entry.expiresAt <= now) {
    entry = { keys: await fetchJwks(config, options), expiresAt: now + JWKS_CACHE_MS };
    cache.set(cacheKey, entry);
  }
  let key = entry.keys.get(assertionKid);
  if (!key) {
    entry = { keys: await fetchJwks(config, options), expiresAt: now + JWKS_CACHE_MS };
    cache.set(cacheKey, entry);
    key = entry.keys.get(assertionKid);
  }
  return key ?? null;
}

function claimsAreValid(payload, config, nowMilliseconds) {
  const now = Math.floor(nowMilliseconds / 1000);
  const audience = payload.aud;
  const audienceMatches = typeof audience === "string"
    ? audience === config.accessAudience
    : Array.isArray(audience) && audience.every((value) => typeof value === "string") && audience.includes(config.accessAudience);
  return payload.iss === config.accessTeamDomain
    && audienceMatches
    && Number.isInteger(payload.exp)
    && payload.exp > now
    && (payload.nbf === undefined || (Number.isInteger(payload.nbf) && payload.nbf <= now))
    && (payload.iat === undefined || (Number.isInteger(payload.iat) && payload.iat <= now + 30));
}

// Return only fixed stage codes. Never expose claims, key data or exceptions.
// Callers opt into diagnostics; this shared validator does not log anything.
export async function cloudflareAccessVerificationReason(assertion, config, options = {}) {
  let reason = "access_config_invalid";
  try {
    if (!config?.accessRequired || !config.accessTeamDomain || !config.accessAudience) return reason;
    if (assertion === null || assertion === undefined || assertion === "") return "access_assertion_missing";
    reason = "access_assertion_malformed";
    const parsed = parseAssertion(assertion);
    reason = "access_claims_invalid";
    if (!claimsAreValid(parsed.payload, config, options.now ?? Date.now())) return reason;
    reason = "access_jwks_unavailable";
    const jwk = await keyFor(parsed.header.kid, config, options);
    if (!jwk) return "access_kid_not_found";
    reason = "access_jwks_invalid";
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    reason = "access_signature_invalid";
    const verified = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      parsed.signature,
      utf8Encoder.encode(parsed.signingInput)
    );
    return verified ? "access_verified" : reason;
  } catch {
    return reason;
  }
}

export async function verifyCloudflareAccessAssertion(assertion, config, options = {}) {
  return await cloudflareAccessVerificationReason(assertion, config, options) === "access_verified";
}

export function clearAccessJwksCacheForTests() {
  defaultCache.clear();
}
