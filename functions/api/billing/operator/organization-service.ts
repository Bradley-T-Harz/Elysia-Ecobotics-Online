import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertBillingMode } from "../_shared/config.ts";
import { createOperatorOrganizationServiceEngagement } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { operatorOrganizationServiceEngagementRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, OperatorOrganizationServiceEngagementRequest } from "../_shared/types.ts";

export type OperatorOrganizationServiceDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: OperatorOrganizationServiceEngagementRequest): ReturnType<typeof createOperatorOrganizationServiceEngagement>;
};
const defaultDependencies: OperatorOrganizationServiceDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actor, input) => createOperatorOrganizationServiceEngagement(createEconomicServerClient(env), actor, input)
};
export async function handleOperatorOrganizationService(request: Request, env: BillingEnv, dependencies: OperatorOrganizationServiceDependencies = defaultDependencies): Promise<Response> {
  try {
    assertBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_ORGANIZATION_SERVICES_ENABLED", "organization_services_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorOrganizationServiceEngagementRequest(request);
    return jsonResponse({ ok: true, engagement: await dependencies.mutate(env, auth.userId, input) }, 201);
  } catch (error) { return safeBillingErrorResponse(error); }
}
export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorOrganizationService(context.request, context.env);
