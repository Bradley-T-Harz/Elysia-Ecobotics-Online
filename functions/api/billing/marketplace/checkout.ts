import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingCheckoutReliabilityEnabled, assertBillingFeatureEnabled, assertBillingMutationEnabled } from "../_shared/config.ts";
import { ensureAccountBillingCustomer } from "../_shared/checkout.ts";
import { attachCheckoutBillingCustomer, attachCheckoutSession, failCheckout, prepareMarketplaceCheckout } from "../_shared/database.ts";
import { BillingHttpError, jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse, validatedPublicOrigin } from "../_shared/http.ts";
import { billingFailureOutcome, defaultBillingLogger, emitBillingEvent, type BillingLogger } from "../_shared/observability.ts";
import { marketplacePurchaseRequest } from "../_shared/schema.ts";
import { createStripeTestProvider } from "../_shared/stripe.ts";
import type { AuthenticatedBillingRequest, BillingEnv, BillingProvider, MarketplacePurchaseRequest } from "../_shared/types.ts";

export type MarketplaceCheckoutDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  provider(env: BillingEnv): BillingProvider;
  prepare(env: BillingEnv, actorUserId: string, input: MarketplacePurchaseRequest): ReturnType<typeof prepareMarketplaceCheckout>;
  attachCustomer?(env: BillingEnv, orderId: string, providerCustomerReference: string): Promise<void>;
  attach(env: BillingEnv, orderId: string, providerSessionId: string, providerCustomerReference: string | null): Promise<void>;
  fail(env: BillingEnv, orderId: string, failureCode: string): Promise<void>;
  logger?: BillingLogger;
};

const defaultDependencies: MarketplaceCheckoutDependencies = {
  authenticate: authenticateRequired,
  provider: createStripeTestProvider,
  prepare: (env, actorUserId, input) => prepareMarketplaceCheckout(createEconomicServerClient(env), actorUserId, input),
  attachCustomer: (env, orderId, customerReference) => attachCheckoutBillingCustomer(createEconomicServerClient(env), orderId, customerReference),
  attach: (env, orderId, sessionId, customerReference) => attachCheckoutSession(createEconomicServerClient(env), orderId, sessionId, customerReference),
  fail: (env, orderId, failureCode) => failCheckout(createEconomicServerClient(env), orderId, failureCode),
  logger: defaultBillingLogger
};

export async function handleMarketplaceCheckout(
  request: Request,
  env: BillingEnv,
  dependencies: MarketplaceCheckoutDependencies = defaultDependencies
): Promise<Response> {
  let correlationId: string | null = null;
  try {
    assertBillingMutationEnabled(env);
    assertBillingFeatureEnabled(env, "BILLING_MARKETPLACE_COMMERCE_ENABLED", "marketplace_commerce_disabled");
    assertBillingCheckoutReliabilityEnabled(env);
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const input = await marketplacePurchaseRequest(request);
    correlationId = input.clientRequestId;
    emitBillingEvent(dependencies.logger, "billing.marketplace_checkout", "attempted", correlationId);
    const auth = await dependencies.authenticate(request, env);
    let preparation = await dependencies.prepare(env, auth.userId, input);
    if (preparation.alreadyOwned) {
      emitBillingEvent(dependencies.logger, "billing.marketplace_checkout", "replayed", correlationId);
      return jsonResponse({
        ok: true,
        alreadyOwned: true,
        license: {
          licenseId: preparation.licenseId,
          offerId: preparation.offerId,
          listingId: preparation.listingId,
          addonVersionId: preparation.addonVersionId,
          economicStatus: preparation.economicStatus,
          installAuthorized: false,
          paymentGrantsAuthority: false
        },
        testMode: true
      });
    }
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
    let providerResult;
    try {
      providerResult = await provider.createCheckout({
        ...preparation,
        flow: "marketplace_purchase",
        accountLinked: true,
        successUrl: `${origin}/marketplace/account?commerce=success&reference=${encodeURIComponent(preparation.publicReference)}`,
        cancelUrl: `${origin}/marketplace/account?commerce=canceled&reference=${encodeURIComponent(preparation.publicReference)}`
      });
    } catch (error) {
      await dependencies.fail(env, preparation.orderId, "provider_checkout_creation_failed").catch(() => undefined);
      if (error instanceof BillingHttpError) throw error;
      throw new BillingHttpError(502, "checkout_unavailable");
    }
    await dependencies.attach(env, preparation.orderId, providerResult.providerSessionId, providerResult.providerCustomerReference);
    emitBillingEvent(dependencies.logger, "billing.marketplace_checkout", "succeeded", correlationId);
    return jsonResponse({
      ok: true,
      alreadyOwned: false,
      checkoutUrl: providerResult.checkoutUrl,
      orderReference: preparation.publicReference,
      license: {
        offerId: preparation.offerId,
        listingId: preparation.listingId,
        addonVersionId: preparation.addonVersionId,
        licenseKey: preparation.licenseKey,
        licenseVersion: preparation.licenseVersion,
        installAuthorized: false,
        paymentGrantsAuthority: false
      },
      testMode: true
    }, 201);
  } catch (error) {
    emitBillingEvent(dependencies.logger, "billing.marketplace_checkout", billingFailureOutcome(error), correlationId);
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleMarketplaceCheckout(context.request, context.env);
