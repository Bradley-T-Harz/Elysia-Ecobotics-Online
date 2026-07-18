import { requireRateLimit } from "./_shared/abuse.ts";
import {
  authenticateIdentityRequest,
  createIdentityServerClient,
  DESTRUCTIVE_MFA_MAX_AGE_SECONDS,
  identityServiceRoleKey,
  identitySupabaseOrigin,
  requireFreshAal2,
  STAFF_MFA_MAX_AGE_SECONDS,
} from "./_shared/auth.ts";
import { assertIdentityEnabled, assertYouthFlagsSafe, identityFeatureState } from "./_shared/config.ts";
import {
  acceptCurrentUserDocuments,
  cancelCurrentUserCommunityDeletion,
  claimCommunityLifecycleWork,
  claimCommunityExportRetentionJobs,
  claimNotificationDeliveryJobs,
  claimGuardianSponsoredAccount,
  completeCommunityExportRetention,
  completeNotificationDelivery,
  consumeCommunityProviderTransaction,
  consumeGuardianSponsoredAccountProviderResult,
  decideGuardianContentApproval,
  enqueueArtisanAccountCleanup,
  failCommunityExportRetention,
  failNotificationDelivery,
  imposeRestriction,
  listCurrentUserLifecycleRequests,
  loadArtisanAccountCleanupReadiness,
  loadCommunityExportDownloadAsset,
  loadCommunityExportRetentionAsset,
  loadCommunityExportSnapshot,
  registerCommunityLegalDocumentVersion,
  liftRestriction,
  loadCommunityProviderTransaction,
  loadCurrentUserBootstrap,
  loadCurrentUserLifecycleRequest,
  loadCommunityLifecycleWorkItem,
  loadGuardianRelationshipForProvider,
  loadGuardianContentApprovalQueue,
  loadGuardianDependentLifecycle,
  loadGuardianDependentStatus,
  loadPublicProfileCard,
  loadPublicProfileAvatarAsset,
  loadPublicProfileBannerAsset,
  requestCurrentUserLifecycleAction,
  requestGuardianContentApproval,
  requestGuardianDependentLifecycle,
  recordCommunityDeletionHandoff,
  recordCommunityExportArtifact,
  revokeCurrentUserGuardianConsent,
  revokeCurrentUserGuardianRelationship,
  startCommunityProviderTransaction,
  startCommunityGuardianRelationshipByHandle,
  startGuardianSponsoredAccount,
  transitionCommunityLifecycleAction,
  updateNotificationPreferencesForActor,
  setGuardianDependentProfile,
  setCurrentUserPublicProfile
} from "./_shared/database.ts";
import {
  accountExportProvider,
  accountExportTtlDays,
  assertLifecycleOperatorEnabled,
  authDeletionProvider,
  exportRetentionProvider,
  lifecycleExecutionProvider,
  notificationDeliveryProvider,
  storageCleanupProvider,
  transitionRequiresExecutionEvidence
} from "./_shared/lifecycle.ts";
import { hmacSha256Text, sha256Text } from "./_shared/crypto.ts";
import {
  R2AccountExportStorage,
  accountExportObjectKey,
  type StoredAccountExport
} from "./_shared/exportStorage.ts";
import { SupabaseAuthSoftDeleteAdapter, authDeletionRequestEvidence } from "./_shared/authDeletion.ts";
import { CloudflareEmailNotificationAdapter, DatabaseInAppNotificationAdapter } from "./_shared/notificationDelivery.ts";
import {
  allowedOrigins,
  fetchWithTimeout,
  IdentityHttpError,
  jsonResponse,
  parseBoundedJsonRequest,
  readBoundedText,
  readBoundedResponseBytes,
  requireGet,
  requireJsonPost,
  requireSameOriginMutation,
  safeIdentityErrorResponse
} from "./_shared/http.ts";
import { ageAssuranceProvider, guardianConsentProvider } from "./_shared/providers.ts";
import {
  acceptancesValue,
  booleanValue,
  enumValue,
  exactKeys,
  httpsReturnUrl,
  nullableTimeValue,
  objectValue,
  optionalString,
  publicHandleValue,
  requiredString,
  stringArray,
  uuidValue
} from "./_shared/schema.ts";
import { verifyTurnstile } from "./_shared/turnstile.ts";
import type { AuthenticatedIdentityRequest, IdentityEnv } from "./_shared/types.ts";
import type {
  AgeAssuranceProvider,
  GuardianConsentProvider,
  ProviderCallbackResult,
  ProviderStartResult
} from "./_shared/types.ts";

type IdentityHandler = (request: Request, env: IdentityEnv) => Promise<Response>;

const GUARDIAN_SCOPES = [
  "account",
  "public_profile",
  "artisan_membership",
  "artisan_posting",
  "artisan_commenting",
  "artisan_uploading",
  "artisan_challenges",
  "artisan_notifications",
  "account_export",
  "account_deletion"
] as const;

const RELATIONSHIP_TYPES = ["parent", "legal_guardian", "court_authorized_guardian"] as const;
const AGE_BANDS = ["unknown", "under_13", "13_to_15", "16_to_17", "18_plus"] as const;
const CALLBACK_ASSURANCE = ["age_estimated", "age_verified", "guardian_verified"] as const;
const LIFECYCLE_STATUSES = [
  "identity_verification",
  "cooling_period",
  "operator_review",
  "processing",
  "storage_inventory",
  "storage_cleanup",
  "auth_deletion_ready",
  "auth_deletion_confirmed",
  "blocked_by_legal_hold",
  "completed",
  "rejected",
  "canceled"
] as const;

const ACCOUNT_EXPORT_SECTIONS = [
  "profile", "terms", "artworks", "media", "posts", "comments",
  "submissions", "reports", "appeals", "notifications",
  "commune_posts", "commune_comments", "commune_media", "commune_code_documents",
  "commune_jobs", "commune_abuse_reports", "commune_code_reports",
  "forge_profile", "forge_drafts", "forge_submissions", "forge_sandbox",
  "marketplace_library", "online_notifications", "economic_summary"
] as const;

const PRIVATE_EXPORT_CONTENT_TYPE = "application/json";
const PRIVATE_EXPORT_ENCRYPTION = "r2-managed-aes-256-gcm";
const PRIVATE_EXPORT_BINDING = "COMMUNITY_EXPORTS";
const PRIVATE_EXPORT_PROVIDER = "cloudflare_r2";
const NOTIFICATION_WORKER_ID = "identity-notification-v1";
const EXPORT_RETENTION_WORKER_ID = "identity-export-retention-v1";
const LIFECYCLE_ACTIONS = ["data_export", "account_deletion", "account_deactivation", "account_reactivation"] as const;

function requestId(request: Request): string {
  const candidate = request.headers.get("x-request-id")?.toLowerCase();
  return candidate && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(candidate)
    ? candidate
    : crypto.randomUUID();
}

function remoteIp(request: Request): string | undefined {
  return request.headers.get("cf-connecting-ip") ?? undefined;
}

function success(data: unknown, status = 200): Response {
  return jsonResponse({ ok: true, data }, status);
}

function nullableUuid(value: unknown): string | null {
  return value === null ? null : uuidValue(value);
}

function nullableSha256(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const result = requiredString(value, 64, 64).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(result)) throw new IdentityHttpError(400, "request_invalid");
  return result;
}

function nullableFutureTimestamp(value: unknown, maximumFutureMs: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  return futureTimestamp(value, maximumFutureMs);
}

function boundedInteger(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new IdentityHttpError(400, "request_invalid");
  }
  return value;
}

function upstreamRecord(value: unknown, expectedKeys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IdentityHttpError(502, "identity_database_response_invalid");
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== expectedKeys.length || expectedKeys.some((key) => !(key in record))) {
    throw new IdentityHttpError(502, "identity_database_response_invalid");
  }
  return record;
}

function upstreamUuid(value: unknown): string {
  try { return uuidValue(value); }
  catch { throw new IdentityHttpError(502, "identity_database_response_invalid"); }
}

function upstreamString(value: unknown, minimum: number, maximum: number): string {
  try { return requiredString(value, minimum, maximum); }
  catch { throw new IdentityHttpError(502, "identity_database_response_invalid"); }
}

function upstreamSha256(value: unknown): string {
  const result = upstreamString(value, 64, 64).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(result)) throw new IdentityHttpError(502, "identity_database_response_invalid");
  return result;
}

function upstreamInteger(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new IdentityHttpError(502, "identity_database_response_invalid");
  }
  return value;
}

function upstreamTimestamp(value: unknown): string {
  const result = upstreamString(value, 20, 40);
  if (Number.isNaN(Date.parse(result))) throw new IdentityHttpError(502, "identity_database_response_invalid");
  return result;
}

function stableWorkerFailureCode(error: unknown, fallback: string): string {
  const candidate = error instanceof IdentityHttpError ? error.code : fallback;
  return /^[a-z][a-z0-9_]{2,99}$/.test(candidate) ? candidate : fallback;
}

type PrivateExportAsset = {
  artifactId: string;
  privateObjectKey: string;
  artifactSha256: string;
  byteSize: number;
  mimeType: typeof PRIVATE_EXPORT_CONTENT_TYPE;
  expiresAt: string | null;
};

function privateExportAsset(value: unknown, mode: "download" | "retention"): PrivateExportAsset {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length === 0) {
    throw new IdentityHttpError(404, "account_export_not_found");
  }
  const keys = mode === "download"
    ? ["artifactId", "requestId", "storageProvider", "bucketBinding", "privateObjectKey", "artifactSha256", "byteSize", "mimeType", "encryptionAtRest", "expiresAt"]
    : ["artifactId", "storageProvider", "bucketBinding", "privateObjectKey", "artifactSha256", "byteSize", "mimeType", "encryptionAtRest", "leaseExpiresAt"];
  const record = upstreamRecord(value, keys);
  if (
    record.storageProvider !== PRIVATE_EXPORT_PROVIDER || record.bucketBinding !== PRIVATE_EXPORT_BINDING
    || record.mimeType !== PRIVATE_EXPORT_CONTENT_TYPE || record.encryptionAtRest !== PRIVATE_EXPORT_ENCRYPTION
  ) throw new IdentityHttpError(502, "account_export_storage_contract_invalid");
  const artifactId = upstreamUuid(record.artifactId);
  if (mode === "download") upstreamUuid(record.requestId);
  return {
    artifactId,
    privateObjectKey: upstreamString(record.privateObjectKey, 20, 500),
    artifactSha256: upstreamSha256(record.artifactSha256),
    byteSize: upstreamInteger(record.byteSize, 1, 104_857_600),
    mimeType: PRIVATE_EXPORT_CONTENT_TYPE,
    expiresAt: mode === "download" ? upstreamTimestamp(record.expiresAt) : null
  };
}

type LifecycleWorkItem = {
  requestId: string;
  userId: string;
  action: (typeof LIFECYCLE_ACTIONS)[number];
  status: string;
  claimedBy: string | null;
  claimedAt: string | null;
  handoff: null | {
    contentDisposition: "preserve_public_credit_anonymize_account" | "remove_user_content_preserve_required_legal_evidence";
    storageInventoryCompletedAt: string | null;
    ownedStorageObjectCount: number | null;
    storageCleanupCompletedAt: string | null;
    authDeletionRequestedAt: string | null;
    authDeletionConfirmedAt: string | null;
    hasAuthProviderReceipt: boolean;
  };
};

