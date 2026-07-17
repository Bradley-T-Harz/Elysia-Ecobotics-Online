import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertTestOnlyBillingMode } from "../_shared/config.ts";
import { placeOperatorRefundHold } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { billingFailureOutcome, defaultBillingLogger, emitBillingEvent, type BillingLogger } from "../_shared/observability.ts";
import { operatorRefundHoldRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, OperatorRefundHoldRequest } from "../_shared/types.ts";

export type OperatorRefundHoldDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: OperatorRefundHoldRequest): ReturnType<typeof placeOperatorRefundHold>;
  logger?: BillingLogger;
};

const defaultDependencies: OperatorRefundHoldDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actorUserId, input) => placeOperatorRefundHold(createEconomicServerClient(env), actorUserId, input),
  logger: defaultBillingLogger
};

export async function handleOperatorRefundHold(
  request: Request,
  env: BillingEnv,
  dependencies: OperatorRefundHoldDependencies = defaultDependencies
): Promise<Response> {
  let correlationId: string | null = null;
  try {
    assertTestOnlyBillingMode(env);
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorRefundHoldRequest(request);
    correlationId = input.clientRequestId;
    emitBillingEvent(dependencies.logger, "billing.operator_refund_hold", "attempted", correlationId);
    const refundHold = await dependencies.mutate(env, auth.userId, input);
    emitBillingEvent(dependencies.logger, "billing.operator_refund_hold", refundHold.idempotentReplay ? "replayed" : "succeeded", correlationId);
    return jsonResponse({ ok: true, refundHold }, 201);
  } catch (error) {
    emitBillingEvent(dependencies.logger, "billing.operator_refund_hold", billingFailureOutcome(error), correlationId);
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorRefundHold(context.request, context.env);
