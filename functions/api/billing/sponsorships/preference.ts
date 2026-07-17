import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertTestOnlyBillingMode } from "../_shared/config.ts";
import { setCurrentUserSponsorshipRecognitionPreference } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { sponsorshipRecognitionPreferenceRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, SponsorshipRecognitionPreferenceRequest } from "../_shared/types.ts";

export type SponsorshipRecognitionPreferenceDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: SponsorshipRecognitionPreferenceRequest): ReturnType<typeof setCurrentUserSponsorshipRecognitionPreference>;
};
const defaultDependencies: SponsorshipRecognitionPreferenceDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actor, input) => setCurrentUserSponsorshipRecognitionPreference(createEconomicServerClient(env), actor, input)
};
export async function handleSponsorshipRecognitionPreference(request: Request, env: BillingEnv, dependencies: SponsorshipRecognitionPreferenceDependencies = defaultDependencies): Promise<Response> {
  try {
    assertTestOnlyBillingMode(env);
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await sponsorshipRecognitionPreferenceRequest(request);
    // This records the signer's private preference. Public display remains
    // independently gated by environment, database feature, and ethical review.
    return jsonResponse({ ok: true, recognition: await dependencies.mutate(env, auth.userId, input) });
  } catch (error) { return safeBillingErrorResponse(error); }
}
export const onRequest: PagesFunction<BillingEnv> = (context) => handleSponsorshipRecognitionPreference(context.request, context.env);
