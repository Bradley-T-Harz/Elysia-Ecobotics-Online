import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertBillingMode } from "../_shared/config.ts";
import { configureOperatorAssistanceProgram } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { operatorAssistanceProgramRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, OperatorAssistanceProgramRequest } from "../_shared/types.ts";

export type OperatorAssistanceProgramDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: OperatorAssistanceProgramRequest): ReturnType<typeof configureOperatorAssistanceProgram>;
};

const defaultDependencies: OperatorAssistanceProgramDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actor, input) => configureOperatorAssistanceProgram(createEconomicServerClient(env), actor, input)
};

export async function handleOperatorAssistanceProgram(
  request: Request,
  env: BillingEnv,
  dependencies: OperatorAssistanceProgramDependencies = defaultDependencies
): Promise<Response> {
  try {
    assertBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_ASSISTANCE_ADMIN_ENABLED", "economic_assistance_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorAssistanceProgramRequest(request);
    return jsonResponse({ ok: true, program: await dependencies.mutate(env, auth.userId, input) }, 201);
  } catch (error) {
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorAssistanceProgram(context.request, context.env);
