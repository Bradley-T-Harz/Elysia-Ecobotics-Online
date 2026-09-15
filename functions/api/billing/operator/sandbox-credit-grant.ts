import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingMode } from "../_shared/config.ts";
import { grantOperatorSandboxCredits } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { operatorSandboxCreditGrantRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, OperatorSandboxCreditGrantRequest } from "../_shared/types.ts";

export type OperatorSandboxCreditDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: OperatorSandboxCreditGrantRequest): ReturnType<typeof grantOperatorSandboxCredits>;
};

const defaultDependencies: OperatorSandboxCreditDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actorUserId, input) => grantOperatorSandboxCredits(createEconomicServerClient(env), actorUserId, input)
};

export async function handleOperatorSandboxCreditGrant(
  request: Request,
  env: BillingEnv,
  dependencies: OperatorSandboxCreditDependencies = defaultDependencies
): Promise<Response> {
  try {
    assertBillingMode(env);
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorSandboxCreditGrantRequest(request);
    const grant = await dependencies.mutate(env, auth.userId, input);
    return jsonResponse({ ok: true, grant }, 201);
  } catch (error) {
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorSandboxCreditGrant(context.request, context.env);
