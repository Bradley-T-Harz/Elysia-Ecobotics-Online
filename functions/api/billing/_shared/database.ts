import type { SupabaseClient } from "@supabase/supabase-js";
import {
  billingLegalConsentBundleIntegrityExpectations,
  billingLegalDocumentIntegrityExpectations
} from "../../../../src/pages/Legal/firstPartyLegalManifest.ts";
import { BillingHttpError } from "./http.ts";
import { isUuid } from "./schema.ts";
import type {
  CheckoutFlow,
  CheckoutPreparation,
  EconomicAccountActionRequest,
  EconomicOrganizationRelationship,
  JobPostCheckoutRequest,
  JobPostEconomicClassification,
  MarketplaceCommercialTermsRequest,
  MarketplaceFreeSellerAgreementRequest,
  MarketplaceOfferStatusRequest,
  MarketplaceOfferConfigurationRequest,
  MarketplacePublisherLinkRequest,
  MarketplacePurchaseRequest,
  NormalizedProviderEvent,
  OneTimeCheckoutRequest,
  OrganizationServiceCheckoutRequest,
  OperatorAccountingExportRequest,
  OperatorAssignmentRequest,
  OperatorAssistanceEndRequest,
  OperatorAssistanceGrantRequest,
  OperatorAssistanceProgramRequest,
  OperatorAssistanceProgramStatusRequest,
  OperatorEconomicAccountActionRequest,
  OperatorEconomicOrganizationMembershipRequest,
  OperatorEconomicOrganizationRequest,
  OperatorEconomicServiceRestrictionRequest,
  OperatorJobPostFeeAssessmentRequest,
  OperatorJobPostAssistanceReconciliationRequest,
  OperatorMarketplacePayoutPreparationRequest,
  OperatorOrganizationServiceEngagementRequest,
  OperatorOrganizationServiceReviewRequest,
  OperatorReconciliationRequest,
  OperatorRefundHoldRequest,
  OperatorSandboxCreditGrantRequest,
  OperatorSponsorshipAgreementRequest,
  OperatorSponsorshipAssistanceAllocationCloseRequest,
  OperatorSponsorshipAssistanceAllocationRequest,
  OperatorSponsorshipRecognitionRequest,
  OperatorSponsorshipReviewRequest,
  OperatorTestRefundExecutionRequest,
  ProviderRefundResult,
  ProviderSellerStatus,
  RecurringCheckoutRequest,
  SandboxCreditCheckoutRequest,
  SellerOnboardingRequest,
  SponsorshipCheckoutRequest,
  SponsorshipRecognitionPreferenceRequest,
  SupportRecognitionPreferenceRequest
} from "./types.ts";

type Row = Record<string, unknown>;

const ONE_TIME_SUPPORT_PRICE_CODE = "support_one_time_custom_usd";
const RECURRING_SUPPORT_AMOUNTS = Object.freeze({
  support_monthly_seed_usd: 100,
  support_monthly_commons_usd: 500,
  support_monthly_infrastructure_usd: 1_200,
  support_monthly_sandbox_usd: 2_500,
  support_monthly_50_usd: 5_000
});

function object(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BillingHttpError(503, "billing_database_invalid");
  return value as Row;
}

function exactDatabaseKeys(row: Row, expected: readonly string[]): void {
  const expectedSet = new Set(expected);
  if (Object.keys(row).length !== expected.length || Object.keys(row).some((key) => !expectedSet.has(key))) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
}

function requiredString(row: Row, key: string, maximum = 255): string {
  const value = row[key];
  if (typeof value !== "string" || !value || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  return value;
}

function nullableReference(row: Row, key: string, pattern: RegExp): string | null {
  const value = row[key];
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 255 || !pattern.test(value)) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  return value;
}

function integer(row: Row, key: string, minimum: number, maximum: number): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  return value;
}

function nullableInteger(row: Row, key: string, minimum: number, maximum: number): number | null {
  if (row[key] === null) return null;
  return integer(row, key, minimum, maximum);
}

function checkoutPreparation(value: unknown): CheckoutPreparation {
  const row = object(value);
  const orderId = requiredString(row, "orderId", 64);
  if (!isUuid(orderId)) throw new BillingHttpError(503, "billing_database_invalid");
  const publicReference = requiredString(row, "publicReference", 160);
  if (!/^[A-Za-z0-9_-]{24,160}$/.test(publicReference)) throw new BillingHttpError(503, "billing_database_invalid");
  const idempotencyKey = requiredString(row, "idempotencyKey", 255);
  if (!/^[A-Za-z0-9:_-]{16,255}$/.test(idempotencyKey)) throw new BillingHttpError(503, "billing_database_invalid");
  const currency = requiredString(row, "currency", 3).toLowerCase();
  if (currency !== "usd") throw new BillingHttpError(503, "billing_database_invalid");
  return {
    orderId,
    publicReference,
    checkoutExpiresAt: typeof row.checkoutExpiresAt === "string" ? row.checkoutExpiresAt : undefined,
    idempotencyKey,
    amountMinor: integer(row, "amountMinor", 0, 100_000_000),
    currency,
    providerProductReference: nullableReference(row, "providerProductReference", /^prod_[A-Za-z0-9]+$/),
    providerPriceReference: nullableReference(row, "providerPriceReference", /^price_[A-Za-z0-9]+$/),
    providerCustomerReference: nullableReference(row, "providerCustomerReference", /^cus_[A-Za-z0-9]+$/)
  };
}

export async function beginCheckout(
  supabase: SupabaseClient,
  actorUserId: string | null,
  flow: CheckoutFlow,
  request: OneTimeCheckoutRequest | RecurringCheckoutRequest
): Promise<CheckoutPreparation> {
  const oneTime = flow === "support_one_time" ? request as OneTimeCheckoutRequest : null;
  const recurring = flow === "support_recurring" ? request as RecurringCheckoutRequest : null;
  const recurringAmount = recurring ? RECURRING_SUPPORT_AMOUNTS[recurring.priceCode] : null;
  const { data, error } = await supabase.rpc("begin_economic_checkout", {
    p_actor_user_id: actorUserId,
    p_client_request_id: request.clientRequestId,
    p_flow: flow,
    p_amount_minor: oneTime?.amountMinor ?? recurringAmount,
    p_currency: oneTime?.currency ?? "usd",
    p_price_code: recurring?.priceCode ?? ONE_TIME_SUPPORT_PRICE_CODE,
    p_source_route: request.sourceRoute,
    p_consent_version: request.consentVersion
  });
  if (error) throw new BillingHttpError(409, "checkout_preparation_failed");
  const preparation = checkoutPreparation(data);
  if (flow === "support_one_time" && preparation.amountMinor !== oneTime?.amountMinor) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  if (flow === "support_recurring" && preparation.amountMinor !== recurringAmount) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  if (flow === "support_recurring" && !preparation.providerPriceReference) {
    throw new BillingHttpError(503, "billing_catalog_unavailable");
  }
  if (flow === "support_one_time" && !preparation.providerProductReference) {
    throw new BillingHttpError(503, "billing_catalog_unavailable");
  }
  return preparation;
}

export async function attachCheckoutSession(
  supabase: SupabaseClient,
  orderId: string,
  providerSessionId: string,
  providerCustomerReference: string | null
): Promise<void> {
  const { error } = await supabase.rpc("attach_economic_checkout_provider_session", {
    p_order_id: orderId,
    p_provider: "stripe",
    p_provider_session_id: providerSessionId,
    p_provider_customer_id: providerCustomerReference
  });
  if (error) throw new BillingHttpError(503, "checkout_recording_failed");
}

export async function attachCheckoutBillingCustomer(
  supabase: SupabaseClient,
  orderId: string,
  providerCustomerReference: string
): Promise<void> {
  if (!isUuid(orderId) || !/^cus_[A-Za-z0-9_]+$/.test(providerCustomerReference)) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  const { error } = await supabase.rpc("attach_economic_checkout_billing_customer", {
    p_order_id: orderId,
    p_provider: "stripe",
    p_provider_customer_id: providerCustomerReference
  });
  if (error) throw new BillingHttpError(503, "billing_customer_recording_failed");
}

export async function failCheckout(supabase: SupabaseClient, orderId: string, failureCode: string): Promise<void> {
  await supabase.rpc("fail_economic_checkout_attempt", {
    p_order_id: orderId,
    p_failure_code: failureCode.slice(0, 80)
  });
}

export type EconomicCheckoutExpiryResult = {
  expired: number;
  canonicalFinancialTruth: false;
  testMode: boolean;
};

export async function expireStaleEconomicCheckouts(
  supabase: SupabaseClient,
  limit = 100
): Promise<EconomicCheckoutExpiryResult> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new BillingHttpError(500, "economic_checkout_expiry_invalid");
  }
  const { data, error } = await supabase.rpc("expire_stale_economic_checkouts", { p_limit: limit });
  if (error) throw new BillingHttpError(503, "economic_checkout_expiry_unavailable");
  const row = object(data);
  const expired = integer(row, "expired", 0, limit);
  if (
    Object.keys(row).length !== 3
    || row.canonicalFinancialTruth !== false
    || typeof row.testMode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return { expired, canonicalFinancialTruth: false, testMode: row.testMode === true };
}

export async function processProviderEvent(supabase: SupabaseClient, event: NormalizedProviderEvent): Promise<"processed" | "duplicate" | "ignored" | "retry"> {
  const { data, error } = await supabase.rpc("process_economic_provider_event", {
    p_provider: event.provider,
    p_provider_event_id: event.providerEventId,
    p_event_type: event.eventType,
    p_event_created_at: event.eventCreatedAt,
    p_payload_sha256: event.payloadSha256,
    p_normalized_event: event
  });
  if (error) throw new BillingHttpError(503, "webhook_processing_unavailable");
  const result = typeof data === "string" ? { status: data } : object(data);
  const status = result.status;
  const replay = result.idempotentReplay === true;
  if (status === "processed") return replay ? "duplicate" : "processed";
  if (status === "unmatched" || status === "ignored_out_of_order" || status === "ignored") return "ignored";
  if (status === "duplicate") return "duplicate";
  if (status === "failed" || status === "received" || status === "processing" || status === "retry") return "retry";
  throw new BillingHttpError(503, "webhook_processing_unavailable");
}

export type EconomicNotificationDeliveryResult = {
  delivered: number;
  failed: number;
  canonicalFinancialTruth: false;
};

export async function deliverEconomicNotificationOutbox(
  supabase: SupabaseClient,
  limit = 25
): Promise<EconomicNotificationDeliveryResult> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new BillingHttpError(500, "economic_notification_delivery_invalid");
  }
  const { data, error } = await supabase.rpc("deliver_economic_notification_outbox", {
    p_limit: limit
  });
  if (error) throw new BillingHttpError(503, "economic_notification_delivery_unavailable");
  const row = object(data);
  const delivered = integer(row, "delivered", 0, limit);
  const failed = integer(row, "failed", 0, limit);
  if (
    Object.keys(row).length !== 3
    || delivered + failed > limit
    || row.canonicalFinancialTruth !== false
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return { delivered, failed, canonicalFinancialTruth: false };
}

export type PortalPreparation = {
  portalRequestId: string;
  billingCustomerId: string;
  providerCustomerReference: string;
  idempotentReplay: boolean;
};

export async function prepareCustomerPortal(supabase: SupabaseClient, actorUserId: string, clientRequestId: string): Promise<PortalPreparation> {
  const { data, error } = await supabase.rpc("prepare_economic_customer_portal", {
    p_actor_user_id: actorUserId,
    p_client_request_id: clientRequestId
  });
  if (error) throw new BillingHttpError(409, "billing_portal_unavailable");
  const row = object(data);
  const portalRequestId = requiredString(row, "portalRequestId", 64);
  if (!isUuid(portalRequestId)) throw new BillingHttpError(503, "billing_database_invalid");
  const billingCustomerId = requiredString(row, "billingCustomerId", 64);
  if (!isUuid(billingCustomerId)) throw new BillingHttpError(503, "billing_database_invalid");
  const providerCustomerReference = nullableReference(
    { providerCustomerReference: row.providerCustomerReference ?? row.providerCustomerId },
    "providerCustomerReference",
    /^cus_[A-Za-z0-9]+$/
  );
  if (!providerCustomerReference) throw new BillingHttpError(409, "billing_portal_unavailable");
  return { portalRequestId, billingCustomerId, providerCustomerReference, idempotentReplay: requiredBoolean(row, "idempotentReplay") };
}

export async function recordPortalSession(
  supabase: SupabaseClient,
  portalRequestId: string,
  billingCustomerId: string,
  providerSessionId: string
): Promise<void> {
  const { error } = await supabase.rpc("record_economic_customer_portal_session", {
    p_portal_request_id: portalRequestId,
    p_billing_customer_id: billingCustomerId,
    p_provider_session_id: providerSessionId
  });
  if (error) throw new BillingHttpError(503, "billing_portal_recording_failed");
}

const FORBIDDEN_SAFE_KEY = /(stripe|provider.*(?:id|reference)|customer.*id|payment.*id|subscription.*id|invoice.*id|service.?role|secret|raw.*payload|metadata)/i;

function allowedSafeAssertion(key: string, value: unknown): boolean {
  if (key === "providerIdentifiersExposed") return value === false;
  if (key === "stripeConnectDisclosureVersion") {
    return value === null || (
      typeof value === "string"
      && value.length >= 1
      && value.length <= 120
      && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)
    );
  }
  return false;
}

function safeValue(value: unknown, depth = 0): unknown {
  if (depth > 6) throw new BillingHttpError(503, "billing_database_invalid");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new BillingHttpError(503, "billing_database_invalid");
    return value;
  }
  if (typeof value === "string") {
    if (value.length > 4_096 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
      throw new BillingHttpError(503, "billing_database_invalid");
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 200) throw new BillingHttpError(503, "billing_database_invalid");
    return value.map((item) => safeValue(item, depth + 1));
  }
  if (typeof value === "object" && value) {
    const row = value as Row;
    if (
      Object.keys(row).length > 80
      || Object.entries(row).some(([key, item]) => FORBIDDEN_SAFE_KEY.test(key) && !allowedSafeAssertion(key, item))
    ) {
      throw new BillingHttpError(503, "billing_database_invalid");
    }
    return Object.fromEntries(Object.entries(row).map(([key, item]) => [key, safeValue(item, depth + 1)]));
  }
  throw new BillingHttpError(503, "billing_database_invalid");
}

export function sanitizeEconomicSummary(value: unknown): unknown {
  const safe = safeValue(value);
  if (new TextEncoder().encode(JSON.stringify(safe)).byteLength > 131_072) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  return safe;
}

export function assertEconomicResponseSize(value: unknown): void {
  let serialized: string;
  try { serialized = JSON.stringify(value); }
  catch { throw new BillingHttpError(503, "billing_database_invalid"); }
  if (new TextEncoder().encode(serialized).byteLength > 131_072) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
}

export type EconomicLegalReference = { version: string; path: string; contentSha256: string };
export type EconomicLegalConsentBundleKey =
  | "support_one_time_checkout_bundle"
  | "support_recurring_checkout_bundle"
  | "sandbox_credits_checkout_bundle"
  | "job_post_fee_checkout_bundle"
  | "marketplace_purchase_checkout_bundle"
  | "marketplace_free_license_bundle"
  | "organization_service_checkout_bundle"
  | "sponsorship_checkout_bundle";
export type EconomicLegalConsentBundle = {
  version: string;
  path: string;
  documents: Record<string, EconomicLegalReference>;
};

export type EconomicPublicCapabilities = {
  providerMode?: "test" | "live";
  jobPostCheckoutEnabled?: boolean;
  supportCheckoutEnabled: boolean;
  recurringSupportEnabled: boolean;
  economicWebhooksEnabled: boolean;
  customerPortalEnabled: boolean;
  marketplaceSellerOnboardingEnabled: boolean;
  organizationServiceCheckoutEnabled: boolean;
  sponsorshipCheckoutEnabled: boolean;
  legalDocumentVersions: {
    supportOneTime: { version: string; path: "/legal/support-and-billing-terms"; contentSha256: string };
    supportRecurring: { version: string; path: "/legal/support-and-billing-terms"; contentSha256: string };
    supportRecognition: { version: string; path: "/legal/support-and-billing-terms"; contentSha256: string };
    dataExportRequest: { version: string; path: "/legal/privacy-policy"; contentSha256: string };
    economicAccountClosureRequest: { version: string; path: "/legal/account-closure-financial-retention"; contentSha256: string };
    marketplaceSellerAgreement: { version: string; path: "/legal/marketplace-commerce-terms"; contentSha256: string };
    marketplaceFreeSellerAgreement: { version: string; path: "/legal/marketplace-commerce-terms"; contentSha256: string };
    stripeConnectSellerDisclosure: { version: string; path: "/legal/marketplace-commerce-terms"; contentSha256: string };
    marketplaceBuyerTerms: { version: string; path: "/legal/marketplace-commerce-terms"; contentSha256: string };
  };
  legalConsentBundles: Record<EconomicLegalConsentBundleKey, EconomicLegalConsentBundle>;
};

export async function loadEconomicPublicCapabilities(supabase: SupabaseClient): Promise<EconomicPublicCapabilities | null> {
  const { data, error } = await supabase.rpc("economic_public_capabilities");
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as Row;
  if (typeof row.testModeOnly !== "boolean" || typeof row.livePaymentsEnabled !== "boolean" || row.paymentGrantsAuthority !== false) return null;
  let legalDocuments: Row;
  try { legalDocuments = object(row.legalDocumentVersions); }
  catch { return null; }
  const expectedDocuments = billingLegalDocumentIntegrityExpectations;
  if (
    Object.keys(legalDocuments).length !== Object.keys(expectedDocuments).length
    || Object.keys(legalDocuments).some((key) => !(key in expectedDocuments))
  ) return null;
  const parsedDocuments = {} as EconomicPublicCapabilities["legalDocumentVersions"];
  for (const [key, expectation] of Object.entries(expectedDocuments) as Array<[
    keyof EconomicPublicCapabilities["legalDocumentVersions"], { version: string; path: string; contentSha256: string }
  ]>) {
    let document: Row;
    try { document = object(legalDocuments[key]); }
    catch { return null; }
    if (Object.keys(document).length !== 3
      || document.version !== expectation.version
      || document.path !== expectation.path
      || document.contentSha256 !== expectation.contentSha256
      || typeof document.contentSha256 !== "string"
      || !/^[0-9a-f]{64}$/.test(document.contentSha256)) return null;
    parsedDocuments[key] = { version: expectation.version, path: expectation.path, contentSha256: expectation.contentSha256 } as never;
  }
  const expectedBundles = billingLegalConsentBundleIntegrityExpectations;
  let bundles: Row;
  try { bundles = object(row.legalConsentBundles); }
  catch { return null; }
  if (
    Object.keys(bundles).length !== Object.keys(expectedBundles).length
    || Object.keys(bundles).some((key) => !(key in expectedBundles))
  ) return null;
  const parsedBundles = {} as Record<EconomicLegalConsentBundleKey, EconomicLegalConsentBundle>;
  for (const [bundleKey, expectation] of Object.entries(expectedBundles) as Array<[
    EconomicLegalConsentBundleKey,
    { version: string; path: string; documents: Record<string, { version: string; path: string; contentSha256: string }> }
  ]>) {
    let bundle: Row;
    let documents: Row;
    try {
      bundle = object(bundles[bundleKey]);
      documents = object(bundle.documents);
    } catch { return null; }
    if (
      Object.keys(bundle).length !== 3
      || bundle.version !== expectation.version
      || bundle.path !== expectation.path
      || Object.keys(documents).length !== Object.keys(expectation.documents).length
      || Object.keys(documents).some((key) => !(key in expectation.documents))
    ) return null;
    const parsedManifest: Record<string, EconomicLegalReference> = {};
    for (const [documentKey, expectedDocument] of Object.entries(expectation.documents)) {
      let document: Row;
      try { document = object(documents[documentKey]); }
      catch { return null; }
      if (
        Object.keys(document).length !== 3
        || document.version !== expectedDocument.version
        || document.path !== expectedDocument.path
        || document.contentSha256 !== expectedDocument.contentSha256
        || typeof document.contentSha256 !== "string"
        || !/^[0-9a-f]{64}$/.test(document.contentSha256)
      ) return null;
      parsedManifest[documentKey] = { version: expectedDocument.version, path: expectedDocument.path, contentSha256: expectedDocument.contentSha256 };
    }
    parsedBundles[bundleKey] = { version: expectation.version, path: expectation.path, documents: parsedManifest };
  }
  if (
    parsedBundles.support_one_time_checkout_bundle.documents.supportTerms?.version !== parsedDocuments.supportOneTime.version
    || parsedBundles.support_recurring_checkout_bundle.documents.recurringSupportTerms?.version !== parsedDocuments.supportRecurring.version
    || parsedBundles.marketplace_purchase_checkout_bundle.documents.marketplaceBuyerTerms?.version !== parsedDocuments.marketplaceBuyerTerms.version
  ) return null;
  return {
    providerMode: row.testModeOnly ? "test" : "live",
    jobPostCheckoutEnabled: row.jobPostFeeEnabled === true,
    supportCheckoutEnabled: row.supportCheckoutEnabled === true,
    recurringSupportEnabled: row.recurringSupportEnabled === true,
    economicWebhooksEnabled: row.economicWebhooksEnabled === true,
    customerPortalEnabled: row.customerPortalEnabled === true,
    marketplaceSellerOnboardingEnabled: row.marketplaceSellerOnboardingEnabled === true,
    organizationServiceCheckoutEnabled: row.organizationServiceCheckoutEnabled === true,
    sponsorshipCheckoutEnabled: row.sponsorshipCheckoutEnabled === true,
    legalDocumentVersions: parsedDocuments,
    legalConsentBundles: parsedBundles
  };
}

