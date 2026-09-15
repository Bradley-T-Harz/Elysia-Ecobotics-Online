import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingCheckoutReliabilityEnabled, assertBillingFeatureEnabled, assertBillingMutationEnabled } from "../_shared/config.ts";
import { ensureAccountBillingCustomer } from "../_shared/checkout.ts";
import { attachCheckoutBillingCustomer, attachCheckoutSession, failCheckout, prepareOrganizationServiceCheckout } from "../_shared/database.ts";
import { BillingHttpError, jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse, validatedPublicOrigin } from "../_shared/http.ts";
import { billingFailureOutcome, defaultBillingLogger, emitBillingEvent, type BillingLogger } from "../_shared/observability.ts";
import { organizationServiceCheckoutRequest } from "../_shared/schema.ts";
import { createStripeProvider } from "../_shared/stripe.ts";
import type { AuthenticatedBillingRequest, BillingEnv, BillingProvider, OrganizationServiceCheckoutRequest } from "../_shared/types.ts";

export type OrganizationServiceCheckoutDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  provider(env: BillingEnv): BillingProvider;
  prepare(env: BillingEnv, actorUserId: string, input: OrganizationServiceCheckoutRequest): ReturnType<typeof prepareOrganizationServiceCheckout>;
  attachCustomer?(env: BillingEnv, orderId: string, providerCustomerReference: string): Promise<void>;
  attach(env: BillingEnv, orderId: string, providerSessionId: string, providerCustomerReference: string | null): Promise<void>;
  fail(env: BillingEnv, orderId: string, failureCode: string): Promise<void>;
  logger?: BillingLogger;
};
const defaultDependencies: OrganizationServiceCheckoutDependencies = {
  authenticate: authenticateRequired,
  provider: createStripeProvider,
  prepare: (env, actor, input) => prepareOrganizationServiceCheckout(createEconomicServerClient(env), actor, input),
  attachCustomer: (env, orderId, customer) => attachCheckoutBillingCustomer(createEconomicServerClient(env), orderId, customer),
  attach: (env, orderId, sessionId, customer) => attachCheckoutSession(createEconomicServerClient(env), orderId, sessionId, customer),
  fail: (env, orderId, code) => failCheckout(createEconomicServerClient(env), orderId, code),
  logger: defaultBillingLogger
};
export async function handleOrganizationServiceCheckout(request: Request, env: BillingEnv, dependencies: OrganizationServiceCheckoutDependencies = defaultDependencies): Promise<Response> {
  let correlationId: string | null = null;
  try {
    assertBillingMutationEnabled(env);
    assertBillingFeatureEnabled(env, "BILLING_ORGANIZATION_SERVICES_ENABLED", "organization_services_disabled");
    assertBillingCheckoutReliabilityEnabled(env);
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await organizationServiceCheckoutRequest(request);
    correlationId = input.clientRequestId;
    emitBillingEvent(dependencies.logger, "billing.organization_service_checkout", "attempted", correlationId);
    let preparation = await dependencies.prepare(env, auth.userId, input);
    const origin = validatedPublicOrigin(env);
    const provider = dependencies.provider(env);
    const customerPreparation = await ensureAccountBillingCustomer(
      provider, preparation, auth.userId,
      (orderId, customer) => (dependencies.attachCustomer ?? defaultDependencies.attachCustomer!)(env, orderId, customer),
      (orderId, code) => dependencies.fail(env, orderId, code)
    );
    preparation = { ...preparation, providerCustomerReference: customerPreparation.providerCustomerReference };
    let providerResult;
    try {
      providerResult = await provider.createCheckout({
        ...preparation, flow: "organization_service", accountLinked: true,
        successUrl: `${origin}/commons-circle/support-billing?organization-payment=complete&order=${encodeURIComponent(preparation.publicReference)}`,
        cancelUrl: `${origin}/commons-circle/support-billing?organization-payment=canceled&order=${encodeURIComponent(preparation.publicReference)}`
      });
    } catch (error) {
      await dependencies.fail(env, preparation.orderId, "provider_checkout_creation_failed").catch(() => undefined);
      if (error instanceof BillingHttpError) throw error;
      throw new BillingHttpError(502, "checkout_unavailable");
    }
    await dependencies.attach(env, preparation.orderId, providerResult.providerSessionId, providerResult.providerCustomerReference);
    emitBillingEvent(dependencies.logger, "billing.organization_service_checkout", "succeeded", correlationId);
    return jsonResponse({
      ok: true, checkoutUrl: providerResult.checkoutUrl,
      orderReference: preparation.publicReference,
      engagementId: preparation.engagementId,
      paymentGrantsAuthority: false, testMode: env.BILLING_MODE !== "live"
    }, 201);
  } catch (error) {
    emitBillingEvent(dependencies.logger, "billing.organization_service_checkout", billingFailureOutcome(error), correlationId);
    return safeBillingErrorResponse(error);
  }
}
export const onRequest: PagesFunction<BillingEnv> = (context) => handleOrganizationServiceCheckout(context.request, context.env);
