import { authenticateRequired } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertBillingMode } from "../_shared/config.ts";
import { loadCurrentEconomicClosureReadiness } from "../_shared/database.ts";
import { jsonResponse, requireGet, safeBillingErrorResponse } from "../_shared/http.ts";
import type { AuthenticatedBillingRequest, BillingEnv } from "../_shared/types.ts";

export type EconomicClosureReadinessDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  load(auth: AuthenticatedBillingRequest): ReturnType<typeof loadCurrentEconomicClosureReadiness>;
};

const defaultDependencies: EconomicClosureReadinessDependencies = {
  authenticate: authenticateRequired,
  load: (auth) => loadCurrentEconomicClosureReadiness(auth.supabase)
};

export async function handleEconomicClosureReadiness(
  request: Request,
  env: BillingEnv,
  dependencies: EconomicClosureReadinessDependencies = defaultDependencies
): Promise<Response> {
  try {
    assertBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_ACCOUNT_LIFECYCLE_ENABLED", "economic_account_lifecycle_disabled");
    requireGet(request);
    const auth = await dependencies.authenticate(request, env);
    return jsonResponse({ ok: true, closureReadiness: await dependencies.load(auth) });
  } catch (error) {
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleEconomicClosureReadiness(context.request, context.env);
