import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingCheckoutReliabilityEnabled, assertBillingFeatureEnabled, assertBillingMutationEnabled } from "../_shared/config.ts";
import { ensureAccountBillingCustomer } from "../_shared/checkout.ts";
import { attachCheckoutBillingCustomer, attachCheckoutSession, failCheckout, prepareSandboxCreditCheckout } from "../_shared/database.ts";
import { BillingHttpError, jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse, validatedPublicOrigin } from "../_shared/http.ts";
import { billingFailureOutcome, defaultBillingLogger, emitBillingEvent, type BillingLogger } from "../_shared/observability.ts";
import { sandboxCreditCheckoutRequest } from "../_shared/schema.ts";
import { createStripeTestProvider } from "../_shared/stripe.ts";
import type { AuthenticatedBillingRequest, BillingEnv, BillingProvider, SandboxCreditCheckoutRequest } from "../_shared/types.ts";

export type SandboxCreditCheckoutDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  provider(env: BillingEnv): BillingProvider;
  prepare(env: BillingEnv, actorUserId: string, input: SandboxCreditCheckoutRequest): ReturnType<typeof prepareSandboxCreditCheckout>;
  attachCustomer?(env: BillingEnv, orderId: string, providerCustomerReference: string): Promise<void>;
  attach(env: BillingEnv, orderId: string, providerSessionId: string, providerCustomerReference: string | null): Promise<void>;
  fail(env: BillingEnv, orderId: string, failureCode: string): Promise<void>;
  logger?: BillingLogger;
};

const defaultDependencies: SandboxCreditCheckoutDependencies = {
  authenticate: authenticateRequired,
  provider: createStripeTestProvider,
  prepare: (env, actorUserId, input) => prepareSandboxCreditCheckout(createEconomicServerClient(env), actorUserId, input),
  attachCustomer: (env, orderId, customerReference) => attachCheckoutBillingCustomer(
    createEconomicServerClient(env), orderId, customerReference
  ),
  attach: (env, orderId, sessionId, customerReference) => attachCheckoutSession(
    createEconomicServerClient(env), orderId, sessionId, customerReference
  ),
  fail: (env, orderId, failureCode) => failCheckout(createEconomicServerClient(env), orderId, failureCode),
  logger: defaultBillingLogger
};

export async function handleSandboxCreditCheckout(
  request: Request,
  env: BillingEnv,
  dependencies: SandboxCreditCheckoutDependencies = defaultDependencies
): Promise<Response> {
  let correlationId: string | null = null;
  try {
    assertBillingMutationEnabled(env);
    assertBillingFeatureEnabled(env, "BILLING_SANDBOX_PURCHASES_ENABLED", "sandbox_credit_purchase_disabled");
    assertBillingCheckoutReliabilityEnabled(env);
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await sandboxCreditCheckoutRequest(request);
    correlationId = input.clientRequestId;
    emitBillingEvent(dependencies.logger, "billing.sandbox_credit_checkout", "attempted", correlationId);
    let preparation = await dependencies.prepare(env, auth.userId, input);
    const origin = validatedPublicOrigin(env);
    const provider = dependencies.provider(env);
    const customerPreparation = await ensureAccountBillingCustomer(
      provider,
      preparation,
      auth.userId,
      (orderId, customerReference) => (dependencies.attachCustomer ?? defaultDependencies.attachCustomer!)(env, orderId, customerReference),
      (orderId, failureCode) => dependencies.fail(env, orderId, failureCode)
    );
    preparation = { ...preparation, providerCustomerReference: customerPreparation.providerCustomerReference };
    let checkout;
    try {
      checkout = await provider.createCheckout({
        ...preparation,
        flow: "sandbox_credits",
        accountLinked: true,
        successUrl: `${origin}/commons-circle/support-billing?sandbox-payment=complete&order=${encodeURIComponent(preparation.publicReference)}`,
        cancelUrl: `${origin}/commons-circle/support-billing?sandbox-payment=canceled&order=${encodeURIComponent(preparation.publicReference)}`
      });
    } catch (error) {
      await dependencies.fail(env, preparation.orderId, "provider_checkout_creation_failed").catch(() => undefined);
      if (error instanceof BillingHttpError) throw error;
      throw new BillingHttpError(502, "checkout_unavailable");
    }
    await dependencies.attach(env, preparation.orderId, checkout.providerSessionId, checkout.providerCustomerReference);
    emitBillingEvent(dependencies.logger, "billing.sandbox_credit_checkout", "succeeded", correlationId);
    return jsonResponse({
      ok: true,
      checkoutUrl: checkout.checkoutUrl,
      orderReference: preparation.publicReference,
      pack: {
        code: preparation.packCode,
        grantedUnits: preparation.grantedUnits,
        expiresAfterDays: preparation.expiresAfterDays,
        changesSafetyPrivileges: false,
        testMode: true
      }
    }, 201);
  } catch (error) {
    emitBillingEvent(dependencies.logger, "billing.sandbox_credit_checkout", billingFailureOutcome(error), correlationId);
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleSandboxCreditCheckout(context.request, context.env);
