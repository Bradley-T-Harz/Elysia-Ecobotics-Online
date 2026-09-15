import { authenticateRequired } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertTestOnlyBillingMode } from "../_shared/config.ts";
import { loadCurrentMarketplacePurchases } from "../_shared/database.ts";
import { jsonResponse, requireGet, safeBillingErrorResponse } from "../_shared/http.ts";
import type { AuthenticatedBillingRequest, BillingEnv } from "../_shared/types.ts";

export type MarketplacePurchasesDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  load(auth: AuthenticatedBillingRequest): ReturnType<typeof loadCurrentMarketplacePurchases>;
};

const defaultDependencies: MarketplacePurchasesDependencies = {
  authenticate: authenticateRequired,
  load: (auth) => loadCurrentMarketplacePurchases(auth.supabase)
};

export async function handleMarketplacePurchases(
  request: Request,
  env: BillingEnv,
  dependencies: MarketplacePurchasesDependencies = defaultDependencies
): Promise<Response> {
  try {
    requireGet(request);
    const auth = await dependencies.authenticate(request, env);
    return jsonResponse({ ok: true, ...(await dependencies.load(auth)) });
  } catch (error) {
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleMarketplacePurchases(context.request, context.env);