export async function lookupOrderStatus(supabase: SupabaseClient, publicReference: string, actorUserId: string | null): Promise<unknown> {
  const { data, error } = await supabase.rpc("lookup_economic_order_status", {
    p_public_reference: publicReference,
    p_actor_user_id: actorUserId
  });
  if (error || data === null) throw new BillingHttpError(404, "order_not_found");
  return sanitizeEconomicSummary(data);
}

export async function loadCurrentEconomicAccount(supabase: SupabaseClient): Promise<unknown> {
  const { data, error } = await supabase.rpc("current_user_economic_account_summary");
  if (error) throw new BillingHttpError(503, "billing_account_unavailable");
  const row = object(data);
  const finalKeys = new Set([
    "testMode", "orders", "paymentTransactions", "subscriptions", "receipts", "sandboxCredits", "marketplacePurchases",
    "marketplaceSeller", "jobPosts", "assistance", "recognition", "accountRequests",
    "activeRestrictions", "closureReadiness", "warnings", "providerIdentifiersExposed", "moneyDoesNotGrantAuthority"
  ]);
  if (
    Object.keys(row).length !== finalKeys.size
    || Object.keys(row).some((key) => !finalKeys.has(key))
    || typeof row.testMode !== "boolean"
    || row.providerIdentifiersExposed !== false
    || row.moneyDoesNotGrantAuthority !== true
    || !Array.isArray(row.orders)
    || !Array.isArray(row.paymentTransactions)
    || !Array.isArray(row.subscriptions)
    || !Array.isArray(row.receipts)
    || !Array.isArray(row.jobPosts)
    || !Array.isArray(row.assistance)
    || !Array.isArray(row.accountRequests)
    || !Array.isArray(row.activeRestrictions)
    || !Array.isArray(row.warnings)
    || row.paymentTransactions.length > 100
    || row.receipts.length > 100
    || row.warnings.length > 40
  ) throw new BillingHttpError(503, "billing_database_invalid");

  const receiptFlows = new Set([
    "support_one_time", "support_recurring", "sandbox_credits", "job_post_fee",
    "marketplace_purchase", "organization_service", "sponsorship"
  ]);
  const receiptStatuses = new Set(["pending", "succeeded", "failed", "canceled", "refunded", "disputed"]);
  for (const value of [...row.paymentTransactions, ...row.receipts]) {
    const receipt = object(value);
    const enhanced = row.receipts.includes(value) && receipt.recordVersion === "payment-record-v1";
    const keys = new Set([
      "transactionId", "publicReference", "flow", "status", "amountMinor", "currency", "occurredAt",
      "receiptAvailable", "providerIdentifiersExposed",
      ...(enhanced ? ["recordVersion", "payee", "orderStatus", "refundedAmountMinor", ...(receipt.receiptUrl !== undefined ? ["receiptUrl", "testMode"] : [])] : [])
    ]);
    const publicReference = requiredString(receipt, "publicReference", 160);
    const flow = requiredString(receipt, "flow", 40);
    const status = requiredString(receipt, "status", 40);
    const currency = requiredString(receipt, "currency", 3);
    if (
      Object.keys(receipt).length !== keys.size
      || Object.keys(receipt).some((key) => !keys.has(key))
      || !isUuid(requiredString(receipt, "transactionId", 64))
      || !/^[A-Za-z0-9_-]{24,160}$/.test(publicReference)
      || !receiptFlows.has(flow)
      || !receiptStatuses.has(status)
      || !/^[a-z]{3}$/.test(currency)
      || (receipt.receiptAvailable !== false && !(typeof receipt.receiptUrl === "string" && /^https:\/\/pay\.stripe\.com\//.test(receipt.receiptUrl)))
      || receipt.providerIdentifiersExposed !== false
    ) throw new BillingHttpError(503, "billing_database_invalid");
    const amount = integer(receipt, "amountMinor", 0, 100_000_000_000);
    if (enhanced) {
      if (receipt.payee !== (flow === "marketplace_purchase" ? null : "EcoSyneva Commons LLC")
        || !new Set(["pending", "checkout_created", "processing", "paid", "failed", "canceled", "partially_refunded", "refunded", "disputed"]).has(requiredString(receipt, "orderStatus", 40))) throw new BillingHttpError(503, "billing_database_invalid");
      integer(receipt, "refundedAmountMinor", 0, amount);
    }
    requiredTimestamp(receipt, "occurredAt");
  }

  const warningGuidance = {
    order_failed: "Review the failed checkout or begin a new checkout. Community standing is unchanged.",
    subscription_attention_required: "Open billing management to review or cancel recurring support. Community standing is unchanged.",
    marketplace_fulfillment_review: "Payment completed, but Marketplace fulfillment was safely held for private review and refund. No add-on was installed and community standing is unchanged.",
    job_post_payment_review: "Payment completed after the Job Post was no longer eligible. Publication was withheld and a private full-refund review is required; community standing is unchanged.",
    organization_service_payment_review: "Payment settled after the organization service engagement became ineligible or terminal. Service activation was withheld and a private full-refund review is required; community standing is unchanged.",
    sponsorship_payment_review: "Payment settled after the sponsorship agreement became ineligible or terminal. Sponsorship activation and recognition were withheld and a private full-refund review is required; community standing is unchanged."
  } as const;
  for (const value of row.warnings) {
    const warning = object(value);
    const code = requiredString(warning, "code", 80) as keyof typeof warningGuidance;
    const expectedKeys = code !== "subscription_attention_required"
      ? new Set(["code", "publicReference", "guidance"])
      : new Set(["code", "guidance"]);
    if (
      !(code in warningGuidance)
      || Object.keys(warning).length !== expectedKeys.size
      || Object.keys(warning).some((key) => !expectedKeys.has(key))
      || requiredString(warning, "guidance", 240) !== warningGuidance[code]
    ) throw new BillingHttpError(503, "billing_database_invalid");
    if (code !== "subscription_attention_required") {
      const publicReference = requiredString(warning, "publicReference", 160);
      if (!/^[A-Za-z0-9_-]{24,160}$/.test(publicReference)) {
        throw new BillingHttpError(503, "billing_database_invalid");
      }
    }
  }
  object(row.sandboxCredits);
  object(row.marketplacePurchases);
  object(row.marketplaceSeller);
  object(row.recognition);
  economicClosureReadiness(row.closureReadiness);
  return sanitizeEconomicSummary(row);
}

const ECONOMIC_OPERATOR_CAPABILITIES = new Set([
  "economic_orders_view",
  "economic_payments_view",
  "economic_operator_assignments_manage",
  "economic_feature_flags_manage",
  "economic_refunds_manage",
  "economic_reconciliation_manage",
  "recurring_support_manage",
  "sandbox_credits_adjust",
  "job_fee_assess",
  "marketplace_payout_manage",
  "organization_billing_manage",
  "sponsorship_manage",
  "economic_assistance_manage",
  "economic_account_requests_manage",
  "economic_audit_view",
  "accounting_export"
]);

const ECONOMIC_OPERATOR_FEATURE_FLAG_KEYS = Object.freeze([
  "customer_portal", "economic_assistance_workflow", "economic_webhooks",
  "job_post_fee_enforcement", "live_stripe", "marketplace_paid_offers",
  "marketplace_payout_preparation", "marketplace_payouts", "marketplace_seller_onboarding",
  "organization_billing", "organization_contract_workflow", "public_support_recognition",
  "recurring_support", "sandbox_credit_display", "sandbox_credit_enforcement",
  "sandbox_credit_purchase", "sponsorship_checkout", "sponsorship_display",
  "sponsorship_review_workflow", "support_checkout", "test_refund_execution"
]);

function requiredBoolean(row: Row, key: string): boolean {
  if (typeof row[key] !== "boolean") throw new BillingHttpError(503, "billing_database_invalid");
  return row[key] as boolean;
}

function nullableTimestamp(row: Row, key: string): string | null {
  if (row[key] === null || row[key] === undefined) return null;
  const value = requiredString(row, key, 40);
  if (!Number.isFinite(Date.parse(value))) throw new BillingHttpError(503, "billing_database_invalid");
  return value;
}

function operatorRpcFailure(error: { code?: string } | null): BillingHttpError {
  if (error?.code === "42501") return new BillingHttpError(403, "economic_operator_forbidden");
  if (error?.code === "P0002" || error?.code === "23503") return new BillingHttpError(404, "economic_operator_target_not_found");
  if (error?.code === "23505") return new BillingHttpError(409, "economic_operator_idempotency_conflict");
  if (error?.code === "22023" || error?.code === "55000") return new BillingHttpError(409, "economic_operator_action_rejected");
  return new BillingHttpError(503, "economic_operator_unavailable");
}

type EconomicOperatorQueue<T> = T[] | null;
type EconomicOperatorOrderItem = {
  orderId: string; publicReference: string; flow: string; status: string;
  amountMinor: number; currency: string; createdAt: string;
};
type EconomicOperatorPaymentItem = {
  paymentTransactionId: string; orderId: string; publicReference: string; flow: string; status: string;
  grossAmountMinor: number; processorFeeMinor: number | null; netAmountMinor: number | null;
  currency: string; occurredAt: string;
};
type EconomicOperatorRefundablePaymentItem = {
  paymentTransactionId: string; orderId: string; publicReference: string;
  flow: string; status: "succeeded" | "refunded" | "disputed";
  grossAmountMinor: number; refundableAmountMinor: number;
  currency: string; occurredAt: string;
};
type EconomicOperatorRefundItem = {
  requestId: string; orderId: string; paymentTransactionId: string; status: string;
  amountMinor: number; currency: string; createdAt: string;
};
type EconomicOperatorReconciliationCaseKind =
  | "economic_reconciliation_case"
  | "marketplace_fulfillment_hold"
  | "job_post_payment_hold"
  | "organization_service_settlement_hold"
  | "sponsorship_settlement_hold";

type EconomicOperatorOverviewShape = {
  orderQueue: EconomicOperatorQueue<EconomicOperatorOrderItem>;
  paymentQueue: EconomicOperatorQueue<EconomicOperatorPaymentItem>;
  refundablePaymentQueue: EconomicOperatorQueue<EconomicOperatorRefundablePaymentItem>;
  refundQueue: EconomicOperatorQueue<EconomicOperatorRefundItem>;
  subscriptionQueue: EconomicOperatorQueue<{
    subscriptionId: string; userId: string; originatingOrderId: string | null; status: string;
    cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null; updatedAt: string;
  }>;
  disputeQueue: EconomicOperatorQueue<{
    disputeId: string; orderId: string; paymentTransactionId: string; status: string; reasonCode: string | null;
    amountMinor: number; currency: string; createdAt: string; updatedAt: string;
  }>;
  webhookQueue: EconomicOperatorQueue<{
    eventId: string; eventType: string; processingStatus: string; processingAttempts: number;
    eventCreatedAt: string; receivedAt: string;
  }>;
  reconciliationQueue: EconomicOperatorQueue<{
    caseId: string; orderId: string;
    caseKind: EconomicOperatorReconciliationCaseKind;
    status: string; openedAt: string;
  }>;
  sandboxCorrectionQueue: EconomicOperatorQueue<{
    shortfallId: string; fulfillmentId: string;
    fulfillmentScope: "sandbox_credit_order" | "recurring_support_payment";
    orderId: string; paymentTransactionId: string | null; adjustmentKind: string;
    targetUnits: number; appliedUnits: number; missingUnits: number; status: string; createdAt: string;
  }>;
  jobPostEconomicQueue: EconomicOperatorQueue<{
    conditionId: string; jobPostId: string; authorUserId: string; classification: string; status: string;
    orderId: string | null; termsVersion: string | null; updatedAt: string;
  }>;
  sellerPayableQueue: EconomicOperatorQueue<{
    sellerAccountId: string; currency: string; availablePayableMinor: number; sellerStatus: string;
  }>;
  sellerPayoutPreparationQueue: EconomicOperatorQueue<{
    payoutPreparationId: string; sellerAccountId: string; amountMinor: number;
    currency: string; status: string; createdAt: string;
  }>;
  organizationServiceQueue: EconomicOperatorQueue<{
    engagementId: string; organizationId: string; serviceCode: string; status: string;
    entitlementState: string; supportAgreementState: string; orderId: string | null; updatedAt: string;
  }>;
  sponsorshipQueue: EconomicOperatorQueue<{
    sponsorshipAgreementId: string; organizationId: string; status: string; purposeCode: string;
    publicRecognitionOptIn: boolean; publicRecognitionApproved: boolean; orderId: string | null; updatedAt: string;
  }>;
  accountRequestQueue: EconomicOperatorQueue<{
    requestId: string; requestType: string; status: string; submittedAt: string; providerCancellationRequired: boolean;
  }>;
  assistanceProgramQueue: EconomicOperatorQueue<{
    programId: string; programCode: string; kind: string; scope: string; status: string;
    startsAt: string; endsAt: string | null; updatedAt: string;
  }>;
  assistanceQueue: EconomicOperatorQueue<{ grantId: string; scope: string; status: string; expiresAt: string | null }>;
  featureFlags: EconomicOperatorQueue<{ featureKey: string; enabled: boolean; testModeOnly: boolean; updatedAt: string }>;
};

export type EconomicOperatorOverview = EconomicOperatorOverviewShape & {
  authorized: boolean;
  capabilities: string[];
  queueLimit: 10;
  providerIdentifiersExposed: false;
  personalContactDataExposed: false;
  testMode: boolean;
};

export async function loadCurrentEconomicOperatorOverview(supabase: SupabaseClient): Promise<EconomicOperatorOverview> {
  const { data, error } = await supabase.rpc("current_user_economic_operator_overview");
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  const capabilities = row.capabilities;
  if (
    !Array.isArray(capabilities)
    || capabilities.length > ECONOMIC_OPERATOR_CAPABILITIES.size
    || capabilities.some((capability) => typeof capability !== "string" || !ECONOMIC_OPERATOR_CAPABILITIES.has(capability))
    || new Set(capabilities).size !== capabilities.length
    || row.queueLimit !== 10
    || row.providerIdentifiersExposed !== false
    || row.personalContactDataExposed !== false
    || typeof row.testMode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  exactDatabaseKeys(row, [
    "authorized", "capabilities", "queueLimit", "orderQueue", "paymentQueue", "refundablePaymentQueue",
    "refundQueue", "subscriptionQueue", "disputeQueue", "webhookQueue", "reconciliationQueue",
    "sandboxCorrectionQueue", "jobPostEconomicQueue", "sellerPayableQueue", "sellerPayoutPreparationQueue",
    "organizationServiceQueue", "sponsorshipQueue", "accountRequestQueue", "assistanceProgramQueue",
    "assistanceQueue", "featureFlags", "providerIdentifiersExposed", "personalContactDataExposed", "testMode"
  ]);
  const capabilitySet = new Set(capabilities as string[]);
  const queue = <T>(key: keyof EconomicOperatorOverviewShape, requiredCapabilities: string[], parse: (value: unknown) => T): T[] | null => {
    const value = row[key];
    const permitted = requiredCapabilities.some((capability) => capabilitySet.has(capability));
    if (!permitted) {
      if (value !== null) throw new BillingHttpError(503, "billing_database_invalid");
      return null;
    }
    if (!Array.isArray(value) || value.length > 10) throw new BillingHttpError(503, "billing_database_invalid");
    return value.map(parse);
  };
  const orderFlows = new Set([
    "support_one_time", "support_recurring", "sandbox_credits", "job_post_fee",
    "marketplace_purchase", "organization_service", "sponsorship"
  ]);
  const orderStatuses = new Set([
    "pending", "checkout_created", "processing", "paid", "failed", "canceled",
    "partially_refunded", "refunded", "disputed"
  ]);
  const parseCurrency = (entry: Row): string => {
    const currency = requiredString(entry, "currency", 3);
    if (!/^[a-z]{3}$/.test(currency)) throw new BillingHttpError(503, "billing_database_invalid");
    return currency;
  };
  const parsePublicReference = (entry: Row): string => {
    const reference = requiredString(entry, "publicReference", 160);
    if (!/^[A-Za-z0-9_-]{24,160}$/.test(reference)) throw new BillingHttpError(503, "billing_database_invalid");
    return reference;
  };
  const nullableUuid = (entry: Row, key: string): string | null => entry[key] === null ? null : requiredUuid(entry, key);
  const nullableText = (entry: Row, key: string, maximum = 120): string | null => entry[key] === null ? null : requiredString(entry, key, maximum);
  const safeCode = (entry: Row, key: string, maximum = 120): string => {
    const value = requiredString(entry, key, maximum);
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) throw new BillingHttpError(503, "billing_database_invalid");
    return value;
  };
  const money = (entry: Row, key: string, minimum = 0): number => integer(entry, key, minimum, 100_000_000_000);
  const units = (entry: Row, key: string, minimum = 0): number => integer(entry, key, minimum, Number.MAX_SAFE_INTEGER);
  const orderQueue = queue("orderQueue", ["economic_orders_view"], (value) => {
    const entry = object(value);
    exactDatabaseKeys(entry, ["orderId", "publicReference", "flow", "status", "amountMinor", "currency", "createdAt"]);
    const flow = requiredString(entry, "flow", 40);
    const status = requiredString(entry, "status", 40);
    if (!orderFlows.has(flow) || !orderStatuses.has(status)) throw new BillingHttpError(503, "billing_database_invalid");
    return {
      orderId: requiredUuid(entry, "orderId"), publicReference: parsePublicReference(entry), flow, status,
      amountMinor: integer(entry, "amountMinor", 1, 100_000_000_000), currency: parseCurrency(entry),
      createdAt: requiredTimestamp(entry, "createdAt")
    };
  });
  const paymentStatuses = new Set(["pending", "succeeded", "failed", "canceled", "refunded", "disputed"]);
  const paymentQueue = queue("paymentQueue", ["economic_payments_view"], (value) => {
    const entry = object(value);
    exactDatabaseKeys(entry, ["paymentTransactionId", "orderId", "publicReference", "flow", "status", "grossAmountMinor", "processorFeeMinor", "netAmountMinor", "currency", "occurredAt"]);
    const flow = requiredString(entry, "flow", 40);
    const status = requiredString(entry, "status", 40);
    const grossAmountMinor = money(entry, "grossAmountMinor");
    const processorFeeMinor = nullableInteger(entry, "processorFeeMinor", 0, grossAmountMinor);
    const netAmountMinor = nullableInteger(entry, "netAmountMinor", 0, grossAmountMinor);
    if (!orderFlows.has(flow) || !paymentStatuses.has(status)
      || (processorFeeMinor !== null && netAmountMinor !== null && netAmountMinor !== grossAmountMinor - processorFeeMinor)) {
      throw new BillingHttpError(503, "billing_database_invalid");
    }
    return {
      paymentTransactionId: requiredUuid(entry, "paymentTransactionId"), orderId: requiredUuid(entry, "orderId"),
      publicReference: parsePublicReference(entry), flow, status, grossAmountMinor, processorFeeMinor, netAmountMinor,
      currency: parseCurrency(entry), occurredAt: requiredTimestamp(entry, "occurredAt")
    };
  });
  const refundablePaymentStatuses = new Set(["succeeded", "refunded", "disputed"]);
  const refundablePaymentQueue = queue("refundablePaymentQueue", ["economic_refunds_manage"], (value) => {
    const entry = object(value);
    exactDatabaseKeys(entry, ["paymentTransactionId", "orderId", "publicReference", "flow", "status", "grossAmountMinor", "refundableAmountMinor", "currency", "occurredAt"]);
    const flow = requiredString(entry, "flow", 40);
    const status = requiredString(entry, "status", 40);
    const grossAmountMinor = integer(entry, "grossAmountMinor", 1, 100_000_000_000);
    const refundableAmountMinor = integer(entry, "refundableAmountMinor", 1, grossAmountMinor);
    if (!orderFlows.has(flow) || !refundablePaymentStatuses.has(status)) {
      throw new BillingHttpError(503, "billing_database_invalid");
    }
    return {
      paymentTransactionId: requiredUuid(entry, "paymentTransactionId"),
      orderId: requiredUuid(entry, "orderId"),
      publicReference: parsePublicReference(entry),
      flow,
      status: status as "succeeded" | "refunded" | "disputed",
      grossAmountMinor,
      refundableAmountMinor,
      currency: parseCurrency(entry),
      occurredAt: requiredTimestamp(entry, "occurredAt")
    };
  });
  const refundStatuses = new Set(["held_for_review", "approved_for_provider", "provider_pending"]);
  const refundQueue = queue("refundQueue", ["economic_refunds_manage"], (value) => {
    const entry = object(value);
    exactDatabaseKeys(entry, ["requestId", "orderId", "paymentTransactionId", "status", "amountMinor", "currency", "createdAt"]);
    const status = requiredString(entry, "status", 40);
    if (!refundStatuses.has(status)) throw new BillingHttpError(503, "billing_database_invalid");
    return {
      requestId: requiredUuid(entry, "requestId"), orderId: requiredUuid(entry, "orderId"),
      paymentTransactionId: requiredUuid(entry, "paymentTransactionId"), status,
      amountMinor: integer(entry, "amountMinor", 1, 100_000_000_000), currency: parseCurrency(entry),
      createdAt: requiredTimestamp(entry, "createdAt")
    };
  });
  const subscriptionStatuses = new Set(["incomplete", "active", "past_due", "grace_period", "canceling"]);
  const subscriptionQueue = queue("subscriptionQueue", ["recurring_support_manage"], (value) => {
    const entry = object(value);
    exactDatabaseKeys(entry, ["subscriptionId", "userId", "originatingOrderId", "status", "cancelAtPeriodEnd", "currentPeriodEnd", "updatedAt"]);
    const status = requiredString(entry, "status", 40);
    if (!subscriptionStatuses.has(status)) throw new BillingHttpError(503, "billing_database_invalid");
    return {
      subscriptionId: requiredUuid(entry, "subscriptionId"), userId: requiredUuid(entry, "userId"),
      originatingOrderId: nullableUuid(entry, "originatingOrderId"), status,
      cancelAtPeriodEnd: requiredBoolean(entry, "cancelAtPeriodEnd"),
      currentPeriodEnd: nullableTimestamp(entry, "currentPeriodEnd"), updatedAt: requiredTimestamp(entry, "updatedAt")
    };
  });
  const disputeStatuses = new Set(["warning_needs_response", "warning_under_review", "needs_response", "under_review", "lost"]);
  const disputeQueue = queue("disputeQueue", ["economic_reconciliation_manage"], (value) => {
    const entry = object(value);
    exactDatabaseKeys(entry, ["disputeId", "orderId", "paymentTransactionId", "status", "reasonCode", "amountMinor", "currency", "createdAt", "updatedAt"]);
    const status = requiredString(entry, "status", 40);
    const reasonCode = nullableText(entry, "reasonCode", 120);
    if (!disputeStatuses.has(status) || (reasonCode !== null && !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(reasonCode))) {
      throw new BillingHttpError(503, "billing_database_invalid");
    }
    return {
      disputeId: requiredUuid(entry, "disputeId"), orderId: requiredUuid(entry, "orderId"),
      paymentTransactionId: requiredUuid(entry, "paymentTransactionId"), status, reasonCode,
      amountMinor: money(entry, "amountMinor", 1), currency: parseCurrency(entry),
      createdAt: requiredTimestamp(entry, "createdAt"), updatedAt: requiredTimestamp(entry, "updatedAt")
    };
  });
  const webhookStatuses = new Set(["received", "failed", "unmatched"]);
  const webhookQueue = queue("webhookQueue", ["economic_reconciliation_manage", "economic_audit_view"], (value) => {
    const entry = object(value);
    exactDatabaseKeys(entry, ["eventId", "eventType", "processingStatus", "processingAttempts", "eventCreatedAt", "receivedAt"]);
    const eventType = safeCode(entry, "eventType", 120);
    const processingStatus = requiredString(entry, "processingStatus", 40);
    if (!webhookStatuses.has(processingStatus)) throw new BillingHttpError(503, "billing_database_invalid");
    return {
      eventId: requiredUuid(entry, "eventId"), eventType, processingStatus,
      processingAttempts: integer(entry, "processingAttempts", 1, 1_000_000),
      eventCreatedAt: requiredTimestamp(entry, "eventCreatedAt"), receivedAt: requiredTimestamp(entry, "receivedAt")
    };
  });
  const reconciliationStatuses = new Set(["open", "investigating", "waiting_for_provider"]);
  const reconciliationCaseKinds = new Set<EconomicOperatorReconciliationCaseKind>([
    "economic_reconciliation_case", "marketplace_fulfillment_hold", "job_post_payment_hold",
    "organization_service_settlement_hold", "sponsorship_settlement_hold"
  ]);
  const reconciliationQueue = queue("reconciliationQueue", ["economic_reconciliation_manage"], (value) => {
    const entry = object(value);
    exactDatabaseKeys(entry, ["caseId", "orderId", "caseKind", "status", "openedAt"]);
    const caseKind = requiredString(entry, "caseKind", 80) as EconomicOperatorReconciliationCaseKind;
    const status = requiredString(entry, "status", 40);
    if (!reconciliationStatuses.has(status) || !reconciliationCaseKinds.has(caseKind)) throw new BillingHttpError(503, "billing_database_invalid");
    return {
      caseId: requiredUuid(entry, "caseId"), orderId: requiredUuid(entry, "orderId"), caseKind, status,
      openedAt: requiredTimestamp(entry, "openedAt")
    };
  });
  const sandboxCorrectionQueue = queue("sandboxCorrectionQueue", ["sandbox_credits_adjust"], (value) => {
    const entry = object(value);
    exactDatabaseKeys(entry, ["shortfallId", "fulfillmentId", "fulfillmentScope", "orderId", "paymentTransactionId", "adjustmentKind", "targetUnits", "appliedUnits", "missingUnits", "status", "createdAt"]);
    const fulfillmentScope = requiredString(entry, "fulfillmentScope", 40) as "sandbox_credit_order" | "recurring_support_payment";
    const orderId = requiredUuid(entry, "orderId");
    const paymentTransactionId = nullableUuid(entry, "paymentTransactionId");
    const adjustmentKind = requiredString(entry, "adjustmentKind", 40);
    const status = requiredString(entry, "status", 40);
    const targetUnits = units(entry, "targetUnits", 1);
    const appliedUnits = units(entry, "appliedUnits");
    const missingUnits = units(entry, "missingUnits", 1);
    if (!new Set(["sandbox_credit_order", "recurring_support_payment"]).has(fulfillmentScope)
      || (fulfillmentScope === "sandbox_credit_order" && paymentTransactionId !== null)
      || (fulfillmentScope === "recurring_support_payment" && paymentTransactionId === null)
      || !new Set(["refund_or_lost_dispute", "active_dispute_hold"]).has(adjustmentKind)
      || !new Set(["open", "reviewed"]).has(status) || appliedUnits + missingUnits !== targetUnits) {
      throw new BillingHttpError(503, "billing_database_invalid");
    }
    return { shortfallId: requiredUuid(entry, "shortfallId"), fulfillmentId: requiredUuid(entry, "fulfillmentId"), fulfillmentScope, orderId, paymentTransactionId, adjustmentKind, targetUnits, appliedUnits, missingUnits, status, createdAt: requiredTimestamp(entry, "createdAt") };
  });
  const jobClassifications = new Set(["not_assessed", "community_free", "commercial", "waived", "subsidized"]);
  const jobStatuses = new Set(["not_assessed", "payment_required", "payment_pending", "refunded", "disputed", "reconciliation_required"]);
  const jobPostEconomicQueue = queue("jobPostEconomicQueue", ["job_fee_assess"], (value) => {
    const entry = object(value);
    exactDatabaseKeys(entry, ["conditionId", "jobPostId", "authorUserId", "classification", "status", "orderId", "termsVersion", "updatedAt"]);
    const classification = requiredString(entry, "classification", 40);
    const status = requiredString(entry, "status", 40);
    const termsVersion = nullableText(entry, "termsVersion", 120);
    if (!jobClassifications.has(classification) || !jobStatuses.has(status)
      || (termsVersion !== null && !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(termsVersion))) {
      throw new BillingHttpError(503, "billing_database_invalid");
    }
    return {
      conditionId: requiredUuid(entry, "conditionId"), jobPostId: requiredUuid(entry, "jobPostId"),
      authorUserId: requiredUuid(entry, "authorUserId"), classification, status,
      orderId: nullableUuid(entry, "orderId"), termsVersion, updatedAt: requiredTimestamp(entry, "updatedAt")
    };
  });
  const sellerPayableQueue = queue("sellerPayableQueue", ["marketplace_payout_manage"], (value) => {
    const entry = object(value);
    exactDatabaseKeys(entry, ["sellerAccountId", "currency", "availablePayableMinor", "sellerStatus"]);
    return {
      sellerAccountId: requiredUuid(entry, "sellerAccountId"), currency: parseCurrency(entry),
      availablePayableMinor: money(entry, "availablePayableMinor", 1), sellerStatus: safeCode(entry, "sellerStatus", 40)
    };
  });
  const sellerPayoutPreparationQueue = queue("sellerPayoutPreparationQueue", ["marketplace_payout_manage"], (value) => {
    const entry = object(value);
    exactDatabaseKeys(entry, ["payoutPreparationId", "sellerAccountId", "amountMinor", "currency", "status", "createdAt"]);
    const status = requiredString(entry, "status", 40);
    if (!new Set(["prepared", "transfer_pending"]).has(status)) throw new BillingHttpError(503, "billing_database_invalid");
    return {
      payoutPreparationId: requiredUuid(entry, "payoutPreparationId"), sellerAccountId: requiredUuid(entry, "sellerAccountId"),
      amountMinor: money(entry, "amountMinor", 1), currency: parseCurrency(entry), status,
      createdAt: requiredTimestamp(entry, "createdAt")
    };
  });
  const organizationServiceQueue = queue("organizationServiceQueue", ["organization_billing_manage"], (value) => {
    const entry = object(value);
    exactDatabaseKeys(entry, ["engagementId", "organizationId", "serviceCode", "status", "entitlementState", "supportAgreementState", "orderId", "updatedAt"]);
    const status = requiredString(entry, "status", 40);
    const entitlementState = requiredString(entry, "entitlementState", 40);
    const supportAgreementState = requiredString(entry, "supportAgreementState", 40);
    if (!new Set(["contract_pending", "active", "reconciliation_required"]).has(status)
      || !new Set(["pending", "active", "fulfilled", "suspended", "ended"]).has(entitlementState)
      || !new Set(["pending", "active", "suspended", "expired", "terminated", "not_applicable"]).has(supportAgreementState)) {
      throw new BillingHttpError(503, "billing_database_invalid");
    }
    return {
      engagementId: requiredUuid(entry, "engagementId"), organizationId: requiredUuid(entry, "organizationId"),
      serviceCode: safeCode(entry, "serviceCode", 100), status, entitlementState, supportAgreementState,
      orderId: nullableUuid(entry, "orderId"), updatedAt: requiredTimestamp(entry, "updatedAt")
    };
  });
  const sponsorshipQueue = queue("sponsorshipQueue", ["sponsorship_manage"], (value) => {
    const entry = object(value);
    exactDatabaseKeys(entry, ["sponsorshipAgreementId", "organizationId", "status", "purposeCode", "publicRecognitionOptIn", "publicRecognitionApproved", "orderId", "updatedAt"]);
    const status = requiredString(entry, "status", 40);
    const publicRecognitionOptIn = requiredBoolean(entry, "publicRecognitionOptIn");
    const publicRecognitionApproved = requiredBoolean(entry, "publicRecognitionApproved");
    if (!new Set(["ethical_review", "contract_pending", "active", "reconciliation_required"]).has(status)
      || (publicRecognitionApproved && !publicRecognitionOptIn)) throw new BillingHttpError(503, "billing_database_invalid");
    return {
      sponsorshipAgreementId: requiredUuid(entry, "sponsorshipAgreementId"), organizationId: requiredUuid(entry, "organizationId"),
      status, purposeCode: safeCode(entry, "purposeCode", 100), publicRecognitionOptIn, publicRecognitionApproved,
      orderId: nullableUuid(entry, "orderId"), updatedAt: requiredTimestamp(entry, "updatedAt")
    };
  });
  const accountRequestTypes = new Set(["data_export", "economic_account_closure"]);
  const accountRequestStatuses = new Set(["submitted", "identity_verification", "operator_review", "processing"]);
  const accountRequestQueue = queue("accountRequestQueue", ["economic_account_requests_manage"], (value) => {
    const entry = object(value);
    exactDatabaseKeys(entry, ["requestId", "requestType", "status", "submittedAt", "providerCancellationRequired"]);
    const requestType = requiredString(entry, "requestType", 40);
    const status = requiredString(entry, "status", 40);
    if (!accountRequestTypes.has(requestType) || !accountRequestStatuses.has(status)) {
      throw new BillingHttpError(503, "billing_database_invalid");
    }
    return {
      requestId: requiredUuid(entry, "requestId"), requestType, status,
      submittedAt: requiredTimestamp(entry, "submittedAt"),
      providerCancellationRequired: requiredBoolean(entry, "providerCancellationRequired")
    };
  });
  const assistanceKinds = new Set(["waiver", "subsidy", "sponsored_access"]);
  const assistanceScopes = new Set(["job_post_fee", "sandbox_credits"]);
  const assistanceProgramStatuses = new Set(["draft", "active", "paused", "retired"]);
  const assistanceProgramQueue = queue("assistanceProgramQueue", ["economic_assistance_manage"], (value) => {
    const entry = object(value);
    exactDatabaseKeys(entry, ["programId", "programCode", "kind", "scope", "status", "startsAt", "endsAt", "updatedAt"]);
    const kind = requiredString(entry, "kind", 40);
    const scope = requiredString(entry, "scope", 40);
    const status = requiredString(entry, "status", 40);
    if (!assistanceKinds.has(kind) || !assistanceScopes.has(scope) || !assistanceProgramStatuses.has(status)) {
      throw new BillingHttpError(503, "billing_database_invalid");
    }
    return {
      programId: requiredUuid(entry, "programId"), programCode: safeCode(entry, "programCode", 100), kind, scope, status,
      startsAt: requiredTimestamp(entry, "startsAt"), endsAt: nullableTimestamp(entry, "endsAt"), updatedAt: requiredTimestamp(entry, "updatedAt")
    };
  });
  const assistanceStatuses = new Set(["granted", "consumed", "revoked", "expired"]);
  const assistanceQueue = queue("assistanceQueue", ["economic_assistance_manage"], (value) => {
    const entry = object(value);
    exactDatabaseKeys(entry, ["grantId", "scope", "status", "expiresAt"]);
    const scope = requiredString(entry, "scope", 40);
    const status = requiredString(entry, "status", 40);
    if (!assistanceScopes.has(scope) || !assistanceStatuses.has(status)) {
      throw new BillingHttpError(503, "billing_database_invalid");
    }
    return { grantId: requiredUuid(entry, "grantId"), scope, status, expiresAt: nullableTimestamp(entry, "expiresAt") };
  });
  const rawFeatureFlags = row.featureFlags;
  if (!capabilitySet.has("economic_feature_flags_manage") && rawFeatureFlags !== null) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  if (capabilitySet.has("economic_feature_flags_manage")
    && (!Array.isArray(rawFeatureFlags) || rawFeatureFlags.length !== ECONOMIC_OPERATOR_FEATURE_FLAG_KEYS.length)) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  const featureFlags = !capabilitySet.has("economic_feature_flags_manage") ? null : (rawFeatureFlags as unknown[]).map((value) => {
    const entry = object(value);
    exactDatabaseKeys(entry, ["featureKey", "enabled", "testModeOnly", "updatedAt"]);
    return {
      featureKey: safeCode(entry, "featureKey", 80), enabled: requiredBoolean(entry, "enabled"),
      testModeOnly: requiredBoolean(entry, "testModeOnly"), updatedAt: requiredTimestamp(entry, "updatedAt")
    };
  });
  if (featureFlags && featureFlags.some((flag, index) => flag.featureKey !== ECONOMIC_OPERATOR_FEATURE_FLAG_KEYS[index])) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  const authorized = requiredBoolean(row, "authorized");
  if (authorized !== (capabilities.length > 0)) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    authorized,
    capabilities: capabilities as string[],
    queueLimit: 10,
    orderQueue,
    paymentQueue,
    refundablePaymentQueue,
    refundQueue,
    subscriptionQueue,
    disputeQueue,
    webhookQueue,
    reconciliationQueue,
    sandboxCorrectionQueue,
    jobPostEconomicQueue,
    sellerPayableQueue,
    sellerPayoutPreparationQueue,
    organizationServiceQueue,
    sponsorshipQueue,
    accountRequestQueue,
    assistanceProgramQueue,
    assistanceQueue,
    featureFlags,
    providerIdentifiersExposed: false,
    personalContactDataExposed: false,
    testMode: row.testMode === true
  };
}

export type EconomicAuditQuery = {
  afterCreatedAt: string | null;
  afterId: string | null;
  limit: number;
};

export type EconomicAuditEvent = {
  eventId: string;
  action: string;
  targetType: string;
  targetId: string | null;
  actorKind: "system" | "user" | "economic_operator" | "provider_webhook";
  createdAt: string;
};

export async function loadCurrentEconomicAuditEvents(
  supabase: SupabaseClient,
  query: EconomicAuditQuery
): Promise<{
  events: EconomicAuditEvent[];
  limit: number;
  nextCursor: { afterCreatedAt: string; afterId: string } | null;
  providerIdentifiersExposed: false;
  personalContactDataExposed: false;
  testMode: boolean;
}> {
  const { data, error } = await supabase.rpc("current_user_economic_audit_events", {
    p_after_created_at: query.afterCreatedAt,
    p_after_id: query.afterId,
    p_limit: query.limit
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  exactDatabaseKeys(row, ["events", "limit", "providerIdentifiersExposed", "personalContactDataExposed", "testMode"]);
  if (
    row.limit !== query.limit || !Array.isArray(row.events) || row.events.length > query.limit
    || row.providerIdentifiersExposed !== false || row.personalContactDataExposed !== false || typeof row.testMode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  const actorKinds = new Set(["system", "user", "economic_operator", "provider_webhook"]);
  const events = row.events.map((value): EconomicAuditEvent => {
    const event = object(value);
    exactDatabaseKeys(event, ["eventId", "action", "targetType", "targetId", "actorKind", "createdAt"]);
    const actorKind = requiredString(event, "actorKind", 40);
    if (!actorKinds.has(actorKind)) throw new BillingHttpError(503, "billing_database_invalid");
    return {
      eventId: requiredUuid(event, "eventId"),
      action: requiredString(event, "action", 160),
      targetType: requiredString(event, "targetType", 120),
      targetId: event.targetId === null ? null : requiredUuid(event, "targetId"),
      actorKind: actorKind as EconomicAuditEvent["actorKind"],
      createdAt: requiredTimestamp(event, "createdAt")
    };
  });
  const last = events.length === query.limit ? events.at(-1) ?? null : null;
  return {
    events, limit: query.limit,
    nextCursor: last ? { afterCreatedAt: last.createdAt, afterId: last.eventId } : null,
    providerIdentifiersExposed: false, personalContactDataExposed: false, testMode: row.testMode === true
  };
}

export type OperatorSandboxCreditGrantResult = {
  creditLotId: string;
  grantedUnits: number;
  sourceCategory: string;
  expiresAt: string | null;
  idempotentReplay: boolean;
  testMode: boolean;
};

export async function grantOperatorSandboxCredits(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorSandboxCreditGrantRequest
): Promise<OperatorSandboxCreditGrantResult> {
  const { data, error } = await supabase.rpc("operator_grant_sandbox_credit_units", {
    p_actor_user_id: actorUserId,
    p_user_id: input.userId,
    p_units: input.units,
    p_source_type: input.sourceType,
    p_source_reference: input.sourceReference,
    p_expires_at: input.expiresAt,
    p_idempotency_key: input.idempotencyKey,
    p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  const creditLotId = requiredString(row, "creditLotId", 64);
  if (!isUuid(creditLotId) || typeof row.testMode !== "boolean") throw new BillingHttpError(503, "billing_database_invalid");
  const sourceCategory = requiredString(row, "sourceCategory", 40);
  const grantedUnits = integer(row, "grantedUnits", 1, 1_000_000_000);
  if (sourceCategory !== input.sourceType || grantedUnits !== input.units) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  return {
    creditLotId,
    grantedUnits,
    sourceCategory,
    expiresAt: nullableTimestamp(row, "expiresAt"),
    idempotentReplay: requiredBoolean(row, "idempotentReplay"),
    testMode: row.testMode === true
  };
}

export type OperatorRefundHoldResult = {
  refundRequestId: string;
  orderId: string;
  paymentTransactionId: string;
  amountMinor: number;
  currency: string;
  status: string;
  idempotentReplay: boolean;
};

export async function placeOperatorRefundHold(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorRefundHoldRequest
): Promise<OperatorRefundHoldResult> {
  const { data, error } = await supabase.rpc("operator_place_refund_hold", {
    p_actor_user_id: actorUserId,
    p_order_id: input.orderId,
    p_payment_transaction_id: input.paymentTransactionId,
    p_amount_minor: input.amountMinor,
    p_client_request_id: input.clientRequestId,
    p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  const refundRequestId = requiredString(row, "refundRequestId", 64);
  const orderId = requiredString(row, "orderId", 64);
  const paymentTransactionId = requiredString(row, "paymentTransactionId", 64);
  const currency = requiredString(row, "currency", 3).toLowerCase();
  const status = requiredString(row, "status", 40);
  const amountMinor = integer(row, "amountMinor", 1, 1_000_000_000);
  if (
    !isUuid(refundRequestId)
    || !isUuid(orderId)
    || !isUuid(paymentTransactionId)
    || orderId !== input.orderId
    || paymentTransactionId !== input.paymentTransactionId
    || amountMinor !== input.amountMinor
    || !/^[a-z]{3}$/.test(currency)
    || !["held_for_review", "approved_for_provider", "provider_pending", "completed", "rejected", "canceled"].includes(status)
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    refundRequestId,
    orderId,
    paymentTransactionId,
    amountMinor,
    currency,
    status,
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

export type OperatorTestRefundPreparation = {
  refundRequestId: string;
  orderId: string;
  providerPaymentReference: string;
  amountMinor: number;
  currency: "usd";
  providerIdempotencyKey: string;
  idempotentReplay: boolean;
};

export async function prepareOperatorTestRefund(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorTestRefundExecutionRequest
): Promise<OperatorTestRefundPreparation> {
  const { data, error } = await supabase.rpc("operator_prepare_test_refund", {
    p_actor_user_id: actorUserId,
    p_refund_request_id: input.refundRequestId,
    p_approval_client_request_id: input.approvalClientRequestId,
    p_confirmation: input.confirmation,
    p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  const refundRequestId = requiredString(row, "refundRequestId", 64);
  const orderId = requiredString(row, "orderId", 64);
  const provider = requiredString(row, "provider", 20);
  const providerPaymentReference = requiredString(row, "providerPaymentReference", 255);
  const currency = requiredString(row, "currency", 3).toLowerCase();
  const providerIdempotencyKey = requiredString(row, "providerIdempotencyKey", 255);
  const status = requiredString(row, "status", 40);
  if (
    !isUuid(refundRequestId)
    || refundRequestId !== input.refundRequestId
    || !isUuid(orderId)
    || provider !== "stripe"
    || !/^pi_[A-Za-z0-9_]{3,250}$/.test(providerPaymentReference)
    || currency !== "usd"
    || providerIdempotencyKey !== `refund:${refundRequestId}`
    || !["approved_for_provider", "provider_pending", "completed", "rejected", "canceled"].includes(status)
    || typeof row.testMode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    refundRequestId,
    orderId,
    providerPaymentReference,
    amountMinor: integer(row, "amountMinor", 1, 1_000_000_000),
    currency,
    providerIdempotencyKey,
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

export type OperatorTestRefundResult = {
  refundRequestId: string;
  orderId: string;
  economicRefundId: string | null;
  status: string;
  providerStatus: ProviderRefundResult["status"];
  idempotentReplay: boolean;
  testMode: boolean;
};

export async function attachOperatorTestRefundResult(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorTestRefundExecutionRequest,
  providerResult: ProviderRefundResult
): Promise<OperatorTestRefundResult> {
  const { data, error } = await supabase.rpc("attach_economic_test_refund_result", {
    p_actor_user_id: actorUserId,
    p_refund_request_id: input.refundRequestId,
    p_provider_attach_client_request_id: input.providerAttachClientRequestId,
    p_provider_refund_reference: providerResult.providerRefundReference,
    p_provider_status: providerResult.status,
    p_provider_event_created_at: providerResult.providerEventCreatedAt,
    p_provider_response_sha256: providerResult.providerResponseSha256,
    p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  const refundRequestId = requiredString(row, "refundRequestId", 64);
  const orderId = requiredString(row, "orderId", 64);
  const status = requiredString(row, "status", 40);
  const providerStatus = requiredString(row, "providerStatus", 40);
  const rawEconomicRefundId = row.economicRefundId;
  const economicRefundId = rawEconomicRefundId === null || rawEconomicRefundId === undefined
    ? null
    : requiredString(row, "economicRefundId", 64);
  if (
    !isUuid(refundRequestId)
    || refundRequestId !== input.refundRequestId
    || !isUuid(orderId)
    || (economicRefundId !== null && !isUuid(economicRefundId))
    || !["provider_pending", "completed", "rejected", "canceled"].includes(status)
    || !["pending", "succeeded", "failed", "canceled"].includes(providerStatus)
    || providerStatus !== providerResult.status
    || typeof row.testMode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    refundRequestId,
    orderId,
    economicRefundId,
    status,
    providerStatus: providerStatus as ProviderRefundResult["status"],
    idempotentReplay: requiredBoolean(row, "idempotentReplay"),
    testMode: row.testMode === true
  };
}

export type OperatorReconciliationResult = {
  reconciliationCaseId: string;
  orderId: string;
  status: string;
  idempotentReplay: boolean;
};

export async function markOperatorReconciliationNeeded(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorReconciliationRequest
): Promise<OperatorReconciliationResult> {
  const { data, error } = await supabase.rpc("operator_mark_reconciliation_needed", {
    p_actor_user_id: actorUserId,
    p_order_id: input.orderId,
    p_client_request_id: input.clientRequestId,
    p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  const reconciliationCaseId = requiredString(row, "reconciliationCaseId", 64);
  const orderId = requiredString(row, "orderId", 64);
  const status = requiredString(row, "status", 40);
  if (
    !isUuid(reconciliationCaseId)
    || !isUuid(orderId)
    || orderId !== input.orderId
    || !["open", "investigating", "waiting_for_provider", "resolved", "closed_no_change"].includes(status)
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    reconciliationCaseId,
    orderId,
    status,
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

export type OperatorAssignmentResult = {
  assignmentId: string | null;
  userId: string;
  capability: OperatorAssignmentRequest["capability"];
  active: boolean;
  idempotentReplay: boolean;
};

export async function setEconomicOperatorAssignment(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorAssignmentRequest
): Promise<OperatorAssignmentResult> {
  const { data, error } = await supabase.rpc("set_economic_operator_assignment", {
    p_actor_user_id: actorUserId,
    p_user_id: input.userId,
    p_capability: input.capability,
    p_enabled: input.enabled,
    p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  const rawAssignmentId = row.assignmentId;
  const assignmentId = rawAssignmentId === null ? null : requiredString(row, "assignmentId", 64);
  const userId = requiredString(row, "userId", 64);
  const capability = requiredString(row, "capability", 80);
  const active = requiredBoolean(row, "active");
  if (
    (assignmentId !== null && !isUuid(assignmentId))
    || !isUuid(userId)
    || userId !== input.userId
    || !ECONOMIC_OPERATOR_CAPABILITIES.has(capability)
    || capability !== input.capability
    || active !== input.enabled
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    assignmentId,
    userId,
    capability: capability as OperatorAssignmentRequest["capability"],
    active,
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

const JOB_POST_ECONOMIC_STATUSES = new Set([
  "not_assessed", "not_required", "payment_required", "payment_pending",
  "satisfied", "waived", "subsidized", "refunded", "disputed", "reconciliation_required"
]);
const COMMUNE_POST_STATUSES = new Set([
  "draft", "pending_review", "in_review", "needs_information", "approved", "published",
  "rejected", "hidden", "archived", "deleted_by_user", "removed_by_moderator"
]);

export type OperatorJobPostFeeAssessmentResult = {
  jobPostId: string;
  classification: OperatorJobPostFeeAssessmentRequest["classification"];
  economicStatus: string;
  publicationStatus: string | null;
  published: boolean;
  idempotentReplay: boolean;
};

export async function assessOperatorJobPostFee(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorJobPostFeeAssessmentRequest
): Promise<OperatorJobPostFeeAssessmentResult> {
  const { data, error } = await supabase.rpc("operator_assess_job_post_fee", {
    p_actor_user_id: actorUserId,
    p_job_post_id: input.jobPostId,
    p_classification: input.classification,
    p_price_code: input.priceCode,
    p_waiver_id: input.waiverId,
    p_subsidy_id: input.subsidyId,
    p_client_request_id: input.clientRequestId,
    p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  const jobPostId = requiredString(row, "jobPostId", 64);
  const classification = requiredString(row, "classification", 40);
  const economicStatus = requiredString(row, "economicStatus", 40);
  const publicationStatus = row.publicationStatus === null || row.publicationStatus === undefined
    ? null
    : requiredString(row, "publicationStatus", 40);
  if (
    !isUuid(jobPostId)
    || jobPostId !== input.jobPostId
    || classification !== input.classification
    || !JOB_POST_ECONOMIC_STATUSES.has(economicStatus)
    || (publicationStatus !== null && !COMMUNE_POST_STATUSES.has(publicationStatus))
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    jobPostId,
    classification: classification as OperatorJobPostFeeAssessmentRequest["classification"],
    economicStatus,
    publicationStatus,
    published: requiredBoolean(row, "published"),
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

export type JobPostCheckoutPreparation = CheckoutPreparation & { jobPostId: string; postId: string };

export type CurrentUserJobPostEconomicStatus = {
  jobPostId: string;
  classification: JobPostEconomicClassification | "not_assessed";
  economicStatus: string;
  contentApproved: boolean;
  publicationStatus: string;
  published: boolean;
  amountMinor: number | null;
  currency: "usd" | null;
  termsVersion: string | null;
  testMode: boolean;
};

export async function loadCurrentUserJobPostEconomicStatus(
  supabase: SupabaseClient,
  jobPostId: string
): Promise<CurrentUserJobPostEconomicStatus> {
  const { data, error } = await supabase.rpc("current_user_job_post_economic_status", {
    p_job_post_id: jobPostId
  });
  if (error) {
    if (error.code === "42501") throw new BillingHttpError(403, "job_post_status_forbidden");
    if (error.code === "P0002") throw new BillingHttpError(404, "job_post_economic_status_not_found");
    throw new BillingHttpError(503, "job_post_status_unavailable");
  }
  const row = object(data);
  const expectedKeys = new Set([
    "job_post_id", "classification", "economic_status", "content_approved",
    "publication_status", "published", "amount_minor", "currency", "terms_version", "test_mode"
  ]);
  const returnedJobPostId = requiredString(row, "job_post_id", 64);
  const classification = requiredString(row, "classification", 40);
  const economicStatus = requiredString(row, "economic_status", 40);
  const publicationStatus = requiredString(row, "publication_status", 40);
  const amountMinor = row.amount_minor === null || row.amount_minor === undefined
    ? null
    : integer(row, "amount_minor", 1, 100_000_000);
  const currency = row.currency === null || row.currency === undefined
    ? null
    : requiredString(row, "currency", 3).toLowerCase();
  const termsVersion = row.terms_version === null || row.terms_version === undefined
    ? null
    : requiredString(row, "terms_version", 120);
  if (
    Object.keys(row).length !== expectedKeys.size
    || Object.keys(row).some((key) => !expectedKeys.has(key))
    || !isUuid(returnedJobPostId)
    || returnedJobPostId !== jobPostId
    || !new Set(["not_assessed", "community_free", "commercial", "waived", "subsidized"]).has(classification)
    || !JOB_POST_ECONOMIC_STATUSES.has(economicStatus)
    || !COMMUNE_POST_STATUSES.has(publicationStatus)
    || (amountMinor === null) !== (currency === null)
    || (currency !== null && currency !== "usd")
    || (termsVersion !== null && !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(termsVersion))
    || (classification === "commercial") !== (termsVersion !== null)
    || typeof row.test_mode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    jobPostId: returnedJobPostId,
    classification: classification as JobPostEconomicClassification | "not_assessed",
    economicStatus,
    contentApproved: requiredBoolean(row, "content_approved"),
    publicationStatus,
    published: requiredBoolean(row, "published"),
    amountMinor,
    currency: currency as "usd" | null,
    termsVersion,
    testMode: row.testMode === true
  };
}

export async function prepareJobPostCheckout(
  supabase: SupabaseClient,
  actorUserId: string,
  input: JobPostCheckoutRequest
): Promise<JobPostCheckoutPreparation> {
  const { data, error } = await supabase.rpc("prepare_job_post_economic_checkout", {
    p_actor_user_id: actorUserId,
    p_job_post_id: input.jobPostId,
    p_client_request_id: input.clientRequestId,
    p_source_route: input.sourceRoute,
    p_consent_version: input.consentVersion
  });
  if (error) {
    if (error.code === "42501") throw new BillingHttpError(403, "job_post_checkout_forbidden");
    if (error.code === "P0002" || error.code === "23503") throw new BillingHttpError(404, "job_post_not_found");
    if (error.code === "23505") throw new BillingHttpError(409, "job_post_checkout_conflict");
    if (error.code === "22023" || error.code === "55000") throw new BillingHttpError(409, "job_post_checkout_unavailable");
    throw new BillingHttpError(503, "job_post_checkout_unavailable");
  }
  const row = object(data);
  const preparation = checkoutPreparation(row);
  const jobPostId = requiredString(row, "jobPostId", 64);
  const postId = requiredString(row, "postId", 64);
  if (
    !isUuid(jobPostId)
    || jobPostId !== input.jobPostId
    || !isUuid(postId)
    || preparation.amountMinor < 1
    || (!preparation.providerPriceReference && !preparation.providerProductReference)
  ) throw new BillingHttpError(503, "billing_catalog_unavailable");
  return { ...preparation, jobPostId, postId };
}

export type SandboxCreditCheckoutPreparation = CheckoutPreparation & {
  packCode: string;
  grantedUnits: number;
  expiresAfterDays: number | null;
  testMode: boolean;
};

export async function prepareSandboxCreditCheckout(
  supabase: SupabaseClient,
  actorUserId: string,
  input: SandboxCreditCheckoutRequest
): Promise<SandboxCreditCheckoutPreparation> {
  const { data, error } = await supabase.rpc("prepare_sandbox_credit_checkout", {
    p_actor_user_id: actorUserId,
    p_client_request_id: input.clientRequestId,
    p_pack_code: input.packCode,
    p_source_route: input.sourceRoute,
    p_consent_version: input.consentVersion
  });
  if (error) {
    if (error.code === "42501") throw new BillingHttpError(403, "sandbox_credit_checkout_forbidden");
    if (error.code === "P0002") throw new BillingHttpError(404, "sandbox_credit_pack_not_found");
    if (error.code === "23505") throw new BillingHttpError(409, "sandbox_credit_checkout_conflict");
    if (error.code === "22023" || error.code === "55000") throw new BillingHttpError(409, "sandbox_credit_checkout_unavailable");
    throw new BillingHttpError(503, "sandbox_credit_checkout_unavailable");
  }
  const row = object(data);
  const preparation = checkoutPreparation(row);
  const packCode = requiredString(row, "packCode", 93);
  const expiresAfterDays = row.expiresAfterDays === null || row.expiresAfterDays === undefined
    ? null
    : integer(row, "expiresAfterDays", 1, 3650);
  if (
    packCode !== input.packCode
    || !/^sandbox_test_[a-z0-9]+(?:_[a-z0-9]+)*$/.test(packCode)
    || preparation.amountMinor < 1
    || (!preparation.providerPriceReference && !preparation.providerProductReference)
    || row.rateApprovedForLiveUse !== false
    || row.automaticPurchase !== false
    || row.safetyPrivilegesChanged !== false
    || typeof row.testMode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    ...preparation,
    packCode,
    grantedUnits: integer(row, "grantedUnits", 1, 1_000_000_000),
    expiresAfterDays,
    testMode: row.testMode === true
  };
}

export type SandboxCreditPackSummary = {
  packCode: string;
  amountMinor: number;
  currency: "usd";
  grantedUnits: number;
  expiresAfterDays: number | null;
  disclosureVersion: string;
  testMode: boolean;
};

export type SandboxCreditPackCatalog = {
  available: boolean;
  packs: SandboxCreditPackSummary[];
  testMode: boolean;
};

export async function loadSandboxCreditPackCatalog(supabase: SupabaseClient): Promise<SandboxCreditPackCatalog> {
  const { data, error } = await supabase.rpc("sandbox_credit_pack_catalog");
  if (error) throw new BillingHttpError(503, "sandbox_credit_catalog_unavailable");
  const row = object(data);
  const available = requiredBoolean(row, "available");
  if (typeof row.testMode !== "boolean" || !Array.isArray(row.packs) || row.packs.length > 100) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  const seen = new Set<string>();
  const packs = row.packs.map((value): SandboxCreditPackSummary => {
    const pack = object(value);
    const packCode = requiredString(pack, "packCode", 93);
    const currency = requiredString(pack, "currency", 3).toLowerCase();
    const disclosureVersion = requiredString(pack, "disclosureVersion", 120);
    const expiresAfterDays = pack.expiresAfterDays === null || pack.expiresAfterDays === undefined
      ? null
      : integer(pack, "expiresAfterDays", 1, 3650);
    if (
      !/^sandbox_test_[a-z0-9]+(?:_[a-z0-9]+)*$/.test(packCode)
      || seen.has(packCode)
      || currency !== "usd"
      || /[\u0000-\u001f\u007f]/.test(disclosureVersion)
      || pack.testMode !== true
    ) throw new BillingHttpError(503, "billing_database_invalid");
    seen.add(packCode);
    return {
      packCode,
      amountMinor: integer(pack, "amountMinor", 1, 1_000_000_000),
      currency,
      grantedUnits: integer(pack, "grantedUnits", 1, 1_000_000_000),
      expiresAfterDays,
      disclosureVersion,
      testMode: row.testMode === true
    };
  });
  if (!available && packs.length > 0) throw new BillingHttpError(503, "billing_database_invalid");
  return { available, packs, testMode: row.testMode === true };
}

function marketplaceRpcFailure(error: { code?: string } | null, fallback: string): BillingHttpError {
  if (error?.code === "42501") return new BillingHttpError(403, `${fallback}_forbidden`);
  if (error?.code === "P0002" || error?.code === "23503") return new BillingHttpError(404, `${fallback}_not_found`);
  if (error?.code === "23505") return new BillingHttpError(409, `${fallback}_conflict`);
  if (error?.code === "22023" || error?.code === "55000") return new BillingHttpError(409, `${fallback}_unavailable`);
  return new BillingHttpError(503, `${fallback}_unavailable`);
}

function marketplaceDocumentVersion(row: Row, key: string): string {
  const value = requiredString(row, key, 120);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:+-]{0,119}$/.test(value)) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  return value;
}

function requiredUuid(row: Row, key: string): string {
  const value = requiredString(row, key, 64);
  if (!isUuid(value)) throw new BillingHttpError(503, "billing_database_invalid");
  return value;
}

function nullableDatabaseUuid(row: Row, key: string): string | null {
  return row[key] === null ? null : requiredUuid(row, key);
}

function requiredTimestamp(row: Row, key: string): string {
  const value = nullableTimestamp(row, key);
  if (!value) throw new BillingHttpError(503, "billing_database_invalid");
  return value;
}

export type SellerPreparation = {
  sellerAccountId: string;
  providerAccountReference: string | null;
  accountIdempotencyKey: string;
  linkIdempotencyKey: string;
  status: string;
  onboardingRequestId: string;
  testMode: boolean;
  idempotentReplay: boolean;
};

export async function prepareSellerOnboarding(
  supabase: SupabaseClient,
  actorUserId: string,
  input: SellerOnboardingRequest
): Promise<SellerPreparation> {
  const { data, error } = await supabase.rpc("prepare_economic_seller_onboarding", {
    p_actor_user_id: actorUserId,
    p_client_request_id: input.clientRequestId,
    p_seller_agreement_version: input.sellerAgreementVersion,
    p_stripe_connect_disclosure_version: input.stripeConnectDisclosureVersion,
    p_consent_source_route: input.sourceRoute
  });
  if (error) throw marketplaceRpcFailure(error, "seller_onboarding");
  const row = object(data);
  const sellerAccountId = requiredUuid(row, "sellerAccountId");
  const status = requiredString(row, "status", 40);
  const providerAccountReference = nullableReference(row, "providerAccountReference", /^acct_[A-Za-z0-9]{3,250}$/);
  const providerAccountAttached = requiredBoolean(row, "providerAccountAttached");
  const accountIdempotencyKey = requiredString(row, "providerIdempotencyKey", 255);
  const onboardingRequestId = requiredUuid(row, "onboardingRequestId");
  const idempotentReplay = requiredBoolean(row, "idempotentReplay");
  if (
    !["pending", "onboarding", "ready"].includes(status)
    || providerAccountAttached !== (providerAccountReference !== null)
    || accountIdempotencyKey !== `seller-account:${sellerAccountId}`
    || marketplaceDocumentVersion(row, "sellerAgreementVersion") !== input.sellerAgreementVersion
    || marketplaceDocumentVersion(row, "stripeConnectDisclosureVersion") !== input.stripeConnectDisclosureVersion
    || typeof row.testMode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    sellerAccountId,
    providerAccountReference,
    accountIdempotencyKey,
    linkIdempotencyKey: `seller-link:${onboardingRequestId}`,
    status,
    onboardingRequestId,
    testMode: row.testMode === true,
    idempotentReplay
  };
}

export async function acceptMarketplaceFreeSellerAgreement(
  supabase: SupabaseClient,
  actorUserId: string,
  input: MarketplaceFreeSellerAgreementRequest
): Promise<{
  sellerAccountId: string;
  agreementVersion: string;
  connectRequiredForFreeOffers: false;
  testMode: boolean;
  idempotentReplay: boolean;
}> {
  const { data, error } = await supabase.rpc("accept_marketplace_free_seller_agreement", {
    p_actor_user_id: actorUserId,
    p_client_request_id: input.clientRequestId,
    p_agreement_version: input.agreementVersion,
    p_consent_source_route: input.sourceRoute
  });
  if (error) throw marketplaceRpcFailure(error, "marketplace_free_seller_agreement");
  const row = object(data);
  if (
    Object.keys(row).length !== 5
    || row.agreementVersion !== input.agreementVersion
    || row.connectRequiredForFreeOffers !== false
    || typeof row.testMode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    sellerAccountId: requiredUuid(row, "sellerAccountId"),
    agreementVersion: input.agreementVersion,
    connectRequiredForFreeOffers: false,
    testMode: row.testMode === true,
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

export async function attachSellerProviderAccount(
  supabase: SupabaseClient,
  sellerAccountId: string,
  providerAccountReference: string
): Promise<void> {
  const { error } = await supabase.rpc("attach_economic_seller_provider_account", {
    p_seller_account_id: sellerAccountId,
    p_provider: "stripe",
    p_provider_account_reference: providerAccountReference
  });
  if (error) throw marketplaceRpcFailure(error, "seller_account_recording");
}

export type SellerProviderContext = {
  sellerAccountId: string;
  status: string;
  providerAccountReference: string | null;
  idempotentReplay: boolean;
};

export async function loadSellerProviderContext(
  supabase: SupabaseClient,
  actorUserId: string,
  clientRequestId: string
): Promise<SellerProviderContext> {
  const { data, error } = await supabase.rpc("get_economic_seller_provider_context", {
    p_actor_user_id: actorUserId,
    p_client_request_id: clientRequestId
  });
  if (error) throw marketplaceRpcFailure(error, "seller_account");
  const row = object(data);
  const provider = row.provider === null || row.provider === undefined ? null : requiredString(row, "provider", 40);
  const providerAccountReference = nullableReference(row, "providerAccountReference", /^acct_[A-Za-z0-9]{3,250}$/);
  const status = requiredString(row, "status", 40);
  if (
    (provider === null) !== (providerAccountReference === null)
    || (provider !== null && provider !== "stripe")
    || !["pending", "onboarding", "ready"].includes(status)
    || typeof row.testMode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    sellerAccountId: requiredUuid(row, "sellerAccountId"),
    status,
    providerAccountReference,
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

export async function recordSellerProviderStatus(
  supabase: SupabaseClient,
  sellerAccountId: string,
  clientRequestId: string,
  provider: ProviderSellerStatus
): Promise<void> {
  const { error } = await supabase.rpc("record_economic_seller_provider_status", {
    p_seller_account_id: sellerAccountId,
    p_client_request_id: clientRequestId,
    p_provider_account_reference: provider.providerAccountReference,
    p_details_submitted: provider.detailsSubmitted,
    p_charges_enabled: provider.chargesEnabled,
    p_payouts_enabled: provider.payoutsEnabled,
    p_disabled_reason: provider.disabledReason,
    p_provider_event_created_at: provider.providerEventCreatedAt,
    p_provider_response_sha256: provider.providerResponseSha256
  });
  if (error) throw marketplaceRpcFailure(error, "seller_status_recording");
}

export type MarketplaceSellerEligibleVersion = {
  addonVersionId: string;
  listingId: string;
  listingSlug: string;
  listingName: string;
  version: string;
};

export type MarketplaceSellerPublisherOption = {
  publisherId: string;
  name: string;
  slug: string;
  verified: boolean;
  linked: boolean;
};

export type MarketplaceSellerOwnedOffer = {
  offerId: string;
  listingId: string;
  addonVersionId: string;
  listingSlug: string;
  listingName: string;
  version: string;
  publisherId: string | null;
  offerKind: "free" | "paid";
  status: "draft" | "active" | "suspended" | "retired";
  priceCode: string | null;
  amountMinor: number | null;
  currency: "usd" | null;
  licenseKey: string;
  licenseVersion: string;
  buyerTermsVersion: string;
  sellerAgreementVersion: string;
  commercialTermsCode: string | null;
  commissionBps: number;
  canRevise: boolean;
  activatedAt: string | null;
  retiredAt: string | null;
  updatedAt: string;
};

export type CurrentSellerStatus = {
  eligible: boolean;
  configured: boolean;
  status: string;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  sellerAgreementVersion: string | null;
  freeSellerAgreementVersion: string | null;
  stripeConnectDisclosureVersion: string | null;
  activeOfferCount: number;
  totalOwnedOfferCount: number;
  offersTruncated: boolean;
  ownedOffers: MarketplaceSellerOwnedOffer[];
  eligibleReviewedVersionCount: number;
  eligibleReviewedVersionsTruncated: boolean;
  eligibleReviewedVersions: MarketplaceSellerEligibleVersion[];
  publisherOptionCount: number;
  publisherOptionsTruncated: boolean;
  publisherOptions: MarketplaceSellerPublisherOption[];
  availablePayableByCurrency: Record<string, number>;
  payableByCurrency: Record<string, number>;
  payoutPreparationEnabled: boolean;
  payoutsEnabledByFeature: false;
  payoutExecutionAvailable: false;
  balancesAreTestRecords: true;
  providerIdentifiersExposed: false;
  testMode: boolean;
};

export async function loadCurrentSellerStatus(supabase: SupabaseClient): Promise<CurrentSellerStatus> {
  const { data, error } = await supabase.rpc("current_user_economic_seller_status");
  if (error) throw marketplaceRpcFailure(error, "seller_status");
  const row = object(data);
  const configured = requiredBoolean(row, "configured");
  const status = requiredString(row, "status", 40);
  if (typeof row.testMode !== "boolean" || (configured ? !["pending", "onboarding", "ready", "restricted", "closed"].includes(status) : status !== "not_configured")) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  if (!configured) {
    return {
      eligible: requiredBoolean(row, "eligible"), configured: false, status,
      detailsSubmitted: false, chargesEnabled: false, payoutsEnabled: false,
      sellerAgreementVersion: null, freeSellerAgreementVersion: null, stripeConnectDisclosureVersion: null,
      activeOfferCount: 0, totalOwnedOfferCount: 0, offersTruncated: false, ownedOffers: [],
      eligibleReviewedVersionCount: 0, eligibleReviewedVersionsTruncated: false,
      eligibleReviewedVersions: [], publisherOptionCount: 0, publisherOptionsTruncated: false,
      publisherOptions: [], availablePayableByCurrency: {}, payableByCurrency: {},
      payoutPreparationEnabled: false, payoutsEnabledByFeature: false,
      payoutExecutionAvailable: false, balancesAreTestRecords: true,
      providerIdentifiersExposed: false, testMode: row.testMode === true
    };
  }
  const rawPayable = object(row.availablePayableByCurrency);
  const rawCompatibilityPayable = object(row.payableByCurrency);
  const payableByCurrency: Record<string, number> = {};
  for (const [currency, amount] of Object.entries(rawPayable)) {
    if (!/^[a-z]{3}$/.test(currency) || !Number.isSafeInteger(amount) || Number(amount) < -1_000_000_000_000 || Number(amount) > 1_000_000_000_000) {
      throw new BillingHttpError(503, "billing_database_invalid");
    }
    payableByCurrency[currency] = Number(amount);
  }
  if (JSON.stringify(rawCompatibilityPayable) !== JSON.stringify(rawPayable)) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  if (!Array.isArray(row.eligibleReviewedVersions) || row.eligibleReviewedVersions.length > 100) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  const eligibleReviewedVersions = row.eligibleReviewedVersions.map((value): MarketplaceSellerEligibleVersion => {
    const version = object(value);
    exactDatabaseKeys(version, ["addonVersionId", "listingId", "listingSlug", "listingName", "version"]);
    const listingSlug = requiredString(version, "listingSlug", 180);
    const listingName = requiredString(version, "listingName", 300);
    const versionLabel = requiredString(version, "version", 120);
    if (!/^[a-z0-9][a-z0-9-]{0,179}$/.test(listingSlug)) throw new BillingHttpError(503, "billing_database_invalid");
    return {
      addonVersionId: requiredUuid(version, "addonVersionId"),
      listingId: requiredUuid(version, "listingId"),
      listingSlug,
      listingName,
      version: versionLabel
    };
  });
  const eligibleReviewedVersionCount = integer(row, "eligibleReviewedVersionCount", 0, 1_000_000);
  const eligibleReviewedVersionsTruncated = requiredBoolean(row, "eligibleReviewedVersionsTruncated");
  if (
    eligibleReviewedVersionCount < eligibleReviewedVersions.length
    || eligibleReviewedVersionsTruncated !== (eligibleReviewedVersionCount > eligibleReviewedVersions.length)
  ) throw new BillingHttpError(503, "billing_database_invalid");
  if (!Array.isArray(row.publisherOptions) || row.publisherOptions.length > 50) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  const publisherOptions = row.publisherOptions.map((value): MarketplaceSellerPublisherOption => {
    const publisher = object(value);
    exactDatabaseKeys(publisher, ["publisherId", "name", "slug", "verified", "linked"]);
    const slug = requiredString(publisher, "slug", 180);
    if (!/^[a-z0-9][a-z0-9-]{0,179}$/.test(slug)) throw new BillingHttpError(503, "billing_database_invalid");
    return {
      publisherId: requiredUuid(publisher, "publisherId"),
      name: requiredString(publisher, "name", 300),
      slug,
      verified: requiredBoolean(publisher, "verified"),
      linked: requiredBoolean(publisher, "linked")
    };
  });
  const publisherOptionCount = integer(row, "publisherOptionCount", 0, 1_000_000);
  const publisherOptionsTruncated = requiredBoolean(row, "publisherOptionsTruncated");
  if (
    publisherOptionCount < publisherOptions.length
    || publisherOptionsTruncated !== (publisherOptionCount > publisherOptions.length)
  ) throw new BillingHttpError(503, "billing_database_invalid");
  if (!Array.isArray(row.ownedOffers) || row.ownedOffers.length > 100) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  const ownedOffers = row.ownedOffers.map((value): MarketplaceSellerOwnedOffer => {
    const offer = object(value);
    exactDatabaseKeys(offer, [
      "offerId", "listingId", "addonVersionId", "listingSlug", "listingName", "version",
      "publisherId", "offerKind", "status", "priceCode", "amountMinor", "currency",
      "licenseKey", "licenseVersion", "buyerTermsVersion", "sellerAgreementVersion",
      "commercialTermsCode", "commissionBps", "canRevise", "activatedAt", "retiredAt", "updatedAt"
    ]);
    const offerKind = requiredString(offer, "offerKind", 20);
    const offerStatus = requiredString(offer, "status", 20);
    const listingSlug = requiredString(offer, "listingSlug", 180);
    const priceCode = offer.priceCode == null ? null : requiredString(offer, "priceCode", 120);
    const amountMinor = nullableInteger(offer, "amountMinor", 50, 10_000_000);
    const currency = offer.currency == null ? null : requiredString(offer, "currency", 3);
    const commercialTermsCode = offer.commercialTermsCode == null
      ? null
      : requiredString(offer, "commercialTermsCode", 117);
    const canRevise = requiredBoolean(offer, "canRevise");
    if (
      !["free", "paid"].includes(offerKind)
      || !["draft", "active", "suspended", "retired"].includes(offerStatus)
      || !/^[a-z0-9][a-z0-9-]{0,179}$/.test(listingSlug)
      || (offerKind === "free"
        ? priceCode !== null || amountMinor !== null || currency !== null || commercialTermsCode !== null
        : priceCode === null || amountMinor === null || currency !== "usd" || commercialTermsCode === null)
      || (canRevise && offerStatus !== "draft")
    ) throw new BillingHttpError(503, "billing_database_invalid");
    return {
      offerId: requiredUuid(offer, "offerId"),
      listingId: requiredUuid(offer, "listingId"),
      addonVersionId: requiredUuid(offer, "addonVersionId"),
      listingSlug,
      listingName: requiredString(offer, "listingName", 300),
      version: marketplaceDocumentVersion(offer, "version"),
      publisherId: nullableDatabaseUuid(offer, "publisherId"),
      offerKind: offerKind as "free" | "paid",
      status: offerStatus as "draft" | "active" | "suspended" | "retired",
      priceCode,
      amountMinor,
      currency: currency as "usd" | null,
      licenseKey: requiredString(offer, "licenseKey", 101),
      licenseVersion: marketplaceDocumentVersion(offer, "licenseVersion"),
      buyerTermsVersion: marketplaceDocumentVersion(offer, "buyerTermsVersion"),
      sellerAgreementVersion: marketplaceDocumentVersion(offer, "sellerAgreementVersion"),
      commercialTermsCode,
      commissionBps: integer(offer, "commissionBps", 0, 5_000),
      canRevise,
      activatedAt: nullableTimestamp(offer, "activatedAt"),
      retiredAt: nullableTimestamp(offer, "retiredAt"),
      updatedAt: requiredTimestamp(offer, "updatedAt")
    };
  });
  const totalOwnedOfferCount = integer(row, "totalOwnedOfferCount", 0, 1_000_000);
  const offersTruncated = requiredBoolean(row, "offersTruncated");
  if (
    totalOwnedOfferCount < ownedOffers.length
    || offersTruncated !== (totalOwnedOfferCount > ownedOffers.length)
  ) throw new BillingHttpError(503, "billing_database_invalid");
  const sellerAgreementVersion = row.sellerAgreementVersion == null ? null : marketplaceDocumentVersion(row, "sellerAgreementVersion");
  const freeSellerAgreementVersion = row.freeSellerAgreementVersion == null ? null : marketplaceDocumentVersion(row, "freeSellerAgreementVersion");
  const stripeConnectDisclosureVersion = row.stripeConnectDisclosureVersion == null ? null : marketplaceDocumentVersion(row, "stripeConnectDisclosureVersion");
  if (
    row.providerIdentifiersExposed !== false
    || row.payoutsEnabledByFeature !== false
    || row.payoutExecutionAvailable !== false
    || row.balancesAreTestRecords !== true
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    eligible: requiredBoolean(row, "eligible"), configured: true, status,
    detailsSubmitted: requiredBoolean(row, "detailsSubmitted"),
    chargesEnabled: requiredBoolean(row, "chargesEnabled"),
    payoutsEnabled: requiredBoolean(row, "payoutsEnabled"),
    sellerAgreementVersion, freeSellerAgreementVersion, stripeConnectDisclosureVersion,
    activeOfferCount: integer(row, "activeOfferCount", 0, 1_000_000),
    totalOwnedOfferCount, offersTruncated, ownedOffers,
    eligibleReviewedVersionCount, eligibleReviewedVersionsTruncated,
    eligibleReviewedVersions,
    publisherOptionCount, publisherOptionsTruncated,
    publisherOptions,
    availablePayableByCurrency: payableByCurrency, payableByCurrency,
    payoutPreparationEnabled: requiredBoolean(row, "payoutPreparationEnabled"),
    payoutsEnabledByFeature: false,
    payoutExecutionAvailable: false,
    balancesAreTestRecords: true,
    providerIdentifiersExposed: false,
    testMode: row.testMode === true
  };
}

export type MarketplaceOfferSummary = {
  offerId: string;
  listingId: string;
  addonVersionId: string;
  listingSlug: string;
  listingName: string;
  version: string;
  offerKind: "free" | "paid";
  amountMinor: number | null;
  currency: "usd" | null;
  licenseKey: string;
  licenseVersion: string;
  buyerTermsVersion: string;
  paymentGrantsTrust: false;
  purchaseInstallsAddon: false;
  testMode: boolean;
};

export async function loadMarketplaceOfferCatalog(supabase: SupabaseClient): Promise<MarketplaceOfferSummary[]> {
  const { data, error } = await supabase.rpc("marketplace_commercial_offer_catalog");
  if (error) throw new BillingHttpError(503, "marketplace_catalog_unavailable");
  if (!Array.isArray(data) || data.length > 1_000) throw new BillingHttpError(503, "billing_database_invalid");
  const seen = new Set<string>();
  return data.map((value): MarketplaceOfferSummary => {
    const row = object(value);
    const offerId = requiredUuid(row, "offerId");
    const offerKind = requiredString(row, "offerKind", 20);
    const amountMinor = row.amountMinor == null ? null : integer(row, "amountMinor", 50, 10_000_000);
    const currency = row.currency == null ? null : requiredString(row, "currency", 3).toLowerCase();
    const listingSlug = requiredString(row, "listingSlug", 200);
    const licenseKey = requiredString(row, "licenseKey", 101);
    if (
      seen.has(offerId)
      || (offerKind !== "free" && offerKind !== "paid")
      || (offerKind === "free" ? amountMinor !== null || currency !== null : amountMinor === null || currency !== "usd")
      || !/^[A-Za-z0-9][A-Za-z0-9._+-]{1,100}$/.test(licenseKey)
      || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(listingSlug)
      || row.paymentGrantsTrust !== false
      || row.purchaseInstallsAddon !== false
      || typeof row.testMode !== "boolean"
    ) throw new BillingHttpError(503, "billing_database_invalid");
    seen.add(offerId);
    return {
      offerId,
      listingId: requiredUuid(row, "listingId"),
      addonVersionId: requiredUuid(row, "addonVersionId"),
      listingSlug,
      listingName: requiredString(row, "listingName", 300),
      version: requiredString(row, "version", 120),
      offerKind,
      amountMinor,
      currency: currency as "usd" | null,
      licenseKey,
      licenseVersion: marketplaceDocumentVersion(row, "licenseVersion"),
      buyerTermsVersion: marketplaceDocumentVersion(row, "buyerTermsVersion"),
      paymentGrantsTrust: false,
      purchaseInstallsAddon: false,
      testMode: row.testMode === true
    };
  });
}

export type MarketplaceCheckoutPreparation =
  | {
      alreadyOwned: true;
      checkoutPrepared: false;
      licenseId: string;
      offerId: string;
      listingId: string;
      addonVersionId: string;
      economicStatus: string;
      installAuthorized: false;
      testMode: boolean;
    }
  | (CheckoutPreparation & {
      alreadyOwned: false;
      purchaseContractId: string;
      offerId: string;
      listingId: string;
      addonVersionId: string;
      licenseKey: string;
      licenseVersion: string;
      installAuthorized: false;
      publicationOrTrustChanged: false;
      testMode: boolean;
    });

export async function prepareMarketplaceCheckout(
  supabase: SupabaseClient,
  actorUserId: string,
  input: MarketplacePurchaseRequest
): Promise<MarketplaceCheckoutPreparation> {
  const { data, error } = await supabase.rpc("prepare_marketplace_purchase_checkout", {
    p_actor_user_id: actorUserId,
    p_client_request_id: input.clientRequestId,
    p_offer_id: input.offerId,
    p_source_route: input.sourceRoute,
    p_consent_version: input.consentVersion
  });
  if (error) throw marketplaceRpcFailure(error, "marketplace_checkout");
  const row = object(data);
  if (row.alreadyOwned === true) {
    if (row.checkoutPrepared !== false || row.installAuthorized !== false || typeof row.testMode !== "boolean") {
      throw new BillingHttpError(503, "billing_database_invalid");
    }
    return {
      alreadyOwned: true,
      checkoutPrepared: false,
      licenseId: requiredUuid(row, "licenseId"),
      offerId: requiredUuid(row, "offerId"),
      listingId: requiredUuid(row, "listingId"),
      addonVersionId: requiredUuid(row, "addonVersionId"),
      economicStatus: requiredString(row, "economicStatus", 40),
      installAuthorized: false,
      testMode: row.testMode === true
    };
  }
  const preparation = checkoutPreparation(row);
  if (
    requiredUuid(row, "offerId") !== input.offerId
    || preparation.amountMinor < 50
    || (!preparation.providerPriceReference && !preparation.providerProductReference)
    || row.installAuthorized !== false
    || row.publicationOrTrustChanged !== false
    || typeof row.testMode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    ...preparation,
    alreadyOwned: false,
    purchaseContractId: requiredUuid(row, "purchaseContractId"),
    offerId: input.offerId,
    listingId: requiredUuid(row, "listingId"),
    addonVersionId: requiredUuid(row, "addonVersionId"),
    licenseKey: requiredString(row, "licenseKey", 101),
    licenseVersion: marketplaceDocumentVersion(row, "licenseVersion"),
    installAuthorized: false,
    publicationOrTrustChanged: false,
    testMode: row.testMode === true
  };
}

export type MarketplaceLicenseResult = {
  licenseId: string;
  offerId: string;
  listingId: string;
  addonVersionId: string;
  licenseKey: string;
  licenseVersion: string;
  economicStatus: string;
  installAuthorized: false;
  testMode: boolean;
};

export async function acceptMarketplaceFreeLicense(
  supabase: SupabaseClient,
  actorUserId: string,
  input: MarketplacePurchaseRequest
): Promise<MarketplaceLicenseResult> {
  const { data, error } = await supabase.rpc("accept_marketplace_free_license", {
    p_actor_user_id: actorUserId,
    p_offer_id: input.offerId,
    p_client_request_id: input.clientRequestId,
    p_consent_version: input.consentVersion
  });
  if (error) throw marketplaceRpcFailure(error, "marketplace_free_license");
  const row = object(data);
  if (requiredUuid(row, "offerId") !== input.offerId || row.installAuthorized !== false || typeof row.testMode !== "boolean") {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  return {
    licenseId: requiredUuid(row, "licenseId"), offerId: input.offerId,
    listingId: requiredUuid(row, "listingId"), addonVersionId: requiredUuid(row, "addonVersionId"),
    licenseKey: requiredString(row, "licenseKey", 101),
    licenseVersion: marketplaceDocumentVersion(row, "licenseVersion"),
    economicStatus: requiredString(row, "economicStatus", 40),
    installAuthorized: false, testMode: row.testMode === true
  };
}

export type MarketplacePurchaseSummary = {
  licenseId: string;
  listingId: string;
  addonVersionId: string;
  listingSlug: string;
  listingName: string;
  version: string;
  licenseKey: string;
  licenseVersion: string;
  acquisitionKind: "free_acceptance" | "paid_order";
  economicStatus: string;
  safetyStatus: "available" | "unavailable" | "revoked";
  installAuthorized: false;
  acquiredAt: string;
  testMode: boolean;
};

export async function loadCurrentMarketplacePurchases(supabase: SupabaseClient): Promise<{ licenses: MarketplacePurchaseSummary[]; testMode: boolean }> {
  const { data, error } = await supabase.rpc("current_user_marketplace_purchases");
  if (error) throw marketplaceRpcFailure(error, "marketplace_purchases");
  const result = object(data);
  if (typeof result.testMode !== "boolean" || !Array.isArray(result.licenses) || result.licenses.length > 1_000) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  const licenses = result.licenses.map((value): MarketplacePurchaseSummary => {
    const row = object(value);
    const acquisitionKind = requiredString(row, "acquisitionKind", 40);
    const safetyStatus = requiredString(row, "safetyStatus", 40);
    if (
      !["free_acceptance", "paid_order"].includes(acquisitionKind)
      || !["available", "unavailable", "revoked"].includes(safetyStatus)
      || row.installAuthorized !== false
    ) throw new BillingHttpError(503, "billing_database_invalid");
    return {
      licenseId: requiredUuid(row, "licenseId"),
      listingId: requiredUuid(row, "listingId"),
      addonVersionId: requiredUuid(row, "addonVersionId"),
      listingSlug: requiredString(row, "listingSlug", 200),
      listingName: requiredString(row, "listingName", 300),
      version: requiredString(row, "version", 120),
      licenseKey: requiredString(row, "licenseKey", 101),
      licenseVersion: marketplaceDocumentVersion(row, "licenseVersion"),
      acquisitionKind: acquisitionKind as MarketplacePurchaseSummary["acquisitionKind"],
      economicStatus: requiredString(row, "economicStatus", 40),
      safetyStatus: safetyStatus as MarketplacePurchaseSummary["safetyStatus"],
      installAuthorized: false,
      acquiredAt: requiredTimestamp(row, "acquiredAt"),
      testMode: row.testMode === true
    };
  });
  return { licenses, testMode: result.testMode === true };
}

export type MarketplaceOfferConfigurationResult = {
  offerId: string;
  listingId: string;
  addonVersionId: string;
  offerKind: "free" | "paid";
  status: string;
  commissionBps: number;
  commercialTermsCode: string | null;
  buyerTermsVersion: string;
  priceCode: string | null;
  amountMinor: number | null;
  currency: "usd" | null;
  idempotentReplay: boolean;
  testMode: boolean;
};

function marketplacePriceCode(input: MarketplaceOfferConfigurationRequest): string | null {
  return input.offerKind === "paid"
    ? `marketplace_test_${input.addonVersionId.replaceAll("-", "")}_${input.amountMinor}_usd`
    : null;
}

export async function configureMarketplaceOffer(
  supabase: SupabaseClient,
  actorUserId: string,
  input: MarketplaceOfferConfigurationRequest
): Promise<MarketplaceOfferConfigurationResult> {
  const priceCode = marketplacePriceCode(input);
  const { data, error } = await supabase.rpc("configure_marketplace_test_offer", {
    p_actor_user_id: actorUserId,
    p_client_request_id: input.clientRequestId,
    p_addon_version_id: input.addonVersionId,
    p_publisher_id: input.publisherId,
    p_offer_kind: input.offerKind,
    p_price_code: priceCode,
    p_amount_minor: input.amountMinor,
    p_currency: input.offerKind === "paid" ? "usd" : null,
    p_license_key: input.licenseKey,
    p_license_version: input.licenseVersion,
    p_buyer_terms_version: input.buyerTermsVersion,
    p_commercial_terms_code: input.commercialTermsCode,
    p_seller_agreement_version: input.sellerAgreementVersion,
    p_reason: input.reason
  });
  if (error) throw marketplaceRpcFailure(error, "marketplace_offer");
  const row = object(data);
  const offerKind = requiredString(row, "offerKind", 20);
  const commercialTermsCode = row.commercialTermsCode == null ? null : requiredString(row, "commercialTermsCode", 117);
  const commissionBps = integer(row, "commissionBps", 0, 5_000);
  if (
    requiredUuid(row, "addonVersionId") !== input.addonVersionId
    || offerKind !== input.offerKind
    || (offerKind === "free" ? commissionBps !== 0 || commercialTermsCode !== null : commercialTermsCode !== input.commercialTermsCode)
    || marketplaceDocumentVersion(row, "buyerTermsVersion") !== input.buyerTermsVersion
    || typeof row.testMode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    offerId: requiredUuid(row, "offerId"), listingId: requiredUuid(row, "listingId"),
    addonVersionId: input.addonVersionId, offerKind: offerKind as "free" | "paid",
    status: requiredString(row, "status", 40), commissionBps, commercialTermsCode,
    buyerTermsVersion: input.buyerTermsVersion, priceCode,
    amountMinor: input.amountMinor, currency: input.offerKind === "paid" ? "usd" : null,
    idempotentReplay: requiredBoolean(row, "idempotentReplay"), testMode: row.testMode === true
  };
}

export async function recordMarketplaceProviderCatalog(
  supabase: SupabaseClient,
  input: MarketplaceOfferConfigurationResult,
  providerProductReference: string,
  providerPriceReference: string
): Promise<void> {
  if (!input.priceCode) throw new BillingHttpError(503, "billing_database_invalid");
  const { error } = await supabase.rpc("record_economic_test_catalog_reference", {
    p_product_key: "marketplace_purchase",
    p_price_code: input.priceCode,
    p_provider: "stripe",
    p_provider_product_id: providerProductReference,
    p_provider_price_id: providerPriceReference
  });
  if (error) throw marketplaceRpcFailure(error, "marketplace_provider_catalog");
}

export type MarketplaceOfferStatusResult = {
  offerId: string;
  status: "active" | "suspended" | "retired";
  offerKind: "free" | "paid";
  idempotentReplay: boolean;
  testMode: boolean;
};

export async function setMarketplaceOfferStatus(
  supabase: SupabaseClient,
  actorUserId: string,
  input: MarketplaceOfferStatusRequest
): Promise<MarketplaceOfferStatusResult> {
  const { data, error } = await supabase.rpc("set_marketplace_test_offer_status", {
    p_actor_user_id: actorUserId,
    p_client_request_id: input.clientRequestId,
    p_offer_id: input.offerId,
    p_target_status: input.targetStatus,
    p_confirmation: input.confirmation,
    p_reason: input.reason
  });
  if (error) throw marketplaceRpcFailure(error, "marketplace_offer_status");
  const row = object(data);
  const offerKind = requiredString(row, "offerKind", 20);
  if (
    requiredUuid(row, "offerId") !== input.offerId
    || row.status !== input.targetStatus
    || !["free", "paid"].includes(offerKind)
    || typeof row.testMode !== "boolean"
  ) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  return {
    offerId: input.offerId,
    status: input.targetStatus,
    offerKind: offerKind as "free" | "paid",
    idempotentReplay: requiredBoolean(row, "idempotentReplay"),
    testMode: row.testMode === true
  };
}

export async function linkMarketplacePublisher(
  supabase: SupabaseClient,
  actorUserId: string,
  input: MarketplacePublisherLinkRequest
): Promise<{ publisherId: string; linked: true; publisherVerifiedChanged: false; idempotentReplay: boolean; testMode: boolean }> {
  const { data, error } = await supabase.rpc("link_economic_seller_publisher", {
    p_actor_user_id: actorUserId,
    p_publisher_id: input.publisherId,
    p_client_request_id: input.clientRequestId,
    p_reason: input.reason
  });
  if (error) throw marketplaceRpcFailure(error, "marketplace_publisher_link");
  const row = object(data);
  if (requiredUuid(row, "publisherId") !== input.publisherId || row.linked !== true || row.publisherVerifiedChanged !== false || typeof row.testMode !== "boolean") {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  return {
    publisherId: input.publisherId,
    linked: true,
    publisherVerifiedChanged: false,
    idempotentReplay: requiredBoolean(row, "idempotentReplay"),
    testMode: row.testMode === true
  };
}

export async function configureMarketplaceCommercialTerms(
  supabase: SupabaseClient,
  actorUserId: string,
  input: MarketplaceCommercialTermsRequest
): Promise<{
  commercialTermsVersionId: string; termsCode: string; commissionBps: number;
  sellerAgreementVersion: string; buyerTermsVersion: string; active: boolean;
  approvedForLiveUse: false; testMode: boolean;
}> {
  const { data, error } = await supabase.rpc("configure_marketplace_test_commercial_terms", {
    p_actor_user_id: actorUserId,
    p_client_request_id: input.clientRequestId,
    p_terms_code: input.termsCode,
    p_commission_bps: input.commissionBps,
    p_seller_agreement_version: input.sellerAgreementVersion,
    p_buyer_terms_version: input.buyerTermsVersion,
    p_active: input.active,
    p_confirmation: input.confirmation,
    p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  if (
    row.termsCode !== input.termsCode || row.commissionBps !== input.commissionBps
    || row.sellerAgreementVersion !== input.sellerAgreementVersion
    || row.buyerTermsVersion !== input.buyerTermsVersion
    || row.active !== input.active || row.approvedForLiveUse !== false || typeof row.testMode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    commercialTermsVersionId: requiredUuid(row, "commercialTermsVersionId"),
    termsCode: input.termsCode, commissionBps: input.commissionBps,
    sellerAgreementVersion: input.sellerAgreementVersion,
    buyerTermsVersion: input.buyerTermsVersion,
    active: input.active, approvedForLiveUse: false, testMode: row.testMode === true
  };
}

export type EconomicClosureReadiness = {
  canComplete: boolean;
  blockingCount: number;
  activeSubscriptions: number;
  scheduledSubscriptionCancellations: number;
  unsettledOrders: number;
  openRefunds: number;
  openDisputes: number;
  openReconciliationCases: number;
  pendingSellerPayouts: number;
  sellerPayableObligations: number;
  pendingMarketplaceFulfillment: number;
  pendingJobPostFulfillment: number;
  organizationSignerDuties: number;
  sponsorshipSignerDuties: number;
  preservesEarnedLicenses: true;
  preservesRemainingSandboxCredits: true;
  financialRecordsRetained: true;
  authProfileUnchanged: true;
  guidance: string[];
};

function economicClosureReadiness(value: unknown): EconomicClosureReadiness {
  const row = object(value);
  exactDatabaseKeys(row, [
    "canComplete", "blockingCount", "activeSubscriptions", "scheduledSubscriptionCancellations", "unsettledOrders",
    "openRefunds", "openDisputes", "openReconciliationCases", "pendingSellerPayouts",
    "sellerPayableObligations", "pendingMarketplaceFulfillment", "pendingJobPostFulfillment",
    "organizationSignerDuties", "sponsorshipSignerDuties", "preservesEarnedLicenses",
    "preservesRemainingSandboxCredits", "financialRecordsRetained", "authProfileUnchanged", "guidance"
  ]);
  const countKeys = [
    "activeSubscriptions", "unsettledOrders", "openRefunds", "openDisputes",
    "openReconciliationCases", "pendingSellerPayouts", "sellerPayableObligations",
    "pendingMarketplaceFulfillment", "pendingJobPostFulfillment", "organizationSignerDuties",
    "sponsorshipSignerDuties"
  ] as const;
  const counts = Object.fromEntries(countKeys.map((key) => [key, integer(row, key, 0, 1_000_000_000)])) as Record<typeof countKeys[number], number>;
  const blockingCount = integer(row, "blockingCount", 0, 1_000_000_000);
  const scheduledSubscriptionCancellations = integer(row, "scheduledSubscriptionCancellations", 0, 1_000_000_000);
  if (
    requiredBoolean(row, "canComplete") !== (blockingCount === 0)
    || Object.values(counts).reduce((sum, count) => sum + count, 0) !== blockingCount
    || row.preservesEarnedLicenses !== true
    || row.preservesRemainingSandboxCredits !== true
    || row.financialRecordsRetained !== true
    || row.authProfileUnchanged !== true
    || !Array.isArray(row.guidance)
    || row.guidance.length !== 3
    || row.guidance.some((item) => typeof item !== "string" || item.length < 1 || item.length > 300 || /[\u0000-\u001f\u007f]/.test(item))
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    canComplete: blockingCount === 0,
    blockingCount,
    scheduledSubscriptionCancellations,
    ...counts,
    preservesEarnedLicenses: true,
    preservesRemainingSandboxCredits: true,
    financialRecordsRetained: true,
    authProfileUnchanged: true,
    guidance: row.guidance as string[]
  };
}

function lifecycleRpcFailure(error: { code?: string } | null): BillingHttpError {
  if (error?.code === "42501") return new BillingHttpError(403, "economic_action_forbidden");
  if (error?.code === "P0002" || error?.code === "23503") return new BillingHttpError(404, "economic_action_target_not_found");
  if (error?.code === "23505") return new BillingHttpError(409, "economic_action_idempotency_conflict");
  if (error?.code === "22023" || error?.code === "55000") return new BillingHttpError(409, "economic_action_rejected");
  return new BillingHttpError(503, "economic_action_unavailable");
}

export type SupportRecognitionPreferenceResult = {
  optedIn: boolean;
  eligible: boolean;
  eligibilityExpiresAt: string | null;
  publicDisplayEnabled: boolean;
  amountsPublic: false;
  grantsAuthority: false;
  idempotentReplay: boolean;
};

export async function setCurrentUserSupportRecognition(
  supabase: SupabaseClient,
  input: SupportRecognitionPreferenceRequest
): Promise<SupportRecognitionPreferenceResult> {
  const { data, error } = await supabase.rpc("set_current_user_support_recognition", {
    p_client_request_id: input.clientRequestId,
    p_opted_in: input.optedIn,
    p_consent_version: input.consentVersion
  });
  if (error) throw lifecycleRpcFailure(error);
  const row = object(data);
  exactDatabaseKeys(row, [
    "optedIn", "eligible", "eligibilityExpiresAt", "publicDisplayEnabled",
    "amountsPublic", "grantsAuthority", "idempotentReplay"
  ]);
  if (row.optedIn !== input.optedIn || row.amountsPublic !== false || row.grantsAuthority !== false) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  return {
    optedIn: input.optedIn,
    eligible: requiredBoolean(row, "eligible"),
    eligibilityExpiresAt: nullableTimestamp(row, "eligibilityExpiresAt"),
    publicDisplayEnabled: requiredBoolean(row, "publicDisplayEnabled"),
    amountsPublic: false,
    grantsAuthority: false,
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

export async function loadCurrentEconomicClosureReadiness(
  supabase: SupabaseClient
): Promise<EconomicClosureReadiness> {
  const { data, error } = await supabase.rpc("current_user_economic_closure_readiness");
  if (error) throw lifecycleRpcFailure(error);
  return economicClosureReadiness(data);
}

export type EconomicAccountActionResult = {
  requestId: string;
  requestType: EconomicAccountActionRequest["requestType"];
  status: string;
  providerCancellationRequired: boolean;
  closureReadiness: EconomicClosureReadiness | null;
  financialRecordsRetained: true;
  authProfileUnchanged: true;
  idempotentReplay: boolean;
};

export async function requestCurrentUserEconomicAccountAction(
  supabase: SupabaseClient,
  actorUserId: string,
  input: EconomicAccountActionRequest
): Promise<EconomicAccountActionResult> {
  const { data, error } = await supabase.rpc("request_economic_account_action", {
    p_actor_user_id: actorUserId,
    p_client_request_id: input.clientRequestId,
    p_request_type: input.requestType,
    p_consent_version: input.consentVersion,
    p_user_note: input.userNote
  });
  if (error) throw lifecycleRpcFailure(error);
  const row = object(data);
  exactDatabaseKeys(row, [
    "requestId", "requestType", "status", "providerCancellationRequired", "closureReadiness",
    "financialRecordsRetained", "authProfileUnchanged", "idempotentReplay"
  ]);
  const status = requiredString(row, "status", 40);
  if (
    row.requestType !== input.requestType
    || !["submitted", "identity_verification", "operator_review", "processing", "completed", "rejected", "canceled"].includes(status)
    || row.financialRecordsRetained !== true
    || row.authProfileUnchanged !== true
    || (input.requestType === "data_export") !== (row.closureReadiness === null)
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    requestId: requiredUuid(row, "requestId"),
    requestType: input.requestType,
    status,
    providerCancellationRequired: requiredBoolean(row, "providerCancellationRequired"),
    closureReadiness: row.closureReadiness === null ? null : economicClosureReadiness(row.closureReadiness),
    financialRecordsRetained: true,
    authProfileUnchanged: true,
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

export type OperatorEconomicAccountActionResult = {
  requestId: string;
  requestType: EconomicAccountActionRequest["requestType"];
  status: string;
  financialRecordsRetained: true;
  authProfileUnchanged: true;
  idempotentReplay: boolean;
};

export async function updateOperatorEconomicAccountAction(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorEconomicAccountActionRequest
): Promise<OperatorEconomicAccountActionResult> {
  const { data, error } = await supabase.rpc("operator_update_economic_account_action", {
    p_actor_user_id: actorUserId,
    p_request_id: input.requestId,
    p_status: input.status,
    p_client_request_id: input.clientRequestId,
    p_artifact_sha256: input.artifactSha256,
    p_artifact_expires_at: input.artifactExpiresAt,
    p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  exactDatabaseKeys(row, [
    "requestId", "requestType", "status", "financialRecordsRetained", "authProfileUnchanged", "idempotentReplay"
  ]);
  const requestType = requiredString(row, "requestType", 40);
  if (
    requiredUuid(row, "requestId") !== input.requestId
    || !["data_export", "economic_account_closure"].includes(requestType)
    || row.status !== input.status
    || row.financialRecordsRetained !== true
    || row.authProfileUnchanged !== true
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    requestId: input.requestId,
    requestType: requestType as EconomicAccountActionRequest["requestType"],
    status: input.status,
    financialRecordsRetained: true,
    authProfileUnchanged: true,
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

export async function setOperatorEconomicServiceRestriction(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorEconomicServiceRestrictionRequest
): Promise<{
  restrictionId: string; userId: string; scope: OperatorEconomicServiceRestrictionRequest["scope"];
  active: boolean; commonsAccountAffected: false; idempotentReplay: boolean;
}> {
  const { data, error } = await supabase.rpc("operator_set_economic_service_restriction", {
    p_actor_user_id: actorUserId,
    p_client_request_id: input.clientRequestId,
    p_target_user_id: input.targetUserId,
    p_restriction_id: input.restrictionId,
    p_scope: input.scope,
    p_reason_code: input.reasonCode,
    p_expires_at: input.expiresAt,
    p_enabled: input.enabled,
    p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  exactDatabaseKeys(row, ["restrictionId", "userId", "scope", "active", "commonsAccountAffected", "idempotentReplay"]);
  if (
    requiredUuid(row, "userId") !== input.targetUserId
    || row.scope !== input.scope
    || row.active !== input.enabled
    || row.commonsAccountAffected !== false
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    restrictionId: requiredUuid(row, "restrictionId"),
    userId: input.targetUserId,
    scope: input.scope,
    active: input.enabled,
    commonsAccountAffected: false,
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

function contractCheckoutFailure(error: { code?: string } | null, domain: "organization" | "sponsorship"): BillingHttpError {
  if (error?.code === "42501") return new BillingHttpError(403, `${domain}_checkout_forbidden`);
  if (error?.code === "P0002" || error?.code === "23503") return new BillingHttpError(404, `${domain}_contract_not_found`);
  if (error?.code === "23505") return new BillingHttpError(409, `${domain}_checkout_conflict`);
  if (error?.code === "22023" || error?.code === "55000") return new BillingHttpError(409, `${domain}_checkout_unavailable`);
  return new BillingHttpError(503, `${domain}_checkout_unavailable`);
}

export async function prepareOrganizationServiceCheckout(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OrganizationServiceCheckoutRequest
): Promise<CheckoutPreparation & { engagementId: string; organizationId: string }> {
  const { data, error } = await supabase.rpc("prepare_organization_service_checkout", {
    p_actor_user_id: actorUserId,
    p_engagement_id: input.engagementId,
    p_client_request_id: input.clientRequestId,
    p_source_route: input.sourceRoute,
    p_legal_bundle_version: input.legalBundleVersion,
    p_statement_of_work_version: input.statementOfWorkVersion,
    p_service_terms_version: input.serviceTermsVersion,
    p_data_handling_disclosure_version: input.dataHandlingDisclosureVersion
  });
  if (error) throw contractCheckoutFailure(error, "organization");
  const row = object(data);
  const preparation = checkoutPreparation(row);
  if (
    requiredUuid(row, "engagementId") !== input.engagementId
    || preparation.amountMinor < 1 || (!preparation.providerPriceReference && !preparation.providerProductReference)
  ) throw new BillingHttpError(503, "billing_catalog_unavailable");
  return { ...preparation, engagementId: input.engagementId, organizationId: requiredUuid(row, "organizationId") };
}

export async function prepareSponsorshipCheckout(
  supabase: SupabaseClient,
  actorUserId: string,
  input: SponsorshipCheckoutRequest
): Promise<CheckoutPreparation & { sponsorshipAgreementId: string; organizationId: string; grantsAuthority: false }> {
  const { data, error } = await supabase.rpc("prepare_sponsorship_checkout", {
    p_actor_user_id: actorUserId,
    p_sponsorship_agreement_id: input.sponsorshipAgreementId,
    p_client_request_id: input.clientRequestId,
    p_source_route: input.sourceRoute,
    p_legal_bundle_version: input.legalBundleVersion,
    p_agreement_version: input.agreementVersion,
    p_disclosure_version: input.disclosureVersion
  });
  if (error) throw contractCheckoutFailure(error, "sponsorship");
  const row = object(data);
  const preparation = checkoutPreparation(row);
  if (
    requiredUuid(row, "sponsorshipAgreementId") !== input.sponsorshipAgreementId
    || row.grantsAuthority !== false || preparation.amountMinor < 1 || (!preparation.providerPriceReference && !preparation.providerProductReference)
  ) throw new BillingHttpError(503, "billing_catalog_unavailable");
  return {
    ...preparation, sponsorshipAgreementId: input.sponsorshipAgreementId,
    organizationId: requiredUuid(row, "organizationId"), grantsAuthority: false
  };
}

export async function createOperatorEconomicOrganization(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorEconomicOrganizationRequest
): Promise<{
  organizationId: string; accountName: string; status: "active";
  testMode: boolean; idempotentReplay: boolean;
}> {
  const { data, error } = await supabase.rpc("operator_create_economic_organization", {
    p_actor_user_id: actorUserId,
    p_client_request_id: input.clientRequestId,
    p_account_name: input.accountName,
    p_country_code: input.countryCode,
    p_initial_contact_user_id: input.initialContactUserId,
    p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  exactDatabaseKeys(row, ["organizationId", "accountName", "status", "testMode", "idempotentReplay"]);
  if (row.accountName !== input.accountName || row.status !== "active" || typeof row.testMode !== "boolean") {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  return {
    organizationId: requiredUuid(row, "organizationId"), accountName: input.accountName,
    status: "active", testMode: row.testMode === true,
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

export async function setOperatorEconomicOrganizationMembership(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorEconomicOrganizationMembershipRequest
): Promise<{
  membershipId: string; organizationId: string; userId: string;
  relationship: OperatorEconomicOrganizationMembershipRequest["relationship"];
  active: boolean; testMode: boolean; idempotentReplay: boolean;
}> {
  const { data, error } = await supabase.rpc("operator_set_economic_organization_membership", {
    p_actor_user_id: actorUserId,
    p_client_request_id: input.clientRequestId,
    p_organization_id: input.organizationId,
    p_target_user_id: input.targetUserId,
    p_relationship: input.relationship,
    p_enabled: input.enabled,
    p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  exactDatabaseKeys(row, [
    "membershipId", "organizationId", "userId", "relationship", "active", "testMode", "idempotentReplay"
  ]);
  if (
    requiredUuid(row, "organizationId") !== input.organizationId
    || requiredUuid(row, "userId") !== input.targetUserId
    || row.relationship !== input.relationship || row.active !== input.enabled || typeof row.testMode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    membershipId: requiredUuid(row, "membershipId"), organizationId: input.organizationId,
    userId: input.targetUserId, relationship: input.relationship, active: input.enabled,
    testMode: row.testMode === true, idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

export async function createOperatorOrganizationServiceEngagement(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorOrganizationServiceEngagementRequest
): Promise<{
  engagementId: string; organizationId: string; serviceCode: string;
  status: "contract_pending"; serviceTermsVersion: string;
  testMode: boolean; idempotentReplay: boolean;
}> {
  const { data, error } = await supabase.rpc("operator_create_organization_service_engagement", {
    p_actor_user_id: actorUserId,
    p_client_request_id: input.clientRequestId,
    p_organization_id: input.organizationId,
    p_authorized_signer_user_id: input.authorizedSignerUserId,
    p_service_code: input.serviceCode,
    p_price_code: input.priceCode,
    p_statement_of_work_version: input.statementOfWorkVersion,
    p_service_terms_version: input.serviceTermsVersion,
    p_data_handling_disclosure_version: input.dataHandlingDisclosureVersion,
    p_confidentiality_class: input.confidentialityClass,
    p_proposal_reference: input.proposalReference,
    p_contract_reference: input.contractReference,
    p_invoice_reference: input.invoiceReference,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  exactDatabaseKeys(row, [
    "engagementId", "organizationId", "serviceCode", "status", "serviceTermsVersion",
    "testMode", "idempotentReplay"
  ]);
  if (
    requiredUuid(row, "organizationId") !== input.organizationId
    || row.serviceCode !== input.serviceCode || row.status !== "contract_pending"
    || row.serviceTermsVersion !== input.serviceTermsVersion || typeof row.testMode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    engagementId: requiredUuid(row, "engagementId"), organizationId: input.organizationId,
    serviceCode: input.serviceCode, status: "contract_pending",
    serviceTermsVersion: input.serviceTermsVersion, testMode: row.testMode === true,
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

const ORGANIZATION_REVIEW_STATUS: Record<OperatorOrganizationServiceReviewRequest["action"], string> = {
  activate: "active", complete: "completed", cancel: "canceled",
  reconciliation_required: "reconciliation_required", resolve_resume: "active",
  resolve_complete: "completed", resolve_cancel: "canceled"
};

export async function reviewOperatorOrganizationServiceEngagement(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorOrganizationServiceReviewRequest
): Promise<{
  engagementId: string; action: OperatorOrganizationServiceReviewRequest["action"];
  status: string; testMode: boolean; idempotentReplay: boolean;
}> {
  const { data, error } = await supabase.rpc("operator_review_organization_service_engagement", {
    p_actor_user_id: actorUserId,
    p_engagement_id: input.engagementId,
    p_client_request_id: input.clientRequestId,
    p_action: input.action,
    p_confirmation: input.confirmation,
    p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  const replay = row.idempotentReplay === true;
  exactDatabaseKeys(row, replay
    ? ["engagementId", "action", "testMode", "idempotentReplay"]
    : ["engagementId", "action", "status", "testMode", "idempotentReplay"]);
  const expectedStatus = ORGANIZATION_REVIEW_STATUS[input.action];
  if (
    requiredUuid(row, "engagementId") !== input.engagementId || row.action !== input.action
    || (!replay && row.status !== expectedStatus) || typeof row.testMode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    engagementId: input.engagementId, action: input.action, status: expectedStatus,
    testMode: row.testMode === true, idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

export async function createOperatorSponsorshipAgreement(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorSponsorshipAgreementRequest
): Promise<{
  sponsorshipAgreementId: string; organizationId: string; status: "ethical_review";
  publicRecognitionOptIn: false; publicRecognitionApproved: false;
  grantsAuthority: false; testMode: boolean; idempotentReplay: boolean;
}> {
  const { data, error } = await supabase.rpc("operator_create_sponsorship_agreement", {
    p_actor_user_id: actorUserId,
    p_client_request_id: input.clientRequestId,
    p_organization_id: input.organizationId,
    p_authorized_signer_user_id: input.authorizedSignerUserId,
    p_purpose_code: input.purposeCode,
    p_price_code: input.priceCode,
    p_agreement_version: input.agreementVersion,
    p_disclosure_version: input.disclosureVersion,
    p_public_label: input.publicLabel,
    p_public_summary: input.publicSummary,
    p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  exactDatabaseKeys(row, [
    "sponsorshipAgreementId", "organizationId", "status", "publicRecognitionOptIn",
    "publicRecognitionApproved", "grantsAuthority", "testMode", "idempotentReplay"
  ]);
  if (
    requiredUuid(row, "organizationId") !== input.organizationId || row.status !== "ethical_review"
    || row.publicRecognitionOptIn !== false || row.publicRecognitionApproved !== false
    || row.grantsAuthority !== false || typeof row.testMode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    sponsorshipAgreementId: requiredUuid(row, "sponsorshipAgreementId"),
    organizationId: input.organizationId, status: "ethical_review",
    publicRecognitionOptIn: false, publicRecognitionApproved: false,
    grantsAuthority: false, testMode: row.testMode === true,
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

const SPONSORSHIP_REVIEW_STATUS: Record<OperatorSponsorshipReviewRequest["action"], string> = {
  approve: "contract_pending", activate: "active", reject: "rejected",
  complete: "completed", cancel: "canceled", resolve_resume: "active",
  resolve_complete: "completed", resolve_cancel: "canceled"
};

export async function reviewOperatorSponsorshipAgreement(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorSponsorshipReviewRequest
): Promise<{
  sponsorshipAgreementId: string; action: OperatorSponsorshipReviewRequest["action"];
  status: string; grantsAuthority: false; testMode: boolean; idempotentReplay: boolean;
}> {
  const { data, error } = await supabase.rpc("operator_review_sponsorship_agreement", {
    p_actor_user_id: actorUserId,
    p_sponsorship_agreement_id: input.sponsorshipAgreementId,
    p_client_request_id: input.clientRequestId,
    p_action: input.action,
    p_confirmation: input.confirmation,
    p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  const replay = row.idempotentReplay === true;
  exactDatabaseKeys(row, replay
    ? ["sponsorshipAgreementId", "action", "testMode", "idempotentReplay"]
    : ["sponsorshipAgreementId", "action", "status", "grantsAuthority", "testMode", "idempotentReplay"]);
  const expectedStatus = SPONSORSHIP_REVIEW_STATUS[input.action];
  if (
    requiredUuid(row, "sponsorshipAgreementId") !== input.sponsorshipAgreementId
    || row.action !== input.action || (!replay && row.status !== expectedStatus)
    || (!replay && row.grantsAuthority !== false) || typeof row.testMode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    sponsorshipAgreementId: input.sponsorshipAgreementId, action: input.action,
    status: expectedStatus, grantsAuthority: false, testMode: row.testMode === true,
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

export async function setOperatorSponsorshipPublicRecognition(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorSponsorshipRecognitionRequest
): Promise<{
  sponsorshipAgreementId: string; publicRecognitionApproved: boolean;
  amountsPublic: false; grantsAuthority: false; testMode: boolean; idempotentReplay: boolean;
}> {
  const { data, error } = await supabase.rpc("operator_set_sponsorship_public_recognition", {
    p_actor_user_id: actorUserId,
    p_sponsorship_agreement_id: input.sponsorshipAgreementId,
    p_client_request_id: input.clientRequestId,
    p_approved: input.approved,
    p_confirmation: input.confirmation,
    p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  const replay = row.idempotentReplay === true;
  exactDatabaseKeys(row, replay
    ? ["sponsorshipAgreementId", "publicRecognitionApproved", "testMode", "idempotentReplay"]
    : ["sponsorshipAgreementId", "publicRecognitionApproved", "publicDisplayEnabled", "amountsPublic", "grantsAuthority", "testMode", "idempotentReplay"]);
  if (
    requiredUuid(row, "sponsorshipAgreementId") !== input.sponsorshipAgreementId
    || row.publicRecognitionApproved !== input.approved || typeof row.testMode !== "boolean"
    || (!replay && (row.amountsPublic !== false || row.grantsAuthority !== false))
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    sponsorshipAgreementId: input.sponsorshipAgreementId,
    publicRecognitionApproved: input.approved, amountsPublic: false,
    grantsAuthority: false, testMode: row.testMode === true,
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

export async function setCurrentUserSponsorshipRecognitionPreference(
  supabase: SupabaseClient,
  actorUserId: string,
  input: SponsorshipRecognitionPreferenceRequest
): Promise<{
  sponsorshipAgreementId: string; publicRecognitionOptIn: boolean;
  amountsPublic: false; grantsAuthority: false; testMode: boolean; idempotentReplay: boolean;
}> {
  const { data, error } = await supabase.rpc("set_current_user_sponsorship_recognition_preference", {
    p_actor_user_id: actorUserId,
    p_sponsorship_agreement_id: input.sponsorshipAgreementId,
    p_client_request_id: input.clientRequestId,
    p_opted_in: input.optedIn,
    p_source_route: input.sourceRoute,
    p_agreement_version: input.agreementVersion,
    p_disclosure_version: input.disclosureVersion
  });
  if (error) throw lifecycleRpcFailure(error);
  const row = object(data);
  const replay = row.idempotentReplay === true;
  exactDatabaseKeys(row, replay
    ? ["sponsorshipAgreementId", "publicRecognitionOptIn", "amountsPublic", "grantsAuthority", "testMode", "idempotentReplay"]
    : ["sponsorshipAgreementId", "publicRecognitionOptIn", "publicRecognitionApproved", "amountsPublic", "grantsAuthority", "testMode", "idempotentReplay"]);
  if (
    requiredUuid(row, "sponsorshipAgreementId") !== input.sponsorshipAgreementId
    || row.publicRecognitionOptIn !== input.optedIn || row.amountsPublic !== false
    || row.grantsAuthority !== false || typeof row.testMode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    sponsorshipAgreementId: input.sponsorshipAgreementId,
    publicRecognitionOptIn: input.optedIn, amountsPublic: false,
    grantsAuthority: false, testMode: row.testMode === true,
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

export async function createOperatorSponsorshipAssistanceAllocation(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorSponsorshipAssistanceAllocationRequest
): Promise<{
  allocationId: string; sponsorshipAgreementId: string; assistanceProgramId: string;
  scope: "job_post_fee" | "sandbox_credits"; allocationKind: OperatorSponsorshipAssistanceAllocationRequest["allocationKind"];
  allocationCap: number; currency: "usd" | null; sponsorSelectsRecipients: false;
  sponsorReceivesRecipientData: false; grantsAuthority: false; testMode: boolean; idempotentReplay: boolean;
}> {
  const { data, error } = await supabase.rpc("operator_create_sponsorship_assistance_allocation", {
    p_actor_user_id: actorUserId,
    p_client_request_id: input.clientRequestId,
    p_sponsorship_agreement_id: input.sponsorshipAgreementId,
    p_assistance_program_id: input.assistanceProgramId,
    p_allocation_kind: input.allocationKind,
    p_allocation_cap: input.allocationCap,
    p_currency: input.currency,
    p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  exactDatabaseKeys(row, [
    "allocationId", "sponsorshipAgreementId", "assistanceProgramId", "scope", "allocationKind",
    "allocationCap", "currency", "sponsorSelectsRecipients", "sponsorReceivesRecipientData",
    "grantsAuthority", "testMode", "idempotentReplay"
  ]);
  const scope = requiredString(row, "scope", 40);
  if (
    requiredUuid(row, "sponsorshipAgreementId") !== input.sponsorshipAgreementId
    || requiredUuid(row, "assistanceProgramId") !== input.assistanceProgramId
    || !["job_post_fee", "sandbox_credits"].includes(scope)
    || row.allocationKind !== input.allocationKind || row.allocationCap !== input.allocationCap
    || row.currency !== input.currency || row.sponsorSelectsRecipients !== false
    || row.sponsorReceivesRecipientData !== false || row.grantsAuthority !== false || typeof row.testMode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    allocationId: requiredUuid(row, "allocationId"), sponsorshipAgreementId: input.sponsorshipAgreementId,
    assistanceProgramId: input.assistanceProgramId, scope: scope as "job_post_fee" | "sandbox_credits",
    allocationKind: input.allocationKind, allocationCap: input.allocationCap, currency: input.currency,
    sponsorSelectsRecipients: false, sponsorReceivesRecipientData: false,
    grantsAuthority: false, testMode: row.testMode === true,
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

export async function closeOperatorSponsorshipAssistanceAllocation(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorSponsorshipAssistanceAllocationCloseRequest
): Promise<{ allocationId: string; status: "canceled"; testMode: boolean; idempotentReplay: boolean }> {
  const { data, error } = await supabase.rpc("operator_close_sponsorship_assistance_allocation", {
    p_actor_user_id: actorUserId,
    p_client_request_id: input.clientRequestId,
    p_allocation_id: input.allocationId,
    p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  exactDatabaseKeys(row, ["allocationId", "status", "testMode", "idempotentReplay"]);
  if (requiredUuid(row, "allocationId") !== input.allocationId || row.status !== "canceled" || typeof row.testMode !== "boolean") {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  return {
    allocationId: input.allocationId, status: "canceled", testMode: row.testMode === true,
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

export async function configureOperatorAssistanceProgram(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorAssistanceProgramRequest
): Promise<{
  programId: string; programCode: string; kind: OperatorAssistanceProgramRequest["assistanceKind"];
  scope: OperatorAssistanceProgramRequest["scope"]; status: "active" | "draft";
  publicLabel: string; testMode: boolean; idempotentReplay: boolean;
}> {
  const { data, error } = await supabase.rpc("operator_configure_assistance_program", {
    p_actor_user_id: actorUserId,
    p_client_request_id: input.clientRequestId,
    p_program_code: input.programCode,
    p_assistance_kind: input.assistanceKind,
    p_scope: input.scope,
    p_public_label: input.publicLabel,
    p_terms_version: input.termsVersion,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_max_grants: input.maxGrants,
    p_activate: input.activate,
    p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  exactDatabaseKeys(row, ["programId", "programCode", "kind", "scope", "status", "publicLabel", "testMode", "idempotentReplay"]);
  const expectedStatus = input.activate ? "active" : "draft";
  if (
    row.programCode !== input.programCode || row.kind !== input.assistanceKind || row.scope !== input.scope
    || row.status !== expectedStatus || row.publicLabel !== input.publicLabel || typeof row.testMode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    programId: requiredUuid(row, "programId"), programCode: input.programCode,
    kind: input.assistanceKind, scope: input.scope, status: expectedStatus,
    publicLabel: input.publicLabel, testMode: row.testMode === true,
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

export async function setOperatorAssistanceProgramStatus(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorAssistanceProgramStatusRequest
): Promise<{ programId: string; status: OperatorAssistanceProgramStatusRequest["targetStatus"]; testMode: boolean; idempotentReplay: boolean }> {
  const { data, error } = await supabase.rpc("operator_set_economic_assistance_program_status", {
    p_actor_user_id: actorUserId, p_client_request_id: input.clientRequestId,
    p_program_id: input.programId, p_target_status: input.targetStatus,
    p_confirmation: input.confirmation, p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  const replay = row.idempotentReplay === true;
  exactDatabaseKeys(row, replay
    ? ["programId", "status", "testMode", "idempotentReplay"]
    : ["programId", "programCode", "status", "testMode", "idempotentReplay"]);
  if (requiredUuid(row, "programId") !== input.programId || row.status !== input.targetStatus || typeof row.testMode !== "boolean") {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  if (!replay) requiredString(row, "programCode", 100);
  return { programId: input.programId, status: input.targetStatus, testMode: row.testMode === true, idempotentReplay: replay };
}

export async function issueOperatorAssistanceGrant(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorAssistanceGrantRequest
): Promise<{
  grantId: string; scope: OperatorAssistanceProgramRequest["scope"]; status: string;
  expiresAt: string | null; publiclyVisible: false;
  sandboxCreditResult: null | { creditLotId: string; grantedUnits: number; sourceCategory: string; expiresAt: string | null };
  testMode: boolean; idempotentReplay: boolean;
}> {
  const { data, error } = await supabase.rpc("operator_issue_economic_assistance_grant", {
    p_actor_user_id: actorUserId,
    p_client_request_id: input.clientRequestId,
    p_program_code: input.programCode,
    p_beneficiary_user_id: input.beneficiaryUserId,
    p_resource_id: input.resourceId,
    p_units: input.units,
    p_expires_at: input.expiresAt,
    p_sponsorship_allocation_id: input.sponsorshipAllocationId,
    p_allocation_consumption: input.allocationConsumption,
    p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  exactDatabaseKeys(row, [
    "grantId", "scope", "status", "expiresAt", "publiclyVisible",
    "sandboxCreditResult", "testMode", "idempotentReplay"
  ]);
  const scope = requiredString(row, "scope", 40);
  const status = requiredString(row, "status", 40);
  if (!['job_post_fee', 'sandbox_credits'].includes(scope) || !['granted', 'consumed'].includes(status) || row.publiclyVisible !== false || typeof row.testMode !== "boolean") {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  let sandboxCreditResult: null | { creditLotId: string; grantedUnits: number; sourceCategory: string; expiresAt: string | null } = null;
  if (row.sandboxCreditResult !== null) {
    const credit = object(row.sandboxCreditResult);
    sandboxCreditResult = {
      creditLotId: requiredUuid(credit, "creditLotId"),
      grantedUnits: integer(credit, "grantedUnits", 1, 1_000_000_000),
      sourceCategory: requiredString(credit, "sourceCategory", 40),
      expiresAt: nullableTimestamp(credit, "expiresAt")
    };
  }
  if ((scope === "sandbox_credits" && !requiredBoolean(row, "idempotentReplay")) !== (sandboxCreditResult !== null)) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  return {
    grantId: requiredUuid(row, "grantId"),
    scope: scope as OperatorAssistanceProgramRequest["scope"], status,
    expiresAt: nullableTimestamp(row, "expiresAt"), publiclyVisible: false,
    sandboxCreditResult, testMode: row.testMode === true,
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

export async function endOperatorAssistanceGrant(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorAssistanceEndRequest
): Promise<{ grantId: string; status: "revoked" | "expired"; reversedUnits: number; publiclyVisible: false; idempotentReplay: boolean }> {
  const { data, error } = await supabase.rpc("operator_end_economic_assistance_grant", {
    p_actor_user_id: actorUserId,
    p_client_request_id: input.clientRequestId,
    p_grant_id: input.grantId,
    p_action: input.action,
    p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  exactDatabaseKeys(row, ["grantId", "status", "reversedUnits", "publiclyVisible", "idempotentReplay"]);
  const status = input.action === "revoke" ? "revoked" : "expired";
  if (requiredUuid(row, "grantId") !== input.grantId || row.status !== status || row.publiclyVisible !== false) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  return {
    grantId: input.grantId, status,
    reversedUnits: integer(row, "reversedUnits", 0, 1_000_000_000),
    publiclyVisible: false,
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

export async function reconcileOperatorJobPostAssistanceGrant(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorJobPostAssistanceReconciliationRequest
): Promise<{
  jobPostId: string; grantId: string; grantStatus: "revoked" | "expired";
  economicStatus: "not_assessed"; publicationStatus: string | null;
  published: boolean; testMode: boolean; idempotentReplay: boolean;
}> {
  const { data, error } = await supabase.rpc("operator_reconcile_job_post_assistance_grant", {
    p_actor_user_id: actorUserId, p_client_request_id: input.clientRequestId,
    p_job_post_id: input.jobPostId, p_grant_id: input.grantId,
    p_end_action: input.endAction, p_confirmation: input.confirmation, p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  const replay = row.idempotentReplay === true;
  exactDatabaseKeys(row, replay
    ? ["jobPostId", "grantId", "grantStatus", "economicStatus", "testMode", "idempotentReplay"]
    : ["jobPostId", "grantId", "grantStatus", "economicStatus", "publicationStatus", "published", "testMode", "idempotentReplay"]);
  const grantStatus = input.endAction === "revoke" ? "revoked" : "expired";
  if (
    requiredUuid(row, "jobPostId") !== input.jobPostId || requiredUuid(row, "grantId") !== input.grantId
    || row.grantStatus !== grantStatus || row.economicStatus !== "not_assessed" || typeof row.testMode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  let publicationStatus: string | null = null;
  let published = false;
  if (!replay) {
    publicationStatus = row.publicationStatus === null ? null : requiredString(row, "publicationStatus", 40);
    published = requiredBoolean(row, "published");
  }
  return {
    jobPostId: input.jobPostId, grantId: input.grantId, grantStatus,
    economicStatus: "not_assessed", publicationStatus, published,
    testMode: row.testMode === true, idempotentReplay: replay
  };
}

export type EconomicAccountingExportEntry = {
  exportVersion: "economic-accounting-v1"; eventId: string; effectiveAt: string; recordedAt: string;
  category: string; economicFlow: "support_one_time" | "support_recurring" | "sandbox_credits" | "job_post_fee" | "marketplace_purchase" | "organization_service" | "sponsorship"; direction: "inflow" | "outflow" | "memo";
  grossMinor: number | null; refundMinor: number | null; disputeMinor: number | null;
  processorFeeMinor: number | null; platformCommissionMinor: number | null;
  sellerPayableMinor: number | null; netMinor: number | null; currency: string;
  internalOrderReference: string; provider: string; providerEventDate: string;
  jurisdiction: string | null; taxTreatmentPendingReview: true;
  reconciliationStatus: "recorded" | "settlement_details_pending" | "review";
};

export async function exportOperatorEconomicAccounting(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorAccountingExportRequest
): Promise<{
  exportVersion: "economic-accounting-v1"; entries: EconomicAccountingExportEntry[];
  limit: number; from: string; to: string; providerIdentifiersExposed: false;
  personalContactDataExposed: false; testMode: boolean; idempotentReplay: boolean;
}> {
  const { data, error } = await supabase.rpc("export_economic_accounting_events", {
    p_actor_user_id: actorUserId,
    p_client_request_id: input.clientRequestId,
    p_from: input.from,
    p_to: input.to,
    p_after_created_at: input.afterCreatedAt,
    p_after_id: input.afterId,
    p_limit: input.limit
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  exactDatabaseKeys(row, [
    "exportVersion", "entries", "limit", "from", "to", "providerIdentifiersExposed",
    "personalContactDataExposed", "testMode", "idempotentReplay"
  ]);
  const resultFrom = requiredTimestamp(row, "from");
  const resultTo = requiredTimestamp(row, "to");
  if (
    row.exportVersion !== "economic-accounting-v1" || row.limit !== input.limit
    || Date.parse(resultFrom) !== Date.parse(input.from) || Date.parse(resultTo) !== Date.parse(input.to)
    || row.providerIdentifiersExposed !== false || row.personalContactDataExposed !== false
    || typeof row.testMode !== "boolean" || !Array.isArray(row.entries) || row.entries.length > input.limit
  ) throw new BillingHttpError(503, "billing_database_invalid");
  const categories = new Set(["payment_received", "payment_state", "refund", "dispute", "marketplace_allocation"]);
  const entries = row.entries.map((value): EconomicAccountingExportEntry => {
    const entry = object(value);
    exactDatabaseKeys(entry, [
      "exportVersion", "eventId", "effectiveAt", "recordedAt", "category", "economicFlow", "direction",
      "grossMinor", "refundMinor", "disputeMinor", "processorFeeMinor", "platformCommissionMinor",
      "sellerPayableMinor", "netMinor", "currency", "internalOrderReference", "provider",
      "providerEventDate", "jurisdiction", "taxTreatmentPendingReview", "reconciliationStatus"
    ]);
    const category = requiredString(entry, "category", 80);
    const economicFlow = requiredString(entry, "economicFlow", 40);
    const direction = requiredString(entry, "direction", 20);
    const currency = requiredString(entry, "currency", 3);
    const internalOrderReference = requiredString(entry, "internalOrderReference", 160);
    const reconciliationStatus = requiredString(entry, "reconciliationStatus", 40);
    const jurisdiction = entry.jurisdiction === null ? null : requiredString(entry, "jurisdiction", 64);
    if (
      entry.exportVersion !== "economic-accounting-v1" || !categories.has(category)
      || !["support_one_time", "support_recurring", "sandbox_credits", "job_post_fee", "marketplace_purchase", "organization_service", "sponsorship"].includes(economicFlow)
      || !["inflow", "outflow", "memo"].includes(direction) || !/^[a-z]{3}$/.test(currency)
      || !/^[A-Za-z0-9_-]{24,160}$/.test(internalOrderReference)
      || !["recorded", "settlement_details_pending", "review"].includes(reconciliationStatus)
      || entry.taxTreatmentPendingReview !== true
    ) throw new BillingHttpError(503, "billing_database_invalid");
    const grossMinor = nullableInteger(entry, "grossMinor", -100_000_000_000, 100_000_000_000);
    const refundMinor = nullableInteger(entry, "refundMinor", 0, 100_000_000_000);
    const disputeMinor = nullableInteger(entry, "disputeMinor", 0, 100_000_000_000);
    const processorFeeMinor = nullableInteger(entry, "processorFeeMinor", 0, 100_000_000_000);
    const platformCommissionMinor = nullableInteger(entry, "platformCommissionMinor", -100_000_000_000, 100_000_000_000);
    const sellerPayableMinor = nullableInteger(entry, "sellerPayableMinor", -100_000_000_000, 100_000_000_000);
    const netMinor = nullableInteger(entry, "netMinor", -100_000_000_000, 100_000_000_000);
    if (
      reconciliationStatus === "settlement_details_pending"
      && (category !== "payment_received" || (processorFeeMinor !== null && netMinor !== null))
    ) throw new BillingHttpError(503, "billing_database_invalid");
    if (
      category === "payment_received" && reconciliationStatus === "recorded"
      && (processorFeeMinor === null || (economicFlow !== "marketplace_purchase" && netMinor === null))
    ) throw new BillingHttpError(503, "billing_database_invalid");
    return {
      exportVersion: "economic-accounting-v1", eventId: requiredUuid(entry, "eventId"),
      effectiveAt: requiredTimestamp(entry, "effectiveAt"), recordedAt: requiredTimestamp(entry, "recordedAt"),
      category, economicFlow: economicFlow as EconomicAccountingExportEntry["economicFlow"], direction: direction as "inflow" | "outflow" | "memo",
      grossMinor, refundMinor, disputeMinor, processorFeeMinor, platformCommissionMinor,
      sellerPayableMinor, netMinor,
      currency, internalOrderReference,
      provider: requiredString(entry, "provider", 40),
      providerEventDate: requiredTimestamp(entry, "providerEventDate"), jurisdiction,
      taxTreatmentPendingReview: true,
      reconciliationStatus: reconciliationStatus as EconomicAccountingExportEntry["reconciliationStatus"]
    };
  });
  return {
    exportVersion: "economic-accounting-v1", entries, limit: input.limit,
    from: new Date(Date.parse(resultFrom)).toISOString(),
    to: new Date(Date.parse(resultTo)).toISOString(), providerIdentifiersExposed: false,
    personalContactDataExposed: false, testMode: row.testMode === true,
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

export async function prepareOperatorMarketplaceTestPayout(
  supabase: SupabaseClient,
  actorUserId: string,
  input: OperatorMarketplacePayoutPreparationRequest
): Promise<{
  payoutPreparationId: string; sellerAccountId: string; amountMinor: number; currency: "usd";
  status: string; providerExecutionAvailable: false; balancesAreTestRecords: true;
  testMode: boolean; idempotentReplay: boolean;
}> {
  const { data, error } = await supabase.rpc("operator_prepare_marketplace_test_payout", {
    p_actor_user_id: actorUserId,
    p_seller_account_id: input.sellerAccountId,
    p_client_request_id: input.clientRequestId,
    p_amount_minor: input.amountMinor,
    p_currency: input.currency,
    p_confirmation: input.confirmation,
    p_reason: input.reason
  });
  if (error) throw operatorRpcFailure(error);
  const row = object(data);
  exactDatabaseKeys(row, [
    "payoutPreparationId", "sellerAccountId", "amountMinor", "currency", "status",
    "providerExecutionAvailable", "balancesAreTestRecords", "testMode", "idempotentReplay"
  ]);
  const status = requiredString(row, "status", 40);
  if (
    requiredUuid(row, "sellerAccountId") !== input.sellerAccountId
    || row.amountMinor !== input.amountMinor || row.currency !== input.currency
    || !["prepared", "canceled", "reconciled"].includes(status)
    || row.providerExecutionAvailable !== false || row.balancesAreTestRecords !== true || typeof row.testMode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  return {
    payoutPreparationId: requiredUuid(row, "payoutPreparationId"),
    sellerAccountId: input.sellerAccountId, amountMinor: input.amountMinor,
    currency: "usd", status, providerExecutionAvailable: false,
    balancesAreTestRecords: true, testMode: row.testMode === true,
    idempotentReplay: requiredBoolean(row, "idempotentReplay")
  };
}

export type EconomicOrganizationSummary = {
  organizationId: string;
  accountName: string;
  status: "pending" | "active" | "restricted" | "closed";
  relationships: EconomicOrganizationRelationship[];
  engagements: Array<{
    engagementId: string;
    serviceCode: string;
    status: string;
    statementOfWorkVersion: string;
    serviceTermsVersion: string;
    dataHandlingDisclosureVersion: string;
    amountMinor: number;
    currency: string;
    checkoutAvailable: boolean;
  }>;
  sponsorshipAgreements: Array<{
    agreementId: string;
    status: string;
    agreementVersion: string;
    disclosureVersion: string;
    amountMinor: number;
    currency: string;
    publicRecognitionOptIn: boolean;
    publicRecognitionApproved: boolean;
    checkoutAvailable: boolean;
    recognitionPreferenceAvailable: boolean;
  }>;
};

export async function loadCurrentEconomicOrganizations(
  supabase: SupabaseClient
): Promise<{
  organizations: EconomicOrganizationSummary[];
  financialDetailsPrivate: true;
  affectsCommonsIdentity: false;
  testMode: boolean;
}> {
  const { data, error } = await supabase.rpc("current_user_economic_organization_status");
  if (error) throw marketplaceRpcFailure(error, "economic_organization_status");
  const result = object(data);
  if (
    Object.keys(result).length !== 4
    || !Array.isArray(result.organizations)
    || result.organizations.length > 1_000
    || result.financialDetailsPrivate !== true
    || result.affectsCommonsIdentity !== false
    || typeof result.testMode !== "boolean"
  ) throw new BillingHttpError(503, "billing_database_invalid");
  const organizations = result.organizations.map((value): EconomicOrganizationSummary => {
    const row = object(value);
    const status = requiredString(row, "status", 40);
    exactDatabaseKeys(row, ["organizationId", "accountName", "status", "relationships", "engagements", "sponsorshipAgreements"]);
    if (
      !Array.isArray(row.relationships) || row.relationships.length > 7
      || !Array.isArray(row.engagements) || row.engagements.length > 1_000
      || !Array.isArray(row.sponsorshipAgreements) || row.sponsorshipAgreements.length > 1_000
    ) {
      throw new BillingHttpError(503, "billing_database_invalid");
    }
    const validRelationships = new Set([
      "owner", "billing_admin", "technical_contact", "procurement_contact",
      "billing_contact", "authorized_signer", "service_participant"
    ]);
    const relationships = row.relationships.map((relationship) => {
      if (typeof relationship !== "string" || !validRelationships.has(relationship)) {
        throw new BillingHttpError(503, "billing_database_invalid");
      }
      return relationship as EconomicOrganizationRelationship;
    });
    if (new Set(relationships).size !== relationships.length || !["pending", "active", "restricted", "closed"].includes(status)) {
      throw new BillingHttpError(503, "billing_database_invalid");
    }
    const engagements = row.engagements.map((entry) => {
      const engagement = object(entry);
      exactDatabaseKeys(engagement, [
        "engagementId", "status", "serviceCode", "statementOfWorkVersion", "serviceTermsVersion",
        "dataHandlingDisclosureVersion", "amountMinor", "currency", "checkoutAvailable"
      ]);
      const serviceCode = requiredString(engagement, "serviceCode", 100);
      const engagementStatus = requiredString(engagement, "status", 40);
      const currency = requiredString(engagement, "currency", 3);
      if (!/^[a-z][a-z0-9_]{2,100}$/.test(serviceCode) || ![
        "contract_pending", "active", "completed", "canceled", "reconciliation_required"
      ].includes(engagementStatus) || !/^[a-z]{3}$/.test(currency)) throw new BillingHttpError(503, "billing_database_invalid");
      return {
        engagementId: requiredUuid(engagement, "engagementId"), serviceCode, status: engagementStatus,
        statementOfWorkVersion: requiredString(engagement, "statementOfWorkVersion", 120),
        serviceTermsVersion: requiredString(engagement, "serviceTermsVersion", 120),
        dataHandlingDisclosureVersion: requiredString(engagement, "dataHandlingDisclosureVersion", 120),
        amountMinor: integer(engagement, "amountMinor", 1, 100_000_000_000), currency,
        checkoutAvailable: requiredBoolean(engagement, "checkoutAvailable")
      };
    });
    const sponsorshipStatuses = new Set([
      "ethical_review", "contract_pending", "active", "rejected", "completed", "canceled", "reconciliation_required"
    ]);
    const sponsorshipAgreements = row.sponsorshipAgreements.map((entry) => {
      const agreement = object(entry);
      exactDatabaseKeys(agreement, [
        "agreementId", "status", "agreementVersion", "disclosureVersion", "amountMinor", "currency",
        "publicRecognitionOptIn", "publicRecognitionApproved", "checkoutAvailable", "recognitionPreferenceAvailable"
      ]);
      const agreementStatus = requiredString(agreement, "status", 40);
      const currency = requiredString(agreement, "currency", 3);
      if (!sponsorshipStatuses.has(agreementStatus) || !/^[a-z]{3}$/.test(currency)) {
        throw new BillingHttpError(503, "billing_database_invalid");
      }
      return {
        agreementId: requiredUuid(agreement, "agreementId"), status: agreementStatus,
        agreementVersion: requiredString(agreement, "agreementVersion", 120),
        disclosureVersion: requiredString(agreement, "disclosureVersion", 120),
        amountMinor: integer(agreement, "amountMinor", 1, 100_000_000_000), currency,
        publicRecognitionOptIn: requiredBoolean(agreement, "publicRecognitionOptIn"),
        publicRecognitionApproved: requiredBoolean(agreement, "publicRecognitionApproved"),
        checkoutAvailable: requiredBoolean(agreement, "checkoutAvailable"),
        recognitionPreferenceAvailable: requiredBoolean(agreement, "recognitionPreferenceAvailable")
      };
    });
    return {
      organizationId: requiredUuid(row, "organizationId"),
      accountName: requiredString(row, "accountName", 200),
      status: status as EconomicOrganizationSummary["status"],
      relationships,
      engagements,
      sponsorshipAgreements
    };
  });
  return { organizations, financialDetailsPrivate: true, affectsCommonsIdentity: false, testMode: result.testMode === true };
}

export type PublicSponsorshipRecognition = {
  label: string;
  summary: string | null;
  purposeCode: string;
  grantsAuthority: false;
  isEndorsement: false;
};

export async function loadPublicSponsorshipRecognition(
  supabase: SupabaseClient
): Promise<{ enabled: boolean; recognitions: PublicSponsorshipRecognition[]; paymentGrantsAuthority: false }> {
  const { data, error } = await supabase.rpc("public_sponsorship_recognition");
  if (error) throw new BillingHttpError(503, "sponsorship_recognition_unavailable");
  const result = object(data);
  const enabled = requiredBoolean(result, "enabled");
  if (!Array.isArray(result.recognitions) || result.recognitions.length > 1_000 || result.paymentGrantsAuthority !== false) {
    throw new BillingHttpError(503, "billing_database_invalid");
  }
  const recognitions = result.recognitions.map((value): PublicSponsorshipRecognition => {
    const row = object(value);
    const label = requiredString(row, "label", 120);
    const summary = row.summary == null ? null : requiredString(row, "summary", 500);
    const purposeCode = requiredString(row, "purposeCode", 100);
    if (
      label.trim().length < 2
      || !/^[a-z][a-z0-9_]{2,100}$/.test(purposeCode)
      || row.grantsAuthority !== false
      || row.isEndorsement !== false
    ) throw new BillingHttpError(503, "billing_database_invalid");
    return { label, summary, purposeCode, grantsAuthority: false, isEndorsement: false };
  });
  if (!enabled && recognitions.length > 0) throw new BillingHttpError(503, "billing_database_invalid");
  return { enabled, recognitions, paymentGrantsAuthority: false };
}

export type PublicSupportRecognition = {
  username: string;
  displayName: string;
  grantsAuthority: false;
  amountPublic: false;
};

export async function loadPublicSupportRecognition(supabase: SupabaseClient): Promise<{
  enabled: boolean;
  supporters: PublicSupportRecognition[];
  ranked: false;
  amountsPublic: false;
  paymentGrantsAuthority: false;
}> {
  const { data, error } = await supabase.rpc("public_support_recognition");
  if (error) throw new BillingHttpError(503, "support_recognition_unavailable");
  const result = object(data);
  if (
    Object.keys(result).length !== 5
    || !Array.isArray(result.supporters)
    || result.supporters.length > 1_000
    || result.ranked !== false
    || result.amountsPublic !== false
    || result.paymentGrantsAuthority !== false
  ) throw new BillingHttpError(503, "billing_database_invalid");
  const enabled = requiredBoolean(result, "enabled");
  const seen = new Set<string>();
  const supporters = result.supporters.map((value): PublicSupportRecognition => {
    const row = object(value);
    const username = requiredString(row, "username", 80);
    if (
      Object.keys(row).length !== 4
      || seen.has(username)
      || row.grantsAuthority !== false
      || row.amountPublic !== false
    ) throw new BillingHttpError(503, "billing_database_invalid");
    seen.add(username);
    return {
      username,
      displayName: requiredString(row, "displayName", 200),
      grantsAuthority: false,
      amountPublic: false
    };
  });
  if (!enabled && supporters.length > 0) throw new BillingHttpError(503, "billing_database_invalid");
  return { enabled, supporters, ranked: false, amountsPublic: false, paymentGrantsAuthority: false };
}
