import { authenticateRequired, createEconomicServerClient } from "../_shared/auth.ts";
import { assertBillingFeatureEnabled, assertBillingMutationEnabled } from "../_shared/config.ts";
import { linkMarketplacePublisher } from "../_shared/database.ts";
import { jsonResponse, requireJsonPost, requireSameOriginMutation, safeBillingErrorResponse } from "../_shared/http.ts";
import { billingFailureOutcome, defaultBillingLogger, emitBillingEvent, type BillingLogger } from "../_shared/observability.ts";
import { marketplacePublisherLinkRequest } from "../_shared/schema.ts";
import type { AuthenticatedBillingRequest, BillingEnv, MarketplacePublisherLinkRequest } from "../_shared/types.ts";

export type SellerPublisherLinkDependencies = {
  authenticate(request: Request, env: BillingEnv): Promise<AuthenticatedBillingRequest>;
  link(env: BillingEnv, actorUserId: string, input: MarketplacePublisherLinkRequest): ReturnType<typeof linkMarketplacePublisher>;
  logger?: BillingLogger;
};

const defaultDependencies: SellerPublisherLinkDependencies = {
  authenticate: authenticateRequired,
  link: (env, actorUserId, input) => linkMarketplacePublisher(createEconomicServerClient(env), actorUserId, input),
  logger: defaultBillingLogger
};

export async function handleSellerPublisherLink(
  request: Request,
  env: BillingEnv,
  dependencies: SellerPublisherLinkDependencies = defaultDependencies
): Promise<Response> {
  let correlationId: string | null = null;
  try {
    requireSameOriginMutation(request, env);
    requireJsonPost(request);
    const input = await marketplacePublisherLinkRequest(request);
    correlationId = input.clientRequestId;
    emitBillingEvent(dependencies.logger, "billing.marketplace_publisher_link", "attempted", correlationId);
    const auth = await dependencies.authenticate(request, env);
    const result = await dependencies.link(env, auth.userId, input);
    emitBillingEvent(dependencies.logger, "billing.marketplace_publisher_link", result.idempotentReplay ? "replayed" : "succeeded", correlationId);
    return jsonResponse({ ok: true, publisherLink: result });
  } catch (error) {
    emitBillingEvent(dependencies.logger, "billing.marketplace_publisher_link", billingFailureOutcome(error), correlationId);
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleSellerPublisherLink(context.request, context.env);
