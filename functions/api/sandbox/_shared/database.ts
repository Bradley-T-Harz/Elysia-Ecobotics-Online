import type { SupabaseClient } from "@supabase/supabase-js";
import { PublicHttpError } from "./http.ts";
import type { AuthorizedSource, Reservation, RunnerResult, SandboxRunRequest } from "./types.ts";

function objectOrNull(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function reserveRun(
  supabase: SupabaseClient,
  request: SandboxRunRequest,
  source: AuthorizedSource
): Promise<Reservation> {
  const codeSha256 = await sha256Hex(source.code);
  const codeBytes = new TextEncoder().encode(source.code).byteLength;
  const { data, error } = await supabase.rpc("reserve_commune_sandbox_run", {
    p_client_request_id: request.clientRequestId,
    p_snapshot_id: source.snapshotId,
    p_source_type: source.sourceType,
    p_source_id: source.sourceId,
    p_post_id: source.postId,
    p_code_document_id: source.codeDocumentId,
    p_code_version_id: source.codeVersionId,
    p_language: source.language,
    p_file_name: source.fileName,
    p_code_sha256: codeSha256,
    p_code_bytes: codeBytes
  });
  if (error) throw new PublicHttpError(409, "reservation_failed");
  const record = objectOrNull(data);
  if (!record) throw new PublicHttpError(503, "reservation_unavailable");
  const existingResult = objectOrNull(record.result);
  return {
    accepted: record.accepted === true,
    idempotentReplay: record.idempotentReplay === true,
    runId: stringOrNull(record.runId),
    status: stringOrNull(record.status),
    leaseExpiresAt: stringOrNull(record.leaseExpiresAt),
    reason: stringOrNull(record.reason),
    retryAfter: numberOrNull(record.retryAfter),
    result: existingResult as Reservation["result"]
  };
}

export async function startRun(supabase: SupabaseClient, runId: string, clientRequestId: string, finalizerToken: string): Promise<void> {
  const { error } = await supabase.rpc("start_commune_sandbox_run", {
    p_run_id: runId,
    p_client_request_id: clientRequestId,
    p_finalizer_token: finalizerToken
  });
  if (error) throw new PublicHttpError(503, "reservation_start_failed");
}

export async function finalizeRun(
  supabase: SupabaseClient,
  runId: string,
  clientRequestId: string,
  finalizerToken: string,
  result: RunnerResult
): Promise<boolean> {
  const { error } = await supabase.rpc("finalize_commune_sandbox_run", {
    p_run_id: runId,
    p_client_request_id: clientRequestId,
    p_finalizer_token: finalizerToken,
    p_status: result.status,
    p_ok: result.ok,
    p_message: result.message,
    p_stdout_preview: result.stdout,
    p_stderr_preview: result.stderr,
    p_exit_code: result.exitCode,
    p_duration_ms: result.durationMs,
    p_output_truncated: result.outputTruncated,
    p_diagnostics: result.diagnostics
  });
  return !error;
}
