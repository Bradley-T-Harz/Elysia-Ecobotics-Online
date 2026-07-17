import { createEconomicPublicClient } from "../_shared/auth.ts";
import { assertTestOnlyBillingMode } from "../_shared/config.ts";
import { loadSandboxCreditPackCatalog } from "../_shared/database.ts";
import { jsonResponse, requireGet, safeBillingErrorResponse } from "../_shared/http.ts";
import type { BillingEnv } from "../_shared/types.ts";

export type SandboxCreditCatalogDependencies = {
  load(env: BillingEnv): ReturnType<typeof loadSandboxCreditPackCatalog>;
};

const defaultDependencies: SandboxCreditCatalogDependencies = {
  load: (env) => loadSandboxCreditPackCatalog(createEconomicPublicClient(env))
};

export async function handleSandboxCreditCatalog(
  request: Request,
  env: BillingEnv,
  dependencies: SandboxCreditCatalogDependencies = defaultDependencies
): Promise<Response> {
  try {
    assertTestOnlyBillingMode(env);
    requireGet(request);
    if (env.BILLING_ENABLED !== "true" || env.BILLING_SANDBOX_PURCHASES_ENABLED !== "true") {
      return jsonResponse({ ok: true, catalog: { available: false, packs: [], testMode: true } });
    }
    const catalog = await dependencies.load(env);
    return jsonResponse({ ok: true, catalog });
  } catch (error) {
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleSandboxCreditCatalog(context.request, context.env);
