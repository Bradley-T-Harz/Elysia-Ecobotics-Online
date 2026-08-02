import { IdentityHttpError } from "./http.ts";
import type { IdentityEnv } from "./types.ts";

export type LifecycleExecutionProvider = Readonly<{
  name: "reviewed-manual-evidence-v1";
  executesStorageDeletion: false;
  executesAuthDeletion: false;
  evidenceRequiredForEveryPhase: true;
}>;

const REVIEWED_MANUAL_EVIDENCE_PROVIDER: LifecycleExecutionProvider = Object.freeze({
  name: "reviewed-manual-evidence-v1",
  executesStorageDeletion: false,
  executesAuthDeletion: false,
  evidenceRequiredForEveryPhase: true
});

export type AccountExportProvider = Readonly<{
  name: "private-r2-json-v1";
  format: "elysia-community-account-export-v2";
  privateAuthenticatedDownloadOnly: true;
  encryptionAtRest: "r2-managed-aes-256-gcm";
  maximumTtlDays: 30;
}>;

export type StorageCleanupProvider = Readonly<{
  name: "scoped-private-object-cleanup-v1";
  receivesPrivateElysiaData: false;
  receivesArtisanEvidence: false;
  returnsOnlyCountAndEvidenceHash: true;
}>;

export type AuthDeletionProvider = Readonly<{
  name: "supabase-auth-soft-delete-v1";
  softDeleteRequired: true;
  providerReceiptRequired: true;
  irreversible: true;
}>;

export type NotificationDeliveryProvider = Readonly<{
  name: "database-in-app-v1" | "cloudflare-email-service-v1";
  sendsExternalEmail: boolean;
}>;

export type AccountNotificationDeliveryProvider = Readonly<{
  name: "cloudflare-email-service-v1";
  sendsExternalEmail: true;
  source: "online-account-delivery-outbox";
}>;

export type ExportRetentionProvider = Readonly<{
  name: "private-export-expiry-v1";
  respectsDatabaseLegalHolds: true;
  receivesArtisanEvidence: false;
  receivesArtisanMedia: false;
}>;

const ACCOUNT_EXPORT_PROVIDER: AccountExportProvider = Object.freeze({
  name: "private-r2-json-v1",
  format: "elysia-community-account-export-v2",
  privateAuthenticatedDownloadOnly: true,
  encryptionAtRest: "r2-managed-aes-256-gcm",
  maximumTtlDays: 30
});

const STORAGE_CLEANUP_PROVIDER: StorageCleanupProvider = Object.freeze({
  name: "scoped-private-object-cleanup-v1",
  receivesPrivateElysiaData: false,
  receivesArtisanEvidence: false,
  returnsOnlyCountAndEvidenceHash: true
});

const AUTH_DELETION_PROVIDER: AuthDeletionProvider = Object.freeze({
  name: "supabase-auth-soft-delete-v1",
  softDeleteRequired: true,
  providerReceiptRequired: true,
  irreversible: true
});

const NOTIFICATION_DELIVERY_PROVIDER: NotificationDeliveryProvider = Object.freeze({
  name: "database-in-app-v1",
  sendsExternalEmail: false
});

const CLOUDFLARE_EMAIL_NOTIFICATION_PROVIDER: NotificationDeliveryProvider = Object.freeze({
  name: "cloudflare-email-service-v1",
  sendsExternalEmail: true
});

const ACCOUNT_NOTIFICATION_DELIVERY_PROVIDER: AccountNotificationDeliveryProvider = Object.freeze({
  name: "cloudflare-email-service-v1",
  sendsExternalEmail: true,
  source: "online-account-delivery-outbox"
});

const EXPORT_RETENTION_PROVIDER: ExportRetentionProvider = Object.freeze({
  name: "private-export-expiry-v1",
  respectsDatabaseLegalHolds: true,
  receivesArtisanEvidence: false,
  receivesArtisanMedia: false
});

function requireProvider(
  enabled: string | undefined,
  configuredProvider: string | undefined,
  expectedProvider: string,
  disabledCode: string
): void {
  if (enabled !== "true" || configuredProvider !== expectedProvider) {
    throw new IdentityHttpError(503, disabledCode);
  }
}

export function assertLifecycleOperatorEnabled(env: IdentityEnv): void {
  if (env.IDENTITY_LIFECYCLE_OPERATOR_ENABLED !== "true") {
    throw new IdentityHttpError(503, "lifecycle_operator_disabled");
  }
}