function parseLifecycleWorkItem(value: unknown, expectedRequestId: string): LifecycleWorkItem {
  const item = upstreamRecord(value, [
    "requestId", "userId", "action", "status", "noticeVersion", "legalHoldPresent",
    "submittedAt", "coolingPeriodEndsAt", "claimedBy", "claimedAt", "handoff"
  ]);
  const requestId = upstreamUuid(item.requestId);
  const userId = upstreamUuid(item.userId);
  const action = upstreamString(item.action, 3, 40);
  const status = upstreamString(item.status, 3, 40);
  const claimedBy = item.claimedBy === null ? null : upstreamUuid(item.claimedBy);
  const claimedAt = item.claimedAt === null ? null : upstreamTimestamp(item.claimedAt);
  upstreamString(item.noticeVersion, 1, 120);
  if (typeof item.legalHoldPresent !== "boolean") throw new IdentityHttpError(502, "identity_database_response_invalid");
  upstreamTimestamp(item.submittedAt);
  if (item.coolingPeriodEndsAt !== null) upstreamTimestamp(item.coolingPeriodEndsAt);
  let handoff: LifecycleWorkItem["handoff"] = null;
  if (item.handoff !== null) {
    const raw = upstreamRecord(item.handoff, [
      "contentDisposition", "storageInventoryCompletedAt", "ownedStorageObjectCount",
      "storageCleanupCompletedAt", "authDeletionRequestedAt", "authDeletionConfirmedAt",
      "hasAuthProviderReceipt"
    ]);
    if (![
      "preserve_public_credit_anonymize_account",
      "remove_user_content_preserve_required_legal_evidence"
    ].includes(String(raw.contentDisposition)) || typeof raw.hasAuthProviderReceipt !== "boolean") {
      throw new IdentityHttpError(502, "identity_database_response_invalid");
    }
    const nullableTimestamp = (value: unknown): string | null => value === null ? null : upstreamTimestamp(value);
    const ownedStorageObjectCount = raw.ownedStorageObjectCount === null
      ? null
      : upstreamInteger(raw.ownedStorageObjectCount, 0, 2_147_483_647);
    handoff = {
      contentDisposition: raw.contentDisposition as
        | "preserve_public_credit_anonymize_account"
        | "remove_user_content_preserve_required_legal_evidence",
      storageInventoryCompletedAt: nullableTimestamp(raw.storageInventoryCompletedAt),
      ownedStorageObjectCount,
      storageCleanupCompletedAt: nullableTimestamp(raw.storageCleanupCompletedAt),
      authDeletionRequestedAt: nullableTimestamp(raw.authDeletionRequestedAt),
      authDeletionConfirmedAt: nullableTimestamp(raw.authDeletionConfirmedAt),
      hasAuthProviderReceipt: raw.hasAuthProviderReceipt
    };
  }
  if (requestId !== expectedRequestId || !LIFECYCLE_ACTIONS.includes(action as (typeof LIFECYCLE_ACTIONS)[number])) {
    throw new IdentityHttpError(502, "identity_database_response_invalid");
  }
  return { requestId, userId, action: action as LifecycleWorkItem["action"], status, claimedBy, claimedAt, handoff };
}

function exactUuidPath(pathname: string, pattern: RegExp): string | null {
  const match = pattern.exec(pathname);
  return match ? uuidValue(match[1]) : null;
}

function exportSnapshotPage(
  value: unknown,
  requestId: string,
  section: (typeof ACCOUNT_EXPORT_SECTIONS)[number]
): { items: unknown[]; nextId: string | null } {
  const page = upstreamRecord(value, ["snapshotVersion", "requestId", "section", "items", "nextId"]);
  if (
    page.snapshotVersion !== "community-account-export-v2"
    || upstreamUuid(page.requestId) !== requestId
    || page.section !== section
    || !Array.isArray(page.items) || page.items.length > 100
  ) throw new IdentityHttpError(502, "account_export_snapshot_invalid");
  const nextId = page.nextId === null ? null : upstreamUuid(page.nextId);
  if ((page.items.length === 100) !== (nextId !== null)) {
    throw new IdentityHttpError(502, "account_export_snapshot_invalid");
  }
  return { items: page.items, nextId };
}

function validatedBefore(value: string | null): string | null {
  if (value === null || value === "") return null;
  if (value.length > 40 || Number.isNaN(Date.parse(value))) throw new IdentityHttpError(400, "request_invalid");
  return new Date(value).toISOString();
}

function nullableProviderString(value: unknown, maximum: number): string | null {
  return value === null ? null : requiredString(value, 1, maximum);
}

function futureTimestamp(value: unknown, maximumFutureMs: number, code = "request_invalid"): string {
  const result = requiredString(value, 20, 40);
  const parsed = Date.parse(result);
  if (Number.isNaN(parsed) || parsed <= Date.now() || parsed > Date.now() + maximumFutureMs) {
    throw new IdentityHttpError(code === "request_invalid" ? 400 : 502, code);
  }
  return new Date(parsed).toISOString();
}

function reviewedProviderRedirectOrigins(values: readonly string[]): ReadonlySet<string> {
  if (values.length < 1 || values.length > 4) throw new IdentityHttpError(503, "provider_redirect_contract_missing");
  const origins = new Set<string>();
  for (const value of values) {
    let url: URL;
    try { url = new URL(value); }
    catch { throw new IdentityHttpError(503, "provider_redirect_contract_invalid"); }
    if (
      url.protocol !== "https:" || url.username || url.password || url.port
      || url.pathname !== "/" || url.search || url.hash || url.origin !== value
      || url.hostname === "localhost" || /^127(?:\.\d{1,3}){3}$/.test(url.hostname)
    ) throw new IdentityHttpError(503, "provider_redirect_contract_invalid");
    origins.add(url.origin);
  }
  if (origins.size !== values.length) throw new IdentityHttpError(503, "provider_redirect_contract_invalid");
  return origins;
}

export function providerStartResult(
  value: ProviderStartResult,
  expectedProvider: string,
  redirectOrigins: readonly string[]
): ProviderStartResult {
  const provider = requiredString(value.provider, 3, 80);
  const externalReference = requiredString(value.externalReference, 8, 512);
  const stateNonce = requiredString(value.stateNonce, 16, 512);
  const redirectUrl = requiredString(value.redirectUrl, 12, 2_048);
  let parsedRedirect: URL;
  try { parsedRedirect = new URL(redirectUrl); }
  catch { throw new IdentityHttpError(502, "provider_response_invalid"); }
  const reviewedOrigins = reviewedProviderRedirectOrigins(redirectOrigins);
  if (
    provider !== expectedProvider || !/^[a-z][a-z0-9_-]{2,80}$/.test(provider)
    || parsedRedirect.protocol !== "https:" || parsedRedirect.username || parsedRedirect.password
    || parsedRedirect.port || !reviewedOrigins.has(parsedRedirect.origin)
  ) throw new IdentityHttpError(502, "provider_response_invalid");
  return {
    provider,
    externalReference,
    stateNonce,
    redirectUrl: parsedRedirect.toString(),
    expiresAt: futureTimestamp(value.expiresAt, 24 * 60 * 60 * 1_000, "provider_response_invalid")
  };
}

function safeProviderStartResponse(
  transaction: unknown,
  start: ProviderStartResult,
  expectedDependentHandle: string | null = null
): Record<string, unknown> {
  const record = objectValue(transaction);
  exactKeys(record, ["providerTransactionId", "provider", "purpose", "status", "expiresAt", "dependentHandle"]);
  const status = enumValue(record.status, ["pending"] as const);
  const provider = requiredString(record.provider, 3, 80);
  if (provider !== start.provider) throw new IdentityHttpError(502, "identity_database_failed");
  const response: Record<string, unknown> = {
    providerTransactionId: uuidValue(record.providerTransactionId),
    provider,
    redirectUrl: start.redirectUrl,
    expiresAt: futureTimestamp(record.expiresAt, 24 * 60 * 60 * 1_000, "identity_database_failed"),
    status
  };
  if (expectedDependentHandle !== null) {
    const dependentHandle = publicHandleValue(record.dependentHandle);
    if (dependentHandle !== expectedDependentHandle) throw new IdentityHttpError(502, "identity_database_failed");
    response.dependentHandle = dependentHandle;
  } else if (record.dependentHandle !== undefined) {
    throw new IdentityHttpError(502, "identity_database_failed");
  }
  return response;
}

function guardianRelationshipForProvider(value: unknown, actorUserId: string, relationshipId: string) {
  const record = objectValue(value);
  exactKeys(record, ["relationshipId", "guardianUserId", "dependentUserId", "relationshipType", "status", "expiresAt"]);
  const guardianUserId = uuidValue(record.guardianUserId);
  const resolvedRelationshipId = uuidValue(record.relationshipId);
  if (guardianUserId !== actorUserId || resolvedRelationshipId !== relationshipId || record.status !== "active") {
    throw new IdentityHttpError(403, "guardian_relationship_unavailable");
  }
  return {
    relationshipId: resolvedRelationshipId,
    guardianUserId,
    dependentUserId: uuidValue(record.dependentUserId),
    relationshipType: enumValue(record.relationshipType, RELATIONSHIP_TYPES),
    expiresAt: record.expiresAt === null ? null : futureTimestamp(record.expiresAt, 10 * 365 * 24 * 60 * 60 * 1_000)
  };
}

function callbackHeaders(request: Request): Readonly<Record<string, string>> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, name) => {
    const normalized = name.toLowerCase();
    if (
      normalized === "authorization" || normalized === "content-type" || normalized === "user-agent"
      || normalized.startsWith("x-provider-") || normalized.startsWith("svix-")
    ) headers[normalized] = value;
  });
  return Object.freeze(headers);
}

function normalizedCallbackResult(value: ProviderCallbackResult, purpose: "age" | "guardian"): ProviderCallbackResult {
  const externalReference = requiredString(value.externalReference, 8, 512);
  const stateNonce = requiredString(value.stateNonce, 16, 512);
  const eventId = requiredString(value.eventId, 8, 512);
  const resultStatus = enumValue(value.resultStatus, ["verified", "failed"] as const);
  const evidenceCode = requiredString(value.evidenceCode, 3, 160);
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(evidenceCode)) throw new IdentityHttpError(502, "provider_response_invalid");
  const ageBand = value.ageBand === null ? null : enumValue(value.ageBand, AGE_BANDS);
  const assuranceStatus = value.assuranceStatus === null ? null : enumValue(value.assuranceStatus, CALLBACK_ASSURANCE);
  const assuranceExpiresAt = value.assuranceExpiresAt === null
    ? null
    : futureTimestamp(value.assuranceExpiresAt, 10 * 365 * 24 * 60 * 60 * 1_000, "provider_response_invalid");
  const jurisdictionCode = nullableProviderString(value.jurisdictionCode, 16);
  if (
    (purpose === "guardian" && (ageBand !== null || assuranceStatus !== null || assuranceExpiresAt !== null || jurisdictionCode !== null))
    || (purpose === "age" && resultStatus === "verified" && (!ageBand || !assuranceStatus || !assuranceExpiresAt))
  ) throw new IdentityHttpError(502, "provider_response_invalid");
  return {
    externalReference, stateNonce, eventId, resultStatus, evidenceCode,
    ageBand, assuranceStatus, assuranceExpiresAt, jurisdictionCode
  };
}

function uuidFromSha256(value: string): string {
  const raw = value.slice(0, 32).split("");
  raw[12] = "5";
  raw[16] = (["8", "9", "a", "b"] as const)[parseInt(raw[16], 16) % 4];
  const joined = raw.join("");
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
}

async function authenticatedMutation(request: Request, env: IdentityEnv): Promise<{
  auth: AuthenticatedIdentityRequest;
  origin: string;
  body: Record<string, unknown>;
}> {
  assertIdentityEnabled(env);
  assertYouthFlagsSafe(env);
  requireJsonPost(request);
  const origin = requireSameOriginMutation(request, env);
  const auth = await authenticateIdentityRequest(request, env);
  const body = objectValue(await parseBoundedJsonRequest(request));
  return { auth, origin, body };
}

type Under13WorkerFeature =
  | "IDENTITY_UNDER13_SPONSORED_ACCOUNTS_ENABLED"
  | "IDENTITY_UNDER13_CONTENT_APPROVAL_ENABLED"
  | "IDENTITY_UNDER13_DEPENDENT_CONTROLS_ENABLED";

export function assertUnder13WorkerFeature(
  env: IdentityEnv,
  feature: Under13WorkerFeature,
  requireParticipationActivation = true
): void {
  assertIdentityEnabled(env);
  assertYouthFlagsSafe(env);
  if (
    env[feature] !== "true"
    || (requireParticipationActivation && env.IDENTITY_UNDER_13_ENABLED !== "true")
  ) {
    throw new IdentityHttpError(503, "under13_feature_disabled");
  }
}

function requireAal2(auth: AuthenticatedIdentityRequest): void {
  if (auth.aal !== "aal2") throw new IdentityHttpError(403, "aal2_required");
}

function normalizedDependentContact(value: unknown): string {
  const contact = requiredString(value, 3, 254).trim().toLowerCase();
  if (
    contact.length < 3 || contact.length > 254 || /[\s\r\n]/.test(contact)
    || !/^[^@]+@[^@]+\.[^@]+$/.test(contact)
  ) throw new IdentityHttpError(400, "dependent_contact_invalid");
  return contact;
}

