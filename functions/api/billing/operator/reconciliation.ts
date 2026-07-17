import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertTestOnlyBillingMode } from "../_shared/config.ts";
import { markOperatorReconciliationNeeded } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { billingFailureOutcome, defaultBillingLogger, emitBillingEvent, type BillingLogger } from "../_shared/observability.ts";
import { operatorReconciliationRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, OperatorReconciliationRequest } from "../_shared/types.ts";

export type OperatorReconciliationDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: OperatorReconciliationRequest): ReturnType<typeof markOperatorReconciliationNeeded>;
  logger?: BillingLogger;
};

const defaultDependencies: OperatorReconciliationDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actorUserId, input) => markOperatorReconciliationNeeded(createEconomicServerClient(env), actorUserId, input),
  logger: defaultBillingLogger
};

export async function handleOperatorReconciliation(
  request: Request,
  env: BillingEnv,
  dependencies: OperatorReconciliationDependencies = defaultDependencies
): Promise<Response> {
  let correlationId: string | null = null;
  try {
    assertTestOnlyBillingMode(env);
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorReconciliationRequest(request);
    correlationId = input.clientRequestId;
    emitBillingEvent(dependencies.logger, "billing.operator_reconciliation", "attempted", correlationId);
    const reconciliation = await dependencies.mutate(env, auth.userId, input);
    emitBillingEvent(dependencies.logger, "billing.operator_reconciliation", reconciliation.idempotentReplay ? "replayed" : "succeeded", correlationId);
    return jsonResponse({ ok: true, reconciliation }, 201);
  } catch (error) {
    emitBillingEvent(dependencies.logger, "billing.operator_reconciliation", billingFailureOutcome(error), correlationId);
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorReconciliation(context.request, context.env);
