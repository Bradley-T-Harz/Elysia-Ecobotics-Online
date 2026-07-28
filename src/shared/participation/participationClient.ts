import { z } from "zod";
import type {
  IdentityBootstrap,
  LegalDocumentAcceptance,
  LifecycleAction,
  LifecycleExportArtifact,
  LifecycleRequestDetail,
  LifecycleRequestResult,
  LifecycleRequestSummary,
  PublicProfileCard,
  PublicProfilePublicationInput,
  VerifiedLifecycleExportDownload,
} from "./participationTypes";

// Zod's default object-schema optimizer probes Function("") before using its
// generated parser. Keep the shared Identity decoder in Zod's supported
// interpreter-only mode so strict CSP never needs or attempts unsafe-eval.
z.config({ jitless: true });

const IDENTITY_API_ROOT = "/api/identity/v1";
const MAX_IDENTITY_RESPONSE_BYTES = 256 * 1024;
const PUBLIC_AVATAR_PATH = /^\/api\/public\/profile-avatars\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CANONICAL_PROFILE_URL = /^https:\/\/elysiaecobotics\.com\/commons-circle\/@[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?$/;

const participationStateSchema = z.enum([
  "read_only",
  "adult_eligible",
  "teen_pending",
  "teen_eligible",
  "under13_pending",
  "under13_eligible",
  "restricted",
  "suspended",
  "blocked",
  "deletion_pending",
  "deactivated",
]);

const ageBandSchema = z.enum(["unknown", "under_13", "13_to_15", "16_to_17", "18_plus"]);
const assuranceStatusSchema = z.enum([
  "not_collected",
  "self_attested",
  "age_estimated",
  "age_verified",
  "guardian_verified",
  "verification_expired",
  "restricted",
  "blocked",
]);

const communityAccessSchema = z.object({
  userId: z.uuid(),
  participationState: participationStateSchema,
  ageBand: ageBandSchema,
  assuranceStatus: assuranceStatusSchema,
  assuranceExpiresAt: z.iso.datetime({ offset: true }).nullable(),
  jurisdictionCode: z.string().max(16).nullable(),
  publicProfileEnabled: z.boolean(),
  profileComplete: z.boolean(),
  canJoinArtisan: z.boolean(),
  canPostArtisan: z.boolean(),
  canCommentArtisan: z.boolean(),
  canUploadImage: z.boolean(),
  canSubmitChallenge: z.boolean(),
  evaluatedAt: z.iso.datetime({ offset: true }),
}).strict();

const publicProfileCardSchema = z.object({
  userId: z.uuid(),
  handle: z.string().min(2).max(80),
  displayName: z.string().max(120).nullable(),
  avatarUrl: z.string().regex(PUBLIC_AVATAR_PATH).nullable(),
  shortPublicBio: z.string().max(280).nullable(),
  canonicalProfileUrl: z.url().refine((value) => CANONICAL_PROFILE_URL.test(value)),
  publicProfileEnabled: z.boolean(),
  updatedAt: z.iso.datetime({ offset: true }),
}).strict();

const membershipSchema = z.object({
  status: z.string().min(1).max(64),
  joinedAt: z.iso.datetime({ offset: true }),
  defaultCreditLine: z.string().max(240).nullable(),
  defaultCreationMethod: z.string().max(64).nullable(),
  defaultLicenseCode: z.string().max(64).nullable(),
}).strict();

const notificationPreferencesSchema = z.object({
  inAppEnabled: z.boolean(),
  emailEnabled: z.boolean(),
  mentionsEnabled: z.boolean(),
  commentsEnabled: z.boolean(),
  challengeUpdatesEnabled: z.boolean(),
  moderationUpdatesEnabled: z.boolean(),
  guardianUpdatesEnabled: z.boolean(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}:\d{2}(?:\.\d+)?$/).nullable(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}:\d{2}(?:\.\d+)?$/).nullable(),
  updatedAt: z.iso.datetime({ offset: true }),
}).strict();

const guardianConsentSummarySchema = z.object({
  consentId: z.uuid(),
  scope: z.string().min(1).max(64),
  documentKey: z.string().min(2).max(100),
  documentVersion: z.string().min(1).max(120),
  status: z.string().min(1).max(32),
  expiresAt: z.iso.datetime({ offset: true }),
}).strict();

