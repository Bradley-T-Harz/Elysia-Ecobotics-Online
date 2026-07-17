import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertBillingMutationEnabled, stripeConnectEnabled } from "../_shared/config.ts";
import { loadCurrentSellerStatus, loadSellerProviderContext, recordSellerProviderStatus } from "../_shared/database.ts";
import { BillingHttpError, jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { billingFailureOutcome, defaultBillingLogger, emitBillingEvent, type BillingLogger } from "../_shared/observability.ts";
import { portalRequest } from "../_shared/schema.ts";
import { createStripeTestProvider } from "../_shared/stripe.ts";
import type { AuthenticatedBillingRequest, BillingEnv, BillingProvider } from "../_shared/types.ts";

export type SellerStatusRefreshDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  provider(env: BillingEnv): BillingProvider;
  loadProviderContext(env: BillingEnv, actorUserId: string, clientRequestId: string): ReturnType<typeof loadSellerProviderContext>;
  record(env: BillingEnv, sellerAccountId: string, clientRequestId: string, providerStatus: Awaited<ReturnType<BillingProvider["retrieveSellerStatus"]>>): Promise<void>;
  loadSafe(auth: AuthenticatedBillingRequest): ReturnType<typeof loadCurrentSellerStatus>;
  logger?: BillingLogger;
};

const defaultDependencies: SellerStatusRefreshDependencies = {
  authenticate: authenticateRequired,
  provider: createStripeTestProvider,
  loadProviderContext: (env, actorUserId, clientRequestId) => loadSellerProviderContext(createEconomicServerClient(env), actorUserId, clientRequestId),
  record: (env, sellerAccountId, clientRequestId, status) => recordSellerProviderStatus(createEconomicServerClient(env), sellerAccountId, clientRequestId, status),
  loadSafe: (auth) => loadCurrentSellerStatus(auth.supabase),
  logger: defaultBillingLogger
};

export async function handleSellerStatusRefresh(
  request: Request,
  env: BillingEnv,
  dependencies: SellerStatusRefreshDependencies = defaultDependencies
): Promise<Response> {
  let correlationId: string | null = null;
  try {
    assertBillingMutationEnabled(env);
    assertBillingFeatureEnabled(env, "BILLING_SELLER_ONBOARDING_ENABLED", "seller_onboarding_disabled");
    if (!stripeConnectEnabled(env)) throw new BillingHttpError(503, "seller_onboarding_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const input = await portalRequest(request);
    correlationId = input.clientRequestId;
    emitBillingEvent(dependencies.logger, "billing.seller_status_refresh", "attempted", correlationId);
    const auth = await dependencies.authenticate(request, env);
    const context = await dependencies.loadProviderContext(env, auth.userId, input.clientRequestId);
    if (!context.providerAccountReference) throw new BillingHttpError(409, "seller_onboarding_incomplete");
    if (context.idempotentReplay) {
      const seller = await dependencies.loadSafe(auth);
      emitBillingEvent(dependencies.logger, "billing.seller_status_refresh", "succeeded", correlationId);
      return jsonResponse({ ok: true, seller });
    }
    const providerStatus = await dependencies.provider(env).retrieveSellerStatus(context.providerAccountReference);
    await dependencies.record(env, context.sellerAccountId, input.clientRequestId, providerStatus);
    const seller = await dependencies.loadSafe(auth);
    emitBillingEvent(dependencies.logger, "billing.seller_status_refresh", "succeeded", correlationId);
    return jsonResponse({ ok: true, seller });
  } catch (error) {
    emitBillingEvent(dependencies.logger, "billing.seller_status_refresh", billingFailureOutcome(error), correlationId);
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleSellerStatusRefresh(context.request, context.env);
