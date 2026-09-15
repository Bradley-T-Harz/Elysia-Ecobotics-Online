import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingCheckoutReliabilityEnabled, assertBillingFeatureEnabled, assertBillingMutationEnabled } from "../_shared/config.ts";
import { configureMarketplaceOffer, recordMarketplaceProviderCatalog } from "../_shared/database.ts";
import { BillingHttpError, jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { billingFailureOutcome, defaultBillingLogger, emitBillingEvent, type BillingLogger } from "../_shared/observability.ts";
import { marketplaceOfferConfigurationRequest } from "../_shared/schema.ts";
import { createStripeTestProvider } from "../_shared/stripe.ts";
import type { AuthenticatedBillingRequest, BillingEnv, BillingProvider, MarketplaceOfferConfigurationRequest } from "../_shared/types.ts";

export type SellerOfferDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  provider(env: BillingEnv): BillingProvider;
  configure(env: BillingEnv, actorUserId: string, input: MarketplaceOfferConfigurationRequest): ReturnType<typeof configureMarketplaceOffer>;
  recordCatalog(
    env: BillingEnv,
    offer: Awaited<ReturnType<typeof configureMarketplaceOffer>>,
    providerProductReference: string,
    providerPriceReference: string
  ): Promise<void>;
  logger?: BillingLogger;
};

const defaultDependencies: SellerOfferDependencies = {
  authenticate: authenticateRequired,
  provider: createStripeTestProvider,
  configure: (env, actorUserId, input) => configureMarketplaceOffer(createEconomicServerClient(env), actorUserId, input),
  recordCatalog: (env, offer, productReference, priceReference) => recordMarketplaceProviderCatalog(
    createEconomicServerClient(env), offer, productReference, priceReference
  ),
  logger: defaultBillingLogger
};

export async function handleSellerOffer(
  request: Request,
  env: BillingEnv,
  dependencies: SellerOfferDependencies = defaultDependencies
): Promise<Response> {
  let correlationId: string | null = null;
  try {
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const input = await marketplaceOfferConfigurationRequest(request);
    if (input.offerKind !== "free") throw new BillingHttpError(503, "third_party_money_hard_off");
    correlationId = input.clientRequestId;
    emitBillingEvent(dependencies.logger, "billing.marketplace_offer_configuration", "attempted", correlationId);
    const auth = await dependencies.authenticate(request, env);
    const offer = await dependencies.configure(env, auth.userId, input);
    let providerCatalogConfigured = false;
    if (offer.offerKind === "paid") {
      assertBillingCheckoutReliabilityEnabled(env);
      if (!offer.priceCode || offer.amountMinor === null || offer.currency !== "usd") {
        throw new Error("Invalid internal paid-offer preparation.");
      }
      const providerCatalog = await dependencies.provider(env).ensureMarketplaceCatalog({
        offerId: offer.offerId,
        addonVersionId: offer.addonVersionId,
        priceCode: offer.priceCode,
        amountMinor: offer.amountMinor,
        currency: offer.currency
      });
      await dependencies.recordCatalog(
        env, offer, providerCatalog.providerProductReference, providerCatalog.providerPriceReference
      );
      providerCatalogConfigured = true;
    }
    emitBillingEvent(
      dependencies.logger,
      "billing.marketplace_offer_configuration",
      offer.idempotentReplay ? "replayed" : "succeeded",
      correlationId
    );
    return jsonResponse({
      ok: true,
      offer: {
        offerId: offer.offerId,
        listingId: offer.listingId,
        addonVersionId: offer.addonVersionId,
        offerKind: offer.offerKind,
        status: offer.status,
        commissionBps: offer.commissionBps,
        commercialTermsCode: offer.commercialTermsCode,
        buyerTermsVersion: offer.buyerTermsVersion,
        idempotentReplay: offer.idempotentReplay,
        providerCatalogConfigured,
        paymentGrantsTrust: false,
        purchaseInstallsAddon: false,
        testMode: env.BILLING_MODE !== "live"
      }
    }, 201);
  } catch (error) {
    emitBillingEvent(dependencies.logger, "billing.marketplace_offer_configuration", billingFailureOutcome(error), correlationId);
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleSellerOffer(context.request, context.env);
