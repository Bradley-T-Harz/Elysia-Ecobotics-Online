import { authenticateRequired } from "../_shared/auth.ts";
import { assertBillingMode } from "../_shared/config.ts";
import { assertEconomicResponseSize, loadCurrentEconomicOperatorOverview } from "../_shared/database.ts";
import { jsonResponse, requireGet, safeBillingErrorResponse } from "../_shared/http.ts";
import type { AuthenticatedBillingRequest, BillingEnv } from "../_shared/types.ts";

export type OperatorOverviewDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  load(auth: AuthenticatedBillingRequest): ReturnType<typeof loadCurrentEconomicOperatorOverview>;
};

const defaultDependencies: OperatorOverviewDependencies = {
  authenticate: authenticateRequired,
  load: (auth) => loadCurrentEconomicOperatorOverview(auth.supabase)
};

export async function handleOperatorOverview(
  request: Request,
  env: BillingEnv,
  dependencies: OperatorOverviewDependencies = defaultDependencies
): Promise<Response> {
  try {
    assertBillingMode(env);
    requireGet(request);
    const auth = await dependencies.authenticate(request, env);
    const operator = await dependencies.load(auth);
    // Keep the fully privileged multi-queue response within the same 128 KiB
    // contract enforced by the browser client.
    const response = { ok: true, operator };
    assertEconomicResponseSize(response);
    return jsonResponse(response);
  } catch (error) {
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorOverview(context.request, context.env);
