import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertBillingMode } from "../_shared/config.ts";
import { setOperatorSponsorshipPublicRecognition } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { operatorSponsorshipRecognitionRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, OperatorSponsorshipRecognitionRequest } from "../_shared/types.ts";

export type OperatorSponsorshipRecognitionDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: OperatorSponsorshipRecognitionRequest): ReturnType<typeof setOperatorSponsorshipPublicRecognition>;
};
const defaultDependencies: OperatorSponsorshipRecognitionDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actor, input) => setOperatorSponsorshipPublicRecognition(createEconomicServerClient(env), actor, input)
};
export async function handleOperatorSponsorshipRecognition(request: Request, env: BillingEnv, dependencies: OperatorSponsorshipRecognitionDependencies = defaultDependencies): Promise<Response> {
  try {
    assertBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_SPONSORSHIP_ADMIN_ENABLED", "sponsorship_admin_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorSponsorshipRecognitionRequest(request);
    return jsonResponse({ ok: true, recognition: await dependencies.mutate(env, auth.userId, input) });
  } catch (error) { return safeBillingErrorResponse(error); }
}
export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorSponsorshipRecognition(context.request, context.env);
