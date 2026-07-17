import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertTestOnlyBillingMode } from "../_shared/config.ts";
import { assessOperatorJobPostFee } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { billingFailureOutcome, defaultBillingLogger, emitBillingEvent, type BillingLogger } from "../_shared/observability.ts";
import { operatorJobPostFeeAssessmentRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, OperatorJobPostFeeAssessmentRequest } from "../_shared/types.ts";

export type OperatorJobPostFeeAssessmentDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: OperatorJobPostFeeAssessmentRequest): ReturnType<typeof assessOperatorJobPostFee>;
  logger?: BillingLogger;
};

const defaultDependencies: OperatorJobPostFeeAssessmentDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actorUserId, input) => assessOperatorJobPostFee(createEconomicServerClient(env), actorUserId, input),
  logger: defaultBillingLogger
};

export async function handleOperatorJobPostFeeAssessment(
  request: Request,
  env: BillingEnv,
  dependencies: OperatorJobPostFeeAssessmentDependencies = defaultDependencies
): Promise<Response> {
  let correlationId: string | null = null;
  try {
    assertTestOnlyBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_JOB_POST_FEES_ENABLED", "job_post_fees_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorJobPostFeeAssessmentRequest(request);
    correlationId = input.clientRequestId;
    emitBillingEvent(dependencies.logger, "billing.operator_job_fee_assessment", "attempted", correlationId);
    const assessment = await dependencies.mutate(env, auth.userId, input);
    emitBillingEvent(dependencies.logger, "billing.operator_job_fee_assessment", assessment.idempotentReplay ? "replayed" : "succeeded", correlationId);
    return jsonResponse({ ok: true, assessment }, 200);
  } catch (error) {
    emitBillingEvent(dependencies.logger, "billing.operator_job_fee_assessment", billingFailureOutcome(error), correlationId);
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorJobPostFeeAssessment(context.request, context.env);
