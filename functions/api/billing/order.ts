import { authenticateOptional, createEconomicServerClient } from "./_shared/auth.ts";
import { assertTestOnlyBillingMode } from "./_shared/config.ts";
import { lookupOrderStatus } from "./_shared/database.ts";
import { jsonResponse, requireGet, safeBillingErrorResponse } from "./_shared/http.ts";
import { orderPublicReference } from "./_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv } from "./_shared/types.ts";

export type OrderDependencies = {
  authenticateOptional(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest | null>;
  lookup(env: BillingEnv, publicReference: string, actorUserId: string | null): Promise<unknown>;
};

const defaultDependencies: OrderDependencies = {
  authenticateOptional,
  lookup: (env, publicReference, actorUserId) => lookupOrderStatus(createEconomicServerClient(env), publicReference, actorUserId)
};

export async function handleOrderStatus(
  request: Request,
  env: BillingEnv,
  dependencies: OrderDependencies = defaultDependencies
): Promise<Response> {
  try {
    assertTestOnlyBillingMode(env);
    requireGet(request);
    const reference = orderPublicReference(request);
    const auth = await dependencies.authenticateOptional(request, env);
    return jsonResponse({ ok: true, order: await dependencies.lookup(env, reference, auth?.userId ?? null) });
  } catch (error) {
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleOrderStatus(context.request, context.env);
