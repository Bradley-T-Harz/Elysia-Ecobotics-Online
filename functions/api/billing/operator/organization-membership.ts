import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertTestOnlyBillingMode } from "../_shared/config.ts";
import { setOperatorEconomicOrganizationMembership } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { operatorEconomicOrganizationMembershipRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, OperatorEconomicOrganizationMembershipRequest } from "../_shared/types.ts";

export type OperatorOrganizationMembershipDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: OperatorEconomicOrganizationMembershipRequest): ReturnType<typeof setOperatorEconomicOrganizationMembership>;
};
const defaultDependencies: OperatorOrganizationMembershipDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actor, input) => setOperatorEconomicOrganizationMembership(createEconomicServerClient(env), actor, input)
};
export async function handleOperatorOrganizationMembership(request: Request, env: BillingEnv, dependencies: OperatorOrganizationMembershipDependencies = defaultDependencies): Promise<Response> {
  try {
    assertTestOnlyBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_ORGANIZATION_SERVICES_ENABLED", "organization_services_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorEconomicOrganizationMembershipRequest(request);
    return jsonResponse({ ok: true, membership: await dependencies.mutate(env, auth.userId, input) });
  } catch (error) { return safeBillingErrorResponse(error); }
}
export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorOrganizationMembership(context.request, context.env);
