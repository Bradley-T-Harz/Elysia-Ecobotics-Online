import { authenticateRequired } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertTestOnlyBillingMode } from "../_shared/config.ts";
import { loadCurrentSellerStatus } from "../_shared/database.ts";
import { jsonResponse, requireGet, safeBillingErrorResponse } from "../_shared/http.ts";
import type { AuthenticatedBillingRequest, BillingEnv } from "../_shared/types.ts";

export type SellerStatusDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  loadSafe(auth: AuthenticatedBillingRequest): ReturnType<typeof loadCurrentSellerStatus>;
};

const defaultDependencies: SellerStatusDependencies = {
  authenticate: authenticateRequired,
  loadSafe: (auth) => loadCurrentSellerStatus(auth.supabase)
};

export async function handleSellerStatus(
  request: Request,
  env: BillingEnv,
  dependencies: SellerStatusDependencies = defaultDependencies
): Promise<Response> {
  try {
    requireGet(request);
    const auth = await dependencies.authenticate(request, env);
    return jsonResponse({ ok: true, seller: await dependencies.loadSafe(auth) });
  } catch (error) {
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleSellerStatus(context.request, context.env);
