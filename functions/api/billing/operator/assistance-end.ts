import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertTestOnlyBillingMode } from "../_shared/config.ts";
import { endOperatorAssistanceGrant } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { operatorAssistanceEndRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, OperatorAssistanceEndRequest } from "../_shared/types.ts";

export type OperatorAssistanceEndDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: OperatorAssistanceEndRequest): ReturnType<typeof endOperatorAssistanceGrant>;
};

const defaultDependencies: OperatorAssistanceEndDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actor, input) => endOperatorAssistanceGrant(createEconomicServerClient(env), actor, input)
};

export async function handleOperatorAssistanceEnd(
  request: Request,
  env: BillingEnv,
  dependencies: OperatorAssistanceEndDependencies = defaultDependencies
): Promise<Response> {
  try {
    assertTestOnlyBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_ASSISTANCE_ADMIN_ENABLED", "economic_assistance_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorAssistanceEndRequest(request);
    return jsonResponse({ ok: true, grant: await dependencies.mutate(env, auth.userId, input) });
  } catch (error) {
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorAssistanceEnd(context.request, context.env);
