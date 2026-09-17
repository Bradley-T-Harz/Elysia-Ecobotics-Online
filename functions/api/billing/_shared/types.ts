import type { SupabaseClient } from "@supabase/supabase-js";

export interface BillingEnv {
  BILLING_MUTATION_RATE_LIMITER?: { limit(input: { key: string }): Promise<{ success: boolean }> };
  BILLING_ENABLED?: string;
  BILLING_MODE?: string;
  BILLING_PUBLIC_ORIGIN?: string;
  BILLING_SUPPORT_CHECKOUT_ENABLED?: string;
  BILLING_RECURRING_ENABLED?: string;
  BILLING_WEBHOOK_FULFILLMENT_ENABLED?: string;
  BILLING_NOTIFICATION_RETRY_ENABLED?: string;
  BILLING_PORTAL_ENABLED?: string;
  BILLING_SELLER_ONBOARDING_ENABLED?: string;
  BILLING_JOB_POST_FEES_ENABLED?: string;
  BILLING_SANDBOX_PURCHASES_ENABLED?: string;
  BILLING_MARKETPLACE_COMMERCE_ENABLED?: string;
  BILLING_MARKETPLACE_PAYOUT_PREPARATION_ENABLED?: string;
  BILLING_ORGANIZATION_SERVICES_ENABLED?: string;
  BILLING_SPONSORSHIP_ADMIN_ENABLED?: string;
  BILLING_SPONSORSHIP_CHECKOUT_ENABLED?: string;
  BILLING_SPONSORSHIP_RECOGNITION_ENABLED?: string;
  BILLING_ASSISTANCE_ADMIN_ENABLED?: string;
  BILLING_SUPPORT_RECOGNITION_ENABLED?: string;
  BILLING_ACCOUNT_LIFECYCLE_ENABLED?: string;
  BILLING_ACCOUNTING_EXPORT_ENABLED?: string;
  BILLING_TEST_REFUNDS_ENABLED?: string;
  BILLING_STAGING_ACCESS_CONFIRMED?: string;
  BILLING_EDGE_RATE_LIMIT_CONFIRMED?: string;
  STRIPE_CONNECT_ENABLED?: string;
  STRIPE_LIVE_ENABLED?: string;
  STRIPE_SECRET_KEY_TEST?: string;
  STRIPE_WEBHOOK_SECRET_TEST?: string;
  STRIPE_SECRET_KEY_LIVE?: string;
  STRIPE_WEBHOOK_SECRET_LIVE?: string;
  STRIPE_ACCOUNT_ID?: string;
  STRIPE_PORTAL_CONFIGURATION_ID?: string;
  STRIPE_PAYMENT_METHOD_CONFIGURATION_ID?: string;
  BILLING_FIRST_PARTY_PREFLIGHT_CONFIRMED?: string;
  STRIPE_API_VERSION?: string;
  STRIPE_WEBHOOK_API_VERSION?: string;
  STRIPE_WEBHOOK_TOLERANCE_SECONDS?: string;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export type AuthenticatedBillingRequest = {
  accessToken: string;
  userId: string;
  email: string | null;
  supabase: SupabaseClient;
};

export type CheckoutFlow =
  | "support_one_time"
  | "support_recurring"
  | "sandbox_credits"
  | "job_post_fee"
  | "marketplace_purchase"
  | "organization_service"
  | "sponsorship";

export type OneTimeCheckoutRequest = {
  clientRequestId: string;
  amountMinor: number;
  currency: "usd";
  sourceRoute: BillingSourceRoute;
  consentVersion: string;
};

export type RecurringCheckoutRequest = {
  clientRequestId: string;
  priceCode: RecurringSupportPriceCode;
  sourceRoute: BillingSourceRoute;
  consentVersion: string;
};

export type PortalRequest = {
  clientRequestId: string;
};

export type SellerOnboardingRequest = {
  clientRequestId: string;
  sellerAgreementVersion: string;
  stripeConnectDisclosureVersion: string;
  sourceRoute: "/marketplace/account" | "/developer-forge/dashboard";
  acceptSellerAgreement: true;
  acceptStripeConnectDisclosure: true;
};

export type MarketplaceFreeSellerAgreementRequest = {
  clientRequestId: string;
  agreementVersion: string;
  sourceRoute: "/marketplace/account";
  acceptAgreement: true;
  confirmation: "ACCEPT FREE MARKETPLACE SELLER AGREEMENT";
};

export type MarketplacePurchaseRequest = {
  offerId: string;
  clientRequestId: string;
  sourceRoute: "/marketplace" | "/marketplace/browse" | "/marketplace/account";
  consentVersion: string;
};

export type MarketplaceOfferConfigurationRequest = {
  clientRequestId: string;
  addonVersionId: string;
  publisherId: string | null;
  offerKind: "free" | "paid";
  amountMinor: number | null;
  licenseKey: string;
  licenseVersion: string;
  buyerTermsVersion: string;
  commercialTermsCode: string | null;
  sellerAgreementVersion: string;
  confirmation: "CONFIGURE MARKETPLACE TEST OFFER";
  reason: string;
};

export type MarketplaceOfferStatus = "active" | "suspended" | "retired";

export type MarketplaceOfferStatusRequest = {
  clientRequestId: string;
  offerId: string;
  targetStatus: MarketplaceOfferStatus;
  confirmation:
    | "ACTIVATE MARKETPLACE TEST OFFER"
    | "SUSPEND MARKETPLACE TEST OFFER"
    | "RETIRE MARKETPLACE TEST OFFER";
  reason: string;
};

export type MarketplacePublisherLinkRequest = {
  publisherId: string;
  clientRequestId: string;
  confirmation: "LINK MARKETPLACE SELLER TO PUBLISHER";
  reason: string;
};

export type MarketplaceCommercialTermsRequest = {
  clientRequestId: string;
  termsCode: string;
  commissionBps: number;
  sellerAgreementVersion: string;
  buyerTermsVersion: string;
  active: boolean;
  confirmation: "CONFIGURE MARKETPLACE TEST COMMERCIAL TERMS";
  reason: string;
};

export type OperatorEconomicOrganizationRequest = {
  clientRequestId: string;
  accountName: string;
  countryCode: string | null;
  initialContactUserId: string;
  confirmation: "CREATE ECONOMIC ORGANIZATION";
  reason: string;
};

export type EconomicOrganizationRelationship =
  | "owner"
  | "billing_admin"
  | "technical_contact"
  | "procurement_contact"
  | "billing_contact"
  | "authorized_signer"
  | "service_participant";

export type OperatorEconomicOrganizationMembershipRequest = {
  clientRequestId: string;
  organizationId: string;
  targetUserId: string;
  relationship: EconomicOrganizationRelationship;
  enabled: boolean;
  confirmation: "SET ECONOMIC ORGANIZATION MEMBERSHIP";
  reason: string;
};

export type OperatorOrganizationServiceEngagementRequest = {
  clientRequestId: string;
  organizationId: string;
  authorizedSignerUserId: string;
  serviceCode: string;
  priceCode: string;
  statementOfWorkVersion: string;
  serviceTermsVersion: string;
  dataHandlingDisclosureVersion: string;
  confidentialityClass: "internal" | "confidential" | "restricted";
  proposalReference: string | null;
  contractReference: string | null;
  invoiceReference: string | null;
  startsAt: string;
  endsAt: string | null;
  confirmation: "CREATE TEST ORGANIZATION SERVICE ENGAGEMENT";
  reason: string;
};

export type OrganizationServiceReviewAction =
  | "activate"
  | "complete"
  | "cancel"
  | "reconciliation_required"
  | "resolve_resume"
  | "resolve_complete"
  | "resolve_cancel";

export type OperatorOrganizationServiceReviewRequest = {
  engagementId: string;
  clientRequestId: string;
  action: OrganizationServiceReviewAction;
  confirmation:
    | "ACTIVATE TEST ORGANIZATION SERVICE"
    | "COMPLETE TEST ORGANIZATION SERVICE"
    | "CANCEL TEST ORGANIZATION SERVICE"
    | "MARK TEST ORGANIZATION RECONCILIATION REQUIRED"
    | "RESOLVE TEST ORGANIZATION RECONCILIATION AS ACTIVE"
    | "RESOLVE TEST ORGANIZATION RECONCILIATION AS COMPLETED"
    | "RESOLVE TEST ORGANIZATION RECONCILIATION AS CANCELED";
  reason: string;
};

export type OperatorSponsorshipAgreementRequest = {
  clientRequestId: string;
  organizationId: string;
  authorizedSignerUserId: string;
  purposeCode: string;
  priceCode: string;
  agreementVersion: string;
  disclosureVersion: string;
  publicLabel: string | null;
  publicSummary: string | null;
  confirmation: "CREATE TEST SPONSORSHIP AGREEMENT WITHOUT CONTROL";
  reason: string;
};

export type SponsorshipReviewAction =
  | "approve"
  | "activate"
  | "reject"
  | "complete"
  | "cancel"
  | "resolve_resume"
  | "resolve_complete"
  | "resolve_cancel";

export type OperatorSponsorshipReviewRequest = {
  sponsorshipAgreementId: string;
  clientRequestId: string;
  action: SponsorshipReviewAction;
  confirmation:
    | "APPROVE TEST SPONSORSHIP WITHOUT CONTROL"
    | "ACTIVATE PAID TEST SPONSORSHIP WITHOUT CONTROL"
    | "REJECT TEST SPONSORSHIP"
    | "COMPLETE TEST SPONSORSHIP"
    | "CANCEL TEST SPONSORSHIP"
    | "RESOLVE TEST SPONSORSHIP RECONCILIATION AS ACTIVE"
    | "RESOLVE TEST SPONSORSHIP RECONCILIATION AS COMPLETED"
    | "RESOLVE TEST SPONSORSHIP RECONCILIATION AS CANCELED";
  reason: string;
};

export type OperatorSponsorshipRecognitionRequest = {
  sponsorshipAgreementId: string;
  clientRequestId: string;
  approved: boolean;
  confirmation:
    | "APPROVE NEUTRAL SPONSORSHIP RECOGNITION"
    | "REVOKE NEUTRAL SPONSORSHIP RECOGNITION";
  reason: string;
};

export type SponsorshipRecognitionPreferenceRequest = {
  sponsorshipAgreementId: string;
  clientRequestId: string;
  optedIn: boolean;
  sourceRoute: "/commons-circle/support-billing";
  agreementVersion: string;
  disclosureVersion: string;
  confirmation:
    | "PUBLISH NEUTRAL SPONSORSHIP RECOGNITION"
    | "REMOVE NEUTRAL SPONSORSHIP RECOGNITION";
};

export type OrganizationServiceCheckoutRequest = {
  engagementId: string;
  clientRequestId: string;
  sourceRoute: "/commons-circle/support-billing";
  legalBundleVersion: string;
  statementOfWorkVersion: string;
  serviceTermsVersion: string;
  dataHandlingDisclosureVersion: string;
};

export type SponsorshipCheckoutRequest = {
  sponsorshipAgreementId: string;
  clientRequestId: string;
  sourceRoute: "/commons-circle/support-billing";
  legalBundleVersion: string;
  agreementVersion: string;
  disclosureVersion: string;
};

export type OperatorSponsorshipAssistanceAllocationRequest = {
  clientRequestId: string;
  sponsorshipAgreementId: string;
  assistanceProgramId: string;
  allocationKind: "funding_minor" | "sandbox_credit_units" | "grant_count";
  allocationCap: number;
  currency: "usd" | null;
  confirmation: "CREATE SPONSORSHIP ASSISTANCE ALLOCATION";
  reason: string;
};

export type OperatorSponsorshipAssistanceAllocationCloseRequest = {
  clientRequestId: string;
  allocationId: string;
  confirmation: "CLOSE SPONSORSHIP ASSISTANCE ALLOCATION";
  reason: string;
};

export type OperatorAssistanceProgramRequest = {
  clientRequestId: string;
  programCode: string;
  assistanceKind: "waiver" | "subsidy" | "sponsored_access";
  scope: "job_post_fee" | "sandbox_credits";
  publicLabel: string;
  termsVersion: string;
  startsAt: string;
  endsAt: string | null;
  maxGrants: number | null;
  activate: boolean;
  confirmation: "CONFIGURE ECONOMIC ASSISTANCE PROGRAM";
  reason: string;
};

export type OperatorAssistanceProgramStatusRequest = {
  clientRequestId: string;
  programId: string;
  targetStatus: "active" | "paused" | "retired";
  confirmation:
    | "ACTIVATE TEST ECONOMIC ASSISTANCE PROGRAM"
    | "PAUSE TEST ECONOMIC ASSISTANCE PROGRAM"
    | "RETIRE TEST ECONOMIC ASSISTANCE PROGRAM";
  reason: string;
};

export type OperatorAssistanceGrantRequest = {
  clientRequestId: string;
  programCode: string;
  beneficiaryUserId: string;
  resourceId: string | null;
  units: number | null;
  expiresAt: string | null;
  sponsorshipAllocationId: string | null;
  allocationConsumption: number | null;
  confirmation: "ISSUE ECONOMIC ASSISTANCE GRANT";
  reason: string;
};

export type OperatorAssistanceEndRequest = {
  clientRequestId: string;
  grantId: string;
  action: "revoke" | "expire";
  confirmation: "END ECONOMIC ASSISTANCE GRANT";
  reason: string;
};

export type OperatorJobPostAssistanceReconciliationRequest = {
  clientRequestId: string;
  jobPostId: string;
  grantId: string;
  endAction: "revoke" | "expire";
  confirmation: "RECONCILE AND END TEST JOB POST ASSISTANCE";
  reason: string;
};

export type SupportRecognitionPreferenceRequest = {
  clientRequestId: string;
  optedIn: boolean;
  consentVersion: string;
  confirmation: "PUBLISH SUPPORT RECOGNITION" | "REMOVE SUPPORT RECOGNITION";
};

export type EconomicAccountActionRequest = {
  clientRequestId: string;
  requestType: "data_export" | "economic_account_closure";
  consentVersion: string;
  userNote: string;
  acknowledgeFinancialRecordsRetained: true;
  acknowledgeAuthProfileUnchanged: true;
  confirmation: "REQUEST ECONOMIC DATA EXPORT" | "REQUEST ECONOMIC ACCOUNT CLOSURE";
};

export type OperatorEconomicAccountActionRequest = {
  requestId: string;
  status: "identity_verification" | "operator_review" | "processing" | "completed" | "rejected";
  clientRequestId: string;
  artifactSha256: string | null;
  artifactExpiresAt: string | null;
  confirmation: "UPDATE ECONOMIC ACCOUNT REQUEST";
  reason: string;
};

export type EconomicServiceRestrictionScope =
  | "billing"
  | "recurring_support"
  | "sandbox"
  | "marketplace_buying"
  | "marketplace_selling"
  | "job_posting";

export type OperatorEconomicServiceRestrictionRequest = {
  clientRequestId: string;
  targetUserId: string;
  restrictionId: string | null;
  scope: EconomicServiceRestrictionScope;
  reasonCode: string;
  expiresAt: string | null;
  enabled: boolean;
  confirmation: "IMPOSE SCOPED ECONOMIC RESTRICTION" | "LIFT SCOPED ECONOMIC RESTRICTION";
  reason: string;
};

export type OperatorAccountingExportRequest = {
  clientRequestId: string;
  from: string;
  to: string;
  afterCreatedAt: string | null;
  afterId: string | null;
  limit: number;
  confirmation: "EXPORT PRIVATE ECONOMIC ACCOUNTING";
};

export type OperatorMarketplacePayoutPreparationRequest = {
  sellerAccountId: string;
  clientRequestId: string;
  amountMinor: number;
  currency: "usd";
  confirmation: "PREPARE TEST MARKETPLACE PAYOUT";
  reason: string;
};

export type OperatorSandboxCreditGrantRequest = {
  userId: string;
  units: number;
  sourceType: "starter" | "sponsored" | "waiver" | "waived" | "operational" | "operator" | "test";
  sourceReference: string | null;
  expiresAt: string | null;
  idempotencyKey: string;
  confirmation: "GRANT TEST SANDBOX SERVICE UNITS";
  reason: string;
};

export type OperatorRefundHoldRequest = {
  orderId: string;
  paymentTransactionId: string;
  amountMinor: number;
  clientRequestId: string;
  confirmation: "PLACE TEST REFUND HOLD";
  reason: string;
};

export type OperatorTestRefundExecutionRequest = {
  refundRequestId: string;
  approvalClientRequestId: string;
  providerAttachClientRequestId: string;
  confirmation: "AUTHORIZE TEST REFUND";
  reason: string;
};

export type OperatorReconciliationRequest = {
  orderId: string;
  clientRequestId: string;
  confirmation: "OPEN ECONOMIC RECONCILIATION CASE";
  reason: string;
};

export type EconomicOperatorCapability =
  | "economic_orders_view"
  | "economic_payments_view"
  | "economic_operator_assignments_manage"
  | "economic_feature_flags_manage"
  | "economic_refunds_manage"
  | "economic_reconciliation_manage"
  | "recurring_support_manage"
  | "sandbox_credits_adjust"
  | "job_fee_assess"
  | "marketplace_payout_manage"
  | "organization_billing_manage"
  | "sponsorship_manage"
  | "economic_assistance_manage"
  | "economic_account_requests_manage"
  | "economic_audit_view"
  | "accounting_export";

export type OperatorAssignmentRequest = {
  userId: string;
  capability: EconomicOperatorCapability;
  enabled: boolean;
  confirmation: "grant-economic-capability" | "revoke-economic-capability";
  reason: string;
};

export type JobPostEconomicClassification = "community_free" | "commercial" | "waived" | "subsidized";

export type OperatorJobPostFeeAssessmentRequest = {
  jobPostId: string;
  classification: JobPostEconomicClassification;
  priceCode: string | null;
  waiverId: string | null;
  subsidyId: string | null;
  clientRequestId: string;
  confirmation: "ASSESS JOB POST ECONOMIC CONDITION";
  reason: string;
};

export type JobPostCheckoutRequest = {
  jobPostId: string;
  clientRequestId: string;
  sourceRoute: "/commune/rooms/job-post" | "/commune/rooms/job-post/posts";
  consentVersion: string;
};

export type SandboxCreditCheckoutRequest = {
  clientRequestId: string;
  packCode: string;
  sourceRoute: "/commons-circle/support-billing" | "/commune/sandbox-review";
  consentVersion: string;
};

export type BillingSourceRoute = "/support" | "/products" | "/commons-circle/support-billing";

export type RecurringSupportPriceCode =
  | "support_monthly_seed_usd"
  | "support_monthly_commons_usd"
  | "support_monthly_infrastructure_usd"
  | "support_monthly_sandbox_usd"
  | "support_monthly_50_usd";

export type CheckoutPreparation = {
  checkoutExpiresAt?: string;
  orderId: string;
  publicReference: string;
  idempotencyKey: string;
  amountMinor: number;
  currency: "usd";
  providerProductReference: string | null;
  providerPriceReference: string | null;
  providerCustomerReference: string | null;
};

export type ProviderCheckoutInput = CheckoutPreparation & {
  flow: CheckoutFlow;
  accountLinked: boolean;
  successUrl: string;
  cancelUrl: string;
};

export type ProviderCheckoutResult = {
  providerSessionId: string;
  providerCustomerReference: string | null;
  checkoutUrl: string;
};

export type ProviderCustomerInput = {
  idempotencyKey: string;
};

export type ProviderCustomerResult = {
  providerCustomerReference: string;
};

export type ProviderPortalInput = {
  providerCustomerReference: string;
  idempotencyKey: string;
  returnUrl: string;
};

export type ProviderPortalResult = {
  providerSessionId: string;
  portalUrl: string;
};

export type ProviderRefundInput = {
  orderId: string;
  providerPaymentReference: string;
  amountMinor: number;
  currency: "usd";
  idempotencyKey: string;
};

export type ProviderRefundResult = {
  providerRefundReference: string;
  status: "pending" | "succeeded" | "failed" | "canceled";
  providerEventCreatedAt: string;
  providerResponseSha256: string;
};

export type NormalizedProviderEvent = {
  provider: "stripe";
  providerEventId: string;
  eventType: string;
  mutationEligible: boolean;
  eventCreatedAt: string;
  livemode: boolean;
  objectType: string | null;
  providerObjectReference: string | null;
  orderId: string | null;
  providerCustomerId: string | null;
  providerPaymentId: string | null;
  providerSubscriptionId: string | null;
  providerInvoiceId: string | null;
  providerRefundId: string | null;
  providerDisputeId: string | null;
  providerSellerAccountId: string | null;
  amountMinor: number | null;
  currency: string | null;
  status: string | null;
  paymentStatus: string | null;
  subscriptionStatus: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean | null;
  refundAmountMinor: number | null;
  refundStatus: string | null;
  disputeStatus: string | null;
  disputeReason: string | null;
  providerReceiptUrl?: string | null;
  providerBalanceTransactionId?: string | null;
  processorFeeMinor?: number | null;
  netAmountMinor?: number | null;
  payloadSha256: string;
};

export type ProviderSellerOnboardingInput = {
  sellerAccountId: string;
  onboardingRequestId: string;
  providerAccountReference: string | null;
  accountIdempotencyKey: string;
  linkIdempotencyKey: string;
  refreshUrl: string;
  returnUrl: string;
};

export type ProviderSellerOnboardingResult = {
  providerAccountReference: string;
  onboardingUrl: string;
};

export type ProviderSellerStatus = {
  providerAccountReference: string;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  currentlyDue: string[];
  eventuallyDue: string[];
  disabledReason: string | null;
  providerEventCreatedAt: string;
  providerResponseSha256: string;
};

export type ProviderMarketplaceCatalogInput = {
  offerId: string;
  addonVersionId: string;
  priceCode: string;
  amountMinor: number;
  currency: "usd";
};

export type ProviderMarketplaceCatalogResult = {
  providerProductReference: string;
  providerPriceReference: string;
};

export interface BillingProvider {
  ensureCustomer(input: ProviderCustomerInput): Promise<ProviderCustomerResult>;
  createCheckout(input: ProviderCheckoutInput): Promise<ProviderCheckoutResult>;
  createCustomerPortalSession(input: ProviderPortalInput): Promise<ProviderPortalResult>;
  createRefund(input: ProviderRefundInput): Promise<ProviderRefundResult>;
  verifyAndNormalizeWebhook(rawBody: string, signature: string): Promise<NormalizedProviderEvent>;
  enrichVerifiedEvent?(event: NormalizedProviderEvent): Promise<NormalizedProviderEvent>;
  createSellerOnboarding(input: ProviderSellerOnboardingInput): Promise<ProviderSellerOnboardingResult>;
  retrieveSellerStatus(providerAccountReference: string): Promise<ProviderSellerStatus>;
  ensureMarketplaceCatalog(input: ProviderMarketplaceCatalogInput): Promise<ProviderMarketplaceCatalogResult>;
}

export type ProviderFactory = (env: BillingEnv) => BillingProvider;
