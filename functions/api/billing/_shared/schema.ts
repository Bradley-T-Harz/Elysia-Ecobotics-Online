import { BillingHttpError, parseBoundedJsonRequest } from "./http.ts";
import type {
  BillingSourceRoute,
  EconomicAccountActionRequest,
  EconomicServiceRestrictionScope,
  EconomicOperatorCapability,
  JobPostCheckoutRequest,
  MarketplaceFreeSellerAgreementRequest,
  MarketplaceCommercialTermsRequest,
  MarketplaceOfferStatusRequest,
  MarketplaceOfferConfigurationRequest,
  MarketplacePublisherLinkRequest,
  MarketplacePurchaseRequest,
  OneTimeCheckoutRequest,
  OrganizationServiceCheckoutRequest,
  OperatorAssignmentRequest,
  OperatorAccountingExportRequest,
  OperatorAssistanceEndRequest,
  OperatorAssistanceGrantRequest,
  OperatorAssistanceProgramRequest,
  OperatorAssistanceProgramStatusRequest,
  OperatorEconomicAccountActionRequest,
  OperatorEconomicOrganizationRequest,
  OperatorEconomicOrganizationMembershipRequest,
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
  PortalRequest,
  RecurringCheckoutRequest,
  RecurringSupportPriceCode,
  SandboxCreditCheckoutRequest,
  SellerOnboardingRequest,
  SponsorshipCheckoutRequest,
  SponsorshipRecognitionPreferenceRequest,
  SupportRecognitionPreferenceRequest
} from "./types.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_REFERENCE_PATTERN = /^[A-Za-z0-9_-]{24,160}$/;
const CONSENT_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const SOURCE_ROUTES = new Set<BillingSourceRoute>(["/support", "/products", "/commons-circle/support-billing"]);
const RECURRING_PRICE_CODES = new Set<RecurringSupportPriceCode>([
  "support_monthly_seed_usd",
  "support_monthly_commons_usd",
  "support_monthly_infrastructure_usd",
  "support_monthly_sandbox_usd",
  "support_monthly_50_usd"
]);
const OPERATOR_SANDBOX_SOURCE_TYPES = new Set<OperatorSandboxCreditGrantRequest["sourceType"]>([
  "starter", "sponsored", "waiver", "waived", "operational", "operator", "test"
]);
const ECONOMIC_OPERATOR_CAPABILITIES = new Set<EconomicOperatorCapability>([
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
const JOB_POST_CLASSIFICATIONS = new Set<OperatorJobPostFeeAssessmentRequest["classification"]>([
  "community_free", "commercial", "waived", "subsidized"
]);
const JOB_POST_SOURCE_ROUTES = new Set<JobPostCheckoutRequest["sourceRoute"]>([
  "/commune/rooms/job-post", "/commune/rooms/job-post/posts"
]);
const JOB_POST_PRICE_CODE_PATTERN = /^job_post_[a-z0-9]+(?:_[a-z0-9]+)*_usd$/;
const SANDBOX_CREDIT_SOURCE_ROUTES = new Set<SandboxCreditCheckoutRequest["sourceRoute"]>([
  "/commons-circle/support-billing", "/commune/sandbox-review"
]);
const SANDBOX_PACK_CODE_PATTERN = /^sandbox_test_[a-z0-9]+(?:_[a-z0-9]+)*$/;
const MARKETPLACE_PURCHASE_SOURCE_ROUTES = new Set<MarketplacePurchaseRequest["sourceRoute"]>([
  "/marketplace", "/marketplace/browse", "/marketplace/account"
]);
const SELLER_ONBOARDING_SOURCE_ROUTES = new Set<SellerOnboardingRequest["sourceRoute"]>([
  "/marketplace/account", "/developer-forge/dashboard"
]);
const MARKETPLACE_TERMS_CODE_PATTERN = /^marketplace_test_[a-z0-9]+(?:_[a-z0-9]+)*$/;
const MARKETPLACE_LICENSE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{1,100}$/;
const ASSISTANCE_KINDS = new Set<OperatorAssistanceProgramRequest["assistanceKind"]>(["waiver", "subsidy", "sponsored_access"]);
const ASSISTANCE_SCOPES = new Set<OperatorAssistanceProgramRequest["scope"]>([
  "job_post_fee", "sandbox_credits"
]);
const ECONOMIC_SERVICE_RESTRICTION_SCOPES = new Set<EconomicServiceRestrictionScope>([
  "billing", "recurring_support", "sandbox", "marketplace_buying", "marketplace_selling", "job_posting"
]);
const ECONOMIC_ORGANIZATION_RELATIONSHIPS = new Set<OperatorEconomicOrganizationMembershipRequest["relationship"]>([
  "owner", "billing_admin", "technical_contact", "procurement_contact",
  "billing_contact", "authorized_signer", "service_participant"
]);
const ORGANIZATION_SERVICE_REVIEW_CONFIRMATIONS: Record<OperatorOrganizationServiceReviewRequest["action"], OperatorOrganizationServiceReviewRequest["confirmation"]> = {
  activate: "ACTIVATE TEST ORGANIZATION SERVICE",
  complete: "COMPLETE TEST ORGANIZATION SERVICE",
  cancel: "CANCEL TEST ORGANIZATION SERVICE",
  reconciliation_required: "MARK TEST ORGANIZATION RECONCILIATION REQUIRED",
  resolve_resume: "RESOLVE TEST ORGANIZATION RECONCILIATION AS ACTIVE",
  resolve_complete: "RESOLVE TEST ORGANIZATION RECONCILIATION AS COMPLETED",
  resolve_cancel: "RESOLVE TEST ORGANIZATION RECONCILIATION AS CANCELED"
};
const SPONSORSHIP_REVIEW_CONFIRMATIONS: Record<OperatorSponsorshipReviewRequest["action"], OperatorSponsorshipReviewRequest["confirmation"]> = {
  approve: "APPROVE TEST SPONSORSHIP WITHOUT CONTROL",
  activate: "ACTIVATE PAID TEST SPONSORSHIP WITHOUT CONTROL",
  reject: "REJECT TEST SPONSORSHIP",
  complete: "COMPLETE TEST SPONSORSHIP",
  cancel: "CANCEL TEST SPONSORSHIP",
  resolve_resume: "RESOLVE TEST SPONSORSHIP RECONCILIATION AS ACTIVE",
  resolve_complete: "RESOLVE TEST SPONSORSHIP RECONCILIATION AS COMPLETED",
  resolve_cancel: "RESOLVE TEST SPONSORSHIP RECONCILIATION AS CANCELED"
};
const ASSISTANCE_PROGRAM_STATUS_CONFIRMATIONS: Record<OperatorAssistanceProgramStatusRequest["targetStatus"], OperatorAssistanceProgramStatusRequest["confirmation"]> = {
  active: "ACTIVATE TEST ECONOMIC ASSISTANCE PROGRAM",
  paused: "PAUSE TEST ECONOMIC ASSISTANCE PROGRAM",
  retired: "RETIRE TEST ECONOMIC ASSISTANCE PROGRAM"
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BillingHttpError(400, "request_schema_invalid");
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  const keySet = new Set(allowed);
  if (Object.keys(value).some((key) => !keySet.has(key))) throw new BillingHttpError(400, "request_schema_invalid");
}

function clientRequestId(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new BillingHttpError(400, "client_request_id_invalid");
  return value.toLowerCase();
}

function uuidField(value: unknown, errorCode: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new BillingHttpError(400, errorCode);
  return value.toLowerCase();
}

function nullableUuidField(value: unknown, errorCode: string): string | null {
  if (value === null) return null;
  return uuidField(value, errorCode);
}

function privateReason(value: unknown): string {
  if (typeof value !== "string") throw new BillingHttpError(400, "operator_reason_invalid");
  const trimmed = value.trim();
  if (
    trimmed.length < 8
    || trimmed.length > 1_000
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(trimmed)
  ) throw new BillingHttpError(400, "operator_reason_invalid");
  return trimmed;
}

function operatorExpiration(value: unknown): string | null {
  if (value === null) return null;
  if (
    typeof value !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
  ) throw new BillingHttpError(400, "operator_expiration_invalid");
  const timestamp = Date.parse(value);
  const maximum = Date.now() + Math.floor(10 * 365.25 * 24 * 60 * 60 * 1_000);
  if (!Number.isFinite(timestamp) || timestamp <= Date.now() || timestamp > maximum) {
    throw new BillingHttpError(400, "operator_expiration_invalid");
  }
  return new Date(timestamp).toISOString();
}

function economicTimestamp(value: unknown, errorCode: string): string {
  if (
    typeof value !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
  ) throw new BillingHttpError(400, errorCode);
  const timestamp = Date.parse(value);
  const minimum = Date.UTC(2020, 0, 1);
  const maximum = Date.now() + Math.floor(10 * 365.25 * 24 * 60 * 60 * 1_000);
  if (!Number.isFinite(timestamp) || timestamp < minimum || timestamp > maximum) {
    throw new BillingHttpError(400, errorCode);
  }
  return new Date(timestamp).toISOString();
}

function sourceRoute(value: unknown): BillingSourceRoute {
  if (typeof value !== "string" || !SOURCE_ROUTES.has(value as BillingSourceRoute)) {
    throw new BillingHttpError(400, "source_route_invalid");
  }
  return value as BillingSourceRoute;
}

function consentVersion(value: unknown): string {
  if (typeof value !== "string" || !CONSENT_VERSION_PATTERN.test(value)) {
    throw new BillingHttpError(400, "consent_version_invalid");
  }
  return value;
}

function marketplaceDocumentVersion(value: unknown, errorCode: string): string {
  if (
    typeof value !== "string"
    || value.length > 120
    || !/^[A-Za-z0-9][A-Za-z0-9._:+-]{0,119}$/.test(value)
  ) throw new BillingHttpError(400, errorCode);
  return value;
}

function nullableOperatorText(value: unknown, maximum: number, errorCode: string, minimum = 1): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new BillingHttpError(400, errorCode);
  const trimmed = value.trim();
  if (
    trimmed.length < minimum || trimmed.length > maximum
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(trimmed)
  ) throw new BillingHttpError(400, errorCode);
  return trimmed;
}

function economicCode(value: unknown, maximum: number, errorCode: string): string {
  if (typeof value !== "string" || value.length > maximum || !/^[a-z][a-z0-9_]{2,120}$/.test(value)) {
    throw new BillingHttpError(400, errorCode);
  }
  return value;
}

export function parseOneTimeCheckout(value: unknown): OneTimeCheckoutRequest {
  const input = record(value);
  exactKeys(input, ["clientRequestId", "amountMinor", "currency", "sourceRoute", "consentVersion"]);
  if (!Number.isInteger(input.amountMinor) || Number(input.amountMinor) < 100 || Number(input.amountMinor) > 50_000) {
    throw new BillingHttpError(400, "amount_invalid");
  }
  if (input.currency !== "usd") throw new BillingHttpError(400, "currency_invalid");
  return {
    clientRequestId: clientRequestId(input.clientRequestId),
    amountMinor: Number(input.amountMinor),
    currency: "usd",
    sourceRoute: sourceRoute(input.sourceRoute),
    consentVersion: consentVersion(input.consentVersion)
  };
}

export function parseRecurringCheckout(value: unknown): RecurringCheckoutRequest {
  const input = record(value);
  exactKeys(input, ["clientRequestId", "priceCode", "sourceRoute", "consentVersion"]);
  if (typeof input.priceCode !== "string" || !RECURRING_PRICE_CODES.has(input.priceCode as RecurringSupportPriceCode)) {
    throw new BillingHttpError(400, "price_code_invalid");
  }
  return {
    clientRequestId: clientRequestId(input.clientRequestId),
    priceCode: input.priceCode as RecurringSupportPriceCode,
    sourceRoute: sourceRoute(input.sourceRoute),
    consentVersion: consentVersion(input.consentVersion)
  };
}

export function parsePortalRequest(value: unknown): PortalRequest {
  const input = record(value);
  exactKeys(input, ["clientRequestId"]);
  return { clientRequestId: clientRequestId(input.clientRequestId) };
}

export function parseSellerOnboardingRequest(value: unknown): SellerOnboardingRequest {
  const input = record(value);
  exactKeys(input, [
    "clientRequestId", "sellerAgreementVersion", "stripeConnectDisclosureVersion",
    "sourceRoute", "acceptSellerAgreement", "acceptStripeConnectDisclosure"
  ]);
  if (input.acceptSellerAgreement !== true || input.acceptStripeConnectDisclosure !== true) {
    throw new BillingHttpError(400, "seller_consent_required");
  }
  if (
    typeof input.sourceRoute !== "string"
    || !SELLER_ONBOARDING_SOURCE_ROUTES.has(input.sourceRoute as SellerOnboardingRequest["sourceRoute"])
  ) throw new BillingHttpError(400, "source_route_invalid");
  return {
    clientRequestId: clientRequestId(input.clientRequestId),
    sellerAgreementVersion: marketplaceDocumentVersion(input.sellerAgreementVersion, "seller_agreement_version_invalid"),
    stripeConnectDisclosureVersion: marketplaceDocumentVersion(input.stripeConnectDisclosureVersion, "stripe_connect_disclosure_version_invalid"),
    sourceRoute: input.sourceRoute as SellerOnboardingRequest["sourceRoute"],
    acceptSellerAgreement: true,
    acceptStripeConnectDisclosure: true
  };
}

export function parseMarketplaceFreeSellerAgreement(value: unknown): MarketplaceFreeSellerAgreementRequest {
  const input = record(value);
  exactKeys(input, ["clientRequestId", "agreementVersion", "sourceRoute", "acceptAgreement", "confirmation"]);
  if (input.sourceRoute !== "/marketplace/account") throw new BillingHttpError(400, "source_route_invalid");
  if (input.acceptAgreement !== true) throw new BillingHttpError(400, "marketplace_free_seller_agreement_required");
  if (input.confirmation !== "ACCEPT FREE MARKETPLACE SELLER AGREEMENT") {
    throw new BillingHttpError(400, "marketplace_free_seller_confirmation_invalid");
  }
  return {
    clientRequestId: clientRequestId(input.clientRequestId),
    agreementVersion: consentVersion(input.agreementVersion),
    sourceRoute: "/marketplace/account",
    acceptAgreement: true,
    confirmation: "ACCEPT FREE MARKETPLACE SELLER AGREEMENT"
  };
}

export function parseMarketplacePurchase(value: unknown): MarketplacePurchaseRequest {
  const input = record(value);
  exactKeys(input, ["offerId", "clientRequestId", "sourceRoute", "consentVersion"]);
  if (
    typeof input.sourceRoute !== "string"
    || !MARKETPLACE_PURCHASE_SOURCE_ROUTES.has(input.sourceRoute as MarketplacePurchaseRequest["sourceRoute"])
  ) throw new BillingHttpError(400, "source_route_invalid");
  return {
    offerId: uuidField(input.offerId, "marketplace_offer_id_invalid"),
    clientRequestId: clientRequestId(input.clientRequestId),
    sourceRoute: input.sourceRoute as MarketplacePurchaseRequest["sourceRoute"],
    consentVersion: marketplaceDocumentVersion(input.consentVersion, "marketplace_consent_version_invalid")
  };
}

export function parseMarketplaceOfferConfiguration(value: unknown): MarketplaceOfferConfigurationRequest {
  const input = record(value);
  exactKeys(input, [
    "clientRequestId", "addonVersionId", "publisherId", "offerKind", "amountMinor",
    "licenseKey", "licenseVersion", "buyerTermsVersion", "commercialTermsCode", "sellerAgreementVersion",
    "confirmation", "reason"
  ]);
  if (input.offerKind !== "free" && input.offerKind !== "paid") {
    throw new BillingHttpError(400, "marketplace_offer_kind_invalid");
  }
  const offerKind = input.offerKind;
  let amountMinor: number | null = null;
  let commercialTermsCode: string | null = null;
  if (offerKind === "paid") {
    if (!Number.isSafeInteger(input.amountMinor) || Number(input.amountMinor) < 50 || Number(input.amountMinor) > 10_000_000) {
      throw new BillingHttpError(400, "marketplace_offer_amount_invalid");
    }
    if (
      typeof input.commercialTermsCode !== "string"
      || input.commercialTermsCode.length > 117
      || !MARKETPLACE_TERMS_CODE_PATTERN.test(input.commercialTermsCode)
    ) throw new BillingHttpError(400, "marketplace_commercial_terms_code_invalid");
    amountMinor = Number(input.amountMinor);
    commercialTermsCode = input.commercialTermsCode;
  } else if (input.amountMinor !== null || input.commercialTermsCode !== null) {
    throw new BillingHttpError(400, "marketplace_free_offer_economics_invalid");
  }
  if (typeof input.licenseKey !== "string" || !MARKETPLACE_LICENSE_KEY_PATTERN.test(input.licenseKey)) {
    throw new BillingHttpError(400, "marketplace_license_key_invalid");
  }
  if (input.confirmation !== "CONFIGURE MARKETPLACE TEST OFFER") {
    throw new BillingHttpError(400, "marketplace_offer_confirmation_invalid");
  }
  return {
    clientRequestId: clientRequestId(input.clientRequestId),
    addonVersionId: uuidField(input.addonVersionId, "marketplace_addon_version_id_invalid"),
    publisherId: nullableUuidField(input.publisherId, "marketplace_publisher_id_invalid"),
    offerKind,
    amountMinor,
    licenseKey: input.licenseKey,
    licenseVersion: marketplaceDocumentVersion(input.licenseVersion, "marketplace_license_version_invalid"),
    buyerTermsVersion: marketplaceDocumentVersion(input.buyerTermsVersion, "marketplace_buyer_terms_version_invalid"),
    commercialTermsCode,
    sellerAgreementVersion: marketplaceDocumentVersion(input.sellerAgreementVersion, "seller_agreement_version_invalid"),
    confirmation: "CONFIGURE MARKETPLACE TEST OFFER",
    reason: privateReason(input.reason)
  };
}

export function parseMarketplaceOfferStatus(value: unknown): MarketplaceOfferStatusRequest {
  const input = record(value);
  exactKeys(input, ["clientRequestId", "offerId", "targetStatus", "confirmation", "reason"]);
  const confirmations = {
    active: "ACTIVATE MARKETPLACE TEST OFFER",
    suspended: "SUSPEND MARKETPLACE TEST OFFER",
    retired: "RETIRE MARKETPLACE TEST OFFER"
  } as const;
  if (typeof input.targetStatus !== "string" || !(input.targetStatus in confirmations)) {
    throw new BillingHttpError(400, "marketplace_offer_status_invalid");
  }
  const targetStatus = input.targetStatus as keyof typeof confirmations;
  const confirmation = confirmations[targetStatus];
  if (input.confirmation !== confirmation) throw new BillingHttpError(400, "marketplace_offer_status_confirmation_invalid");
  return {
    clientRequestId: clientRequestId(input.clientRequestId),
    offerId: uuidField(input.offerId, "marketplace_offer_id_invalid"),
    targetStatus,
    confirmation,
    reason: privateReason(input.reason)
  };
}

export function parseMarketplacePublisherLink(value: unknown): MarketplacePublisherLinkRequest {
  const input = record(value);
  exactKeys(input, ["publisherId", "clientRequestId", "confirmation", "reason"]);
  if (input.confirmation !== "LINK MARKETPLACE SELLER TO PUBLISHER") {
    throw new BillingHttpError(400, "marketplace_publisher_link_confirmation_invalid");
  }
  return {
    publisherId: uuidField(input.publisherId, "marketplace_publisher_id_invalid"),
    clientRequestId: clientRequestId(input.clientRequestId),
    confirmation: "LINK MARKETPLACE SELLER TO PUBLISHER",
    reason: privateReason(input.reason)
  };
}

export function parseMarketplaceCommercialTerms(value: unknown): MarketplaceCommercialTermsRequest {
  const input = record(value);
  exactKeys(input, [
    "clientRequestId", "termsCode", "commissionBps", "sellerAgreementVersion",
    "buyerTermsVersion", "active", "confirmation", "reason"
  ]);
  if (
    typeof input.termsCode !== "string"
    || input.termsCode.length > 117
    || !MARKETPLACE_TERMS_CODE_PATTERN.test(input.termsCode)
  ) throw new BillingHttpError(400, "marketplace_commercial_terms_code_invalid");
  if (!Number.isInteger(input.commissionBps) || Number(input.commissionBps) < 0 || Number(input.commissionBps) > 5_000) {
    throw new BillingHttpError(400, "marketplace_commission_invalid");
  }
  if (typeof input.active !== "boolean") throw new BillingHttpError(400, "marketplace_terms_active_invalid");
  if (input.confirmation !== "CONFIGURE MARKETPLACE TEST COMMERCIAL TERMS") {
    throw new BillingHttpError(400, "marketplace_terms_confirmation_invalid");
  }
  return {
    clientRequestId: clientRequestId(input.clientRequestId),
    termsCode: input.termsCode,
    commissionBps: Number(input.commissionBps),
    sellerAgreementVersion: marketplaceDocumentVersion(input.sellerAgreementVersion, "seller_agreement_version_invalid"),
    buyerTermsVersion: marketplaceDocumentVersion(input.buyerTermsVersion, "marketplace_buyer_terms_version_invalid"),
    active: input.active,
    confirmation: "CONFIGURE MARKETPLACE TEST COMMERCIAL TERMS",
    reason: privateReason(input.reason)
  };
}

export function parseOperatorEconomicOrganization(value: unknown): OperatorEconomicOrganizationRequest {
  const input = record(value);
  exactKeys(input, ["clientRequestId", "accountName", "countryCode", "initialContactUserId", "confirmation", "reason"]);
  if (typeof input.accountName !== "string") throw new BillingHttpError(400, "economic_organization_name_invalid");
  const accountName = input.accountName.trim();
  if (accountName.length < 2 || accountName.length > 200 || /[\u0000-\u001f\u007f]/.test(accountName)) {
    throw new BillingHttpError(400, "economic_organization_name_invalid");
  }
  let countryCode: string | null = null;
  if (input.countryCode !== null) {
    if (typeof input.countryCode !== "string" || !/^[A-Za-z]{2}$/.test(input.countryCode)) {
      throw new BillingHttpError(400, "economic_organization_country_invalid");
    }
    countryCode = input.countryCode.toUpperCase();
  }
  if (input.confirmation !== "CREATE ECONOMIC ORGANIZATION") {
    throw new BillingHttpError(400, "economic_organization_confirmation_invalid");
  }
  return {
    clientRequestId: clientRequestId(input.clientRequestId), accountName, countryCode,
    initialContactUserId: uuidField(input.initialContactUserId, "economic_organization_contact_invalid"),
    confirmation: "CREATE ECONOMIC ORGANIZATION", reason: privateReason(input.reason)
  };
}

export function parseOperatorEconomicOrganizationMembership(value: unknown): OperatorEconomicOrganizationMembershipRequest {
  const input = record(value);
  exactKeys(input, [
    "clientRequestId", "organizationId", "targetUserId", "relationship",
    "enabled", "confirmation", "reason"
  ]);
  if (
    typeof input.relationship !== "string"
    || !ECONOMIC_ORGANIZATION_RELATIONSHIPS.has(input.relationship as OperatorEconomicOrganizationMembershipRequest["relationship"])
  ) throw new BillingHttpError(400, "economic_organization_relationship_invalid");
  if (typeof input.enabled !== "boolean") throw new BillingHttpError(400, "economic_organization_membership_state_invalid");
  if (input.confirmation !== "SET ECONOMIC ORGANIZATION MEMBERSHIP") {
    throw new BillingHttpError(400, "economic_organization_membership_confirmation_invalid");
  }
  return {
    clientRequestId: clientRequestId(input.clientRequestId),
    organizationId: uuidField(input.organizationId, "economic_organization_id_invalid"),
    targetUserId: uuidField(input.targetUserId, "economic_organization_member_invalid"),
    relationship: input.relationship as OperatorEconomicOrganizationMembershipRequest["relationship"],
    enabled: input.enabled,
    confirmation: "SET ECONOMIC ORGANIZATION MEMBERSHIP",
    reason: privateReason(input.reason)
  };
}

export function parseOperatorOrganizationServiceEngagement(value: unknown): OperatorOrganizationServiceEngagementRequest {
  const input = record(value);
  exactKeys(input, [
    "clientRequestId", "organizationId", "authorizedSignerUserId", "serviceCode", "priceCode",
    "statementOfWorkVersion", "serviceTermsVersion", "dataHandlingDisclosureVersion",
    "confidentialityClass", "proposalReference", "contractReference", "invoiceReference",
    "startsAt", "endsAt", "confirmation", "reason"
  ]);
  if (!new Set(["internal", "confidential", "restricted"]).has(String(input.confidentialityClass))) {
    throw new BillingHttpError(400, "organization_service_confidentiality_invalid");
  }
  const startsAt = economicTimestamp(input.startsAt, "organization_service_start_invalid");
  const endsAt = input.endsAt === null ? null : economicTimestamp(input.endsAt, "organization_service_end_invalid");
  if (endsAt !== null && Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new BillingHttpError(400, "organization_service_end_invalid");
  }
  if (input.confirmation !== "CREATE TEST ORGANIZATION SERVICE ENGAGEMENT") {
    throw new BillingHttpError(400, "organization_service_confirmation_invalid");
  }
  return {
    clientRequestId: clientRequestId(input.clientRequestId),
    organizationId: uuidField(input.organizationId, "economic_organization_id_invalid"),
    authorizedSignerUserId: uuidField(input.authorizedSignerUserId, "organization_service_signer_invalid"),
    serviceCode: economicCode(input.serviceCode, 100, "organization_service_code_invalid"),
    priceCode: economicCode(input.priceCode, 120, "organization_service_price_invalid"),
    statementOfWorkVersion: marketplaceDocumentVersion(input.statementOfWorkVersion, "organization_statement_of_work_version_invalid"),
    serviceTermsVersion: marketplaceDocumentVersion(input.serviceTermsVersion, "organization_service_terms_version_invalid"),
    dataHandlingDisclosureVersion: marketplaceDocumentVersion(input.dataHandlingDisclosureVersion, "organization_data_disclosure_version_invalid"),
    confidentialityClass: input.confidentialityClass as OperatorOrganizationServiceEngagementRequest["confidentialityClass"],
    proposalReference: nullableOperatorText(input.proposalReference, 120, "organization_proposal_reference_invalid"),
    contractReference: nullableOperatorText(input.contractReference, 120, "organization_contract_reference_invalid"),
    invoiceReference: nullableOperatorText(input.invoiceReference, 120, "organization_invoice_reference_invalid"),
    startsAt, endsAt,
    confirmation: "CREATE TEST ORGANIZATION SERVICE ENGAGEMENT",
    reason: privateReason(input.reason)
  };
}

export function parseOperatorOrganizationServiceReview(value: unknown): OperatorOrganizationServiceReviewRequest {
  const input = record(value);
  exactKeys(input, ["engagementId", "clientRequestId", "action", "confirmation", "reason"]);
  if (typeof input.action !== "string" || !(input.action in ORGANIZATION_SERVICE_REVIEW_CONFIRMATIONS)) {
    throw new BillingHttpError(400, "organization_service_review_action_invalid");
  }
  const action = input.action as OperatorOrganizationServiceReviewRequest["action"];
  const expectedConfirmation = ORGANIZATION_SERVICE_REVIEW_CONFIRMATIONS[action];
  if (input.confirmation !== expectedConfirmation) {
    throw new BillingHttpError(400, "organization_service_review_confirmation_invalid");
  }
  return {
    engagementId: uuidField(input.engagementId, "organization_service_engagement_id_invalid"),
    clientRequestId: clientRequestId(input.clientRequestId), action,
    confirmation: expectedConfirmation, reason: privateReason(input.reason)
  };
}

export function parseOperatorSponsorshipAgreement(value: unknown): OperatorSponsorshipAgreementRequest {
  const input = record(value);
  exactKeys(input, [
    "clientRequestId", "organizationId", "authorizedSignerUserId", "purposeCode", "priceCode",
    "agreementVersion", "disclosureVersion", "publicLabel", "publicSummary", "confirmation", "reason"
  ]);
  if (input.confirmation !== "CREATE TEST SPONSORSHIP AGREEMENT WITHOUT CONTROL") {
    throw new BillingHttpError(400, "sponsorship_agreement_confirmation_invalid");
  }
  return {
    clientRequestId: clientRequestId(input.clientRequestId),
    organizationId: uuidField(input.organizationId, "economic_organization_id_invalid"),
    authorizedSignerUserId: uuidField(input.authorizedSignerUserId, "sponsorship_signer_invalid"),
    purposeCode: economicCode(input.purposeCode, 100, "sponsorship_purpose_code_invalid"),
    priceCode: economicCode(input.priceCode, 120, "sponsorship_price_code_invalid"),
    agreementVersion: marketplaceDocumentVersion(input.agreementVersion, "sponsorship_agreement_version_invalid"),
    disclosureVersion: marketplaceDocumentVersion(input.disclosureVersion, "sponsorship_disclosure_version_invalid"),
    publicLabel: nullableOperatorText(input.publicLabel, 120, "sponsorship_public_label_invalid", 2),
    publicSummary: nullableOperatorText(input.publicSummary, 500, "sponsorship_public_summary_invalid"),
    confirmation: "CREATE TEST SPONSORSHIP AGREEMENT WITHOUT CONTROL",
    reason: privateReason(input.reason)
  };
}

export function parseOperatorSponsorshipReview(value: unknown): OperatorSponsorshipReviewRequest {
  const input = record(value);
  exactKeys(input, ["sponsorshipAgreementId", "clientRequestId", "action", "confirmation", "reason"]);
  if (typeof input.action !== "string" || !(input.action in SPONSORSHIP_REVIEW_CONFIRMATIONS)) {
    throw new BillingHttpError(400, "sponsorship_review_action_invalid");
  }
  const action = input.action as OperatorSponsorshipReviewRequest["action"];
  const expectedConfirmation = SPONSORSHIP_REVIEW_CONFIRMATIONS[action];
  if (input.confirmation !== expectedConfirmation) throw new BillingHttpError(400, "sponsorship_review_confirmation_invalid");
  return {
    sponsorshipAgreementId: uuidField(input.sponsorshipAgreementId, "sponsorship_agreement_id_invalid"),
    clientRequestId: clientRequestId(input.clientRequestId), action,
    confirmation: expectedConfirmation, reason: privateReason(input.reason)
  };
}

export function parseOperatorSponsorshipRecognition(value: unknown): OperatorSponsorshipRecognitionRequest {
  const input = record(value);
  exactKeys(input, ["sponsorshipAgreementId", "clientRequestId", "approved", "confirmation", "reason"]);
  if (typeof input.approved !== "boolean") throw new BillingHttpError(400, "sponsorship_recognition_approval_invalid");
  const expected = input.approved
    ? "APPROVE NEUTRAL SPONSORSHIP RECOGNITION"
    : "REVOKE NEUTRAL SPONSORSHIP RECOGNITION";
  if (input.confirmation !== expected) throw new BillingHttpError(400, "sponsorship_recognition_confirmation_invalid");
  return {
    sponsorshipAgreementId: uuidField(input.sponsorshipAgreementId, "sponsorship_agreement_id_invalid"),
    clientRequestId: clientRequestId(input.clientRequestId), approved: input.approved,
    confirmation: expected, reason: privateReason(input.reason)
  };
}

export function parseSponsorshipRecognitionPreference(value: unknown): SponsorshipRecognitionPreferenceRequest {
  const input = record(value);
  exactKeys(input, [
    "sponsorshipAgreementId", "clientRequestId", "optedIn", "sourceRoute",
    "agreementVersion", "disclosureVersion", "confirmation"
  ]);
  if (typeof input.optedIn !== "boolean") throw new BillingHttpError(400, "sponsorship_recognition_preference_invalid");
  if (input.sourceRoute !== "/commons-circle/support-billing") throw new BillingHttpError(400, "source_route_invalid");
  const expected = input.optedIn
    ? "PUBLISH NEUTRAL SPONSORSHIP RECOGNITION"
    : "REMOVE NEUTRAL SPONSORSHIP RECOGNITION";
  if (input.confirmation !== expected) throw new BillingHttpError(400, "sponsorship_recognition_confirmation_invalid");
  return {
    sponsorshipAgreementId: uuidField(input.sponsorshipAgreementId, "sponsorship_agreement_id_invalid"),
    clientRequestId: clientRequestId(input.clientRequestId), optedIn: input.optedIn,
    sourceRoute: "/commons-circle/support-billing",
    agreementVersion: marketplaceDocumentVersion(input.agreementVersion, "sponsorship_agreement_version_invalid"),
    disclosureVersion: marketplaceDocumentVersion(input.disclosureVersion, "sponsorship_disclosure_version_invalid"),
    confirmation: expected
  };
}

export function parseOrganizationServiceCheckout(value: unknown): OrganizationServiceCheckoutRequest {
  const input = record(value);
  exactKeys(input, [
    "engagementId", "clientRequestId", "sourceRoute", "legalBundleVersion",
    "statementOfWorkVersion", "serviceTermsVersion", "dataHandlingDisclosureVersion"
  ]);
  if (input.sourceRoute !== "/commons-circle/support-billing") throw new BillingHttpError(400, "source_route_invalid");
  return {
    engagementId: uuidField(input.engagementId, "organization_service_engagement_id_invalid"),
    clientRequestId: clientRequestId(input.clientRequestId),
    sourceRoute: "/commons-circle/support-billing",
    legalBundleVersion: marketplaceDocumentVersion(input.legalBundleVersion, "legal_bundle_version_invalid"),
    statementOfWorkVersion: marketplaceDocumentVersion(input.statementOfWorkVersion, "organization_statement_of_work_version_invalid"),
    serviceTermsVersion: marketplaceDocumentVersion(input.serviceTermsVersion, "organization_service_terms_version_invalid"),
    dataHandlingDisclosureVersion: marketplaceDocumentVersion(input.dataHandlingDisclosureVersion, "organization_data_disclosure_version_invalid")
  };
}

export function parseSponsorshipCheckout(value: unknown): SponsorshipCheckoutRequest {
  const input = record(value);
  exactKeys(input, [
    "sponsorshipAgreementId", "clientRequestId", "sourceRoute", "legalBundleVersion",
    "agreementVersion", "disclosureVersion"
  ]);
  if (input.sourceRoute !== "/commons-circle/support-billing") throw new BillingHttpError(400, "source_route_invalid");
  return {
    sponsorshipAgreementId: uuidField(input.sponsorshipAgreementId, "sponsorship_agreement_id_invalid"),
    clientRequestId: clientRequestId(input.clientRequestId),
    sourceRoute: "/commons-circle/support-billing",
    legalBundleVersion: marketplaceDocumentVersion(input.legalBundleVersion, "legal_bundle_version_invalid"),
    agreementVersion: marketplaceDocumentVersion(input.agreementVersion, "sponsorship_agreement_version_invalid"),
    disclosureVersion: marketplaceDocumentVersion(input.disclosureVersion, "sponsorship_disclosure_version_invalid")
  };
}

export function parseOperatorSponsorshipAssistanceAllocation(value: unknown): OperatorSponsorshipAssistanceAllocationRequest {
  const input = record(value);
  exactKeys(input, [
    "clientRequestId", "sponsorshipAgreementId", "assistanceProgramId", "allocationKind",
    "allocationCap", "currency", "confirmation", "reason"
  ]);
  if (!new Set(["funding_minor", "sandbox_credit_units", "grant_count"]).has(String(input.allocationKind))) {
    throw new BillingHttpError(400, "sponsorship_allocation_kind_invalid");
  }
  if (!Number.isSafeInteger(input.allocationCap) || Number(input.allocationCap) < 1 || Number(input.allocationCap) > 100_000_000_000) {
    throw new BillingHttpError(400, "sponsorship_allocation_cap_invalid");
  }
  const allocationKind = input.allocationKind as OperatorSponsorshipAssistanceAllocationRequest["allocationKind"];
  if ((allocationKind === "funding_minor" && input.currency !== "usd") || (allocationKind !== "funding_minor" && input.currency !== null)) {
    throw new BillingHttpError(400, "sponsorship_allocation_currency_invalid");
  }
  if (input.confirmation !== "CREATE SPONSORSHIP ASSISTANCE ALLOCATION") {
    throw new BillingHttpError(400, "sponsorship_allocation_confirmation_invalid");
  }
  return {
    clientRequestId: clientRequestId(input.clientRequestId),
    sponsorshipAgreementId: uuidField(input.sponsorshipAgreementId, "sponsorship_agreement_id_invalid"),
    assistanceProgramId: uuidField(input.assistanceProgramId, "economic_assistance_program_id_invalid"),
    allocationKind, allocationCap: Number(input.allocationCap),
    currency: input.currency as "usd" | null,
    confirmation: "CREATE SPONSORSHIP ASSISTANCE ALLOCATION",
    reason: privateReason(input.reason)
  };
}

export function parseOperatorSponsorshipAssistanceAllocationClose(value: unknown): OperatorSponsorshipAssistanceAllocationCloseRequest {
  const input = record(value);
  exactKeys(input, ["clientRequestId", "allocationId", "confirmation", "reason"]);
  if (input.confirmation !== "CLOSE SPONSORSHIP ASSISTANCE ALLOCATION") {
    throw new BillingHttpError(400, "sponsorship_allocation_close_confirmation_invalid");
  }
  return {
    clientRequestId: clientRequestId(input.clientRequestId),
    allocationId: uuidField(input.allocationId, "sponsorship_allocation_id_invalid"),
    confirmation: "CLOSE SPONSORSHIP ASSISTANCE ALLOCATION",
    reason: privateReason(input.reason)
  };
}

export function parseOperatorAssistanceProgram(value: unknown): OperatorAssistanceProgramRequest {
  const input = record(value);
  exactKeys(input, [
    "clientRequestId", "programCode", "assistanceKind", "scope", "publicLabel",
    "termsVersion", "startsAt", "endsAt", "maxGrants", "activate", "confirmation", "reason"
  ]);
  if (typeof input.programCode !== "string" || !/^[a-z][a-z0-9_]{2,100}$/.test(input.programCode)) {
    throw new BillingHttpError(400, "economic_assistance_program_code_invalid");
  }
  if (typeof input.assistanceKind !== "string" || !ASSISTANCE_KINDS.has(input.assistanceKind as OperatorAssistanceProgramRequest["assistanceKind"])) {
    throw new BillingHttpError(400, "economic_assistance_kind_invalid");
  }
  if (typeof input.scope !== "string" || !ASSISTANCE_SCOPES.has(input.scope as OperatorAssistanceProgramRequest["scope"])) {
    throw new BillingHttpError(400, "economic_assistance_scope_invalid");
  }
  if (typeof input.publicLabel !== "string") throw new BillingHttpError(400, "economic_assistance_label_invalid");
  const publicLabel = input.publicLabel.trim();
  if (publicLabel.length < 2 || publicLabel.length > 120 || /[\u0000-\u001f\u007f]/.test(publicLabel)) {
    throw new BillingHttpError(400, "economic_assistance_label_invalid");
  }
  const startsAt = economicTimestamp(input.startsAt, "economic_assistance_start_invalid");
  const endsAt = input.endsAt === null ? null : economicTimestamp(input.endsAt, "economic_assistance_end_invalid");
  if (endsAt !== null && Date.parse(endsAt) <= Date.parse(startsAt)) throw new BillingHttpError(400, "economic_assistance_end_invalid");
  let maxGrants: number | null = null;
  if (input.maxGrants !== null) {
    if (!Number.isSafeInteger(input.maxGrants) || Number(input.maxGrants) < 1 || Number(input.maxGrants) > 1_000_000) {
      throw new BillingHttpError(400, "economic_assistance_max_grants_invalid");
    }
    maxGrants = Number(input.maxGrants);
  }
  if (typeof input.activate !== "boolean") throw new BillingHttpError(400, "economic_assistance_activation_invalid");
  if (input.confirmation !== "CONFIGURE ECONOMIC ASSISTANCE PROGRAM") {
    throw new BillingHttpError(400, "economic_assistance_confirmation_invalid");
  }
  return {
    clientRequestId: clientRequestId(input.clientRequestId), programCode: input.programCode,
    assistanceKind: input.assistanceKind as OperatorAssistanceProgramRequest["assistanceKind"],
    scope: input.scope as OperatorAssistanceProgramRequest["scope"], publicLabel,
    termsVersion: marketplaceDocumentVersion(input.termsVersion, "economic_assistance_terms_version_invalid"),
    startsAt, endsAt, maxGrants, activate: input.activate,
    confirmation: "CONFIGURE ECONOMIC ASSISTANCE PROGRAM", reason: privateReason(input.reason)
  };
}

export function parseOperatorAssistanceProgramStatus(value: unknown): OperatorAssistanceProgramStatusRequest {
  const input = record(value);
  exactKeys(input, ["clientRequestId", "programId", "targetStatus", "confirmation", "reason"]);
  if (typeof input.targetStatus !== "string" || !(input.targetStatus in ASSISTANCE_PROGRAM_STATUS_CONFIRMATIONS)) {
    throw new BillingHttpError(400, "economic_assistance_program_status_invalid");
  }
  const targetStatus = input.targetStatus as OperatorAssistanceProgramStatusRequest["targetStatus"];
  const expected = ASSISTANCE_PROGRAM_STATUS_CONFIRMATIONS[targetStatus];
  if (input.confirmation !== expected) throw new BillingHttpError(400, "economic_assistance_program_status_confirmation_invalid");
  return {
    clientRequestId: clientRequestId(input.clientRequestId),
    programId: uuidField(input.programId, "economic_assistance_program_id_invalid"),
    targetStatus, confirmation: expected, reason: privateReason(input.reason)
  };
}

export function parseOperatorAssistanceGrant(value: unknown): OperatorAssistanceGrantRequest {
  const input = record(value);
  exactKeys(input, [
    "clientRequestId", "programCode", "beneficiaryUserId", "resourceId", "units",
    "expiresAt", "sponsorshipAllocationId", "allocationConsumption", "confirmation", "reason"
  ]);
  if (typeof input.programCode !== "string" || !/^[a-z][a-z0-9_]{2,100}$/.test(input.programCode)) {
    throw new BillingHttpError(400, "economic_assistance_program_code_invalid");
  }
  let units: number | null = null;
  if (input.units !== null) {
    if (!Number.isSafeInteger(input.units) || Number(input.units) < 1 || Number(input.units) > 1_000_000_000) {
      throw new BillingHttpError(400, "economic_assistance_units_invalid");
    }
    units = Number(input.units);
  }
  if (input.confirmation !== "ISSUE ECONOMIC ASSISTANCE GRANT") {
    throw new BillingHttpError(400, "economic_assistance_grant_confirmation_invalid");
  }
  const sponsorshipAllocationId = nullableUuidField(
    input.sponsorshipAllocationId,
    "economic_assistance_sponsorship_allocation_invalid"
  );
  let allocationConsumption: number | null = null;
  if (input.allocationConsumption !== null) {
    if (
      !Number.isSafeInteger(input.allocationConsumption)
      || Number(input.allocationConsumption) < 1
      || Number(input.allocationConsumption) > 100_000_000_000
    ) throw new BillingHttpError(400, "economic_assistance_allocation_consumption_invalid");
    allocationConsumption = Number(input.allocationConsumption);
  }
  if ((sponsorshipAllocationId === null) !== (allocationConsumption === null)) {
    throw new BillingHttpError(400, "economic_assistance_sponsorship_allocation_invalid");
  }
  return {
    clientRequestId: clientRequestId(input.clientRequestId), programCode: input.programCode,
    beneficiaryUserId: uuidField(input.beneficiaryUserId, "economic_assistance_beneficiary_invalid"),
    resourceId: nullableUuidField(input.resourceId, "economic_assistance_resource_invalid"),
    units, expiresAt: operatorExpiration(input.expiresAt),
    sponsorshipAllocationId, allocationConsumption,
    confirmation: "ISSUE ECONOMIC ASSISTANCE GRANT", reason: privateReason(input.reason)
  };
}

export function parseOperatorAssistanceEnd(value: unknown): OperatorAssistanceEndRequest {
  const input = record(value);
  exactKeys(input, ["clientRequestId", "grantId", "action", "confirmation", "reason"]);
  if (input.action !== "revoke" && input.action !== "expire") {
    throw new BillingHttpError(400, "economic_assistance_end_action_invalid");
  }
  if (input.confirmation !== "END ECONOMIC ASSISTANCE GRANT") {
    throw new BillingHttpError(400, "economic_assistance_end_confirmation_invalid");
  }
  return {
    clientRequestId: clientRequestId(input.clientRequestId),
    grantId: uuidField(input.grantId, "economic_assistance_grant_id_invalid"),
    action: input.action,
    confirmation: "END ECONOMIC ASSISTANCE GRANT",
    reason: privateReason(input.reason)
  };
}

export function parseOperatorJobPostAssistanceReconciliation(value: unknown): OperatorJobPostAssistanceReconciliationRequest {
  const input = record(value);
  exactKeys(input, ["clientRequestId", "jobPostId", "grantId", "endAction", "confirmation", "reason"]);
  if (input.endAction !== "revoke" && input.endAction !== "expire") {
    throw new BillingHttpError(400, "job_post_assistance_reconciliation_action_invalid");
  }
  if (input.confirmation !== "RECONCILE AND END TEST JOB POST ASSISTANCE") {
    throw new BillingHttpError(400, "job_post_assistance_reconciliation_confirmation_invalid");
  }
  return {
    clientRequestId: clientRequestId(input.clientRequestId),
    jobPostId: uuidField(input.jobPostId, "job_post_id_invalid"),
    grantId: uuidField(input.grantId, "economic_assistance_grant_id_invalid"),
    endAction: input.endAction,
    confirmation: "RECONCILE AND END TEST JOB POST ASSISTANCE",
    reason: privateReason(input.reason)
  };
}

export function parseSupportRecognitionPreference(value: unknown): SupportRecognitionPreferenceRequest {
  const input = record(value);
  exactKeys(input, ["clientRequestId", "optedIn", "consentVersion", "confirmation"]);
  if (typeof input.optedIn !== "boolean") throw new BillingHttpError(400, "support_recognition_preference_invalid");
  const expected = input.optedIn ? "PUBLISH SUPPORT RECOGNITION" : "REMOVE SUPPORT RECOGNITION";
  if (input.confirmation !== expected) throw new BillingHttpError(400, "support_recognition_confirmation_invalid");
  return {
    clientRequestId: clientRequestId(input.clientRequestId),
    optedIn: input.optedIn,
    consentVersion: consentVersion(input.consentVersion),
    confirmation: expected
  };
}

export function parseEconomicAccountAction(value: unknown): EconomicAccountActionRequest {
  const input = record(value);
  exactKeys(input, [
    "clientRequestId", "requestType", "consentVersion", "userNote",
    "acknowledgeFinancialRecordsRetained", "acknowledgeAuthProfileUnchanged", "confirmation"
  ]);
  if (input.requestType !== "data_export" && input.requestType !== "economic_account_closure") {
    throw new BillingHttpError(400, "economic_account_request_type_invalid");
  }
  if (typeof input.userNote !== "string") throw new BillingHttpError(400, "economic_account_user_note_invalid");
  const userNote = input.userNote.trim();
  if (userNote.length > 1_000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(userNote)) {
    throw new BillingHttpError(400, "economic_account_user_note_invalid");
  }
  if (input.acknowledgeFinancialRecordsRetained !== true || input.acknowledgeAuthProfileUnchanged !== true) {
    throw new BillingHttpError(400, "economic_account_retention_acknowledgment_required");
  }
  const expected = input.requestType === "data_export"
    ? "REQUEST ECONOMIC DATA EXPORT"
    : "REQUEST ECONOMIC ACCOUNT CLOSURE";
  if (input.confirmation !== expected) throw new BillingHttpError(400, "economic_account_confirmation_invalid");
  return {
    clientRequestId: clientRequestId(input.clientRequestId),
    requestType: input.requestType,
    consentVersion: consentVersion(input.consentVersion),
    userNote,
    acknowledgeFinancialRecordsRetained: true,
    acknowledgeAuthProfileUnchanged: true,
    confirmation: expected
  };
}

export function parseOperatorEconomicAccountAction(value: unknown): OperatorEconomicAccountActionRequest {
  const input = record(value);
  exactKeys(input, [
    "requestId", "status", "clientRequestId", "artifactSha256",
    "artifactExpiresAt", "confirmation", "reason"
  ]);
  if (![
    "identity_verification", "operator_review", "processing", "completed", "rejected"
  ].includes(String(input.status))) throw new BillingHttpError(400, "economic_account_request_status_invalid");
  let artifactSha256: string | null = null;
  if (input.artifactSha256 !== null) {
    if (typeof input.artifactSha256 !== "string" || !/^[0-9a-f]{64}$/.test(input.artifactSha256)) {
      throw new BillingHttpError(400, "economic_account_artifact_hash_invalid");
    }
    artifactSha256 = input.artifactSha256;
  }
  const artifactExpiresAt = operatorExpiration(input.artifactExpiresAt);
  if ((artifactSha256 === null) !== (artifactExpiresAt === null)) {
    throw new BillingHttpError(400, "economic_account_artifact_invalid");
  }
  if (input.confirmation !== "UPDATE ECONOMIC ACCOUNT REQUEST") {
    throw new BillingHttpError(400, "economic_account_operator_confirmation_invalid");
  }
  return {
    requestId: uuidField(input.requestId, "economic_account_request_id_invalid"),
    status: input.status as OperatorEconomicAccountActionRequest["status"],
    clientRequestId: clientRequestId(input.clientRequestId),
    artifactSha256,
    artifactExpiresAt,
    confirmation: "UPDATE ECONOMIC ACCOUNT REQUEST",
    reason: privateReason(input.reason)
  };
}

export function parseOperatorEconomicServiceRestriction(value: unknown): OperatorEconomicServiceRestrictionRequest {
  const input = record(value);
  exactKeys(input, [
    "clientRequestId", "targetUserId", "restrictionId", "scope", "reasonCode",
    "expiresAt", "enabled", "confirmation", "reason"
  ]);
  if (typeof input.scope !== "string" || !ECONOMIC_SERVICE_RESTRICTION_SCOPES.has(input.scope as EconomicServiceRestrictionScope)) {
    throw new BillingHttpError(400, "economic_service_restriction_scope_invalid");
  }
  if (typeof input.reasonCode !== "string" || !/^[a-z][a-z0-9_]{2,100}$/.test(input.reasonCode)) {
    throw new BillingHttpError(400, "economic_service_restriction_reason_code_invalid");
  }
  if (typeof input.enabled !== "boolean") throw new BillingHttpError(400, "economic_service_restriction_enabled_invalid");
  const restrictionId = nullableUuidField(input.restrictionId, "economic_service_restriction_id_invalid");
  if (input.enabled === (restrictionId !== null)) throw new BillingHttpError(400, "economic_service_restriction_id_invalid");
  const expiresAt = operatorExpiration(input.expiresAt);
  if (!input.enabled && expiresAt !== null) throw new BillingHttpError(400, "economic_service_restriction_expiration_invalid");
  const expected = input.enabled
    ? "IMPOSE SCOPED ECONOMIC RESTRICTION"
    : "LIFT SCOPED ECONOMIC RESTRICTION";
  if (input.confirmation !== expected) throw new BillingHttpError(400, "economic_service_restriction_confirmation_invalid");
  return {
    clientRequestId: clientRequestId(input.clientRequestId),
    targetUserId: uuidField(input.targetUserId, "economic_service_restriction_user_invalid"),
    restrictionId,
    scope: input.scope as EconomicServiceRestrictionScope,
    reasonCode: input.reasonCode,
    expiresAt,
    enabled: input.enabled,
    confirmation: expected,
    reason: privateReason(input.reason)
  };
}

export function parseOperatorAccountingExport(value: unknown): OperatorAccountingExportRequest {
  const input = record(value);
  exactKeys(input, ["clientRequestId", "from", "to", "afterCreatedAt", "afterId", "limit", "confirmation"]);
  const from = economicTimestamp(input.from, "economic_accounting_from_invalid");
  const to = economicTimestamp(input.to, "economic_accounting_to_invalid");
  if (Date.parse(to) <= Date.parse(from) || Date.parse(to) - Date.parse(from) > 31 * 24 * 60 * 60 * 1_000) {
    throw new BillingHttpError(400, "economic_accounting_range_invalid");
  }
  const afterCreatedAt = input.afterCreatedAt === null
    ? null
    : economicTimestamp(input.afterCreatedAt, "economic_accounting_cursor_invalid");
  const afterId = nullableUuidField(input.afterId, "economic_accounting_cursor_invalid");
  if ((afterCreatedAt === null) !== (afterId === null)) throw new BillingHttpError(400, "economic_accounting_cursor_invalid");
  if (!Number.isSafeInteger(input.limit) || Number(input.limit) < 1 || Number(input.limit) > 100) {
    throw new BillingHttpError(400, "economic_accounting_limit_invalid");
  }
  if (input.confirmation !== "EXPORT PRIVATE ECONOMIC ACCOUNTING") {
    throw new BillingHttpError(400, "economic_accounting_confirmation_invalid");
  }
  return {
    clientRequestId: clientRequestId(input.clientRequestId), from, to, afterCreatedAt, afterId,
    limit: Number(input.limit), confirmation: "EXPORT PRIVATE ECONOMIC ACCOUNTING"
  };
}

export function parseOperatorMarketplacePayoutPreparation(value: unknown): OperatorMarketplacePayoutPreparationRequest {
  const input = record(value);
  exactKeys(input, ["sellerAccountId", "clientRequestId", "amountMinor", "currency", "confirmation", "reason"]);
  if (!Number.isSafeInteger(input.amountMinor) || Number(input.amountMinor) < 1 || Number(input.amountMinor) > 100_000_000_000) {
    throw new BillingHttpError(400, "marketplace_payout_preparation_amount_invalid");
  }
  if (input.currency !== "usd") throw new BillingHttpError(400, "marketplace_payout_preparation_currency_invalid");
  if (input.confirmation !== "PREPARE TEST MARKETPLACE PAYOUT") {
    throw new BillingHttpError(400, "marketplace_payout_preparation_confirmation_invalid");
  }
  return {
    sellerAccountId: uuidField(input.sellerAccountId, "marketplace_seller_account_id_invalid"),
    clientRequestId: clientRequestId(input.clientRequestId),
    amountMinor: Number(input.amountMinor),
    currency: "usd",
    confirmation: "PREPARE TEST MARKETPLACE PAYOUT",
    reason: privateReason(input.reason)
  };
}

export function parseOperatorSandboxCreditGrant(value: unknown): OperatorSandboxCreditGrantRequest {
  const input = record(value);
  exactKeys(input, ["userId", "units", "sourceType", "sourceReference", "expiresAt", "idempotencyKey", "confirmation", "reason"]);
  if (!Number.isSafeInteger(input.units) || Number(input.units) < 1 || Number(input.units) > 1_000_000_000) {
    throw new BillingHttpError(400, "operator_units_invalid");
  }
  if (typeof input.sourceType !== "string" || !OPERATOR_SANDBOX_SOURCE_TYPES.has(input.sourceType as OperatorSandboxCreditGrantRequest["sourceType"])) {
    throw new BillingHttpError(400, "operator_source_type_invalid");
  }
  if (input.confirmation !== "GRANT TEST SANDBOX SERVICE UNITS") {
    throw new BillingHttpError(400, "operator_sandbox_confirmation_invalid");
  }
  let sourceReference: string | null = null;
  if (input.sourceReference !== null) {
    if (
      typeof input.sourceReference !== "string"
      || input.sourceReference.length > 160
      || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(input.sourceReference)
    ) throw new BillingHttpError(400, "operator_source_reference_invalid");
    sourceReference = input.sourceReference;
  }
  return {
    userId: uuidField(input.userId, "operator_user_id_invalid"),
    units: Number(input.units),
    sourceType: input.sourceType as OperatorSandboxCreditGrantRequest["sourceType"],
    sourceReference,
    expiresAt: operatorExpiration(input.expiresAt),
    idempotencyKey: uuidField(input.idempotencyKey, "operator_idempotency_key_invalid"),
    confirmation: "GRANT TEST SANDBOX SERVICE UNITS",
    reason: privateReason(input.reason)
  };
}

export function parseOperatorRefundHold(value: unknown): OperatorRefundHoldRequest {
  const input = record(value);
  exactKeys(input, ["orderId", "paymentTransactionId", "amountMinor", "clientRequestId", "confirmation", "reason"]);
  if (!Number.isSafeInteger(input.amountMinor) || Number(input.amountMinor) < 1 || Number(input.amountMinor) > 1_000_000_000) {
    throw new BillingHttpError(400, "operator_refund_amount_invalid");
  }
  if (input.confirmation !== "PLACE TEST REFUND HOLD") {
    throw new BillingHttpError(400, "operator_refund_hold_confirmation_invalid");
  }
  return {
    orderId: uuidField(input.orderId, "operator_order_id_invalid"),
    paymentTransactionId: uuidField(input.paymentTransactionId, "operator_payment_transaction_id_invalid"),
    amountMinor: Number(input.amountMinor),
    clientRequestId: clientRequestId(input.clientRequestId),
    confirmation: "PLACE TEST REFUND HOLD",
    reason: privateReason(input.reason)
  };
}

export function parseOperatorTestRefundExecution(value: unknown): OperatorTestRefundExecutionRequest {
  const input = record(value);
  exactKeys(input, ["refundRequestId", "approvalClientRequestId", "providerAttachClientRequestId", "confirmation", "reason"]);
  if (input.confirmation !== "AUTHORIZE TEST REFUND") {
    throw new BillingHttpError(400, "operator_refund_confirmation_invalid");
  }
  return {
    refundRequestId: uuidField(input.refundRequestId, "operator_refund_request_id_invalid"),
    approvalClientRequestId: clientRequestId(input.approvalClientRequestId),
    providerAttachClientRequestId: clientRequestId(input.providerAttachClientRequestId),
    confirmation: "AUTHORIZE TEST REFUND",
    reason: privateReason(input.reason)
  };
}

export function parseOperatorReconciliation(value: unknown): OperatorReconciliationRequest {
  const input = record(value);
  exactKeys(input, ["orderId", "clientRequestId", "confirmation", "reason"]);
  if (input.confirmation !== "OPEN ECONOMIC RECONCILIATION CASE") {
    throw new BillingHttpError(400, "operator_reconciliation_confirmation_invalid");
  }
  return {
    orderId: uuidField(input.orderId, "operator_order_id_invalid"),
    clientRequestId: clientRequestId(input.clientRequestId),
    confirmation: "OPEN ECONOMIC RECONCILIATION CASE",
    reason: privateReason(input.reason)
  };
}

export function parseOperatorAssignment(value: unknown): OperatorAssignmentRequest {
  const input = record(value);
  exactKeys(input, ["userId", "capability", "enabled", "confirmation", "reason"]);
  if (typeof input.capability !== "string" || !ECONOMIC_OPERATOR_CAPABILITIES.has(input.capability as EconomicOperatorCapability)) {
    throw new BillingHttpError(400, "operator_capability_invalid");
  }
  if (typeof input.enabled !== "boolean") throw new BillingHttpError(400, "operator_assignment_enabled_invalid");
  const requiredConfirmation = input.enabled ? "grant-economic-capability" : "revoke-economic-capability";
  if (input.confirmation !== requiredConfirmation) throw new BillingHttpError(400, "operator_assignment_confirmation_invalid");
  return {
    userId: uuidField(input.userId, "operator_user_id_invalid"),
    capability: input.capability as EconomicOperatorCapability,
    enabled: input.enabled,
    confirmation: requiredConfirmation,
    reason: privateReason(input.reason)
  };
}

export function parseOperatorJobPostFeeAssessment(value: unknown): OperatorJobPostFeeAssessmentRequest {
  const input = record(value);
  exactKeys(input, ["jobPostId", "classification", "priceCode", "waiverId", "subsidyId", "clientRequestId", "confirmation", "reason"]);
  if (typeof input.classification !== "string" || !JOB_POST_CLASSIFICATIONS.has(input.classification as OperatorJobPostFeeAssessmentRequest["classification"])) {
    throw new BillingHttpError(400, "job_post_classification_invalid");
  }
  const classification = input.classification as OperatorJobPostFeeAssessmentRequest["classification"];
  let priceCode: string | null = null;
  if (input.priceCode !== null) {
    if (typeof input.priceCode !== "string" || input.priceCode.length > 100 || !JOB_POST_PRICE_CODE_PATTERN.test(input.priceCode)) {
      throw new BillingHttpError(400, "job_post_price_code_invalid");
    }
    priceCode = input.priceCode;
  }
  const waiverId = nullableUuidField(input.waiverId, "job_post_waiver_id_invalid");
  const subsidyId = nullableUuidField(input.subsidyId, "job_post_subsidy_id_invalid");
  if (
    (classification === "commercial") !== (priceCode !== null)
    || (classification === "waived") !== (waiverId !== null)
    || (classification === "subsidized") !== (subsidyId !== null)
  ) throw new BillingHttpError(400, "job_post_assessment_references_invalid");
  if (input.confirmation !== "ASSESS JOB POST ECONOMIC CONDITION") {
    throw new BillingHttpError(400, "job_post_assessment_confirmation_invalid");
  }
  return {
    jobPostId: uuidField(input.jobPostId, "job_post_id_invalid"),
    classification,
    priceCode,
    waiverId,
    subsidyId,
    clientRequestId: clientRequestId(input.clientRequestId),
    confirmation: "ASSESS JOB POST ECONOMIC CONDITION",
    reason: privateReason(input.reason)
  };
}

export function parseJobPostCheckout(value: unknown): JobPostCheckoutRequest {
  const input = record(value);
  exactKeys(input, ["jobPostId", "clientRequestId", "sourceRoute", "consentVersion"]);
  if (typeof input.sourceRoute !== "string" || !JOB_POST_SOURCE_ROUTES.has(input.sourceRoute as JobPostCheckoutRequest["sourceRoute"])) {
    throw new BillingHttpError(400, "source_route_invalid");
  }
  return {
    jobPostId: uuidField(input.jobPostId, "job_post_id_invalid"),
    clientRequestId: clientRequestId(input.clientRequestId),
    sourceRoute: input.sourceRoute as JobPostCheckoutRequest["sourceRoute"],
    consentVersion: consentVersion(input.consentVersion)
  };
}

export function parseSandboxCreditCheckout(value: unknown): SandboxCreditCheckoutRequest {
  const input = record(value);
  exactKeys(input, ["clientRequestId", "packCode", "sourceRoute", "consentVersion"]);
  if (typeof input.packCode !== "string" || input.packCode.length > 93 || !SANDBOX_PACK_CODE_PATTERN.test(input.packCode)) {
    throw new BillingHttpError(400, "sandbox_pack_code_invalid");
  }
  if (typeof input.sourceRoute !== "string" || !SANDBOX_CREDIT_SOURCE_ROUTES.has(input.sourceRoute as SandboxCreditCheckoutRequest["sourceRoute"])) {
    throw new BillingHttpError(400, "source_route_invalid");
  }
  return {
    clientRequestId: clientRequestId(input.clientRequestId),
    packCode: input.packCode,
    sourceRoute: input.sourceRoute as SandboxCreditCheckoutRequest["sourceRoute"],
    consentVersion: consentVersion(input.consentVersion)
  };
}

export async function oneTimeCheckoutRequest(request: Request): Promise<OneTimeCheckoutRequest> {
  return parseOneTimeCheckout(await parseBoundedJsonRequest(request));
}

export async function recurringCheckoutRequest(request: Request): Promise<RecurringCheckoutRequest> {
  return parseRecurringCheckout(await parseBoundedJsonRequest(request));
}

export async function portalRequest(request: Request): Promise<PortalRequest> {
  return parsePortalRequest(await parseBoundedJsonRequest(request));
}

export async function sellerOnboardingRequest(request: Request): Promise<SellerOnboardingRequest> {
  return parseSellerOnboardingRequest(await parseBoundedJsonRequest(request));
}

export async function marketplaceFreeSellerAgreementRequest(request: Request): Promise<MarketplaceFreeSellerAgreementRequest> {
  return parseMarketplaceFreeSellerAgreement(await parseBoundedJsonRequest(request));
}

export async function marketplacePurchaseRequest(request: Request): Promise<MarketplacePurchaseRequest> {
  return parseMarketplacePurchase(await parseBoundedJsonRequest(request));
}

export async function marketplaceOfferConfigurationRequest(request: Request): Promise<MarketplaceOfferConfigurationRequest> {
  return parseMarketplaceOfferConfiguration(await parseBoundedJsonRequest(request));
}

export async function marketplaceOfferStatusRequest(request: Request): Promise<MarketplaceOfferStatusRequest> {
  return parseMarketplaceOfferStatus(await parseBoundedJsonRequest(request));
}

export async function marketplacePublisherLinkRequest(request: Request): Promise<MarketplacePublisherLinkRequest> {
  return parseMarketplacePublisherLink(await parseBoundedJsonRequest(request));
}

export async function marketplaceCommercialTermsRequest(request: Request): Promise<MarketplaceCommercialTermsRequest> {
  return parseMarketplaceCommercialTerms(await parseBoundedJsonRequest(request));
}

export async function operatorEconomicOrganizationRequest(request: Request): Promise<OperatorEconomicOrganizationRequest> {
  return parseOperatorEconomicOrganization(await parseBoundedJsonRequest(request));
}

export async function operatorEconomicOrganizationMembershipRequest(request: Request): Promise<OperatorEconomicOrganizationMembershipRequest> {
  return parseOperatorEconomicOrganizationMembership(await parseBoundedJsonRequest(request));
}

export async function operatorOrganizationServiceEngagementRequest(request: Request): Promise<OperatorOrganizationServiceEngagementRequest> {
  return parseOperatorOrganizationServiceEngagement(await parseBoundedJsonRequest(request));
}

export async function operatorOrganizationServiceReviewRequest(request: Request): Promise<OperatorOrganizationServiceReviewRequest> {
  return parseOperatorOrganizationServiceReview(await parseBoundedJsonRequest(request));
}

export async function operatorSponsorshipAgreementRequest(request: Request): Promise<OperatorSponsorshipAgreementRequest> {
  return parseOperatorSponsorshipAgreement(await parseBoundedJsonRequest(request));
}

export async function operatorSponsorshipReviewRequest(request: Request): Promise<OperatorSponsorshipReviewRequest> {
  return parseOperatorSponsorshipReview(await parseBoundedJsonRequest(request));
}

export async function operatorSponsorshipRecognitionRequest(request: Request): Promise<OperatorSponsorshipRecognitionRequest> {
  return parseOperatorSponsorshipRecognition(await parseBoundedJsonRequest(request));
}

export async function sponsorshipRecognitionPreferenceRequest(request: Request): Promise<SponsorshipRecognitionPreferenceRequest> {
  return parseSponsorshipRecognitionPreference(await parseBoundedJsonRequest(request));
}

export async function organizationServiceCheckoutRequest(request: Request): Promise<OrganizationServiceCheckoutRequest> {
  return parseOrganizationServiceCheckout(await parseBoundedJsonRequest(request));
}

export async function sponsorshipCheckoutRequest(request: Request): Promise<SponsorshipCheckoutRequest> {
  return parseSponsorshipCheckout(await parseBoundedJsonRequest(request));
}

export async function operatorSponsorshipAssistanceAllocationRequest(request: Request): Promise<OperatorSponsorshipAssistanceAllocationRequest> {
  return parseOperatorSponsorshipAssistanceAllocation(await parseBoundedJsonRequest(request));
}

export async function operatorSponsorshipAssistanceAllocationCloseRequest(request: Request): Promise<OperatorSponsorshipAssistanceAllocationCloseRequest> {
  return parseOperatorSponsorshipAssistanceAllocationClose(await parseBoundedJsonRequest(request));
}

export async function operatorAssistanceProgramRequest(request: Request): Promise<OperatorAssistanceProgramRequest> {
  return parseOperatorAssistanceProgram(await parseBoundedJsonRequest(request));
}

export async function operatorAssistanceProgramStatusRequest(request: Request): Promise<OperatorAssistanceProgramStatusRequest> {
  return parseOperatorAssistanceProgramStatus(await parseBoundedJsonRequest(request));
}

export async function operatorAssistanceGrantRequest(request: Request): Promise<OperatorAssistanceGrantRequest> {
  return parseOperatorAssistanceGrant(await parseBoundedJsonRequest(request));
}

export async function operatorAssistanceEndRequest(request: Request): Promise<OperatorAssistanceEndRequest> {
  return parseOperatorAssistanceEnd(await parseBoundedJsonRequest(request));
}

export async function operatorJobPostAssistanceReconciliationRequest(request: Request): Promise<OperatorJobPostAssistanceReconciliationRequest> {
  return parseOperatorJobPostAssistanceReconciliation(await parseBoundedJsonRequest(request));
}

export async function supportRecognitionPreferenceRequest(request: Request): Promise<SupportRecognitionPreferenceRequest> {
  return parseSupportRecognitionPreference(await parseBoundedJsonRequest(request));
}

export async function economicAccountActionRequest(request: Request): Promise<EconomicAccountActionRequest> {
  return parseEconomicAccountAction(await parseBoundedJsonRequest(request));
}

export async function operatorEconomicAccountActionRequest(request: Request): Promise<OperatorEconomicAccountActionRequest> {
  return parseOperatorEconomicAccountAction(await parseBoundedJsonRequest(request));
}

export async function operatorEconomicServiceRestrictionRequest(request: Request): Promise<OperatorEconomicServiceRestrictionRequest> {
  return parseOperatorEconomicServiceRestriction(await parseBoundedJsonRequest(request));
}

export async function operatorAccountingExportRequest(request: Request): Promise<OperatorAccountingExportRequest> {
  return parseOperatorAccountingExport(await parseBoundedJsonRequest(request));
}

export async function operatorMarketplacePayoutPreparationRequest(request: Request): Promise<OperatorMarketplacePayoutPreparationRequest> {
  return parseOperatorMarketplacePayoutPreparation(await parseBoundedJsonRequest(request));
}

export async function operatorSandboxCreditGrantRequest(request: Request): Promise<OperatorSandboxCreditGrantRequest> {
  return parseOperatorSandboxCreditGrant(await parseBoundedJsonRequest(request));
}

export async function operatorRefundHoldRequest(request: Request): Promise<OperatorRefundHoldRequest> {
  return parseOperatorRefundHold(await parseBoundedJsonRequest(request));
}

export async function operatorTestRefundExecutionRequest(request: Request): Promise<OperatorTestRefundExecutionRequest> {
  return parseOperatorTestRefundExecution(await parseBoundedJsonRequest(request));
}

export async function operatorReconciliationRequest(request: Request): Promise<OperatorReconciliationRequest> {
  return parseOperatorReconciliation(await parseBoundedJsonRequest(request));
}

export async function operatorAssignmentRequest(request: Request): Promise<OperatorAssignmentRequest> {
  return parseOperatorAssignment(await parseBoundedJsonRequest(request));
}

export async function operatorJobPostFeeAssessmentRequest(request: Request): Promise<OperatorJobPostFeeAssessmentRequest> {
  return parseOperatorJobPostFeeAssessment(await parseBoundedJsonRequest(request));
}

export async function jobPostCheckoutRequest(request: Request): Promise<JobPostCheckoutRequest> {
  return parseJobPostCheckout(await parseBoundedJsonRequest(request));
}

export async function sandboxCreditCheckoutRequest(request: Request): Promise<SandboxCreditCheckoutRequest> {
  return parseSandboxCreditCheckout(await parseBoundedJsonRequest(request));
}

export function orderPublicReference(request: Request): string {
  const url = new URL(request.url);
  if ([...url.searchParams.keys()].some((key) => key !== "reference")) throw new BillingHttpError(400, "request_schema_invalid");
  const reference = url.searchParams.get("reference");
  if (!reference || !PUBLIC_REFERENCE_PATTERN.test(reference)) throw new BillingHttpError(400, "order_reference_invalid");
  return reference;
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
