import { createEconomicServerClient } from "./_shared/auth.ts";
import { assertBillingFeatureEnabled, assertBillingMode } from "./_shared/config.ts";
import { deliverEconomicNotificationOutbox, processProviderEvent } from "./_shared/database.ts";
import { BillingHttpError, jsonResponse, readBoundedText, safeBillingErrorResponse } from "./_shared/http.ts";
import { billingFailureOutcome, defaultBillingLogger, emitBillingEvent, type BillingLogger } from "./_shared/observability.ts";
import { createStripeProvider } from "./_shared/stripe.ts";
import type { BillingEnv, BillingProvider, NormalizedProviderEvent } from "./_shared/types.ts";

export type WebhookDependencies = {
  provider(env: BillingEnv): BillingProvider;
  process(env: BillingEnv, event: NormalizedProviderEvent): ReturnType<typeof processProviderEvent>;
  deliver?(env: BillingEnv): Promise<unknown>;
  logger?: BillingLogger;
};

const defaultDependencies: WebhookDependencies = {
  provider: createStripeProvider,
  process: (env, event) => processProviderEvent(createEconomicServerClient(env), event),
  deliver: (env) => deliverEconomicNotificationOutbox(createEconomicServerClient(env)),
  logger: defaultBillingLogger
};

export async function handleStripeWebhook(
  request: Request,
  env: BillingEnv,
  dependencies: WebhookDependencies = defaultDependencies
): Promise<Response> {
  let correlationId: string | null = null;
  let terminalLogged = false;
  try {
    assertBillingMode(env);
    assertBillingFeatureEnabled(env, "BILLING_WEBHOOK_FULFILLMENT_ENABLED", "webhook_fulfillment_disabled");
    if (request.method !== "POST") throw new BillingHttpError(405, "method_not_allowed");
    const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (contentType !== "application/json") throw new BillingHttpError(415, "json_required");
    const signature = request.headers.get("stripe-signature");
    if (!signature) throw new BillingHttpError(400, "webhook_signature_invalid");
    const rawBody = await readBoundedText(request, 1_048_576);
    const provider = dependencies.provider(env);
    const event = await provider.verifyAndNormalizeWebhook(rawBody, signature);
    correlationId = event.orderId;
    emitBillingEvent(dependencies.logger, "billing.webhook", "attempted", correlationId);
    const status = await dependencies.process(env, event);
    if (status === "retry") {
      emitBillingEvent(dependencies.logger, "billing.webhook", "retry", correlationId);
      terminalLogged = true;
      throw new BillingHttpError(503, "webhook_processing_unavailable");
    }
    // Commit signed payment truth before fetching optional settlement evidence.
    // A failed enrichment returns retry; the next delivery deduplicates the
    // payment and appends any newly available receipt/settlement facts.
    if (provider.enrichVerifiedEvent && status !== "ignored") {
      const enriched = await provider.enrichVerifiedEvent(event);
      if (enriched.providerReceiptUrl || enriched.processorFeeMinor != null) {
        if (await dependencies.process(env, enriched) === "retry") throw new BillingHttpError(503, "webhook_settlement_retry_required");
      }
    }
    // Signal Console notifications are a convenience projection, never payment
    // truth. Scheduled reconciliation retries a failed drain; this failure must
    // not turn a committed provider event into a false webhook failure.
    if (status === "processed") await dependencies.deliver?.(env).catch(() => undefined);
    emitBillingEvent(
      dependencies.logger,
      "billing.webhook",
      status === "duplicate" ? "replayed" : status === "ignored" ? "ignored" : "succeeded",
      correlationId
    );
    terminalLogged = true;
    return jsonResponse({ ok: true, received: true });
  } catch (error) {
    if (!terminalLogged) emitBillingEvent(dependencies.logger, "billing.webhook", billingFailureOutcome(error), correlationId);
    return safeBillingErrorResponse(error);
  }
}

export const onRequest: PagesFunction<BillingEnv> = (context) => handleStripeWebhook(context.request, context.env);
