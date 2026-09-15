import { onRequest as account } from "../../functions/api/billing/account.ts";
import { onRequest as accountAction } from "../../functions/api/billing/account/action.ts";
import { onRequest as accountClosureReadiness } from "../../functions/api/billing/account/closure-readiness.ts";
import { onRequest as accountSupportRecognition } from "../../functions/api/billing/account/support-recognition.ts";
import { onRequest as capabilities } from "../../functions/api/billing/capabilities.ts";
import { onRequest as checkout } from "../../functions/api/billing/checkout.ts";
import { onRequest as jobPostCheckout } from "../../functions/api/billing/job-post/checkout.ts";
import { onRequest as jobPostStatus } from "../../functions/api/billing/job-post/status.ts";
import { onRequest as marketplaceCatalog } from "../../functions/api/billing/marketplace/catalog.ts";
import { onRequest as marketplaceCheckout } from "../../functions/api/billing/marketplace/checkout.ts";
import { onRequest as marketplaceFreeLicense } from "../../functions/api/billing/marketplace/free-license.ts";
import { onRequest as marketplacePurchases } from "../../functions/api/billing/marketplace/purchases.ts";
import { onRequest as operatorAccountAction } from "../../functions/api/billing/operator/account-action.ts";
import { onRequest as operatorAccountingExport } from "../../functions/api/billing/operator/accounting-export.ts";
import { onRequest as operatorAssignment } from "../../functions/api/billing/operator/assignment.ts";
import { onRequest as operatorAssistanceEnd } from "../../functions/api/billing/operator/assistance-end.ts";
import { onRequest as operatorAssistanceGrant } from "../../functions/api/billing/operator/assistance-grant.ts";
import { onRequest as operatorAssistanceProgramStatus } from "../../functions/api/billing/operator/assistance-program-status.ts";
import { onRequest as operatorAssistanceProgram } from "../../functions/api/billing/operator/assistance-program.ts";
import { onRequest as operatorAudit } from "../../functions/api/billing/operator/audit.ts";
import { onRequest as operatorJobPostAssistanceReconciliation } from "../../functions/api/billing/operator/job-post-assistance-reconciliation.ts";
import { onRequest as operatorJobPostFeeAssessment } from "../../functions/api/billing/operator/job-post-fee-assessment.ts";
import { onRequest as operatorMarketplaceCommercialTerms } from "../../functions/api/billing/operator/marketplace-commercial-terms.ts";
import { onRequest as operatorMarketplacePayoutPreparation } from "../../functions/api/billing/operator/marketplace-payout-preparation.ts";
import { onRequest as operatorOrganizationMembership } from "../../functions/api/billing/operator/organization-membership.ts";
import { onRequest as operatorOrganizationServiceReview } from "../../functions/api/billing/operator/organization-service-review.ts";
import { onRequest as operatorOrganizationService } from "../../functions/api/billing/operator/organization-service.ts";
import { onRequest as operatorOrganization } from "../../functions/api/billing/operator/organization.ts";
import { onRequest as operatorOverview } from "../../functions/api/billing/operator/overview.ts";
import { onRequest as operatorReconciliation } from "../../functions/api/billing/operator/reconciliation.ts";
import { onRequest as operatorRefundExecution } from "../../functions/api/billing/operator/refund-execution.ts";
import { onRequest as operatorRefundHold } from "../../functions/api/billing/operator/refund-hold.ts";
import { onRequest as operatorSandboxCreditGrant } from "../../functions/api/billing/operator/sandbox-credit-grant.ts";
import { onRequest as operatorServiceRestriction } from "../../functions/api/billing/operator/service-restriction.ts";
import { onRequest as operatorSponsorshipAgreement } from "../../functions/api/billing/operator/sponsorship-agreement.ts";
import { onRequest as operatorSponsorshipAllocationClose } from "../../functions/api/billing/operator/sponsorship-allocation-close.ts";
import { onRequest as operatorSponsorshipAllocation } from "../../functions/api/billing/operator/sponsorship-allocation.ts";
import { onRequest as operatorSponsorshipRecognition } from "../../functions/api/billing/operator/sponsorship-recognition.ts";
import { onRequest as operatorSponsorshipReview } from "../../functions/api/billing/operator/sponsorship-review.ts";
import { onRequest as order } from "../../functions/api/billing/order.ts";
import { onRequest as organizationCheckout } from "../../functions/api/billing/organizations/checkout.ts";
import { onRequest as organizationStatus } from "../../functions/api/billing/organizations/status.ts";
import { onRequest as portal } from "../../functions/api/billing/portal.ts";
import { onRequest as recurringCheckout } from "../../functions/api/billing/recurring-checkout.ts";
import { onRequest as sandboxCreditCatalog } from "../../functions/api/billing/sandbox-credits/catalog.ts";
import { onRequest as sandboxCreditCheckout } from "../../functions/api/billing/sandbox-credits/checkout.ts";
import { onRequest as sellerFreeAgreement } from "../../functions/api/billing/seller/free-agreement.ts";
import { onRequest as sellerOfferActivation } from "../../functions/api/billing/seller/offer-activation.ts";
import { onRequest as sellerOffer } from "../../functions/api/billing/seller/offer.ts";
import { onRequest as sellerOnboarding } from "../../functions/api/billing/seller/onboarding.ts";
import { onRequest as sellerPublisherLink } from "../../functions/api/billing/seller/publisher-link.ts";
import { onRequest as sellerStatusRefresh } from "../../functions/api/billing/seller/status-refresh.ts";
import { onRequest as sellerStatus } from "../../functions/api/billing/seller/status.ts";
import { onRequest as sponsorshipCheckout } from "../../functions/api/billing/sponsorships/checkout.ts";
import { onRequest as sponsorshipPreference } from "../../functions/api/billing/sponsorships/preference.ts";
import { onRequest as sponsorshipRecognition } from "../../functions/api/billing/sponsorships/recognition.ts";
import { onRequest as supportRecognition } from "../../functions/api/billing/support-recognition.ts";
import { onRequest as webhook } from "../../functions/api/billing/webhook.ts";
import { onRequest as providerReadiness } from "../../functions/api/billing/provider-readiness.ts";
import { onRequest as jobPostReduction } from "../../functions/api/billing/operator/job-post-reduction.ts";
import { createEconomicServerClient } from "../../functions/api/billing/_shared/auth.ts";
import { assertBillingFeatureEnabled, assertBillingMode } from "../../functions/api/billing/_shared/config.ts";
import {
  deliverEconomicNotificationOutbox,
  expireStaleEconomicCheckouts,
  type EconomicCheckoutExpiryResult,
  type EconomicNotificationDeliveryResult
} from "../../functions/api/billing/_shared/database.ts";
import { createStripeProvider } from "../../functions/api/billing/_shared/stripe.ts";
import { processProviderEvent } from "../../functions/api/billing/_shared/database.ts";
import type { NormalizedProviderEvent, BillingEnv } from "../../functions/api/billing/_shared/types.ts";