export function lifecycleExecutionProvider(env: IdentityEnv): LifecycleExecutionProvider {
  if (
    env.IDENTITY_LIFECYCLE_EXECUTION_ENABLED !== "true"
    || env.IDENTITY_LIFECYCLE_EXECUTION_PROVIDER !== REVIEWED_MANUAL_EVIDENCE_PROVIDER.name
  ) throw new IdentityHttpError(503, "lifecycle_execution_disabled");
  return REVIEWED_MANUAL_EVIDENCE_PROVIDER;
}

export function accountExportProvider(env: IdentityEnv): AccountExportProvider {
  requireProvider(
    env.IDENTITY_ACCOUNT_EXPORT_ENABLED,
    env.IDENTITY_ACCOUNT_EXPORT_PROVIDER,
    ACCOUNT_EXPORT_PROVIDER.name,
    "account_export_disabled"
  );
  return ACCOUNT_EXPORT_PROVIDER;
}

export function accountExportTtlDays(env: IdentityEnv): number {
  const value = env.IDENTITY_ACCOUNT_EXPORT_TTL_DAYS;
  if (!value || !/^\d{1,2}$/.test(value)) throw new IdentityHttpError(503, "account_export_misconfigured");
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > ACCOUNT_EXPORT_PROVIDER.maximumTtlDays) {
    throw new IdentityHttpError(503, "account_export_misconfigured");
  }
  return days;
}

export function storageCleanupProvider(env: IdentityEnv): StorageCleanupProvider {
  requireProvider(
    env.IDENTITY_STORAGE_CLEANUP_ENABLED,
    env.IDENTITY_STORAGE_CLEANUP_PROVIDER,
    STORAGE_CLEANUP_PROVIDER.name,
    "storage_cleanup_disabled"
  );
  return STORAGE_CLEANUP_PROVIDER;
}

export function authDeletionProvider(env: IdentityEnv): AuthDeletionProvider {
  requireProvider(
    env.IDENTITY_AUTH_DELETION_ENABLED,
    env.IDENTITY_AUTH_DELETION_PROVIDER,
    AUTH_DELETION_PROVIDER.name,
    "auth_deletion_disabled"
  );
  return AUTH_DELETION_PROVIDER;
}

export function notificationDeliveryProvider(env: IdentityEnv): NotificationDeliveryProvider {
  if (env.IDENTITY_NOTIFICATION_DELIVERY_ENABLED !== "true") {
    throw new IdentityHttpError(503, "notification_delivery_disabled");
  }
  if (env.IDENTITY_NOTIFICATION_DELIVERY_PROVIDER === NOTIFICATION_DELIVERY_PROVIDER.name) {
    return NOTIFICATION_DELIVERY_PROVIDER;
  }
  if (env.IDENTITY_NOTIFICATION_DELIVERY_PROVIDER === CLOUDFLARE_EMAIL_NOTIFICATION_PROVIDER.name) {
    return CLOUDFLARE_EMAIL_NOTIFICATION_PROVIDER;
  }
  throw new IdentityHttpError(503, "notification_delivery_disabled");
}

export function accountNotificationDeliveryProvider(env: IdentityEnv): AccountNotificationDeliveryProvider {
  requireProvider(
    env.IDENTITY_ACCOUNT_NOTIFICATION_DELIVERY_ENABLED,
    env.IDENTITY_ACCOUNT_NOTIFICATION_DELIVERY_PROVIDER,
    ACCOUNT_NOTIFICATION_DELIVERY_PROVIDER.name,
    "account_notification_delivery_disabled"
  );
  return ACCOUNT_NOTIFICATION_DELIVERY_PROVIDER;
}

export function exportRetentionProvider(env: IdentityEnv): ExportRetentionProvider {
  requireProvider(
    env.IDENTITY_EXPORT_RETENTION_ENABLED,
    env.IDENTITY_EXPORT_RETENTION_PROVIDER,
    EXPORT_RETENTION_PROVIDER.name,
    "export_retention_disabled"
  );
  return EXPORT_RETENTION_PROVIDER;
}

export function transitionRequiresExecutionEvidence(status: string): boolean {
  return [
    "storage_cleanup",
    "auth_deletion_ready",
    "auth_deletion_confirmed",
    "completed"
  ].includes(status);
}
