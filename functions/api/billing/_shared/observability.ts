import { BillingHttpError } from "./http.ts";

export type BillingEventName =
  | "billing.checkout"
  | "billing.job_post_checkout"
  | "billing.sandbox_credit_checkout"
  | "billing.organization_service_checkout"
  | "billing.sponsorship_checkout"
  | "billing.webhook"
  | "billing.customer_portal"
  | "billing.operator_refund_hold"
  | "billing.operator_refund_execution"
  | "billing.operator_reconciliation"
  | "billing.operator_assignment"
  | "billing.operator_job_fee_assessment"
  | "billing.seller_onboarding"
  | "billing.marketplace_free_seller_agreement"
  | "billing.seller_status_refresh"
  | "billing.marketplace_checkout"
  | "billing.marketplace_free_license"
  | "billing.marketplace_offer_configuration"
  | "billing.marketplace_offer_status"
  | "billing.marketplace_publisher_link"
  | "billing.operator_marketplace_terms";

export type BillingEventOutcome =
  | "attempted"
  | "succeeded"
  | "replayed"
  | "ignored"
  | "retry"
  | "rejected"
  | "failed";

export type SafeBillingEvent = Readonly<{
  event: BillingEventName;
  outcome: BillingEventOutcome;
  correlationId?: string;
}>;

export type BillingLogger = (event: SafeBillingEvent) => void;

const CORRELATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const defaultBillingLogger: BillingLogger = (event) => {
  // The object has already been reconstructed by emitBillingEvent. Never pass
  // request/provider objects or caught errors to the platform logger.
  console.info(JSON.stringify(event));
};

export function emitBillingEvent(
  logger: BillingLogger | null | undefined,
  event: BillingEventName,
  outcome: BillingEventOutcome,
  correlationId: string | null = null
): void {
  if (!logger) return;
  const safe: SafeBillingEvent = correlationId && CORRELATION_ID_PATTERN.test(correlationId)
    ? Object.freeze({ event, outcome, correlationId: correlationId.toLowerCase() })
    : Object.freeze({ event, outcome });
  try { logger(safe); }
  catch { /* Observability must never change billing behavior. */ }
}

export function billingFailureOutcome(error: unknown): "rejected" | "failed" {
  return error instanceof BillingHttpError && error.status < 500 ? "rejected" : "failed";
}
