import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertTestOnlyBillingMode } from "../_shared/config.ts";
import { reviewOperatorOrganizationServiceEngagement } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { operatorOrganizationServiceReviewRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, OperatorOrganizationServiceReviewRequest } from "../_shared/types.ts";

export type OperatorOrganizationServiceReviewDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: OperatorOrganizationServiceReviewRequest): ReturnType<typeof reviewOperatorOrganizationServiceEngagement>;
};
const defaultDependencies: OperatorOrganizationServiceReviewDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actor, input) => reviewOperatorOrganizationServiceEngagement(createEconomicServerClient(env), actor, input)
};
export async function handleOperatorOrganizationServiceReview(request: Request, env: BillingEnv, dependencies: OperatorOrganizationServiceReviewDependencies = defaultDependencies): Promise<Response> {
  try {
    assertTestOnlyBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_ORGANIZATION_SERVICES_ENABLED", "organization_services_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorOrganizationServiceReviewRequest(request);
    return jsonResponse({ ok: true, review: await dependencies.mutate(env, auth.userId, input) });
  } catch (error) { return safeBillingErrorResponse(error); }
}
export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorOrganizationServiceReview(context.request, context.env);
