import { IdentityHttpError } from "./http.ts";
import type { IdentityEnv, IdentityFeatureState } from "./types.ts";

const PLACEHOLDER = /(replace|placeholder|changeme|enter[_ -]?directly)/i;
// A provider becomes "supported" only in the same reviewed change that adds
// its concrete request and webhook-verification adapter. A non-empty setting
// alone must never make readiness checks claim that a vendor is operational.
const SUPPORTED_AGE_PROVIDERS = new Set<string>();
const SUPPORTED_GUARDIAN_PROVIDERS = new Set<string>();

function supportedProvider(value: string | undefined, supported: ReadonlySet<string>): boolean {
  return Boolean(value && value !== "disabled" && supported.has(value));
}

export function nonPlaceholder(value: string | undefined, minimum: number, maximum: number): string {
  if (!value || value.length < minimum || value.length > maximum || /[\r\n]/.test(value) || PLACEHOLDER.test(value)) {
    throw new IdentityHttpError(503, "identity_misconfigured");
  }
  return value;
}

export function assertIdentityEnabled(env: IdentityEnv): void {
  if (env.IDENTITY_ENABLED !== "true") throw new IdentityHttpError(503, "identity_disabled");
}

export function assertAbuseControls(env: IdentityEnv): void {
  if (env.IDENTITY_EDGE_RATE_LIMIT_CONFIRMED !== "true") {
    throw new IdentityHttpError(503, "edge_rate_limit_required");
  }
}

export function identityFeatureState(env: IdentityEnv): IdentityFeatureState {
  const ageProvider = supportedProvider(env.AGE_ASSURANCE_PROVIDER, SUPPORTED_AGE_PROVIDERS);
  const guardianProvider = supportedProvider(env.GUARDIAN_CONSENT_PROVIDER, SUPPORTED_GUARDIAN_PROVIDERS);
  return Object.freeze({
    adultBeta: env.IDENTITY_ADULT_BETA_ENABLED === "true",
    teen: env.IDENTITY_TEEN_ENABLED === "true",
    under13: env.IDENTITY_UNDER_13_ENABLED === "true",
    ageProvider,
    guardianProvider,
    turnstile: env.TURNSTILE_REQUIRED === "true"
  });
}

export function assertYouthFlagsSafe(env: IdentityEnv): void {
  const features = identityFeatureState(env);
  if (features.adultBeta && (env.IDENTITY_EDGE_RATE_LIMIT_CONFIRMED !== "true" || env.TURNSTILE_REQUIRED !== "true")) {
    throw new IdentityHttpError(503, "adult_beta_safety_controls_required");
  }
  if (env.IDENTITY_UNDER_13_ENABLED === "true" && env.IDENTITY_TEEN_ENABLED !== "true") {
    throw new IdentityHttpError(503, "under13_requires_teen_foundation");
  }
  if ((features.teen || features.under13) && !features.ageProvider) {
    throw new IdentityHttpError(503, "age_provider_required");
  }
  if ((features.teen || features.under13) && !features.guardianProvider) {
    throw new IdentityHttpError(503, "guardian_provider_required");
  }
  if ((features.teen || features.under13) && env.IDENTITY_EDGE_RATE_LIMIT_CONFIRMED !== "true") {
    throw new IdentityHttpError(503, "edge_rate_limit_required");
  }
  if ((features.teen || features.under13) && env.TURNSTILE_REQUIRED !== "true") {
    throw new IdentityHttpError(503, "turnstile_required");
  }
}
