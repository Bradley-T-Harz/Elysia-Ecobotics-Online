import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertBillingMode } from "../_shared/config.ts";
import { closeOperatorSponsorshipAssistanceAllocation } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { operatorSponsorshipAssistanceAllocationCloseRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, OperatorSponsorshipAssistanceAllocationCloseRequest } from "../_shared/types.ts";

export type OperatorSponsorshipAllocationCloseDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: OperatorSponsorshipAssistanceAllocationCloseRequest): ReturnType<typeof closeOperatorSponsorshipAssistanceAllocation>;
};
const defaultDependencies: OperatorSponsorshipAllocationCloseDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actor, input) => closeOperatorSponsorshipAssistanceAllocation(createEconomicServerClient(env), actor, input)
};
export async function handleOperatorSponsorshipAllocationClose(request: Request, env: BillingEnv, dependencies: OperatorSponsorshipAllocationCloseDependencies = defaultDependencies): Promise<Response> {
  try {
    assertBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_SPONSORSHIP_ADMIN_ENABLED", "sponsorship_admin_disabled");
    assertBillingFeatureEnabled(env, "BILLING_ASSISTANCE_ADMIN_ENABLED", "economic_assistance_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorSponsorshipAssistanceAllocationCloseRequest(request);
    return jsonResponse({ ok: true, allocation: await dependencies.mutate(env, auth.userId, input) });
  } catch (error) { return safeBillingErrorResponse(error); }
}
export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorSponsorshipAllocationClose(context.request, context.env);
