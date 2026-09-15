import { authenticateOptional, authenticateRequired, createEconomicServerClient } from "./auth.ts";
import { assertBillingCheckoutReliabilityEnabled, assertBillingFeatureEnabled, assertBillingMutationEnabled, assertGuestCheckoutAbuseControls } from "./config.ts";
import { attachCheckoutBillingCustomer, attachCheckoutSession, beginCheckout, failCheckout } from "./database.ts";
import { BillingHttpError, jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse, validatedPublicOrigin } from "./http.ts";
import { billingFailureOutcome, defaultBillingLogger, emitBillingEvent, type BillingLogger } from "./observability.ts";
import { oneTimeCheckoutRequest, recurringCheckoutRequest } from "./schema.ts";
import { createStripeProvider } from "./stripe.ts";
import type {
  AuthenticatedBillingRequest,
  BillingEnv,
  BillingProvider,
  CheckoutFlow,
  CheckoutPreparation,
  OneTimeCheckoutRequest,
  RecurringCheckoutRequest
} from "./types.ts";

export async function ensureAccountBillingCustomer(
  provider: BillingProvider,
  preparation: CheckoutPreparation,
  actorUserId: string | null,
  attachCustomer: (orderId: string, providerCustomerReference: string) => Promise<void>,
  fail: (orderId: string, failureCode: string) => Promise<void>
): Promise<CheckoutPreparation> {
  if (!actorUserId || preparation.providerCustomerReference) return preparation;
  let created;
  try {
    created = await provider.ensureCustomer({ idempotencyKey: `billing-customer:${actorUserId}` });
  } catch (error) {
    await fail(preparation.orderId, "provider_customer_creation_failed").catch(() => undefined);
    if (error instanceof BillingHttpError) throw error;
    throw new BillingHttpError(502, "payment_provider_unavailable");
  }
  await attachCustomer(preparation.orderId, created.providerCustomerReference);
  return { ...preparation, providerCustomerReference: created.providerCustomerReference };
}

export type CheckoutDependencies = {
  authenticateOptional(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest | null>;
  authenticateRequired(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  provider(env: BillingEnv): BillingProvider;
  begin(env: BillingEnv, actorUserId: string | null, flow: CheckoutFlow, input: OneTimeCheckoutRequest | RecurringCheckoutRequest): ReturnType<typeof beginCheckout>;
  attachCustomer?(env: BillingEnv, orderId: string, providerCustomerReference: string): Promise<void>;
  attach(env: BillingEnv, orderId: string, providerSessionId: string, providerCustomerReference: string | null): Promise<void>;
  fail(env: BillingEnv, orderId: string, failureCode: string): Promise<void>;
  logger?: BillingLogger;
};

const defaultDependencies: CheckoutDependencies = {
  authenticateOptional,
  authenticateRequired,
  provider: createStripeProvider,
  begin: (env, actorUserId, flow, input) => beginCheckout(createEconomicServerClient(env), actorUserId, flow, input),
  attachCustomer: (env, orderId, customerReference) => attachCheckoutBillingCustomer(createEconomicServerClient(env), orderId, customerReference),
  attach: (env, orderId, sessionId, customerReference) => attachCheckoutSession(createEconomicServerClient(env), orderId, sessionId, customerReference),
  fail: (env, orderId, failureCode) => failCheckout(createEconomicServerClient(env), orderId, failureCode),
  logger: defaultBillingLogger
};

export async function handleCheckout(
  request: Request,
  env: BillingEnv,
  flow: CheckoutFlow,
  dependencies: CheckoutDependencies = defaultDependencies
): Promise<Response> {
  let correlationId: string | null = null;
  try {
    assertBillingMutationEnabled(env);
    assertBillingFeatureEnabled(
      env,
      flow === "support_one_time" ? "BILLING_SUPPORT_CHECKOUT_ENABLED" : "BILLING_RECURRING_ENABLED",
      flow === "support_one_time" ? "support_checkout_disabled" : "recurring_support_disabled"
    );
    if (flow === "support_recurring") {
      // A renewable checkout must never be acquired while its promised online
      // management/cancellation route is disabled in the independent Worker
      // configuration. The database enforces its own portal flag as well.
      assertBillingFeatureEnabled(env, "BILLING_PORTAL_ENABLED", "recurring_support_portal_required");
    }
    assertBillingCheckoutReliabilityEnabled(env);
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const input = flow === "support_one_time"
      ? await oneTimeCheckoutRequest(request)
      : await recurringCheckoutRequest(request);
    correlationId = input.clientRequestId;
    emitBillingEvent(dependencies.logger, "billing.checkout", "attempted", correlationId);
    const auth = flow === "support_one_time"
      ? await dependencies.authenticateOptional(request, env)
      : await dependencies.authenticateRequired(request, env);
    if (flow === "support_one_time" && !auth) assertGuestCheckoutAbuseControls(env);
    const provider = dependencies.provider(env);
    let preparation = await dependencies.begin(env, auth?.userId ?? null, flow, input);
    const origin = validatedPublicOrigin(env);
    preparation = await ensureAccountBillingCustomer(
      provider,
      preparation,
      auth?.userId ?? null,
      (orderId, customerReference) => (dependencies.attachCustomer ?? defaultDependencies.attachCustomer!)(env, orderId, customerReference),
      (orderId, failureCode) => dependencies.fail(env, orderId, failureCode)
    );
    let checkout;
    try {
      checkout = await provider.createCheckout({
        ...preparation,
        flow,
        accountLinked: Boolean(auth),
        successUrl: `${origin}/support/thank-you?order=${encodeURIComponent(preparation.publicReference)}`,
        cancelUrl: `${origin}/support?checkout=canceled`
      });
    } catch (error) {
      await dependencies.fail(env, preparation.orderId, "provider_checkout_creation_failed").catch(() => undefined);
      if (error instanceof BillingHttpError) throw error;
      throw new BillingHttpError(502, "checkout_unavailable");
    }
    await dependencies.attach(env, preparation.orderId, checkout.providerSessionId, checkout.providerCustomerReference);
    emitBillingEvent(dependencies.logger, "billing.checkout", "succeeded", correlationId);
    return jsonResponse({
      ok: true,
      checkoutUrl: checkout.checkoutUrl,
      orderReference: preparation.publicReference
    }, 201);
  } catch (error) {
    emitBillingEvent(dependencies.logger, "billing.checkout", billingFailureOutcome(error), correlationId);
    return safeBillingErrorResponse(error);
  }
}