const guardianRelationshipSummarySchema = z.object({
  relationshipId: z.uuid(),
  callerRole: z.enum(["guardian", "dependent"]),
  relationshipType: z.string().min(1).max(64),
  status: z.string().min(1).max(32),
  expiresAt: z.iso.datetime({ offset: true }).nullable(),
  consents: z.array(guardianConsentSummarySchema).max(32),
}).strict();

const guardianSummarySchema = z.object({
  relationships: z.array(guardianRelationshipSummarySchema).max(32),
}).strict();

const legalDocumentSchema = z.object({
  documentKey: z.string().regex(/^[a-z][a-z0-9_]{1,99}$/),
  version: z.string().min(1).max(120),
  contentSha256: z.string().regex(/^[0-9a-f]{64}$/),
  scope: z.string().min(1).max(64),
  title: z.string().min(1).max(160),
  publicPath: z.string().regex(/^\/[A-Za-z0-9/_?&=.%:-]*$/).max(2_048),
  effectiveAt: z.iso.datetime({ offset: true }),
}).strict();

const legalManifestSchema = z.object({
  documents: z.array(legalDocumentSchema).max(32),
  missingAcceptances: z.array(z.string().regex(/^[a-z][a-z0-9_]{1,99}$/)).max(32),
  requiredDocumentsReady: z.boolean(),
  complete: z.boolean(),
}).strict();

const bootstrapSchema = z.object({
  communityAccess: communityAccessSchema,
  membership: membershipSchema.nullable(),
  profileCard: publicProfileCardSchema.nullable(),
  guardianSummary: guardianSummarySchema,
  legalManifest: legalManifestSchema,
  notificationPreferences: notificationPreferencesSchema,
  featureFlags: z.record(z.string(), z.boolean()),
}).strict();

const lifecycleResultSchema = z.object({
  requestId: z.uuid(),
  action: z.string().min(1).max(64),
  status: z.string().min(1).max(64),
  submittedAt: z.iso.datetime({ offset: true }),
  coolingPeriodEndsAt: z.iso.datetime({ offset: true }).nullable(),
}).strict();

const lifecycleActionSchema = z.enum([
  "data_export",
  "account_deletion",
  "account_deactivation",
  "account_reactivation",
]);

const lifecycleStatusSchema = z.enum([
  "submitted",
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
  "canceled",
]);

const lifecycleSummarySchema = z.object({
  requestId: z.uuid(),
  action: lifecycleActionSchema,
  status: lifecycleStatusSchema,
  noticeVersion: z.string().min(1).max(120),
  userNote: z.string().max(2_000).nullable(),
  submittedAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  coolingPeriodEndsAt: z.iso.datetime({ offset: true }).nullable(),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
  canceledAt: z.iso.datetime({ offset: true }).nullable(),
  legalHoldPresent: z.boolean(),
  exportExpiresAt: z.iso.datetime({ offset: true }).nullable(),
  canCancel: z.boolean(),
}).strict();

const lifecycleArtifactSchema = z.object({
  artifactId: z.uuid(),
  artifactStatus: z.enum(["available", "expired", "deleted"]),
  byteSize: z.number().int().min(1).max(104_857_600),
  mimeType: z.literal("application/json"),
  encryptionAtRest: z.literal("r2-managed-aes-256-gcm"),
  artifactSha256: z.string().regex(/^[0-9a-f]{64}$/),
  expiresAt: z.iso.datetime({ offset: true }),
  downloadPath: z.string().regex(/^\/api\/identity\/v1\/account\/exports\/[0-9a-f-]{36}$/).nullable(),
}).strict().superRefine((artifact, context) => {
  if (artifact.downloadPath !== null && !artifact.downloadPath.endsWith(`/${artifact.artifactId}`)) {
    context.addIssue({ code: "custom", message: "The export path did not match its artifact." });
  }
});

const absentLifecycleArtifactSchema = z.object({
  artifactId: z.null(),
  artifactStatus: z.null(),
  byteSize: z.null(),
  mimeType: z.null(),
  encryptionAtRest: z.null(),
  artifactSha256: z.null(),
  expiresAt: z.null(),
  downloadPath: z.null(),
}).strict().transform(() => null);

const lifecycleArtifactWireSchema = z.union([
  z.null(),
  lifecycleArtifactSchema,
  absentLifecycleArtifactSchema,
]);

const lifecycleDetailSchema = lifecycleSummarySchema.omit({ exportExpiresAt: true }).extend({
  export: lifecycleArtifactWireSchema,
}).strict();

