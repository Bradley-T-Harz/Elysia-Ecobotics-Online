import {
  parseSandboxPublicErrorCode,
  sandboxRunErrorMessage,
  type SandboxPublicErrorCode
} from "./sandboxEligibilityClient";

export type SandboxRunPublicErrorCode = SandboxPublicErrorCode | "sandbox_language_unsupported";

export function parseSandboxRunPublicErrorCode(value: unknown): SandboxRunPublicErrorCode | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const error = (value as Record<string, unknown>).error;
    if (error === "language_invalid" || error === "sandbox_language_unsupported") {
      return "sandbox_language_unsupported";
    }
  }
  return parseSandboxPublicErrorCode(value);
}

export function sandboxRunPublicErrorMessage(code: SandboxRunPublicErrorCode): string {
  if (code === "sandbox_language_unsupported") {
    return "Sandbox execution is unavailable because this snapshot language is not supported for execution.";
  }
  return sandboxRunErrorMessage(code);
}
