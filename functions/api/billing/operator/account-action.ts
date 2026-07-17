import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertTestOnlyBillingMode } from "../_shared/config.ts";
import { updateOperatorEconomicAccountAction } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { operatorEconomicAccountActionRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, OperatorEconomicAccountActionRequest } from "../_shared/types.ts";

export type OperatorEconomicAccountActionDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: OperatorEconomicAccountActionRequest): ReturnType<typeof updateOperatorEconomicAccountAction>;
};

const defaultDependencies: OperatorEconomicAccountActionDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actor, input) => updateOperatorEconomicAccountAction(createEconomicServerClient(env), actor, input)
};

export async function handleOperatorEconomicAccountAction(
  request: Request,
  env: BillingEnv,
  dependencies: OperatorEconomicAccountActionDependencies = defaultDependencies
): Promise<Response> {
  try {
    assertTestOnlyBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_ACCOUNT_LIFECYCLE_ENABLED", "economic_account_lifecycle_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorEconomicAccountActionRequest(request);
    return jsonResponse({ ok: true, accountAction: await dependencies.mutate(env, auth.userId, input) });
  } catch (error) {
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorEconomicAccountAction(context.request, context.env);
