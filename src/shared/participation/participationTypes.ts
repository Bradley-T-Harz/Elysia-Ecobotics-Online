export type ParticipationState =
  | "read_only"
  | "adult_eligible"
  | "teen_pending"
  | "teen_eligible"
  | "under13_pending"
  | "under13_eligible"
  | "restricted"
  | "suspended"
  | "blocked"
  | "deletion_pending"
  | "deactivated";

export type AgeBand = "unknown" | "under_13" | "13_to_15" | "16_to_17" | "18_plus";

export type AssuranceStatus =
  | "not_collected"
  | "self_attested"
  | "age_estimated"
  | "age_verified"
  | "guardian_verified"
  | "verification_expired"
  | "restricted"
  | "blocked";

export type CommunityAccess = Readonly<{
  userId: string;
  participationState: ParticipationState;
  ageBand: AgeBand;
  assuranceStatus: AssuranceStatus;
  assuranceExpiresAt: string | null;
  jurisdictionCode: string | null;
  publicProfileEnabled: boolean;
  profileComplete: boolean;
  canJoinArtisan: boolean;
  canPostArtisan: boolean;
  canCommentArtisan: boolean;
  canUploadImage: boolean;
  canSubmitChallenge: boolean;
  evaluatedAt: string;
}>;

export type PublicProfileCard = Readonly<{
  userId: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  shortPublicBio: string | null;
  canonicalProfileUrl: string;
  publicProfileEnabled: boolean;
  updatedAt: string;
}>;

export type MessagingPublicProfileSearchItem = Readonly<{
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  shortPublicBio: string | null;
}>;

export type MessagingPublicProfileSearchResult = Readonly<{
  items: readonly MessagingPublicProfileSearchItem[];
  minimumQueryLength: 3;
  resultLimit: 8;
}>;

export type AccountMessagingLaunchMode = "disabled" | "controlled_beta" | "general_availability";

export type AccountMessagingAdminTarget = Readonly<{
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  shortPublicBio: string | null;
  published: boolean;
  betaEnrolled: boolean;
  status: "enabled" | "eligible_for_enrollment" | "restricted_or_unavailable" | "unpublished";
}>;

export type AccountMessagingAdminStatus = Readonly<{
  authorized: true;
  launchMode: AccountMessagingLaunchMode;
  generalAvailabilityReady: boolean;
  target: AccountMessagingAdminTarget | null;
}>;

export type AccountMessagingEnrollmentResult = Readonly<{
  handle: string;
  betaEnrolled: boolean;
  launchMode: AccountMessagingLaunchMode;
}>;

export type ArtisanMembership = Readonly<{
  status: string;
  joinedAt: string;
  defaultCreditLine: string | null;
  defaultCreationMethod: string | null;
  defaultLicenseCode: string | null;
}>;

export type CommunityNotificationPreferences = Readonly<{
  inAppEnabled: boolean;
  emailEnabled: boolean;
  mentionsEnabled: boolean;
  commentsEnabled: boolean;
  challengeUpdatesEnabled: boolean;
  moderationUpdatesEnabled: boolean;
  guardianUpdatesEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  updatedAt: string;
}>;

export type GuardianConsentSummary = Readonly<{
  consentId: string;
  scope: string;
  documentKey: string;
  documentVersion: string;
  status: string;
  expiresAt: string;
}>;

export type GuardianRelationshipSummary = Readonly<{
  relationshipId: string;
  callerRole: "guardian" | "dependent";
  relationshipType: string;
  status: string;
  expiresAt: string | null;
  consents: readonly GuardianConsentSummary[];
}>;

export type GuardianSummary = Readonly<{
  relationships: readonly GuardianRelationshipSummary[];
}>;

export type CommunityLegalDocument = Readonly<{
  documentKey: string;
  version: string;
  contentSha256: string;
  scope: string;
  title: string;
  publicPath: string;
  effectiveAt: string;
}>;

export type CommunityLegalManifest = Readonly<{
  documents: readonly CommunityLegalDocument[];
  missingAcceptances: readonly string[];
  requiredDocumentsReady: boolean;
  complete: boolean;
}>;

export type AccountActivation = Readonly<{
  state: "active" | "temporarily_deactivated";
  temporarilyDeactivatedAt: string | null;
  reactivatedAt: string | null;
  updatedAt: string;
}>;

export type IdentityBootstrap = Readonly<{
  accountActivation?: AccountActivation;
  communityAccess: CommunityAccess;
  membership: ArtisanMembership | null;
  profileCard: PublicProfileCard | null;
  guardianSummary: GuardianSummary;
  legalManifest: CommunityLegalManifest;
  notificationPreferences: CommunityNotificationPreferences;
  featureFlags: Readonly<Record<string, boolean>>;
}>;

export type ParticipationAction =
  | "joinArtisan"
  | "postArtisan"
  | "commentArtisan"
  | "uploadImage"
  | "submitChallenge";

export type ParticipationLoadState = "unconfigured" | "signed_out" | "loading" | "ready" | "error";

export type LifecycleAction = "export" | "deletion";

export type LifecycleRequestResult = Readonly<{
  requestId: string;
  action: "data_export" | "account_deletion" | string;
  status: string;
  submittedAt: string;
  coolingPeriodEndsAt: string | null;
}>;

export type LifecycleStatus =
  | "submitted"
  | "identity_verification"
  | "cooling_period"
  | "operator_review"
  | "processing"
  | "storage_inventory"
  | "storage_cleanup"
  | "auth_deletion_ready"
  | "auth_deletion_confirmed"
  | "blocked_by_legal_hold"
  | "completed"
  | "rejected"
  | "canceled";

export type LifecycleRequestSummary = Readonly<{
  requestId: string;
  action: "data_export" | "account_deletion" | "account_deactivation" | "account_reactivation";
  status: LifecycleStatus;
  noticeVersion: string;
  userNote: string | null;
  submittedAt: string;
  updatedAt: string;
  coolingPeriodEndsAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  legalHoldPresent: boolean;
  exportExpiresAt: string | null;
  canCancel: boolean;
}>;

export type LifecycleExportArtifact = Readonly<{
  artifactId: string;
  artifactStatus: "available" | "expired" | "deleted";
  byteSize: number;
  mimeType: "application/json";
  encryptionAtRest: "r2-managed-aes-256-gcm";
  artifactSha256: string;
  expiresAt: string;
  downloadPath: string | null;
}>;

export type LifecycleRequestDetail = Readonly<Omit<LifecycleRequestSummary, "exportExpiresAt"> & {
  export: LifecycleExportArtifact | null;
}>;

export type VerifiedLifecycleExportDownload = Readonly<{
  blob: Blob;
  filename: string;
  sha256: string;
}>;

export type PublicProfilePublicationInput = Readonly<{
  clientRequestId: string;
  enabled: boolean;
  shortPublicBio: string | null;
}>;

export type LegalDocumentAcceptance = Readonly<{
  version: string;
  contentHash: string;
}>;
