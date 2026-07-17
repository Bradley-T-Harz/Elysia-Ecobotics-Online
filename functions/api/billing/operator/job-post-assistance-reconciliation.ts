import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertTestOnlyBillingMode } from "../_shared/config.ts";
import { reconcileOperatorJobPostAssistanceGrant } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { operatorJobPostAssistanceReconciliationRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, OperatorJobPostAssistanceReconciliationRequest } from "../_shared/types.ts";

export type OperatorJobPostAssistanceReconciliationDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: OperatorJobPostAssistanceReconciliationRequest): ReturnType<typeof reconcileOperatorJobPostAssistanceGrant>;
};
const defaultDependencies: OperatorJobPostAssistanceReconciliationDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actor, input) => reconcileOperatorJobPostAssistanceGrant(createEconomicServerClient(env), actor, input)
};
export async function handleOperatorJobPostAssistanceReconciliation(request: Request, env: BillingEnv, dependencies: OperatorJobPostAssistanceReconciliationDependencies = defaultDependencies): Promise<Response> {
  try {
    assertTestOnlyBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_ASSISTANCE_ADMIN_ENABLED", "economic_assistance_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorJobPostAssistanceReconciliationRequest(request);
    return jsonResponse({ ok: true, reconciliation: await dependencies.mutate(env, auth.userId, input) });
  } catch (error) { return safeBillingErrorResponse(error); }
}
export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorJobPostAssistanceReconciliation(context.request, context.env);
