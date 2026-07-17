import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertBillingMutationEnabled, stripeConnectEnabled } from "../_shared/config.ts";
import { attachSellerProviderAccount, prepareSellerOnboarding } from "../_shared/database.ts";
import { BillingHttpError, jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse, validatedPublicOrigin } from "../_shared/http.ts";
import { billingFailureOutcome, defaultBillingLogger, emitBillingEvent, type BillingLogger } from "../_shared/observability.ts";
import { sellerOnboardingRequest } from "../_shared/schema.ts";
import { createStripeTestProvider } from "../_shared/stripe.ts";
import type { AuthenticatedBillingRequest, BillingEnv, BillingProvider, SellerOnboardingRequest } from "../_shared/types.ts";

export type SellerOnboardingDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  provider(env: BillingEnv): BillingProvider;
  prepare(env: BillingEnv, actorUserId: string, input: SellerOnboardingRequest): ReturnType<typeof prepareSellerOnboarding>;
  attach(env: BillingEnv, sellerAccountId: string, providerAccountReference: string): Promise<void>;
  logger?: BillingLogger;
};

const defaultDependencies: SellerOnboardingDependencies = {
  authenticate: authenticateRequired,
  provider: createStripeTestProvider,
  prepare: (env, actorUserId, input) => prepareSellerOnboarding(createEconomicServerClient(env), actorUserId, input),
  attach: (env, sellerAccountId, providerReference) => attachSellerProviderAccount(createEconomicServerClient(env), sellerAccountId, providerReference),
  logger: defaultBillingLogger
};

export async function handleSellerOnboarding(
  request: Request,
  env: BillingEnv,
  dependencies: SellerOnboardingDependencies = defaultDependencies
): Promise<Response> {
  let correlationId: string | null = null;
  try {
    assertBillingMutationEnabled(env);
    assertBillingFeatureEnabled(env, "BILLING_SELLER_ONBOARDING_ENABLED", "seller_onboarding_disabled");
    if (!stripeConnectEnabled(env)) throw new BillingHttpError(503, "seller_onboarding_disabled");
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const input = await sellerOnboardingRequest(request);
    correlationId = input.clientRequestId;
    emitBillingEvent(dependencies.logger, "billing.seller_onboarding", "attempted", correlationId);
    const auth = await dependencies.authenticate(request, env);
    const preparation = await dependencies.prepare(env, auth.userId, input);
    if (preparation.idempotentReplay) throw new BillingHttpError(409, "seller_onboarding_request_replayed");
    const origin = validatedPublicOrigin(env);
    const returnPath = input.sourceRoute === "/developer-forge/dashboard"
      ? "/developer-forge/dashboard"
      : "/marketplace/account";
    const onboarding = await dependencies.provider(env).createSellerOnboarding({
      ...preparation,
      refreshUrl: `${origin}${returnPath}?seller=refresh`,
      returnUrl: `${origin}${returnPath}?seller=returned`
    });
    if (!preparation.providerAccountReference) {
      await dependencies.attach(env, preparation.sellerAccountId, onboarding.providerAccountReference);
    }
    emitBillingEvent(dependencies.logger, "billing.seller_onboarding", "succeeded", correlationId);
    return jsonResponse({
      ok: true,
      onboardingUrl: onboarding.onboardingUrl,
      provider: "stripe",
      consentRecorded: true,
      paymentGrantsAuthority: false,
      testMode: true
    }, 201);
  } catch (error) {
    emitBillingEvent(dependencies.logger, "billing.seller_onboarding", billingFailureOutcome(error), correlationId);
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleSellerOnboarding(context.request, context.env);
