import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertBillingMode } from "../_shared/config.ts";
import { createOperatorSponsorshipAssistanceAllocation } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { operatorSponsorshipAssistanceAllocationRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, OperatorSponsorshipAssistanceAllocationRequest } from "../_shared/types.ts";

export type OperatorSponsorshipAllocationDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: OperatorSponsorshipAssistanceAllocationRequest): ReturnType<typeof createOperatorSponsorshipAssistanceAllocation>;
};
const defaultDependencies: OperatorSponsorshipAllocationDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actor, input) => createOperatorSponsorshipAssistanceAllocation(createEconomicServerClient(env), actor, input)
};
export async function handleOperatorSponsorshipAllocation(request: Request, env: BillingEnv, dependencies: OperatorSponsorshipAllocationDependencies = defaultDependencies): Promise<Response> {
  try {
    assertBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_SPONSORSHIP_ADMIN_ENABLED", "sponsorship_admin_disabled");
    assertBillingFeatureEnabled(env, "BILLING_ASSISTANCE_ADMIN_ENABLED", "economic_assistance_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorSponsorshipAssistanceAllocationRequest(request);
    return jsonResponse({ ok: true, allocation: await dependencies.mutate(env, auth.userId, input) }, 201);
  } catch (error) { return safeBillingErrorResponse(error); }
}
export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorSponsorshipAllocation(context.request, context.env);
