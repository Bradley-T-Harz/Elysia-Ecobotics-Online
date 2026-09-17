export type AccessConfig = { accessRequired: boolean; accessTeamDomain: string; accessAudience: string };
export type AccessVerificationReason = "access_config_invalid" | "access_assertion_missing" | "access_assertion_malformed" | "access_claims_invalid" | "access_jwks_unavailable" | "access_jwks_invalid" | "access_kid_not_found" | "access_signature_invalid" | "access_verified";
export function cloudflareAccessVerificationReason(assertion: string | null, config: AccessConfig, options?: { fetcher?: typeof fetch; now?: number }): Promise<AccessVerificationReason>;
export function verifyCloudflareAccessAssertion(assertion: string | null, config: AccessConfig, options?: { fetcher?: typeof fetch; now?: number }): Promise<boolean>;
export function clearAccessJwksCacheForTests(): void;
