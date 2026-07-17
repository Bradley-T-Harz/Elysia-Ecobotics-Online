import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertTestOnlyBillingMode } from "../_shared/config.ts";
import { requestCurrentUserEconomicAccountAction } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { economicAccountActionRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, EconomicAccountActionRequest } from "../_shared/types.ts";

export type EconomicAccountActionDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: EconomicAccountActionRequest): ReturnType<typeof requestCurrentUserEconomicAccountAction>;
};

const defaultDependencies: EconomicAccountActionDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actorUserId, input) => requestCurrentUserEconomicAccountAction(
    createEconomicServerClient(env), actorUserId, input
  )
};

export async function handleEconomicAccountAction(
  request: Request,
  env: BillingEnv,
  dependencies: EconomicAccountActionDependencies = defaultDependencies
): Promise<Response> {
  try {
    assertTestOnlyBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_ACCOUNT_LIFECYCLE_ENABLED", "economic_account_lifecycle_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await economicAccountActionRequest(request);
    return jsonResponse({ ok: true, accountAction: await dependencies.mutate(env, auth.userId, input) }, 202);
  } catch (error) {
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleEconomicAccountAction(context.request, context.env);
