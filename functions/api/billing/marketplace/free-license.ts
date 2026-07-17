import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertTestOnlyBillingMode } from "../_shared/config.ts";
import { acceptMarketplaceFreeLicense } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { billingFailureOutcome, defaultBillingLogger, emitBillingEvent, type BillingLogger } from "../_shared/observability.ts";
import { marketplacePurchaseRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, MarketplacePurchaseRequest } from "../_shared/types.ts";

export type MarketplaceFreeLicenseDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  accept(env: BillingEnv, actorUserId: string, input: MarketplacePurchaseRequest): ReturnType<typeof acceptMarketplaceFreeLicense>;
  logger?: BillingLogger;
};

const defaultDependencies: MarketplaceFreeLicenseDependencies = {
  authenticate: authenticateRequired,
  accept: (env, actorUserId, input) => acceptMarketplaceFreeLicense(createEconomicServerClient(env), actorUserId, input),
  logger: defaultBillingLogger
};

export async function handleMarketplaceFreeLicense(
  request: Request,
  env: BillingEnv,
  dependencies: MarketplaceFreeLicenseDependencies = defaultDependencies
): Promise<Response> {
  let correlationId: string | null = null;
  try {
    // Free-license acceptance is not a payment acquisition.
    assertTestOnlyBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_MARKETPLACE_COMMERCE_ENABLED", "marketplace_commerce_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const input = await marketplacePurchaseRequest(request);
    correlationId = input.clientRequestId;
    emitBillingEvent(dependencies.logger, "billing.marketplace_free_license", "attempted", correlationId);
    const auth = await dependencies.authenticate(request, env);
    const license = await dependencies.accept(env, auth.userId, input);
    emitBillingEvent(dependencies.logger, "billing.marketplace_free_license", "succeeded", correlationId);
    return jsonResponse({
      ok: true,
      license: { ...license, paymentRequired: false, paymentGrantsAuthority: false },
      testMode: true
    }, 201);
  } catch (error) {
    emitBillingEvent(dependencies.logger, "billing.marketplace_free_license", billingFailureOutcome(error), correlationId);
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleMarketplaceFreeLicense(context.request, context.env);