const lifecycleListSchema = z.object({
  items: z.array(lifecycleSummarySchema).max(50),
  nextBefore: z.iso.datetime({ offset: true }).nullable(),
}).strict();

const lifecycleCancelSchema = z.object({
  requestId: z.uuid(),
  status: z.literal("canceled"),
  canceledAt: z.iso.datetime({ offset: true }),
}).strict();

const profilePublicationResultSchema = publicProfileCardSchema.omit({ userId: true }).extend({
  handle: z.string().min(2).max(80),
}).strict();

const successEnvelopeSchema = z.object({ ok: z.literal(true), data: z.unknown() }).strict();
const errorEnvelopeSchema = z.object({ ok: z.literal(false), error: z.string().min(1).max(128) }).strict();

export class IdentityApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.name = "IdentityApiError";
    this.code = code;
    this.status = status;
  }
}

function identityHeaders(accessToken: string, includeJson: boolean): Headers {
  const headers = new Headers({
    accept: "application/json",
    authorization: `Bearer ${accessToken}`,
  });
  if (includeJson) headers.set("content-type", "application/json");
  return headers;
}

async function parseIdentityResponse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const text = await response.text();
  if (text.length > MAX_IDENTITY_RESPONSE_BYTES) throw new IdentityApiError("identity_response_too_large", 502);

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new IdentityApiError("identity_response_invalid", 502);
  }

  if (!response.ok) {
    const parsedError = errorEnvelopeSchema.safeParse(payload);
    throw new IdentityApiError(parsedError.success ? parsedError.data.error : "identity_request_failed", response.status);
  }

  const envelope = successEnvelopeSchema.safeParse(payload);
  if (!envelope.success) throw new IdentityApiError("identity_response_invalid", 502);
  const parsedData = schema.safeParse(envelope.data.data);
  if (!parsedData.success) throw new IdentityApiError("identity_response_invalid", 502);
  return parsedData.data;
}

async function identityRequest<T>(
  accessToken: string,
  path: string,
  schema: z.ZodType<T>,
  options: { method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  if (!accessToken) throw new IdentityApiError("identity_session_required", 401);
  const method = options.method ?? "GET";
  const response = await fetch(`${IDENTITY_API_ROOT}${path}`, {
    method,
    headers: identityHeaders(accessToken, method === "POST"),
    body: method === "POST" ? JSON.stringify(options.body ?? {}) : undefined,
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    signal: options.signal,
  });
  return parseIdentityResponse(response, schema);
}

export function createIdentityClientRequestId(): string {
  return crypto.randomUUID();
}

export function loadIdentityBootstrap(accessToken: string, signal?: AbortSignal): Promise<IdentityBootstrap> {
  return identityRequest(accessToken, "/bootstrap", bootstrapSchema, { signal });
}

export function updatePublicProfilePublication(
  accessToken: string,
  input: PublicProfilePublicationInput,
  signal?: AbortSignal,
): Promise<Omit<PublicProfileCard, "userId">> {
  return identityRequest(accessToken, "/profile/publication", profilePublicationResultSchema, {
    method: "POST",
    body: input,
    signal,
  });
}

export function acceptCommunityLegalDocuments(
  accessToken: string,
  clientRequestId: string,
  acceptances: Readonly<Record<string, LegalDocumentAcceptance>>,
  signal?: AbortSignal,
): Promise<unknown> {
  return identityRequest(accessToken, "/legal/accept", z.unknown(), {
    method: "POST",
    body: { clientRequestId, acceptances },
    signal,
  });
}

export function requestCommunityLifecycleAction(
  accessToken: string,
  input: {
    clientRequestId: string;
    action: LifecycleAction;
    noticeVersion: string;
    userNote: string | null;
    turnstileToken: string;
  },
  signal?: AbortSignal,
): Promise<LifecycleRequestResult> {
  return identityRequest(accessToken, "/lifecycle/request", lifecycleResultSchema, {
    method: "POST",
    body: input,
    signal,
  });
}

export function loadCommunityLifecycleRequests(
  accessToken: string,
  signal?: AbortSignal,
  limit = 20,
  before?: string,
): Promise<{ items: LifecycleRequestSummary[]; nextBefore: string | null }> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new IdentityApiError("request_invalid", 400);
  }
  const query = new URLSearchParams({ limit: String(limit) });
  if (before) query.set("before", before);
  return identityRequest(accessToken, `/lifecycle/requests?${query.toString()}`, lifecycleListSchema, { signal });
}

