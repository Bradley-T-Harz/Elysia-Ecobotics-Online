import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertTestOnlyBillingMode } from "../_shared/config.ts";
import { issueOperatorAssistanceGrant } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { operatorAssistanceGrantRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, OperatorAssistanceGrantRequest } from "../_shared/types.ts";

export type OperatorAssistanceGrantDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: OperatorAssistanceGrantRequest): ReturnType<typeof issueOperatorAssistanceGrant>;
};

const defaultDependencies: OperatorAssistanceGrantDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actor, input) => issueOperatorAssistanceGrant(createEconomicServerClient(env), actor, input)
};

export async function handleOperatorAssistanceGrant(
  request: Request,
  env: BillingEnv,
  dependencies: OperatorAssistanceGrantDependencies = defaultDependencies
): Promise<Response> {
  try {
    assertTestOnlyBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_ASSISTANCE_ADMIN_ENABLED", "economic_assistance_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorAssistanceGrantRequest(request);
    return jsonResponse({ ok: true, grant: await dependencies.mutate(env, auth.userId, input) }, 201);
  } catch (error) {
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorAssistanceGrant(context.request, context.env);
