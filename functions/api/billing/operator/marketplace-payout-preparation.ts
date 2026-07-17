import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertTestOnlyBillingMode } from "../_shared/config.ts";
import { prepareOperatorMarketplaceTestPayout } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { operatorMarketplacePayoutPreparationRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, OperatorMarketplacePayoutPreparationRequest } from "../_shared/types.ts";

export type OperatorMarketplacePayoutPreparationDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: OperatorMarketplacePayoutPreparationRequest): ReturnType<typeof prepareOperatorMarketplaceTestPayout>;
};

const defaultDependencies: OperatorMarketplacePayoutPreparationDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actor, input) => prepareOperatorMarketplaceTestPayout(createEconomicServerClient(env), actor, input)
};

export async function handleOperatorMarketplacePayoutPreparation(
  request: Request,
  env: BillingEnv,
  dependencies: OperatorMarketplacePayoutPreparationDependencies = defaultDependencies
): Promise<Response> {
  try {
    assertTestOnlyBillingMode(env);
    assertBillingFeatureEnabled(
      env,
      "BILLING_MARKETPLACE_PAYOUT_PREPARATION_ENABLED",
      "marketplace_payout_preparation_disabled"
    );
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorMarketplacePayoutPreparationRequest(request);
    return jsonResponse({
      ok: true,
      payoutPreparation: await dependencies.mutate(env, auth.userId, input)
    }, 201);
  } catch (error) {
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorMarketplacePayoutPreparation(context.request, context.env);
