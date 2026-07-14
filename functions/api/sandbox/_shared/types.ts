import type { SupabaseClient } from "@supabase/supabase-js";

export interface Env {
  SANDBOX_ENABLED: string;
  SANDBOX_DEPLOYMENT_ENV: string;
  SANDBOX_PUBLIC_ORIGIN: string;
  SANDBOX_SERVICE_URL: string;
  SANDBOX_SERVICE_TOKEN: string;
  SANDBOX_DB_FINALIZER_TOKEN: string;
  CLOUDFLARE_ACCESS_CLIENT_ID: string;
  CLOUDFLARE_ACCESS_CLIENT_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
}

export const SOURCE_TYPES = [
  "commune_post_snippet",
  "commune_code_document",
  "commune_code_version",
  "commune_code_revision_proposal",
  "repository_showcase_artifact",
  "iteration_showcase_artifact",
  "manual_snapshot"
] as const;

export type SandboxSourceType = (typeof SOURCE_TYPES)[number];

export const SANDBOX_LANGUAGES = [
  "python",
  "javascript",
  "typescript",
  "json",
  "yaml",
  "markdown",
  "html",
  "css"
] as const;

export type SandboxLanguage = (typeof SANDBOX_LANGUAGES)[number];

export type SandboxRunRequest = {
  clientRequestId: string;
  snapshotId: string;
  sourceType: SandboxSourceType;
  sourceId: string | null;
  language: SandboxLanguage;
  fileName: string | null;
  code: string;
};

export type SandboxDiagnostic = {
  severity: "info" | "warning" | "error";
  phase: "static" | "policy" | "runtime" | "sandbox" | "security";
  category: string;
  language: string;
  file: string | null;
  line: number | null;
  column: number | null;
  message: string;
  source: string;
};

export type SandboxFinalStatus =
  | "completed"
  | "failed"
  | "denied"
  | "policy_blocked"
  | "sandbox_unavailable";

export type PublicSandboxResult = {
  ok: boolean;
  runId: string;
  status: SandboxFinalStatus;
  language: string;
  file: string | null;
  snapshotId: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number | null;
  outputTruncated: boolean;
  diagnostics: SandboxDiagnostic[];
  message: string;
  recordingStatus: "recorded" | "failed";
  idempotentReplay: boolean;
};

export type AuthenticatedRequest = {
  accessToken: string;
  userId: string;
  accessTier: "member" | "reviewer" | "admin";
  supabase: SupabaseClient;
};

export type AuthorizedSource = {
  sourceType: SandboxSourceType;
  sourceId: string | null;
  snapshotId: string;
  language: SandboxLanguage;
  fileName: string | null;
  code: string;
  postId: string | null;
  codeDocumentId: string | null;
  codeVersionId: string | null;
};

export type Reservation = {
  accepted: boolean;
  idempotentReplay: boolean;
  runId: string | null;
  status: string | null;
  leaseExpiresAt: string | null;
  reason: string | null;
  retryAfter: number | null;
  result: Omit<PublicSandboxResult, "recordingStatus" | "idempotentReplay" | "runId"> | null;
};

export type RunnerResult = Omit<PublicSandboxResult, "recordingStatus" | "idempotentReplay" | "runId">;
