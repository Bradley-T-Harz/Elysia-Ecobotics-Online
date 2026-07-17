import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertTestOnlyBillingMode } from "../_shared/config.ts";
import { exportOperatorEconomicAccounting } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { operatorAccountingExportRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, OperatorAccountingExportRequest } from "../_shared/types.ts";

export type OperatorAccountingExportDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  load(env: BillingEnv, actorUserId: string, input: OperatorAccountingExportRequest): ReturnType<typeof exportOperatorEconomicAccounting>;
};

const defaultDependencies: OperatorAccountingExportDependencies = {
  authenticate: authenticateRequired,
  load: (env, actor, input) => exportOperatorEconomicAccounting(createEconomicServerClient(env), actor, input)
};

export async function handleOperatorAccountingExport(
  request: Request,
  env: BillingEnv,
  dependencies: OperatorAccountingExportDependencies = defaultDependencies
): Promise<Response> {
  try {
    assertTestOnlyBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_ACCOUNTING_EXPORT_ENABLED", "economic_accounting_export_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await operatorAccountingExportRequest(request);
    return jsonResponse({ ok: true, accountingExport: await dependencies.load(env, auth.userId, input) });
  } catch (error) {
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleOperatorAccountingExport(context.request, context.env);