async function under13AuthenticatedMutation(
  request: Request,
  env: IdentityEnv,
  feature: Under13WorkerFeature,
  requireParticipationActivation = true
): ReturnType<typeof authenticatedMutation> {
  assertIdentityEnabled(env);
  assertYouthFlagsSafe(env);
  requireJsonPost(request);
  const origin = requireSameOriginMutation(request, env);
  assertUnder13WorkerFeature(env, feature, requireParticipationActivation);
  const auth = await authenticateIdentityRequest(request, env);
  const body = objectValue(await parseBoundedJsonRequest(request));
  return { auth, origin, body };
}

const health: IdentityHandler = async (request, env) => {
  requireGet(request);
  assertYouthFlagsSafe(env);
  return success({
    enabled: env.IDENTITY_ENABLED === "true",
    features: identityFeatureState(env),
    privacyBoundary: "shared_public_identity_only"
  });
};

function safePublicProfileCard(value: unknown): Record<string, unknown> {
  if (!Array.isArray(value) || value.length !== 1 || !value[0] || typeof value[0] !== "object" || Array.isArray(value[0])) {
    throw new IdentityHttpError(404, "profile_not_found");
  }
  const row = value[0] as Record<string, unknown>;
  const expected = [
    "user_id", "handle", "display_name", "avatar_url", "short_public_bio",
    "canonical_profile_url", "public_profile_enabled", "updated_at"
  ];
  if (Object.keys(row).length !== expected.length || expected.some((key) => !(key in row))) {
    throw new IdentityHttpError(502, "identity_database_response_invalid");
  }
  let handle: string;
  try {
    uuidValue(row.user_id);
    handle = publicHandleValue(row.handle);
  } catch {
    throw new IdentityHttpError(502, "identity_database_response_invalid");
  }
  if (row.public_profile_enabled !== true) throw new IdentityHttpError(404, "profile_not_found");
  const displayName = row.display_name === null ? null : row.display_name;
  const avatarUrl = row.avatar_url === null ? null : row.avatar_url;
  const shortPublicBio = row.short_public_bio === null ? null : row.short_public_bio;
  const canonicalProfileUrl = row.canonical_profile_url;
  const updatedAt = row.updated_at;
  if (
    (displayName !== null && (typeof displayName !== "string" || displayName.length < 1 || displayName.length > 120))
    || (avatarUrl !== null && (typeof avatarUrl !== "string" || !/^\/api\/public\/profile-avatars\/[0-9a-f-]{36}$/i.test(avatarUrl)))
    || (shortPublicBio !== null && (typeof shortPublicBio !== "string" || shortPublicBio.length > 280))
    || canonicalProfileUrl !== `https://elysiaecobotics.com/commons-circle/@${handle}`
    || typeof updatedAt !== "string" || Number.isNaN(Date.parse(updatedAt))
  ) throw new IdentityHttpError(502, "identity_database_response_invalid");
  return {
    handle, displayName, avatarUrl, shortPublicBio, canonicalProfileUrl,
    publicProfileEnabled: true, updatedAt
  };
}

const publicProfile: IdentityHandler = async (request, env) => {
  requireGet(request);
  const url = new URL(request.url);
  if ([...url.searchParams.keys()].some((key) => key !== "handle")) throw new IdentityHttpError(400, "request_invalid");
  const handle = publicHandleValue(url.searchParams.get("handle"));
  await requireRateLimit(env, `${remoteIp(request) ?? "network-unavailable"}:${handle}`, "public_profile");
  const card = await loadPublicProfileCard(createIdentityServerClient(env), handle);
  return success(safePublicProfileCard(card));
};

type PublicProfileImageKind = "avatar" | "banner";
type PublicProfileImageAsset = { bucket: string; objectKey: string };

function profileImageError(kind: PublicProfileImageKind, suffix: string): string {
  return `profile_${kind}_${suffix}`;
}

function publicProfileImageAsset(value: unknown, kind: PublicProfileImageKind): PublicProfileImageAsset {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IdentityHttpError(404, profileImageError(kind, "not_found"));
  }
  const record = value as Record<string, unknown>;
  const bucket = record.bucket;
  const objectKey = record.objectKey;
  const expectedBucket = kind === "avatar" ? "profile-avatars" : "profile-banners";
  const expectedDirectory = kind === "avatar" ? "avatars" : "banners";
  if (
    record.storageProvider !== "supabase"
    || record.deliveryMode !== "private_original_requires_safe_transform"
    || typeof bucket !== "string"
    || bucket !== expectedBucket
    || typeof objectKey !== "string"
    || objectKey.length > 500
    || !new RegExp(`^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/${expectedDirectory}/[A-Za-z0-9._-]{8,255}$`, "i").test(objectKey)
  ) throw new IdentityHttpError(404, profileImageError(kind, "not_found"));
  return { bucket, objectKey };
}

