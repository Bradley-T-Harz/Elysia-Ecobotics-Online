import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertTestOnlyBillingMode } from "../_shared/config.ts";
import { setOperatorEconomicServiceRestriction } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { operatorEconomicServiceRestrictionRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, OperatorEconomicServiceRestrictionRequest } from "../_shared/types.ts";

export type OperatorEconomicServiceRestrictionDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: OperatorEconomicServiceRestrictionRequest): ReturnType<typeof setOperatorEconomicServiceRestriction>;
};

const defaultDependencies: OperatorEconomicServiceRestrictionDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actor, input) => setOperatorEconomicServiceRestriction(createEconomicServerClient(env), actor, input)
};

export async function handleOperatorEconomicServiceRestriction(
  request: Request,
  env: BillingEnv,
  dependencies: OperatorEconomicServiceRestrictionDependencies = defaultDependencies
): Promise<Response> {
  try {
    assertTestOnlyBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_ACCOUNT_LIFECYCLE_ENABLED", "economic_account_lifecycle_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorEconomicServiceRestrictionRequest(request);
    return jsonResponse({ ok: true, restriction: await dependencies.mutate(env, auth.userId, input) });
  } catch (error) {
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorEconomicServiceRestriction(context.request, context.env);