type BillingRoute = PagesFunction<BillingEnv>;

export const BILLING_ROUTES: Readonly<Record<string, BillingRoute>> = Object.freeze({
  "/api/billing/provider-readiness": providerReadiness,
  "/api/billing/operator/job-post-reduction": jobPostReduction,
  "/api/billing/account": account,
  "/api/billing/account/action": accountAction,
  "/api/billing/account/closure-readiness": accountClosureReadiness,
  "/api/billing/account/support-recognition": accountSupportRecognition,
  "/api/billing/capabilities": capabilities,
  "/api/billing/checkout": checkout,
  "/api/billing/job-post/checkout": jobPostCheckout,
  "/api/billing/job-post/status": jobPostStatus,
  "/api/billing/marketplace/catalog": marketplaceCatalog,
  "/api/billing/marketplace/checkout": marketplaceCheckout,
  "/api/billing/marketplace/free-license": marketplaceFreeLicense,
  "/api/billing/marketplace/purchases": marketplacePurchases,
  "/api/billing/operator/account-action": operatorAccountAction,
  "/api/billing/operator/accounting-export": operatorAccountingExport,
  "/api/billing/operator/assignment": operatorAssignment,
  "/api/billing/operator/assistance-end": operatorAssistanceEnd,
  "/api/billing/operator/assistance-grant": operatorAssistanceGrant,
  "/api/billing/operator/assistance-program-status": operatorAssistanceProgramStatus,
  "/api/billing/operator/assistance-program": operatorAssistanceProgram,
  "/api/billing/operator/audit": operatorAudit,
  "/api/billing/operator/job-post-assistance-reconciliation": operatorJobPostAssistanceReconciliation,
  "/api/billing/operator/job-post-fee-assessment": operatorJobPostFeeAssessment,
  "/api/billing/operator/marketplace-commercial-terms": operatorMarketplaceCommercialTerms,
  "/api/billing/operator/marketplace-payout-preparation": operatorMarketplacePayoutPreparation,
  "/api/billing/operator/organization-membership": operatorOrganizationMembership,
  "/api/billing/operator/organization-service-review": operatorOrganizationServiceReview,
  "/api/billing/operator/organization-service": operatorOrganizationService,
  "/api/billing/operator/organization": operatorOrganization,
  "/api/billing/operator/overview": operatorOverview,
  "/api/billing/operator/reconciliation": operatorReconciliation,
  "/api/billing/operator/refund-execution": operatorRefundExecution,
  "/api/billing/operator/refund-hold": operatorRefundHold,
  "/api/billing/operator/sandbox-credit-grant": operatorSandboxCreditGrant,
  "/api/billing/operator/service-restriction": operatorServiceRestriction,
  "/api/billing/operator/sponsorship-agreement": operatorSponsorshipAgreement,
  "/api/billing/operator/sponsorship-allocation-close": operatorSponsorshipAllocationClose,
  "/api/billing/operator/sponsorship-allocation": operatorSponsorshipAllocation,
  "/api/billing/operator/sponsorship-recognition": operatorSponsorshipRecognition,
  "/api/billing/operator/sponsorship-review": operatorSponsorshipReview,
  "/api/billing/order": order,
  "/api/billing/organizations/checkout": organizationCheckout,
  "/api/billing/organizations/status": organizationStatus,
  "/api/billing/portal": portal,
  "/api/billing/recurring-checkout": recurringCheckout,
  "/api/billing/sandbox-credits/catalog": sandboxCreditCatalog,
  "/api/billing/sandbox-credits/checkout": sandboxCreditCheckout,
  "/api/billing/seller/free-agreement": sellerFreeAgreement,
  "/api/billing/seller/offer-activation": sellerOfferActivation,
  "/api/billing/seller/offer": sellerOffer,
  "/api/billing/seller/onboarding": sellerOnboarding,
  "/api/billing/seller/publisher-link": sellerPublisherLink,
  "/api/billing/seller/status-refresh": sellerStatusRefresh,
  "/api/billing/seller/status": sellerStatus,
  "/api/billing/sponsorships/checkout": sponsorshipCheckout,
  "/api/billing/sponsorships/preference": sponsorshipPreference,
  "/api/billing/sponsorships/recognition": sponsorshipRecognition,
  "/api/billing/support-recognition": supportRecognition,
  "/api/billing/webhook": webhook
});

