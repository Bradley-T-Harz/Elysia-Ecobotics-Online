import { IdentityHttpError } from "./http.ts";

export type JsonRecord = Record<string, unknown>;

export function objectValue(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new IdentityHttpError(400, "request_invalid");
  return value as JsonRecord;
}

export function exactKeys(value: JsonRecord, allowed: readonly string[]): void {
  const allow = new Set(allowed);
  if (Object.keys(value).some((key) => !allow.has(key))) throw new IdentityHttpError(400, "request_invalid");
}

export function requiredString(value: unknown, minimum = 1, maximum = 2_048): string {
  if (typeof value !== "string" || value.length < minimum || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
    throw new IdentityHttpError(400, "request_invalid");
  }
  return value;
}

export function optionalString(value: unknown, maximum = 2_048): string | null {
  if (value === null || value === undefined || value === "") return null;
  return requiredString(value, 1, maximum);
}

export function nullableTimeValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const result = requiredString(value, 5, 8);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(result)) {
    throw new IdentityHttpError(400, "request_invalid");
  }
  return result;
}

export function booleanValue(value: unknown): boolean {
  if (typeof value !== "boolean") throw new IdentityHttpError(400, "request_invalid");
  return value;
}

export function uuidValue(value: unknown): string {
  const result = requiredString(value, 36, 36).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(result)) {
    throw new IdentityHttpError(400, "request_invalid");
  }
  return result;
}

export function publicHandleValue(value: unknown): string {
  if (typeof value !== "string" || value.length < 2 || value.length > 81
      || /[\u0000-\u001f]/.test(value)) {
    throw new IdentityHttpError(400, "handle_invalid");
  }
  const raw = value.toLowerCase();
  const handle = raw.startsWith("@") ? raw.slice(1) : raw;
  if (handle.length < 2 || handle.length > 80
      || !/^[a-z0-9](?:[a-z0-9._-]{0,78}[a-z0-9])?$/.test(handle)) {
    throw new IdentityHttpError(400, "handle_invalid");
  }
  return handle;
}

export function enumValue<const T extends readonly string[]>(value: unknown, allowed: T): T[number] {
  const result = requiredString(value, 1, 64);
  if (!allowed.includes(result)) throw new IdentityHttpError(400, "request_invalid");
  return result as T[number];
}

export function stringArray(value: unknown, allowed: readonly string[], maximum = 12): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximum) throw new IdentityHttpError(400, "request_invalid");
  const output = value.map((item) => enumValue(item, allowed));
  if (new Set(output).size !== output.length) throw new IdentityHttpError(400, "request_invalid");
  return output;
}

export function httpsReturnUrl(value: unknown, allowedOrigins: ReadonlySet<string>): string {
  const raw = requiredString(value, 12, 2_048);
  let url: URL;
  try { url = new URL(raw); }
  catch { throw new IdentityHttpError(400, "return_url_invalid"); }
  if (!allowedOrigins.has(url.origin) || url.username || url.password || url.hash) {
    throw new IdentityHttpError(400, "return_url_invalid");
  }
  return url.toString();
}

export function acceptancesValue(value: unknown): Record<string, { version: string; contentHash: string }> {
  const record = objectValue(value);
  const entries = Object.entries(record);
  if (entries.length < 1 || entries.length > 16) throw new IdentityHttpError(400, "request_invalid");
  const output: Record<string, { version: string; contentHash: string }> = {};
  for (const [document, acceptanceValue] of entries) {
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(document)) throw new IdentityHttpError(400, "request_invalid");
    const acceptance = objectValue(acceptanceValue);
    exactKeys(acceptance, ["version", "contentHash"]);
    const version = requiredString(acceptance.version, 1, 64);
    const contentHash = requiredString(acceptance.contentHash, 64, 64).toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(contentHash)) throw new IdentityHttpError(400, "request_invalid");
    output[document] = { version, contentHash };
  }
  return output;
}
