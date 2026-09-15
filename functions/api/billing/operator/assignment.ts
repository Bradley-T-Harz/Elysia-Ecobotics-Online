import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingMode } from "../_shared/config.ts";
import { setEconomicOperatorAssignment } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { billingFailureOutcome, defaultBillingLogger, emitBillingEvent, type BillingLogger } from "../_shared/observability.ts";
import { operatorAssignmentRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, OperatorAssignmentRequest } from "../_shared/types.ts";

export type OperatorAssignmentDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: OperatorAssignmentRequest): ReturnType<typeof setEconomicOperatorAssignment>;
  logger?: BillingLogger;
};

const defaultDependencies: OperatorAssignmentDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actorUserId, input) => setEconomicOperatorAssignment(createEconomicServerClient(env), actorUserId, input),
  logger: defaultBillingLogger
};

export async function handleOperatorAssignment(
  request: Request,
  env: BillingEnv,
  dependencies: OperatorAssignmentDependencies = defaultDependencies
): Promise<Response> {
  try {
    assertBillingMode(env);
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorAssignmentRequest(request);
    emitBillingEvent(dependencies.logger, "billing.operator_assignment", "attempted");
    const assignment = await dependencies.mutate(env, auth.userId, input);
    emitBillingEvent(dependencies.logger, "billing.operator_assignment", assignment.idempotentReplay ? "replayed" : "succeeded");
    return jsonResponse({ ok: true, assignment }, 200);
  } catch (error) {
    emitBillingEvent(dependencies.logger, "billing.operator_assignment", billingFailureOutcome(error));
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorAssignment(context.request, context.env);
