import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertTestOnlyBillingMode } from "../_shared/config.ts";
import { setOperatorAssistanceProgramStatus } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { operatorAssistanceProgramStatusRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, OperatorAssistanceProgramStatusRequest } from "../_shared/types.ts";

export type OperatorAssistanceProgramStatusDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: OperatorAssistanceProgramStatusRequest): ReturnType<typeof setOperatorAssistanceProgramStatus>;
};
const defaultDependencies: OperatorAssistanceProgramStatusDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actor, input) => setOperatorAssistanceProgramStatus(createEconomicServerClient(env), actor, input)
};
export async function handleOperatorAssistanceProgramStatus(request: Request, env: BillingEnv, dependencies: OperatorAssistanceProgramStatusDependencies = defaultDependencies): Promise<Response> {
  try {
    assertTestOnlyBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_ASSISTANCE_ADMIN_ENABLED", "economic_assistance_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorAssistanceProgramStatusRequest(request);
    return jsonResponse({ ok: true, program: await dependencies.mutate(env, auth.userId, input) });
  } catch (error) { return safeBillingErrorResponse(error); }
}
export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorAssistanceProgramStatus(context.request, context.env);
