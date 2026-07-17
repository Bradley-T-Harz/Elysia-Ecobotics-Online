import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertBillingMutationEnabled } from "../_shared/config.ts";
import { configureMarketplaceCommercialTerms } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { billingFailureOutcome, defaultBillingLogger, emitBillingEvent, type BillingLogger } from "../_shared/observability.ts";
import { marketplaceCommercialTermsRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, MarketplaceCommercialTermsRequest } from "../_shared/types.ts";

export type OperatorMarketplaceTermsDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  configure(env: BillingEnv, actorUserId: string, input: MarketplaceCommercialTermsRequest): ReturnType<typeof configureMarketplaceCommercialTerms>;
  logger?: BillingLogger;
};

const defaultDependencies: OperatorMarketplaceTermsDependencies = {
  authenticate: authenticateRequired,
  configure: (env, actorUserId, input) => configureMarketplaceCommercialTerms(createEconomicServerClient(env), actorUserId, input),
  logger: defaultBillingLogger
};

export async function handleOperatorMarketplaceTerms(
  request: Request,
  env: BillingEnv,
  dependencies: OperatorMarketplaceTermsDependencies = defaultDependencies
): Promise<Response> {
  let correlationId: string | null = null;
  try {
    assertBillingMutationEnabled(env);
    assertBillingFeatureEnabled(env, "BILLING_MARKETPLACE_COMMERCE_ENABLED", "marketplace_commerce_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const input = await marketplaceCommercialTermsRequest(request);
    correlationId = input.clientRequestId;
    emitBillingEvent(dependencies.logger, "billing.operator_marketplace_terms", "attempted", correlationId);
    const auth = await dependencies.authenticate(request, env);
    const terms = await dependencies.configure(env, auth.userId, input);
    emitBillingEvent(dependencies.logger, "billing.operator_marketplace_terms", "succeeded", correlationId);
    return jsonResponse({ ok: true, terms });
  } catch (error) {
    emitBillingEvent(dependencies.logger, "billing.operator_marketplace_terms", billingFailureOutcome(error), correlationId);
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorMarketplaceTerms(context.request, context.env);
