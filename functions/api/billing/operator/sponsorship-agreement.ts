import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertBillingMode } from "../_shared/config.ts";
import { createOperatorSponsorshipAgreement } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { operatorSponsorshipAgreementRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, OperatorSponsorshipAgreementRequest } from "../_shared/types.ts";

export type OperatorSponsorshipAgreementDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: OperatorSponsorshipAgreementRequest): ReturnType<typeof createOperatorSponsorshipAgreement>;
};
const defaultDependencies: OperatorSponsorshipAgreementDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actor, input) => createOperatorSponsorshipAgreement(createEconomicServerClient(env), actor, input)
};
export async function handleOperatorSponsorshipAgreement(request: Request, env: BillingEnv, dependencies: OperatorSponsorshipAgreementDependencies = defaultDependencies): Promise<Response> {
  try {
    assertBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_SPONSORSHIP_ADMIN_ENABLED", "sponsorship_admin_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorSponsorshipAgreementRequest(request);
    return jsonResponse({ ok: true, agreement: await dependencies.mutate(env, auth.userId, input) }, 201);
  } catch (error) { return safeBillingErrorResponse(error); }
}
export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorSponsorshipAgreement(context.request, context.env);
