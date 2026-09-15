import { authenticateRequired } from "./_shared/auth.ts";
import { assertBillingMode } from "./_shared/config.ts";
import { loadCurrentEconomicAccount } from "./_shared/database.ts";
import { jsonResponse, requireGet, safeBillingErrorResponse } from "./_shared/http.ts";
import type { AuthenticatedBillingRequest, BillingEnv } from "./_shared/types.ts";

export type AccountDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  load(auth: AuthenticatedBillingRequest): Promise<unknown>;
};

const defaultDependencies: AccountDependencies = {
  authenticate: authenticateRequired,
  load: (auth) => loadCurrentEconomicAccount(auth.supabase)
};

export async function handleBillingAccount(
  request: Request,
  env: BillingEnv,
  dependencies: AccountDependencies = defaultDependencies
): Promise<Response> {
  try {
    assertBillingMode(env);
    requireGet(request);
    const auth = await dependencies.authenticate(request, env);
    return jsonResponse({ ok: true, account: await dependencies.load(auth) });
  } catch (error) {
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleBillingAccount(context.request, context.env);
