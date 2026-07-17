import { createEconomicPublicClient } from "../_shared/auth.ts";
import { assertTestOnlyBillingMode } from "../_shared/config.ts";
import { loadMarketplaceOfferCatalog } from "../_shared/database.ts";
import { jsonResponse, requireGet, safeBillingErrorResponse } from "../_shared/http.ts";
import type { BillingEnv } from "../_shared/types.ts";

export type MarketplaceCatalogDependencies = {
  load(env: BillingEnv): ReturnType<typeof loadMarketplaceOfferCatalog>;
};

const defaultDependencies: MarketplaceCatalogDependencies = {
  load: (env) => loadMarketplaceOfferCatalog(createEconomicPublicClient(env))
};

export async function handleMarketplaceCatalog(
  request: Request,
  env: BillingEnv,
  dependencies: MarketplaceCatalogDependencies = defaultDependencies
): Promise<Response> {
  try {
    requireGet(request);
    if (env.BILLING_MARKETPLACE_COMMERCE_ENABLED !== "true") {
      return jsonResponse({ ok: true, catalog: { available: false, offers: [], testMode: true } });
    }
    assertTestOnlyBillingMode(env);
    const offers = await dependencies.load(env);
    const visibleOffers = env.BILLING_ENABLED === "true"
      ? offers
      : offers.filter((offer) => offer.offerKind === "free");
    return jsonResponse({ ok: true, catalog: { available: true, offers: visibleOffers, testMode: true } });
  } catch (error) {
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleMarketplaceCatalog(context.request, context.env);
