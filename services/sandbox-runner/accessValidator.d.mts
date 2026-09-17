export type AccessConfig = { accessRequired: boolean; accessTeamDomain: string; accessAudience: string };
export function verifyCloudflareAccessAssertion(assertion: string | null, config: AccessConfig, options?: { fetcher?: typeof fetch; now?: number }): Promise<boolean>;
export function clearAccessJwksCacheForTests(): void;
