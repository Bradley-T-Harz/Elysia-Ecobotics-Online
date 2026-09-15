import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertBillingMutationEnabled } from "../_shared/config.ts";
import { setMarketplaceOfferStatus } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { billingFailureOutcome, defaultBillingLogger, emitBillingEvent, type BillingLogger } from "../_shared/observability.ts";
import { marketplaceOfferStatusRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, MarketplaceOfferStatusRequest } from "../_shared/types.ts";

export type SellerOfferActivationDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  mutate(env: BillingEnv, actorUserId: string, input: MarketplaceOfferStatusRequest): ReturnType<typeof setMarketplaceOfferStatus>;
  logger?: BillingLogger;
};

const defaultDependencies: SellerOfferActivationDependencies = {
  authenticate: authenticateRequired,
  mutate: (env, actorUserId, input) => setMarketplaceOfferStatus(createEconomicServerClient(env), actorUserId, input),
  logger: defaultBillingLogger
};

export async function handleSellerOfferActivation(
  request: Request,
  env: BillingEnv,
  dependencies: SellerOfferActivationDependencies = defaultDependencies
): Promise<Response> {
  let correlationId: string | null = null;
  try {
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const input = await marketplaceOfferStatusRequest(request);
    correlationId = input.clientRequestId;
    emitBillingEvent(dependencies.logger, "billing.marketplace_offer_status", "attempted", correlationId);
    const auth = await dependencies.authenticate(request, env);
    const offer = await dependencies.mutate(env, auth.userId, input);
    emitBillingEvent(dependencies.logger, "billing.marketplace_offer_status", offer.idempotentReplay ? "replayed" : "succeeded", correlationId);
    return jsonResponse({
      ok: true,
      offer: { ...offer, paymentGrantsTrust: false, purchaseInstallsAddon: false }
    });
  } catch (error) {
    emitBillingEvent(dependencies.logger, "billing.marketplace_offer_status", billingFailureOutcome(error), correlationId);
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleSellerOfferActivation(context.request, context.env);
