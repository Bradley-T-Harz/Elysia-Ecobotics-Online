import fs from "node:fs/promises";
import { handleIdentityProxy } from "../functions/api/identity/[[path]].ts";
import { handlePublicAvatarProxy } from "../functions/api/public/profile-avatars/[mediaId].ts";
import { handlePublicBannerProxy } from "../functions/api/public/profile-banners/[mediaId].ts";
import { hmacSha256Text } from "../services/identity-worker/_shared/crypto.ts";
import {
  authenticateIdentityRequest,
  DESTRUCTIVE_MFA_MAX_AGE_SECONDS,
  mfaVerifiedAtFromAccessToken,
  requireFreshAal2,
  safeIdentityJwtMetadata,
  STAFF_MFA_MAX_AGE_SECONDS,
} from "../services/identity-worker/_shared/auth.ts";
import { assertYouthFlagsSafe, identityFeatureState } from "../services/identity-worker/_shared/config.ts";
import { allowedOrigins, fetchWithTimeout, IdentityHttpError, requireSameOriginMutation } from "../services/identity-worker/_shared/http.ts";
import {
  accountExportProvider,
  accountExportTtlDays,
  assertLifecycleOperatorEnabled,
  authDeletionProvider,
  exportRetentionProvider,
  lifecycleExecutionProvider,
  notificationDeliveryProvider,
  storageCleanupProvider,
  transitionRequiresExecutionEvidence,
} from "../services/identity-worker/_shared/lifecycle.ts";
import { ageAssuranceProvider, guardianConsentProvider } from "../services/identity-worker/_shared/providers.ts";
import { acceptancesValue, httpsReturnUrl, nullableTimeValue, publicHandleValue, uuidValue } from "../services/identity-worker/_shared/schema.ts";
import { verifyTurnstile } from "../services/identity-worker/_shared/turnstile.ts";
import {
  assertUnder13WorkerFeature,
  handleIdentityRequest,
  handleIdentityScheduledMaintenance,
  providerStartResult,
} from "../services/identity-worker/worker.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function throwsCode(operation, code, message) {
  let caught = null;
  try { operation(); }
  catch (error) { caught = error; }
  assert(caught instanceof IdentityHttpError && caught.code === code, message);
}

async function rejectsCode(operation, code) {
  let caught = null;
  try { await operation(); }
  catch (error) { caught = error; }
  assert(caught instanceof IdentityHttpError && caught.code === code, `Expected ${code}, received ${caught?.code ?? caught}`);
}

