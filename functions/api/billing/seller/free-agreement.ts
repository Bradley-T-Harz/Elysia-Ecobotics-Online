import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertTestOnlyBillingMode } from "../_shared/config.ts";
import { acceptMarketplaceFreeSellerAgreement } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { billingFailureOutcome, defaultBillingLogger, emitBillingEvent, type BillingLogger } from "../_shared/observability.ts";
import { marketplaceFreeSellerAgreementRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, MarketplaceFreeSellerAgreementRequest } from "../_shared/types.ts";

export type MarketplaceFreeSellerAgreementDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  accept(env: BillingEnv, actorUserId: string, input: MarketplaceFreeSellerAgreementRequest): ReturnType<typeof acceptMarketplaceFreeSellerAgreement>;
  logger?: BillingLogger;
};

const defaultDependencies: MarketplaceFreeSellerAgreementDependencies = {
  authenticate: authenticateRequired,
  accept: (env, actorUserId, input) => acceptMarketplaceFreeSellerAgreement(createEconomicServerClient(env), actorUserId, input),
  logger: defaultBillingLogger
};

export async function handleMarketplaceFreeSellerAgreement(
  request: Request,
  env: BillingEnv,
  dependencies: MarketplaceFreeSellerAgreementDependencies = defaultDependencies
): Promise<Response> {
  let correlationId: string | null = null;
  try {
    // A free seller agreement is independent of paid Marketplace acquisition.
    assertTestOnlyBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_MARKETPLACE_COMMERCE_ENABLED", "marketplace_commerce_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const input = await marketplaceFreeSellerAgreementRequest(request);
    correlationId = input.clientRequestId;
    emitBillingEvent(dependencies.logger, "billing.marketplace_free_seller_agreement", "attempted", correlationId);
    const auth = await dependencies.authenticate(request, env);
    const agreement = await dependencies.accept(env, auth.userId, input);
    emitBillingEvent(dependencies.logger, "billing.marketplace_free_seller_agreement", agreement.idempotentReplay ? "replayed" : "succeeded", correlationId);
    return jsonResponse({ ok: true, agreement }, 201);
  } catch (error) {
    emitBillingEvent(dependencies.logger, "billing.marketplace_free_seller_agreement", billingFailureOutcome(error), correlationId);
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleMarketplaceFreeSellerAgreement(context.request, context.env);
