import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertTestOnlyBillingMode } from "../_shared/config.ts";
import { reviewOperatorSponsorshipAgreement } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { operatorSponsorshipReviewRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, OperatorSponsorshipReviewRequest } from "../_shared/types.ts";

export type OperatorSponsorshipReviewDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: OperatorSponsorshipReviewRequest): ReturnType<typeof reviewOperatorSponsorshipAgreement>;
};
const defaultDependencies: OperatorSponsorshipReviewDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actor, input) => reviewOperatorSponsorshipAgreement(createEconomicServerClient(env), actor, input)
};
export async function handleOperatorSponsorshipReview(request: Request, env: BillingEnv, dependencies: OperatorSponsorshipReviewDependencies = defaultDependencies): Promise<Response> {
  try {
    assertTestOnlyBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_SPONSORSHIP_ADMIN_ENABLED", "sponsorship_admin_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorSponsorshipReviewRequest(request);
    return jsonResponse({ ok: true, review: await dependencies.mutate(env, auth.userId, input) });
  } catch (error) { return safeBillingErrorResponse(error); }
}
export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorSponsorshipReview(context.request, context.env);
