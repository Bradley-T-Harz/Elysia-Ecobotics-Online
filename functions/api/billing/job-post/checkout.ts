import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingCheckoutReliabilityEnabled, assertBillingFeatureEnabled, assertBillingMutationEnabled } from "../_shared/config.ts";
import { ensureAccountBillingCustomer } from "../_shared/checkout.ts";
import { attachCheckoutBillingCustomer, attachCheckoutSession, failCheckout, prepareJobPostCheckout } from "../_shared/database.ts";
import { BillingHttpError, jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse, validatedPublicOrigin } from "../_shared/http.ts";
import { billingFailureOutcome, defaultBillingLogger, emitBillingEvent, type BillingLogger } from "../_shared/observability.ts";
import { jobPostCheckoutRequest } from "../_shared/schema.ts";
import { createStripeProvider } from "../_shared/stripe.ts";
import type { AuthenticatedBillingRequest, BillingEnv, BillingProvider, JobPostCheckoutRequest } from "../_shared/types.ts";

export type JobPostCheckoutDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  provider(env: BillingEnv): BillingProvider;
  prepare(env: BillingEnv, actorUserId: string, input: JobPostCheckoutRequest): ReturnType<typeof prepareJobPostCheckout>;
  attachCustomer?(env: BillingEnv, orderId: string, providerCustomerReference: string): Promise<void>;
  attach(env: BillingEnv, orderId: string, providerSessionId: string, providerCustomerReference: string | null): Promise<void>;
  fail(env: BillingEnv, orderId: string, failureCode: string): Promise<void>;
  logger?: BillingLogger;
};

const defaultDependencies: JobPostCheckoutDependencies = {
  authenticate: authenticateRequired,
  provider: createStripeProvider,
  prepare: (env, actorUserId, input) => prepareJobPostCheckout(createEconomicServerClient(env), actorUserId, input),
  attachCustomer: (env, orderId, customerReference) => attachCheckoutBillingCustomer(
    createEconomicServerClient(env), orderId, customerReference
  ),
  attach: (env, orderId, sessionId, customerReference) => attachCheckoutSession(
    createEconomicServerClient(env), orderId, sessionId, customerReference
  ),
  fail: (env, orderId, failureCode) => failCheckout(createEconomicServerClient(env), orderId, failureCode),
  logger: defaultBillingLogger
};

export async function handleJobPostCheckout(
  request: Request,
  env: BillingEnv,
  dependencies: JobPostCheckoutDependencies = defaultDependencies
): Promise<Response> {
  let correlationId: string | null = null;
  try {
    assertBillingMutationEnabled(env);
    assertBillingFeatureEnabled(env, "BILLING_JOB_POST_FEES_ENABLED", "job_post_fees_disabled");
    assertBillingCheckoutReliabilityEnabled(env);
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const auth = await dependencies.authenticate(request, env);
    const input = await jobPostCheckoutRequest(request);
    correlationId = input.clientRequestId;
    emitBillingEvent(dependencies.logger, "billing.job_post_checkout", "attempted", correlationId);
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
        flow: "job_post_fee",
        accountLinked: true,
        successUrl: `${origin}/commune/posts/${encodeURIComponent(preparation.postId)}?job-payment=complete&order=${encodeURIComponent(preparation.publicReference)}`,
        cancelUrl: `${origin}/commune/posts/${encodeURIComponent(preparation.postId)}?job-payment=canceled&order=${encodeURIComponent(preparation.publicReference)}`
      });
    } catch (error) {
      await dependencies.fail(env, preparation.orderId, "provider_checkout_creation_failed").catch(() => undefined);
      if (error instanceof BillingHttpError) throw error;
      throw new BillingHttpError(502, "checkout_unavailable");
    }
    await dependencies.attach(env, preparation.orderId, checkout.providerSessionId, checkout.providerCustomerReference);
    emitBillingEvent(dependencies.logger, "billing.job_post_checkout", "succeeded", correlationId);
    return jsonResponse({
      ok: true,
      checkoutUrl: checkout.checkoutUrl,
      orderReference: preparation.publicReference,
      jobPostId: preparation.jobPostId,
      postId: preparation.postId
    }, 201);
  } catch (error) {
    emitBillingEvent(dependencies.logger, "billing.job_post_checkout", billingFailureOutcome(error), correlationId);
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleJobPostCheckout(context.request, context.env);
