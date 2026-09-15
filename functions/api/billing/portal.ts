import { authenticateRequired, createEconomicServerClient } from "./_shared/auth.ts";
import { assertBillingFeatureEnabled, assertBillingMode } from "./_shared/config.ts";
import { prepareCustomerPortal, recordPortalSession } from "./_shared/database.ts";
import { BillingHttpError, jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse, validatedPublicOrigin } from "./_shared/http.ts";
import { billingFailureOutcome, defaultBillingLogger, emitBillingEvent, type BillingLogger } from "./_shared/observability.ts";
import { portalRequest } from "./_shared/schema.ts";
import { createStripeProvider } from "./_shared/stripe.ts";
import type { AuthenticatedBillingRequest, BillingEnv, BillingProvider } from "./_shared/types.ts";

export type PortalDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  provider(env: BillingEnv): BillingProvider;
  prepare(env: BillingEnv, actorUserId: string, clientRequestId: string): ReturnType<typeof prepareCustomerPortal>;
  record(env: BillingEnv, portalRequestId: string, billingCustomerId: string, providerSessionId: string): Promise<void>;
  logger?: BillingLogger;
};

const defaultDependencies: PortalDependencies = {
  authenticate: authenticateRequired,
  provider: createStripeProvider,
  prepare: (env, actorUserId, clientRequestId) => prepareCustomerPortal(createEconomicServerClient(env), actorUserId, clientRequestId),
  record: (env, portalRequestId, billingCustomerId, providerSessionId) => recordPortalSession(
    createEconomicServerClient(env),
    portalRequestId,
    billingCustomerId,
    providerSessionId
  ),
  logger: defaultBillingLogger
};

export async function handleCustomerPortal(
  request: Request,
  env: BillingEnv,
  dependencies: PortalDependencies = defaultDependencies
): Promise<Response> {
  let correlationId: string | null = null;
  try {
    // Customer cancellation/management is not a new acquisition. It remains
    // available when BILLING_ENABLED disables checkout creation.
    assertBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_PORTAL_ENABLED", "billing_portal_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const input = await portalRequest(request);
    correlationId = input.clientRequestId;
    emitBillingEvent(dependencies.logger, "billing.customer_portal", "attempted", correlationId);
    const auth = await dependencies.authenticate(request, env);
    const preparation = await dependencies.prepare(env, auth.userId, input.clientRequestId);
    if (preparation.idempotentReplay) throw new BillingHttpError(409, "billing_portal_request_replayed");
    const portal = await dependencies.provider(env).createCustomerPortalSession({
      providerCustomerReference: preparation.providerCustomerReference,
      idempotencyKey: `portal:${input.clientRequestId}`,
      returnUrl: `${validatedPublicOrigin(env)}/commons-circle/support-billing`
    });
    await dependencies.record(env, preparation.portalRequestId, preparation.billingCustomerId, portal.providerSessionId);
    emitBillingEvent(dependencies.logger, "billing.customer_portal", "succeeded", correlationId);
    return jsonResponse({ ok: true, portalUrl: portal.portalUrl }, 201);
  } catch (error) {
    emitBillingEvent(dependencies.logger, "billing.customer_portal", billingFailureOutcome(error), correlationId);
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleCustomerPortal(context.request, context.env);
