import type { SupabaseClient, User } from "@supabase/supabase-js";

// Wrangler intentionally emits literal types for example config values such as
// `"false"`. Runtime environments and tests override those values, so widen
// only generated string bindings while preserving concrete binding types.
type RuntimeIdentityBindings = {
  [Key in keyof IdentityBindings]?: IdentityBindings[Key] extends string
    ? string
    : IdentityBindings[Key];
};

export interface IdentityEnv extends RuntimeIdentityBindings {
  IDENTITY_ACCOUNT_EXPORT_ENABLED?: string;
  IDENTITY_ACCOUNT_EXPORT_PROVIDER?: string;
  IDENTITY_ACCOUNT_EXPORT_TTL_DAYS?: string;
  IDENTITY_STORAGE_CLEANUP_ENABLED?: string;
  IDENTITY_STORAGE_CLEANUP_PROVIDER?: string;
  IDENTITY_AUTH_DELETION_ENABLED?: string;
  IDENTITY_AUTH_DELETION_PROVIDER?: string;
  IDENTITY_NOTIFICATION_DELIVERY_ENABLED?: string;
  IDENTITY_NOTIFICATION_DELIVERY_PROVIDER?: string;
  IDENTITY_NOTIFICATION_SENDER_EMAIL?: string;
  IDENTITY_NOTIFICATION_SENDER_NAME?: string;
  IDENTITY_NOTIFICATION_PUBLIC_ORIGIN?: string;
  IDENTITY_ACCOUNT_NOTIFICATION_DELIVERY_ENABLED?: string;
  IDENTITY_ACCOUNT_NOTIFICATION_DELIVERY_PROVIDER?: string;
  IDENTITY_ACCOUNT_NOTIFICATION_SENDER_NAME?: string;
  IDENTITY_ACCOUNT_NOTIFICATION_PUBLIC_ORIGIN?: string;
  IDENTITY_EXPORT_RETENTION_ENABLED?: string;
  IDENTITY_EXPORT_RETENTION_PROVIDER?: string;
  GUARDIAN_SPONSORSHIP_CONTACT_HMAC_KEY?: string;
  IDENTITY_UNDER13_SPONSORED_ACCOUNTS_ENABLED?: string;
  IDENTITY_UNDER13_CONTENT_APPROVAL_ENABLED?: string;
  IDENTITY_UNDER13_DEPENDENT_CONTROLS_ENABLED?: string;
}

export type AuthenticatedIdentityRequest = {
  accessToken: string;
  user: User;
  userId: string;
  aal: "aal1" | "aal2";
  mfaVerifiedAt: number | null;
  supabase: SupabaseClient;
};

export type IdentityFeatureState = Readonly<{
  adultBeta: boolean;
  teen: boolean;
  under13: boolean;
  ageProvider: boolean;
  guardianProvider: boolean;
  turnstile: boolean;
}>;

export type TurnstileRequest = {
  token: string;
  action: string;
  idempotencyKey: string;
  remoteIp?: string;
};

export type ProviderStartResult = {
  provider: string;
  externalReference: string;
  stateNonce: string;
  redirectUrl: string;
  expiresAt: string;
};

export type ProviderCallbackEnvelope = Readonly<{
  url: string;
  headers: Readonly<Record<string, string>>;
  body: Uint8Array;
}>;

export type ProviderCallbackResult = Readonly<{
  externalReference: string;
  stateNonce: string;
  eventId: string;
  resultStatus: "verified" | "failed";
  evidenceCode: string;
  ageBand: "unknown" | "under_13" | "13_to_15" | "16_to_17" | "18_plus" | null;
  assuranceStatus: "age_estimated" | "age_verified" | "guardian_verified" | null;
  assuranceExpiresAt: string | null;
  jurisdictionCode: string | null;
}>;

export interface AgeAssuranceProvider {
  readonly name: string;
  /** Exact reviewed HTTPS origins to which this adapter may redirect a user. */
  readonly redirectOrigins: readonly string[];
  start(input: {
    userId: string;
    returnUrl: string;
    clientRequestId: string;
  }): Promise<ProviderStartResult>;
  verifyCallback(input: ProviderCallbackEnvelope): Promise<ProviderCallbackResult>;
}

export type GuardianProviderStartInput =
  | Readonly<{
      purpose: "guardian_relationship";
      guardianUserId: string;
      dependentHandle: string;
      relationshipType: "parent" | "legal_guardian" | "court_authorized_guardian";
      authorityExpiresAt: string;
      returnUrl: string;
      clientRequestId: string;
    }>
  | Readonly<{
      purpose: "guardian_consent";
      guardianUserId: string;
      dependentUserId: string;
      relationshipId: string;
      consentScope: string;
      documentKey: string;
      documentVersion: string;
      contentSha256: string;
      authorityExpiresAt: string;
      returnUrl: string;
      clientRequestId: string;
    }>
  | Readonly<{
      purpose: "guardian_sponsored_account";
      guardianUserId: string;
      dependentContact: string;
      relationshipType: "parent" | "legal_guardian" | "court_authorized_guardian";
      authorityExpiresAt: string;
      returnUrl: string;
      clientRequestId: string;
    }>;

export interface GuardianConsentProvider {
  readonly name: string;
  /** Exact reviewed HTTPS origins to which this adapter may redirect a user. */
  readonly redirectOrigins: readonly string[];
  start(input: GuardianProviderStartInput): Promise<ProviderStartResult>;
  verifyCallback(input: ProviderCallbackEnvelope): Promise<ProviderCallbackResult>;
}