const onlineOrigin = "https://elysiaecobotics.com";
const initialArtisanOrigin = "https://elysiaartisancollective.pages.dev";
const futureArtisanOrigin = "https://artisans.elysiaecobotics.com";
const env = {
  IDENTITY_ENABLED: "true",
  IDENTITY_ALLOWED_ORIGINS: `${onlineOrigin},${initialArtisanOrigin},${futureArtisanOrigin}`,
  IDENTITY_ADULT_BETA_ENABLED: "false",
  IDENTITY_TEEN_ENABLED: "false",
  IDENTITY_UNDER_13_ENABLED: "false",
  IDENTITY_LIFECYCLE_OPERATOR_ENABLED: "false",
  IDENTITY_LIFECYCLE_EXECUTION_ENABLED: "false",
  IDENTITY_LIFECYCLE_EXECUTION_PROVIDER: "disabled",
  IDENTITY_ACCOUNT_EXPORT_ENABLED: "false",
  IDENTITY_ACCOUNT_EXPORT_PROVIDER: "disabled",
  IDENTITY_ACCOUNT_EXPORT_TTL_DAYS: "7",
  IDENTITY_STORAGE_CLEANUP_ENABLED: "false",
  IDENTITY_STORAGE_CLEANUP_PROVIDER: "disabled",
  IDENTITY_AUTH_DELETION_ENABLED: "false",
  IDENTITY_AUTH_DELETION_PROVIDER: "disabled",
  IDENTITY_NOTIFICATION_DELIVERY_ENABLED: "false",
  IDENTITY_NOTIFICATION_DELIVERY_PROVIDER: "disabled",
  IDENTITY_EXPORT_RETENTION_ENABLED: "false",
  IDENTITY_EXPORT_RETENTION_PROVIDER: "disabled",
  IDENTITY_EDGE_RATE_LIMIT_CONFIRMED: "true",
  TURNSTILE_REQUIRED: "true",
  TURNSTILE_EXPECTED_HOSTNAMES: "elysiaecobotics.com,elysiaartisancollective.pages.dev,artisans.elysiaecobotics.com",
  TURNSTILE_SECRET_KEY: "turnstile-fixture-secret-value",
  AGE_ASSURANCE_PROVIDER: "disabled",
  GUARDIAN_CONSENT_PROVIDER: "disabled"
};
const requestId = "11111111-1111-4111-8111-111111111111";
const encodeTokenPart = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const accessToken = (payload) => `${encodeTokenPart({ alg: "HS256", typ: "JWT" })}.${encodeTokenPart(payload)}.${"s".repeat(48)}`;
const identityWorkerSource = await fs.readFile(new URL("../services/identity-worker/worker.ts", import.meta.url), "utf8");
const identityDatabaseSource = await fs.readFile(new URL("../services/identity-worker/_shared/database.ts", import.meta.url), "utf8");
const localSupabaseConfig = await fs.readFile(new URL("../supabase/config.toml", import.meta.url), "utf8");
const localTotpConfig = localSupabaseConfig.match(/\[auth\.mfa\.totp\]([\s\S]*?)(?=\n\[|$)/)?.[1] ?? "";
const localPhoneMfaConfig = localSupabaseConfig.match(/\[auth\.mfa\.phone\]([\s\S]*?)(?=\n\[|$)/)?.[1] ?? "";
assert(
  /enroll_enabled\s*=\s*true/.test(localTotpConfig)
    && /verify_enabled\s*=\s*true/.test(localTotpConfig),
  "Local Supabase must permit exercising the required TOTP enrollment and verification flow."
);
assert(
  /enroll_enabled\s*=\s*false/.test(localPhoneMfaConfig)
    && /verify_enabled\s*=\s*false/.test(localPhoneMfaConfig),
  "Phone MFA must remain disabled until its separate provider and threat review exist."
);
assert(
  identityWorkerSource.includes('"all_public_communities"')
    && identityWorkerSource.includes('"artisan_posting"')
    && identityWorkerSource.includes('"artisan_notifications"')
    && !identityWorkerSource.includes('["commons", "artisan", "cross_site", "account"]'),
  "Restriction Worker scopes must match the canonical database scopes exactly."
);
assert(
  identityWorkerSource.includes('"/v1/staff/legal/documents/register"')
    && identityWorkerSource.includes("registerCommunityLegalDocumentVersion")
    && identityWorkerSource.includes("requireFreshAal2(auth, STAFF_MFA_MAX_AGE_SECONDS)")
    && identityWorkerSource.includes("requireFreshAal2(auth, DESTRUCTIVE_MFA_MAX_AGE_SECONDS)"),
  "Exact legal-document registration must stay behind fresh AAL2, with activation using the destructive window."
);
assert(
  identityWorkerSource.includes("updateNotificationPreferencesForActor(createIdentityServerClient(env)")
    && identityWorkerSource.includes("clientRequestId: uuidValue(body.clientRequestId)")
    && !identityWorkerSource.includes("updateCurrentUserNotificationPreferences(auth.supabase"),
  "Notification preferences must use the service-only explicit-actor RPC after direct authenticated mutation grants are revoked."
);
assert(
  identityWorkerSource.includes('"expectedRevisionSha256"')
    && identityWorkerSource.includes("expectedRevisionSha256,")
    && identityDatabaseSource.includes("p_expected_revision_sha256: input.expectedRevisionSha256"),
  "Guardian content decisions must carry the guardian-reviewed revision through the Worker and exact RPC boundary."
);
for (const serviceMutation of [
  "setCurrentUserPublicProfile(createIdentityServerClient(env)",
  "acceptCurrentUserDocuments(createIdentityServerClient(env)",
  "requestCurrentUserLifecycleAction(createIdentityServerClient(env)",
  "cancelCurrentUserCommunityDeletion(createIdentityServerClient(env)",
  "revokeCurrentUserGuardianRelationship(createIdentityServerClient(env)",
  "revokeCurrentUserGuardianConsent(createIdentityServerClient(env)",
]) assert(identityWorkerSource.includes(serviceMutation), `${serviceMutation} must remain behind the explicit-actor service RPC boundary.`);

const origins = allowedOrigins(env);
assert(origins.size === 3 && origins.has(initialArtisanOrigin) && origins.has(futureArtisanOrigin), "Identity origin allowlist lost an exact site origin.");
assert(
  requireSameOriginMutation(new Request(`${initialArtisanOrigin}/api/identity/v1/legal/accept`, { headers: { origin: initialArtisanOrigin } }), env) === initialArtisanOrigin,
  "Exact Artisan mutation origin was rejected."
);
await rejectsCode(
  () => Promise.resolve(requireSameOriginMutation(new Request(`${initialArtisanOrigin}/api/identity/v1/legal/accept`, { headers: { origin: "https://attacker.example" } }), env)),
  "origin_denied"
);
await rejectsCode(
  () => Promise.resolve(httpsReturnUrl("https://attacker.example/callback", origins)),
  "return_url_invalid"
);
assert(httpsReturnUrl(`${futureArtisanOrigin}/account`, origins).startsWith(futureArtisanOrigin), "Allowlisted return URL was rejected.");

assert(uuidValue(requestId) === requestId, "Canonical UUID validation failed.");
assert(nullableTimeValue("22:30") === "22:30" && nullableTimeValue(null) === null, "Quiet-hours validation rejected a canonical value.");
await rejectsCode(() => Promise.resolve(nullableTimeValue("25:00")), "request_invalid");
assert(
  acceptancesValue({ terms: { version: "2026-07-18", contentHash: "a".repeat(64) } }).terms.version === "2026-07-18",
  "Exact legal acceptance contract was rejected."
);
await rejectsCode(
  () => Promise.resolve(acceptancesValue({ terms: { version: "v1", contentHash: "a".repeat(64), accepted: true } })),
  "request_invalid"
);

assert(identityFeatureState(env).teen === false && identityFeatureState(env).under13 === false, "Youth flags did not default off.");

const diagnosticNow = Math.floor(Date.now() / 1_000);
const diagnosticToken = accessToken({
  iss: "https://qwmcstyfegvpzjmjrylc.supabase.co/auth/v1",
  aud: "authenticated",
  exp: diagnosticNow + 3_600,
  sub: requestId,
});
assert(
  JSON.stringify(safeIdentityJwtMetadata(diagnosticToken, diagnosticNow)) === JSON.stringify({
    tokenKind: "jwt",
    issuerHostname: "qwmcstyfegvpzjmjrylc.supabase.co",
    issuerProjectRef: "qwmcstyfegvpzjmjrylc",
    audience: "authenticated",
    expiresAt: diagnosticNow + 3_600,
    expired: false,
    subjectPresent: true,
  }),
  "Safe Identity JWT metadata did not retain only the reviewed non-identifying fields."
);
assert(
  safeIdentityJwtMetadata("not-a-jwt", diagnosticNow).tokenKind === "non_jwt",
  "Malformed bearer material did not remain opaque to diagnostics."
);

const originalFetch = globalThis.fetch;
const originalConsoleInfo = console.info;
const diagnosticLogs = [];
const diagnosticPublishableKey = "sb_publishable_identity_smoke_test_browser_key";
let verifiedOutboundHeaders = false;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  const headers = new Headers(init.headers);
  verifiedOutboundHeaders = url.hostname === "qwmcstyfegvpzjmjrylc.supabase.co"
    && url.pathname === "/auth/v1/user"
    && headers.get("apikey") === diagnosticPublishableKey
    && headers.get("authorization") === `Bearer ${diagnosticToken}`;
  return Response.json({ code: "bad_jwt", message: "fixture detail must not be logged" }, {
    status: 401,
    headers: { "x-supabase-api-version": "2024-01-01" },
  });
};
console.info = (value) => diagnosticLogs.push(String(value));
try {
  await rejectsCode(
    () => authenticateIdentityRequest(new Request(`${initialArtisanOrigin}/api/identity/v1/bootstrap`, {
      headers: { authorization: `Bearer ${diagnosticToken}` },
    }), {
      SUPABASE_URL: "https://qwmcstyfegvpzjmjrylc.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: diagnosticPublishableKey,
    }),
    "authentication_invalid"
  );
} finally {
  globalThis.fetch = originalFetch;
  console.info = originalConsoleInfo;
}
assert(verifiedOutboundHeaders, "Identity authentication did not use the publishable apikey with the user JWT as bearer.");
assert(diagnosticLogs.length === 1, "Identity authentication did not emit exactly one bounded failure diagnostic.");
const diagnosticLog = JSON.parse(diagnosticLogs[0]);
assert(
  diagnosticLog.event === "identity.authentication"
    && diagnosticLog.outcome === "rejected"
    && diagnosticLog.stage === "supabase_user"
    && diagnosticLog.upstreamStatus === 401
    && diagnosticLog.upstreamCode === "bad_jwt"
    && diagnosticLog.errorClass === "AuthApiError"
    && diagnosticLog.jwtIssuerProjectRef === "qwmcstyfegvpzjmjrylc"
    && diagnosticLog.jwtSubjectPresent === true
    && diagnosticLog.keyKind === "sb_publishable",
  "Identity authentication diagnostic omitted a reviewed safe field."
);
assert(
  !diagnosticLogs[0].includes(diagnosticToken)
    && !diagnosticLogs[0].includes(diagnosticPublishableKey)
    && !diagnosticLogs[0].includes(requestId)
    && !diagnosticLogs[0].includes("fixture detail"),
  "Identity authentication diagnostic exposed bearer, key, user, or upstream body material."
);
const fetchFailureLogs = [];
console.info = (value) => fetchFailureLogs.push(String(value));
try {
  await rejectsCode(
    () => fetchWithTimeout("https://diagnostic.invalid", {}, 1_000, async () => {
      throw new TypeError("fixture detail must not be logged");
    }),
    "identity_upstream_fetch_failed"
  );
} finally {
  console.info = originalConsoleInfo;
}
assert(fetchFailureLogs.length === 1, "Identity upstream failure did not emit one bounded diagnostic.");
const fetchFailureLog = JSON.parse(fetchFailureLogs[0]);
assert(
  fetchFailureLog.event === "identity.upstream_fetch"
    && fetchFailureLog.outcome === "failed"
    && fetchFailureLog.errorClass === "TypeError"
    && fetchFailureLog.aborted === false
    && !fetchFailureLogs[0].includes("fixture detail")
    && !fetchFailureLogs[0].includes("diagnostic.invalid"),
  "Identity upstream failure diagnostic exposed details or omitted its safe classification."
);
await rejectsCode(() => Promise.resolve(assertLifecycleOperatorEnabled(env)), "lifecycle_operator_disabled");
await rejectsCode(() => Promise.resolve(lifecycleExecutionProvider(env)), "lifecycle_execution_disabled");
await rejectsCode(() => Promise.resolve(accountExportProvider(env)), "account_export_disabled");
await rejectsCode(() => Promise.resolve(storageCleanupProvider(env)), "storage_cleanup_disabled");
await rejectsCode(() => Promise.resolve(authDeletionProvider(env)), "auth_deletion_disabled");
await rejectsCode(() => Promise.resolve(notificationDeliveryProvider(env)), "notification_delivery_disabled");
await rejectsCode(() => Promise.resolve(exportRetentionProvider(env)), "export_retention_disabled");
assert(accountExportTtlDays(env) === 7, "The bounded account-export TTL was not parsed exactly.");

const mfaNow = Math.floor(Date.now() / 1_000);
const freshMfaAt = mfaVerifiedAtFromAccessToken(accessToken({
  aal: "aal2",
  amr: [{ method: "password", timestamp: mfaNow - 60 }, { method: "totp", timestamp: mfaNow }],
}));
assert(freshMfaAt === mfaNow, "Identity auth did not retain the verified TOTP AMR timestamp.");
const freshIdentityActor = { aal: "aal2", mfaVerifiedAt: freshMfaAt };
requireFreshAal2(freshIdentityActor, DESTRUCTIVE_MFA_MAX_AGE_SECONDS, mfaNow);
for (const payload of [
  { aal: "aal2" },
  { aal: "aal2", amr: ["totp"] },
  { aal: "aal2", amr: [{ method: "mfa/phone", timestamp: mfaNow }] },
  { aal: "aal2", amr: [{ method: "totp", timestamp: "invalid" }] },
  { aal: "aal2", amr: [{ method: "password" }, { method: "totp", timestamp: mfaNow }] },
]) assert(mfaVerifiedAtFromAccessToken(accessToken(payload)) === null, "Malformed or unsupported Identity AMR did not fail closed.");
throwsCode(
  () => requireFreshAal2({ aal: "aal2", mfaVerifiedAt: mfaNow + 1 }, STAFF_MFA_MAX_AGE_SECONDS, mfaNow),
  "fresh_aal2_required",
  "A future MFA timestamp was accepted."
);
throwsCode(
  () => requireFreshAal2({ aal: "aal2", mfaVerifiedAt: mfaNow - STAFF_MFA_MAX_AGE_SECONDS - 1 }, STAFF_MFA_MAX_AGE_SECONDS, mfaNow),
  "fresh_aal2_required",
  "An expired staff MFA window was accepted."
);
throwsCode(
  () => requireFreshAal2({ aal: "aal2", mfaVerifiedAt: mfaNow - DESTRUCTIVE_MFA_MAX_AGE_SECONDS - 1 }, DESTRUCTIVE_MFA_MAX_AGE_SECONDS, mfaNow),
  "fresh_aal2_required",
  "An access-token refresh could substitute for destructive-action reauthentication."
);
await rejectsCode(
  () => Promise.resolve(accountExportTtlDays({ ...env, IDENTITY_ACCOUNT_EXPORT_TTL_DAYS: "31" })),
  "account_export_misconfigured"
);
assert(
  accountExportProvider({
    ...env,
    IDENTITY_ACCOUNT_EXPORT_ENABLED: "true",
    IDENTITY_ACCOUNT_EXPORT_PROVIDER: "private-r2-json-v1",
  }).encryptionAtRest === "r2-managed-aes-256-gcm",
  "Account export provider lost its private encrypted-at-rest contract."
);
assert(
  storageCleanupProvider({
    ...env,
    IDENTITY_STORAGE_CLEANUP_ENABLED: "true",
    IDENTITY_STORAGE_CLEANUP_PROVIDER: "scoped-private-object-cleanup-v1",
  }).receivesArtisanEvidence === false,
  "Lifecycle cleanup must never receive the Artisan evidence bucket."
);
assert(
  authDeletionProvider({
    ...env,
    IDENTITY_AUTH_DELETION_ENABLED: "true",
    IDENTITY_AUTH_DELETION_PROVIDER: "supabase-auth-soft-delete-v1",
  }).softDeleteRequired,
  "Auth deletion adapter must require Supabase soft deletion."
);
assert(
  notificationDeliveryProvider({
    ...env,
    IDENTITY_NOTIFICATION_DELIVERY_ENABLED: "true",
    IDENTITY_NOTIFICATION_DELIVERY_PROVIDER: "database-in-app-v1",
  }).sendsExternalEmail === false,
  "The in-app notification adapter must never claim external email delivery."
);
assert(
  notificationDeliveryProvider({
    ...env,
    IDENTITY_NOTIFICATION_DELIVERY_ENABLED: "true",
    IDENTITY_NOTIFICATION_DELIVERY_PROVIDER: "cloudflare-email-service-v1",
  }).sendsExternalEmail === true,
  "The reviewed Cloudflare transactional email provider was not selectable behind its explicit flag."
);
assert(
  exportRetentionProvider({
    ...env,
    IDENTITY_EXPORT_RETENTION_ENABLED: "true",
    IDENTITY_EXPORT_RETENTION_PROVIDER: "private-export-expiry-v1",
  }).respectsDatabaseLegalHolds,
  "Export retention execution must remain subordinate to database legal holds."
);
assert(
  exportRetentionProvider({
    ...env,
    IDENTITY_EXPORT_RETENTION_ENABLED: "true",
    IDENTITY_EXPORT_RETENTION_PROVIDER: "private-export-expiry-v1",
  }).receivesArtisanMedia === false,
  "Identity export retention must never claim Artisan media work."
);
await rejectsCode(
  () => Promise.resolve(lifecycleExecutionProvider({
    ...env,
    IDENTITY_LIFECYCLE_EXECUTION_ENABLED: "true",
    IDENTITY_LIFECYCLE_EXECUTION_PROVIDER: "unreviewed-provider"
  })),
  "lifecycle_execution_disabled"
);
assert(
  transitionRequiresExecutionEvidence("storage_cleanup")
    && transitionRequiresExecutionEvidence("auth_deletion_confirmed")
    && transitionRequiresExecutionEvidence("completed")
    && !transitionRequiresExecutionEvidence("operator_review"),
  "Lifecycle transition evidence gate no longer separates review from externally evidenced execution."
);
assert(
  identityFeatureState({ ...env, AGE_ASSURANCE_PROVIDER: "unreviewed-vendor", GUARDIAN_CONSENT_PROVIDER: "unreviewed-vendor" }).ageProvider === false,
  "An unsupported provider name must never be reported as operational."
);
await rejectsCode(
  () => Promise.resolve(assertYouthFlagsSafe({ ...env, IDENTITY_UNDER_13_ENABLED: "true" })),
  "under13_requires_teen_foundation"
);
await rejectsCode(
  () => Promise.resolve(assertYouthFlagsSafe({ ...env, IDENTITY_TEEN_ENABLED: "true" })),
  "age_provider_required"
);
await rejectsCode(
  () => Promise.resolve(assertYouthFlagsSafe({ ...env, IDENTITY_ADULT_BETA_ENABLED: "true", TURNSTILE_REQUIRED: "false" })),
  "adult_beta_safety_controls_required"
);
await rejectsCode(
  () => ageAssuranceProvider(env).start({ userId: requestId, returnUrl: futureArtisanOrigin, clientRequestId: requestId }),
  "age_provider_disabled"
);
await rejectsCode(
  () => guardianConsentProvider(env).start({ purpose: "guardian_relationship", guardianUserId: requestId, dependentUserId: requestId, relationshipType: "parent", authorityExpiresAt: "2027-07-18T12:00:00.000Z", returnUrl: futureArtisanOrigin, clientRequestId: requestId }),
  "guardian_provider_disabled"
);
await rejectsCode(
  () => guardianConsentProvider(env).start({
    purpose: "guardian_sponsored_account", guardianUserId: requestId,
    dependentContact: "dependent@example.test", relationshipType: "parent",
    authorityExpiresAt: "2027-07-18T12:00:00.000Z",
    returnUrl: futureArtisanOrigin, clientRequestId: requestId,
  }),
  "guardian_provider_disabled"
);
await rejectsCode(
  () => ageAssuranceProvider(env).verifyCallback({ url: `${onlineOrigin}/callback`, headers: {}, body: new Uint8Array() }),
  "age_provider_disabled"
);
await rejectsCode(
  () => guardianConsentProvider(env).verifyCallback({ url: `${onlineOrigin}/callback`, headers: {}, body: new Uint8Array() }),
  "guardian_provider_disabled"
);
assert(ageAssuranceProvider(env).redirectOrigins.length === 0, "Disabled age provider exposed a redirect origin.");
assert(guardianConsentProvider(env).redirectOrigins.length === 0, "Disabled guardian provider exposed a redirect origin.");

const providerStartFixture = {
  provider: "reviewed_fixture",
  externalReference: "external-reference-fixture",
  stateNonce: "state-nonce-fixture-value",
  redirectUrl: "https://verify.identity-vendor.example/start?transaction=fixture",
  expiresAt: new Date(Date.now() + 60_000).toISOString()
};
assert(
  providerStartResult(
    providerStartFixture,
    "reviewed_fixture",
    ["https://verify.identity-vendor.example"]
  ).provider === "reviewed_fixture",
  "Exact reviewed provider redirect origin was rejected."
);
for (const redirectUrl of [
  "http://verify.identity-vendor.example/start",
  "https://user:password@verify.identity-vendor.example/start",
  "https://attacker.example/start",
  "https://verify.identity-vendor.example:444/start",
  "https://evil.verify.identity-vendor.example/start",
  "https://verify.identity-vendor.example.attacker.example/start",
]) {
  await rejectsCode(
    () => Promise.resolve(providerStartResult(
      { ...providerStartFixture, redirectUrl },
      "reviewed_fixture",
      ["https://verify.identity-vendor.example"]
    )),
    "provider_response_invalid"
  );
}
for (const redirectOrigins of [
  [],
  ["http://verify.identity-vendor.example"],
  ["https://verify.identity-vendor.example:444"],
  ["https://verify.identity-vendor.example/path"],
]) {
  await rejectsCode(
    () => Promise.resolve(providerStartResult(providerStartFixture, "reviewed_fixture", redirectOrigins)),
    redirectOrigins.length === 0 ? "provider_redirect_contract_missing" : "provider_redirect_contract_invalid"
  );
}

const challengeAt = Date.now();
const siteverifyFetch = async (_input, init) => {
  assert(init.method === "POST" && String(init.body).includes(`idempotency_key=${requestId}`), "Turnstile verification omitted its idempotency key.");
  return new Response(JSON.stringify({
    success: true,
    challenge_ts: new Date(challengeAt).toISOString(),
    hostname: "elysiaartisancollective.pages.dev",
    action: "identity_lifecycle_request"
  }), { status: 200, headers: { "content-type": "application/json" } });
};
await verifyTurnstile(env, {
  token: "single-use-fixture-token",
  action: "identity_lifecycle_request",
  idempotencyKey: requestId,
  remoteIp: "192.0.2.1"
}, siteverifyFetch, challengeAt);
await rejectsCode(
  () => verifyTurnstile({ ...env, TURNSTILE_REQUIRED: "false" }, {
    token: "single-use-fixture-token",
    action: "identity_lifecycle_request",
    idempotencyKey: requestId
  }, siteverifyFetch, challengeAt),
  "turnstile_misconfigured"
);
await rejectsCode(
  () => verifyTurnstile(env, {
    token: "single-use-fixture-token",
    action: "identity_guardian_consent",
    idempotencyKey: requestId
  }, siteverifyFetch, challengeAt),
  "turnstile_action_mismatch"
);
const contactHmac = await hmacSha256Text("fixture-secret-with-more-than-32-characters", "guardian-sponsorship-contact-v1:dependent@example.test");
assert(/^[0-9a-f]{64}$/.test(contactHmac), "Guardian sponsorship contact HMAC was not a SHA-256 digest.");
assert(
  contactHmac === await hmacSha256Text("fixture-secret-with-more-than-32-characters", "guardian-sponsorship-contact-v1:dependent@example.test")
    && contactHmac !== await hmacSha256Text("fixture-secret-with-more-than-32-characters", "guardian-sponsorship-contact-v1:other@example.test"),
  "Guardian sponsorship contact pseudonymization is not stable and domain-bound."
);
await rejectsCode(
  () => hmacSha256Text("short", "guardian-sponsorship-contact-v1:dependent@example.test"),
  "guardian_sponsorship_hmac_unavailable"
);
assertUnder13WorkerFeature({
  ...env,
  IDENTITY_UNDER13_DEPENDENT_CONTROLS_ENABLED: "true",
}, "IDENTITY_UNDER13_DEPENDENT_CONTROLS_ENABLED", false);
assertUnder13WorkerFeature({
  ...env,
  IDENTITY_UNDER13_CONTENT_APPROVAL_ENABLED: "true",
}, "IDENTITY_UNDER13_CONTENT_APPROVAL_ENABLED", false);
assertUnder13WorkerFeature({
  ...env,
  IDENTITY_UNDER13_SPONSORED_ACCOUNTS_ENABLED: "true",
}, "IDENTITY_UNDER13_SPONSORED_ACCOUNTS_ENABLED", false);
await rejectsCode(
  () => Promise.resolve(assertUnder13WorkerFeature({
    ...env,
    IDENTITY_UNDER13_SPONSORED_ACCOUNTS_ENABLED: "true",
  }, "IDENTITY_UNDER13_SPONSORED_ACCOUNTS_ENABLED")),
  "under13_feature_disabled"
);

const health = await handleIdentityRequest(new Request(`${initialArtisanOrigin}/api/identity/v1/health`), env);
assert(health.status === 200, "Private identity Worker health route failed.");
const healthBody = await health.json();
assert(healthBody.data.privacyBoundary === "shared_public_identity_only", "Identity Worker lost its explicit privacy boundary.");
const unknown = await handleIdentityRequest(new Request(`${initialArtisanOrigin}/api/identity/v1/not-real`), env);
assert(unknown.status === 404, "Unknown identity route did not fail closed.");
await handleIdentityScheduledMaintenance(env);
for (const route of [
  "/v1/notifications", "/v1/guardian-relationship/start", "/v1/guardian-consent/start",
  "/v1/guardian-sponsored-account/start", "/v1/guardian-sponsored-account/claim",
  "/v1/guardian/content-approvals/request", "/v1/guardian/content-approvals/decide",
  "/v1/guardian/dependents/profile", "/v1/guardian/dependents/lifecycle",
  "/v1/guardian/relationships/revoke", "/v1/guardian/consents/revoke",
  `/v1/lifecycle/requests/${requestId}/cancel`,
  "/v1/staff/lifecycle/claim", "/v1/staff/lifecycle/item", "/v1/staff/lifecycle/transition",
  "/v1/staff/lifecycle/exports/build", "/v1/staff/lifecycle/storage/inventory",
  "/v1/staff/lifecycle/storage/cleanup", "/v1/staff/lifecycle/auth/delete",
]) {
  const response = await handleIdentityRequest(new Request(`${initialArtisanOrigin}/api/identity${route}`, {
    method: "POST",
    headers: { origin: "https://attacker.example", "content-type": "application/json" },
    body: "{}"
  }), env);
  assert(response.status === 403, `${route} did not enforce the exact mutation origin before authorization.`);
}

for (const [route, method] of [
  ["/v1/guardian-sponsored-account/start", "POST"],
  ["/v1/guardian-sponsored-account/claim", "POST"],
  ["/v1/guardian/content-approvals", "GET"],
  ["/v1/guardian/content-approvals/request", "POST"],
  ["/v1/guardian/content-approvals/decide", "POST"],
  ["/v1/guardian/dependents/status?handle=ink.moth", "GET"],
  ["/v1/guardian/dependents/profile", "POST"],
  ["/v1/guardian/dependents/lifecycle", "POST"],
  ["/v1/guardian/dependents/lifecycle/status?handle=ink.moth", "GET"],
  ["/v1/providers/guardian-sponsored-account/callback", "POST"],
]) {
  const response = await handleIdentityRequest(new Request(`${initialArtisanOrigin}/api/identity${route}`, {
    method,
    headers: method === "POST"
      ? { origin: initialArtisanOrigin, "content-type": "application/json" }
      : undefined,
    body: method === "POST" ? "{}" : undefined,
  }), env);
  assert(response.status === 503, `${route} did not fail closed behind its explicit under-13 feature flag.`);
}

for (const callback of ["/v1/providers/age-assurance/callback", "/v1/providers/guardian/callback"]) {
  const response = await handleIdentityRequest(new Request(`${onlineOrigin}/api/identity${callback}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-provider-signature": "invalid-fixture" },
    body: "{}"
  }), { ...env, IDENTITY_RATE_LIMITER: { limit: async () => ({ success: true }) } });
  assert(response.status === 503, `${callback} did not fail closed without a reviewed provider adapter.`);
}
assert(publicHandleValue("artist.name") === "artist.name", "Worker handle validation drifted from the canonical dot contract.");
assert(publicHandleValue("@Artist.Name") === "artist.name", "Worker handle validation did not normalize one optional leading @.");
assert(publicHandleValue(`${"a".repeat(78)}.z`).length === 80, "Worker handle validation drifted from the canonical 80-character contract.");
for (const invalidHandle of ["a", "@a", "@@artist", "artist.", `.artist`, `${"a".repeat(81)}`]) {
  throwsCode(() => publicHandleValue(invalidHandle), "handle_invalid", `Worker accepted invalid handle ${invalidHandle}.`);
}

let proxiedRequest;
const proxy = await handleIdentityProxy(
  new Request(`${initialArtisanOrigin}/api/identity/v1/health`, { headers: { authorization: "Bearer fixture", cookie: "session=must-not-cross", "x-unsafe-header": "drop" } }),
  { IDENTITY_SERVICE: { fetch: async (request) => {
    proxiedRequest = request;
    return new Response(JSON.stringify({ ok: true }), { headers: {
      "content-type": "application/json", "set-cookie": "forbidden=1", "x-content-sha256": "a".repeat(64),
    } });
  } } }
);
assert(proxy.status === 200 && proxy.headers.get("cache-control")?.includes("no-store"), "Pages identity proxy omitted response hardening.");
assert(proxiedRequest.headers.get("authorization") === "Bearer fixture", "Identity proxy dropped the scoped bearer header.");
assert(!proxiedRequest.headers.has("cookie") && !proxiedRequest.headers.has("x-unsafe-header"), "Identity proxy forwarded browser cookies or an unallowlisted header.");
assert(!proxy.headers.has("set-cookie"), "Identity proxy returned an upstream cookie across the service boundary.");
assert(proxy.headers.get("x-content-sha256") === "a".repeat(64), "Identity proxy dropped the authenticated export integrity header.");
const oversizedProxy = await handleIdentityProxy(new Request(
  `${initialArtisanOrigin}/api/identity/v1/legal/accept`,
  { method: "POST", headers: { "content-type": "application/json" }, body: "x".repeat(65_537) },
), { IDENTITY_SERVICE: { fetch: async () => { throw new Error("oversized proxy body reached the Worker"); } } });
assert(oversizedProxy.status === 413, "Pages identity proxy did not bound request bodies before forwarding them.");

let callbackProxyRequest;
const callbackProxy = await handleIdentityProxy(new Request(
  `${initialArtisanOrigin}/api/identity/v1/providers/guardian/callback`,
  {
    method: "POST",
    headers: {
      "content-type": "application/json", cookie: "must-not-cross=1", "x-unsafe-header": "drop",
      "x-provider-signature": "provider-signature", "x-provider-timestamp": "1721260800",
      "x-provider-event-id": "provider-event", "svix-id": "svix-event",
      "svix-signature": "v1,svix-signature", "svix-timestamp": "1721260801",
    },
    body: "{}",
  },
), { IDENTITY_SERVICE: { fetch: async (request) => {
  callbackProxyRequest = request;
  return Response.json({ ok: true });
} } });
assert(callbackProxy.status === 200, "Provider callback proxy failed unexpectedly.");
for (const header of [
  "x-provider-signature", "x-provider-timestamp", "x-provider-event-id",
  "svix-id", "svix-signature", "svix-timestamp",
]) assert(callbackProxyRequest.headers.has(header), `Identity proxy dropped ${header}.`);
assert(
  !callbackProxyRequest.headers.has("cookie") && !callbackProxyRequest.headers.has("x-unsafe-header"),
  "Provider callback proxy crossed an unsafe browser header."
);
assert((await handleIdentityProxy(new Request(`${initialArtisanOrigin}/api/identity/v1/health`), {})).status === 503, "Missing service binding did not fail closed.");

const workerConfig = await fs.readFile("wrangler.identity.example.jsonc", "utf8");
const productionWorkerConfig = await fs.readFile("wrangler.identity.production.jsonc", "utf8");
const pagesConfig = await fs.readFile("wrangler.example.jsonc", "utf8");
const routeConfig = JSON.parse(await fs.readFile("public/_routes.json", "utf8"));
assert(workerConfig.includes('"workers_dev": false'), "Privileged identity Worker must not use workers.dev.");
assert(
  !workerConfig.includes('"routes"')
    && /"triggers"\s*:\s*\{\s*"crons"\s*:\s*\["\*\/5 \* \* \* \*"\]/.test(workerConfig),
  "Privileged identity Worker must remain route-less while retaining only its private maintenance schedule."
);
assert(workerConfig.includes('"IDENTITY_TEEN_ENABLED": "false"') && workerConfig.includes('"IDENTITY_UNDER_13_ENABLED": "false"'), "Youth activation defaults are not fail-closed.");
for (const flag of [
  "IDENTITY_UNDER13_SPONSORED_ACCOUNTS_ENABLED",
  "IDENTITY_UNDER13_CONTENT_APPROVAL_ENABLED",
  "IDENTITY_UNDER13_DEPENDENT_CONTROLS_ENABLED",
]) assert(workerConfig.includes(`"${flag}": "false"`), `${flag} did not default off.`);
assert(
  workerConfig.includes('"IDENTITY_LIFECYCLE_OPERATOR_ENABLED": "false"')
    && workerConfig.includes('"IDENTITY_LIFECYCLE_EXECUTION_ENABLED": "false"')
    && workerConfig.includes('"IDENTITY_LIFECYCLE_EXECUTION_PROVIDER": "disabled"'),
  "Account-lifecycle operator and external evidence defaults are not fail-closed."
);
for (const flag of [
  "IDENTITY_ACCOUNT_EXPORT_ENABLED",
  "IDENTITY_STORAGE_CLEANUP_ENABLED",
  "IDENTITY_AUTH_DELETION_ENABLED",
  "IDENTITY_NOTIFICATION_DELIVERY_ENABLED",
  "IDENTITY_EXPORT_RETENTION_ENABLED",
]) {
  assert(workerConfig.includes(`"${flag}": "false"`), `${flag} did not default off.`);
}
for (const provider of [
  "IDENTITY_ACCOUNT_EXPORT_PROVIDER",
  "IDENTITY_STORAGE_CLEANUP_PROVIDER",
  "IDENTITY_AUTH_DELETION_PROVIDER",
  "IDENTITY_NOTIFICATION_DELIVERY_PROVIDER",
  "IDENTITY_EXPORT_RETENTION_PROVIDER",
]) {
  assert(workerConfig.includes(`"${provider}": "disabled"`), `${provider} did not default disabled.`);
}
assert(pagesConfig.includes('"binding": "IDENTITY_SERVICE"'), "Pages does not declare the private identity service binding.");
assert(routeConfig.include.includes("/api/identity/*"), "Pages Functions do not route the identity proxy.");
assert(routeConfig.include.includes("/api/public/profile-avatars/*"), "Pages Functions do not route safe public avatar delivery.");
assert(routeConfig.include.includes("/api/public/profile-banners/*"), "Pages Functions do not route safe public banner delivery.");
assert(workerConfig.includes('"binding": "IDENTITY_IMAGES"'), "Identity Worker lacks its metadata-stripping Images binding.");
assert(
  workerConfig.includes('"binding": "COMMUNITY_EXPORTS"')
    && workerConfig.includes('"bucket_name": "elysia-community-account-exports"'),
  "Identity Worker lacks its dedicated private community-export bucket binding."
);
assert(
  productionWorkerConfig.includes('"workers_dev": false')
    && !productionWorkerConfig.includes('"routes"'),
  "Production shared identity must remain private and route-less."
);
assert(
  productionWorkerConfig.includes('"IDENTITY_ENABLED": "true"')
    && productionWorkerConfig.includes('"IDENTITY_EDGE_RATE_LIMIT_CONFIRMED": "true"')
    && productionWorkerConfig.includes('"TURNSTILE_REQUIRED": "true"'),
  "Production account access must require the reviewed identity, rate-limit, and Turnstile boundaries."
);
for (const flag of [
  "IDENTITY_ADULT_BETA_ENABLED",
  "IDENTITY_TEEN_ENABLED",
  "IDENTITY_UNDER_13_ENABLED",
  "IDENTITY_UNDER13_SPONSORED_ACCOUNTS_ENABLED",
  "IDENTITY_UNDER13_CONTENT_APPROVAL_ENABLED",
  "IDENTITY_UNDER13_DEPENDENT_CONTROLS_ENABLED",
  "IDENTITY_LIFECYCLE_OPERATOR_ENABLED",
  "IDENTITY_LIFECYCLE_EXECUTION_ENABLED",
  "IDENTITY_ACCOUNT_EXPORT_ENABLED",
  "IDENTITY_STORAGE_CLEANUP_ENABLED",
  "IDENTITY_AUTH_DELETION_ENABLED",
  "IDENTITY_NOTIFICATION_DELIVERY_ENABLED",
  "IDENTITY_EXPORT_RETENTION_ENABLED",
]) {
  assert(productionWorkerConfig.includes(`"${flag}": "false"`), `${flag} escaped the production account-access boundary.`);
}
assert(
  productionWorkerConfig.includes('"AGE_ASSURANCE_PROVIDER": "disabled"')
    && productionWorkerConfig.includes('"GUARDIAN_CONSENT_PROVIDER": "disabled"')
    && !productionWorkerConfig.includes("REPLACE_IN_CLOUDFLARE_DASHBOARD"),
  "Production account access must keep external providers disabled and use explicit browser-safe Supabase configuration."
);
assert(!pagesConfig.includes("COMMUNITY_EXPORTS"), "The private account-export bucket leaked into the Pages browser-facing configuration.");
for (const route of [
  '"/v1/lifecycle/requests"', '"/v1/staff/lifecycle/exports/build"',
  '"/v1/staff/lifecycle/storage/inventory"', '"/v1/staff/lifecycle/storage/cleanup"',
  '"/v1/staff/lifecycle/auth/delete"',
]) assert(identityWorkerSource.includes(route), `Identity Worker is missing ${route}.`);
assert(
  identityWorkerSource.includes("handleIdentityScheduledMaintenance")
    && identityWorkerSource.includes("new SupabaseAuthSoftDeleteAdapter")
    && identityWorkerSource.includes("new R2AccountExportStorage"),
  "Lifecycle execution adapters or scheduled maintenance were disconnected."
);

const validMediaId = "22222222-2222-4222-8222-222222222222";
assert((await handlePublicAvatarProxy(new Request(`${initialArtisanOrigin}/api/public/profile-avatars/not-a-uuid`), {}, "not-a-uuid")).status === 404, "Avatar proxy accepted an invalid media identifier.");
assert((await handlePublicAvatarProxy(new Request(`${initialArtisanOrigin}/api/public/profile-avatars/${validMediaId}`), {}, validMediaId)).status === 503, "Avatar proxy did not fail closed without its private service binding.");
assert((await handlePublicBannerProxy(new Request(`${initialArtisanOrigin}/api/public/profile-banners/not-a-uuid`), {}, "not-a-uuid")).status === 404, "Banner proxy accepted an invalid media identifier.");
assert((await handlePublicBannerProxy(new Request(`${initialArtisanOrigin}/api/public/profile-banners/${validMediaId}`), {}, validMediaId)).status === 503, "Banner proxy did not fail closed without its private service binding.");

console.log("Identity Worker smoke test passed: exact origins, fail-closed youth/providers, Turnstile, private bindings, safe profile images, and response hardening verified.");
