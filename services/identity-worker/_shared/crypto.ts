import { IdentityHttpError } from "./http.ts";

function digestHex(digest: ArrayBuffer): string {
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Bytes(value: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = value instanceof Uint8Array ? value.slice().buffer as ArrayBuffer : value;
  return digestHex(await crypto.subtle.digest("SHA-256", bytes));
}

export async function sha256Text(value: string): Promise<string> {
  if (value.length < 8 || value.length > 2_048 || /[\u0000-\u001f]/.test(value)) {
    throw new IdentityHttpError(502, "provider_response_invalid");
  }
  return await sha256Bytes(new TextEncoder().encode(value));
}

export async function hmacSha256Text(secret: string | undefined, value: string): Promise<string> {
  if (
    typeof secret !== "string" || secret.length < 32 || secret.length > 512
    || /[\u0000-\u001f]/.test(secret) || value.length < 3 || value.length > 512
    || /[\u0000-\u001f]/.test(value)
  ) throw new IdentityHttpError(503, "guardian_sponsorship_hmac_unavailable");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return digestHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}
