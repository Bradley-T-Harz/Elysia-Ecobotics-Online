export const SANDBOX_PROFILE_SETUP_PATH = "/commons-circle/setup/profile";

export const SANDBOX_PUBLIC_ERROR_CODES = [
  "authentication_required",
  "authentication_invalid",
  "profile_required",
  "account_inactive",
  "sandbox_not_authorized",
  "source_unauthorized",
  "origin_denied",
  "sandbox_disabled",
  "sandbox_service_unavailable",
  "runner_unavailable",
  "internal_failure"
] as const;

export type SandboxPublicErrorCode = (typeof SANDBOX_PUBLIC_ERROR_CODES)[number];
export type SandboxEligibilityStateCode = "checking" | "available" | SandboxPublicErrorCode;

export type SandboxEligibility = {
  state: SandboxEligibilityStateCode;
  available: boolean;
  title: string;
  message: string;
};

const ERROR_CODE_SET = new Set<string>(SANDBOX_PUBLIC_ERROR_CODES);
const MAX_ELIGIBILITY_RESPONSE_BYTES = 8_192;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function parseSandboxPublicErrorCode(value: unknown): SandboxPublicErrorCode | null {
  const code = record(value)?.error;
  return typeof code === "string" && ERROR_CODE_SET.has(code) ? code as SandboxPublicErrorCode : null;
}

export function sandboxEligibilityFromCode(state: SandboxEligibilityStateCode): SandboxEligibility {
  switch (state) {
    case "checking":
      return { state, available: false, title: "Checking sandbox eligibility", message: "Confirming your account and the governed sandbox service with the server." };
    case "available":
      return { state, available: true, title: "Sandbox available", message: "Your signed-in account is eligible and the governed sandbox service is available." };
    case "authentication_required":
      return { state, available: false, title: "Sign-in required", message: "Sign in before requesting governed sandbox execution." };
    case "authentication_invalid":
      return { state, available: false, title: "Sign-in needs refreshing", message: "Your current sign-in could not be verified. Sign in again, then refresh sandbox eligibility." };
    case "profile_required":
      return {
        state,
        available: false,
        title: "Commons Profile required",
        message: "Create or finish your Commons Profile before using the governed coding sandbox. This keeps sandbox activity tied to an accountable public-community identity."
      };
    case "account_inactive":
      return { state, available: false, title: "Account unavailable", message: "This account is not currently eligible for sandbox execution." };
    case "source_unauthorized":
      return { state, available: false, title: "Source not authorized", message: "This code source is not authorized for sandbox execution." };
    case "origin_denied":
      return { state, available: false, title: "Request origin denied", message: "The sandbox request did not come through the required same-origin path." };
    case "sandbox_disabled":
      return { state, available: false, title: "Sandbox temporarily disabled", message: "The governed sandbox is deliberately paused right now." };
    case "runner_unavailable":
      return { state, available: false, title: "Runner unavailable", message: "Your account is eligible, but the isolated execution service is temporarily unavailable." };
    case "sandbox_service_unavailable":
      return { state, available: false, title: "Sandbox service unavailable", message: "The governed sandbox authorization service is temporarily unavailable." };
    case "sandbox_not_authorized":
      return { state, available: false, title: "Sandbox access unavailable", message: "This signed-in account is not authorized for sandbox execution." };
    case "internal_failure":
      return { state, available: false, title: "Sandbox request failed", message: "The sandbox request failed internally without creating execution access." };
  }
}

export function initialSandboxEligibility(signedIn: boolean, accessToken: string | null): SandboxEligibility {
  return signedIn && accessToken
    ? sandboxEligibilityFromCode("checking")
    : sandboxEligibilityFromCode("authentication_required");
}

async function boundedJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length") || "0");
  if (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > MAX_ELIGIBILITY_RESPONSE_BYTES) return null;
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_ELIGIBILITY_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return null; }
  try { return JSON.parse(text) as unknown; }
  catch { return null; }
}

export async function requestSandboxEligibility(
  accessToken: string | null,
  fetcher: typeof fetch = fetch
): Promise<SandboxEligibility> {
  if (!accessToken) return sandboxEligibilityFromCode("authentication_required");
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetcher("/api/sandbox/health", {
      method: "GET",
      headers: { accept: "application/json", authorization: `Bearer ${accessToken}` },
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal
    });
    const payload = await boundedJson(response);
    const body = record(payload);
    if (response.ok && body?.ok === true && body.status === "available") {
      return sandboxEligibilityFromCode("available");
    }
    const error = parseSandboxPublicErrorCode(payload);
    if (error) return sandboxEligibilityFromCode(error);
    if (response.status === 401) return sandboxEligibilityFromCode("authentication_invalid");
    if (response.status === 403) return sandboxEligibilityFromCode("sandbox_not_authorized");
    return sandboxEligibilityFromCode(response.status >= 500 ? "sandbox_service_unavailable" : "sandbox_not_authorized");
  } catch {
    return sandboxEligibilityFromCode("sandbox_service_unavailable");
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export function sandboxEligibilityCanBeRefreshed(eligibility: SandboxEligibility): boolean {
  return eligibility.state !== "checking";
}

export function sandboxRunErrorMessage(code: SandboxPublicErrorCode): string {
  return sandboxEligibilityFromCode(code).message;
}
