import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertTestOnlyBillingMode } from "../_shared/config.ts";
import { attachOperatorTestRefundResult, prepareOperatorTestRefund } from "../_shared/database.ts";
import { BillingHttpError, jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { billingFailureOutcome, defaultBillingLogger, emitBillingEvent, type BillingLogger } from "../_shared/observability.ts";
import { operatorTestRefundExecutionRequest } from "../_shared/schema.ts";
import { createStripeTestProvider } from "../_shared/stripe.ts";
import type {
  AuthenticatedBillingRequest,
  BillingEnv,
  BillingProvider,
  OperatorTestRefundExecutionRequest,
  ProviderRefundResult
} from "../_shared/types.ts";

export type OperatorTestRefundExecutionDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  provider(env: BillingEnv): BillingProvider;
  prepare(env: BillingEnv, actorUserId: string, input: OperatorTestRefundExecutionRequest): ReturnType<typeof prepareOperatorTestRefund>;
  attach(
    env: BillingEnv,
    actorUserId: string,
    input: OperatorTestRefundExecutionRequest,
    providerResult: ProviderRefundResult
  ): ReturnType<typeof attachOperatorTestRefundResult>;
  logger?: BillingLogger;
};

const defaultDependencies: OperatorTestRefundExecutionDependencies = {
  authenticate: authenticateRequired,
  provider: createStripeTestProvider,
  prepare: (env, actorUserId, input) => prepareOperatorTestRefund(createEconomicServerClient(env), actorUserId, input),
  attach: (env, actorUserId, input, providerResult) => attachOperatorTestRefundResult(
    createEconomicServerClient(env), actorUserId, input, providerResult
  ),
  logger: defaultBillingLogger
};

export async function handleOperatorTestRefundExecution(
  request: Request,
  env: BillingEnv,
  dependencies: OperatorTestRefundExecutionDependencies = defaultDependencies
): Promise<Response> {
  let correlationId: string | null = null;
  try {
    assertTestOnlyBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_TEST_REFUNDS_ENABLED", "test_refunds_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorTestRefundExecutionRequest(request);
    correlationId = input.approvalClientRequestId;
    emitBillingEvent(dependencies.logger, "billing.operator_refund_execution", "attempted", correlationId);
    const preparation = await dependencies.prepare(env, auth.userId, input);
    let providerResult: ProviderRefundResult;
    try {
      providerResult = await dependencies.provider(env).createRefund({
        orderId: preparation.orderId,
        providerPaymentReference: preparation.providerPaymentReference,
        amountMinor: preparation.amountMinor,
        currency: preparation.currency,
        idempotencyKey: preparation.providerIdempotencyKey
      });
    } catch (error) {
      if (error instanceof BillingHttpError) throw error;
      throw new BillingHttpError(502, "refund_provider_unavailable");
    }
    const result = await dependencies.attach(env, auth.userId, input, providerResult);
    emitBillingEvent(
      dependencies.logger,
      "billing.operator_refund_execution",
      result.idempotentReplay ? "replayed" : "succeeded",
      correlationId
    );
    return jsonResponse({
      ok: true,
      refund: {
        refundRequestId: result.refundRequestId,
        orderId: result.orderId,
        amountMinor: preparation.amountMinor,
        currency: preparation.currency,
        status: result.status,
        providerStatus: result.providerStatus,
        idempotentReplay: result.idempotentReplay,
        testMode: true
      }
    });
  } catch (error) {
    emitBillingEvent(dependencies.logger, "billing.operator_refund_execution", billingFailureOutcome(error), correlationId);
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorTestRefundExecution(context.request, context.env);
