import { authenticateRequired } from "../_shared/auth.ts";
import { assertBillingMode } from "../_shared/config.ts";
import { loadCurrentEconomicOrganizations } from "../_shared/database.ts";
import { jsonResponse, requireGet, safeBillingErrorResponse } from "../_shared/http.ts";
import type { AuthenticatedBillingRequest, BillingEnv } from "../_shared/types.ts";

export type EconomicOrganizationStatusDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  load(auth: AuthenticatedBillingRequest): ReturnType<typeof loadCurrentEconomicOrganizations>;
};

const defaultDependencies: EconomicOrganizationStatusDependencies = {
  authenticate: authenticateRequired,
  load: (auth) => loadCurrentEconomicOrganizations(auth.supabase)
};

export async function handleEconomicOrganizationStatus(
  request: Request,
  env: BillingEnv,
  dependencies: EconomicOrganizationStatusDependencies = defaultDependencies
): Promise<Response> {
  try {
    assertBillingMode(env);
    requireGet(request);
    const auth = await dependencies.authenticate(request, env);
    return jsonResponse({ ok: true, status: await dependencies.load(auth) });
  } catch (error) {
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleEconomicOrganizationStatus(context.request, context.env);