function notFound(): Response {
  return new Response(JSON.stringify({ ok: false, error: "billing_route_not_found" }), {
    status: 404,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff"
    }
  });
}

export type BillingScheduledDeliverySummary = {
  enabled: boolean;
  expiredCheckouts: number;
  batches: number;
  delivered: number;
  failed: number;
  canonicalFinancialTruth: false;
};

export type BillingScheduledDependencies = {
  expire(env: BillingEnv, limit: number): Promise<EconomicCheckoutExpiryResult>;
  deliver(env: BillingEnv, limit: number): Promise<EconomicNotificationDeliveryResult>;
  retryInbox?(env: BillingEnv): Promise<void>;
  reconcileSettlements?(env: BillingEnv): Promise<void>;
};

const defaultScheduledDependencies: BillingScheduledDependencies = {
  reconcileSettlements: async env => {
    const database = createEconomicServerClient(env);
    const { data, error } = await database.rpc("claim_economic_settlement_reconciliation", { p_limit: 5 });
    if (error || !Array.isArray(data) || data.length > 5) throw new Error("economic_settlement_queue_unavailable");
    if (!data.length) return;
    const provider = createStripeProvider(env);
    for (const event of data as NormalizedProviderEvent[]) {
      try {
        const enriched = await provider.enrichVerifiedEvent!(event);
        if (enriched.providerReceiptUrl || enriched.processorFeeMinor != null) await processProviderEvent(database, enriched);
      } catch {
        // No identifiers, raw events, provider errors or credentials in logs.
        console.warn(JSON.stringify({ event: "billing.settlement_reconciliation", outcome: "retry" }));
      }
    }
  },
  retryInbox: async env => {
    const { error } = await createEconomicServerClient(env).rpc("retry_economic_provider_inbox", { p_limit: 25 });
    if (error) throw new Error("economic_inbox_retry_unavailable");
  },
  expire: (env, limit) => expireStaleEconomicCheckouts(createEconomicServerClient(env), limit),
  deliver: (env, limit) => deliverEconomicNotificationOutbox(createEconomicServerClient(env), limit)
};

