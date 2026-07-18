import { IdentityHttpError } from "./http.ts";
import type { AgeAssuranceProvider, GuardianConsentProvider, IdentityEnv } from "./types.ts";

/**
 * Vendor selection is a legal and procurement decision. The interface is
 * complete, but production remains fail-closed until an explicitly reviewed
 * provider adapter is added and configured. No identity document is accepted
 * by this Worker and no raw provider payload is persisted in Supabase.
 */
class DisabledAgeProvider implements AgeAssuranceProvider {
  readonly name = "disabled";
  readonly redirectOrigins = Object.freeze([]);
  async start(): Promise<never> {
    throw new IdentityHttpError(503, "age_provider_disabled");
  }
  async verifyCallback(): Promise<never> {
    throw new IdentityHttpError(503, "age_provider_disabled");
  }
}

class DisabledGuardianProvider implements GuardianConsentProvider {
  readonly name = "disabled";
  readonly redirectOrigins = Object.freeze([]);
  async start(): Promise<never> {
    throw new IdentityHttpError(503, "guardian_provider_disabled");
  }
  async verifyCallback(): Promise<never> {
    throw new IdentityHttpError(503, "guardian_provider_disabled");
  }
}

export function ageAssuranceProvider(env: IdentityEnv): AgeAssuranceProvider {
  if (!env.AGE_ASSURANCE_PROVIDER || env.AGE_ASSURANCE_PROVIDER === "disabled") return new DisabledAgeProvider();
  throw new IdentityHttpError(503, "age_provider_not_supported");
}

export function guardianConsentProvider(env: IdentityEnv): GuardianConsentProvider {
  if (!env.GUARDIAN_CONSENT_PROVIDER || env.GUARDIAN_CONSENT_PROVIDER === "disabled") return new DisabledGuardianProvider();
  throw new IdentityHttpError(503, "guardian_provider_not_supported");
}
