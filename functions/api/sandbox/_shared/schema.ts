import { PublicHttpError } from "./http.ts";
import { SANDBOX_LANGUAGES, SOURCE_TYPES, type SandboxLanguage, type SandboxRunRequest, type SandboxSourceType } from "./types.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_KEYS = new Set(["clientRequestId", "snapshotId", "sourceType", "sourceId", "language", "fileName", "code"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown, maximum: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > maximum) throw new PublicHttpError(400, "request_schema_invalid");
  return value;
}

export function parseSandboxRunRequest(value: unknown): SandboxRunRequest {
  if (!isRecord(value) || Object.keys(value).some((key) => !ALLOWED_KEYS.has(key))) {
    throw new PublicHttpError(400, "request_schema_invalid");
  }

  if (typeof value.clientRequestId !== "string" || !UUID_PATTERN.test(value.clientRequestId)) {
    throw new PublicHttpError(400, "client_request_id_invalid");
  }
  if (typeof value.snapshotId !== "string" || value.snapshotId.length < 1 || value.snapshotId.length > 160) {
    throw new PublicHttpError(400, "snapshot_id_invalid");
  }
  if (value.snapshotId.trim() !== value.snapshotId || /[\u0000-\u001f\u007f]/.test(value.snapshotId)) {
    throw new PublicHttpError(400, "snapshot_id_invalid");
  }
  if (typeof value.sourceType !== "string" || !SOURCE_TYPES.includes(value.sourceType as SandboxSourceType)) {
    throw new PublicHttpError(400, "source_type_invalid");
  }
  const sourceType = value.sourceType as SandboxSourceType;
  const sourceId = nullableString(value.sourceId, 64);
  if (sourceType !== "manual_snapshot" && (!sourceId || !UUID_PATTERN.test(sourceId))) {
    throw new PublicHttpError(400, "source_id_invalid");
  }
  if (sourceType === "manual_snapshot" && sourceId !== null) {
    throw new PublicHttpError(400, "source_id_invalid");
  }
  if (typeof value.language !== "string" || !SANDBOX_LANGUAGES.includes(value.language as SandboxLanguage)) {
    throw new PublicHttpError(400, "language_invalid");
  }
  if (typeof value.code !== "string" || value.code.length === 0) {
    throw new PublicHttpError(400, "code_required");
  }
  if (value.code.includes("\u0000")) throw new PublicHttpError(400, "code_invalid");

  const codeBytes = new TextEncoder().encode(value.code).byteLength;
  if (codeBytes > 65_536) throw new PublicHttpError(413, "code_too_large");

  const fileName = nullableString(value.fileName, 160);
  if (fileName && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(fileName)) {
    throw new PublicHttpError(400, "file_name_invalid");
  }

  return {
    clientRequestId: value.clientRequestId.toLowerCase(),
    snapshotId: value.snapshotId,
    sourceType,
    sourceId,
    language: value.language as SandboxLanguage,
    fileName,
    code: value.code
  };
}

export async function parseSandboxRequestBody(request: Request): Promise<SandboxRunRequest> {
  const { readBoundedText } = await import("./http.ts");
  const text = await readBoundedText(request, 400_000);
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw new PublicHttpError(400, "json_invalid");
  }
  return parseSandboxRunRequest(value);
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