export function loadCommunityLifecycleRequest(
  accessToken: string,
  requestId: string,
  signal?: AbortSignal,
): Promise<LifecycleRequestDetail> {
  if (!z.uuid().safeParse(requestId).success) throw new IdentityApiError("request_invalid", 400);
  return identityRequest(accessToken, `/lifecycle/requests/${encodeURIComponent(requestId)}`, lifecycleDetailSchema, { signal });
}

export async function cancelCommunityDeletionRequest(
  accessToken: string,
  requestId: string,
  signal?: AbortSignal,
): Promise<{ requestId: string; status: "canceled"; canceledAt: string }> {
  if (!z.uuid().safeParse(requestId).success) throw new IdentityApiError("request_invalid", 400);
  const result = await identityRequest(accessToken, `/lifecycle/requests/${encodeURIComponent(requestId)}/cancel`, lifecycleCancelSchema, {
    method: "POST",
    body: { clientRequestId: createIdentityClientRequestId() },
    signal,
  });
  if (result.requestId !== requestId) throw new IdentityApiError("identity_response_invalid", 502);
  return result;
}

function bytesToHex(value: ArrayBuffer): string {
  return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function downloadCommunityLifecycleExport(
  accessToken: string,
  artifact: LifecycleExportArtifact,
  signal?: AbortSignal,
): Promise<VerifiedLifecycleExportDownload> {
  const expectedPath = `/api/identity/v1/account/exports/${artifact.artifactId}`;
  if (artifact.downloadPath !== expectedPath || artifact.artifactStatus !== "available") {
    throw new IdentityApiError("account_export_not_available", 409);
  }
  const response = await fetch(expectedPath, {
    method: "GET",
    headers: identityHeaders(accessToken, false),
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    signal,
  });
  if (!response.ok) {
    await parseIdentityResponse(response, z.never());
    throw new IdentityApiError("identity_request_failed", response.status);
  }
  const expectedFilename = `elysia-community-export-${artifact.artifactId}.json`;
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const disposition = response.headers.get("content-disposition");
  const declaredLength = response.headers.get("content-length");
  const responseSha256 = response.headers.get("x-content-sha256")?.toLowerCase();
  const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
  if (
    contentType !== "application/json"
    || disposition !== `attachment; filename="${expectedFilename}"`
    || !declaredLength
    || !/^\d{1,9}$/.test(declaredLength)
    || Number(declaredLength) !== artifact.byteSize
    || responseSha256 !== artifact.artifactSha256
    || !cacheControl.split(",").some((directive) => directive.trim() === "no-store")
  ) throw new IdentityApiError("account_export_integrity_failed", 502);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== artifact.byteSize) throw new IdentityApiError("account_export_integrity_failed", 502);
  const computedSha256 = bytesToHex(await crypto.subtle.digest("SHA-256", bytes));
  if (computedSha256 !== artifact.artifactSha256) throw new IdentityApiError("account_export_integrity_failed", 502);
  return {
    blob: new Blob([bytes], { type: "application/json" }),
    filename: expectedFilename,
    sha256: computedSha256,
  };
}

const FRIENDLY_IDENTITY_ERRORS: Readonly<Record<string, string>> = Object.freeze({
  identity_session_required: "Your session is no longer available. Sign in again before continuing.",
  identity_not_configured: "Shared account services are not configured in this environment.",
  identity_disabled: "Shared account changes are currently paused.",
  identity_request_failed: "The shared account service could not complete this request.",
  identity_response_invalid: "The shared account service returned an unexpected response and the action was stopped safely.",
  identity_database_failed: "The shared account service is temporarily unavailable.",
  permission_denied: "Your account is not permitted to perform this action.",
  state_conflict: "This request conflicts with an existing account action. Refresh the account state before trying again.",
  turnstile_required: "Complete the human-verification check before continuing.",
  turnstile_failed: "The human-verification check was not accepted. Please try it again.",
  rate_limited: "Too many requests were attempted. Wait before trying again.",
});

export function friendlyIdentityError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "The request was cancelled.";
  if (error instanceof IdentityApiError) {
    return FRIENDLY_IDENTITY_ERRORS[error.code] ?? "The shared account service could not complete this request safely.";
  }
  return "The shared account service could not be reached. No account change was made.";
}