function encodedStoragePath(value: string): string {
  return value.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function staticImageMime(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  if (
    bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF"
    && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  return null;
}

async function publicProfileImage(
  request: Request,
  env: IdentityEnv,
  kind: PublicProfileImageKind
): Promise<Response> {
  requireGet(request);
  const pathname = normalizePath(new URL(request.url).pathname);
  const routePrefix = `/v1/public-profile-${kind === "avatar" ? "avatars" : "banners"}/`;
  const mediaId = pathname.slice(routePrefix.length);
  await requireRateLimit(env, `${remoteIp(request) ?? "network-unavailable"}:${mediaId}`, `profile_${kind}`);
  const serverClient = createIdentityServerClient(env);
  const rawAsset = kind === "avatar"
    ? await loadPublicProfileAvatarAsset(serverClient, uuidValue(mediaId))
    : await loadPublicProfileBannerAsset(serverClient, uuidValue(mediaId));
  const asset = publicProfileImageAsset(rawAsset, kind);
  if (!env.IDENTITY_IMAGES) throw new IdentityHttpError(503, profileImageError(kind, "processing_unavailable"));
  const serviceKey = identityServiceRoleKey(env);
  const upstream = await fetchWithTimeout(
    `${identitySupabaseOrigin(env)}/storage/v1/object/${asset.bucket}/${encodedStoragePath(asset.objectKey)}`,
    {
      method: "GET",
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, accept: "image/jpeg,image/png,image/webp" }
    },
    7_000
  );
  if (!upstream.ok) throw new IdentityHttpError(upstream.status === 404 ? 404 : 502, profileImageError(kind, "not_found"));
  const declaredMime = upstream.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const original = await readBoundedResponseBytes(upstream, 5_242_880, `profile_${kind}`);
  const detectedMime = staticImageMime(original);
  if (!detectedMime || declaredMime !== detectedMime) throw new IdentityHttpError(415, profileImageError(kind, "type_invalid"));
  const originalBuffer = Uint8Array.from(original).buffer;
  const inputForInfo = new Blob([originalBuffer], { type: detectedMime });
  const info = await env.IDENTITY_IMAGES.info(inputForInfo.stream());
  if (info.format !== detectedMime || info.width < 1 || info.height < 1 || info.width > 8_192 || info.height > 8_192 || info.width * info.height > 33_554_432) {
    throw new IdentityHttpError(413, profileImageError(kind, "dimensions_invalid"));
  }
  const dimensions = kind === "avatar"
    ? { width: 512, height: 512 }
    : { width: 1_920, height: 1_080 };
  const transformed = await env.IDENTITY_IMAGES
    .input(new Blob([originalBuffer], { type: detectedMime }).stream())
    .transform({ fit: "scale-down", ...dimensions })
    .output({ format: "image/webp", quality: 85, anim: false });
  const derivative = await readBoundedResponseBytes(
    new Response(transformed.image()),
    kind === "avatar" ? 2_097_152 : 4_194_304,
    `profile_${kind}`
  );
  return new Response(Uint8Array.from(derivative).buffer, {
    status: 200,
    headers: {
      "cache-control": "public, max-age=60, must-revalidate",
      "content-disposition": "inline",
      "content-length": String(derivative.byteLength),
      "content-security-policy": "default-src 'none'; sandbox",
      "content-type": "image/webp",
      "cross-origin-resource-policy": "same-origin",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff"
    }
  });
}

const publicProfileAvatar: IdentityHandler = (request, env) => publicProfileImage(request, env, "avatar");
const publicProfileBanner: IdentityHandler = (request, env) => publicProfileImage(request, env, "banner");

const bootstrap: IdentityHandler = async (request, env) => {
  requireGet(request);
  assertIdentityEnabled(env);
  assertYouthFlagsSafe(env);
  const auth = await authenticateIdentityRequest(request, env);
  return success(await loadCurrentUserBootstrap(auth.supabase));
};

const profilePublication: IdentityHandler = async (request, env) => {
  const { auth, body } = await authenticatedMutation(request, env);
  exactKeys(body, ["clientRequestId", "enabled", "shortPublicBio"]);
  return success(await setCurrentUserPublicProfile(createIdentityServerClient(env), {
    actorUserId: auth.userId,
    clientRequestId: uuidValue(body.clientRequestId),
    enabled: booleanValue(body.enabled),
    shortPublicBio: optionalString(body.shortPublicBio, 280)
  }));
};

const legalAccept: IdentityHandler = async (request, env) => {
  const { auth, origin, body } = await authenticatedMutation(request, env);
  exactKeys(body, ["clientRequestId", "acceptances"]);
  return success(await acceptCurrentUserDocuments(createIdentityServerClient(env), {
    actorUserId: auth.userId,
    clientRequestId: uuidValue(body.clientRequestId),
    acceptances: acceptancesValue(body.acceptances),
    origin
  }));
};

const lifecycleRequest: IdentityHandler = async (request, env) => {
  const { auth, body } = await authenticatedMutation(request, env);
  exactKeys(body, ["clientRequestId", "action", "noticeVersion", "userNote", "turnstileToken"]);
  const clientRequestId = uuidValue(body.clientRequestId);
  await requireRateLimit(env, auth.userId, "lifecycle");
  await verifyTurnstile(env, {
    token: requiredString(body.turnstileToken, 1, 2_048),
    action: "identity_lifecycle_request",
    idempotencyKey: clientRequestId,
    remoteIp: remoteIp(request)
  });
  return success(await requestCurrentUserLifecycleAction(createIdentityServerClient(env), {
    actorUserId: auth.userId,
    clientRequestId,
    action: enumValue(body.action, ["export", "deletion"] as const),
    noticeVersion: requiredString(body.noticeVersion, 1, 64),
    userNote: optionalString(body.userNote, 2_000)
  }), 202);
};

const lifecycleRequests: IdentityHandler = async (request, env) => {
  requireGet(request);
  assertIdentityEnabled(env);
  assertYouthFlagsSafe(env);
  const url = new URL(request.url);
  if ([...url.searchParams.keys()].some((key) => !["limit", "before"].includes(key))
      || [...url.searchParams.keys()].some((key) => url.searchParams.getAll(key).length !== 1)) {
    throw new IdentityHttpError(400, "request_invalid");
  }
  const limitValue = url.searchParams.get("limit");
  const limit = limitValue === null ? 20 : boundedInteger(Number(limitValue), 1, 50);
  if (limitValue !== null && !/^\d{1,2}$/.test(limitValue)) throw new IdentityHttpError(400, "request_invalid");
  const auth = await authenticateIdentityRequest(request, env);
  await requireRateLimit(env, auth.userId, "lifecycle_read");
  return success(await listCurrentUserLifecycleRequests(auth.supabase, {
    limit,
    before: validatedBefore(url.searchParams.get("before"))
  }));
};

const lifecycleRequestDetail: IdentityHandler = async (request, env) => {
  requireGet(request);
  assertIdentityEnabled(env);
  const pathname = normalizePath(new URL(request.url).pathname);
  const requestId = exactUuidPath(pathname, /^\/v1\/lifecycle\/requests\/([0-9a-f-]{36})$/i);
  if (!requestId || new URL(request.url).search) throw new IdentityHttpError(400, "request_invalid");
  const auth = await authenticateIdentityRequest(request, env);
  await requireRateLimit(env, auth.userId, "lifecycle_read");
  const result = await loadCurrentUserLifecycleRequest(auth.supabase, requestId);
  if (!result || typeof result !== "object" || Array.isArray(result) || Object.keys(result).length === 0) {
    throw new IdentityHttpError(404, "lifecycle_request_not_found");
  }
  return success(result);
};

const lifecycleRequestCancel: IdentityHandler = async (request, env) => {
  const { auth, body } = await authenticatedMutation(request, env);
  const pathname = normalizePath(new URL(request.url).pathname);
  const requestId = exactUuidPath(pathname, /^\/v1\/lifecycle\/requests\/([0-9a-f-]{36})\/cancel$/i);
  if (!requestId || new URL(request.url).search) throw new IdentityHttpError(400, "request_invalid");
  exactKeys(body, ["clientRequestId"]);
  await requireRateLimit(env, auth.userId, "lifecycle_cancel");
  return success(await cancelCurrentUserCommunityDeletion(createIdentityServerClient(env), {
    actorUserId: auth.userId,
    clientRequestId: uuidValue(body.clientRequestId), requestId
  }));
};

const accountExportDownload: IdentityHandler = async (request, env) => {
  requireGet(request);
  assertIdentityEnabled(env);
  accountExportProvider(env);
  const url = new URL(request.url);
  const artifactId = exactUuidPath(
    normalizePath(url.pathname),
    /^\/v1\/account\/exports\/([0-9a-f-]{36})$/i
  );
  if (!artifactId || url.search) throw new IdentityHttpError(400, "request_invalid");
  const auth = await authenticateIdentityRequest(request, env);
  await requireRateLimit(env, auth.userId, "account_export_download");
  const asset = privateExportAsset(await loadCommunityExportDownloadAsset(createIdentityServerClient(env), {
    actorUserId: auth.userId, artifactId
  }), "download");
  if (asset.artifactId !== artifactId || !asset.expiresAt || Date.parse(asset.expiresAt) <= Date.now()) {
    throw new IdentityHttpError(404, "account_export_not_found");
  }
  const stored = await new R2AccountExportStorage(env.COMMUNITY_EXPORTS).get(asset.privateObjectKey);
  if (
    !stored || stored.objectKey !== asset.privateObjectKey || stored.byteSize !== asset.byteSize
    || stored.sha256 !== asset.artifactSha256 || stored.mimeType !== asset.mimeType
  ) throw new IdentityHttpError(502, "account_export_integrity_failed");
  return new Response(stored.body, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="elysia-community-export-${artifactId}.json"`,
      "content-length": String(stored.byteSize),
      "content-security-policy": "default-src 'none'; sandbox",
      "content-type": PRIVATE_EXPORT_CONTENT_TYPE,
      "cross-origin-resource-policy": "same-origin",
      "referrer-policy": "no-referrer",
      "x-content-sha256": stored.sha256,
      "x-content-type-options": "nosniff"
    }
  });
};

async function lifecycleOperatorMutation(request: Request, env: IdentityEnv) {
  const mutation = await authenticatedMutation(request, env);
  requireFreshAal2(mutation.auth, STAFF_MFA_MAX_AGE_SECONDS);
  assertLifecycleOperatorEnabled(env);
  await requireRateLimit(env, mutation.auth.userId, "lifecycle_operator");
  return mutation;
}

const lifecycleWorkClaim: IdentityHandler = async (request, env) => {
  const { auth, body } = await lifecycleOperatorMutation(request, env);
  exactKeys(body, ["clientRequestId", "limit", "privateReason"]);
  return success(await claimCommunityLifecycleWork(createIdentityServerClient(env), {
    actorUserId: auth.userId,
    actorAal: "aal2",
    clientRequestId: uuidValue(body.clientRequestId),
    limit: boundedInteger(body.limit, 1, 20),
    privateReason: requiredString(body.privateReason, 8, 1_000)
  }));
};

const lifecycleWorkItem: IdentityHandler = async (request, env) => {
  const { auth, body } = await lifecycleOperatorMutation(request, env);
  exactKeys(body, ["requestId"]);
  return success(await loadCommunityLifecycleWorkItem(createIdentityServerClient(env), {
    actorUserId: auth.userId,
    actorAal: "aal2",
    requestId: uuidValue(body.requestId)
  }));
};

const lifecycleWorkTransition: IdentityHandler = async (request, env) => {
  const { auth, body } = await lifecycleOperatorMutation(request, env);
  requireFreshAal2(auth, DESTRUCTIVE_MFA_MAX_AGE_SECONDS);
  exactKeys(body, [
    "clientRequestId", "requestId", "toStatus", "exportArtifactSha256",
    "exportExpiresAt", "privateReason"
  ]);
  const toStatus = enumValue(body.toStatus, LIFECYCLE_STATUSES);
  if (transitionRequiresExecutionEvidence(toStatus)) lifecycleExecutionProvider(env);
  const exportArtifactSha256 = nullableSha256(body.exportArtifactSha256);
  const exportExpiresAt = nullableFutureTimestamp(body.exportExpiresAt, 30 * 24 * 60 * 60 * 1_000);
  if ((exportArtifactSha256 === null) !== (exportExpiresAt === null)) {
    throw new IdentityHttpError(400, "request_invalid");
  }
  return success(await transitionCommunityLifecycleAction(createIdentityServerClient(env), {
    actorUserId: auth.userId,
    actorAal: "aal2",
    clientRequestId: uuidValue(body.clientRequestId),
    requestId: uuidValue(body.requestId),
    toStatus,
    exportArtifactSha256,
    exportExpiresAt,
    privateReason: requiredString(body.privateReason, 8, 2_000)
  }));
};

const lifecycleExportBuild: IdentityHandler = async (request, env) => {
  const { auth, body } = await lifecycleOperatorMutation(request, env);
  exactKeys(body, ["clientRequestId", "requestId", "privateReason"]);
  lifecycleExecutionProvider(env);
  const provider = accountExportProvider(env);
  const clientRequestId = uuidValue(body.clientRequestId);
  const lifecycleRequestId = uuidValue(body.requestId);
  const privateReason = requiredString(body.privateReason, 8, 2_000);
  const serverClient = createIdentityServerClient(env);
  const item = parseLifecycleWorkItem(await loadCommunityLifecycleWorkItem(serverClient, {
    actorUserId: auth.userId, actorAal: "aal2", requestId: lifecycleRequestId
  }), lifecycleRequestId);
  if (
    item.action !== "data_export" || item.status !== "processing" || item.claimedBy !== auth.userId
    || item.claimedAt === null
  ) throw new IdentityHttpError(409, "account_export_not_ready");

  // Both the object key and temporal metadata are stable for an exact operation
  // retry. If the private object was committed but the database response was
  // lost, reuse that immutable artifact instead of rebuilding a moving snapshot.
  const storage = new R2AccountExportStorage(env.COMMUNITY_EXPORTS);
  const objectKey = accountExportObjectKey(lifecycleRequestId, clientRequestId);
  const existing = await storage.get(objectKey);
  let stored: StoredAccountExport;
  if (existing) {
    await existing.body.cancel();
    stored = existing;
  } else {
    const sections: Record<string, unknown[]> = {};
    let estimatedBytes = 0;
    for (const section of ACCOUNT_EXPORT_SECTIONS) {
      const items: unknown[] = [];
      let afterId: string | null = null;
      const seenCursors = new Set<string>();
      for (let pageNumber = 0; pageNumber < 10_000; pageNumber += 1) {
        const page = exportSnapshotPage(await loadCommunityExportSnapshot(serverClient, {
          actorUserId: auth.userId, actorAal: "aal2", requestId: lifecycleRequestId,
          section, limit: 100, afterId
        }), lifecycleRequestId, section);
        items.push(...page.items);
        estimatedBytes += JSON.stringify(page.items).length;
        if (estimatedBytes > 100 * 1024 * 1024) throw new IdentityHttpError(413, "account_export_too_large");
        if (page.nextId === null) break;
        if (seenCursors.has(page.nextId)) throw new IdentityHttpError(502, "account_export_snapshot_invalid");
        seenCursors.add(page.nextId);
        afterId = page.nextId;
        if (pageNumber === 9_999) throw new IdentityHttpError(413, "account_export_too_large");
      }
      sections[section] = items;
    }
    const payload = new TextEncoder().encode(JSON.stringify({
      format: provider.format,
      generatedAt: item.claimedAt,
      requestId: lifecycleRequestId,
      sections
    }));
    stored = await storage.put(objectKey, payload);
  }
  const expiresAt = new Date(
    Date.parse(item.claimedAt) + accountExportTtlDays(env) * 24 * 60 * 60 * 1_000
  ).toISOString();
  // A database transport failure is ambiguous: the artifact row may already
  // be committed. Preserve the private object for an exact retry/reconciliation
  // instead of creating a database pointer to a deleted export.
  const recorded = await recordCommunityExportArtifact(serverClient, {
    actorUserId: auth.userId, actorAal: "aal2", clientRequestId,
    requestId: lifecycleRequestId, privateObjectKey: stored.objectKey,
    artifactSha256: stored.sha256, byteSize: stored.byteSize,
    mimeType: PRIVATE_EXPORT_CONTENT_TYPE, expiresAt, privateReason
  });
  const result = upstreamRecord(recorded, [
    "artifactId", "requestId", "status", "byteSize", "mimeType", "encryptionAtRest", "expiresAt", "downloadPath"
  ]);
  const artifactId = upstreamUuid(result.artifactId);
  const recordedExpiresAt = upstreamTimestamp(result.expiresAt);
  if (
    upstreamUuid(result.requestId) !== lifecycleRequestId || result.status !== "available"
    || upstreamInteger(result.byteSize, 1, 104_857_600) !== stored.byteSize
    || result.mimeType !== PRIVATE_EXPORT_CONTENT_TYPE || result.encryptionAtRest !== PRIVATE_EXPORT_ENCRYPTION
    || Date.parse(recordedExpiresAt) !== Date.parse(expiresAt)
    || result.downloadPath !== `/api/identity/v1/account/exports/${artifactId}`
  ) throw new IdentityHttpError(502, "account_export_record_invalid");
  return success({
    artifactId, requestId: lifecycleRequestId, status: "available", byteSize: stored.byteSize,
    mimeType: PRIVATE_EXPORT_CONTENT_TYPE, encryptionAtRest: PRIVATE_EXPORT_ENCRYPTION,
    artifactSha256: stored.sha256, expiresAt: recordedExpiresAt,
    downloadPath: `/api/identity/v1/account/exports/${artifactId}`
  }, 201);
};

function safeDeletionHandoff(value: unknown, requestId: string, phase: string): Record<string, unknown> {
  const result = upstreamRecord(value, [
    "requestId", "phase", "storageInventoryCompletedAt", "storageCleanupCompletedAt",
    "authDeletionRequestedAt", "authDeletionConfirmedAt"
  ]);
  if (upstreamUuid(result.requestId) !== requestId || result.phase !== phase) {
    throw new IdentityHttpError(502, "identity_database_response_invalid");
  }
  for (const key of [
    "storageInventoryCompletedAt", "storageCleanupCompletedAt", "authDeletionRequestedAt", "authDeletionConfirmedAt"
  ]) if (result[key] !== null) upstreamTimestamp(result[key]);
  return result;
}

const lifecycleStorageInventory: IdentityHandler = async (request, env) => {
  const { auth, body } = await lifecycleOperatorMutation(request, env);
  exactKeys(body, [
    "clientRequestId", "requestId", "evidenceSha256", "contentDisposition", "ownedStorageObjectCount", "privateReason"
  ]);
  lifecycleExecutionProvider(env);
  const requestId = uuidValue(body.requestId);
  const evidenceSha256 = nullableSha256(body.evidenceSha256);
  if (!evidenceSha256) throw new IdentityHttpError(400, "request_invalid");
  const serverClient = createIdentityServerClient(env);
  const item = parseLifecycleWorkItem(await loadCommunityLifecycleWorkItem(serverClient, {
    actorUserId: auth.userId, actorAal: "aal2", requestId
  }), requestId);
  if (item.action !== "account_deletion" || item.status !== "storage_inventory" || item.claimedBy !== auth.userId) {
    throw new IdentityHttpError(409, "storage_inventory_not_ready");
  }
  return success(safeDeletionHandoff(await recordCommunityDeletionHandoff(serverClient, {
    actorUserId: auth.userId, actorAal: "aal2", clientRequestId: uuidValue(body.clientRequestId), requestId,
    phase: "storage_inventory_completed", evidenceSha256,
    contentDisposition: enumValue(body.contentDisposition, [
      "preserve_public_credit_anonymize_account", "remove_user_content_preserve_required_legal_evidence"
    ] as const),
    ownedStorageObjectCount: boundedInteger(body.ownedStorageObjectCount, 0, 2_147_483_647),
    authProviderReceiptSha256: null,
    privateReason: requiredString(body.privateReason, 8, 2_000)
  }), requestId, "storage_inventory_completed"));
};

const lifecycleStorageCleanup: IdentityHandler = async (request, env) => {
  const { auth, body } = await lifecycleOperatorMutation(request, env);
  requireFreshAal2(auth, DESTRUCTIVE_MFA_MAX_AGE_SECONDS);
  exactKeys(body, ["clientRequestId", "requestId", "privateReason"]);
  lifecycleExecutionProvider(env);
  storageCleanupProvider(env);
  const clientRequestId = uuidValue(body.clientRequestId);
  const requestId = uuidValue(body.requestId);
  const privateReason = requiredString(body.privateReason, 8, 2_000);
  const serverClient = createIdentityServerClient(env);
  const item = parseLifecycleWorkItem(await loadCommunityLifecycleWorkItem(serverClient, {
    actorUserId: auth.userId, actorAal: "aal2", requestId
  }), requestId);
  if (item.action !== "account_deletion" || item.status !== "storage_cleanup" || item.claimedBy !== auth.userId) {
    throw new IdentityHttpError(409, "storage_cleanup_not_ready");
  }
  await enqueueArtisanAccountCleanup(serverClient, {
    actorUserId: auth.userId, actorAal: "aal2", clientRequestId, requestId
  });
  const readiness = upstreamRecord(await loadArtisanAccountCleanupReadiness(serverClient, requestId), [
    "lifecycleRequestId", "status", "expectedAssetCount", "completedAssetCount",
    "completionEvidenceSha256", "completedAt", "ready"
  ]);
  if (upstreamUuid(readiness.lifecycleRequestId) !== requestId || typeof readiness.ready !== "boolean") {
    throw new IdentityHttpError(502, "storage_cleanup_response_invalid");
  }
  const expectedAssetCount = upstreamInteger(readiness.expectedAssetCount, 0, 2_147_483_647);
  const completedAssetCount = upstreamInteger(readiness.completedAssetCount, 0, 2_147_483_647);
  if (completedAssetCount > expectedAssetCount) throw new IdentityHttpError(502, "storage_cleanup_response_invalid");
  if (!readiness.ready) {
    return success({
      requestId, status: upstreamString(readiness.status, 3, 40), expectedAssetCount,
      completedAssetCount, ready: false, completionEvidenceSha256: null, handoff: null
    }, 202);
  }
  const evidenceSha256 = upstreamSha256(readiness.completionEvidenceSha256);
  const handoffClientRequestId = uuidFromSha256(await sha256Text(
    `storage-cleanup-handoff-v1:${requestId}:${evidenceSha256}`
  ));
  const handoff = safeDeletionHandoff(await recordCommunityDeletionHandoff(serverClient, {
    actorUserId: auth.userId, actorAal: "aal2", clientRequestId: handoffClientRequestId,
    requestId, phase: "storage_cleanup_completed", evidenceSha256,
    contentDisposition: null, ownedStorageObjectCount: null, authProviderReceiptSha256: null,
    privateReason
  }), requestId, "storage_cleanup_completed");
  return success({
    requestId, status: upstreamString(readiness.status, 3, 40), expectedAssetCount,
    completedAssetCount, ready: true, completionEvidenceSha256: evidenceSha256, handoff
  });
};

const lifecycleAuthDelete: IdentityHandler = async (request, env) => {
  const { auth, body } = await lifecycleOperatorMutation(request, env);
  requireFreshAal2(auth, DESTRUCTIVE_MFA_MAX_AGE_SECONDS);
  exactKeys(body, ["clientRequestId", "requestId", "privateReason"]);
  lifecycleExecutionProvider(env);
  authDeletionProvider(env);
  const requestId = uuidValue(body.requestId);
  const privateReason = requiredString(body.privateReason, 8, 2_000);
  const serverClient = createIdentityServerClient(env);
  const item = parseLifecycleWorkItem(await loadCommunityLifecycleWorkItem(serverClient, {
    actorUserId: auth.userId, actorAal: "aal2", requestId
  }), requestId);
  if (item.action !== "account_deletion" || item.status !== "auth_deletion_ready" || item.claimedBy !== auth.userId) {
    throw new IdentityHttpError(409, "auth_deletion_not_ready");
  }
  if (
    item.handoff?.authDeletionConfirmedAt
    && item.handoff.authDeletionRequestedAt
    && item.handoff.hasAuthProviderReceipt
  ) {
    return success({
      requestId,
      provider: "supabase-auth-soft-delete-v1",
      status: "confirmed",
      handoff: {
        requestId,
        phase: "auth_deletion_confirmed",
        storageInventoryCompletedAt: item.handoff.storageInventoryCompletedAt,
        storageCleanupCompletedAt: item.handoff.storageCleanupCompletedAt,
        authDeletionRequestedAt: item.handoff.authDeletionRequestedAt,
        authDeletionConfirmedAt: item.handoff.authDeletionConfirmedAt
      }
    });
  }
  const requestEvidence = await authDeletionRequestEvidence(requestId, item.userId);
  const requestPhaseId = uuidFromSha256(await sha256Text(`auth-deletion-request-v1:${requestId}:${requestEvidence}`));
  await recordCommunityDeletionHandoff(serverClient, {
    actorUserId: auth.userId, actorAal: "aal2", clientRequestId: requestPhaseId, requestId,
    phase: "auth_deletion_requested", evidenceSha256: requestEvidence,
    contentDisposition: null, ownedStorageObjectCount: null, authProviderReceiptSha256: null, privateReason
  });
  const confirmation = await new SupabaseAuthSoftDeleteAdapter(serverClient).softDelete(item.userId, requestId);
  const confirmPhaseId = uuidFromSha256(await sha256Text(
    `auth-deletion-confirm-v1:${requestId}:${confirmation.confirmationEvidenceSha256}`
  ));
  const handoff = safeDeletionHandoff(await recordCommunityDeletionHandoff(serverClient, {
    actorUserId: auth.userId, actorAal: "aal2", clientRequestId: confirmPhaseId, requestId,
    phase: "auth_deletion_confirmed", evidenceSha256: confirmation.confirmationEvidenceSha256,
    contentDisposition: null, ownedStorageObjectCount: null,
    authProviderReceiptSha256: confirmation.providerReceiptSha256, privateReason
  }), requestId, "auth_deletion_confirmed");
  return success({ requestId, provider: confirmation.provider, status: "confirmed", handoff });
};

async function confirmedNotificationEmail(
  client: ReturnType<typeof createIdentityServerClient>,
  userId: string
): Promise<string> {
  const { data, error } = await client.auth.admin.getUserById(userId);
  const email = data.user?.email?.trim().toLowerCase();
  if (
    error || !email || email.length > 254 || /[\s\r\n]/.test(email)
    || !/^[^@]+@[^@]+\.[^@]+$/.test(email)
    || typeof data.user?.email_confirmed_at !== "string"
  ) throw new IdentityHttpError(502, "notification_recipient_unavailable");
  return email;
}

async function processNotificationDelivery(env: IdentityEnv): Promise<{ claimed: number; completed: number; failed: number }> {
  const provider = notificationDeliveryProvider(env);
  const serverClient = createIdentityServerClient(env);
  const claimed = upstreamRecord(await claimNotificationDeliveryJobs(serverClient, {
    workerId: NOTIFICATION_WORKER_ID, limit: 25, leaseSeconds: 120
  }), ["workerId", "items"]);
  if (claimed.workerId !== NOTIFICATION_WORKER_ID || !Array.isArray(claimed.items) || claimed.items.length > 25) {
    throw new IdentityHttpError(502, "notification_claim_response_invalid");
  }
  const adapter = new DatabaseInAppNotificationAdapter();
  const emailAdapter = provider.sendsExternalEmail ? new CloudflareEmailNotificationAdapter({
    email: env.IDENTITY_EMAIL,
    senderEmail: env.IDENTITY_NOTIFICATION_SENDER_EMAIL,
    senderName: env.IDENTITY_NOTIFICATION_SENDER_NAME,
    origin: env.IDENTITY_NOTIFICATION_PUBLIC_ORIGIN
  }) : null;
  let completed = 0;
  let failed = 0;
  for (const rawJob of claimed.items) {
    let notificationId = "";
    let attemptCount = 1;
    try {
      const job = upstreamRecord(rawJob, [
        "notificationId", "userId", "type", "title", "body", "actionPath", "sourceType", "sourceId",
        "attemptCount", "leaseExpiresAt", "emailDeliveryAllowed"
      ]);
      notificationId = upstreamUuid(job.notificationId);
      const userId = upstreamUuid(job.userId);
      const type = upstreamString(job.type, 3, 100);
      const title = upstreamString(job.title, 1, 200);
      const body = upstreamString(job.body, 1, 2_000);
      const actionPath = job.actionPath === null ? null : upstreamString(job.actionPath, 1, 500);
      if (job.sourceType !== null) upstreamString(job.sourceType, 1, 80);
      if (job.sourceId !== null) upstreamUuid(job.sourceId);
      attemptCount = upstreamInteger(job.attemptCount, 1, 20);
      upstreamTimestamp(job.leaseExpiresAt);
      if (typeof job.emailDeliveryAllowed !== "boolean") {
        throw new IdentityHttpError(502, "notification_job_invalid");
      }
      const baseJob = { notificationId, userId, type, actionPath, emailDeliveryAllowed: job.emailDeliveryAllowed };
      const receipt = emailAdapter && job.emailDeliveryAllowed
        ? await emailAdapter.deliver({ ...baseJob, title, body, recipientEmail: await confirmedNotificationEmail(serverClient, userId) })
        : await adapter.deliver(baseJob);
      const completionId = uuidFromSha256(await sha256Text(
        `notification-complete-v1:${notificationId}:${attemptCount}:${receipt.deliveryEvidenceSha256}`
      ));
      await completeNotificationDelivery(serverClient, {
        clientRequestId: completionId, workerId: NOTIFICATION_WORKER_ID,
        notificationId, evidenceSha256: receipt.deliveryEvidenceSha256
      });
      completed += 1;
    } catch (error) {
      failed += 1;
      if (notificationId) {
        const code = stableWorkerFailureCode(error, "notification_delivery_failed");
        const evidence = await sha256Text(`notification-failed-v1:${notificationId}:${attemptCount}:${code}`);
        const failureId = uuidFromSha256(await sha256Text(
          `notification-failure-record-v1:${notificationId}:${attemptCount}:${evidence}`
        ));
        await failNotificationDelivery(serverClient, {
          clientRequestId: failureId, workerId: NOTIFICATION_WORKER_ID, notificationId,
          errorCode: code, evidenceSha256: evidence,
          retryAfterSeconds: Math.min(86_400, 60 * 2 ** Math.min(attemptCount - 1, 10))
        }).catch(() => undefined);
      }
    }
  }
  return { claimed: claimed.items.length, completed, failed };
}

async function processExportRetention(env: IdentityEnv): Promise<{ claimed: number; completed: number; failed: number }> {
  exportRetentionProvider(env);
  const serverClient = createIdentityServerClient(env);
  const claimed = upstreamRecord(await claimCommunityExportRetentionJobs(serverClient, {
    workerId: EXPORT_RETENTION_WORKER_ID, limit: 20, leaseSeconds: 120
  }), ["workerId", "items"]);
  if (claimed.workerId !== EXPORT_RETENTION_WORKER_ID || !Array.isArray(claimed.items) || claimed.items.length > 20) {
    throw new IdentityHttpError(502, "export_retention_claim_response_invalid");
  }
  const storage = new R2AccountExportStorage(env.COMMUNITY_EXPORTS);
  let completed = 0;
  let failed = 0;
  for (const rawJob of claimed.items) {
    let artifactId = "";
    let attemptCount = 1;
    try {
      const job = upstreamRecord(rawJob, ["artifactId", "requestId", "attemptCount", "leaseExpiresAt"]);
      artifactId = upstreamUuid(job.artifactId);
      upstreamUuid(job.requestId);
      attemptCount = upstreamInteger(job.attemptCount, 1, 20);
      upstreamTimestamp(job.leaseExpiresAt);
      const asset = privateExportAsset(await loadCommunityExportRetentionAsset(serverClient, {
        workerId: EXPORT_RETENTION_WORKER_ID, artifactId
      }), "retention");
      if (asset.artifactId !== artifactId) throw new IdentityHttpError(502, "export_retention_asset_invalid");
      const existing = await storage.get(asset.privateObjectKey);
      if (existing && (
        existing.byteSize !== asset.byteSize || existing.sha256 !== asset.artifactSha256
        || existing.mimeType !== asset.mimeType
      )) throw new IdentityHttpError(502, "account_export_integrity_failed");
      if (existing) await existing.body.cancel();
      await storage.delete(asset.privateObjectKey);
      const deletedObjectCount = existing ? 1 : 0;
      const evidence = await sha256Text(
        `export-retention-complete-v1:${artifactId}:${asset.artifactSha256}:${deletedObjectCount}`
      );
      const completionId = uuidFromSha256(await sha256Text(
        `export-retention-completion-record-v1:${artifactId}:${attemptCount}:${evidence}`
      ));
      await completeCommunityExportRetention(serverClient, {
        clientRequestId: completionId, workerId: EXPORT_RETENTION_WORKER_ID,
        artifactId, evidenceSha256: evidence, deletedObjectCount
      });
      completed += 1;
    } catch (error) {
      failed += 1;
      if (artifactId) {
        const code = stableWorkerFailureCode(error, "export_retention_failed");
        const evidence = await sha256Text(`export-retention-failed-v1:${artifactId}:${attemptCount}:${code}`);
        const failureId = uuidFromSha256(await sha256Text(
          `export-retention-failure-record-v1:${artifactId}:${attemptCount}:${evidence}`
        ));
        await failCommunityExportRetention(serverClient, {
          clientRequestId: failureId, workerId: EXPORT_RETENTION_WORKER_ID, artifactId,
          errorCode: code, evidenceSha256: evidence,
          retryAfterSeconds: Math.min(86_400, 60 * 2 ** Math.min(attemptCount - 1, 10))
        }).catch(() => undefined);
      }
    }
  }
  return { claimed: claimed.items.length, completed, failed };
}

/** Scheduled planes are isolated: disabled providers and one outage never starve the other plane. */
export async function handleIdentityScheduledMaintenance(env: IdentityEnv): Promise<void> {
  try {
    const result = await processNotificationDelivery(env);
    console.info(JSON.stringify({ event: "identity.notification_delivery", outcome: "completed", ...result }));
  } catch {
    console.info(JSON.stringify({ event: "identity.notification_delivery", outcome: "disabled_or_failed" }));
  }
  try {
    const result = await processExportRetention(env);
    console.info(JSON.stringify({ event: "identity.export_retention", outcome: "completed", ...result }));
  } catch {
    console.info(JSON.stringify({ event: "identity.export_retention", outcome: "disabled_or_failed" }));
  }
}

const notificationPreferences: IdentityHandler = async (request, env) => {
  const { auth, body } = await authenticatedMutation(request, env);
  exactKeys(body, [
    "clientRequestId",
    "inAppEnabled",
    "emailEnabled",
    "mentionsEnabled",
    "commentsEnabled",
    "challengeUpdatesEnabled",
    "moderationUpdatesEnabled",
    "guardianUpdatesEnabled",
    "quietHoursStart",
    "quietHoursEnd"
  ]);
  await requireRateLimit(env, auth.userId, "notification_preferences");
  const quietHoursStart = nullableTimeValue(body.quietHoursStart);
  const quietHoursEnd = nullableTimeValue(body.quietHoursEnd);
  if ((quietHoursStart === null) !== (quietHoursEnd === null)) {
    throw new IdentityHttpError(400, "quiet_hours_invalid");
  }
  return success(await updateNotificationPreferencesForActor(createIdentityServerClient(env), {
    actorUserId: auth.userId,
    clientRequestId: uuidValue(body.clientRequestId),
    inAppEnabled: booleanValue(body.inAppEnabled),
    emailEnabled: booleanValue(body.emailEnabled),
    mentionsEnabled: booleanValue(body.mentionsEnabled),
    commentsEnabled: booleanValue(body.commentsEnabled),
    challengeUpdatesEnabled: booleanValue(body.challengeUpdatesEnabled),
    moderationUpdatesEnabled: booleanValue(body.moderationUpdatesEnabled),
    guardianUpdatesEnabled: booleanValue(body.guardianUpdatesEnabled),
    quietHoursStart,
    quietHoursEnd
  }));
};

const guardianRelationshipRevoke: IdentityHandler = async (request, env) => {
  const { auth, body } = await authenticatedMutation(request, env);
  exactKeys(body, ["clientRequestId", "relationshipId", "reason"]);
  await requireRateLimit(env, auth.userId, "guardian_revocation");
  return success(await revokeCurrentUserGuardianRelationship(createIdentityServerClient(env), {
    actorUserId: auth.userId,
    clientRequestId: uuidValue(body.clientRequestId),
    relationshipId: uuidValue(body.relationshipId),
    reason: requiredString(body.reason, 8, 1_000)
  }));
};

const guardianConsentRevoke: IdentityHandler = async (request, env) => {
  const { auth, body } = await authenticatedMutation(request, env);
  exactKeys(body, ["clientRequestId", "consentId", "reason"]);
  await requireRateLimit(env, auth.userId, "guardian_revocation");
  return success(await revokeCurrentUserGuardianConsent(createIdentityServerClient(env), {
    actorUserId: auth.userId,
    clientRequestId: uuidValue(body.clientRequestId),
    consentId: uuidValue(body.consentId),
    reason: requiredString(body.reason, 8, 1_000)
  }));
};

const ageStart: IdentityHandler = async (request, env) => {
  const { auth, body } = await authenticatedMutation(request, env);
  exactKeys(body, ["clientRequestId", "returnUrl", "turnstileToken"]);
  const clientRequestId = uuidValue(body.clientRequestId);
  await requireRateLimit(env, auth.userId, "age_assurance");
  await verifyTurnstile(env, {
    token: requiredString(body.turnstileToken, 1, 2_048),
    action: "identity_age_assurance",
    idempotencyKey: clientRequestId,
    remoteIp: remoteIp(request)
  });
  const provider = ageAssuranceProvider(env);
  const result = providerStartResult(await provider.start({
    userId: auth.userId,
    returnUrl: httpsReturnUrl(body.returnUrl, allowedOrigins(env)),
    clientRequestId
  }), provider.name, provider.redirectOrigins);
  const transaction = await startCommunityProviderTransaction(createIdentityServerClient(env), {
    actorUserId: auth.userId,
    actorAal: auth.aal,
    clientRequestId,
    provider: result.provider,
    purpose: "age_assurance",
    subjectUserId: auth.userId,
    guardianUserId: null,
    guardianRelationshipId: null,
    relationshipType: null,
    consentScope: null,
    documentKey: null,
    documentVersion: null,
    contentSha256: null,
    authorityExpiresAt: null,
    externalReferenceSha256: await sha256Text(result.externalReference),
    stateNonceSha256: await sha256Text(result.stateNonce),
    expiresAt: result.expiresAt,
    privateReason: "User initiated age assurance through the configured reviewed provider."
  });
  return success(safeProviderStartResponse(transaction, result), 202);
};

const guardianRelationshipStart: IdentityHandler = async (request, env) => {
  const { auth, body } = await authenticatedMutation(request, env);
  exactKeys(body, ["clientRequestId", "dependentHandle", "relationshipType", "authorityExpiresAt", "returnUrl", "turnstileToken"]);
  const clientRequestId = uuidValue(body.clientRequestId);
  const dependentHandle = publicHandleValue(body.dependentHandle);
  const relationshipType = enumValue(body.relationshipType, RELATIONSHIP_TYPES);
  const authorityExpiresAt = futureTimestamp(body.authorityExpiresAt, 2 * 365 * 24 * 60 * 60 * 1_000);
  await requireRateLimit(env, auth.userId, "guardian_relationship");
  await verifyTurnstile(env, {
    token: requiredString(body.turnstileToken, 1, 2_048),
    action: "identity_guardian_relationship",
    idempotencyKey: clientRequestId,
    remoteIp: remoteIp(request)
  });
  const provider = guardianConsentProvider(env);
  const result = providerStartResult(await provider.start({
    purpose: "guardian_relationship",
    guardianUserId: auth.userId,
    dependentHandle,
    relationshipType,
    authorityExpiresAt,
    returnUrl: httpsReturnUrl(body.returnUrl, allowedOrigins(env)),
    clientRequestId
  }), provider.name, provider.redirectOrigins);
  const transaction = await startCommunityGuardianRelationshipByHandle(createIdentityServerClient(env), {
    actorUserId: auth.userId, actorAal: auth.aal, clientRequestId,
    provider: result.provider, dependentHandle, relationshipType,
    authorityExpiresAt,
    externalReferenceSha256: await sha256Text(result.externalReference),
    stateNonceSha256: await sha256Text(result.stateNonce),
    expiresAt: result.expiresAt,
    privateReason: "Guardian initiated relationship verification through the configured reviewed provider."
  });
  return success(safeProviderStartResponse(transaction, result, dependentHandle), 202);
};

const guardianConsentStart: IdentityHandler = async (request, env) => {
  const { auth, body } = await authenticatedMutation(request, env);
  exactKeys(body, [
    "clientRequestId", "relationshipId", "scope", "documentKey", "documentVersion",
    "contentSha256", "authorityExpiresAt", "returnUrl", "turnstileToken"
  ]);
  const clientRequestId = uuidValue(body.clientRequestId);
  const relationshipId = uuidValue(body.relationshipId);
  const consentScope = enumValue(body.scope, GUARDIAN_SCOPES);
  const documentKey = requiredString(body.documentKey, 2, 80);
  const documentVersion = requiredString(body.documentVersion, 1, 80);
  const contentSha256 = requiredString(body.contentSha256, 64, 64).toLowerCase();
  if (!/^[a-z][a-z0-9_]{1,79}$/.test(documentKey) || !/^[0-9a-f]{64}$/.test(contentSha256)) {
    throw new IdentityHttpError(400, "request_invalid");
  }
  const authorityExpiresAt = futureTimestamp(body.authorityExpiresAt, 2 * 365 * 24 * 60 * 60 * 1_000);
  await requireRateLimit(env, auth.userId, "guardian_consent");
  await verifyTurnstile(env, {
    token: requiredString(body.turnstileToken, 1, 2_048),
    action: "identity_guardian_consent",
    idempotencyKey: clientRequestId,
    remoteIp: remoteIp(request)
  });
  const serverClient = createIdentityServerClient(env);
  const relationship = guardianRelationshipForProvider(
    await loadGuardianRelationshipForProvider(serverClient, { actorUserId: auth.userId, relationshipId }),
    auth.userId,
    relationshipId
  );
  const provider = guardianConsentProvider(env);
  const result = providerStartResult(await provider.start({
    purpose: "guardian_consent",
    guardianUserId: auth.userId,
    dependentUserId: relationship.dependentUserId,
    relationshipId,
    consentScope,
    documentKey,
    documentVersion,
    contentSha256,
    authorityExpiresAt,
    returnUrl: httpsReturnUrl(body.returnUrl, allowedOrigins(env)),
    clientRequestId
  }), provider.name, provider.redirectOrigins);
  const transaction = await startCommunityProviderTransaction(serverClient, {
    actorUserId: auth.userId, actorAal: auth.aal, clientRequestId,
    provider: result.provider, purpose: "guardian_consent",
    subjectUserId: relationship.dependentUserId, guardianUserId: auth.userId,
    guardianRelationshipId: relationshipId, relationshipType: null, consentScope,
    documentKey, documentVersion, contentSha256, authorityExpiresAt,
    externalReferenceSha256: await sha256Text(result.externalReference),
    stateNonceSha256: await sha256Text(result.stateNonce),
    expiresAt: result.expiresAt,
    privateReason: "Guardian initiated exact scoped consent through the configured reviewed provider."
  });
  return success(safeProviderStartResponse(transaction, result), 202);
};

const guardianSponsoredAccountStart: IdentityHandler = async (request, env) => {
  const { auth, body } = await under13AuthenticatedMutation(
    request, env, "IDENTITY_UNDER13_SPONSORED_ACCOUNTS_ENABLED"
  );
  requireFreshAal2(auth, DESTRUCTIVE_MFA_MAX_AGE_SECONDS);
  exactKeys(body, [
    "clientRequestId", "dependentContact", "relationshipType", "authorityExpiresAt",
    "returnUrl", "turnstileToken"
  ]);
  const clientRequestId = uuidValue(body.clientRequestId);
  const dependentContact = normalizedDependentContact(body.dependentContact);
  const relationshipType = enumValue(body.relationshipType, RELATIONSHIP_TYPES);
  const authorityExpiresAt = futureTimestamp(body.authorityExpiresAt, 2 * 365 * 24 * 60 * 60 * 1_000);
  await requireRateLimit(env, auth.userId, "guardian_sponsored_account");
  await verifyTurnstile(env, {
    token: requiredString(body.turnstileToken, 1, 2_048),
    action: "identity_guardian_sponsored_account",
    idempotencyKey: clientRequestId,
    remoteIp: remoteIp(request)
  });
  const provider = guardianConsentProvider(env);
  const start = providerStartResult(await provider.start({
    purpose: "guardian_sponsored_account",
    guardianUserId: auth.userId,
    dependentContact,
    relationshipType,
    authorityExpiresAt,
    returnUrl: httpsReturnUrl(body.returnUrl, allowedOrigins(env)),
    clientRequestId
  }), provider.name, provider.redirectOrigins);
  const contactHmac = await hmacSha256Text(
    env.GUARDIAN_SPONSORSHIP_CONTACT_HMAC_KEY,
    `guardian-sponsorship-contact-v1:${dependentContact}`
  );
  // Deterministic for an exact idempotent retry, pseudorandom under the
  // Worker-only HMAC secret, and returned only once through the authenticated
  // response for out-of-band delivery to the dependent.
  const claimToken = await hmacSha256Text(
    env.GUARDIAN_SPONSORSHIP_CONTACT_HMAC_KEY,
    `guardian-sponsorship-claim-v1:${auth.userId}:${clientRequestId}`
  );
  const serverClient = createIdentityServerClient(env);
  const persisted = upstreamRecord(await startGuardianSponsoredAccount(serverClient, {
    actorUserId: auth.userId,
    actorAal: "aal2",
    clientRequestId,
    provider: start.provider,
    dependentContactHmacSha256: contactHmac,
    claimNonceSha256: await sha256Text(`guardian-sponsorship-claim-nonce-v1:${claimToken}`),
    relationshipType,
    authorityExpiresAt,
    externalReferenceSha256: await sha256Text(start.externalReference),
    stateNonceSha256: await sha256Text(start.stateNonce),
    requestExpiresAt: start.expiresAt,
    privateReason: "Verified guardian initiated a provider-reviewed sponsored account claim."
  }), ["sponsorshipId", "provider", "status", "requestExpiresAt", "authorityExpiresAt"]);
  const sponsorshipId = upstreamUuid(persisted.sponsorshipId);
  const requestExpiresAt = upstreamTimestamp(persisted.requestExpiresAt);
  const recordedAuthorityExpiresAt = upstreamTimestamp(persisted.authorityExpiresAt);
  if (
    persisted.provider !== start.provider || persisted.status !== "pending_provider"
    || Date.parse(requestExpiresAt) !== Date.parse(start.expiresAt)
    || Date.parse(recordedAuthorityExpiresAt) !== Date.parse(authorityExpiresAt)
  ) throw new IdentityHttpError(502, "identity_database_response_invalid");
  return success({
    sponsorshipId,
    provider: start.provider,
    status: "pending_provider",
    redirectUrl: start.redirectUrl,
    claimToken,
    requestExpiresAt,
    authorityExpiresAt: recordedAuthorityExpiresAt
  }, 202);
};

const guardianSponsoredAccountClaim: IdentityHandler = async (request, env) => {
  const { auth, body } = await under13AuthenticatedMutation(
    request, env, "IDENTITY_UNDER13_SPONSORED_ACCOUNTS_ENABLED"
  );
  requireFreshAal2(auth, DESTRUCTIVE_MFA_MAX_AGE_SECONDS);
  exactKeys(body, ["clientRequestId", "sponsorshipId", "claimToken", "turnstileToken"]);
  const clientRequestId = uuidValue(body.clientRequestId);
  const claimToken = requiredString(body.claimToken, 64, 64).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(claimToken)) throw new IdentityHttpError(400, "claim_token_invalid");
  await requireRateLimit(env, auth.userId, "guardian_sponsored_account_claim");
  await verifyTurnstile(env, {
    token: requiredString(body.turnstileToken, 1, 2_048),
    action: "identity_guardian_sponsorship_claim",
    idempotencyKey: clientRequestId,
    remoteIp: remoteIp(request)
  });
  return success(await claimGuardianSponsoredAccount(createIdentityServerClient(env), {
    actorUserId: auth.userId,
    actorAal: "aal2",
    clientRequestId,
    sponsorshipId: uuidValue(body.sponsorshipId),
    claimNonceSha256: await sha256Text(`guardian-sponsorship-claim-nonce-v1:${claimToken}`),
    privateReason: "Dependent claimed a provider-verified guardian sponsorship using the one-time claim secret."
  }));
};

const guardianContentApprovalRequest: IdentityHandler = async (request, env) => {
  const { auth, body } = await under13AuthenticatedMutation(
    request, env, "IDENTITY_UNDER13_CONTENT_APPROVAL_ENABLED", false
  );
  exactKeys(body, ["clientRequestId", "targetType", "targetId", "privateReason"]);
  await requireRateLimit(env, auth.userId, "guardian_content_approval");
  return success(await requestGuardianContentApproval(createIdentityServerClient(env), {
    actorUserId: auth.userId,
    clientRequestId: uuidValue(body.clientRequestId),
    targetType: enumValue(body.targetType, ["artwork", "post", "comment", "submission", "media"] as const),
    targetId: uuidValue(body.targetId),
    privateReason: requiredString(body.privateReason, 8, 1_000)
  }), 201);
};

const guardianContentApprovalQueue: IdentityHandler = async (request, env) => {
  requireGet(request);
  assertUnder13WorkerFeature(env, "IDENTITY_UNDER13_CONTENT_APPROVAL_ENABLED", false);
  const url = new URL(request.url);
  if ([...url.searchParams.keys()].some((key) => !["limit", "before"].includes(key))
      || [...url.searchParams.keys()].some((key) => url.searchParams.getAll(key).length !== 1)) {
    throw new IdentityHttpError(400, "request_invalid");
  }
  const limitText = url.searchParams.get("limit");
  if (limitText !== null && !/^\d{1,3}$/.test(limitText)) throw new IdentityHttpError(400, "request_invalid");
  const auth = await authenticateIdentityRequest(request, env);
  requireAal2(auth);
  await requireRateLimit(env, auth.userId, "guardian_content_approval_read");
  return success(await loadGuardianContentApprovalQueue(createIdentityServerClient(env), {
    actorUserId: auth.userId,
    actorAal: "aal2",
    limit: limitText === null ? 50 : boundedInteger(Number(limitText), 1, 100),
    before: validatedBefore(url.searchParams.get("before"))
  }));
};

const guardianContentApprovalDecide: IdentityHandler = async (request, env) => {
  const { auth, body } = await under13AuthenticatedMutation(
    request, env, "IDENTITY_UNDER13_CONTENT_APPROVAL_ENABLED", false
  );
  requireAal2(auth);
  exactKeys(body, [
    "clientRequestId", "approvalRequestId", "expectedRevisionSha256", "decision", "privateReason"
  ]);
  const expectedRevisionSha256 = requiredString(body.expectedRevisionSha256, 64, 64).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expectedRevisionSha256)) {
    throw new IdentityHttpError(400, "request_invalid");
  }
  const decision = enumValue(body.decision, ["approve", "reject"] as const);
  // Approval expands a child's publishing authority and therefore requires a
  // fresh factor. Rejection remains available with ordinary AAL2 so a stale
  // step-up cannot strand a privacy-preserving refusal.
  if (decision === "approve") requireFreshAal2(auth, DESTRUCTIVE_MFA_MAX_AGE_SECONDS);
  await requireRateLimit(env, auth.userId, "guardian_content_approval_decision");
  return success(await decideGuardianContentApproval(createIdentityServerClient(env), {
    actorUserId: auth.userId,
    actorAal: "aal2",
    clientRequestId: uuidValue(body.clientRequestId),
    approvalRequestId: uuidValue(body.approvalRequestId),
    expectedRevisionSha256,
    decision,
    privateReason: requiredString(body.privateReason, 8, 1_000)
  }));
};

const guardianDependentStatus: IdentityHandler = async (request, env) => {
  requireGet(request);
  assertUnder13WorkerFeature(env, "IDENTITY_UNDER13_DEPENDENT_CONTROLS_ENABLED", false);
  const url = new URL(request.url);
  if ([...url.searchParams.keys()].some((key) => key !== "handle") || url.searchParams.getAll("handle").length !== 1) {
    throw new IdentityHttpError(400, "request_invalid");
  }
  const auth = await authenticateIdentityRequest(request, env);
  requireAal2(auth);
  await requireRateLimit(env, auth.userId, "guardian_dependent_status");
  return success(await loadGuardianDependentStatus(createIdentityServerClient(env), {
    actorUserId: auth.userId,
    actorAal: "aal2",
    dependentHandle: publicHandleValue(url.searchParams.get("handle"))
  }));
};

const guardianDependentProfile: IdentityHandler = async (request, env) => {
  const { auth, body } = await under13AuthenticatedMutation(
    request, env, "IDENTITY_UNDER13_DEPENDENT_CONTROLS_ENABLED", false
  );
  requireAal2(auth);
  exactKeys(body, ["clientRequestId", "dependentHandle", "enabled", "privateReason"]);
  const enabled = booleanValue(body.enabled);
  // Publishing a child's profile is a fresh step-up action. Disabling public
  // visibility remains available without a fresh timestamp.
  if (enabled) requireFreshAal2(auth, DESTRUCTIVE_MFA_MAX_AGE_SECONDS);
  await requireRateLimit(env, auth.userId, "guardian_dependent_profile");
  return success(await setGuardianDependentProfile(createIdentityServerClient(env), {
    actorUserId: auth.userId,
    actorAal: "aal2",
    clientRequestId: uuidValue(body.clientRequestId),
    dependentHandle: publicHandleValue(body.dependentHandle),
    enabled,
    privateReason: requiredString(body.privateReason, 8, 1_000)
  }));
};

const guardianDependentLifecycleRequest: IdentityHandler = async (request, env) => {
  const { auth, body } = await under13AuthenticatedMutation(
    request, env, "IDENTITY_UNDER13_DEPENDENT_CONTROLS_ENABLED", false
  );
  requireAal2(auth);
  exactKeys(body, ["clientRequestId", "dependentHandle", "action", "noticeVersion", "userNote"]);
  const action = enumValue(body.action, ["export", "deletion"] as const);
  if (action === "deletion") requireFreshAal2(auth, DESTRUCTIVE_MFA_MAX_AGE_SECONDS);
  await requireRateLimit(env, auth.userId, "guardian_dependent_lifecycle");
  return success(await requestGuardianDependentLifecycle(createIdentityServerClient(env), {
    actorUserId: auth.userId,
    actorAal: "aal2",
    clientRequestId: uuidValue(body.clientRequestId),
    dependentHandle: publicHandleValue(body.dependentHandle),
    action,
    noticeVersion: requiredString(body.noticeVersion, 1, 120),
    userNote: optionalString(body.userNote, 2_000) ?? ""
  }), 202);
};

const guardianDependentLifecycleStatus: IdentityHandler = async (request, env) => {
  requireGet(request);
  assertUnder13WorkerFeature(env, "IDENTITY_UNDER13_DEPENDENT_CONTROLS_ENABLED", false);
  const url = new URL(request.url);
  if ([...url.searchParams.keys()].some((key) => !["handle", "limit"].includes(key))
      || url.searchParams.getAll("handle").length !== 1
      || url.searchParams.getAll("limit").length > 1) throw new IdentityHttpError(400, "request_invalid");
  const limitText = url.searchParams.get("limit");
  if (limitText !== null && !/^\d{1,3}$/.test(limitText)) throw new IdentityHttpError(400, "request_invalid");
  const auth = await authenticateIdentityRequest(request, env);
  requireAal2(auth);
  await requireRateLimit(env, auth.userId, "guardian_dependent_lifecycle_read");
  return success(await loadGuardianDependentLifecycle(createIdentityServerClient(env), {
    actorUserId: auth.userId,
    actorAal: "aal2",
    dependentHandle: publicHandleValue(url.searchParams.get("handle")),
    limit: limitText === null ? 25 : boundedInteger(Number(limitText), 1, 100)
  }));
};

async function providerCallback(
  request: Request,
  env: IdentityEnv,
  purpose: "age" | "guardian"
): Promise<Response> {
  assertIdentityEnabled(env);
  if (request.method !== "POST") throw new IdentityHttpError(405, "method_not_allowed");
  await requireRateLimit(env, remoteIp(request) ?? "network-unavailable", `provider_callback_${purpose}`);
  const bodyText = await readBoundedText(request, 65_536);
  const provider: AgeAssuranceProvider | GuardianConsentProvider = purpose === "age"
    ? ageAssuranceProvider(env)
    : guardianConsentProvider(env);
  const result = normalizedCallbackResult(await provider.verifyCallback({
    url: request.url,
    headers: callbackHeaders(request),
    body: new TextEncoder().encode(bodyText)
  }), purpose);
  const externalReferenceSha256 = await sha256Text(result.externalReference);
  const stateNonceSha256 = await sha256Text(result.stateNonce);
  const resultEventSha256 = await sha256Text(result.eventId);
  const serverClient = createIdentityServerClient(env);
  const transaction = objectValue(await loadCommunityProviderTransaction(serverClient, {
    provider: provider.name,
    externalReferenceSha256,
    stateNonceSha256
  }));
  const transactionPurpose = requiredString(transaction.purpose, 3, 40);
  if (
    transaction.provider !== provider.name
    || (purpose === "age" ? transactionPurpose !== "age_assurance" : transactionPurpose === "age_assurance")
  ) throw new IdentityHttpError(409, "provider_transaction_unavailable");
  await consumeCommunityProviderTransaction(serverClient, {
    clientRequestId: uuidFromSha256(resultEventSha256),
    provider: provider.name,
    externalReferenceSha256,
    stateNonceSha256,
    resultEventSha256,
    resultStatus: result.resultStatus,
    evidenceCode: result.evidenceCode,
    ageBand: result.ageBand,
    assuranceStatus: result.assuranceStatus,
    assuranceExpiresAt: result.assuranceExpiresAt,
    jurisdictionCode: result.jurisdictionCode,
    privateReason: "Verified provider callback was normalized and atomically consumed."
  });
  return success({ accepted: true }, 202);
}

const ageProviderCallback: IdentityHandler = (request, env) => providerCallback(request, env, "age");
const guardianProviderCallback: IdentityHandler = (request, env) => providerCallback(request, env, "guardian");

const guardianSponsoredAccountProviderCallback: IdentityHandler = async (request, env) => {
  // A provider result for an already-created sponsorship must remain
  // consumable during a participation pause. The separately operated
  // sponsorship flag still provides an emergency callback kill switch.
  assertUnder13WorkerFeature(env, "IDENTITY_UNDER13_SPONSORED_ACCOUNTS_ENABLED", false);
  if (request.method !== "POST") throw new IdentityHttpError(405, "method_not_allowed");
  await requireRateLimit(env, remoteIp(request) ?? "network-unavailable", "provider_callback_guardian_sponsorship");
  const bodyText = await readBoundedText(request, 65_536);
  const provider = guardianConsentProvider(env);
  const result = normalizedCallbackResult(await provider.verifyCallback({
    url: request.url,
    headers: callbackHeaders(request),
    body: new TextEncoder().encode(bodyText)
  }), "guardian");
  const externalReferenceSha256 = await sha256Text(result.externalReference);
  const stateNonceSha256 = await sha256Text(result.stateNonce);
  const resultSha256 = await sha256Text(
    `guardian-sponsored-account-result-v1:${result.eventId}:${result.resultStatus}:${result.evidenceCode}`
  );
  const consumed = upstreamRecord(await consumeGuardianSponsoredAccountProviderResult(
    createIdentityServerClient(env),
    {
      clientRequestId: uuidFromSha256(resultSha256),
      provider: provider.name,
      externalReferenceSha256,
      stateNonceSha256,
      resultSha256,
      resultStatus: result.resultStatus,
      privateReason: "Reviewed guardian provider callback was verified and atomically consumed."
    }
  ), ["sponsorshipId", "status", "authorityExpiresAt"]);
  upstreamUuid(consumed.sponsorshipId);
  if (consumed.status !== result.resultStatus) throw new IdentityHttpError(502, "identity_database_response_invalid");
  upstreamTimestamp(consumed.authorityExpiresAt);
  return success({ accepted: true }, 202);
};

const restrictionImpose: IdentityHandler = async (request, env) => {
  const { auth, body } = await authenticatedMutation(request, env);
  requireFreshAal2(auth, DESTRUCTIVE_MFA_MAX_AGE_SECONDS);
  exactKeys(body, ["clientRequestId", "targetHandle", "scope", "restriction", "reasonCode", "privateReason", "expiresAt"]);
  await requireRateLimit(env, auth.userId, "restriction");
  return success(await imposeRestriction(createIdentityServerClient(env), {
    actorUserId: auth.userId,
    actorAal: auth.aal,
    targetHandle: publicHandleValue(body.targetHandle),
    clientRequestId: uuidValue(body.clientRequestId),
    scope: enumValue(body.scope, [
      "all_public_communities",
      "commons_profile_publication",
      "commune_posting",
      "commune_commenting",
      "marketplace_publishing",
      "job_posting",
      "artisan_membership",
      "artisan_posting",
      "artisan_commenting",
      "artisan_appreciation",
      "artisan_uploading",
      "artisan_challenges",
      "artisan_notifications"
    ] as const),
    restriction: enumValue(body.restriction, ["read_only", "no_comments", "no_uploads", "no_challenges", "suspended", "banned"] as const),
    reasonCode: requiredString(body.reasonCode, 2, 64),
    privateReason: requiredString(body.privateReason, 8, 2_000),
    expiresAt: optionalString(body.expiresAt, 40)
  }));
};

const legalDocumentRegister: IdentityHandler = async (request, env) => {
  const { auth, body } = await authenticatedMutation(request, env);
  requireFreshAal2(auth, STAFF_MFA_MAX_AGE_SECONDS);
  exactKeys(body, ["clientRequestId", "documentKey", "documentVersion", "publicPath", "contentSha256", "activate", "privateReason"]);
  await requireRateLimit(env, auth.userId, "legal-document");
  const documentKey = requiredString(body.documentKey, 3, 101);
  const publicPath = requiredString(body.publicPath, 1, 500);
  const contentSha256 = requiredString(body.contentSha256, 64, 64).toLowerCase();
  if (!/^[a-z][a-z0-9_]{2,100}$/.test(documentKey)
      || !/^\/[A-Za-z0-9/_?&=.%:-]*$/.test(publicPath)
      || !/^[0-9a-f]{64}$/.test(contentSha256)) {
    throw new IdentityHttpError(400, "request_invalid");
  }
  const activate = booleanValue(body.activate);
  if (activate) requireFreshAal2(auth, DESTRUCTIVE_MFA_MAX_AGE_SECONDS);
  return success(await registerCommunityLegalDocumentVersion(createIdentityServerClient(env), {
    actorUserId: auth.userId,
    actorAal: auth.aal,
    clientRequestId: uuidValue(body.clientRequestId),
    documentKey,
    documentVersion: requiredString(body.documentVersion, 1, 120),
    publicPath,
    contentSha256,
    activate,
    privateReason: requiredString(body.privateReason, 8, 1_000)
  }));
};

const restrictionLift: IdentityHandler = async (request, env) => {
  const { auth, body } = await authenticatedMutation(request, env);
  requireFreshAal2(auth, DESTRUCTIVE_MFA_MAX_AGE_SECONDS);
  exactKeys(body, ["clientRequestId", "restrictionId", "privateReason"]);
  await requireRateLimit(env, auth.userId, "restriction");
  return success(await liftRestriction(createIdentityServerClient(env), {
    actorUserId: auth.userId,
    actorAal: auth.aal,
    restrictionId: uuidValue(body.restrictionId),
    clientRequestId: uuidValue(body.clientRequestId),
    privateReason: requiredString(body.privateReason, 8, 2_000)
  }));
};

const ROUTES: Readonly<Record<string, IdentityHandler>> = Object.freeze({
  "/v1/health": health,
  "/v1/public-profile": publicProfile,
  "/v1/bootstrap": bootstrap,
  "/v1/profile/publication": profilePublication,
  "/v1/legal/accept": legalAccept,
  "/v1/lifecycle/request": lifecycleRequest,
  "/v1/lifecycle/requests": lifecycleRequests,
  "/v1/staff/lifecycle/claim": lifecycleWorkClaim,
  "/v1/staff/lifecycle/item": lifecycleWorkItem,
  "/v1/staff/lifecycle/transition": lifecycleWorkTransition,
  "/v1/staff/lifecycle/exports/build": lifecycleExportBuild,
  "/v1/staff/lifecycle/storage/inventory": lifecycleStorageInventory,
  "/v1/staff/lifecycle/storage/cleanup": lifecycleStorageCleanup,
  "/v1/staff/lifecycle/auth/delete": lifecycleAuthDelete,
  "/v1/notifications": notificationPreferences,
  "/v1/age-assurance/start": ageStart,
  "/v1/guardian-relationship/start": guardianRelationshipStart,
  "/v1/guardian-consent/start": guardianConsentStart,
  "/v1/guardian-sponsored-account/start": guardianSponsoredAccountStart,
  "/v1/guardian-sponsored-account/claim": guardianSponsoredAccountClaim,
  "/v1/guardian/content-approvals": guardianContentApprovalQueue,
  "/v1/guardian/content-approvals/request": guardianContentApprovalRequest,
  "/v1/guardian/content-approvals/decide": guardianContentApprovalDecide,
  "/v1/guardian/dependents/status": guardianDependentStatus,
  "/v1/guardian/dependents/profile": guardianDependentProfile,
  "/v1/guardian/dependents/lifecycle": guardianDependentLifecycleRequest,
  "/v1/guardian/dependents/lifecycle/status": guardianDependentLifecycleStatus,
  "/v1/providers/age-assurance/callback": ageProviderCallback,
  "/v1/providers/guardian/callback": guardianProviderCallback,
  "/v1/providers/guardian-sponsored-account/callback": guardianSponsoredAccountProviderCallback,
  "/v1/guardian/relationships/revoke": guardianRelationshipRevoke,
  "/v1/guardian/consents/revoke": guardianConsentRevoke,
  "/v1/staff/legal/documents/register": legalDocumentRegister,
  "/v1/staff/restrictions/impose": restrictionImpose,
  "/v1/staff/restrictions/lift": restrictionLift
});

function normalizePath(pathname: string): string {
  return pathname.startsWith("/api/identity/") ? pathname.slice("/api/identity".length) : pathname;
}

export async function handleIdentityRequest(request: Request, env: IdentityEnv): Promise<Response> {
  const correlationId = requestId(request);
  const pathname = normalizePath(new URL(request.url).pathname);
  const route = pathname.startsWith("/v1/public-profile-avatars/")
    ? publicProfileAvatar
    : pathname.startsWith("/v1/public-profile-banners/")
      ? publicProfileBanner
      : /^\/v1\/lifecycle\/requests\/[0-9a-f-]{36}\/cancel$/i.test(pathname)
        ? lifecycleRequestCancel
        : /^\/v1\/lifecycle\/requests\/[0-9a-f-]{36}$/i.test(pathname)
          ? lifecycleRequestDetail
          : /^\/v1\/account\/exports\/[0-9a-f-]{36}$/i.test(pathname)
            ? accountExportDownload
            : ROUTES[pathname];
  if (!route) return jsonResponse({ ok: false, error: "identity_route_not_found" }, 404);
  try {
    const response = await route(request, env);
    console.info(JSON.stringify({ event: "identity.request", outcome: "succeeded", route: pathname, correlationId }));
    response.headers.set("x-request-id", correlationId);
    return response;
  } catch (error) {
    console.info(JSON.stringify({
      event: "identity.request",
      outcome: error instanceof IdentityHttpError && error.status < 500 ? "rejected" : "failed",
      route: pathname,
      correlationId
    }));
    const response = safeIdentityErrorResponse(error);
    response.headers.set("x-request-id", correlationId);
    return response;
  }
}

export default {
  async fetch(request: Request, env: IdentityEnv): Promise<Response> {
    return await handleIdentityRequest(request, env);
  },
  async scheduled(_controller: ScheduledController, env: IdentityEnv): Promise<void> {
    await handleIdentityScheduledMaintenance(env);
  }
} satisfies ExportedHandler<IdentityEnv>;