/**
 * Bounded, private retry runner for the Signal Console convenience outbox.
 * Canonical payment and entitlement state is already committed before this
 * runs. The independent flag and scheduled trigger both default off.
 */
export async function handleBillingScheduled(
  env: BillingEnv,
  dependencies: BillingScheduledDependencies = defaultScheduledDependencies
): Promise<BillingScheduledDeliverySummary> {
  if (env.BILLING_NOTIFICATION_RETRY_ENABLED !== "true") {
    return { enabled: false, expiredCheckouts: 0, batches: 0, delivered: 0, failed: 0, canonicalFinancialTruth: false };
  }
  assertBillingMode(env);
  assertBillingFeatureEnabled(env, "BILLING_WEBHOOK_FULFILLMENT_ENABLED", "webhook_fulfillment_disabled");

  const batchLimit = 25;
  const maximumBatches = 4;
  await dependencies.retryInbox?.(env);
  await dependencies.reconcileSettlements?.(env);
  const expiry = await dependencies.expire(env, 100);
  let batches = 0;
  let delivered = 0;
  let failed = 0;
  for (; batches < maximumBatches;) {
    const result = await dependencies.deliver(env, batchLimit);
    batches += 1;
    delivered += result.delivered;
    failed += result.failed;
    if (result.delivered + result.failed < batchLimit) break;
  }
  return { enabled: true, expiredCheckouts: expiry.expired, batches, delivered, failed, canonicalFinancialTruth: false };
}

export default {
  async fetch(request: Request, env: BillingEnv): Promise<Response> {
    const url = new URL(request.url);
    if (["/api/billing/marketplace/checkout", "/api/billing/seller/onboarding", "/api/billing/seller/status-refresh", "/api/billing/operator/marketplace-payout-preparation", "/api/billing/sandbox-credits/checkout"].includes(url.pathname)) return notFound();
    const handler = BILLING_ROUTES[url.pathname];
    if (!handler) return notFound();
    return await handler({ request, env } as Parameters<BillingRoute>[0]);
  },
  scheduled(_controller: ScheduledController, env: BillingEnv, context: ExecutionContext): void {
    context.waitUntil(handleBillingScheduled(env).then(() => undefined));
  }
} satisfies ExportedHandler<BillingEnv>;
