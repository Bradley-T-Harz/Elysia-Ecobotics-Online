import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertTestOnlyBillingMode } from "../_shared/config.ts";
import { createOperatorEconomicOrganization } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { operatorEconomicOrganizationRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, OperatorEconomicOrganizationRequest } from "../_shared/types.ts";

export type OperatorOrganizationDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: OperatorEconomicOrganizationRequest): ReturnType<typeof createOperatorEconomicOrganization>;
};

const defaultDependencies: OperatorOrganizationDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actor, input) => createOperatorEconomicOrganization(createEconomicServerClient(env), actor, input)
};

export async function handleOperatorOrganization(request: Request, env: BillingEnv, dependencies: OperatorOrganizationDependencies = defaultDependencies): Promise<Response> {
  try {
    assertTestOnlyBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_ORGANIZATION_SERVICES_ENABLED", "organization_services_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorEconomicOrganizationRequest(request);
    return jsonResponse({ ok: true, organization: await dependencies.mutate(env, auth.userId, input) }, 201);
  } catch (error) { return safeBillingErrorResponse(error); }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorOrganization(context.request, context.env);
