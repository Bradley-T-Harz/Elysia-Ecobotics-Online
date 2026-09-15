import {
  billingLegalConsentBundleIntegrityExpectations,
  billingLegalDocumentIntegrityExpectations
} from "../../pages/Legal/firstPartyLegalManifest.js";

export type BillingMode = "disabled" | "test" | "live";
export type SupportCadence = "one_time" | "monthly";
export type BillingSourceRoute = "/support" | "/products" | "/commons-circle/support-billing";
export type RecurringSupportPriceCode =
  | "support_monthly_seed_usd"
  | "support_monthly_commons_usd"
  | "support_monthly_infrastructure_usd"
  | "support_monthly_sandbox_usd"
  | "support_monthly_50_usd";
export type BillingOrderStatus = "processing" | "verified" | "canceled" | "failed" | "refunded" | "disputed" | "unavailable" | "unknown";
export type BillingOrderFlow =
  | "support_one_time"
  | "support_recurring"
  | "sandbox_credits"
  | "job_post_fee"
  | "marketplace_purchase"
  | "organization_service"
  | "sponsorship";
export const economicOperatorCapabilityKeys = [
  "economic_orders_view",
  "economic_payments_view",
  "economic_operator_assignments_manage",
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
  "economic_feature_flags_manage",
  "economic_audit_view",
  "accounting_export"
] as const;
export type EconomicOperatorCapability = (typeof economicOperatorCapabilityKeys)[number];
export type OperatorSandboxCreditSource = "starter" | "sponsored" | "waiver" | "waived" | "operational" | "operator" | "test";

export type BillingLegalDocumentVersions = {
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

export type BillingLegalReference = { version: string; path: string; contentSha256: string };
export type BillingLegalConsentBundleKey =
  | "support_one_time_checkout_bundle"
  | "support_recurring_checkout_bundle"
  | "sandbox_credits_checkout_bundle"
  | "job_post_fee_checkout_bundle"
  | "marketplace_purchase_checkout_bundle"
  | "marketplace_free_license_bundle"
  | "organization_service_checkout_bundle"
  | "sponsorship_checkout_bundle";
export type BillingLegalConsentBundle = {
  version: string;
  path: string;
  documents: Record<string, BillingLegalReference>;
};
export type BillingLegalConsentBundles = Record<BillingLegalConsentBundleKey, BillingLegalConsentBundle>;

export type BillingCapabilities = {
  jobPostCheckout?: boolean;
  available: boolean;
  mode: BillingMode;
  supportCheckout: boolean;
  recurringSupport: boolean;
  accountBilling: boolean;
  customerPortal: boolean;
  cancellation: boolean;
  accountLifecycle: boolean;
  sellerOnboarding: boolean;
  organizationServiceCheckout: boolean;
  sponsorshipCheckout: boolean;
  sellerPayouts: boolean;
  livePayments: boolean;
  legalDocumentVersions: BillingLegalDocumentVersions | null;
  legalConsentBundles: BillingLegalConsentBundles | null;
  message: string;
};

export type SandboxCreditPack = {
  packCode: string;
  amountMinor: number;
  currency: "usd";
  grantedUnits: number;
  expiresAfterDays: number | null;
  disclosureVersion: string;
  testMode: boolean;
};

export type SandboxCreditCatalog = {
  available: boolean;
  packs: SandboxCreditPack[];
  testMode: boolean;
};

export type SandboxCreditCheckoutInput = {
  clientRequestId: string;
  packCode: string;
  sourceRoute: "/commons-circle/support-billing" | "/commune/sandbox-review";
  consentVersion: string;
};

export type SandboxCreditCheckoutResult = {
  checkoutUrl: string;
  orderReference: string;
  pack: { code: string; grantedUnits: number; expiresAfterDays: number | null; changesSafetyPrivileges: false; testMode: boolean };
};

export type MarketplaceCommercialOffer = {
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

export type MarketplaceCommerceCatalog = { available: boolean; offers: MarketplaceCommercialOffer[]; testMode: boolean };
export type MarketplacePurchaseInput = {
  offerId: string;
  clientRequestId: string;
  sourceRoute: "/marketplace" | "/marketplace/browse" | "/marketplace/account";
  consentVersion: string;
};
export type MarketplaceCheckoutResult =
  | { alreadyOwned: true; economicStatus: string; installAuthorized: false; paymentGrantsAuthority: false; testMode: boolean }
  | { alreadyOwned: false; checkoutUrl: string; orderReference: string; licenseKey: string; licenseVersion: string; installAuthorized: false; paymentGrantsAuthority: false; testMode: boolean };
export type MarketplaceFreeLicenseResult = {
  licenseKey: string;
  licenseVersion: string;
  economicStatus: string;
  installAuthorized: false;
  paymentRequired: false;
  paymentGrantsAuthority: false;
  testMode: boolean;
};
export type JobPostEconomicClassification = "not_assessed" | "community_free" | "commercial" | "waived" | "subsidized";
export type JobPostEconomicStatus = "not_assessed" | "not_required" | "payment_required" | "payment_pending" | "satisfied" | "waived" | "subsidized" | "refunded" | "disputed" | "reconciliation_required";
export type JobPostOwnerEconomicStatus = {
  jobPostId: string;
  classification: JobPostEconomicClassification;
  economicStatus: JobPostEconomicStatus;
  contentApproved: boolean;
  publicationStatus: string;
  published: boolean;
  amountMinor: number | null;
  currency: "usd" | null;
  termsVersion: string | null;
  testMode: boolean;
};
export type JobPostCheckoutInput = {
  jobPostId: string;
  clientRequestId: string;
  sourceRoute: "/commune/rooms/job-post" | "/commune/rooms/job-post/posts";
  consentVersion: string;
};
export type JobPostCheckoutResult = { checkoutUrl: string; orderReference: string; jobPostId: string; postId: string };
export type MarketplaceOwnedLicense = {
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
export type MarketplacePurchases = { licenses: MarketplaceOwnedLicense[]; testMode: boolean };
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

export type MarketplaceSellerStatus = {
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
export type MarketplaceSellerOnboardingInput = {
  clientRequestId: string;
  sellerAgreementVersion: string;
  stripeConnectDisclosureVersion: string;
  sourceRoute: "/marketplace/account" | "/developer-forge/dashboard";
  acceptSellerAgreement: true;
  acceptStripeConnectDisclosure: true;
};
export type MarketplaceSellerOnboardingResult = {
  onboardingUrl: string;
  provider: "stripe";
  consentRecorded: true;
  paymentGrantsAuthority: false;
  testMode: boolean;
};
export type MarketplaceFreeSellerAgreementInput = {
  clientRequestId: string;
  agreementVersion: string;
  sourceRoute: "/marketplace/account";
  acceptAgreement: true;
  confirmation: "ACCEPT FREE MARKETPLACE SELLER AGREEMENT";
};
export type MarketplaceFreeSellerAgreementResult = {
  sellerAccountId: string;
  agreementVersion: string;
  connectRequiredForFreeOffers: false;
  testMode: boolean;
  idempotentReplay: boolean;
};
export type MarketplacePublisherLinkInput = {
  publisherId: string;
  clientRequestId: string;
  confirmation: "LINK MARKETPLACE SELLER TO PUBLISHER";
  reason: string;
};
export type MarketplacePublisherLinkResult = {
  publisherId: string;
  linked: true;
  publisherVerifiedChanged: false;
  testMode: boolean;
  idempotentReplay: boolean;
};
export type MarketplaceSellerOfferInput = {
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
export type MarketplaceSellerOfferResult = {
  offerId: string;
  addonVersionId: string;
  offerKind: "free" | "paid";
  status: string;
  commissionBps: number;
  commercialTermsCode: string | null;
  buyerTermsVersion: string;
  providerCatalogConfigured: boolean;
  paymentGrantsTrust: false;
  purchaseInstallsAddon: false;
  testMode: boolean;
  idempotentReplay: boolean;
};
export type MarketplaceSellerOfferTargetStatus = "active" | "suspended" | "retired";
export const marketplaceSellerOfferStatusConfirmations = {
  active: "ACTIVATE MARKETPLACE TEST OFFER",
  suspended: "SUSPEND MARKETPLACE TEST OFFER",
  retired: "RETIRE MARKETPLACE TEST OFFER"
} as const;
export type MarketplaceSellerOfferStatusInput = { clientRequestId: string; offerId: string; targetStatus: MarketplaceSellerOfferTargetStatus; confirmation: (typeof marketplaceSellerOfferStatusConfirmations)[MarketplaceSellerOfferTargetStatus]; reason: string };
export type MarketplaceSellerOfferStatusResult = { offerId: string; status: MarketplaceSellerOfferTargetStatus; offerKind: "free" | "paid"; paymentGrantsTrust: false; purchaseInstallsAddon: false; testMode: boolean; idempotentReplay: boolean };
export type EconomicOrganizationRelationship = "owner" | "billing_admin" | "technical_contact" | "procurement_contact" | "billing_contact" | "authorized_signer" | "service_participant";
export type EconomicOrganizationEngagement = {
  engagementId: string;
  serviceCode: string;
  status: "contract_pending" | "active" | "completed" | "canceled" | "reconciliation_required";
  statementOfWorkVersion: string;
  serviceTermsVersion: string;
  dataHandlingDisclosureVersion: string;
  amountMinor: number;
  currency: string;
  checkoutAvailable: boolean;
};
export type EconomicSponsorshipAgreement = {
  agreementId: string;
  status: "ethical_review" | "contract_pending" | "active" | "rejected" | "completed" | "canceled" | "reconciliation_required";
  agreementVersion: string;
  disclosureVersion: string;
  amountMinor: number;
  currency: string;
  publicRecognitionOptIn: boolean;
  publicRecognitionApproved: boolean;
  checkoutAvailable: boolean;
  recognitionPreferenceAvailable: boolean;
};
export type EconomicOrganizationStatus = {
  organizationId: string;
  accountName: string;
  status: "pending" | "active" | "restricted" | "closed";
  relationships: EconomicOrganizationRelationship[];
  engagements: EconomicOrganizationEngagement[];
  sponsorshipAgreements: EconomicSponsorshipAgreement[];
};
export type EconomicOrganizationAccount = { organizations: EconomicOrganizationStatus[]; financialDetailsPrivate: true; affectsCommonsIdentity: false; testMode: boolean };
export type OrganizationServiceCheckoutInput = { engagementId: string; clientRequestId: string; sourceRoute: "/commons-circle/support-billing"; legalBundleVersion: string; statementOfWorkVersion: string; serviceTermsVersion: string; dataHandlingDisclosureVersion: string };
export type OrganizationServiceCheckoutResult = { checkoutUrl: string; orderReference: string; engagementId: string; paymentGrantsAuthority: false; testMode: boolean };
export type SponsorshipCheckoutInput = { sponsorshipAgreementId: string; clientRequestId: string; sourceRoute: "/commons-circle/support-billing"; legalBundleVersion: string; agreementVersion: string; disclosureVersion: string };
export type SponsorshipCheckoutResult = { checkoutUrl: string; orderReference: string; sponsorshipAgreementId: string; paymentGrantsAuthority: false; testMode: boolean };
export type SponsorshipRecognitionPreferenceInput = { sponsorshipAgreementId: string; clientRequestId: string; optedIn: boolean; sourceRoute: "/commons-circle/support-billing"; agreementVersion: string; disclosureVersion: string; confirmation: "PUBLISH NEUTRAL SPONSORSHIP RECOGNITION" | "REMOVE NEUTRAL SPONSORSHIP RECOGNITION" };
export type SponsorshipRecognitionPreferenceResult = { sponsorshipAgreementId: string; publicRecognitionOptIn: boolean; amountsPublic: false; grantsAuthority: false; testMode: boolean; idempotentReplay: boolean };
export type PublicSponsorshipRecognition = { label: string; summary: string | null; purposeCode: string; grantsAuthority: false; isEndorsement: false };
export type SponsorshipRecognitionCatalog = { enabled: boolean; recognitions: PublicSponsorshipRecognition[]; paymentGrantsAuthority: false };
export type PublicSupportRecognition = { username: string; displayName: string; grantsAuthority: false; amountPublic: false };
export type SupportRecognitionCatalog = { enabled: boolean; supporters: PublicSupportRecognition[]; ranked: false; amountsPublic: false; paymentGrantsAuthority: false };

export type CheckoutRequest = {
  clientRequestId: string;
  amountCents: number;
  cadence: SupportCadence;
  sourceRoute: BillingSourceRoute;
  consentVersion: string;
  priceCode?: RecurringSupportPriceCode;
};

export type CheckoutResult = {
  ok: boolean;
  checkoutUrl: string | null;
  reference: string | null;
  message: string;
};

export type BillingOrderSummary = {
  flow: BillingOrderFlow | null;
  status: BillingOrderStatus;
  cadence: SupportCadence | null;
  createdAt: string | null;
  verifiedAt: string | null;
  message: string;
};

export type SupportHistoryItem = {
  id: string;
  status: string;
  amountCents: number | null;
  currency: string;
  cadence: SupportCadence | null;
  createdAt: string | null;
};

export type ReceiptSummary = {
  receiptUrl?: string | null;
  testMode?: boolean;
  flow: BillingOrderFlow;
  status: string;
  payee: string | null;
  cadence: SupportCadence;
  orderStatus: string | null;
  refundedAmountCents: number | null;
  id: string;
  publicReference: string;
  label: string;
  amountCents: number | null;
  currency: string;
  createdAt: string | null;
  receiptAvailable: boolean;
};

export type SubscriptionSummary = {
  status: string;
  label: string;
  amountCents: number | null;
  currency: string;
  nextRenewalAt: string | null;
  cancelAtPeriodEnd: boolean;
};

export type SandboxCreditSummary = {
  displayEnabled: boolean;
  availableCredits: number | null;
  purchasedCredits: number | null;
  sponsoredCredits: number | null;
  waivedCredits: number | null;
};

export type MarketplacePurchaseSummary = {
  id: string;
  label: string;
  status: string;
  purchasedAt: string | null;
};

export type JobPostPaymentSummary = {
  id: string;
  label: string;
  status: string;
  updatedAt: string | null;
};

export type SellerFinanceSummary = {
  eligible: boolean;
  onboardingAvailable: boolean;
  status: string;
  payoutsEnabled: boolean;
  payableByCurrency: Record<string, number>;
  payoutPreparationEnabled: boolean;
  payoutExecutionAvailable: false;
  balancesAreTestRecords: true;
  summaryAvailable: boolean;
};

export type EconomicAccountRequestType = "data_export" | "economic_account_closure";
export type EconomicAccountRequestStatus = "submitted" | "identity_verification" | "operator_review" | "processing" | "completed" | "rejected" | "canceled";
export type EconomicAccountRequestSummary = {
  requestId: string;
  requestType: EconomicAccountRequestType;
  status: EconomicAccountRequestStatus;
  submittedAt: string;
  providerCancellationRequired: boolean;
  financialRecordsRetained: true;
  authProfileUnchanged: true;
};

export type EconomicSupportRecognitionSummary = {
  optedIn: boolean;
  eligible: boolean;
  eligibilityRevokedAt: string | null;
  eligibilityExpiresAt: string | null;
  publicDisplayEnabled: boolean;
  amountsPublic: false;
  grantsAuthority: false;
};

export type EconomicAssistanceSummary = {
  scope: string;
  status: string;
  expiresAt: string | null;
  publiclyVisible: false;
};

export type EconomicServiceRestrictionSummary = {
  scope: string;
  reasonCode: string;
  expiresAt: string | null;
};

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
  guidance: [string, string, string];
};

export type SupportRecognitionPreferenceInput = {
  clientRequestId: string;
  optedIn: boolean;
  consentVersion: string;
  confirmation: "PUBLISH SUPPORT RECOGNITION" | "REMOVE SUPPORT RECOGNITION";
};

export type SupportRecognitionPreferenceResult = {
  optedIn: boolean;
  eligible: boolean;
  eligibilityExpiresAt: string | null;
  publicDisplayEnabled: boolean;
  amountsPublic: false;
  grantsAuthority: false;
  idempotentReplay: boolean;
};

export type EconomicAccountActionInput = {
  clientRequestId: string;
  requestType: EconomicAccountRequestType;
  consentVersion: string;
  userNote: string;
  acknowledgeFinancialRecordsRetained: true;
  acknowledgeAuthProfileUnchanged: true;
  confirmation: "REQUEST ECONOMIC DATA EXPORT" | "REQUEST ECONOMIC ACCOUNT CLOSURE";
};

export type EconomicAccountActionResult = {
  requestId: string;
  requestType: EconomicAccountRequestType;
  status: EconomicAccountRequestStatus;
  providerCancellationRequired: boolean;
  closureReadiness: EconomicClosureReadiness | null;
  financialRecordsRetained: true;
  authProfileUnchanged: true;
  idempotentReplay: boolean;
};

export type EconomicOperatorSummary = {
  authorized: boolean;
  capabilities: string[];
};

export type BillingAccountProjectionCoverage = {
  receipts: boolean;
  sandbox: boolean;
  marketplacePurchases: boolean;
  jobPostPayments: boolean;
  seller: boolean;
};

export type EconomicOperatorOrderQueueItem = { orderId: string; publicReference: string; flow: string; status: string; amountMinor: number; currency: string; createdAt: string };
export type EconomicOperatorPaymentQueueItem = { paymentTransactionId: string; orderId: string; publicReference: string; flow: string; status: "pending" | "succeeded" | "failed" | "canceled" | "refunded" | "disputed"; grossAmountMinor: number; processorFeeMinor: number | null; netAmountMinor: number | null; currency: string; occurredAt: string };
export type EconomicOperatorRefundablePaymentQueueItem = { paymentTransactionId: string; orderId: string; publicReference: string; flow: string; status: "succeeded" | "refunded" | "disputed"; grossAmountMinor: number; refundableAmountMinor: number; currency: string; occurredAt: string };
export type EconomicOperatorRefundQueueItem = { requestId: string; orderId: string; paymentTransactionId: string; status: string; amountMinor: number; currency: string; createdAt: string };
export type EconomicOperatorSubscriptionQueueItem = { subscriptionId: string; userId: string; originatingOrderId: string | null; status: "incomplete" | "active" | "past_due" | "grace_period" | "canceling"; cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null; updatedAt: string };
export type EconomicOperatorDisputeQueueItem = { disputeId: string; orderId: string; paymentTransactionId: string; status: "warning_needs_response" | "warning_under_review" | "needs_response" | "under_review" | "lost"; reasonCode: string | null; amountMinor: number; currency: string; createdAt: string; updatedAt: string };
export type EconomicOperatorWebhookQueueItem = { eventId: string; eventType: string; processingStatus: "received" | "failed" | "unmatched"; processingAttempts: number; eventCreatedAt: string; receivedAt: string };
export type EconomicOperatorReconciliationQueueItem = {
  caseId: string;
  orderId: string;
  caseKind: "economic_reconciliation_case" | "marketplace_fulfillment_hold" | "job_post_payment_hold" | "organization_service_settlement_hold" | "sponsorship_settlement_hold";
  status: string;
  openedAt: string;
};
export type EconomicOperatorSandboxCorrectionQueueItem = { shortfallId: string; fulfillmentId: string; fulfillmentScope: "sandbox_credit_order" | "recurring_support_payment"; orderId: string; paymentTransactionId: string | null; adjustmentKind: "refund_or_lost_dispute" | "active_dispute_hold"; targetUnits: number; appliedUnits: number; missingUnits: number; status: "open" | "reviewed"; createdAt: string };
export type EconomicOperatorJobPostQueueItem = { conditionId: string; jobPostId: string; authorUserId: string; classification: "not_assessed" | "community_free" | "commercial" | "waived" | "subsidized"; status: "not_assessed" | "payment_required" | "payment_pending" | "refunded" | "disputed" | "reconciliation_required"; orderId: string | null; termsVersion: string | null; updatedAt: string };
export type EconomicOperatorSellerPayableQueueItem = { sellerAccountId: string; currency: string; availablePayableMinor: number; sellerStatus: string };
export type EconomicOperatorSellerPayoutPreparationQueueItem = { payoutPreparationId: string; sellerAccountId: string; amountMinor: number; currency: string; status: "prepared" | "transfer_pending"; createdAt: string };
export type EconomicOperatorOrganizationServiceQueueItem = { engagementId: string; organizationId: string; serviceCode: string; status: "contract_pending" | "active" | "reconciliation_required"; entitlementState: "pending" | "active" | "fulfilled" | "suspended" | "ended"; supportAgreementState: "pending" | "active" | "suspended" | "expired" | "terminated" | "not_applicable"; orderId: string | null; updatedAt: string };
export type EconomicOperatorSponsorshipQueueItem = { sponsorshipAgreementId: string; organizationId: string; status: "ethical_review" | "contract_pending" | "active" | "reconciliation_required"; purposeCode: string; publicRecognitionOptIn: boolean; publicRecognitionApproved: boolean; orderId: string | null; updatedAt: string };
export type EconomicOperatorAccountRequestQueueItem = { requestId: string; requestType: Exclude<EconomicAccountRequestType, never>; status: Exclude<EconomicAccountRequestStatus, "completed" | "rejected" | "canceled">; submittedAt: string; providerCancellationRequired: boolean };
export type EconomicOperatorAssistanceProgramQueueItem = { programId: string; programCode: string; kind: "waiver" | "subsidy" | "sponsored_access"; scope: "job_post_fee" | "sandbox_credits"; status: "draft" | "active" | "paused" | "retired"; startsAt: string; endsAt: string | null; updatedAt: string };
export type EconomicOperatorAssistanceQueueItem = { grantId: string; scope: "job_post_fee" | "sandbox_credits"; status: "granted" | "consumed" | "revoked" | "expired"; expiresAt: string | null };
export type EconomicOperatorFeatureFlagItem = { featureKey: string; enabled: boolean; testModeOnly: boolean; updatedAt: string };

export type EconomicOperatorOverview = {
  authorized: boolean;
  capabilities: EconomicOperatorCapability[];
  queueLimit: 10;
  orderQueue: EconomicOperatorOrderQueueItem[] | null;
  paymentQueue: EconomicOperatorPaymentQueueItem[] | null;
  refundablePaymentQueue: EconomicOperatorRefundablePaymentQueueItem[] | null;
  refundQueue: EconomicOperatorRefundQueueItem[] | null;
  subscriptionQueue: EconomicOperatorSubscriptionQueueItem[] | null;
  disputeQueue: EconomicOperatorDisputeQueueItem[] | null;
  webhookQueue: EconomicOperatorWebhookQueueItem[] | null;
  reconciliationQueue: EconomicOperatorReconciliationQueueItem[] | null;
  sandboxCorrectionQueue: EconomicOperatorSandboxCorrectionQueueItem[] | null;
  jobPostEconomicQueue: EconomicOperatorJobPostQueueItem[] | null;
  sellerPayableQueue: EconomicOperatorSellerPayableQueueItem[] | null;
  sellerPayoutPreparationQueue: EconomicOperatorSellerPayoutPreparationQueueItem[] | null;
  organizationServiceQueue: EconomicOperatorOrganizationServiceQueueItem[] | null;
  sponsorshipQueue: EconomicOperatorSponsorshipQueueItem[] | null;
  accountRequestQueue: EconomicOperatorAccountRequestQueueItem[] | null;
  assistanceProgramQueue: EconomicOperatorAssistanceProgramQueueItem[] | null;
  assistanceQueue: EconomicOperatorAssistanceQueueItem[] | null;
  featureFlags: EconomicOperatorFeatureFlagItem[] | null;
  providerIdentifiersExposed: false;
  personalContactDataExposed: false;
  testMode: boolean;
};
export type EconomicAuditActorKind = "system" | "user" | "economic_operator" | "provider_webhook";
export type EconomicAuditEvent = { eventId: string; action: string; targetType: string; targetId: string | null; actorKind: EconomicAuditActorKind; createdAt: string };
export type EconomicAuditCursor = { afterCreatedAt: string; afterId: string };
export type EconomicAuditPage = { events: EconomicAuditEvent[]; limit: number; nextCursor: EconomicAuditCursor | null; providerIdentifiersExposed: false; personalContactDataExposed: false; testMode: boolean };
export type OperatorAccountingExportInput = { clientRequestId: string; from: string; to: string; afterCreatedAt: string | null; afterId: string | null; limit: number; confirmation: "EXPORT PRIVATE ECONOMIC ACCOUNTING" };
export type EconomicAccountingExportEntry = { exportVersion: "economic-accounting-v1"; eventId: string; effectiveAt: string; recordedAt: string; category: string; economicFlow: "support_one_time" | "support_recurring" | "sandbox_credits" | "job_post_fee" | "marketplace_purchase" | "organization_service" | "sponsorship"; direction: "inflow" | "outflow" | "memo"; grossMinor: number | null; refundMinor: number | null; disputeMinor: number | null; processorFeeMinor: number | null; platformCommissionMinor: number | null; sellerPayableMinor: number | null; netMinor: number | null; currency: string; internalOrderReference: string; provider: string; providerEventDate: string; jurisdiction: string | null; taxTreatmentPendingReview: true; reconciliationStatus: "recorded" | "settlement_details_pending" | "review" };
export type OperatorAccountingExportResult = { exportVersion: "economic-accounting-v1"; entries: EconomicAccountingExportEntry[]; limit: number; from: string; to: string; providerIdentifiersExposed: false; personalContactDataExposed: false; testMode: boolean; idempotentReplay: boolean };

export type OperatorAssignmentInput = { userId: string; capability: EconomicOperatorCapability; enabled: boolean; confirmation: "grant-economic-capability" | "revoke-economic-capability"; reason: string };
export type OperatorAssignmentResult = { assignmentId: string | null; userId: string; capability: EconomicOperatorCapability; active: boolean; idempotentReplay: boolean };
export type OperatorSandboxCreditGrantInput = { userId: string; units: number; sourceType: OperatorSandboxCreditSource; sourceReference: string | null; expiresAt: string | null; idempotencyKey: string; reason: string };
export type OperatorSandboxCreditGrantResult = { creditLotId: string; grantedUnits: number; sourceCategory: OperatorSandboxCreditSource; expiresAt: string | null; idempotentReplay: boolean; testMode: boolean };
export type OperatorRefundHoldInput = { orderId: string; paymentTransactionId: string; amountMinor: number; clientRequestId: string; reason: string };
export type OperatorRefundHoldResult = { refundRequestId: string; orderId: string; paymentTransactionId: string; amountMinor: number; currency: "usd"; status: "held_for_review" | "approved_for_provider" | "provider_pending" | "completed" | "rejected" | "canceled"; idempotentReplay: boolean };
export type OperatorTestRefundExecutionInput = { refundRequestId: string; approvalClientRequestId: string; providerAttachClientRequestId: string; confirmation: "AUTHORIZE TEST REFUND"; reason: string };
export type OperatorTestRefundExecutionResult = { refundRequestId: string; orderId: string; amountMinor: number; currency: "usd"; status: "provider_pending" | "completed" | "rejected" | "canceled"; providerStatus: "pending" | "succeeded" | "failed" | "canceled"; idempotentReplay: boolean; testMode: boolean };
export type OperatorReconciliationInput = { orderId: string; clientRequestId: string; reason: string };
export type OperatorReconciliationResult = { reconciliationCaseId: string; orderId: string; status: "open" | "investigating" | "waiting_for_provider" | "resolved" | "closed_no_change"; idempotentReplay: boolean };
export type OperatorJobPostClassification = "community_free" | "commercial" | "waived" | "subsidized";
export type OperatorJobPostFeeAssessmentInput = { jobPostId: string; classification: OperatorJobPostClassification; priceCode: string | null; waiverId: string | null; subsidyId: string | null; clientRequestId: string; confirmation: "ASSESS JOB POST ECONOMIC CONDITION"; reason: string };
export type OperatorJobPostFeeAssessmentResult = { jobPostId: string; classification: OperatorJobPostClassification; economicStatus: string; publicationStatus: string | null; published: boolean; idempotentReplay: boolean };
export type OperatorMarketplaceCommercialTermsInput = { clientRequestId: string; termsCode: string; commissionBps: number; sellerAgreementVersion: string; buyerTermsVersion: string; active: boolean; confirmation: "CONFIGURE MARKETPLACE TEST COMMERCIAL TERMS"; reason: string };
export type OperatorMarketplaceCommercialTermsResult = { commercialTermsVersionId: string; termsCode: string; commissionBps: number; sellerAgreementVersion: string; buyerTermsVersion: string; active: boolean; approvedForLiveUse: false; testMode: boolean };
export type OperatorEconomicAccountActionStatus = "identity_verification" | "operator_review" | "processing" | "completed" | "rejected";
export type OperatorEconomicAccountActionInput = { requestId: string; status: OperatorEconomicAccountActionStatus; clientRequestId: string; artifactSha256: string | null; artifactExpiresAt: string | null; confirmation: "UPDATE ECONOMIC ACCOUNT REQUEST"; reason: string };
export type OperatorEconomicAccountActionResult = { requestId: string; requestType: EconomicAccountRequestType; status: OperatorEconomicAccountActionStatus; financialRecordsRetained: true; authProfileUnchanged: true; idempotentReplay: boolean };
export type EconomicServiceRestrictionScope = "billing" | "recurring_support" | "sandbox" | "marketplace_buying" | "marketplace_selling" | "job_posting";
export type OperatorEconomicServiceRestrictionInput = { clientRequestId: string; targetUserId: string; restrictionId: string | null; scope: EconomicServiceRestrictionScope; reasonCode: string; expiresAt: string | null; enabled: boolean; confirmation: "IMPOSE SCOPED ECONOMIC RESTRICTION" | "LIFT SCOPED ECONOMIC RESTRICTION"; reason: string };
export type OperatorEconomicServiceRestrictionResult = { restrictionId: string; userId: string; scope: EconomicServiceRestrictionScope; active: boolean; commonsAccountAffected: false; idempotentReplay: boolean };
export type OperatorMarketplacePayoutPreparationInput = { sellerAccountId: string; clientRequestId: string; amountMinor: number; currency: "usd"; confirmation: "PREPARE TEST MARKETPLACE PAYOUT"; reason: string };
export type OperatorMarketplacePayoutPreparationResult = { payoutPreparationId: string; sellerAccountId: string; amountMinor: number; currency: "usd"; status: "prepared"; providerExecutionAvailable: false; balancesAreTestRecords: true; testMode: boolean; idempotentReplay: boolean };
export type EconomicAssistanceKind = "waiver" | "subsidy" | "sponsored_access";
export type EconomicAssistanceScope = "job_post_fee" | "sandbox_credits";
export type OperatorAssistanceProgramInput = { clientRequestId: string; programCode: string; assistanceKind: EconomicAssistanceKind; scope: EconomicAssistanceScope; publicLabel: string; termsVersion: string; startsAt: string; endsAt: string | null; maxGrants: number | null; confirmation: "CONFIGURE ECONOMIC ASSISTANCE PROGRAM"; reason: string };
export type OperatorAssistanceProgramResult = { programId: string; programCode: string; kind: EconomicAssistanceKind; scope: EconomicAssistanceScope; status: "draft"; publicLabel: string; testMode: boolean; idempotentReplay: boolean };
export type EconomicAssistanceProgramTargetStatus = "active" | "paused" | "retired";
export const operatorAssistanceProgramStatusConfirmations = {
  active: "ACTIVATE TEST ECONOMIC ASSISTANCE PROGRAM",
  paused: "PAUSE TEST ECONOMIC ASSISTANCE PROGRAM",
  retired: "RETIRE TEST ECONOMIC ASSISTANCE PROGRAM"
} as const satisfies Record<EconomicAssistanceProgramTargetStatus, string>;
export type OperatorAssistanceProgramStatusInput = { clientRequestId: string; programId: string; targetStatus: EconomicAssistanceProgramTargetStatus; confirmation: (typeof operatorAssistanceProgramStatusConfirmations)[EconomicAssistanceProgramTargetStatus]; reason: string };
export type OperatorAssistanceProgramStatusResult = { programId: string; status: EconomicAssistanceProgramTargetStatus; testMode: boolean; idempotentReplay: boolean };
export type OperatorAssistanceGrantInput = { clientRequestId: string; programCode: string; beneficiaryUserId: string; resourceId: string | null; units: number | null; expiresAt: string | null; sponsorshipAllocationId: string | null; allocationConsumption: number | null; confirmation: "ISSUE ECONOMIC ASSISTANCE GRANT"; reason: string };
export type OperatorAssistanceGrantResult = { grantId: string; scope: EconomicAssistanceScope; status: "granted" | "consumed"; expiresAt: string | null; publiclyVisible: false; sandboxCreditResult: null | { creditLotId: string; grantedUnits: number; sourceCategory: string; expiresAt: string | null }; testMode: boolean; idempotentReplay: boolean };
export type OperatorAssistanceEndInput = { clientRequestId: string; grantId: string; action: "revoke" | "expire"; confirmation: "END ECONOMIC ASSISTANCE GRANT"; reason: string };
export type OperatorAssistanceEndResult = { grantId: string; status: "revoked" | "expired"; reversedUnits: number; publiclyVisible: false; idempotentReplay: boolean };
export type OperatorJobPostAssistanceReconciliationInput = { clientRequestId: string; jobPostId: string; grantId: string; endAction: "revoke" | "expire"; confirmation: "RECONCILE AND END TEST JOB POST ASSISTANCE"; reason: string };
export type OperatorJobPostAssistanceReconciliationResult = { jobPostId: string; grantId: string; grantStatus: "revoked" | "expired"; economicStatus: "not_assessed"; publicationStatus: string | null; published: boolean; testMode: boolean; idempotentReplay: boolean };
export type OperatorOrganizationRelationship = "owner" | "billing_admin" | "technical_contact" | "procurement_contact" | "billing_contact" | "authorized_signer" | "service_participant";
export type OperatorOrganizationInput = { clientRequestId: string; accountName: string; countryCode: string | null; initialContactUserId: string; confirmation: "CREATE ECONOMIC ORGANIZATION"; reason: string };
export type OperatorOrganizationResult = { organizationId: string; accountName: string; status: "active"; testMode: boolean; idempotentReplay: boolean };
export type OperatorOrganizationMembershipInput = { clientRequestId: string; organizationId: string; targetUserId: string; relationship: OperatorOrganizationRelationship; enabled: boolean; confirmation: "SET ECONOMIC ORGANIZATION MEMBERSHIP"; reason: string };
export type OperatorOrganizationMembershipResult = { membershipId: string; organizationId: string; userId: string; relationship: OperatorOrganizationRelationship; active: boolean; testMode: boolean; idempotentReplay: boolean };
export type OperatorOrganizationServiceReviewAction = "activate" | "complete" | "cancel" | "reconciliation_required" | "resolve_resume" | "resolve_complete" | "resolve_cancel";
export const operatorOrganizationServiceReviewConfirmations = {
  activate: "ACTIVATE TEST ORGANIZATION SERVICE",
  complete: "COMPLETE TEST ORGANIZATION SERVICE",
  cancel: "CANCEL TEST ORGANIZATION SERVICE",
  reconciliation_required: "MARK TEST ORGANIZATION RECONCILIATION REQUIRED",
  resolve_resume: "RESOLVE TEST ORGANIZATION RECONCILIATION AS ACTIVE",
  resolve_complete: "RESOLVE TEST ORGANIZATION RECONCILIATION AS COMPLETED",
  resolve_cancel: "RESOLVE TEST ORGANIZATION RECONCILIATION AS CANCELED"
} as const satisfies Record<OperatorOrganizationServiceReviewAction, string>;
export type OperatorOrganizationServiceInput = { clientRequestId: string; organizationId: string; authorizedSignerUserId: string; serviceCode: string; priceCode: string; statementOfWorkVersion: string; serviceTermsVersion: string; dataHandlingDisclosureVersion: string; confidentialityClass: "internal" | "confidential" | "restricted"; proposalReference: string | null; contractReference: string | null; invoiceReference: string | null; startsAt: string; endsAt: string | null; confirmation: "CREATE TEST ORGANIZATION SERVICE ENGAGEMENT"; reason: string };
export type OperatorOrganizationServiceResult = { engagementId: string; organizationId: string; serviceCode: string; status: "contract_pending"; serviceTermsVersion: string; testMode: boolean; idempotentReplay: boolean };
export type OperatorOrganizationServiceReviewInput = { engagementId: string; clientRequestId: string; action: OperatorOrganizationServiceReviewAction; confirmation: (typeof operatorOrganizationServiceReviewConfirmations)[OperatorOrganizationServiceReviewAction]; reason: string };
export type OperatorOrganizationServiceReviewResult = { engagementId: string; action: OperatorOrganizationServiceReviewAction; status: "active" | "completed" | "canceled" | "reconciliation_required"; testMode: boolean; idempotentReplay: boolean };
export type OperatorSponsorshipReviewAction = "approve" | "activate" | "reject" | "complete" | "cancel" | "resolve_resume" | "resolve_complete" | "resolve_cancel";
export const operatorSponsorshipReviewConfirmations = {
  approve: "APPROVE TEST SPONSORSHIP WITHOUT CONTROL",
  activate: "ACTIVATE PAID TEST SPONSORSHIP WITHOUT CONTROL",
  reject: "REJECT TEST SPONSORSHIP",
  complete: "COMPLETE TEST SPONSORSHIP",
  cancel: "CANCEL TEST SPONSORSHIP",
  resolve_resume: "RESOLVE TEST SPONSORSHIP RECONCILIATION AS ACTIVE",
  resolve_complete: "RESOLVE TEST SPONSORSHIP RECONCILIATION AS COMPLETED",
  resolve_cancel: "RESOLVE TEST SPONSORSHIP RECONCILIATION AS CANCELED"
} as const satisfies Record<OperatorSponsorshipReviewAction, string>;
export type OperatorSponsorshipAgreementInput = { clientRequestId: string; organizationId: string; authorizedSignerUserId: string; purposeCode: string; priceCode: string; agreementVersion: string; disclosureVersion: string; publicLabel: string | null; publicSummary: string | null; confirmation: "CREATE TEST SPONSORSHIP AGREEMENT WITHOUT CONTROL"; reason: string };
export type OperatorSponsorshipAgreementResult = { sponsorshipAgreementId: string; organizationId: string; status: "ethical_review"; publicRecognitionOptIn: false; publicRecognitionApproved: false; grantsAuthority: false; testMode: boolean; idempotentReplay: boolean };
export type OperatorSponsorshipReviewInput = { sponsorshipAgreementId: string; clientRequestId: string; action: OperatorSponsorshipReviewAction; confirmation: (typeof operatorSponsorshipReviewConfirmations)[OperatorSponsorshipReviewAction]; reason: string };
export type OperatorSponsorshipReviewResult = { sponsorshipAgreementId: string; action: OperatorSponsorshipReviewAction; status: "contract_pending" | "active" | "rejected" | "completed" | "canceled"; grantsAuthority: false; testMode: boolean; idempotentReplay: boolean };
export type OperatorSponsorshipRecognitionInput = { sponsorshipAgreementId: string; clientRequestId: string; approved: boolean; confirmation: "APPROVE NEUTRAL SPONSORSHIP RECOGNITION" | "REVOKE NEUTRAL SPONSORSHIP RECOGNITION"; reason: string };
export type OperatorSponsorshipRecognitionResult = { sponsorshipAgreementId: string; publicRecognitionApproved: boolean; amountsPublic: false; grantsAuthority: false; testMode: boolean; idempotentReplay: boolean };
export type OperatorSponsorshipAllocationKind = "funding_minor" | "sandbox_credit_units" | "grant_count";
export type OperatorSponsorshipAllocationInput = { clientRequestId: string; sponsorshipAgreementId: string; assistanceProgramId: string; allocationKind: OperatorSponsorshipAllocationKind; allocationCap: number; currency: "usd" | null; confirmation: "CREATE SPONSORSHIP ASSISTANCE ALLOCATION"; reason: string };
export type OperatorSponsorshipAllocationResult = { allocationId: string; sponsorshipAgreementId: string; assistanceProgramId: string; scope: EconomicAssistanceScope; allocationKind: OperatorSponsorshipAllocationKind; allocationCap: number; currency: "usd" | null; sponsorSelectsRecipients: false; sponsorReceivesRecipientData: false; grantsAuthority: false; testMode: boolean; idempotentReplay: boolean };
export type OperatorSponsorshipAllocationCloseInput = { clientRequestId: string; allocationId: string; confirmation: "CLOSE SPONSORSHIP ASSISTANCE ALLOCATION"; reason: string };
export type OperatorSponsorshipAllocationCloseResult = { allocationId: string; status: "canceled"; testMode: boolean; idempotentReplay: boolean };

export type BillingAccountSummary = {
  available: boolean;
  mode: BillingMode;
  contributions: SupportHistoryItem[];
  receipts: ReceiptSummary[];
  subscription: SubscriptionSummary | null;
  sandbox: SandboxCreditSummary;
  marketplacePurchases: MarketplacePurchaseSummary[];
  jobPostPayments: JobPostPaymentSummary[];
  seller: SellerFinanceSummary | null;
  assistance: EconomicAssistanceSummary[];
  recognition: EconomicSupportRecognitionSummary | null;
  accountRequests: EconomicAccountRequestSummary[];
  activeRestrictions: EconomicServiceRestrictionSummary[];
  closureReadiness: EconomicClosureReadiness;
  operator: EconomicOperatorSummary;
  recognitionAvailable: boolean;
  projectionCoverage: BillingAccountProjectionCoverage;
  warnings: string[];
};

export type RedirectActionResult = {
  ok: boolean;
  url: string | null;
  message: string;
};

type JsonRecord = Record<string, unknown>;

const genericUnavailableMessage = "Billing is not available right now. No payment was created. Please try again later or contact support@elysiaecobotics.com.";
const economicOperatorCapabilities = new Set<EconomicOperatorCapability>(economicOperatorCapabilityKeys);
const economicOperatorFeatureFlagKeys = [
  "customer_portal", "economic_assistance_workflow", "economic_webhooks",
  "job_post_fee_enforcement", "live_stripe", "marketplace_paid_offers",
  "marketplace_payout_preparation", "marketplace_payouts", "marketplace_seller_onboarding",
  "organization_billing", "organization_contract_workflow", "public_support_recognition",
  "recurring_support", "sandbox_credit_display", "sandbox_credit_enforcement",
  "sandbox_credit_purchase", "sponsorship_checkout", "sponsorship_display",
  "sponsorship_review_workflow", "support_checkout", "test_refund_execution"
] as const;
const operatorSandboxSources = new Set<OperatorSandboxCreditSource>(["starter", "sponsored", "waiver", "waived", "operational", "operator", "test"]);
const refundHoldStatuses = new Set<OperatorRefundHoldResult["status"]>(["held_for_review", "approved_for_provider", "provider_pending", "completed", "rejected", "canceled"]);
const testRefundStatuses = new Set<OperatorTestRefundExecutionResult["status"]>(["provider_pending", "completed", "rejected", "canceled"]);
const testRefundProviderStatuses = new Set<OperatorTestRefundExecutionResult["providerStatus"]>(["pending", "succeeded", "failed", "canceled"]);
const reconciliationStatuses = new Set<OperatorReconciliationResult["status"]>(["open", "investigating", "waiting_for_provider", "resolved", "closed_no_change"]);
const billingUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sandboxPackCodePattern = /^sandbox_test_[a-z0-9]+(?:_[a-z0-9]+)*$/;
const consentVersionPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const billingLegalDocumentExpectations = billingLegalDocumentIntegrityExpectations;
const billingLegalConsentBundleExpectations = billingLegalConsentBundleIntegrityExpectations;
const MAX_BILLING_RESPONSE_BYTES = 131_072;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function nestedRecord(record: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    if (isRecord(record[key])) return record[key] as JsonRecord;
  }
  return {} as JsonRecord;
}

function hasOwnProjection(record: JsonRecord, ...keys: string[]) {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(record, key));
}

function normalizeMode(value: unknown): BillingMode {
  if (value === "test" || value === "live" || value === "disabled") return value;
  return "disabled";
}

function normalizeCadence(value: unknown): SupportCadence | null {
  if (value === "one_time" || value === "monthly") return value;
  if (value === "recurring" || value === "support_recurring") return "monthly";
  if (value === "support_one_time") return "one_time";
  return null;
}

function normalizeOrderStatus(value: unknown): BillingOrderStatus {
  const status = stringValue(value).toLowerCase();
  if (["paid", "complete", "completed", "confirmed", "fulfilled", "verified"].includes(status)) return "verified";
  if (["pending", "created", "open", "processing", "requires_action"].includes(status)) return "processing";
  if (status === "checkout_created") return "processing";
  if (["canceled", "cancelled", "expired", "incomplete"].includes(status)) return "canceled";
  if (["failed", "payment_failed"].includes(status)) return "failed";
  if (["refunded", "partially_refunded"].includes(status)) return "refunded";
  if (status === "disputed") return "disputed";
  if (status === "unavailable" || status === "disabled") return "unavailable";
  return "unknown";
}

const billingOrderFlows = new Set<BillingOrderFlow>([
  "support_one_time", "support_recurring", "sandbox_credits", "job_post_fee",
  "marketplace_purchase", "organization_service", "sponsorship"
]);

function strictBillingOrderFlow(value: unknown): BillingOrderFlow {
  if (typeof value !== "string" || !billingOrderFlows.has(value as BillingOrderFlow)) {
    throw new BillingRequestError("The private order returned an unrecognized economic flow. It will not be attributed to this service.", 503, "billing_order_flow_invalid");
  }
  return value as BillingOrderFlow;
}

function strictBillingOrderTimestamp(value: unknown, nullable: boolean, errorCode: string): string | null {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new BillingRequestError("The private order returned an invalid timestamp. No completed result should be assumed.", 503, errorCode);
  }
  return value;
}

function safeServerMessage(value: unknown, fallback: string) {
  const candidate = stringValue(value).trim();
  if (!candidate || candidate.length > 320) return fallback;
  if (/sk_(live|test)|whsec_|authorization|bearer\s|service[_-]?role|stripe[_-]?(session|customer|payment|subscription)[_-]?id|\b(?:acct|cus|pi|ch|cs|sub|in|re|po|prod|price|evt|tr|seti|pm)_[A-Za-z0-9]+/i.test(candidate)) return fallback;
  return candidate;
}

function safeInternalOrStripeUrl(value: unknown) {
  const candidate = nullableString(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate, window.location.origin);
    if (url.username || url.password) return null;
    if (url.origin === window.location.origin) return url.href;
    if (url.protocol === "https:" && url.port === "" && (
      url.hostname === "checkout.stripe.com"
      || url.hostname === "billing.stripe.com"
      || url.hostname === "connect.stripe.com"
    )) return url.href;
  } catch {
    return null;
  }
  return null;
}

export function createBillingClientRequestId() {
  return globalThis.crypto.randomUUID();
}

export function isBillingUuid(value: string) {
  return billingUuidPattern.test(value.trim());
}

function exactRecord(value: unknown, keys: readonly string[], errorCode: string): JsonRecord {
  if (!isRecord(value)) throw new BillingRequestError("The private economic operation returned an invalid result. No completed action should be assumed.", 503, errorCode);
  const actualKeys = Object.keys(value);
  if (actualKeys.length !== keys.length || actualKeys.some((key) => !keys.includes(key))) {
    throw new BillingRequestError("The private economic operation returned an invalid result. No completed action should be assumed.", 503, errorCode);
  }
  return value;
}

function operatorInputError(message: string, code: string): never {
  throw new BillingRequestError(message, 400, code);
}

function normalizedOperatorUuid(value: string, label: string) {
  const normalized = value.trim().toLowerCase();
  if (!billingUuidPattern.test(normalized)) operatorInputError(`${label} must be a valid internal UUID. Do not enter a Stripe or other provider identifier.`, "operator_uuid_invalid");
  return normalized;
}

function normalizedOperatorReason(value: string) {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 1_000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) {
    operatorInputError("Enter a private audit reason between 8 and 1,000 characters.", "operator_reason_invalid");
  }
  return normalized;
}

function normalizedOperatorExpiration(value: string | null) {
  if (value === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) {
    operatorInputError("The optional expiration must be a valid future UTC timestamp.", "operator_expiration_invalid");
  }
  const timestamp = Date.parse(value);
  const maximum = Date.now() + Math.floor(10 * 365.25 * 24 * 60 * 60 * 1_000);
  if (!Number.isFinite(timestamp) || timestamp <= Date.now() || timestamp > maximum) {
    operatorInputError("The optional expiration must be in the future and no more than ten years away.", "operator_expiration_invalid");
  }
  return new Date(timestamp).toISOString();
}

function normalizedEconomicTimestamp(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) operatorInputError(`${label} must be a valid UTC timestamp.`, "economic_timestamp_invalid");
  const timestamp = Date.parse(value);
  const minimum = Date.UTC(2020, 0, 1);
  const maximum = Date.now() + Math.floor(10 * 365.25 * 24 * 60 * 60 * 1_000);
  if (!Number.isFinite(timestamp) || timestamp < minimum || timestamp > maximum) operatorInputError(`${label} must be between 2020 and ten years from now.`, "economic_timestamp_invalid");
  return new Date(timestamp).toISOString();
}

function operatorMutationEnvelope(data: JsonRecord, payloadKey: string, payloadKeys: readonly string[], errorCode: string) {
  const envelope = exactRecord(data, ["ok", payloadKey], errorCode);
  if (envelope.ok !== true) throw new BillingRequestError("The private economic operation did not return a confirmed result. No completed action should be assumed.", 503, errorCode);
  return exactRecord(envelope[payloadKey], payloadKeys, errorCode);
}

function errorMessageForStatus(status: number, errorCode: string) {
  if (errorCode === "economic_recoverable_account_required") return "Confirm this Website Account's email and sign in again before attaching paid value. Password recovery must remain available for account-linked purchases.";
  if (errorCode === "economic_account_unavailable") return "This Website Account cannot start or manage an economic action right now. No payment should be assumed; contact support if the restriction is unexpected.";
  if (status === 401) return "Sign in again before using account-linked billing. Guest one-time support remains available when checkout is enabled.";
  if (status === 403) return "This Website Account does not have access to that private economic action.";
  if (status === 404) return "That private billing record is unavailable or no longer accessible.";
  if (status === 409) return "That billing action is already being processed. Refresh the account summary before trying again.";
  if (status === 429) return "Too many billing requests were made in a short time. Please wait and try again.";
  if (errorCode === "billing_disabled" || errorCode === "feature_disabled" || status === 503) return genericUnavailableMessage;
  return "The billing request could not be completed safely. No new payment should be assumed. Please try again or contact support@elysiaecobotics.com.";
}

export function currentBillingApiPublication() {
  // This Website is a browser-only application. Node-based contract tests do
  // not have a document and exercise the response parser with a mocked Worker;
  // a real rendered document must explicitly publish the separately deployed
  // test Worker before any /api/billing request is allowed to leave the client.
  if (typeof document === "undefined") return "contract-test" as const;
  const marker = document.head.querySelector<HTMLMetaElement>('meta[name="elysia-billing-api-publication"]');
  return marker?.content === "live" ? "live" as const : marker?.content === "test" ? "test" as const : "disabled" as const;
}

async function billingFetch(path: string, init: RequestInit = {}, accessToken?: string | null) {
  if (currentBillingApiPublication() === "disabled") {
    throw new BillingRequestError(genericUnavailableMessage, 503, "billing_disabled");
  }
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.body) headers.set("content-type", "application/json");
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  else init.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = globalThis.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(path, { ...init, headers, credentials: "same-origin", signal: controller.signal });
    const declaredLength = Number(response.headers.get("content-length") || "0");
    if (!Number.isFinite(declaredLength) || declaredLength < 0 || declaredLength > MAX_BILLING_RESPONSE_BYTES) throw new BillingRequestError(genericUnavailableMessage, 0, "response_too_large");
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_BILLING_RESPONSE_BYTES) throw new BillingRequestError(genericUnavailableMessage, 0, "response_too_large");
    const data: unknown = JSON.parse(text);
    const record = isRecord(data) ? data : {};
    if (!response.ok || record.ok === false) {
      const errorCode = stringValue(record.error || record.code);
      throw new BillingRequestError(errorMessageForStatus(response.status, errorCode), response.status, errorCode);
    }
    // Every returned financial record belongs to the published environment.
    const publication = currentBillingApiPublication();
    const validateMode = (value: unknown): void => {
      if (Array.isArray(value)) { value.forEach(validateMode); return; }
      if (!isRecord(value)) return;
      if (typeof value.testMode === "boolean" && publication !== "contract-test" && value.testMode !== (publication === "test")) {
        throw new BillingRequestError(genericUnavailableMessage, 503, "billing_environment_mismatch");
      }
      Object.values(value).forEach(validateMode);
    };
    validateMode(record);
    return record;
  } catch (error) {
    if (error instanceof BillingRequestError) throw error;
    throw new BillingRequestError(genericUnavailableMessage, 0, "network_unavailable");
  } finally {
    globalThis.clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export class BillingRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "BillingRequestError";
    this.status = status;
    this.code = code;
  }
}

export function billingErrorMessage(error: unknown) {
  return error instanceof BillingRequestError ? error.message : genericUnavailableMessage;
}

function billingLegalDocumentVersions(value: unknown): BillingLegalDocumentVersions {
  const documentMap = exactRecord(value, Object.keys(billingLegalDocumentExpectations), "billing_capabilities_invalid");
  const parsed = {} as BillingLegalDocumentVersions;
  for (const [key, expectation] of Object.entries(billingLegalDocumentExpectations) as Array<[
    keyof BillingLegalDocumentVersions,
    { version: string; path: string; contentSha256: string }
  ]>) {
    const document = exactRecord(documentMap[key], ["version", "path", "contentSha256"], "billing_capabilities_invalid");
    if (document.version !== expectation.version || document.path !== expectation.path || document.contentSha256 !== expectation.contentSha256
      || typeof document.contentSha256 !== "string" || !/^[0-9a-f]{64}$/.test(document.contentSha256)) {
      throw new BillingRequestError(genericUnavailableMessage, 503, "billing_capabilities_invalid");
    }
    parsed[key] = { version: expectation.version, path: expectation.path, contentSha256: expectation.contentSha256 } as never;
  }
  return parsed;
}

function billingLegalConsentBundles(value: unknown, legalDocuments: BillingLegalDocumentVersions): BillingLegalConsentBundles {
  const bundleMap = exactRecord(value, Object.keys(billingLegalConsentBundleExpectations), "billing_capabilities_invalid");
  const parsed = {} as BillingLegalConsentBundles;
  for (const [bundleKey, expectation] of Object.entries(billingLegalConsentBundleExpectations) as Array<[
    BillingLegalConsentBundleKey,
    { version: string; path: string; documents: Record<string, { version: string; path: string; contentSha256: string }> }
  ]>) {
    const bundle = exactRecord(bundleMap[bundleKey], ["version", "path", "documents"], "billing_capabilities_invalid");
    if (bundle.version !== expectation.version || bundle.path !== expectation.path) {
      throw new BillingRequestError(genericUnavailableMessage, 503, "billing_capabilities_invalid");
    }
    const documents = exactRecord(bundle.documents, Object.keys(expectation.documents), "billing_capabilities_invalid");
    const parsedDocuments: Record<string, BillingLegalReference> = {};
    for (const [documentKey, expectedDocument] of Object.entries(expectation.documents)) {
      const document = exactRecord(documents[documentKey], ["version", "path", "contentSha256"], "billing_capabilities_invalid");
      if (document.version !== expectedDocument.version || document.path !== expectedDocument.path || document.contentSha256 !== expectedDocument.contentSha256
        || typeof document.contentSha256 !== "string" || !/^[0-9a-f]{64}$/.test(document.contentSha256)) {
        throw new BillingRequestError(genericUnavailableMessage, 503, "billing_capabilities_invalid");
      }
      parsedDocuments[documentKey] = { version: expectedDocument.version, path: expectedDocument.path, contentSha256: expectedDocument.contentSha256 };
    }
    parsed[bundleKey] = { version: expectation.version, path: expectation.path, documents: parsedDocuments };
  }
  if (parsed.support_one_time_checkout_bundle.documents.supportTerms?.version !== legalDocuments.supportOneTime.version
    || parsed.support_recurring_checkout_bundle.documents.recurringSupportTerms?.version !== legalDocuments.supportRecurring.version
    || parsed.marketplace_purchase_checkout_bundle.documents.marketplaceBuyerTerms?.version !== legalDocuments.marketplaceBuyerTerms.version) {
    throw new BillingRequestError(genericUnavailableMessage, 503, "billing_capabilities_invalid");
  }
  return parsed;
}

export async function loadBillingCapabilities(): Promise<BillingCapabilities> {
  try {
    const data = exactRecord(await billingFetch("/api/billing/capabilities"), ["ok", "mode", "livePayments", "processor", "features", "legalDocumentVersions", "legalConsentBundles"], "billing_capabilities_invalid");
    const features = exactRecord(data.features, [...(isRecord(data.features) && "jobPostCheckout" in data.features ? ["jobPostCheckout"] : []), "oneTimeSupport", "recurringSupport", "customerPortal", "accountLifecycle", "sellerOnboarding", "organizationServiceCheckout", "sponsorshipCheckout"], "billing_capabilities_invalid");
    if (data.ok !== true || !["test", "live", "disabled"].includes(String(data.mode)) || typeof data.livePayments !== "boolean" || (data.livePayments && data.mode !== "live") || data.processor !== "stripe"
      || typeof features.oneTimeSupport !== "boolean" || typeof features.recurringSupport !== "boolean"
      || typeof features.customerPortal !== "boolean" || typeof features.accountLifecycle !== "boolean" || typeof features.sellerOnboarding !== "boolean"
      || typeof features.organizationServiceCheckout !== "boolean" || typeof features.sponsorshipCheckout !== "boolean") {
      throw new BillingRequestError(genericUnavailableMessage, 503, "billing_capabilities_invalid");
    }
    const mode = data.mode as BillingMode;
    const supportCheckout = features.oneTimeSupport;
    const recurringSupport = features.recurringSupport;
    const customerPortal = features.customerPortal;
    const accountLifecycle = features.accountLifecycle;
    const sellerOnboarding = features.sellerOnboarding;
    const organizationServiceCheckout = features.organizationServiceCheckout;
    const sponsorshipCheckout = features.sponsorshipCheckout;
    const legalDocumentVersions = mode !== "disabled" ? billingLegalDocumentVersions(data.legalDocumentVersions) : null;
    const legalConsentBundles = mode !== "disabled" && legalDocumentVersions ? billingLegalConsentBundles(data.legalConsentBundles, legalDocumentVersions) : null;
    if ((mode === "disabled" && data.legalDocumentVersions !== null)
      || (mode === "disabled" && data.legalConsentBundles !== null)
      || (mode === "disabled" && (supportCheckout || recurringSupport || customerPortal || accountLifecycle || sellerOnboarding || organizationServiceCheckout || sponsorshipCheckout))) {
      throw new BillingRequestError(genericUnavailableMessage, 503, "billing_capabilities_invalid");
    }
    const available = mode !== "disabled" && (supportCheckout || recurringSupport || customerPortal || accountLifecycle || sellerOnboarding || organizationServiceCheckout || sponsorshipCheckout);
    return {
      available,
      mode,
      supportCheckout,
      jobPostCheckout: features.jobPostCheckout === true,
      recurringSupport,
      accountBilling: mode !== "disabled",
      customerPortal,
      cancellation: customerPortal,
      accountLifecycle,
      sellerOnboarding,
      organizationServiceCheckout,
      sponsorshipCheckout,
      sellerPayouts: false,
      livePayments: data.livePayments,
      legalDocumentVersions,
      legalConsentBundles,
      message: available
        ? supportCheckout || recurringSupport || organizationServiceCheckout || sponsorshipCheckout
          ? mode === "live" ? "Approved first-party checkout is available through Stripe." : "One or more explicitly labeled economic test paths are available. No live charge can be created."
          : customerPortal
            ? "Private Stripe billing management is available while new checkout remains disabled."
            : "A private economic account workflow is available; each page shows its exact scope."
        : genericUnavailableMessage
    };
  } catch (error) {
    return {
      available: false,
      mode: "disabled",
      supportCheckout: false,
      recurringSupport: false,
      accountBilling: false,
      customerPortal: false,
      cancellation: false,
      accountLifecycle: false,
      sellerOnboarding: false,
      organizationServiceCheckout: false,
      sponsorshipCheckout: false,
      sellerPayouts: false,
      livePayments: false,
      legalDocumentVersions: null,
      legalConsentBundles: null,
      message: billingErrorMessage(error)
    };
  }
}

function sandboxExpirationDays(value: unknown) {
  return value === null || (typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 3_650)
    ? value as number | null
    : undefined;
}

export async function loadSandboxCreditCatalog(): Promise<SandboxCreditCatalog> {
  const data = await billingFetch("/api/billing/sandbox-credits/catalog", { cache: "no-store" });
  const catalog = operatorMutationEnvelope(data, "catalog", ["available", "packs", "testMode"], "sandbox_credit_catalog_invalid");
  if (typeof catalog.available !== "boolean" || typeof catalog.testMode !== "boolean" || !Array.isArray(catalog.packs) || catalog.packs.length > 100) {
    throw new BillingRequestError("The sandbox credit catalog was invalid. No purchase is available.", 503, "sandbox_credit_catalog_invalid");
  }
  const seen = new Set<string>();
  const packs = catalog.packs.map((value): SandboxCreditPack => {
    const pack = exactRecord(value, ["packCode", "amountMinor", "currency", "grantedUnits", "expiresAfterDays", "disclosureVersion", "testMode"], "sandbox_credit_catalog_invalid");
    const expiresAfterDays = sandboxExpirationDays(pack.expiresAfterDays);
    if (typeof pack.packCode !== "string" || pack.packCode.length > 93 || !sandboxPackCodePattern.test(pack.packCode) || seen.has(pack.packCode)
      || !Number.isSafeInteger(pack.amountMinor) || Number(pack.amountMinor) < 1 || Number(pack.amountMinor) > 1_000_000_000
      || pack.currency !== "usd"
      || !Number.isSafeInteger(pack.grantedUnits) || Number(pack.grantedUnits) < 1 || Number(pack.grantedUnits) > 1_000_000_000
      || expiresAfterDays === undefined
      || typeof pack.disclosureVersion !== "string" || !consentVersionPattern.test(pack.disclosureVersion)
      || typeof pack.testMode !== "boolean") {
      throw new BillingRequestError("The sandbox credit catalog was invalid. No purchase is available.", 503, "sandbox_credit_catalog_invalid");
    }
    seen.add(pack.packCode);
    return {
      packCode: pack.packCode,
      amountMinor: Number(pack.amountMinor),
      currency: "usd",
      grantedUnits: Number(pack.grantedUnits),
      expiresAfterDays,
      disclosureVersion: pack.disclosureVersion,
      testMode: currentBillingApiPublication() !== "live"
    };
  });
  if (!catalog.available && packs.length) throw new BillingRequestError("The sandbox credit catalog was invalid. No purchase is available.", 503, "sandbox_credit_catalog_invalid");
  return { available: catalog.available, packs, testMode: currentBillingApiPublication() !== "live" };
}

export async function createSandboxCreditCheckout(input: SandboxCreditCheckoutInput, accessToken: string): Promise<SandboxCreditCheckoutResult> {
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  if (input.packCode.length > 93 || !sandboxPackCodePattern.test(input.packCode)) operatorInputError("Choose an available sandbox credit pack.", "sandbox_pack_code_invalid");
  if (input.sourceRoute !== "/commons-circle/support-billing" && input.sourceRoute !== "/commune/sandbox-review") operatorInputError("The sandbox checkout source was invalid.", "source_route_invalid");
  if (!consentVersionPattern.test(input.consentVersion)) operatorInputError("The sandbox credit disclosure version was invalid.", "consent_version_invalid");
  const body: SandboxCreditCheckoutInput = { clientRequestId, packCode: input.packCode, sourceRoute: input.sourceRoute, consentVersion: input.consentVersion };
  const data = await billingFetch("/api/billing/sandbox-credits/checkout", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const envelope = exactRecord(data, ["ok", "checkoutUrl", "orderReference", "pack"], "sandbox_credit_checkout_invalid");
  const pack = exactRecord(envelope.pack, ["code", "grantedUnits", "expiresAfterDays", "changesSafetyPrivileges", "testMode"], "sandbox_credit_checkout_invalid");
  const checkoutUrl = safeInternalOrStripeUrl(envelope.checkoutUrl);
  const expiresAfterDays = sandboxExpirationDays(pack.expiresAfterDays);
  let exactCheckoutHost = false;
  try { exactCheckoutHost = Boolean(checkoutUrl && new URL(checkoutUrl).hostname === "checkout.stripe.com"); } catch { exactCheckoutHost = false; }
  if (envelope.ok !== true || !exactCheckoutHost
    || typeof envelope.orderReference !== "string" || !/^[A-Za-z0-9_-]{24,160}$/.test(envelope.orderReference)
    || pack.code !== input.packCode
    || !Number.isSafeInteger(pack.grantedUnits) || Number(pack.grantedUnits) < 1 || Number(pack.grantedUnits) > 1_000_000_000
    || expiresAfterDays === undefined
    || pack.changesSafetyPrivileges !== false
    || typeof pack.testMode !== "boolean") {
    throw new BillingRequestError("The sandbox checkout result was invalid. No checkout or credit grant should be assumed.", 503, "sandbox_credit_checkout_invalid");
  }
  return {
    checkoutUrl: checkoutUrl as string,
    orderReference: envelope.orderReference,
    pack: { code: input.packCode, grantedUnits: Number(pack.grantedUnits), expiresAfterDays, changesSafetyPrivileges: false, testMode: currentBillingApiPublication() !== "live" }
  };
}

const marketplaceDocumentVersionPattern = /^[A-Za-z0-9][A-Za-z0-9._:+-]{0,119}$/;
const marketplaceLicenseKeyPattern = /^[A-Za-z0-9][A-Za-z0-9._+-]{1,100}$/;
const marketplaceSlugPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
const marketplaceEconomicStatusPattern = /^[a-z][a-z0-9_]{0,39}$/;

function marketplaceString(value: unknown, maximum: number, errorCode: string) {
  if (typeof value !== "string" || !value || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new BillingRequestError("The Marketplace commerce result was invalid. No license or payment should be assumed.", 503, errorCode);
  }
  return value;
}

function marketplaceUuid(value: unknown, errorCode: string) {
  const candidate = marketplaceString(value, 64, errorCode);
  if (!billingUuidPattern.test(candidate)) throw new BillingRequestError("The Marketplace commerce result was invalid. No license or payment should be assumed.", 503, errorCode);
  return candidate;
}

function marketplaceDocumentVersion(value: unknown, errorCode: string) {
  const candidate = marketplaceString(value, 120, errorCode);
  if (!marketplaceDocumentVersionPattern.test(candidate)) throw new BillingRequestError("The Marketplace terms version was invalid. No license or payment should be assumed.", 503, errorCode);
  return candidate;
}

function marketplacePurchaseBody(input: MarketplacePurchaseInput) {
  const offerId = normalizedOperatorUuid(input.offerId, "Marketplace offer ID");
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  if (!["/marketplace", "/marketplace/browse", "/marketplace/account"].includes(input.sourceRoute)) operatorInputError("The Marketplace source route was invalid.", "source_route_invalid");
  if (!marketplaceDocumentVersionPattern.test(input.consentVersion)) operatorInputError("The Marketplace terms version was invalid.", "marketplace_consent_version_invalid");
  return { offerId, clientRequestId, sourceRoute: input.sourceRoute, consentVersion: input.consentVersion } satisfies MarketplacePurchaseInput;
}

export async function loadMarketplaceCommerceCatalog(): Promise<MarketplaceCommerceCatalog> {
  const data = await billingFetch("/api/billing/marketplace/catalog", { cache: "no-store" });
  const envelope = exactRecord(data, ["ok", "catalog"], "marketplace_catalog_invalid");
  const catalog = exactRecord(envelope.catalog, ["available", "offers", "testMode"], "marketplace_catalog_invalid");
  if (envelope.ok !== true || typeof catalog.available !== "boolean" || typeof catalog.testMode !== "boolean" || !Array.isArray(catalog.offers) || catalog.offers.length > 1_000) {
    throw new BillingRequestError("The Marketplace offer catalog was invalid. Existing free Marketplace browsing remains available.", 503, "marketplace_catalog_invalid");
  }
  const seen = new Set<string>();
  const offers = catalog.offers.map((value): MarketplaceCommercialOffer => {
    const offer = exactRecord(value, ["offerId", "listingId", "addonVersionId", "listingSlug", "listingName", "version", "offerKind", "amountMinor", "currency", "licenseKey", "licenseVersion", "buyerTermsVersion", "paymentGrantsTrust", "purchaseInstallsAddon", "testMode"], "marketplace_catalog_invalid");
    const offerId = marketplaceUuid(offer.offerId, "marketplace_catalog_invalid");
    const listingSlug = marketplaceString(offer.listingSlug, 200, "marketplace_catalog_invalid");
    const licenseKey = marketplaceString(offer.licenseKey, 101, "marketplace_catalog_invalid");
    if (seen.has(offerId) || !marketplaceSlugPattern.test(listingSlug) || !marketplaceLicenseKeyPattern.test(licenseKey)
      || (offer.offerKind !== "free" && offer.offerKind !== "paid")
      || (offer.offerKind === "free" ? offer.amountMinor !== null || offer.currency !== null : !Number.isSafeInteger(offer.amountMinor) || Number(offer.amountMinor) < 50 || Number(offer.amountMinor) > 10_000_000 || offer.currency !== "usd")
      || offer.paymentGrantsTrust !== false || offer.purchaseInstallsAddon !== false || typeof offer.testMode !== "boolean") {
      throw new BillingRequestError("The Marketplace offer catalog was invalid. Existing free Marketplace browsing remains available.", 503, "marketplace_catalog_invalid");
    }
    seen.add(offerId);
    return {
      offerId,
      listingId: marketplaceUuid(offer.listingId, "marketplace_catalog_invalid"),
      addonVersionId: marketplaceUuid(offer.addonVersionId, "marketplace_catalog_invalid"),
      listingSlug,
      listingName: marketplaceString(offer.listingName, 300, "marketplace_catalog_invalid"),
      version: marketplaceString(offer.version, 120, "marketplace_catalog_invalid"),
      offerKind: offer.offerKind,
      amountMinor: offer.amountMinor === null ? null : Number(offer.amountMinor),
      currency: offer.currency as "usd" | null,
      licenseKey,
      licenseVersion: marketplaceDocumentVersion(offer.licenseVersion, "marketplace_catalog_invalid"),
      buyerTermsVersion: marketplaceDocumentVersion(offer.buyerTermsVersion, "marketplace_catalog_invalid"),
      paymentGrantsTrust: false,
      purchaseInstallsAddon: false,
      testMode: currentBillingApiPublication() !== "live"
    };
  });
  if (!catalog.available && offers.length) throw new BillingRequestError("The Marketplace offer catalog was invalid. Existing free Marketplace browsing remains available.", 503, "marketplace_catalog_invalid");
  return { available: catalog.available, offers, testMode: currentBillingApiPublication() !== "live" };
}

export async function createMarketplaceCheckout(input: MarketplacePurchaseInput, accessToken: string): Promise<MarketplaceCheckoutResult> {
  const body = marketplacePurchaseBody(input);
  let data: JsonRecord;
  try {
    data = await billingFetch("/api/billing/marketplace/checkout", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  } catch (error) {
    if (error instanceof BillingRequestError && (error.status === 0 || error.status >= 500)) {
      throw new BillingRequestError("The Marketplace checkout result could not be confirmed. No purchase or license should be assumed. Retry the unchanged offer so its same request identifier is reused.", error.status, error.code);
    }
    throw error;
  }
  if (data.alreadyOwned === true) {
    const envelope = exactRecord(data, ["ok", "alreadyOwned", "license", "testMode"], "marketplace_checkout_invalid");
    const license = exactRecord(envelope.license, ["licenseId", "offerId", "listingId", "addonVersionId", "economicStatus", "installAuthorized", "paymentGrantsAuthority"], "marketplace_checkout_invalid");
    if (envelope.ok !== true || typeof envelope.testMode !== "boolean" || license.offerId !== body.offerId || license.installAuthorized !== false || license.paymentGrantsAuthority !== false) {
      throw new BillingRequestError("The Marketplace ownership result was invalid. No new purchase or install should be assumed.", 503, "marketplace_checkout_invalid");
    }
    marketplaceUuid(license.licenseId, "marketplace_checkout_invalid");
    marketplaceUuid(license.listingId, "marketplace_checkout_invalid");
    marketplaceUuid(license.addonVersionId, "marketplace_checkout_invalid");
    const economicStatus = marketplaceString(license.economicStatus, 40, "marketplace_checkout_invalid");
    if (!marketplaceEconomicStatusPattern.test(economicStatus)) throw new BillingRequestError("The Marketplace ownership result was invalid. No new purchase or install should be assumed.", 503, "marketplace_checkout_invalid");
    return { alreadyOwned: true, economicStatus, installAuthorized: false, paymentGrantsAuthority: false, testMode: currentBillingApiPublication() !== "live" };
  }
  const envelope = exactRecord(data, ["ok", "alreadyOwned", "checkoutUrl", "orderReference", "license", "testMode"], "marketplace_checkout_invalid");
  const license = exactRecord(envelope.license, ["offerId", "listingId", "addonVersionId", "licenseKey", "licenseVersion", "installAuthorized", "paymentGrantsAuthority"], "marketplace_checkout_invalid");
  const checkoutUrl = safeInternalOrStripeUrl(envelope.checkoutUrl);
  let exactCheckoutHost = false;
  try { exactCheckoutHost = Boolean(checkoutUrl && new URL(checkoutUrl).origin === "https://checkout.stripe.com"); } catch { exactCheckoutHost = false; }
  const licenseKey = marketplaceString(license.licenseKey, 101, "marketplace_checkout_invalid");
  if (envelope.ok !== true || envelope.alreadyOwned !== false || typeof envelope.testMode !== "boolean" || !exactCheckoutHost
    || typeof envelope.orderReference !== "string" || !/^[A-Za-z0-9_-]{24,160}$/.test(envelope.orderReference)
    || license.offerId !== body.offerId || !marketplaceLicenseKeyPattern.test(licenseKey)
    || license.installAuthorized !== false || license.paymentGrantsAuthority !== false) {
    throw new BillingRequestError("The Marketplace checkout result was invalid. No purchase or license should be assumed.", 503, "marketplace_checkout_invalid");
  }
  marketplaceUuid(license.listingId, "marketplace_checkout_invalid");
  marketplaceUuid(license.addonVersionId, "marketplace_checkout_invalid");
  return { alreadyOwned: false, checkoutUrl: checkoutUrl as string, orderReference: envelope.orderReference, licenseKey, licenseVersion: marketplaceDocumentVersion(license.licenseVersion, "marketplace_checkout_invalid"), installAuthorized: false, paymentGrantsAuthority: false, testMode: currentBillingApiPublication() !== "live" };
}

export async function acceptMarketplaceFreeLicense(input: MarketplacePurchaseInput, accessToken: string): Promise<MarketplaceFreeLicenseResult> {
  const body = marketplacePurchaseBody(input);
  const data = await billingFetch("/api/billing/marketplace/free-license", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const envelope = exactRecord(data, ["ok", "license", "testMode"], "marketplace_free_license_invalid");
  const license = exactRecord(envelope.license, ["licenseId", "offerId", "listingId", "addonVersionId", "licenseKey", "licenseVersion", "economicStatus", "installAuthorized", "testMode", "paymentRequired", "paymentGrantsAuthority"], "marketplace_free_license_invalid");
  const licenseKey = marketplaceString(license.licenseKey, 101, "marketplace_free_license_invalid");
  const economicStatus = marketplaceString(license.economicStatus, 40, "marketplace_free_license_invalid");
  if (envelope.ok !== true || typeof envelope.testMode !== "boolean" || typeof license.testMode !== "boolean" || license.offerId !== body.offerId
    || !marketplaceLicenseKeyPattern.test(licenseKey) || !marketplaceEconomicStatusPattern.test(economicStatus)
    || license.installAuthorized !== false || license.paymentRequired !== false || license.paymentGrantsAuthority !== false) {
    throw new BillingRequestError("The free Marketplace license result was invalid. No license or install should be assumed.", 503, "marketplace_free_license_invalid");
  }
  marketplaceUuid(license.licenseId, "marketplace_free_license_invalid");
  marketplaceUuid(license.listingId, "marketplace_free_license_invalid");
  marketplaceUuid(license.addonVersionId, "marketplace_free_license_invalid");
  return { licenseKey, licenseVersion: marketplaceDocumentVersion(license.licenseVersion, "marketplace_free_license_invalid"), economicStatus, installAuthorized: false, paymentRequired: false, paymentGrantsAuthority: false, testMode: currentBillingApiPublication() !== "live" };
}

const jobPostEconomicStatuses = new Set<JobPostEconomicStatus>(["not_assessed", "not_required", "payment_required", "payment_pending", "satisfied", "waived", "subsidized", "refunded", "disputed", "reconciliation_required"]);
const jobPostPublicationStatuses = new Set(["draft", "pending_review", "in_review", "needs_information", "approved", "published", "rejected", "hidden", "archived", "deleted_by_user", "removed_by_moderator"]);

export async function loadJobPostOwnerEconomicStatus(jobPostId: string, accessToken: string): Promise<JobPostOwnerEconomicStatus> {
  const normalizedJobPostId = normalizedOperatorUuid(jobPostId, "Job Post ID");
  const data = await billingFetch(`/api/billing/job-post/status?jobPostId=${encodeURIComponent(normalizedJobPostId)}`, { cache: "no-store" }, accessToken);
  const envelope = exactRecord(data, ["ok", "status"], "job_post_economic_status_invalid");
  const status = exactRecord(envelope.status, ["jobPostId", "classification", "economicStatus", "contentApproved", "publicationStatus", "published", "amountMinor", "currency", "termsVersion", "testMode"], "job_post_economic_status_invalid");
  const amountMinor = status.amountMinor === null ? null : Number(status.amountMinor);
  const termsVersion = status.termsVersion === null ? null : marketplaceDocumentVersion(status.termsVersion, "job_post_economic_status_invalid");
  if (envelope.ok !== true || status.jobPostId !== normalizedJobPostId
    || !["community_free", "commercial", "waived", "subsidized"].includes(String(status.classification))
    || !jobPostEconomicStatuses.has(status.economicStatus as JobPostEconomicStatus)
    || typeof status.contentApproved !== "boolean" || typeof status.published !== "boolean"
    || !jobPostPublicationStatuses.has(String(status.publicationStatus))
    || (status.published !== (status.publicationStatus === "published"))
    || (amountMinor === null) !== (status.currency === null)
    || (amountMinor !== null && (!Number.isSafeInteger(amountMinor) || amountMinor < 1 || amountMinor > 100_000_000 || status.currency !== "usd"))
    || (status.classification === "commercial" ? termsVersion === null : termsVersion !== null)
    || typeof status.testMode !== "boolean") {
    throw new BillingRequestError("The private Job Post economic status was invalid. No payment or publication state should be assumed.", 503, "job_post_economic_status_invalid");
  }
  return {
    jobPostId: normalizedJobPostId,
    classification: status.classification as JobPostEconomicClassification,
    economicStatus: status.economicStatus as JobPostEconomicStatus,
    contentApproved: status.contentApproved,
    publicationStatus: status.publicationStatus as string,
    published: status.published,
    amountMinor,
    currency: status.currency as "usd" | null,
    termsVersion,
    testMode: currentBillingApiPublication() !== "live"
  };
}

export async function createJobPostCheckout(input: JobPostCheckoutInput, accessToken: string): Promise<JobPostCheckoutResult> {
  const body: JobPostCheckoutInput = {
    jobPostId: normalizedOperatorUuid(input.jobPostId, "Job Post ID"),
    clientRequestId: normalizedOperatorUuid(input.clientRequestId, "Client request ID"),
    sourceRoute: input.sourceRoute,
    consentVersion: marketplaceDocumentVersion(input.consentVersion, "job_post_consent_version_invalid")
  };
  if (body.sourceRoute !== "/commune/rooms/job-post" && body.sourceRoute !== "/commune/rooms/job-post/posts") {
    operatorInputError("The Job Post checkout source route was invalid.", "source_route_invalid");
  }
  let data: JsonRecord;
  try {
    data = await billingFetch("/api/billing/job-post/checkout", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  } catch (error) {
    if (error instanceof BillingRequestError && (error.status === 0 || error.status >= 500)) {
      throw new BillingRequestError("The Job Post checkout result could not be confirmed. No payment or publication should be assumed. Retry the unchanged assessment so its request identifier is reused.", error.status, error.code);
    }
    throw error;
  }
  const envelope = exactRecord(data, ["ok", "checkoutUrl", "orderReference", "jobPostId", "postId"], "job_post_checkout_invalid");
  const checkoutUrl = safeInternalOrStripeUrl(envelope.checkoutUrl);
  let exactCheckoutHost = false;
  try { exactCheckoutHost = Boolean(checkoutUrl && new URL(checkoutUrl).origin === "https://checkout.stripe.com"); } catch { exactCheckoutHost = false; }
  if (envelope.ok !== true || !exactCheckoutHost || envelope.jobPostId !== body.jobPostId
    || typeof envelope.postId !== "string" || !billingUuidPattern.test(envelope.postId)
    || typeof envelope.orderReference !== "string" || !/^[A-Za-z0-9_-]{24,160}$/.test(envelope.orderReference)) {
    throw new BillingRequestError("The Job Post checkout destination was invalid. No payment or publication should be assumed.", 503, "job_post_checkout_invalid");
  }
  return { checkoutUrl: checkoutUrl as string, orderReference: envelope.orderReference, jobPostId: body.jobPostId, postId: envelope.postId };
}

export async function loadMarketplacePurchases(accessToken: string): Promise<MarketplacePurchases> {
  const data = await billingFetch("/api/billing/marketplace/purchases", { cache: "no-store" }, accessToken);
  const envelope = exactRecord(data, ["ok", "licenses", "testMode"], "marketplace_purchases_invalid");
  if (envelope.ok !== true || typeof envelope.testMode !== "boolean" || !Array.isArray(envelope.licenses) || envelope.licenses.length > 1_000) throw new BillingRequestError("Private Marketplace licenses are unavailable right now.", 503, "marketplace_purchases_invalid");
  const seen = new Set<string>();
  const licenses = envelope.licenses.map((value): MarketplaceOwnedLicense => {
    const license = exactRecord(value, ["licenseId", "listingId", "addonVersionId", "listingSlug", "listingName", "version", "licenseKey", "licenseVersion", "acquisitionKind", "economicStatus", "safetyStatus", "installAuthorized", "acquiredAt", "testMode"], "marketplace_purchases_invalid");
    const licenseId = marketplaceUuid(license.licenseId, "marketplace_purchases_invalid");
    const listingSlug = marketplaceString(license.listingSlug, 200, "marketplace_purchases_invalid");
    const licenseKey = marketplaceString(license.licenseKey, 101, "marketplace_purchases_invalid");
    const economicStatus = marketplaceString(license.economicStatus, 40, "marketplace_purchases_invalid");
    const acquiredAt = marketplaceString(license.acquiredAt, 40, "marketplace_purchases_invalid");
    if (seen.has(licenseId) || !marketplaceSlugPattern.test(listingSlug) || !marketplaceLicenseKeyPattern.test(licenseKey)
      || (license.acquisitionKind !== "free_acceptance" && license.acquisitionKind !== "paid_order")
      || !marketplaceEconomicStatusPattern.test(economicStatus) || !["available", "unavailable", "revoked"].includes(String(license.safetyStatus))
      || license.installAuthorized !== false || typeof license.testMode !== "boolean" || !Number.isFinite(Date.parse(acquiredAt))) {
      throw new BillingRequestError("Private Marketplace licenses are unavailable right now.", 503, "marketplace_purchases_invalid");
    }
    seen.add(licenseId);
    marketplaceUuid(license.listingId, "marketplace_purchases_invalid");
    marketplaceUuid(license.addonVersionId, "marketplace_purchases_invalid");
    return { listingSlug, listingName: marketplaceString(license.listingName, 300, "marketplace_purchases_invalid"), version: marketplaceString(license.version, 120, "marketplace_purchases_invalid"), licenseKey, licenseVersion: marketplaceDocumentVersion(license.licenseVersion, "marketplace_purchases_invalid"), acquisitionKind: license.acquisitionKind, economicStatus, safetyStatus: license.safetyStatus as MarketplaceOwnedLicense["safetyStatus"], installAuthorized: false, acquiredAt, testMode: currentBillingApiPublication() !== "live" };
  });
  return { licenses, testMode: currentBillingApiPublication() !== "live" };
}

function parseMarketplaceSellerStatus(data: JsonRecord): MarketplaceSellerStatus {
  const envelope = exactRecord(data, ["ok", "seller"], "marketplace_seller_status_invalid");
  const seller = exactRecord(envelope.seller, [
    "eligible", "configured", "status", "detailsSubmitted", "chargesEnabled", "payoutsEnabled",
    "sellerAgreementVersion", "freeSellerAgreementVersion", "stripeConnectDisclosureVersion",
    "activeOfferCount", "totalOwnedOfferCount", "offersTruncated", "ownedOffers",
    "eligibleReviewedVersionCount", "eligibleReviewedVersionsTruncated", "eligibleReviewedVersions",
    "publisherOptionCount", "publisherOptionsTruncated", "publisherOptions",
    "availablePayableByCurrency", "payableByCurrency", "payoutPreparationEnabled",
    "payoutsEnabledByFeature", "payoutExecutionAvailable", "balancesAreTestRecords",
    "providerIdentifiersExposed", "testMode"
  ], "marketplace_seller_status_invalid");
  const status = marketplaceString(seller.status, 40, "marketplace_seller_status_invalid");
  const payable = exactRecord(seller.availablePayableByCurrency, Object.keys(isRecord(seller.availablePayableByCurrency) ? seller.availablePayableByCurrency : {}), "marketplace_seller_status_invalid");
  const compatibilityPayable = exactRecord(seller.payableByCurrency, Object.keys(isRecord(seller.payableByCurrency) ? seller.payableByCurrency : {}), "marketplace_seller_status_invalid");
  const payableByCurrency: Record<string, number> = {};
  if (Object.keys(payable).length > 20 || Object.keys(compatibilityPayable).length !== Object.keys(payable).length) throw new BillingRequestError("Private seller readiness is unavailable right now.", 503, "marketplace_seller_status_invalid");
  for (const [currency, amount] of Object.entries(payable)) {
    if (!/^[a-z]{3}$/.test(currency) || !Number.isSafeInteger(amount) || Number(amount) < -1_000_000_000_000 || Number(amount) > 1_000_000_000_000 || compatibilityPayable[currency] !== amount) throw new BillingRequestError("Private seller readiness is unavailable right now.", 503, "marketplace_seller_status_invalid");
    payableByCurrency[currency] = Number(amount);
  }
  if (envelope.ok !== true || typeof seller.eligible !== "boolean" || typeof seller.configured !== "boolean" || !marketplaceEconomicStatusPattern.test(status)
    || typeof seller.detailsSubmitted !== "boolean" || typeof seller.chargesEnabled !== "boolean" || typeof seller.payoutsEnabled !== "boolean"
    || !Number.isSafeInteger(seller.activeOfferCount) || Number(seller.activeOfferCount) < 0 || Number(seller.activeOfferCount) > 1_000_000
    || !Number.isSafeInteger(seller.totalOwnedOfferCount) || Number(seller.totalOwnedOfferCount) < 0 || Number(seller.totalOwnedOfferCount) > 1_000_000
    || typeof seller.offersTruncated !== "boolean"
    || !Number.isSafeInteger(seller.eligibleReviewedVersionCount) || Number(seller.eligibleReviewedVersionCount) < 0 || Number(seller.eligibleReviewedVersionCount) > 1_000_000
    || typeof seller.eligibleReviewedVersionsTruncated !== "boolean"
    || !Number.isSafeInteger(seller.publisherOptionCount) || Number(seller.publisherOptionCount) < 0 || Number(seller.publisherOptionCount) > 1_000_000
    || typeof seller.publisherOptionsTruncated !== "boolean"
    || typeof seller.payoutPreparationEnabled !== "boolean" || seller.payoutsEnabledByFeature !== false || seller.payoutExecutionAvailable !== false
    || seller.balancesAreTestRecords !== true || seller.providerIdentifiersExposed !== false || typeof seller.testMode !== "boolean") {
    throw new BillingRequestError("Private seller readiness is unavailable right now.", 503, "marketplace_seller_status_invalid");
  }
  const sellerAgreementVersion = seller.sellerAgreementVersion === null ? null : marketplaceDocumentVersion(seller.sellerAgreementVersion, "marketplace_seller_status_invalid");
  const freeSellerAgreementVersion = seller.freeSellerAgreementVersion === null ? null : marketplaceDocumentVersion(seller.freeSellerAgreementVersion, "marketplace_seller_status_invalid");
  const stripeConnectDisclosureVersion = seller.stripeConnectDisclosureVersion === null ? null : marketplaceDocumentVersion(seller.stripeConnectDisclosureVersion, "marketplace_seller_status_invalid");
  if (!Array.isArray(seller.eligibleReviewedVersions) || seller.eligibleReviewedVersions.length > 100) throw new BillingRequestError("Private seller readiness is unavailable right now.", 503, "marketplace_seller_status_invalid");
  const eligibleVersionIds = new Set<string>();
  const eligibleReviewedVersions = seller.eligibleReviewedVersions.map((value): MarketplaceSellerEligibleVersion => {
    const version = exactRecord(value, ["addonVersionId", "listingId", "listingSlug", "listingName", "version"], "marketplace_seller_status_invalid");
    const listingSlug = marketplaceString(version.listingSlug, 200, "marketplace_seller_status_invalid");
    if (!marketplaceSlugPattern.test(listingSlug)) throw new BillingRequestError("Private seller readiness is unavailable right now.", 503, "marketplace_seller_status_invalid");
    const addonVersionId = marketplaceUuid(version.addonVersionId, "marketplace_seller_status_invalid");
    if (eligibleVersionIds.has(addonVersionId)) throw new BillingRequestError("Private seller readiness is unavailable right now.", 503, "marketplace_seller_status_invalid");
    eligibleVersionIds.add(addonVersionId);
    return {
      addonVersionId,
      listingId: marketplaceUuid(version.listingId, "marketplace_seller_status_invalid"),
      listingSlug,
      listingName: marketplaceString(version.listingName, 300, "marketplace_seller_status_invalid"),
      version: marketplaceDocumentVersion(version.version, "marketplace_seller_status_invalid")
    };
  });
  const eligibleReviewedVersionCount = Number(seller.eligibleReviewedVersionCount);
  if (eligibleReviewedVersionCount < eligibleReviewedVersions.length
    || seller.eligibleReviewedVersionsTruncated !== (eligibleReviewedVersionCount > eligibleReviewedVersions.length)) {
    throw new BillingRequestError("Private seller readiness is unavailable right now.", 503, "marketplace_seller_status_invalid");
  }
  if (!Array.isArray(seller.publisherOptions) || seller.publisherOptions.length > 50) throw new BillingRequestError("Private seller readiness is unavailable right now.", 503, "marketplace_seller_status_invalid");
  const publisherIds = new Set<string>();
  const publisherOptions = seller.publisherOptions.map((value): MarketplaceSellerPublisherOption => {
    const publisher = exactRecord(value, ["publisherId", "name", "slug", "verified", "linked"], "marketplace_seller_status_invalid");
    const slug = marketplaceString(publisher.slug, 200, "marketplace_seller_status_invalid");
    if (!marketplaceSlugPattern.test(slug) || typeof publisher.verified !== "boolean" || typeof publisher.linked !== "boolean") throw new BillingRequestError("Private seller readiness is unavailable right now.", 503, "marketplace_seller_status_invalid");
    const publisherId = marketplaceUuid(publisher.publisherId, "marketplace_seller_status_invalid");
    if (publisherIds.has(publisherId)) throw new BillingRequestError("Private seller readiness is unavailable right now.", 503, "marketplace_seller_status_invalid");
    publisherIds.add(publisherId);
    return { publisherId, name: marketplaceString(publisher.name, 300, "marketplace_seller_status_invalid"), slug, verified: publisher.verified, linked: publisher.linked };
  });
  const publisherOptionCount = Number(seller.publisherOptionCount);
  if (publisherOptionCount < publisherOptions.length
    || seller.publisherOptionsTruncated !== (publisherOptionCount > publisherOptions.length)) {
    throw new BillingRequestError("Private seller readiness is unavailable right now.", 503, "marketplace_seller_status_invalid");
  }
  if (!Array.isArray(seller.ownedOffers) || seller.ownedOffers.length > 100) throw new BillingRequestError("Private seller readiness is unavailable right now.", 503, "marketplace_seller_status_invalid");
  const offerIds = new Set<string>();
  const ownedOffers = seller.ownedOffers.map((value): MarketplaceSellerOwnedOffer => {
    const offer = exactRecord(value, [
      "offerId", "listingId", "addonVersionId", "listingSlug", "listingName", "version",
      "publisherId", "offerKind", "status", "priceCode", "amountMinor", "currency",
      "licenseKey", "licenseVersion", "buyerTermsVersion", "sellerAgreementVersion",
      "commercialTermsCode", "commissionBps", "canRevise", "activatedAt", "retiredAt", "updatedAt"
    ], "marketplace_seller_status_invalid");
    const offerId = marketplaceUuid(offer.offerId, "marketplace_seller_status_invalid");
    const listingSlug = marketplaceString(offer.listingSlug, 200, "marketplace_seller_status_invalid");
    const licenseKey = marketplaceString(offer.licenseKey, 101, "marketplace_seller_status_invalid");
    const publisherId = offer.publisherId === null ? null : marketplaceUuid(offer.publisherId, "marketplace_seller_status_invalid");
    const priceCode = offer.priceCode === null ? null : marketplaceString(offer.priceCode, 120, "marketplace_seller_status_invalid");
    const commercialTermsCode = offer.commercialTermsCode === null ? null : marketplaceString(offer.commercialTermsCode, 117, "marketplace_seller_status_invalid");
    const amountMinor = offer.amountMinor === null ? null : Number(offer.amountMinor);
    const activatedAt = offer.activatedAt === null ? null : marketplaceString(offer.activatedAt, 40, "marketplace_seller_status_invalid");
    const retiredAt = offer.retiredAt === null ? null : marketplaceString(offer.retiredAt, 40, "marketplace_seller_status_invalid");
    const updatedAt = marketplaceString(offer.updatedAt, 40, "marketplace_seller_status_invalid");
    if (offerIds.has(offerId) || !marketplaceSlugPattern.test(listingSlug) || !marketplaceLicenseKeyPattern.test(licenseKey)
      || (offer.offerKind !== "free" && offer.offerKind !== "paid")
      || !["draft", "active", "suspended", "retired"].includes(String(offer.status))
      || !Number.isSafeInteger(offer.commissionBps) || Number(offer.commissionBps) < 0 || Number(offer.commissionBps) > 5_000
      || typeof offer.canRevise !== "boolean" || (offer.canRevise && offer.status !== "draft")
      || (activatedAt !== null && !Number.isFinite(Date.parse(activatedAt)))
      || (retiredAt !== null && !Number.isFinite(Date.parse(retiredAt)))
      || !Number.isFinite(Date.parse(updatedAt))
      || (offer.status === "retired" ? retiredAt === null : retiredAt !== null)
      || (offer.offerKind === "free"
        ? priceCode !== null || amountMinor !== null || offer.currency !== null || commercialTermsCode !== null || Number(offer.commissionBps) !== 0
        : priceCode === null || !/^marketplace_test_[a-z0-9_]{3,100}_usd$/.test(priceCode)
          || !Number.isSafeInteger(offer.amountMinor) || amountMinor === null || amountMinor < 50 || amountMinor > 10_000_000
          || offer.currency !== "usd" || commercialTermsCode === null || !/^[a-z0-9][a-z0-9_:-]{2,116}$/.test(commercialTermsCode))) {
      throw new BillingRequestError("Private seller readiness is unavailable right now.", 503, "marketplace_seller_status_invalid");
    }
    offerIds.add(offerId);
    return {
      offerId,
      listingId: marketplaceUuid(offer.listingId, "marketplace_seller_status_invalid"),
      addonVersionId: marketplaceUuid(offer.addonVersionId, "marketplace_seller_status_invalid"),
      listingSlug,
      listingName: marketplaceString(offer.listingName, 300, "marketplace_seller_status_invalid"),
      version: marketplaceDocumentVersion(offer.version, "marketplace_seller_status_invalid"),
      publisherId,
      offerKind: offer.offerKind,
      status: offer.status as MarketplaceSellerOwnedOffer["status"],
      priceCode,
      amountMinor,
      currency: offer.currency as "usd" | null,
      licenseKey,
      licenseVersion: marketplaceDocumentVersion(offer.licenseVersion, "marketplace_seller_status_invalid"),
      buyerTermsVersion: marketplaceDocumentVersion(offer.buyerTermsVersion, "marketplace_seller_status_invalid"),
      sellerAgreementVersion: marketplaceDocumentVersion(offer.sellerAgreementVersion, "marketplace_seller_status_invalid"),
      commercialTermsCode,
      commissionBps: Number(offer.commissionBps),
      canRevise: offer.canRevise,
      activatedAt,
      retiredAt,
      updatedAt
    };
  });
  const totalOwnedOfferCount = Number(seller.totalOwnedOfferCount);
  const activeOfferCount = Number(seller.activeOfferCount);
  if (totalOwnedOfferCount < ownedOffers.length || activeOfferCount > totalOwnedOfferCount
    || seller.offersTruncated !== (totalOwnedOfferCount > ownedOffers.length)
    || (!seller.offersTruncated && activeOfferCount !== ownedOffers.filter((offer) => offer.status === "active").length)) {
    throw new BillingRequestError("Private seller readiness is unavailable right now.", 503, "marketplace_seller_status_invalid");
  }
  return {
    eligible: seller.eligible, configured: seller.configured, status,
    detailsSubmitted: seller.detailsSubmitted, chargesEnabled: seller.chargesEnabled, payoutsEnabled: seller.payoutsEnabled,
    sellerAgreementVersion, freeSellerAgreementVersion, stripeConnectDisclosureVersion,
    activeOfferCount, totalOwnedOfferCount, offersTruncated: seller.offersTruncated, ownedOffers,
    eligibleReviewedVersionCount, eligibleReviewedVersionsTruncated: seller.eligibleReviewedVersionsTruncated, eligibleReviewedVersions,
    publisherOptionCount, publisherOptionsTruncated: seller.publisherOptionsTruncated, publisherOptions,
    availablePayableByCurrency: payableByCurrency, payableByCurrency,
    payoutPreparationEnabled: seller.payoutPreparationEnabled, payoutsEnabledByFeature: false,
    payoutExecutionAvailable: false, balancesAreTestRecords: true, providerIdentifiersExposed: false, testMode: currentBillingApiPublication() !== "live"
  };
}

export async function loadMarketplaceSellerStatus(accessToken: string): Promise<MarketplaceSellerStatus> {
  return parseMarketplaceSellerStatus(await billingFetch("/api/billing/seller/status", { cache: "no-store" }, accessToken));
}

export async function refreshMarketplaceSellerStatus(clientRequestId: string, accessToken: string): Promise<MarketplaceSellerStatus> {
  const body = { clientRequestId: normalizedOperatorUuid(clientRequestId, "Client request ID") };
  const data = await billingFetch("/api/billing/seller/status-refresh", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  return parseMarketplaceSellerStatus(data);
}

export async function createMarketplaceSellerOnboarding(input: MarketplaceSellerOnboardingInput, accessToken: string): Promise<MarketplaceSellerOnboardingResult> {
  const body: MarketplaceSellerOnboardingInput = {
    clientRequestId: normalizedOperatorUuid(input.clientRequestId, "Client request ID"),
    sellerAgreementVersion: marketplaceDocumentVersion(input.sellerAgreementVersion, "seller_agreement_version_invalid"),
    stripeConnectDisclosureVersion: marketplaceDocumentVersion(input.stripeConnectDisclosureVersion, "stripe_connect_disclosure_version_invalid"),
    sourceRoute: input.sourceRoute,
    acceptSellerAgreement: input.acceptSellerAgreement,
    acceptStripeConnectDisclosure: input.acceptStripeConnectDisclosure
  };
  if (!["/marketplace/account", "/developer-forge/dashboard"].includes(body.sourceRoute) || body.acceptSellerAgreement !== true || body.acceptStripeConnectDisclosure !== true) operatorInputError("Accept both seller disclosures before continuing.", "seller_consent_required");
  const data = await billingFetch("/api/billing/seller/onboarding", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const envelope = exactRecord(data, ["ok", "onboardingUrl", "provider", "consentRecorded", "paymentGrantsAuthority", "testMode"], "marketplace_seller_onboarding_invalid");
  const onboardingUrl = safeInternalOrStripeUrl(envelope.onboardingUrl);
  let exactConnectHost = false;
  try { exactConnectHost = Boolean(onboardingUrl && new URL(onboardingUrl).origin === "https://connect.stripe.com"); } catch { exactConnectHost = false; }
  if (envelope.ok !== true || !exactConnectHost || envelope.provider !== "stripe" || envelope.consentRecorded !== true || envelope.paymentGrantsAuthority !== false || typeof envelope.testMode !== "boolean") {
    throw new BillingRequestError("The seller-onboarding destination was invalid. No provider account change should be assumed.", 503, "marketplace_seller_onboarding_invalid");
  }
  return { onboardingUrl: onboardingUrl as string, provider: "stripe", consentRecorded: true, paymentGrantsAuthority: false, testMode: currentBillingApiPublication() !== "live" };
}

export async function acceptMarketplaceFreeSellerAgreement(input: MarketplaceFreeSellerAgreementInput, accessToken: string): Promise<MarketplaceFreeSellerAgreementResult> {
  const body: MarketplaceFreeSellerAgreementInput = {
    clientRequestId: normalizedOperatorUuid(input.clientRequestId, "Client request ID"),
    agreementVersion: marketplaceDocumentVersion(input.agreementVersion, "marketplace_free_seller_agreement_version_invalid"),
    sourceRoute: input.sourceRoute,
    acceptAgreement: input.acceptAgreement,
    confirmation: input.confirmation
  };
  if (body.sourceRoute !== "/marketplace/account" || body.acceptAgreement !== true || body.confirmation !== "ACCEPT FREE MARKETPLACE SELLER AGREEMENT") {
    operatorInputError("Accept the free Marketplace seller agreement deliberately before continuing.", "marketplace_free_seller_agreement_required");
  }
  const data = await billingFetch("/api/billing/seller/free-agreement", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const envelope = exactRecord(data, ["ok", "agreement"], "marketplace_free_seller_agreement_invalid");
  const agreement = exactRecord(envelope.agreement, ["sellerAccountId", "agreementVersion", "connectRequiredForFreeOffers", "testMode", "idempotentReplay"], "marketplace_free_seller_agreement_invalid");
  if (envelope.ok !== true || agreement.agreementVersion !== body.agreementVersion || agreement.connectRequiredForFreeOffers !== false
    || typeof agreement.testMode !== "boolean" || typeof agreement.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The free-seller agreement result was invalid. No seller setup should be assumed.", 503, "marketplace_free_seller_agreement_invalid");
  }
  return {
    sellerAccountId: marketplaceUuid(agreement.sellerAccountId, "marketplace_free_seller_agreement_invalid"),
    agreementVersion: body.agreementVersion,
    connectRequiredForFreeOffers: false,
    testMode: currentBillingApiPublication() !== "live",
    idempotentReplay: agreement.idempotentReplay
  };
}

export async function linkMarketplaceSellerPublisher(input: MarketplacePublisherLinkInput, accessToken: string): Promise<MarketplacePublisherLinkResult> {
  const body: MarketplacePublisherLinkInput = {
    publisherId: normalizedOperatorUuid(input.publisherId, "Publisher ID"),
    clientRequestId: normalizedOperatorUuid(input.clientRequestId, "Client request ID"),
    confirmation: input.confirmation,
    reason: normalizedOperatorReason(input.reason)
  };
  if (body.confirmation !== "LINK MARKETPLACE SELLER TO PUBLISHER") operatorInputError("Type LINK MARKETPLACE SELLER TO PUBLISHER exactly before continuing.", "marketplace_publisher_link_confirmation_invalid");
  const data = await billingFetch("/api/billing/seller/publisher-link", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const envelope = exactRecord(data, ["ok", "publisherLink"], "marketplace_publisher_link_invalid");
  const link = exactRecord(envelope.publisherLink, ["publisherId", "linked", "publisherVerifiedChanged", "idempotentReplay", "testMode"], "marketplace_publisher_link_invalid");
  if (envelope.ok !== true || link.publisherId !== body.publisherId || link.linked !== true || link.publisherVerifiedChanged !== false || typeof link.idempotentReplay !== "boolean" || typeof link.testMode !== "boolean") {
    throw new BillingRequestError("The private seller-to-publisher link could not be confirmed. Publisher verification was not changed.", 503, "marketplace_publisher_link_invalid");
  }
  return { publisherId: body.publisherId, linked: true, publisherVerifiedChanged: false, testMode: currentBillingApiPublication() !== "live", idempotentReplay: link.idempotentReplay };
}

export async function configureMarketplaceSellerOffer(input: MarketplaceSellerOfferInput, accessToken: string): Promise<MarketplaceSellerOfferResult> {
  const addonVersionId = normalizedOperatorUuid(input.addonVersionId, "Reviewed Marketplace version ID");
  const publisherId = input.publisherId === null ? null : normalizedOperatorUuid(input.publisherId, "Publisher ID");
  if (input.offerKind !== "free" && input.offerKind !== "paid") operatorInputError("Choose a free or paid test offer.", "marketplace_offer_kind_invalid");
  if (!marketplaceLicenseKeyPattern.test(input.licenseKey)) operatorInputError("Enter a stable license key using letters, numbers, period, underscore, plus, or hyphen.", "marketplace_license_key_invalid");
  const licenseVersion = marketplaceDocumentVersion(input.licenseVersion, "marketplace_license_version_invalid");
  const buyerTermsVersion = marketplaceDocumentVersion(input.buyerTermsVersion, "marketplace_buyer_terms_version_invalid");
  const sellerVersion = marketplaceDocumentVersion(input.sellerAgreementVersion, "seller_agreement_version_invalid");
  let amountMinor: number | null = null;
  let commercialTermsCode: string | null = null;
  if (input.offerKind === "paid") {
    if (!Number.isSafeInteger(input.amountMinor) || Number(input.amountMinor) < 50 || Number(input.amountMinor) > 10_000_000) operatorInputError("Paid test-offer amount must be 50 through 10,000,000 minor USD units.", "marketplace_offer_amount_invalid");
    if (typeof input.commercialTermsCode !== "string" || !/^[a-z0-9][a-z0-9_:-]{2,116}$/.test(input.commercialTermsCode)) operatorInputError("A valid active commercial-terms code is required for a paid test offer.", "marketplace_commercial_terms_code_invalid");
    amountMinor = Number(input.amountMinor);
    commercialTermsCode = input.commercialTermsCode;
  } else if (input.amountMinor !== null || input.commercialTermsCode !== null) {
    operatorInputError("Free offers cannot include price or commission terms.", "marketplace_free_offer_economics_invalid");
  }
  if (input.confirmation !== "CONFIGURE MARKETPLACE TEST OFFER") operatorInputError("Type CONFIGURE MARKETPLACE TEST OFFER exactly before continuing.", "marketplace_offer_confirmation_invalid");
  const body: MarketplaceSellerOfferInput = {
    clientRequestId: normalizedOperatorUuid(input.clientRequestId, "Client request ID"),
    addonVersionId,
    publisherId,
    offerKind: input.offerKind,
    amountMinor,
    licenseKey: input.licenseKey,
    licenseVersion,
    buyerTermsVersion,
    commercialTermsCode,
    sellerAgreementVersion: sellerVersion,
    confirmation: "CONFIGURE MARKETPLACE TEST OFFER",
    reason: normalizedOperatorReason(input.reason)
  };
  const data = await billingFetch("/api/billing/seller/offer", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const envelope = exactRecord(data, ["ok", "offer"], "marketplace_seller_offer_invalid");
  const offer = exactRecord(envelope.offer, ["offerId", "listingId", "addonVersionId", "offerKind", "status", "commissionBps", "commercialTermsCode", "buyerTermsVersion", "idempotentReplay", "providerCatalogConfigured", "paymentGrantsTrust", "purchaseInstallsAddon", "testMode"], "marketplace_seller_offer_invalid");
  const offerId = marketplaceUuid(offer.offerId, "marketplace_seller_offer_invalid");
  const status = marketplaceString(offer.status, 40, "marketplace_seller_offer_invalid");
  if (envelope.ok !== true || offer.addonVersionId !== addonVersionId || offer.offerKind !== input.offerKind || !marketplaceEconomicStatusPattern.test(status)
    || !Number.isSafeInteger(offer.commissionBps) || Number(offer.commissionBps) < 0 || Number(offer.commissionBps) > 5_000
    || offer.commercialTermsCode !== commercialTermsCode || offer.buyerTermsVersion !== buyerTermsVersion
    || typeof offer.idempotentReplay !== "boolean"
    || typeof offer.providerCatalogConfigured !== "boolean" || offer.providerCatalogConfigured !== (input.offerKind === "paid")
    || offer.paymentGrantsTrust !== false || offer.purchaseInstallsAddon !== false || typeof offer.testMode !== "boolean") {
    throw new BillingRequestError("The seller offer result was invalid. No active offer should be assumed.", 503, "marketplace_seller_offer_invalid");
  }
  marketplaceUuid(offer.listingId, "marketplace_seller_offer_invalid");
  return { offerId, addonVersionId, offerKind: input.offerKind, status, commissionBps: Number(offer.commissionBps), commercialTermsCode, buyerTermsVersion, providerCatalogConfigured: offer.providerCatalogConfigured, paymentGrantsTrust: false, purchaseInstallsAddon: false, testMode: currentBillingApiPublication() !== "live", idempotentReplay: offer.idempotentReplay };
}

export async function setMarketplaceSellerOfferStatus(input: MarketplaceSellerOfferStatusInput, accessToken: string): Promise<MarketplaceSellerOfferStatusResult> {
  const offerId = normalizedOperatorUuid(input.offerId, "Marketplace offer ID");
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  const expectedConfirmation = marketplaceSellerOfferStatusConfirmations[input.targetStatus];
  if (!expectedConfirmation || input.confirmation !== expectedConfirmation) operatorInputError(`Type ${expectedConfirmation ?? "the required confirmation"} exactly before continuing.`, "marketplace_offer_status_confirmation_invalid");
  const body: MarketplaceSellerOfferStatusInput = { clientRequestId, offerId, targetStatus: input.targetStatus, confirmation: expectedConfirmation, reason: normalizedOperatorReason(input.reason) };
  const data = await billingFetch("/api/billing/seller/offer-activation", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const envelope = exactRecord(data, ["ok", "offer"], "marketplace_seller_offer_status_invalid");
  const offer = exactRecord(envelope.offer, ["offerId", "status", "offerKind", "idempotentReplay", "testMode", "paymentGrantsTrust", "purchaseInstallsAddon"], "marketplace_seller_offer_status_invalid");
  if (envelope.ok !== true || offer.offerId !== offerId || offer.status !== input.targetStatus || (offer.offerKind !== "free" && offer.offerKind !== "paid") || typeof offer.idempotentReplay !== "boolean" || typeof offer.testMode !== "boolean" || offer.paymentGrantsTrust !== false || offer.purchaseInstallsAddon !== false) {
    throw new BillingRequestError("The offer-status result was invalid. No status change should be assumed.", 503, "marketplace_seller_offer_status_invalid");
  }
  return { offerId, status: input.targetStatus, offerKind: offer.offerKind, paymentGrantsTrust: false, purchaseInstallsAddon: false, testMode: currentBillingApiPublication() !== "live", idempotentReplay: offer.idempotentReplay };
}

export async function loadEconomicOrganizationAccount(accessToken: string): Promise<EconomicOrganizationAccount> {
  const data = await billingFetch("/api/billing/organizations/status", { cache: "no-store" }, accessToken);
  const envelope = exactRecord(data, ["ok", "status"], "economic_organization_status_invalid");
  const statusProjection = exactRecord(envelope.status, ["organizations", "financialDetailsPrivate", "affectsCommonsIdentity", "testMode"], "economic_organization_status_invalid");
  if (envelope.ok !== true || !Array.isArray(statusProjection.organizations) || statusProjection.organizations.length > 1_000 || statusProjection.financialDetailsPrivate !== true || statusProjection.affectsCommonsIdentity !== false || typeof statusProjection.testMode !== "boolean") {
    throw new BillingRequestError("Private organization-service status is unavailable right now.", 503, "economic_organization_status_invalid");
  }
  const relationships = new Set<EconomicOrganizationRelationship>(["owner", "billing_admin", "technical_contact", "procurement_contact", "billing_contact", "authorized_signer", "service_participant"]);
  const statuses = new Set<EconomicOrganizationStatus["status"]>(["pending", "active", "restricted", "closed"]);
  const engagementStatuses = new Set<EconomicOrganizationEngagement["status"]>(["contract_pending", "active", "completed", "canceled", "reconciliation_required"]);
  const sponsorshipStatuses = new Set<EconomicSponsorshipAgreement["status"]>(["ethical_review", "contract_pending", "active", "rejected", "completed", "canceled", "reconciliation_required"]);
  const economicAmount = (value: unknown) => {
    if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 100_000_000_000) throw new BillingRequestError("Private organization-service status is unavailable right now.", 503, "economic_organization_status_invalid");
    return Number(value);
  };
  const economicCurrency = (value: unknown) => {
    const currency = marketplaceString(value, 3, "economic_organization_status_invalid");
    if (!/^[a-z]{3}$/.test(currency)) throw new BillingRequestError("Private organization-service status is unavailable right now.", 503, "economic_organization_status_invalid");
    return currency;
  };
  const organizations = statusProjection.organizations.map((value): EconomicOrganizationStatus => {
    const organization = exactRecord(value, ["organizationId", "accountName", "status", "relationships", "engagements", "sponsorshipAgreements"], "economic_organization_status_invalid");
    const organizationId = marketplaceUuid(organization.organizationId, "economic_organization_status_invalid");
    if (typeof organization.status !== "string" || !statuses.has(organization.status as EconomicOrganizationStatus["status"])
      || !Array.isArray(organization.relationships) || organization.relationships.length > relationships.size || new Set(organization.relationships).size !== organization.relationships.length
      || organization.relationships.some((item) => typeof item !== "string" || !relationships.has(item as EconomicOrganizationRelationship))
      || !Array.isArray(organization.engagements) || organization.engagements.length > 1_000
      || !Array.isArray(organization.sponsorshipAgreements) || organization.sponsorshipAgreements.length > 1_000) throw new BillingRequestError("Private organization-service status is unavailable right now.", 503, "economic_organization_status_invalid");
    const engagements = organization.engagements.map((entry): EconomicOrganizationEngagement => {
      const engagement = exactRecord(entry, ["engagementId", "status", "serviceCode", "statementOfWorkVersion", "serviceTermsVersion", "dataHandlingDisclosureVersion", "amountMinor", "currency", "checkoutAvailable"], "economic_organization_status_invalid");
      const engagementId = marketplaceUuid(engagement.engagementId, "economic_organization_status_invalid");
      const serviceCode = marketplaceString(engagement.serviceCode, 100, "economic_organization_status_invalid");
      if (!/^[a-z][a-z0-9_]{2,100}$/.test(serviceCode) || typeof engagement.status !== "string" || !engagementStatuses.has(engagement.status as EconomicOrganizationEngagement["status"]) || typeof engagement.checkoutAvailable !== "boolean") throw new BillingRequestError("Private organization-service status is unavailable right now.", 503, "economic_organization_status_invalid");
      return { engagementId, serviceCode, status: engagement.status as EconomicOrganizationEngagement["status"], statementOfWorkVersion: marketplaceDocumentVersion(engagement.statementOfWorkVersion, "economic_organization_status_invalid"), serviceTermsVersion: marketplaceDocumentVersion(engagement.serviceTermsVersion, "economic_organization_status_invalid"), dataHandlingDisclosureVersion: marketplaceDocumentVersion(engagement.dataHandlingDisclosureVersion, "economic_organization_status_invalid"), amountMinor: economicAmount(engagement.amountMinor), currency: economicCurrency(engagement.currency), checkoutAvailable: engagement.checkoutAvailable };
    });
    const sponsorshipAgreements = organization.sponsorshipAgreements.map((entry): EconomicSponsorshipAgreement => {
      const agreement = exactRecord(entry, ["agreementId", "status", "agreementVersion", "disclosureVersion", "amountMinor", "currency", "publicRecognitionOptIn", "publicRecognitionApproved", "checkoutAvailable", "recognitionPreferenceAvailable"], "economic_organization_status_invalid");
      if (typeof agreement.status !== "string" || !sponsorshipStatuses.has(agreement.status as EconomicSponsorshipAgreement["status"]) || typeof agreement.publicRecognitionOptIn !== "boolean" || typeof agreement.publicRecognitionApproved !== "boolean" || typeof agreement.checkoutAvailable !== "boolean" || typeof agreement.recognitionPreferenceAvailable !== "boolean") throw new BillingRequestError("Private sponsorship status is unavailable right now.", 503, "economic_organization_status_invalid");
      return { agreementId: marketplaceUuid(agreement.agreementId, "economic_organization_status_invalid"), status: agreement.status as EconomicSponsorshipAgreement["status"], agreementVersion: marketplaceDocumentVersion(agreement.agreementVersion, "economic_organization_status_invalid"), disclosureVersion: marketplaceDocumentVersion(agreement.disclosureVersion, "economic_organization_status_invalid"), amountMinor: economicAmount(agreement.amountMinor), currency: economicCurrency(agreement.currency), publicRecognitionOptIn: agreement.publicRecognitionOptIn, publicRecognitionApproved: agreement.publicRecognitionApproved, checkoutAvailable: agreement.checkoutAvailable, recognitionPreferenceAvailable: agreement.recognitionPreferenceAvailable };
    });
    return { organizationId, accountName: marketplaceString(organization.accountName, 200, "economic_organization_status_invalid"), status: organization.status as EconomicOrganizationStatus["status"], relationships: organization.relationships as EconomicOrganizationRelationship[], engagements, sponsorshipAgreements };
  });
  return { organizations, financialDetailsPrivate: true, affectsCommonsIdentity: false, testMode: currentBillingApiPublication() !== "live" };
}

function verifiedStripeCheckoutUrl(value: unknown, errorCode: string) {
  const checkoutUrl = safeInternalOrStripeUrl(value);
  if (!checkoutUrl) throw new BillingRequestError("The server did not return a safe Stripe-hosted test checkout. No payment should be assumed.", 503, errorCode);
  const parsed = new URL(checkoutUrl);
  if (parsed.protocol !== "https:" || parsed.hostname !== "checkout.stripe.com" || parsed.port || parsed.username || parsed.password) {
    throw new BillingRequestError("The server did not return a safe Stripe-hosted test checkout. No payment should be assumed.", 503, errorCode);
  }
  return checkoutUrl;
}

function verifiedCheckoutReference(value: unknown, errorCode: string) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{24,160}$/.test(value)) throw new BillingRequestError("The checkout reference was invalid. No payment should be assumed.", 503, errorCode);
  return value;
}

export async function createOrganizationServiceCheckout(input: OrganizationServiceCheckoutInput, accessToken: string): Promise<OrganizationServiceCheckoutResult> {
  const engagementId = normalizedOperatorUuid(input.engagementId, "Organization-service engagement ID");
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  if (input.sourceRoute !== "/commons-circle/support-billing") operatorInputError("Organization-service checkout must begin from the private Support & Billing room.", "source_route_invalid");
  const legalBundleVersion = marketplaceDocumentVersion(input.legalBundleVersion, "organization_service_legal_bundle_invalid");
  const statementOfWorkVersion = marketplaceDocumentVersion(input.statementOfWorkVersion, "organization_statement_of_work_version_invalid");
  const serviceTermsVersion = marketplaceDocumentVersion(input.serviceTermsVersion, "organization_service_terms_version_invalid");
  const dataHandlingDisclosureVersion = marketplaceDocumentVersion(input.dataHandlingDisclosureVersion, "organization_data_disclosure_version_invalid");
  const body: OrganizationServiceCheckoutInput = { engagementId, clientRequestId, sourceRoute: "/commons-circle/support-billing", legalBundleVersion, statementOfWorkVersion, serviceTermsVersion, dataHandlingDisclosureVersion };
  const data = await billingFetch("/api/billing/organizations/checkout", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const result = exactRecord(data, ["ok", "checkoutUrl", "orderReference", "engagementId", "paymentGrantsAuthority", "testMode"], "organization_service_checkout_invalid");
  if (result.ok !== true || result.engagementId !== engagementId || result.paymentGrantsAuthority !== false || typeof result.testMode !== "boolean") {
    throw new BillingRequestError("The organization-service checkout result was invalid. No payment or service activation should be assumed.", 503, "organization_service_checkout_invalid");
  }
  return { checkoutUrl: verifiedStripeCheckoutUrl(result.checkoutUrl, "organization_service_checkout_invalid"), orderReference: verifiedCheckoutReference(result.orderReference, "organization_service_checkout_invalid"), engagementId, paymentGrantsAuthority: false, testMode: currentBillingApiPublication() !== "live" };
}

export async function createSponsorshipCheckout(input: SponsorshipCheckoutInput, accessToken: string): Promise<SponsorshipCheckoutResult> {
  const sponsorshipAgreementId = normalizedOperatorUuid(input.sponsorshipAgreementId, "Sponsorship agreement ID");
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  if (input.sourceRoute !== "/commons-circle/support-billing") operatorInputError("Sponsorship checkout must begin from the private Support & Billing room.", "source_route_invalid");
  const legalBundleVersion = marketplaceDocumentVersion(input.legalBundleVersion, "sponsorship_legal_bundle_invalid");
  const agreementVersion = marketplaceDocumentVersion(input.agreementVersion, "sponsorship_agreement_version_invalid");
  const disclosureVersion = marketplaceDocumentVersion(input.disclosureVersion, "sponsorship_disclosure_version_invalid");
  const body: SponsorshipCheckoutInput = { sponsorshipAgreementId, clientRequestId, sourceRoute: "/commons-circle/support-billing", legalBundleVersion, agreementVersion, disclosureVersion };
  const data = await billingFetch("/api/billing/sponsorships/checkout", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const result = exactRecord(data, ["ok", "checkoutUrl", "orderReference", "sponsorshipAgreementId", "paymentGrantsAuthority", "testMode"], "sponsorship_checkout_invalid");
  if (result.ok !== true || result.sponsorshipAgreementId !== sponsorshipAgreementId || result.paymentGrantsAuthority !== false || typeof result.testMode !== "boolean") {
    throw new BillingRequestError("The sponsorship checkout result was invalid. No payment, recognition, or authority should be assumed.", 503, "sponsorship_checkout_invalid");
  }
  return { checkoutUrl: verifiedStripeCheckoutUrl(result.checkoutUrl, "sponsorship_checkout_invalid"), orderReference: verifiedCheckoutReference(result.orderReference, "sponsorship_checkout_invalid"), sponsorshipAgreementId, paymentGrantsAuthority: false, testMode: currentBillingApiPublication() !== "live" };
}

export async function setSponsorshipRecognitionPreference(input: SponsorshipRecognitionPreferenceInput, accessToken: string): Promise<SponsorshipRecognitionPreferenceResult> {
  const sponsorshipAgreementId = normalizedOperatorUuid(input.sponsorshipAgreementId, "Sponsorship agreement ID");
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  if (input.sourceRoute !== "/commons-circle/support-billing") operatorInputError("Sponsorship recognition preference must begin from the private Support & Billing room.", "source_route_invalid");
  const agreementVersion = marketplaceDocumentVersion(input.agreementVersion, "sponsorship_agreement_version_invalid");
  const disclosureVersion = marketplaceDocumentVersion(input.disclosureVersion, "sponsorship_disclosure_version_invalid");
  const confirmation = input.optedIn ? "PUBLISH NEUTRAL SPONSORSHIP RECOGNITION" : "REMOVE NEUTRAL SPONSORSHIP RECOGNITION";
  if (input.confirmation !== confirmation) operatorInputError(`Type ${confirmation} exactly before continuing.`, "sponsorship_recognition_confirmation_invalid");
  const body: SponsorshipRecognitionPreferenceInput = { sponsorshipAgreementId, clientRequestId, optedIn: input.optedIn, sourceRoute: "/commons-circle/support-billing", agreementVersion, disclosureVersion, confirmation };
  const data = await billingFetch("/api/billing/sponsorships/preference", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const recognition = operatorMutationEnvelope(data, "recognition", ["sponsorshipAgreementId", "publicRecognitionOptIn", "amountsPublic", "grantsAuthority", "testMode", "idempotentReplay"], "sponsorship_recognition_preference_invalid");
  if (recognition.sponsorshipAgreementId !== sponsorshipAgreementId || recognition.publicRecognitionOptIn !== input.optedIn || recognition.amountsPublic !== false || recognition.grantsAuthority !== false || typeof recognition.testMode !== "boolean" || typeof recognition.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The sponsorship-recognition preference result was invalid. No public display change should be assumed.", 503, "sponsorship_recognition_preference_invalid");
  }
  return { sponsorshipAgreementId, publicRecognitionOptIn: input.optedIn, amountsPublic: false, grantsAuthority: false, testMode: currentBillingApiPublication() !== "live", idempotentReplay: recognition.idempotentReplay };
}

export async function loadPublicSponsorshipRecognition(): Promise<SponsorshipRecognitionCatalog> {
  const data = await billingFetch("/api/billing/sponsorships/recognition", { cache: "no-store" });
  const envelope = exactRecord(data, ["ok", "recognition"], "sponsorship_recognition_invalid");
  const recognition = exactRecord(envelope.recognition, ["enabled", "recognitions", "paymentGrantsAuthority"], "sponsorship_recognition_invalid");
  if (envelope.ok !== true || typeof recognition.enabled !== "boolean" || !Array.isArray(recognition.recognitions) || recognition.recognitions.length > 1_000 || recognition.paymentGrantsAuthority !== false) throw new BillingRequestError("Public sponsorship acknowledgments are unavailable right now.", 503, "sponsorship_recognition_invalid");
  const recognitions = recognition.recognitions.map((value): PublicSponsorshipRecognition => {
    const item = exactRecord(value, ["label", "summary", "purposeCode", "grantsAuthority", "isEndorsement"], "sponsorship_recognition_invalid");
    const label = marketplaceString(item.label, 120, "sponsorship_recognition_invalid");
    const purposeCode = marketplaceString(item.purposeCode, 100, "sponsorship_recognition_invalid");
    const summary = item.summary === null ? null : marketplaceString(item.summary, 500, "sponsorship_recognition_invalid");
    if (label.trim().length < 2 || !/^[a-z][a-z0-9_]{2,100}$/.test(purposeCode) || item.grantsAuthority !== false || item.isEndorsement !== false) throw new BillingRequestError("Public sponsorship acknowledgments are unavailable right now.", 503, "sponsorship_recognition_invalid");
    return { label, summary, purposeCode, grantsAuthority: false, isEndorsement: false };
  });
  if (!recognition.enabled && recognitions.length) throw new BillingRequestError("Public sponsorship acknowledgments are unavailable right now.", 503, "sponsorship_recognition_invalid");
  return { enabled: recognition.enabled, recognitions, paymentGrantsAuthority: false };
}

export async function loadPublicSupportRecognition(): Promise<SupportRecognitionCatalog> {
  const data = await billingFetch("/api/billing/support-recognition", { cache: "no-store" });
  const envelope = exactRecord(data, ["ok", "recognition"], "support_recognition_invalid");
  const recognition = exactRecord(envelope.recognition, ["enabled", "supporters", "ranked", "amountsPublic", "paymentGrantsAuthority"], "support_recognition_invalid");
  if (envelope.ok !== true || typeof recognition.enabled !== "boolean" || !Array.isArray(recognition.supporters) || recognition.supporters.length > 1_000
    || recognition.ranked !== false || recognition.amountsPublic !== false || recognition.paymentGrantsAuthority !== false) {
    throw new BillingRequestError("Public support acknowledgments are unavailable right now.", 503, "support_recognition_invalid");
  }
  const seen = new Set<string>();
  const supporters = recognition.supporters.map((value): PublicSupportRecognition => {
    const supporter = exactRecord(value, ["username", "displayName", "grantsAuthority", "amountPublic"], "support_recognition_invalid");
    const username = marketplaceString(supporter.username, 80, "support_recognition_invalid");
    const displayName = marketplaceString(supporter.displayName, 200, "support_recognition_invalid");
    if (!username || seen.has(username) || !displayName.trim() || supporter.grantsAuthority !== false || supporter.amountPublic !== false) {
      throw new BillingRequestError("Public support acknowledgments are unavailable right now.", 503, "support_recognition_invalid");
    }
    seen.add(username);
    return { username, displayName, grantsAuthority: false, amountPublic: false };
  });
  if (!recognition.enabled && supporters.length) throw new BillingRequestError("Public support acknowledgments are unavailable right now.", 503, "support_recognition_invalid");
  return { enabled: recognition.enabled, supporters, ranked: false, amountsPublic: false, paymentGrantsAuthority: false };
}

export async function createSupportCheckout(request: CheckoutRequest, accessToken?: string | null): Promise<CheckoutResult> {
  const path = request.cadence === "monthly" ? "/api/billing/recurring-checkout" : "/api/billing/checkout";
  if (request.cadence === "monthly" && !request.priceCode) {
    throw new BillingRequestError("Choose one of the fixed monthly support options before continuing.", 400, "price_code_required");
  }
  const body = request.cadence === "monthly"
    ? {
        clientRequestId: request.clientRequestId,
        priceCode: request.priceCode,
        sourceRoute: request.sourceRoute,
        consentVersion: request.consentVersion
      }
    : {
        clientRequestId: request.clientRequestId,
        amountMinor: request.amountCents,
        currency: "usd",
        sourceRoute: request.sourceRoute,
        consentVersion: request.consentVersion
      };
  const data = await billingFetch(path, {
    method: "POST",
    body: JSON.stringify(body)
  }, accessToken);
  let checkoutUrl: string | null = null;
  try { checkoutUrl = verifiedStripeCheckoutUrl(data.checkoutUrl ?? data.checkout_url ?? data.url, "support_checkout_invalid"); }
  catch { checkoutUrl = null; }
  return {
    ok: Boolean(checkoutUrl),
    checkoutUrl,
    reference: nullableString(data.orderReference ?? data.reference ?? data.order_reference),
    message: checkoutUrl
      ? "Opening Stripe-hosted checkout. Payment details are entered on Stripe, not on Elysia Ecobotics Online."
      : "Checkout was not created because the server did not return a safe Stripe-hosted destination."
  };
}

export async function loadBillingOrder(reference: string, accessToken?: string | null): Promise<BillingOrderSummary> {
  if (!/^[A-Za-z0-9_-]{24,160}$/.test(reference)) {
    return { flow: null, status: "unknown", cadence: null, createdAt: null, verifiedAt: null, message: "No valid private order reference was provided." };
  }
  try {
    const data = await billingFetch(`/api/billing/order?reference=${encodeURIComponent(reference)}`, {}, accessToken);
    const envelope = exactRecord(data, ["ok", "order"], "billing_order_invalid");
    if (envelope.ok !== true || !isRecord(envelope.order)) {
      throw new BillingRequestError("The private order response was invalid. No completed result should be assumed.", 503, "billing_order_invalid");
    }
    const source = envelope.order;
    const baseKeys = ["publicReference", "flow", "cadence", "status", "createdAt", "paidAt", "failedAt", "refundedAt", "testMode"] as const;
    const hasAmount = Object.prototype.hasOwnProperty.call(source, "amountMinor");
    const hasCurrency = Object.prototype.hasOwnProperty.call(source, "currency");
    exactRecord(source, hasAmount || hasCurrency ? [...baseKeys, "amountMinor", "currency"] : baseKeys, "billing_order_invalid");
    const flow = strictBillingOrderFlow(source.flow);
    const rawStatus = source.status;
    if (typeof rawStatus !== "string" || !new Set(["pending", "checkout_created", "processing", "paid", "failed", "canceled", "partially_refunded", "refunded", "disputed"]).has(rawStatus)) {
      throw new BillingRequestError("The private order returned an invalid state. No completed result should be assumed.", 503, "billing_order_status_invalid");
    }
    const expectedCadence: SupportCadence = flow === "support_recurring" ? "monthly" : "one_time";
    if (source.publicReference !== reference || source.cadence !== expectedCadence || typeof source.testMode !== "boolean") {
      throw new BillingRequestError("The private order response did not match the requested test-mode order. No completed result should be assumed.", 503, "billing_order_invalid");
    }
    if (hasAmount !== hasCurrency || (hasAmount && (!Number.isSafeInteger(source.amountMinor) || Number(source.amountMinor) < 1 || Number(source.amountMinor) > 100_000_000_000 || typeof source.currency !== "string" || !/^[a-z]{3}$/.test(source.currency)))) {
      throw new BillingRequestError("The private order returned an invalid amount summary. No completed result should be assumed.", 503, "billing_order_invalid");
    }
    const status = normalizeOrderStatus(rawStatus);
    const createdAt = strictBillingOrderTimestamp(source.createdAt, false, "billing_order_created_at_invalid");
    const paidAt = strictBillingOrderTimestamp(source.paidAt, true, "billing_order_paid_at_invalid");
    strictBillingOrderTimestamp(source.failedAt, true, "billing_order_failed_at_invalid");
    strictBillingOrderTimestamp(source.refundedAt, true, "billing_order_refunded_at_invalid");
    const defaults: Record<BillingOrderStatus, string> = {
      processing: "Stripe checkout has returned, but server-side verification is still processing. Do not retry unless this state remains unchanged.",
      verified: "The server has verified the private economic order.",
      canceled: "Checkout was canceled or left incomplete. No completed payment or service fulfillment is being claimed.",
      failed: "The payment could not be verified. Review Stripe's message or contact support before trying again.",
      refunded: "The server record shows that this payment was refunded or partially refunded. Consult the private billing record or support for details.",
      disputed: "The server record shows a payment dispute. No entitlement or community-status conclusion is being made on this page.",
      unavailable: "Order verification is temporarily unavailable. No payment result is being claimed.",
      unknown: "The server could not confirm a payment result from this reference. No payment success is being claimed."
    };
    return {
      flow,
      status,
      cadence: expectedCadence,
      createdAt,
      verifiedAt: paidAt,
      message: safeServerMessage(source.message, defaults[status])
    };
  } catch (error) {
    return { flow: null, status: "unavailable", cadence: null, createdAt: null, verifiedAt: null, message: billingErrorMessage(error) };
  }
}

function normalizeSupportHistory(value: unknown): SupportHistoryItem[] {
  return boundedAccountArray(value, "billing_account_orders_invalid").flatMap((item, index) => {
    if (!isRecord(item)) return [];
    return [{
      id: stringValue(item.id ?? item.publicReference ?? item.reference, `support-${index}`),
      status: stringValue(item.status, "unknown").replace(/_/g, " "),
      amountCents: numberValue(item.amountMinor ?? item.amount_cents ?? item.amount),
      currency: stringValue(item.currency, "usd").toUpperCase(),
      cadence: normalizeCadence(item.cadence ?? item.flow ?? item.support_kind),
      createdAt: nullableString(item.createdAt ?? item.created_at)
    }];
  });
}

export function normalizeReceipts(value: unknown): ReceiptSummary[] {
  const receiptFlows = new Set(["support_one_time", "support_recurring", "sandbox_credits", "job_post_fee", "marketplace_purchase", "organization_service", "sponsorship"]);
  const receiptStatuses = new Set(["pending", "succeeded", "failed", "canceled", "refunded", "disputed"]);
  const flowLabels: Record<string, string> = {
    support_one_time: "One-time support",
    support_recurring: "Recurring support",
    sandbox_credits: "Sandbox service credits",
    job_post_fee: "Job Post fee",
    marketplace_purchase: "Marketplace license",
    organization_service: "Organization service",
    sponsorship: "Sponsorship"
  };
  const receipts = boundedAccountArray(value, "billing_account_receipts_invalid");
  if (receipts.length > 100) accountProjectionError("billing_account_receipts_invalid");
  const seen = new Set<string>();
  return receipts.map((item): ReceiptSummary => {
    const enhanced = isRecord(item) && item.recordVersion === "payment-record-v1";
    const receipt = exactRecord(item, ["transactionId", "publicReference", "flow", "status", "amountMinor", "currency", "occurredAt", "receiptAvailable", "providerIdentifiersExposed", ...(enhanced ? ["recordVersion", "payee", "orderStatus", "refundedAmountMinor", ...(isRecord(item) && "receiptUrl" in item ? ["receiptUrl", "testMode"] : [])] : [])], "billing_account_receipts_invalid");
    const transactionId = marketplaceUuid(receipt.transactionId, "billing_account_receipts_invalid");
    const publicReference = marketplaceString(receipt.publicReference, 160, "billing_account_receipts_invalid");
    const flow = marketplaceString(receipt.flow, 40, "billing_account_receipts_invalid");
    const status = marketplaceString(receipt.status, 40, "billing_account_receipts_invalid");
    const currency = marketplaceString(receipt.currency, 3, "billing_account_receipts_invalid");
    const occurredAt = marketplaceString(receipt.occurredAt, 40, "billing_account_receipts_invalid");
    if (seen.has(transactionId) || !/^[A-Za-z0-9_-]{24,160}$/.test(publicReference) || !receiptFlows.has(flow) || !receiptStatuses.has(status)
      || !Number.isSafeInteger(receipt.amountMinor) || Number(receipt.amountMinor) < 0 || Number(receipt.amountMinor) > 100_000_000_000
      || !/^[a-z]{3}$/.test(currency) || Number.isNaN(Date.parse(occurredAt))
      || (receipt.receiptAvailable !== false && !(typeof receipt.receiptUrl === "string" && /^https:\/\/pay\.stripe\.com\//.test(receipt.receiptUrl))) || receipt.providerIdentifiersExposed !== false) {
      accountProjectionError("billing_account_receipts_invalid");
    }
    seen.add(transactionId);
    const payee = enhanced ? receipt.payee === null ? null : marketplaceString(receipt.payee, 200, "billing_account_receipts_invalid") : flow === "marketplace_purchase" ? null : "EcoSyneva Commons LLC";
    const orderStatus = enhanced ? marketplaceString(receipt.orderStatus, 40, "billing_account_receipts_invalid") : null;
    const orderStatuses = new Set(["pending", "checkout_created", "processing", "paid", "failed", "canceled", "partially_refunded", "refunded", "disputed"]);
    if (enhanced && (!orderStatuses.has(orderStatus!) || !Number.isSafeInteger(receipt.refundedAmountMinor)
      || Number(receipt.refundedAmountMinor) < 0 || Number(receipt.refundedAmountMinor) > Number(receipt.amountMinor)
      || /(?:sk_|whsec_|acct_|cus_|pi_|ch_|https?:|[\u0000-\u001f])/.test(payee ?? ""))) accountProjectionError("billing_account_receipts_invalid");
    return { id: transactionId, publicReference, flow: flow as BillingOrderFlow, status, payee,
      cadence: flow === "support_recurring" ? "monthly" : "one_time", orderStatus,
      refundedAmountCents: enhanced ? Number(receipt.refundedAmountMinor) : null,
      label: `${flowLabels[flow]} · ${status.replace(/_/g, " ")}`, amountCents: Number(receipt.amountMinor), currency: currency.toUpperCase(), createdAt: occurredAt, receiptAvailable: receipt.receiptAvailable === true, receiptUrl: typeof receipt.receiptUrl === "string" ? receipt.receiptUrl : null, testMode: receipt.testMode !== false };
  });
}

function normalizeAccountWarnings(value: unknown): string[] {
  const warningGuidance = {
    order_failed: "Review the failed checkout or begin a new checkout. Community standing is unchanged.",
    subscription_attention_required: "Open billing management to review or cancel recurring support. Community standing is unchanged.",
    marketplace_fulfillment_review: "Payment completed, but Marketplace fulfillment was safely held for private review and refund. No add-on was installed and community standing is unchanged.",
    job_post_payment_review: "Payment completed after the Job Post was no longer eligible. Publication was withheld and a private full-refund review is required; community standing is unchanged.",
    organization_service_payment_review: "Payment settled after the organization service engagement became ineligible or terminal. Service activation was withheld and a private full-refund review is required; community standing is unchanged.",
    sponsorship_payment_review: "Payment settled after the sponsorship agreement became ineligible or terminal. Sponsorship activation and recognition were withheld and a private full-refund review is required; community standing is unchanged."
  } as const;
  const warnings = boundedAccountArray(value, "billing_account_warnings_invalid");
  if (warnings.length > 40) accountProjectionError("billing_account_warnings_invalid");
  return warnings.map((item) => {
    if (!isRecord(item) || typeof item.code !== "string" || !(item.code in warningGuidance)) accountProjectionError("billing_account_warnings_invalid");
    const code = item.code as keyof typeof warningGuidance;
    const expectedKeys = code !== "subscription_attention_required" ? ["code", "publicReference", "guidance"] : ["code", "guidance"];
    const warning = exactRecord(item, expectedKeys, "billing_account_warnings_invalid");
    if (warning.guidance !== warningGuidance[code]) accountProjectionError("billing_account_warnings_invalid");
    if (code !== "subscription_attention_required" && (typeof warning.publicReference !== "string" || !/^[A-Za-z0-9_-]{24,160}$/.test(warning.publicReference))) {
      accountProjectionError("billing_account_warnings_invalid");
    }
    return warningGuidance[code];
  });
}

function normalizeMarketplacePurchases(value: unknown): MarketplacePurchaseSummary[] {
  const finalProjection = isRecord(value);
  const rawLicenses = finalProjection ? value.licenses : value;
  if (finalProjection && typeof value.testMode !== "boolean") accountProjectionError("billing_account_marketplace_invalid");
  return boundedAccountArray(rawLicenses, "billing_account_marketplace_invalid").flatMap((item, index) => {
    if (!isRecord(item)) return [];
    if (finalProjection) {
      const licenseId = marketplaceUuid(item.licenseId, "billing_account_marketplace_invalid");
      marketplaceUuid(item.listingId, "billing_account_marketplace_invalid");
      marketplaceUuid(item.addonVersionId, "billing_account_marketplace_invalid");
      const listingName = marketplaceString(item.listingName, 300, "billing_account_marketplace_invalid");
      const economicStatus = marketplaceString(item.economicStatus, 40, "billing_account_marketplace_invalid");
      const acquiredAt = marketplaceString(item.acquiredAt, 40, "billing_account_marketplace_invalid");
      if (!marketplaceEconomicStatusPattern.test(economicStatus) || Number.isNaN(Date.parse(acquiredAt))) accountProjectionError("billing_account_marketplace_invalid");
      return [{ id: licenseId, label: listingName, status: economicStatus.replace(/_/g, " "), purchasedAt: acquiredAt }];
    }
    return [{
      id: stringValue(item.id, `purchase-${index}`),
      label: stringValue(item.label ?? item.addon_name, "Marketplace purchase"),
      status: stringValue(item.status, "unknown").replace(/_/g, " "),
      purchasedAt: nullableString(item.purchasedAt ?? item.createdAt ?? item.purchased_at ?? item.created_at)
    }];
  });
}

function normalizeJobPostPayments(value: unknown): JobPostPaymentSummary[] {
  return boundedAccountArray(value, "billing_account_job_posts_invalid").flatMap((item, index) => {
    if (!isRecord(item)) return [];
    if (Object.prototype.hasOwnProperty.call(item, "jobPostId")) {
      const id = marketplaceUuid(item.jobPostId, "billing_account_job_posts_invalid");
      const classification = marketplaceString(item.classification, 120, "billing_account_job_posts_invalid");
      const status = marketplaceString(item.status, 40, "billing_account_job_posts_invalid");
      if (!marketplaceEconomicStatusPattern.test(status)) accountProjectionError("billing_account_job_posts_invalid");
      return [{ id, label: `Job Post · ${classification.replace(/_/g, " ")}`, status: status.replace(/_/g, " "), updatedAt: null }];
    }
    return [{
      id: stringValue(item.id, `job-${index}`),
      label: stringValue(item.label ?? item.role_title, "Job Post fee"),
      status: stringValue(item.status, "unknown").replace(/_/g, " "),
      updatedAt: nullableString(item.updatedAt ?? item.createdAt ?? item.updated_at ?? item.created_at)
    }];
  });
}

function accountProjectionError(code: string): never {
  throw new BillingRequestError("The private economic account summary was invalid. No absence, balance, status, or completed action should be assumed.", 503, code);
}

function boundedAccountArray(value: unknown, code: string): unknown[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 200) accountProjectionError(code);
  return value;
}

function requiredAccountBoolean(value: unknown, code: string): boolean {
  if (typeof value !== "boolean") accountProjectionError(code);
  return value;
}

function boundedAccountNumber(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 1_000_000_000_000) accountProjectionError(code);
  return value;
}

function normalizeFinalSandboxSummary(value: unknown): SandboxCreditSummary | null {
  if (!isRecord(value)) return null;
  if (value.available !== true || value.mode !== "test" || value.test_mode !== true) accountProjectionError("billing_account_sandbox_invalid");
  return {
    displayEnabled: requiredAccountBoolean(value.display_enabled, "billing_account_sandbox_invalid"),
    availableCredits: boundedAccountNumber(value.available_credits, "billing_account_sandbox_invalid"),
    purchasedCredits: boundedAccountNumber(value.purchased_credits, "billing_account_sandbox_invalid"),
    sponsoredCredits: boundedAccountNumber(value.sponsored_credits, "billing_account_sandbox_invalid"),
    waivedCredits: boundedAccountNumber(value.waived_credits, "billing_account_sandbox_invalid")
  };
}

const economicAccountRequestTypes = new Set<EconomicAccountRequestType>(["data_export", "economic_account_closure"]);
const economicAccountRequestStatuses = new Set<EconomicAccountRequestStatus>(["submitted", "identity_verification", "operator_review", "processing", "completed", "rejected", "canceled"]);

function normalizeEconomicAccountRequests(value: unknown): EconomicAccountRequestSummary[] {
  const seen = new Set<string>();
  return boundedAccountArray(value, "billing_account_requests_invalid").map((item): EconomicAccountRequestSummary => {
    const request = exactRecord(item, ["requestId", "requestType", "status", "submittedAt", "providerCancellationRequired", "financialRecordsRetained", "authProfileUnchanged"], "billing_account_requests_invalid");
    const requestId = marketplaceUuid(request.requestId, "billing_account_requests_invalid");
    const requestType = request.requestType as EconomicAccountRequestType;
    const status = request.status as EconomicAccountRequestStatus;
    const submittedAt = marketplaceString(request.submittedAt, 40, "billing_account_requests_invalid");
    if (seen.has(requestId) || !economicAccountRequestTypes.has(requestType) || !economicAccountRequestStatuses.has(status)
      || Number.isNaN(Date.parse(submittedAt)) || typeof request.providerCancellationRequired !== "boolean"
      || request.financialRecordsRetained !== true || request.authProfileUnchanged !== true) {
      accountProjectionError("billing_account_requests_invalid");
    }
    seen.add(requestId);
    return { requestId, requestType, status, submittedAt, providerCancellationRequired: request.providerCancellationRequired, financialRecordsRetained: true, authProfileUnchanged: true };
  });
}

function normalizeEconomicRecognition(value: unknown): EconomicSupportRecognitionSummary | null {
  if (value === undefined || value === null) return null;
  const recognition = exactRecord(value, ["optedIn", "eligible", "eligibilityRevokedAt", "eligibilityExpiresAt", "publicDisplayEnabled", "amountsPublic", "grantsAuthority"], "billing_account_recognition_invalid");
  const eligibilityRevokedAt = recognition.eligibilityRevokedAt === null ? null : marketplaceString(recognition.eligibilityRevokedAt, 40, "billing_account_recognition_invalid");
  const eligibilityExpiresAt = recognition.eligibilityExpiresAt === null ? null : marketplaceString(recognition.eligibilityExpiresAt, 40, "billing_account_recognition_invalid");
  if ((eligibilityRevokedAt !== null && Number.isNaN(Date.parse(eligibilityRevokedAt)))
    || (eligibilityExpiresAt !== null && Number.isNaN(Date.parse(eligibilityExpiresAt)))) accountProjectionError("billing_account_recognition_invalid");
  return {
    optedIn: requiredAccountBoolean(recognition.optedIn, "billing_account_recognition_invalid"),
    eligible: requiredAccountBoolean(recognition.eligible, "billing_account_recognition_invalid"),
    eligibilityRevokedAt,
    eligibilityExpiresAt,
    publicDisplayEnabled: requiredAccountBoolean(recognition.publicDisplayEnabled, "billing_account_recognition_invalid"),
    amountsPublic: recognition.amountsPublic === false ? false : accountProjectionError("billing_account_recognition_invalid"),
    grantsAuthority: recognition.grantsAuthority === false ? false : accountProjectionError("billing_account_recognition_invalid")
  };
}

function normalizeEconomicAssistance(value: unknown): EconomicAssistanceSummary[] {
  return boundedAccountArray(value, "billing_account_assistance_invalid").map((item): EconomicAssistanceSummary => {
    const assistance = exactRecord(item, ["scope", "status", "expiresAt", "publiclyVisible"], "billing_account_assistance_invalid");
    const scope = marketplaceString(assistance.scope, 100, "billing_account_assistance_invalid");
    const status = marketplaceString(assistance.status, 40, "billing_account_assistance_invalid");
    const expiresAt = assistance.expiresAt === null ? null : marketplaceString(assistance.expiresAt, 40, "billing_account_assistance_invalid");
    if (!marketplaceEconomicStatusPattern.test(status) || (expiresAt !== null && Number.isNaN(Date.parse(expiresAt))) || assistance.publiclyVisible !== false) accountProjectionError("billing_account_assistance_invalid");
    return { scope, status, expiresAt, publiclyVisible: false };
  });
}

function normalizeEconomicRestrictions(value: unknown): EconomicServiceRestrictionSummary[] {
  return boundedAccountArray(value, "billing_account_restrictions_invalid").map((item): EconomicServiceRestrictionSummary => {
    const restriction = exactRecord(item, ["scope", "reasonCode", "expiresAt"], "billing_account_restrictions_invalid");
    const scope = marketplaceString(restriction.scope, 100, "billing_account_restrictions_invalid");
    const reasonCode = marketplaceString(restriction.reasonCode, 120, "billing_account_restrictions_invalid");
    const expiresAt = restriction.expiresAt === null ? null : marketplaceString(restriction.expiresAt, 40, "billing_account_restrictions_invalid");
    if (expiresAt !== null && Number.isNaN(Date.parse(expiresAt))) accountProjectionError("billing_account_restrictions_invalid");
    return { scope, reasonCode, expiresAt };
  });
}

const economicClosureCountKeys = [
  "activeSubscriptions", "unsettledOrders", "openRefunds", "openDisputes",
  "openReconciliationCases", "pendingSellerPayouts", "sellerPayableObligations",
  "pendingMarketplaceFulfillment", "pendingJobPostFulfillment", "organizationSignerDuties",
  "sponsorshipSignerDuties"
] as const;

function normalizeEconomicClosureReadiness(value: unknown): EconomicClosureReadiness {
  const readiness = exactRecord(value, [
    "canComplete", "blockingCount", "activeSubscriptions", "scheduledSubscriptionCancellations", "unsettledOrders",
    "openRefunds", "openDisputes", "openReconciliationCases", "pendingSellerPayouts", "sellerPayableObligations",
    "pendingMarketplaceFulfillment", "pendingJobPostFulfillment", "organizationSignerDuties", "sponsorshipSignerDuties",
    "preservesEarnedLicenses", "preservesRemainingSandboxCredits", "financialRecordsRetained", "authProfileUnchanged", "guidance"
  ], "billing_account_closure_readiness_invalid");
  const count = (key: string) => {
    const candidate = readiness[key];
    if (!Number.isSafeInteger(candidate) || Number(candidate) < 0 || Number(candidate) > 1_000_000_000) accountProjectionError("billing_account_closure_readiness_invalid");
    return Number(candidate);
  };
  const counts = Object.fromEntries(economicClosureCountKeys.map((key) => [key, count(key)])) as Record<typeof economicClosureCountKeys[number], number>;
  const blockingCount = count("blockingCount");
  const scheduledSubscriptionCancellations = count("scheduledSubscriptionCancellations");
  if (typeof readiness.canComplete !== "boolean" || readiness.canComplete !== (blockingCount === 0)
    || Object.values(counts).reduce((sum, candidate) => sum + candidate, 0) !== blockingCount
    || readiness.preservesEarnedLicenses !== true || readiness.preservesRemainingSandboxCredits !== true
    || readiness.financialRecordsRetained !== true || readiness.authProfileUnchanged !== true
    || !Array.isArray(readiness.guidance) || readiness.guidance.length !== 3
    || readiness.guidance.some((item) => typeof item !== "string" || item.length < 1 || item.length > 300 || /[\u0000-\u001f\u007f]/.test(item))) {
    accountProjectionError("billing_account_closure_readiness_invalid");
  }
  return {
    canComplete: readiness.canComplete,
    blockingCount,
    scheduledSubscriptionCancellations,
    ...counts,
    preservesEarnedLicenses: true,
    preservesRemainingSandboxCredits: true,
    financialRecordsRetained: true,
    authProfileUnchanged: true,
    guidance: readiness.guidance as [string, string, string]
  };
}

function normalizeFinalSellerSummary(value: unknown): SellerFinanceSummary | null {
  if (!isRecord(value)) return null;
  const seller = exactRecord(value, ["eligible", "configured", "status", "detailsSubmitted", "chargesEnabled", "payoutsEnabled", "sellerAgreementVersion", "freeSellerAgreementVersion", "stripeConnectDisclosureVersion", "activeOfferCount", "availablePayableByCurrency", "payableByCurrency", "payoutPreparationEnabled", "payoutsEnabledByFeature", "payoutExecutionAvailable", "balancesAreTestRecords", "providerIdentifiersExposed", "testMode"], "billing_account_seller_invalid");
  const status = marketplaceString(seller.status, 40, "billing_account_seller_invalid");
  const availablePayable = exactRecord(seller.availablePayableByCurrency, Object.keys(isRecord(seller.availablePayableByCurrency) ? seller.availablePayableByCurrency : {}), "billing_account_seller_invalid");
  const compatibilityPayable = exactRecord(seller.payableByCurrency, Object.keys(isRecord(seller.payableByCurrency) ? seller.payableByCurrency : {}), "billing_account_seller_invalid");
  const payableByCurrency: Record<string, number> = {};
  if (Object.keys(availablePayable).length > 20 || Object.keys(compatibilityPayable).length !== Object.keys(availablePayable).length) accountProjectionError("billing_account_seller_invalid");
  for (const [currency, amount] of Object.entries(availablePayable)) {
    if (!/^[a-z]{3}$/.test(currency) || !Number.isSafeInteger(amount) || Number(amount) < -1_000_000_000_000 || Number(amount) > 1_000_000_000_000 || compatibilityPayable[currency] !== amount) accountProjectionError("billing_account_seller_invalid");
    payableByCurrency[currency] = Number(amount);
  }
  if (typeof seller.eligible !== "boolean" || typeof seller.configured !== "boolean" || typeof seller.testMode !== "boolean" || !marketplaceEconomicStatusPattern.test(status)
    || typeof seller.detailsSubmitted !== "boolean" || typeof seller.chargesEnabled !== "boolean" || typeof seller.payoutsEnabled !== "boolean"
    || !Number.isSafeInteger(seller.activeOfferCount) || Number(seller.activeOfferCount) < 0 || Number(seller.activeOfferCount) > 1_000_000
    || typeof seller.payoutPreparationEnabled !== "boolean" || seller.payoutsEnabledByFeature !== false || seller.payoutExecutionAvailable !== false
    || seller.balancesAreTestRecords !== true || seller.providerIdentifiersExposed !== false) {
    accountProjectionError("billing_account_seller_invalid");
  }
  for (const version of [seller.sellerAgreementVersion, seller.freeSellerAgreementVersion, seller.stripeConnectDisclosureVersion]) if (version !== null) marketplaceDocumentVersion(version, "billing_account_seller_invalid");
  return {
    eligible: seller.eligible,
    onboardingAvailable: seller.eligible,
    status: status.replace(/_/g, " "),
    payoutsEnabled: seller.configured === true ? seller.payoutsEnabled as boolean : false,
    payableByCurrency,
    payoutPreparationEnabled: seller.payoutPreparationEnabled,
    payoutExecutionAvailable: false,
    balancesAreTestRecords: true,
    summaryAvailable: true
  };
}

export async function loadBillingAccount(accessToken: string): Promise<BillingAccountSummary> {
  const data = await billingFetch("/api/billing/account", {}, accessToken);
  const account = nestedRecord(data, "account", "data");
  const source = Object.keys(account).length ? account : data;
  const finalAccountProjection = hasOwnProjection(source, "sandboxCredits", "marketplaceSeller", "jobPosts", "accountRequests");
  if (finalAccountProjection && (typeof source.testMode !== "boolean" || source.providerIdentifiersExposed !== false || source.moneyDoesNotGrantAuthority !== true)) {
    accountProjectionError("billing_account_boundary_invalid");
  }
  const subscriptions = boundedAccountArray(source.subscriptions, "billing_account_subscriptions_invalid");
  const subscription = nestedRecord(source, "subscription", "recurring_support");
  const currentSubscription = Object.keys(subscription).length
    ? subscription
    : isRecord(subscriptions[0])
      ? subscriptions[0] as JsonRecord
      : {};
  const sandbox = nestedRecord(source, "sandbox", "sandbox_credits", "sandboxCredits");
  const finalSandbox = hasOwnProjection(source, "sandboxCredits") ? normalizeFinalSandboxSummary(source.sandboxCredits) : null;
  const seller = nestedRecord(source, "seller", "seller_finance", "marketplaceSeller");
  const finalSeller = hasOwnProjection(source, "marketplaceSeller") ? normalizeFinalSellerSummary(source.marketplaceSeller) : null;
  const operator = nestedRecord(source, "operator", "economic_operator");
  const recognition = normalizeEconomicRecognition(source.recognition);
  return {
    available: booleanValue(source.available, true),
    mode: normalizeMode(source.mode ?? data.mode ?? (source.testMode === true ? "test" : source.testMode === false ? "live" : undefined)),
    contributions: normalizeSupportHistory(source.contributions ?? source.support_history ?? source.orders),
    receipts: normalizeReceipts(source.receipts),
    subscription: Object.keys(currentSubscription).length ? {
      status: stringValue(currentSubscription.status, "unknown").replace(/_/g, " "),
      label: stringValue(currentSubscription.label ?? currentSubscription.planName ?? currentSubscription.plan_name, "Recurring support"),
      amountCents: numberValue(currentSubscription.amountMinor ?? currentSubscription.amount_cents ?? currentSubscription.amount),
      currency: stringValue(currentSubscription.currency, "usd").toUpperCase(),
      nextRenewalAt: nullableString(currentSubscription.nextRenewalAt ?? currentSubscription.currentPeriodEnd ?? currentSubscription.next_renewal_at ?? currentSubscription.current_period_end),
      cancelAtPeriodEnd: booleanValue(currentSubscription.cancelAtPeriodEnd ?? currentSubscription.cancel_at_period_end)
    } : null,
    sandbox: finalSandbox ?? {
      displayEnabled: booleanValue(sandbox.displayEnabled ?? sandbox.display_enabled ?? sandbox.enabled),
      availableCredits: numberValue(sandbox.availableCredits ?? sandbox.available_credits ?? sandbox.balance),
      purchasedCredits: numberValue(sandbox.purchasedCredits ?? sandbox.purchased_credits),
      sponsoredCredits: numberValue(sandbox.sponsoredCredits ?? sandbox.sponsored_credits),
      waivedCredits: numberValue(sandbox.waivedCredits ?? sandbox.waived_credits)
    },
    marketplacePurchases: normalizeMarketplacePurchases(source.marketplacePurchases ?? source.marketplace_purchases),
    jobPostPayments: normalizeJobPostPayments(source.jobPosts ?? source.jobPostPayments ?? source.job_post_payments),
    seller: finalSeller ?? (Object.keys(seller).length ? {
      eligible: booleanValue(seller.eligible),
      onboardingAvailable: booleanValue(seller.onboardingAvailable ?? seller.onboarding_available),
      status: stringValue(seller.status, "not configured").replace(/_/g, " "),
      payoutsEnabled: booleanValue(seller.payoutsEnabled ?? seller.payouts_enabled),
      payableByCurrency: {},
      payoutPreparationEnabled: false,
      payoutExecutionAvailable: false,
      balancesAreTestRecords: true,
      summaryAvailable: booleanValue(seller.summaryAvailable ?? seller.summary_available, true)
    } : null),
    assistance: normalizeEconomicAssistance(source.assistance),
    recognition,
    accountRequests: normalizeEconomicAccountRequests(source.accountRequests),
    activeRestrictions: normalizeEconomicRestrictions(source.activeRestrictions),
    closureReadiness: normalizeEconomicClosureReadiness(source.closureReadiness),
    operator: {
      authorized: booleanValue(operator.authorized),
      capabilities: arrayValue(operator.capabilities).filter((value): value is string => typeof value === "string")
    },
    recognitionAvailable: recognition ? recognition.eligible && recognition.publicDisplayEnabled : booleanValue(source.recognitionAvailable ?? source.recognition_available),
    projectionCoverage: {
      receipts: hasOwnProjection(source, "receipts"),
      sandbox: hasOwnProjection(source, "sandbox", "sandbox_credits", "sandboxCredits"),
      marketplacePurchases: hasOwnProjection(source, "marketplacePurchases", "marketplace_purchases"),
      jobPostPayments: hasOwnProjection(source, "jobPosts", "jobPostPayments", "job_post_payments"),
      seller: hasOwnProjection(source, "seller", "seller_finance", "marketplaceSeller")
    },
    warnings: normalizeAccountWarnings(source.warnings)
  };
}

function normalizedLifecycleConsentVersion(value: string) {
  const normalized = value.trim();
  if (!consentVersionPattern.test(normalized)) operatorInputError("The canonical legal-document version is unavailable or invalid.", "economic_account_consent_version_invalid");
  return normalized;
}

function normalizedLifecycleNote(value: string) {
  const normalized = value.trim();
  if (normalized.length > 1_000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) {
    operatorInputError("The optional private note must be no more than 1,000 characters and cannot contain control characters.", "economic_account_user_note_invalid");
  }
  return normalized;
}

export async function setSupportRecognitionPreference(input: SupportRecognitionPreferenceInput, accessToken: string): Promise<SupportRecognitionPreferenceResult> {
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  const consentVersion = normalizedLifecycleConsentVersion(input.consentVersion);
  const expectedConfirmation = input.optedIn ? "PUBLISH SUPPORT RECOGNITION" : "REMOVE SUPPORT RECOGNITION";
  if (input.confirmation !== expectedConfirmation) operatorInputError(`Type ${expectedConfirmation} exactly before changing this preference.`, "support_recognition_confirmation_invalid");
  const body: SupportRecognitionPreferenceInput = { clientRequestId, optedIn: input.optedIn, consentVersion, confirmation: expectedConfirmation };
  const data = await billingFetch("/api/billing/account/support-recognition", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const recognition = operatorMutationEnvelope(data, "recognition", ["optedIn", "eligible", "eligibilityExpiresAt", "publicDisplayEnabled", "amountsPublic", "grantsAuthority", "idempotentReplay"], "support_recognition_preference_invalid");
  const eligibilityExpiresAt = recognition.eligibilityExpiresAt === null ? null : marketplaceString(recognition.eligibilityExpiresAt, 40, "support_recognition_preference_invalid");
  if (recognition.optedIn !== input.optedIn || typeof recognition.eligible !== "boolean" || typeof recognition.publicDisplayEnabled !== "boolean"
    || (eligibilityExpiresAt !== null && Number.isNaN(Date.parse(eligibilityExpiresAt)))
    || recognition.amountsPublic !== false || recognition.grantsAuthority !== false || typeof recognition.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The private recognition-preference result was invalid. No preference change should be assumed.", 503, "support_recognition_preference_invalid");
  }
  return {
    optedIn: input.optedIn,
    eligible: recognition.eligible,
    eligibilityExpiresAt,
    publicDisplayEnabled: recognition.publicDisplayEnabled,
    amountsPublic: false,
    grantsAuthority: false,
    idempotentReplay: recognition.idempotentReplay
  };
}

export async function loadEconomicClosureReadiness(accessToken: string): Promise<EconomicClosureReadiness> {
  const data = await billingFetch("/api/billing/account/closure-readiness", { cache: "no-store" }, accessToken);
  const envelope = exactRecord(data, ["ok", "closureReadiness"], "economic_closure_readiness_invalid");
  if (envelope.ok !== true) throw new BillingRequestError("Economic closure readiness could not be verified. No closure should be assumed available.", 503, "economic_closure_readiness_invalid");
  return normalizeEconomicClosureReadiness(envelope.closureReadiness);
}

export async function requestEconomicAccountAction(input: EconomicAccountActionInput, accessToken: string): Promise<EconomicAccountActionResult> {
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  if (!economicAccountRequestTypes.has(input.requestType)) operatorInputError("Choose a recognized economic lifecycle request.", "economic_account_request_type_invalid");
  const consentVersion = normalizedLifecycleConsentVersion(input.consentVersion);
  const userNote = normalizedLifecycleNote(input.userNote);
  if (input.acknowledgeFinancialRecordsRetained !== true || input.acknowledgeAuthProfileUnchanged !== true) {
    operatorInputError("Acknowledge both the financial-record retention and unchanged Website Auth/Profile boundaries.", "economic_account_retention_acknowledgment_required");
  }
  const expectedConfirmation = input.requestType === "data_export" ? "REQUEST ECONOMIC DATA EXPORT" : "REQUEST ECONOMIC ACCOUNT CLOSURE";
  if (input.confirmation !== expectedConfirmation) operatorInputError(`Type ${expectedConfirmation} exactly before submitting.`, "economic_account_confirmation_invalid");
  const body: EconomicAccountActionInput = {
    clientRequestId,
    requestType: input.requestType,
    consentVersion,
    userNote,
    acknowledgeFinancialRecordsRetained: true,
    acknowledgeAuthProfileUnchanged: true,
    confirmation: expectedConfirmation
  };
  const data = await billingFetch("/api/billing/account/action", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const action = operatorMutationEnvelope(data, "accountAction", ["requestId", "requestType", "status", "providerCancellationRequired", "closureReadiness", "financialRecordsRetained", "authProfileUnchanged", "idempotentReplay"], "economic_account_action_invalid");
  const requestId = marketplaceUuid(action.requestId, "economic_account_action_invalid");
  const requestType = action.requestType as EconomicAccountRequestType;
  const status = action.status as EconomicAccountRequestStatus;
  const closureReadiness = action.closureReadiness === null ? null : normalizeEconomicClosureReadiness(action.closureReadiness);
  if (requestType !== input.requestType || !economicAccountRequestStatuses.has(status) || typeof action.providerCancellationRequired !== "boolean"
    || (input.requestType === "data_export") !== (closureReadiness === null)
    || action.financialRecordsRetained !== true || action.authProfileUnchanged !== true || typeof action.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The economic lifecycle result was invalid. No completed request should be assumed.", 503, "economic_account_action_invalid");
  }
  return { requestId, requestType, status, providerCancellationRequired: action.providerCancellationRequired, closureReadiness, financialRecordsRetained: true, authProfileUnchanged: true, idempotentReplay: action.idempotentReplay };
}

export async function updateEconomicOperatorAccountAction(input: OperatorEconomicAccountActionInput, accessToken: string): Promise<OperatorEconomicAccountActionResult> {
  const requestId = normalizedOperatorUuid(input.requestId, "Economic account request ID");
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  const allowedStatuses = new Set<OperatorEconomicAccountActionStatus>(["identity_verification", "operator_review", "processing", "completed", "rejected"]);
  if (!allowedStatuses.has(input.status)) operatorInputError("Choose a recognized economic account-request state.", "economic_account_request_status_invalid");
  const artifactSha256 = input.artifactSha256?.trim() || null;
  if (artifactSha256 !== null && !/^[0-9a-f]{64}$/.test(artifactSha256)) operatorInputError("The optional artifact hash must be exactly 64 lowercase hexadecimal characters.", "economic_account_artifact_hash_invalid");
  const artifactExpiresAt = normalizedOperatorExpiration(input.artifactExpiresAt);
  if ((artifactSha256 === null) !== (artifactExpiresAt === null)) operatorInputError("An artifact hash and future expiration must be supplied together or both omitted.", "economic_account_artifact_invalid");
  if (input.confirmation !== "UPDATE ECONOMIC ACCOUNT REQUEST") operatorInputError("Type UPDATE ECONOMIC ACCOUNT REQUEST exactly before continuing.", "economic_account_operator_confirmation_invalid");
  const body: OperatorEconomicAccountActionInput = {
    requestId,
    status: input.status,
    clientRequestId,
    artifactSha256,
    artifactExpiresAt,
    confirmation: "UPDATE ECONOMIC ACCOUNT REQUEST",
    reason: normalizedOperatorReason(input.reason)
  };
  const data = await billingFetch("/api/billing/operator/account-action", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const action = operatorMutationEnvelope(data, "accountAction", ["requestId", "requestType", "status", "financialRecordsRetained", "authProfileUnchanged", "idempotentReplay"], "economic_operator_account_action_invalid");
  const requestType = action.requestType as EconomicAccountRequestType;
  if (action.requestId !== requestId || !economicAccountRequestTypes.has(requestType) || action.status !== input.status
    || action.financialRecordsRetained !== true || action.authProfileUnchanged !== true || typeof action.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The economic account-request update was invalid. No completed operator action should be assumed.", 503, "economic_operator_account_action_invalid");
  }
  return { requestId, requestType, status: input.status, financialRecordsRetained: true, authProfileUnchanged: true, idempotentReplay: action.idempotentReplay };
}

export async function setEconomicOperatorServiceRestriction(input: OperatorEconomicServiceRestrictionInput, accessToken: string): Promise<OperatorEconomicServiceRestrictionResult> {
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  const targetUserId = normalizedOperatorUuid(input.targetUserId, "Target Website Account ID");
  const restrictionId = input.restrictionId === null ? null : normalizedOperatorUuid(input.restrictionId, "Economic service restriction ID");
  const scopes = new Set<EconomicServiceRestrictionScope>(["billing", "recurring_support", "sandbox", "marketplace_buying", "marketplace_selling", "job_posting"]);
  if (!scopes.has(input.scope)) operatorInputError("Choose one narrowly scoped economic service.", "economic_service_restriction_scope_invalid");
  const reasonCode = input.reasonCode.trim();
  if (!/^[a-z][a-z0-9_]{2,100}$/.test(reasonCode)) operatorInputError("Use a reviewed lowercase reason code between 3 and 101 characters.", "economic_service_restriction_reason_code_invalid");
  if (input.enabled === (restrictionId !== null)) operatorInputError("Imposing a restriction requires no existing restriction ID; lifting one requires its exact internal ID.", "economic_service_restriction_id_invalid");
  const expiresAt = normalizedOperatorExpiration(input.expiresAt);
  if (!input.enabled && expiresAt !== null) operatorInputError("A lifted restriction cannot keep an expiration.", "economic_service_restriction_expiration_invalid");
  const expectedConfirmation = input.enabled ? "IMPOSE SCOPED ECONOMIC RESTRICTION" : "LIFT SCOPED ECONOMIC RESTRICTION";
  if (input.confirmation !== expectedConfirmation) operatorInputError(`Type ${expectedConfirmation} exactly before continuing.`, "economic_service_restriction_confirmation_invalid");
  const body: OperatorEconomicServiceRestrictionInput = { clientRequestId, targetUserId, restrictionId, scope: input.scope, reasonCode, expiresAt, enabled: input.enabled, confirmation: expectedConfirmation, reason: normalizedOperatorReason(input.reason) };
  const data = await billingFetch("/api/billing/operator/service-restriction", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const restriction = operatorMutationEnvelope(data, "restriction", ["restrictionId", "userId", "scope", "active", "commonsAccountAffected", "idempotentReplay"], "economic_operator_service_restriction_invalid");
  const returnedRestrictionId = marketplaceUuid(restriction.restrictionId, "economic_operator_service_restriction_invalid");
  if (restriction.userId !== targetUserId || restriction.scope !== input.scope || restriction.active !== input.enabled || restriction.commonsAccountAffected !== false || typeof restriction.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The scoped economic restriction result was invalid. No restriction change should be assumed.", 503, "economic_operator_service_restriction_invalid");
  }
  return { restrictionId: returnedRestrictionId, userId: targetUserId, scope: input.scope, active: input.enabled, commonsAccountAffected: false, idempotentReplay: restriction.idempotentReplay };
}

export async function prepareEconomicOperatorMarketplaceTestPayout(input: OperatorMarketplacePayoutPreparationInput, accessToken: string): Promise<OperatorMarketplacePayoutPreparationResult> {
  const sellerAccountId = normalizedOperatorUuid(input.sellerAccountId, "Marketplace seller-account ID");
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 1 || input.amountMinor > 100_000_000_000) operatorInputError("The test payout-preparation amount must be a whole number from 1 through 100,000,000,000 minor USD units.", "marketplace_payout_preparation_amount_invalid");
  if (input.currency !== "usd") operatorInputError("Test payout preparation currently supports only USD accounting records.", "marketplace_payout_preparation_currency_invalid");
  if (input.confirmation !== "PREPARE TEST MARKETPLACE PAYOUT") operatorInputError("Type PREPARE TEST MARKETPLACE PAYOUT exactly before continuing.", "marketplace_payout_preparation_confirmation_invalid");
  const body: OperatorMarketplacePayoutPreparationInput = { sellerAccountId, clientRequestId, amountMinor: input.amountMinor, currency: "usd", confirmation: "PREPARE TEST MARKETPLACE PAYOUT", reason: normalizedOperatorReason(input.reason) };
  const data = await billingFetch("/api/billing/operator/marketplace-payout-preparation", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const payout = operatorMutationEnvelope(data, "payoutPreparation", ["payoutPreparationId", "sellerAccountId", "amountMinor", "currency", "status", "providerExecutionAvailable", "balancesAreTestRecords", "testMode", "idempotentReplay"], "economic_operator_payout_preparation_invalid");
  const payoutPreparationId = marketplaceUuid(payout.payoutPreparationId, "economic_operator_payout_preparation_invalid");
  if (payout.sellerAccountId !== sellerAccountId || payout.amountMinor !== input.amountMinor || payout.currency !== "usd" || payout.status !== "prepared"
    || payout.providerExecutionAvailable !== false || payout.balancesAreTestRecords !== true || typeof payout.testMode !== "boolean" || typeof payout.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The private test payout-preparation result was invalid. No payout preparation or provider transfer should be assumed.", 503, "economic_operator_payout_preparation_invalid");
  }
  return { payoutPreparationId, sellerAccountId, amountMinor: input.amountMinor, currency: "usd", status: "prepared", providerExecutionAvailable: false, balancesAreTestRecords: true, testMode: currentBillingApiPublication() !== "live", idempotentReplay: payout.idempotentReplay };
}

export async function configureEconomicOperatorAssistanceProgram(input: OperatorAssistanceProgramInput, accessToken: string): Promise<OperatorAssistanceProgramResult> {
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  const programCode = input.programCode.trim();
  if (!/^[a-z][a-z0-9_]{2,100}$/.test(programCode)) operatorInputError("Use a stable lowercase assistance program code.", "economic_assistance_program_code_invalid");
  if (!["waiver", "subsidy", "sponsored_access"].includes(input.assistanceKind)) operatorInputError("Choose a recognized assistance kind.", "economic_assistance_kind_invalid");
  if (!["job_post_fee", "sandbox_credits"].includes(input.scope)) operatorInputError("Choose a recognized narrow assistance scope.", "economic_assistance_scope_invalid");
  const publicLabel = input.publicLabel.trim();
  if (publicLabel.length < 2 || publicLabel.length > 120 || /[\u0000-\u001f\u007f]/.test(publicLabel)) operatorInputError("The neutral public program label must be 2 to 120 characters.", "economic_assistance_label_invalid");
  const termsVersion = marketplaceDocumentVersion(input.termsVersion, "economic_assistance_terms_version_invalid");
  const startsAt = normalizedEconomicTimestamp(input.startsAt, "Program start");
  const endsAt = input.endsAt === null ? null : normalizedEconomicTimestamp(input.endsAt, "Program end");
  if (endsAt !== null && Date.parse(endsAt) <= Date.parse(startsAt)) operatorInputError("The assistance program end must be after its start.", "economic_assistance_end_invalid");
  if (input.maxGrants !== null && (!Number.isSafeInteger(input.maxGrants) || input.maxGrants < 1 || input.maxGrants > 1_000_000)) operatorInputError("The optional grant cap must be a whole number from 1 through 1,000,000.", "economic_assistance_max_grants_invalid");
  if (input.confirmation !== "CONFIGURE ECONOMIC ASSISTANCE PROGRAM") operatorInputError("Type CONFIGURE ECONOMIC ASSISTANCE PROGRAM exactly before continuing.", "economic_assistance_confirmation_invalid");
  const body = { clientRequestId, programCode, assistanceKind: input.assistanceKind, scope: input.scope, publicLabel, termsVersion, startsAt, endsAt, maxGrants: input.maxGrants, activate: false, confirmation: "CONFIGURE ECONOMIC ASSISTANCE PROGRAM" as const, reason: normalizedOperatorReason(input.reason) };
  const data = await billingFetch("/api/billing/operator/assistance-program", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const program = operatorMutationEnvelope(data, "program", ["programId", "programCode", "kind", "scope", "status", "publicLabel", "testMode", "idempotentReplay"], "economic_operator_assistance_program_invalid");
  const programId = marketplaceUuid(program.programId, "economic_operator_assistance_program_invalid");
  if (program.programCode !== programCode || program.kind !== input.assistanceKind || program.scope !== input.scope || program.status !== "draft" || program.publicLabel !== publicLabel || typeof program.testMode !== "boolean" || typeof program.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The assistance-program result was invalid. No program state should be assumed.", 503, "economic_operator_assistance_program_invalid");
  }
  return { programId, programCode, kind: input.assistanceKind, scope: input.scope, status: "draft", publicLabel, testMode: currentBillingApiPublication() !== "live", idempotentReplay: program.idempotentReplay };
}

export async function setEconomicOperatorAssistanceProgramStatus(input: OperatorAssistanceProgramStatusInput, accessToken: string): Promise<OperatorAssistanceProgramStatusResult> {
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  const programId = normalizedOperatorUuid(input.programId, "Economic assistance program ID");
  const expectedConfirmation = operatorAssistanceProgramStatusConfirmations[input.targetStatus];
  if (!expectedConfirmation) operatorInputError("Choose an allowed assistance-program status.", "economic_assistance_program_status_invalid");
  if (input.confirmation !== expectedConfirmation) operatorInputError(`Type ${expectedConfirmation} exactly before continuing.`, "economic_assistance_program_status_confirmation_invalid");
  const body: OperatorAssistanceProgramStatusInput = { clientRequestId, programId, targetStatus: input.targetStatus, confirmation: expectedConfirmation, reason: normalizedOperatorReason(input.reason) };
  const data = await billingFetch("/api/billing/operator/assistance-program-status", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const program = operatorMutationEnvelope(data, "program", ["programId", "status", "testMode", "idempotentReplay"], "economic_operator_assistance_program_status_invalid");
  if (program.programId !== programId || program.status !== input.targetStatus || typeof program.testMode !== "boolean" || typeof program.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The assistance-program status result was invalid. No status change should be assumed.", 503, "economic_operator_assistance_program_status_invalid");
  }
  return { programId, status: input.targetStatus, testMode: currentBillingApiPublication() !== "live", idempotentReplay: program.idempotentReplay };
}

export async function issueEconomicOperatorAssistanceGrant(input: OperatorAssistanceGrantInput, accessToken: string): Promise<OperatorAssistanceGrantResult> {
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  const programCode = input.programCode.trim();
  if (!/^[a-z][a-z0-9_]{2,100}$/.test(programCode)) operatorInputError("Use an active stable assistance program code.", "economic_assistance_program_code_invalid");
  const beneficiaryUserId = normalizedOperatorUuid(input.beneficiaryUserId, "Beneficiary Website Account ID");
  const resourceId = input.resourceId === null ? null : normalizedOperatorUuid(input.resourceId, "Optional economic resource ID");
  if (input.units !== null && (!Number.isSafeInteger(input.units) || input.units < 1 || input.units > 1_000_000_000)) operatorInputError("Optional sandbox units must be a whole number from 1 through 1,000,000,000.", "economic_assistance_units_invalid");
  const expiresAt = normalizedOperatorExpiration(input.expiresAt);
  const sponsorshipAllocationId = input.sponsorshipAllocationId === null ? null : normalizedOperatorUuid(input.sponsorshipAllocationId, "Sponsorship allocation ID");
  if (input.allocationConsumption !== null && (!Number.isSafeInteger(input.allocationConsumption) || input.allocationConsumption < 1 || input.allocationConsumption > 100_000_000_000)) operatorInputError("Allocation consumption must be a whole number from 1 through 100,000,000,000.", "economic_assistance_allocation_consumption_invalid");
  if ((sponsorshipAllocationId === null) !== (input.allocationConsumption === null)) operatorInputError("A sponsorship allocation ID and its consumption must be supplied together or both omitted.", "economic_assistance_sponsorship_allocation_invalid");
  if (input.confirmation !== "ISSUE ECONOMIC ASSISTANCE GRANT") operatorInputError("Type ISSUE ECONOMIC ASSISTANCE GRANT exactly before continuing.", "economic_assistance_grant_confirmation_invalid");
  const body: OperatorAssistanceGrantInput = { clientRequestId, programCode, beneficiaryUserId, resourceId, units: input.units, expiresAt, sponsorshipAllocationId, allocationConsumption: input.allocationConsumption, confirmation: "ISSUE ECONOMIC ASSISTANCE GRANT", reason: normalizedOperatorReason(input.reason) };
  const data = await billingFetch("/api/billing/operator/assistance-grant", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const grant = operatorMutationEnvelope(data, "grant", ["grantId", "scope", "status", "expiresAt", "publiclyVisible", "sandboxCreditResult", "testMode", "idempotentReplay"], "economic_operator_assistance_grant_invalid");
  const grantId = marketplaceUuid(grant.grantId, "economic_operator_assistance_grant_invalid");
  if ((grant.scope !== "job_post_fee" && grant.scope !== "sandbox_credits") || (grant.status !== "granted" && grant.status !== "consumed") || grant.publiclyVisible !== false || typeof grant.testMode !== "boolean" || typeof grant.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The private assistance-grant result was invalid. No grant should be assumed.", 503, "economic_operator_assistance_grant_invalid");
  }
  const returnedExpiresAt = grant.expiresAt === null ? null : marketplaceString(grant.expiresAt, 40, "economic_operator_assistance_grant_invalid");
  if (returnedExpiresAt !== null && Number.isNaN(Date.parse(returnedExpiresAt))) accountProjectionError("economic_operator_assistance_grant_invalid");
  let sandboxCreditResult: OperatorAssistanceGrantResult["sandboxCreditResult"] = null;
  if (grant.sandboxCreditResult !== null) {
    const credit = exactRecord(grant.sandboxCreditResult, ["creditLotId", "grantedUnits", "sourceCategory", "expiresAt"], "economic_operator_assistance_grant_invalid");
    const creditExpiresAt = credit.expiresAt === null ? null : marketplaceString(credit.expiresAt, 40, "economic_operator_assistance_grant_invalid");
    if (!Number.isSafeInteger(credit.grantedUnits) || Number(credit.grantedUnits) < 1 || Number(credit.grantedUnits) > 1_000_000_000 || typeof credit.sourceCategory !== "string" || credit.sourceCategory.length > 40 || (creditExpiresAt !== null && Number.isNaN(Date.parse(creditExpiresAt)))) accountProjectionError("economic_operator_assistance_grant_invalid");
    sandboxCreditResult = { creditLotId: marketplaceUuid(credit.creditLotId, "economic_operator_assistance_grant_invalid"), grantedUnits: Number(credit.grantedUnits), sourceCategory: credit.sourceCategory, expiresAt: creditExpiresAt };
  }
  return { grantId, scope: grant.scope, status: grant.status, expiresAt: returnedExpiresAt, publiclyVisible: false, sandboxCreditResult, testMode: currentBillingApiPublication() !== "live", idempotentReplay: grant.idempotentReplay };
}

export async function endEconomicOperatorAssistanceGrant(input: OperatorAssistanceEndInput, accessToken: string): Promise<OperatorAssistanceEndResult> {
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  const grantId = normalizedOperatorUuid(input.grantId, "Economic assistance grant ID");
  if (input.action !== "revoke" && input.action !== "expire") operatorInputError("Choose whether the reviewed grant is revoked or expired.", "economic_assistance_end_action_invalid");
  if (input.confirmation !== "END ECONOMIC ASSISTANCE GRANT") operatorInputError("Type END ECONOMIC ASSISTANCE GRANT exactly before continuing.", "economic_assistance_end_confirmation_invalid");
  const body: OperatorAssistanceEndInput = { clientRequestId, grantId, action: input.action, confirmation: "END ECONOMIC ASSISTANCE GRANT", reason: normalizedOperatorReason(input.reason) };
  const data = await billingFetch("/api/billing/operator/assistance-end", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const grant = operatorMutationEnvelope(data, "grant", ["grantId", "status", "reversedUnits", "publiclyVisible", "idempotentReplay"], "economic_operator_assistance_end_invalid");
  const expectedStatus = input.action === "revoke" ? "revoked" : "expired";
  if (grant.grantId !== grantId || grant.status !== expectedStatus || !Number.isSafeInteger(grant.reversedUnits) || Number(grant.reversedUnits) < 0 || Number(grant.reversedUnits) > 1_000_000_000 || grant.publiclyVisible !== false || typeof grant.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The private assistance-end result was invalid. No grant change should be assumed.", 503, "economic_operator_assistance_end_invalid");
  }
  return { grantId, status: expectedStatus, reversedUnits: Number(grant.reversedUnits), publiclyVisible: false, idempotentReplay: grant.idempotentReplay };
}

export async function reconcileEconomicOperatorJobPostAssistanceGrant(input: OperatorJobPostAssistanceReconciliationInput, accessToken: string): Promise<OperatorJobPostAssistanceReconciliationResult> {
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  const jobPostId = normalizedOperatorUuid(input.jobPostId, "Job Post ID");
  const grantId = normalizedOperatorUuid(input.grantId, "Economic assistance grant ID");
  if (input.endAction !== "revoke" && input.endAction !== "expire") operatorInputError("Choose whether the consumed Job Post assistance grant is revoked or expired.", "job_post_assistance_reconciliation_action_invalid");
  if (input.confirmation !== "RECONCILE AND END TEST JOB POST ASSISTANCE") operatorInputError("Type RECONCILE AND END TEST JOB POST ASSISTANCE exactly before continuing.", "job_post_assistance_reconciliation_confirmation_invalid");
  const body: OperatorJobPostAssistanceReconciliationInput = { clientRequestId, jobPostId, grantId, endAction: input.endAction, confirmation: "RECONCILE AND END TEST JOB POST ASSISTANCE", reason: normalizedOperatorReason(input.reason) };
  const data = await billingFetch("/api/billing/operator/job-post-assistance-reconciliation", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const reconciliation = operatorMutationEnvelope(data, "reconciliation", ["jobPostId", "grantId", "grantStatus", "economicStatus", "publicationStatus", "published", "testMode", "idempotentReplay"], "economic_operator_job_post_assistance_reconciliation_invalid");
  const expectedStatus = input.endAction === "revoke" ? "revoked" : "expired";
  const publicationStatus = reconciliation.publicationStatus === null ? null : marketplaceString(reconciliation.publicationStatus, 40, "economic_operator_job_post_assistance_reconciliation_invalid");
  if (reconciliation.jobPostId !== jobPostId || reconciliation.grantId !== grantId || reconciliation.grantStatus !== expectedStatus || reconciliation.economicStatus !== "not_assessed" || typeof reconciliation.published !== "boolean" || typeof reconciliation.testMode !== "boolean" || typeof reconciliation.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The Job Post assistance reconciliation result was invalid. No grant or economic-condition change should be assumed.", 503, "economic_operator_job_post_assistance_reconciliation_invalid");
  }
  return { jobPostId, grantId, grantStatus: expectedStatus, economicStatus: "not_assessed", publicationStatus, published: reconciliation.published, testMode: currentBillingApiPublication() !== "live", idempotentReplay: reconciliation.idempotentReplay };
}

const operatorOrganizationRelationships = new Set<OperatorOrganizationRelationship>([
  "owner", "billing_admin", "technical_contact", "procurement_contact",
  "billing_contact", "authorized_signer", "service_participant"
]);

function normalizedEconomicCode(value: string, maximum: number, label: string) {
  if (value.length > maximum || !/^[a-z][a-z0-9_]{2,120}$/.test(value)) {
    operatorInputError(`${label} must be a stable lowercase code.`, "economic_code_invalid");
  }
  return value;
}

function normalizedOptionalOperatorText(value: string | null, minimum: number, maximum: number, label: string) {
  if (value === null) return null;
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) {
    operatorInputError(`${label} must be ${minimum} through ${maximum} characters without unsafe control characters.`, "operator_text_invalid");
  }
  return normalized;
}

export async function createEconomicOperatorOrganization(input: OperatorOrganizationInput, accessToken: string): Promise<OperatorOrganizationResult> {
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  const accountName = input.accountName.trim();
  if (accountName.length < 2 || accountName.length > 200 || /[\u0000-\u001f\u007f]/.test(accountName)) operatorInputError("Organization account name must be 2 through 200 characters.", "economic_organization_name_invalid");
  let countryCode: string | null = null;
  if (input.countryCode !== null) {
    if (!/^[A-Za-z]{2}$/.test(input.countryCode)) operatorInputError("Optional country code must contain exactly two letters.", "economic_organization_country_invalid");
    countryCode = input.countryCode.toUpperCase();
  }
  const initialContactUserId = normalizedOperatorUuid(input.initialContactUserId, "Initial contact Website Account ID");
  if (input.confirmation !== "CREATE ECONOMIC ORGANIZATION") operatorInputError("Type CREATE ECONOMIC ORGANIZATION exactly before continuing.", "economic_organization_confirmation_invalid");
  const body: OperatorOrganizationInput = { clientRequestId, accountName, countryCode, initialContactUserId, confirmation: "CREATE ECONOMIC ORGANIZATION", reason: normalizedOperatorReason(input.reason) };
  const data = await billingFetch("/api/billing/operator/organization", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const organization = operatorMutationEnvelope(data, "organization", ["organizationId", "accountName", "status", "testMode", "idempotentReplay"], "economic_operator_organization_invalid");
  const organizationId = marketplaceUuid(organization.organizationId, "economic_operator_organization_invalid");
  if (organization.accountName !== accountName || organization.status !== "active" || typeof organization.testMode !== "boolean" || typeof organization.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The private organization result was invalid. No organization record should be assumed.", 503, "economic_operator_organization_invalid");
  }
  return { organizationId, accountName, status: "active", testMode: currentBillingApiPublication() !== "live", idempotentReplay: organization.idempotentReplay };
}

export async function setEconomicOperatorOrganizationMembership(input: OperatorOrganizationMembershipInput, accessToken: string): Promise<OperatorOrganizationMembershipResult> {
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  const organizationId = normalizedOperatorUuid(input.organizationId, "Economic organization ID");
  const targetUserId = normalizedOperatorUuid(input.targetUserId, "Target Website Account ID");
  if (!operatorOrganizationRelationships.has(input.relationship)) operatorInputError("Choose a recognized private organization relationship.", "economic_organization_relationship_invalid");
  if (input.confirmation !== "SET ECONOMIC ORGANIZATION MEMBERSHIP") operatorInputError("Type SET ECONOMIC ORGANIZATION MEMBERSHIP exactly before continuing.", "economic_organization_membership_confirmation_invalid");
  const body: OperatorOrganizationMembershipInput = { clientRequestId, organizationId, targetUserId, relationship: input.relationship, enabled: input.enabled, confirmation: "SET ECONOMIC ORGANIZATION MEMBERSHIP", reason: normalizedOperatorReason(input.reason) };
  const data = await billingFetch("/api/billing/operator/organization-membership", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const membership = operatorMutationEnvelope(data, "membership", ["membershipId", "organizationId", "userId", "relationship", "active", "testMode", "idempotentReplay"], "economic_operator_organization_membership_invalid");
  const membershipId = marketplaceUuid(membership.membershipId, "economic_operator_organization_membership_invalid");
  if (membership.organizationId !== organizationId || membership.userId !== targetUserId || membership.relationship !== input.relationship || membership.active !== input.enabled || typeof membership.testMode !== "boolean" || typeof membership.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The private organization-membership result was invalid. No membership change should be assumed.", 503, "economic_operator_organization_membership_invalid");
  }
  return { membershipId, organizationId, userId: targetUserId, relationship: input.relationship, active: input.enabled, testMode: currentBillingApiPublication() !== "live", idempotentReplay: membership.idempotentReplay };
}

export async function createEconomicOperatorOrganizationService(input: OperatorOrganizationServiceInput, accessToken: string): Promise<OperatorOrganizationServiceResult> {
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  const organizationId = normalizedOperatorUuid(input.organizationId, "Economic organization ID");
  const authorizedSignerUserId = normalizedOperatorUuid(input.authorizedSignerUserId, "Authorized signer Website Account ID");
  const serviceCode = normalizedEconomicCode(input.serviceCode, 100, "Service code");
  const priceCode = normalizedEconomicCode(input.priceCode, 120, "Price code");
  const statementOfWorkVersion = marketplaceDocumentVersion(input.statementOfWorkVersion, "organization_statement_of_work_version_invalid");
  const serviceTermsVersion = marketplaceDocumentVersion(input.serviceTermsVersion, "organization_service_terms_version_invalid");
  const dataHandlingDisclosureVersion = marketplaceDocumentVersion(input.dataHandlingDisclosureVersion, "organization_data_disclosure_version_invalid");
  if (!new Set(["internal", "confidential", "restricted"]).has(input.confidentialityClass)) operatorInputError("Choose a recognized private confidentiality class.", "organization_service_confidentiality_invalid");
  const proposalReference = normalizedOptionalOperatorText(input.proposalReference, 1, 120, "Proposal reference");
  const contractReference = normalizedOptionalOperatorText(input.contractReference, 1, 120, "Contract reference");
  const invoiceReference = normalizedOptionalOperatorText(input.invoiceReference, 1, 120, "Invoice reference");
  const startsAt = normalizedEconomicTimestamp(input.startsAt, "Service start");
  const endsAt = input.endsAt === null ? null : normalizedEconomicTimestamp(input.endsAt, "Service end");
  if (endsAt !== null && Date.parse(endsAt) <= Date.parse(startsAt)) operatorInputError("Service end must be after its start.", "organization_service_end_invalid");
  if (input.confirmation !== "CREATE TEST ORGANIZATION SERVICE ENGAGEMENT") operatorInputError("Type CREATE TEST ORGANIZATION SERVICE ENGAGEMENT exactly before continuing.", "organization_service_confirmation_invalid");
  const body: OperatorOrganizationServiceInput = { clientRequestId, organizationId, authorizedSignerUserId, serviceCode, priceCode, statementOfWorkVersion, serviceTermsVersion, dataHandlingDisclosureVersion, confidentialityClass: input.confidentialityClass, proposalReference, contractReference, invoiceReference, startsAt, endsAt, confirmation: "CREATE TEST ORGANIZATION SERVICE ENGAGEMENT", reason: normalizedOperatorReason(input.reason) };
  const data = await billingFetch("/api/billing/operator/organization-service", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const engagement = operatorMutationEnvelope(data, "engagement", ["engagementId", "organizationId", "serviceCode", "status", "serviceTermsVersion", "testMode", "idempotentReplay"], "economic_operator_organization_service_invalid");
  const engagementId = marketplaceUuid(engagement.engagementId, "economic_operator_organization_service_invalid");
  if (engagement.organizationId !== organizationId || engagement.serviceCode !== serviceCode || engagement.status !== "contract_pending" || engagement.serviceTermsVersion !== serviceTermsVersion || typeof engagement.testMode !== "boolean" || typeof engagement.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The private organization-service result was invalid. No engagement should be assumed.", 503, "economic_operator_organization_service_invalid");
  }
  return { engagementId, organizationId, serviceCode, status: "contract_pending", serviceTermsVersion, testMode: currentBillingApiPublication() !== "live", idempotentReplay: engagement.idempotentReplay };
}

const organizationServiceReviewStatuses: Record<OperatorOrganizationServiceReviewAction, OperatorOrganizationServiceReviewResult["status"]> = {
  activate: "active", complete: "completed", cancel: "canceled", reconciliation_required: "reconciliation_required",
  resolve_resume: "active", resolve_complete: "completed", resolve_cancel: "canceled"
};

export async function reviewEconomicOperatorOrganizationService(input: OperatorOrganizationServiceReviewInput, accessToken: string): Promise<OperatorOrganizationServiceReviewResult> {
  const engagementId = normalizedOperatorUuid(input.engagementId, "Organization-service engagement ID");
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  const confirmation = operatorOrganizationServiceReviewConfirmations[input.action];
  if (!confirmation || input.confirmation !== confirmation) operatorInputError("Use the exact confirmation for the selected organization-service action.", "organization_service_review_confirmation_invalid");
  const body: OperatorOrganizationServiceReviewInput = { engagementId, clientRequestId, action: input.action, confirmation, reason: normalizedOperatorReason(input.reason) };
  const data = await billingFetch("/api/billing/operator/organization-service-review", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const review = operatorMutationEnvelope(data, "review", ["engagementId", "action", "status", "testMode", "idempotentReplay"], "economic_operator_organization_service_review_invalid");
  const expectedStatus = organizationServiceReviewStatuses[input.action];
  if (review.engagementId !== engagementId || review.action !== input.action || review.status !== expectedStatus || typeof review.testMode !== "boolean" || typeof review.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The organization-service review result was invalid. No status change should be assumed.", 503, "economic_operator_organization_service_review_invalid");
  }
  return { engagementId, action: input.action, status: expectedStatus, testMode: currentBillingApiPublication() !== "live", idempotentReplay: review.idempotentReplay };
}

export async function createEconomicOperatorSponsorshipAgreement(input: OperatorSponsorshipAgreementInput, accessToken: string): Promise<OperatorSponsorshipAgreementResult> {
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  const organizationId = normalizedOperatorUuid(input.organizationId, "Economic organization ID");
  const authorizedSignerUserId = normalizedOperatorUuid(input.authorizedSignerUserId, "Authorized signer Website Account ID");
  const purposeCode = normalizedEconomicCode(input.purposeCode, 100, "Sponsorship purpose code");
  const priceCode = normalizedEconomicCode(input.priceCode, 120, "Sponsorship price code");
  const agreementVersion = marketplaceDocumentVersion(input.agreementVersion, "sponsorship_agreement_version_invalid");
  const disclosureVersion = marketplaceDocumentVersion(input.disclosureVersion, "sponsorship_disclosure_version_invalid");
  const publicLabel = normalizedOptionalOperatorText(input.publicLabel, 2, 120, "Optional public label");
  const publicSummary = normalizedOptionalOperatorText(input.publicSummary, 1, 500, "Optional public summary");
  if (input.confirmation !== "CREATE TEST SPONSORSHIP AGREEMENT WITHOUT CONTROL") operatorInputError("Type CREATE TEST SPONSORSHIP AGREEMENT WITHOUT CONTROL exactly before continuing.", "sponsorship_agreement_confirmation_invalid");
  const body: OperatorSponsorshipAgreementInput = { clientRequestId, organizationId, authorizedSignerUserId, purposeCode, priceCode, agreementVersion, disclosureVersion, publicLabel, publicSummary, confirmation: "CREATE TEST SPONSORSHIP AGREEMENT WITHOUT CONTROL", reason: normalizedOperatorReason(input.reason) };
  const data = await billingFetch("/api/billing/operator/sponsorship-agreement", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const agreement = operatorMutationEnvelope(data, "agreement", ["sponsorshipAgreementId", "organizationId", "status", "publicRecognitionOptIn", "publicRecognitionApproved", "grantsAuthority", "testMode", "idempotentReplay"], "economic_operator_sponsorship_agreement_invalid");
  const sponsorshipAgreementId = marketplaceUuid(agreement.sponsorshipAgreementId, "economic_operator_sponsorship_agreement_invalid");
  if (agreement.organizationId !== organizationId || agreement.status !== "ethical_review" || agreement.publicRecognitionOptIn !== false || agreement.publicRecognitionApproved !== false || agreement.grantsAuthority !== false || typeof agreement.testMode !== "boolean" || typeof agreement.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The private sponsorship-agreement result was invalid. No agreement should be assumed.", 503, "economic_operator_sponsorship_agreement_invalid");
  }
  return { sponsorshipAgreementId, organizationId, status: "ethical_review", publicRecognitionOptIn: false, publicRecognitionApproved: false, grantsAuthority: false, testMode: currentBillingApiPublication() !== "live", idempotentReplay: agreement.idempotentReplay };
}

const sponsorshipReviewStatuses: Record<OperatorSponsorshipReviewAction, OperatorSponsorshipReviewResult["status"]> = {
  approve: "contract_pending", activate: "active", reject: "rejected", complete: "completed", cancel: "canceled",
  resolve_resume: "active", resolve_complete: "completed", resolve_cancel: "canceled"
};

export async function reviewEconomicOperatorSponsorship(input: OperatorSponsorshipReviewInput, accessToken: string): Promise<OperatorSponsorshipReviewResult> {
  const sponsorshipAgreementId = normalizedOperatorUuid(input.sponsorshipAgreementId, "Sponsorship agreement ID");
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  const confirmation = operatorSponsorshipReviewConfirmations[input.action];
  if (!confirmation || input.confirmation !== confirmation) operatorInputError("Use the exact confirmation for the selected sponsorship review action.", "sponsorship_review_confirmation_invalid");
  const body: OperatorSponsorshipReviewInput = { sponsorshipAgreementId, clientRequestId, action: input.action, confirmation, reason: normalizedOperatorReason(input.reason) };
  const data = await billingFetch("/api/billing/operator/sponsorship-review", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const review = operatorMutationEnvelope(data, "review", ["sponsorshipAgreementId", "action", "status", "grantsAuthority", "testMode", "idempotentReplay"], "economic_operator_sponsorship_review_invalid");
  const expectedStatus = sponsorshipReviewStatuses[input.action];
  if (review.sponsorshipAgreementId !== sponsorshipAgreementId || review.action !== input.action || review.status !== expectedStatus || review.grantsAuthority !== false || typeof review.testMode !== "boolean" || typeof review.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The private sponsorship review result was invalid. No status or authority change should be assumed.", 503, "economic_operator_sponsorship_review_invalid");
  }
  return { sponsorshipAgreementId, action: input.action, status: expectedStatus, grantsAuthority: false, testMode: currentBillingApiPublication() !== "live", idempotentReplay: review.idempotentReplay };
}

export async function setEconomicOperatorSponsorshipRecognition(input: OperatorSponsorshipRecognitionInput, accessToken: string): Promise<OperatorSponsorshipRecognitionResult> {
  const sponsorshipAgreementId = normalizedOperatorUuid(input.sponsorshipAgreementId, "Sponsorship agreement ID");
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  const confirmation = input.approved ? "APPROVE NEUTRAL SPONSORSHIP RECOGNITION" : "REVOKE NEUTRAL SPONSORSHIP RECOGNITION";
  if (input.confirmation !== confirmation) operatorInputError(`Type ${confirmation} exactly before continuing.`, "sponsorship_recognition_confirmation_invalid");
  const body: OperatorSponsorshipRecognitionInput = { sponsorshipAgreementId, clientRequestId, approved: input.approved, confirmation, reason: normalizedOperatorReason(input.reason) };
  const data = await billingFetch("/api/billing/operator/sponsorship-recognition", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const recognition = operatorMutationEnvelope(data, "recognition", ["sponsorshipAgreementId", "publicRecognitionApproved", "amountsPublic", "grantsAuthority", "testMode", "idempotentReplay"], "economic_operator_sponsorship_recognition_invalid");
  if (recognition.sponsorshipAgreementId !== sponsorshipAgreementId || recognition.publicRecognitionApproved !== input.approved || recognition.amountsPublic !== false || recognition.grantsAuthority !== false || typeof recognition.testMode !== "boolean" || typeof recognition.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The neutral sponsorship-recognition result was invalid. No public display change should be assumed.", 503, "economic_operator_sponsorship_recognition_invalid");
  }
  return { sponsorshipAgreementId, publicRecognitionApproved: input.approved, amountsPublic: false, grantsAuthority: false, testMode: currentBillingApiPublication() !== "live", idempotentReplay: recognition.idempotentReplay };
}

export async function createEconomicOperatorSponsorshipAllocation(input: OperatorSponsorshipAllocationInput, accessToken: string): Promise<OperatorSponsorshipAllocationResult> {
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  const sponsorshipAgreementId = normalizedOperatorUuid(input.sponsorshipAgreementId, "Sponsorship agreement ID");
  const assistanceProgramId = normalizedOperatorUuid(input.assistanceProgramId, "Assistance program ID");
  if (!new Set(["funding_minor", "sandbox_credit_units", "grant_count"]).has(input.allocationKind)) operatorInputError("Choose a recognized sponsorship allocation kind.", "sponsorship_allocation_kind_invalid");
  if (!Number.isSafeInteger(input.allocationCap) || input.allocationCap < 1 || input.allocationCap > 100_000_000_000) operatorInputError("Allocation cap must be a whole number from 1 through 100,000,000,000.", "sponsorship_allocation_cap_invalid");
  const currency = input.allocationKind === "funding_minor" ? "usd" : null;
  if (input.currency !== currency) operatorInputError("Only funding-minor allocations use USD; service-unit and grant-count allocations have no currency.", "sponsorship_allocation_currency_invalid");
  if (input.confirmation !== "CREATE SPONSORSHIP ASSISTANCE ALLOCATION") operatorInputError("Type CREATE SPONSORSHIP ASSISTANCE ALLOCATION exactly before continuing.", "sponsorship_allocation_confirmation_invalid");
  const body: OperatorSponsorshipAllocationInput = { clientRequestId, sponsorshipAgreementId, assistanceProgramId, allocationKind: input.allocationKind, allocationCap: input.allocationCap, currency, confirmation: "CREATE SPONSORSHIP ASSISTANCE ALLOCATION", reason: normalizedOperatorReason(input.reason) };
  const data = await billingFetch("/api/billing/operator/sponsorship-allocation", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const allocation = operatorMutationEnvelope(data, "allocation", ["allocationId", "sponsorshipAgreementId", "assistanceProgramId", "scope", "allocationKind", "allocationCap", "currency", "sponsorSelectsRecipients", "sponsorReceivesRecipientData", "grantsAuthority", "testMode", "idempotentReplay"], "economic_operator_sponsorship_allocation_invalid");
  const allocationId = marketplaceUuid(allocation.allocationId, "economic_operator_sponsorship_allocation_invalid");
  if (allocation.sponsorshipAgreementId !== sponsorshipAgreementId || allocation.assistanceProgramId !== assistanceProgramId || (allocation.scope !== "job_post_fee" && allocation.scope !== "sandbox_credits") || allocation.allocationKind !== input.allocationKind || allocation.allocationCap !== input.allocationCap || allocation.currency !== currency || allocation.sponsorSelectsRecipients !== false || allocation.sponsorReceivesRecipientData !== false || allocation.grantsAuthority !== false || typeof allocation.testMode !== "boolean" || typeof allocation.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The sponsorship-assistance allocation result was invalid. No allocation or sponsor control should be assumed.", 503, "economic_operator_sponsorship_allocation_invalid");
  }
  return { allocationId, sponsorshipAgreementId, assistanceProgramId, scope: allocation.scope, allocationKind: input.allocationKind, allocationCap: input.allocationCap, currency, sponsorSelectsRecipients: false, sponsorReceivesRecipientData: false, grantsAuthority: false, testMode: currentBillingApiPublication() !== "live", idempotentReplay: allocation.idempotentReplay };
}

export async function closeEconomicOperatorSponsorshipAllocation(input: OperatorSponsorshipAllocationCloseInput, accessToken: string): Promise<OperatorSponsorshipAllocationCloseResult> {
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  const allocationId = normalizedOperatorUuid(input.allocationId, "Sponsorship allocation ID");
  if (input.confirmation !== "CLOSE SPONSORSHIP ASSISTANCE ALLOCATION") operatorInputError("Type CLOSE SPONSORSHIP ASSISTANCE ALLOCATION exactly before continuing.", "sponsorship_allocation_close_confirmation_invalid");
  const body: OperatorSponsorshipAllocationCloseInput = { clientRequestId, allocationId, confirmation: "CLOSE SPONSORSHIP ASSISTANCE ALLOCATION", reason: normalizedOperatorReason(input.reason) };
  const data = await billingFetch("/api/billing/operator/sponsorship-allocation-close", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const allocation = operatorMutationEnvelope(data, "allocation", ["allocationId", "status", "testMode", "idempotentReplay"], "economic_operator_sponsorship_allocation_close_invalid");
  if (allocation.allocationId !== allocationId || allocation.status !== "canceled" || typeof allocation.testMode !== "boolean" || typeof allocation.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The sponsorship-allocation close result was invalid. No closure should be assumed.", 503, "economic_operator_sponsorship_allocation_close_invalid");
  }
  return { allocationId, status: "canceled", testMode: currentBillingApiPublication() !== "live", idempotentReplay: allocation.idempotentReplay };
}

function operatorQueueTimestamp(value: unknown): string {
  const timestamp = marketplaceString(value, 40, "economic_operator_overview_invalid");
  if (Number.isNaN(Date.parse(timestamp))) accountProjectionError("economic_operator_overview_invalid");
  return timestamp;
}

function operatorQueueMoney(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 100_000_000_000) accountProjectionError("economic_operator_overview_invalid");
  return Number(value);
}

function operatorQueueCurrency(value: unknown): string {
  const currency = marketplaceString(value, 3, "economic_operator_overview_invalid");
  if (!/^[a-z]{3}$/.test(currency)) accountProjectionError("economic_operator_overview_invalid");
  return currency;
}

function boundedOperatorQueue(value: unknown, maximum = 10): unknown[] | null {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length > maximum) accountProjectionError("economic_operator_overview_invalid");
  return value;
}

export async function loadEconomicOperatorOverview(accessToken: string): Promise<EconomicOperatorOverview> {
  const data = await billingFetch("/api/billing/operator/overview", { cache: "no-store" }, accessToken);
  const envelope = exactRecord(data, ["ok", "operator"], "economic_operator_overview_invalid");
  const operator = exactRecord(envelope.operator, [
    "authorized", "capabilities", "queueLimit", "orderQueue", "paymentQueue", "refundablePaymentQueue",
    "refundQueue", "subscriptionQueue", "disputeQueue", "webhookQueue", "reconciliationQueue",
    "sandboxCorrectionQueue", "jobPostEconomicQueue", "sellerPayableQueue", "sellerPayoutPreparationQueue",
    "organizationServiceQueue", "sponsorshipQueue", "accountRequestQueue", "assistanceProgramQueue",
    "assistanceQueue", "featureFlags", "providerIdentifiersExposed", "personalContactDataExposed", "testMode"
  ], "economic_operator_overview_invalid");
  if (envelope.ok !== true || typeof operator.authorized !== "boolean" || typeof operator.testMode !== "boolean" || operator.providerIdentifiersExposed !== false || operator.personalContactDataExposed !== false || operator.queueLimit !== 10 || !Array.isArray(operator.capabilities)
    || operator.capabilities.length > economicOperatorCapabilities.size
    || operator.capabilities.some((capability) => typeof capability !== "string" || !economicOperatorCapabilities.has(capability as EconomicOperatorCapability))
    || new Set(operator.capabilities).size !== operator.capabilities.length) {
    throw new BillingRequestError("The private economic capability summary was invalid. No operator action is available.", 503, "economic_operator_overview_invalid");
  }
  const capabilities = operator.capabilities as EconomicOperatorCapability[];
  const orderRows = boundedOperatorQueue(operator.orderQueue);
  const paymentRows = boundedOperatorQueue(operator.paymentQueue);
  const refundablePaymentRows = boundedOperatorQueue(operator.refundablePaymentQueue);
  const refundRows = boundedOperatorQueue(operator.refundQueue);
  const subscriptionRows = boundedOperatorQueue(operator.subscriptionQueue);
  const disputeRows = boundedOperatorQueue(operator.disputeQueue);
  const webhookRows = boundedOperatorQueue(operator.webhookQueue);
  const reconciliationRows = boundedOperatorQueue(operator.reconciliationQueue);
  const sandboxCorrectionRows = boundedOperatorQueue(operator.sandboxCorrectionQueue);
  const jobPostRows = boundedOperatorQueue(operator.jobPostEconomicQueue);
  const sellerPayableRows = boundedOperatorQueue(operator.sellerPayableQueue);
  const sellerPayoutPreparationRows = boundedOperatorQueue(operator.sellerPayoutPreparationQueue);
  const organizationServiceRows = boundedOperatorQueue(operator.organizationServiceQueue);
  const sponsorshipRows = boundedOperatorQueue(operator.sponsorshipQueue);
  const accountRows = boundedOperatorQueue(operator.accountRequestQueue);
  const assistanceProgramRows = boundedOperatorQueue(operator.assistanceProgramQueue);
  const assistanceRows = boundedOperatorQueue(operator.assistanceQueue);
  const featureFlagRows = boundedOperatorQueue(operator.featureFlags, economicOperatorFeatureFlagKeys.length);
  const queueCapabilities: Array<[readonly EconomicOperatorCapability[], unknown[] | null]> = [
    [["economic_orders_view"], orderRows],
    [["economic_payments_view"], paymentRows],
    [["economic_refunds_manage"], refundablePaymentRows],
    [["economic_refunds_manage"], refundRows],
    [["recurring_support_manage"], subscriptionRows],
    [["economic_reconciliation_manage"], disputeRows],
    [["economic_reconciliation_manage", "economic_audit_view"], webhookRows],
    [["economic_reconciliation_manage"], reconciliationRows],
    [["sandbox_credits_adjust"], sandboxCorrectionRows],
    [["job_fee_assess"], jobPostRows],
    [["marketplace_payout_manage"], sellerPayableRows],
    [["marketplace_payout_manage"], sellerPayoutPreparationRows],
    [["organization_billing_manage"], organizationServiceRows],
    [["sponsorship_manage"], sponsorshipRows],
    [["economic_account_requests_manage"], accountRows],
    [["economic_assistance_manage"], assistanceProgramRows],
    [["economic_assistance_manage"], assistanceRows],
    [["economic_feature_flags_manage"], featureFlagRows]
  ];
  if (operator.authorized !== (capabilities.length > 0) || queueCapabilities.some(([required, rows]) => required.some((capability) => capabilities.includes(capability)) !== (rows !== null))) {
    throw new BillingRequestError("The private economic capability summary was invalid. No operator action is available.", 503, "economic_operator_overview_invalid");
  }
  const nullableUuid = (value: unknown) => value === null ? null : marketplaceUuid(value, "economic_operator_overview_invalid");
  const nullableTimestamp = (value: unknown) => value === null ? null : operatorQueueTimestamp(value);
  const queueCode = (value: unknown, maximum = 120) => {
    const code = marketplaceString(value, maximum, "economic_operator_overview_invalid");
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(code)) accountProjectionError("economic_operator_overview_invalid");
    return code;
  };
  const nullableCode = (value: unknown, maximum = 120) => value === null ? null : queueCode(value, maximum);
  const queueUnits = (value: unknown, minimum = 0) => {
    if (!Number.isSafeInteger(value) || Number(value) < minimum) accountProjectionError("economic_operator_overview_invalid");
    return Number(value);
  };
  const orderFlows = new Set(["support_one_time", "support_recurring", "sandbox_credits", "job_post_fee", "marketplace_purchase", "organization_service", "sponsorship"]);
  const orderStatuses = new Set(["pending", "checkout_created", "processing", "paid", "failed", "canceled", "partially_refunded", "refunded", "disputed"]);
  const orderQueue = orderRows?.map((value): EconomicOperatorOrderQueueItem => {
    const row = exactRecord(value, ["orderId", "publicReference", "flow", "status", "amountMinor", "currency", "createdAt"], "economic_operator_overview_invalid");
    const publicReference = marketplaceString(row.publicReference, 160, "economic_operator_overview_invalid");
    const flow = marketplaceString(row.flow, 60, "economic_operator_overview_invalid");
    const status = marketplaceString(row.status, 40, "economic_operator_overview_invalid");
    const amountMinor = operatorQueueMoney(row.amountMinor);
    if (!/^[A-Za-z0-9_-]{24,160}$/.test(publicReference) || !orderFlows.has(flow) || !orderStatuses.has(status) || amountMinor < 1) accountProjectionError("economic_operator_overview_invalid");
    return { orderId: marketplaceUuid(row.orderId, "economic_operator_overview_invalid"), publicReference, flow, status, amountMinor, currency: operatorQueueCurrency(row.currency), createdAt: operatorQueueTimestamp(row.createdAt) };
  }) ?? null;
  const paymentStatuses = new Set<EconomicOperatorPaymentQueueItem["status"]>(["pending", "succeeded", "failed", "canceled", "refunded", "disputed"]);
  const paymentQueue = paymentRows?.map((value): EconomicOperatorPaymentQueueItem => {
    const row = exactRecord(value, ["paymentTransactionId", "orderId", "publicReference", "flow", "status", "grossAmountMinor", "processorFeeMinor", "netAmountMinor", "currency", "occurredAt"], "economic_operator_overview_invalid");
    const publicReference = marketplaceString(row.publicReference, 160, "economic_operator_overview_invalid");
    const flow = marketplaceString(row.flow, 40, "economic_operator_overview_invalid");
    const status = row.status as EconomicOperatorPaymentQueueItem["status"];
    const grossAmountMinor = operatorQueueMoney(row.grossAmountMinor);
    const processorFeeMinor = row.processorFeeMinor === null ? null : operatorQueueMoney(row.processorFeeMinor);
    const netAmountMinor = row.netAmountMinor === null ? null : operatorQueueMoney(row.netAmountMinor);
    if (!/^[A-Za-z0-9_-]{24,160}$/.test(publicReference) || !orderFlows.has(flow) || !paymentStatuses.has(status)
      || (processorFeeMinor !== null && processorFeeMinor > grossAmountMinor) || (netAmountMinor !== null && netAmountMinor > grossAmountMinor)
      || (processorFeeMinor !== null && netAmountMinor !== null && netAmountMinor !== grossAmountMinor - processorFeeMinor)) accountProjectionError("economic_operator_overview_invalid");
    return { paymentTransactionId: marketplaceUuid(row.paymentTransactionId, "economic_operator_overview_invalid"), orderId: marketplaceUuid(row.orderId, "economic_operator_overview_invalid"), publicReference, flow, status, grossAmountMinor, processorFeeMinor, netAmountMinor, currency: operatorQueueCurrency(row.currency), occurredAt: operatorQueueTimestamp(row.occurredAt) };
  }) ?? null;
  const refundablePaymentStatuses = new Set<EconomicOperatorRefundablePaymentQueueItem["status"]>(["succeeded", "refunded", "disputed"]);
  const refundablePaymentQueue = refundablePaymentRows?.map((value): EconomicOperatorRefundablePaymentQueueItem => {
    const row = exactRecord(value, ["paymentTransactionId", "orderId", "publicReference", "flow", "status", "grossAmountMinor", "refundableAmountMinor", "currency", "occurredAt"], "economic_operator_overview_invalid");
    const publicReference = marketplaceString(row.publicReference, 160, "economic_operator_overview_invalid");
    const flow = marketplaceString(row.flow, 60, "economic_operator_overview_invalid");
    const status = row.status as EconomicOperatorRefundablePaymentQueueItem["status"];
    const grossAmountMinor = operatorQueueMoney(row.grossAmountMinor);
    const refundableAmountMinor = operatorQueueMoney(row.refundableAmountMinor);
    if (!/^[A-Za-z0-9_-]{24,160}$/.test(publicReference) || !orderFlows.has(flow)
      || !refundablePaymentStatuses.has(status) || grossAmountMinor < 1 || refundableAmountMinor < 1 || refundableAmountMinor > grossAmountMinor) {
      accountProjectionError("economic_operator_overview_invalid");
    }
    return {
      paymentTransactionId: marketplaceUuid(row.paymentTransactionId, "economic_operator_overview_invalid"),
      orderId: marketplaceUuid(row.orderId, "economic_operator_overview_invalid"),
      publicReference,
      flow,
      status,
      grossAmountMinor,
      refundableAmountMinor,
      currency: operatorQueueCurrency(row.currency),
      occurredAt: operatorQueueTimestamp(row.occurredAt)
    };
  }) ?? null;
  const refundStatuses = new Set(["held_for_review", "approved_for_provider", "provider_pending"]);
  const refundQueue = refundRows?.map((value): EconomicOperatorRefundQueueItem => {
    const row = exactRecord(value, ["requestId", "orderId", "paymentTransactionId", "status", "amountMinor", "currency", "createdAt"], "economic_operator_overview_invalid");
    const status = marketplaceString(row.status, 40, "economic_operator_overview_invalid");
    const amountMinor = operatorQueueMoney(row.amountMinor);
    if (!refundStatuses.has(status) || amountMinor < 1) accountProjectionError("economic_operator_overview_invalid");
    return { requestId: marketplaceUuid(row.requestId, "economic_operator_overview_invalid"), orderId: marketplaceUuid(row.orderId, "economic_operator_overview_invalid"), paymentTransactionId: marketplaceUuid(row.paymentTransactionId, "economic_operator_overview_invalid"), status, amountMinor, currency: operatorQueueCurrency(row.currency), createdAt: operatorQueueTimestamp(row.createdAt) };
  }) ?? null;
  const subscriptionStatuses = new Set<EconomicOperatorSubscriptionQueueItem["status"]>(["incomplete", "active", "past_due", "grace_period", "canceling"]);
  const subscriptionQueue = subscriptionRows?.map((value): EconomicOperatorSubscriptionQueueItem => {
    const row = exactRecord(value, ["subscriptionId", "userId", "originatingOrderId", "status", "cancelAtPeriodEnd", "currentPeriodEnd", "updatedAt"], "economic_operator_overview_invalid");
    const status = row.status as EconomicOperatorSubscriptionQueueItem["status"];
    if (!subscriptionStatuses.has(status) || typeof row.cancelAtPeriodEnd !== "boolean") accountProjectionError("economic_operator_overview_invalid");
    return { subscriptionId: marketplaceUuid(row.subscriptionId, "economic_operator_overview_invalid"), userId: marketplaceUuid(row.userId, "economic_operator_overview_invalid"), originatingOrderId: nullableUuid(row.originatingOrderId), status, cancelAtPeriodEnd: row.cancelAtPeriodEnd, currentPeriodEnd: nullableTimestamp(row.currentPeriodEnd), updatedAt: operatorQueueTimestamp(row.updatedAt) };
  }) ?? null;
  const disputeStatuses = new Set<EconomicOperatorDisputeQueueItem["status"]>(["warning_needs_response", "warning_under_review", "needs_response", "under_review", "lost"]);
  const disputeQueue = disputeRows?.map((value): EconomicOperatorDisputeQueueItem => {
    const row = exactRecord(value, ["disputeId", "orderId", "paymentTransactionId", "status", "reasonCode", "amountMinor", "currency", "createdAt", "updatedAt"], "economic_operator_overview_invalid");
    const status = row.status as EconomicOperatorDisputeQueueItem["status"];
    const reasonCode = nullableCode(row.reasonCode);
    if (!disputeStatuses.has(status) || operatorQueueMoney(row.amountMinor) < 1) accountProjectionError("economic_operator_overview_invalid");
    return { disputeId: marketplaceUuid(row.disputeId, "economic_operator_overview_invalid"), orderId: marketplaceUuid(row.orderId, "economic_operator_overview_invalid"), paymentTransactionId: marketplaceUuid(row.paymentTransactionId, "economic_operator_overview_invalid"), status, reasonCode, amountMinor: Number(row.amountMinor), currency: operatorQueueCurrency(row.currency), createdAt: operatorQueueTimestamp(row.createdAt), updatedAt: operatorQueueTimestamp(row.updatedAt) };
  }) ?? null;
  const webhookStatuses = new Set<EconomicOperatorWebhookQueueItem["processingStatus"]>(["received", "failed", "unmatched"]);
  const webhookQueue = webhookRows?.map((value): EconomicOperatorWebhookQueueItem => {
    const row = exactRecord(value, ["eventId", "eventType", "processingStatus", "processingAttempts", "eventCreatedAt", "receivedAt"], "economic_operator_overview_invalid");
    const processingStatus = row.processingStatus as EconomicOperatorWebhookQueueItem["processingStatus"];
    const processingAttempts = queueUnits(row.processingAttempts, 1);
    if (!webhookStatuses.has(processingStatus) || processingAttempts > 1_000_000) accountProjectionError("economic_operator_overview_invalid");
    return { eventId: marketplaceUuid(row.eventId, "economic_operator_overview_invalid"), eventType: queueCode(row.eventType), processingStatus, processingAttempts, eventCreatedAt: operatorQueueTimestamp(row.eventCreatedAt), receivedAt: operatorQueueTimestamp(row.receivedAt) };
  }) ?? null;
  const reconciliationStatuses = new Set(["open", "investigating", "waiting_for_provider"]);
  const reconciliationCaseKinds = new Set<EconomicOperatorReconciliationQueueItem["caseKind"]>([
    "economic_reconciliation_case", "marketplace_fulfillment_hold", "job_post_payment_hold",
    "organization_service_settlement_hold", "sponsorship_settlement_hold"
  ]);
  const reconciliationQueue = reconciliationRows?.map((value): EconomicOperatorReconciliationQueueItem => {
    const row = exactRecord(value, ["caseId", "orderId", "caseKind", "status", "openedAt"], "economic_operator_overview_invalid");
    const caseKind = marketplaceString(row.caseKind, 80, "economic_operator_overview_invalid") as EconomicOperatorReconciliationQueueItem["caseKind"];
    const status = marketplaceString(row.status, 40, "economic_operator_overview_invalid");
    if (!reconciliationStatuses.has(status) || !reconciliationCaseKinds.has(caseKind)) accountProjectionError("economic_operator_overview_invalid");
    return { caseId: marketplaceUuid(row.caseId, "economic_operator_overview_invalid"), orderId: marketplaceUuid(row.orderId, "economic_operator_overview_invalid"), caseKind, status, openedAt: operatorQueueTimestamp(row.openedAt) };
  }) ?? null;
  const sandboxKinds = new Set<EconomicOperatorSandboxCorrectionQueueItem["adjustmentKind"]>(["refund_or_lost_dispute", "active_dispute_hold"]);
  const sandboxStatuses = new Set<EconomicOperatorSandboxCorrectionQueueItem["status"]>(["open", "reviewed"]);
  const sandboxCorrectionQueue = sandboxCorrectionRows?.map((value): EconomicOperatorSandboxCorrectionQueueItem => {
    const row = exactRecord(value, ["shortfallId", "fulfillmentId", "fulfillmentScope", "orderId", "paymentTransactionId", "adjustmentKind", "targetUnits", "appliedUnits", "missingUnits", "status", "createdAt"], "economic_operator_overview_invalid");
    const fulfillmentScope = row.fulfillmentScope as EconomicOperatorSandboxCorrectionQueueItem["fulfillmentScope"];
    const orderId = marketplaceUuid(row.orderId, "economic_operator_overview_invalid");
    const paymentTransactionId = nullableUuid(row.paymentTransactionId);
    const adjustmentKind = row.adjustmentKind as EconomicOperatorSandboxCorrectionQueueItem["adjustmentKind"];
    const status = row.status as EconomicOperatorSandboxCorrectionQueueItem["status"];
    const targetUnits = queueUnits(row.targetUnits, 1);
    const appliedUnits = queueUnits(row.appliedUnits);
    const missingUnits = queueUnits(row.missingUnits, 1);
    if (!new Set(["sandbox_credit_order", "recurring_support_payment"]).has(fulfillmentScope)
      || (fulfillmentScope === "sandbox_credit_order" && paymentTransactionId !== null)
      || (fulfillmentScope === "recurring_support_payment" && paymentTransactionId === null)
      || !sandboxKinds.has(adjustmentKind) || !sandboxStatuses.has(status) || appliedUnits + missingUnits !== targetUnits) accountProjectionError("economic_operator_overview_invalid");
    return { shortfallId: marketplaceUuid(row.shortfallId, "economic_operator_overview_invalid"), fulfillmentId: marketplaceUuid(row.fulfillmentId, "economic_operator_overview_invalid"), fulfillmentScope, orderId, paymentTransactionId, adjustmentKind, targetUnits, appliedUnits, missingUnits, status, createdAt: operatorQueueTimestamp(row.createdAt) };
  }) ?? null;
  const jobClassifications = new Set<EconomicOperatorJobPostQueueItem["classification"]>(["not_assessed", "community_free", "commercial", "waived", "subsidized"]);
  const jobStatuses = new Set<EconomicOperatorJobPostQueueItem["status"]>(["not_assessed", "payment_required", "payment_pending", "refunded", "disputed", "reconciliation_required"]);
  const jobPostEconomicQueue = jobPostRows?.map((value): EconomicOperatorJobPostQueueItem => {
    const row = exactRecord(value, ["conditionId", "jobPostId", "authorUserId", "classification", "status", "orderId", "termsVersion", "updatedAt"], "economic_operator_overview_invalid");
    const classification = row.classification as EconomicOperatorJobPostQueueItem["classification"];
    const status = row.status as EconomicOperatorJobPostQueueItem["status"];
    if (!jobClassifications.has(classification) || !jobStatuses.has(status)) accountProjectionError("economic_operator_overview_invalid");
    return { conditionId: marketplaceUuid(row.conditionId, "economic_operator_overview_invalid"), jobPostId: marketplaceUuid(row.jobPostId, "economic_operator_overview_invalid"), authorUserId: marketplaceUuid(row.authorUserId, "economic_operator_overview_invalid"), classification, status, orderId: nullableUuid(row.orderId), termsVersion: nullableCode(row.termsVersion), updatedAt: operatorQueueTimestamp(row.updatedAt) };
  }) ?? null;
  const sellerPayableQueue = sellerPayableRows?.map((value): EconomicOperatorSellerPayableQueueItem => {
    const row = exactRecord(value, ["sellerAccountId", "currency", "availablePayableMinor", "sellerStatus"], "economic_operator_overview_invalid");
    const availablePayableMinor = operatorQueueMoney(row.availablePayableMinor);
    if (availablePayableMinor < 1) accountProjectionError("economic_operator_overview_invalid");
    return { sellerAccountId: marketplaceUuid(row.sellerAccountId, "economic_operator_overview_invalid"), currency: operatorQueueCurrency(row.currency), availablePayableMinor, sellerStatus: queueCode(row.sellerStatus, 40) };
  }) ?? null;
  const sellerPayoutStatuses = new Set<EconomicOperatorSellerPayoutPreparationQueueItem["status"]>(["prepared", "transfer_pending"]);
  const sellerPayoutPreparationQueue = sellerPayoutPreparationRows?.map((value): EconomicOperatorSellerPayoutPreparationQueueItem => {
    const row = exactRecord(value, ["payoutPreparationId", "sellerAccountId", "amountMinor", "currency", "status", "createdAt"], "economic_operator_overview_invalid");
    const status = row.status as EconomicOperatorSellerPayoutPreparationQueueItem["status"];
    const amountMinor = operatorQueueMoney(row.amountMinor);
    if (!sellerPayoutStatuses.has(status) || amountMinor < 1) accountProjectionError("economic_operator_overview_invalid");
    return { payoutPreparationId: marketplaceUuid(row.payoutPreparationId, "economic_operator_overview_invalid"), sellerAccountId: marketplaceUuid(row.sellerAccountId, "economic_operator_overview_invalid"), amountMinor, currency: operatorQueueCurrency(row.currency), status, createdAt: operatorQueueTimestamp(row.createdAt) };
  }) ?? null;
  const organizationStatuses = new Set<EconomicOperatorOrganizationServiceQueueItem["status"]>(["contract_pending", "active", "reconciliation_required"]);
  const entitlementStates = new Set<EconomicOperatorOrganizationServiceQueueItem["entitlementState"]>(["pending", "active", "fulfilled", "suspended", "ended"]);
  const supportStates = new Set<EconomicOperatorOrganizationServiceQueueItem["supportAgreementState"]>(["pending", "active", "suspended", "expired", "terminated", "not_applicable"]);
  const organizationServiceQueue = organizationServiceRows?.map((value): EconomicOperatorOrganizationServiceQueueItem => {
    const row = exactRecord(value, ["engagementId", "organizationId", "serviceCode", "status", "entitlementState", "supportAgreementState", "orderId", "updatedAt"], "economic_operator_overview_invalid");
    const status = row.status as EconomicOperatorOrganizationServiceQueueItem["status"];
    const entitlementState = row.entitlementState as EconomicOperatorOrganizationServiceQueueItem["entitlementState"];
    const supportAgreementState = row.supportAgreementState as EconomicOperatorOrganizationServiceQueueItem["supportAgreementState"];
    if (!organizationStatuses.has(status) || !entitlementStates.has(entitlementState) || !supportStates.has(supportAgreementState)) accountProjectionError("economic_operator_overview_invalid");
    return { engagementId: marketplaceUuid(row.engagementId, "economic_operator_overview_invalid"), organizationId: marketplaceUuid(row.organizationId, "economic_operator_overview_invalid"), serviceCode: queueCode(row.serviceCode, 100), status, entitlementState, supportAgreementState, orderId: nullableUuid(row.orderId), updatedAt: operatorQueueTimestamp(row.updatedAt) };
  }) ?? null;
  const sponsorshipStatuses = new Set<EconomicOperatorSponsorshipQueueItem["status"]>(["ethical_review", "contract_pending", "active", "reconciliation_required"]);
  const sponsorshipQueue = sponsorshipRows?.map((value): EconomicOperatorSponsorshipQueueItem => {
    const row = exactRecord(value, ["sponsorshipAgreementId", "organizationId", "status", "purposeCode", "publicRecognitionOptIn", "publicRecognitionApproved", "orderId", "updatedAt"], "economic_operator_overview_invalid");
    const status = row.status as EconomicOperatorSponsorshipQueueItem["status"];
    if (!sponsorshipStatuses.has(status) || typeof row.publicRecognitionOptIn !== "boolean" || typeof row.publicRecognitionApproved !== "boolean" || (row.publicRecognitionApproved && !row.publicRecognitionOptIn)) accountProjectionError("economic_operator_overview_invalid");
    return { sponsorshipAgreementId: marketplaceUuid(row.sponsorshipAgreementId, "economic_operator_overview_invalid"), organizationId: marketplaceUuid(row.organizationId, "economic_operator_overview_invalid"), status, purposeCode: queueCode(row.purposeCode, 100), publicRecognitionOptIn: row.publicRecognitionOptIn, publicRecognitionApproved: row.publicRecognitionApproved, orderId: nullableUuid(row.orderId), updatedAt: operatorQueueTimestamp(row.updatedAt) };
  }) ?? null;
  const openAccountStatuses = new Set<EconomicOperatorAccountRequestQueueItem["status"]>(["submitted", "identity_verification", "operator_review", "processing"]);
  const accountRequestQueue = accountRows?.map((value): EconomicOperatorAccountRequestQueueItem => {
    const row = exactRecord(value, ["requestId", "requestType", "status", "submittedAt", "providerCancellationRequired"], "economic_operator_overview_invalid");
    const requestType = row.requestType as EconomicAccountRequestType;
    const status = row.status as EconomicOperatorAccountRequestQueueItem["status"];
    if (!economicAccountRequestTypes.has(requestType) || !openAccountStatuses.has(status) || typeof row.providerCancellationRequired !== "boolean") accountProjectionError("economic_operator_overview_invalid");
    return { requestId: marketplaceUuid(row.requestId, "economic_operator_overview_invalid"), requestType, status, submittedAt: operatorQueueTimestamp(row.submittedAt), providerCancellationRequired: row.providerCancellationRequired };
  }) ?? null;
  const assistanceKinds = new Set<EconomicOperatorAssistanceProgramQueueItem["kind"]>(["waiver", "subsidy", "sponsored_access"]);
  const assistanceScopes = new Set<EconomicOperatorAssistanceQueueItem["scope"]>(["job_post_fee", "sandbox_credits"]);
  const assistanceProgramStatuses = new Set<EconomicOperatorAssistanceProgramQueueItem["status"]>(["draft", "active", "paused", "retired"]);
  const assistanceProgramQueue = assistanceProgramRows?.map((value): EconomicOperatorAssistanceProgramQueueItem => {
    const row = exactRecord(value, ["programId", "programCode", "kind", "scope", "status", "startsAt", "endsAt", "updatedAt"], "economic_operator_overview_invalid");
    const kind = row.kind as EconomicOperatorAssistanceProgramQueueItem["kind"];
    const scope = row.scope as EconomicOperatorAssistanceProgramQueueItem["scope"];
    const status = row.status as EconomicOperatorAssistanceProgramQueueItem["status"];
    if (!assistanceKinds.has(kind) || !assistanceScopes.has(scope) || !assistanceProgramStatuses.has(status)) accountProjectionError("economic_operator_overview_invalid");
    return { programId: marketplaceUuid(row.programId, "economic_operator_overview_invalid"), programCode: queueCode(row.programCode, 100), kind, scope, status, startsAt: operatorQueueTimestamp(row.startsAt), endsAt: nullableTimestamp(row.endsAt), updatedAt: operatorQueueTimestamp(row.updatedAt) };
  }) ?? null;
  const assistanceStatuses = new Set<EconomicOperatorAssistanceQueueItem["status"]>(["granted", "consumed", "revoked", "expired"]);
  const assistanceQueue = assistanceRows?.map((value): EconomicOperatorAssistanceQueueItem => {
    const row = exactRecord(value, ["grantId", "scope", "status", "expiresAt"], "economic_operator_overview_invalid");
    const scope = row.scope as EconomicOperatorAssistanceQueueItem["scope"];
    const status = row.status as EconomicOperatorAssistanceQueueItem["status"];
    const expiresAt = row.expiresAt === null ? null : operatorQueueTimestamp(row.expiresAt);
    if (!assistanceScopes.has(scope) || !assistanceStatuses.has(status)) accountProjectionError("economic_operator_overview_invalid");
    return { grantId: marketplaceUuid(row.grantId, "economic_operator_overview_invalid"), scope, status, expiresAt };
  }) ?? null;
  const featureFlags = featureFlagRows?.map((value): EconomicOperatorFeatureFlagItem => {
    const row = exactRecord(value, ["featureKey", "enabled", "testModeOnly", "updatedAt"], "economic_operator_overview_invalid");
    if (typeof row.enabled !== "boolean" || typeof row.testModeOnly !== "boolean") accountProjectionError("economic_operator_overview_invalid");
    return { featureKey: queueCode(row.featureKey, 80), enabled: row.enabled, testModeOnly: row.testModeOnly, updatedAt: operatorQueueTimestamp(row.updatedAt) };
  }) ?? null;
  if (featureFlags && (
    featureFlags.length !== economicOperatorFeatureFlagKeys.length
    || featureFlags.some((flag, index) => flag.featureKey !== economicOperatorFeatureFlagKeys[index])
  )) accountProjectionError("economic_operator_overview_invalid");
  return { authorized: operator.authorized, capabilities, queueLimit: 10, orderQueue, paymentQueue, refundablePaymentQueue, refundQueue, subscriptionQueue, disputeQueue, webhookQueue, reconciliationQueue, sandboxCorrectionQueue, jobPostEconomicQueue, sellerPayableQueue, sellerPayoutPreparationQueue, organizationServiceQueue, sponsorshipQueue, accountRequestQueue, assistanceProgramQueue, assistanceQueue, featureFlags, providerIdentifiersExposed: false, personalContactDataExposed: false, testMode: currentBillingApiPublication() !== "live" };
}

export async function loadEconomicOperatorAudit(accessToken: string, options: { limit?: number; cursor?: EconomicAuditCursor | null } = {}): Promise<EconomicAuditPage> {
  const limit = options.limit ?? 50;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) operatorInputError("Economic audit page size must be 1 through 100.", "economic_audit_limit_invalid");
  const query = new URLSearchParams({ limit: String(limit) });
  if (options.cursor) {
    const afterCreatedAt = normalizedEconomicTimestamp(options.cursor.afterCreatedAt, "Economic audit cursor time");
    const afterId = normalizedOperatorUuid(options.cursor.afterId, "Economic audit cursor ID");
    query.set("afterCreatedAt", afterCreatedAt);
    query.set("afterId", afterId);
  }
  const data = await billingFetch(`/api/billing/operator/audit?${query.toString()}`, { cache: "no-store" }, accessToken);
  const envelope = exactRecord(data, ["ok", "audit"], "economic_operator_audit_invalid");
  const audit = exactRecord(envelope.audit, ["events", "limit", "nextCursor", "providerIdentifiersExposed", "personalContactDataExposed", "testMode"], "economic_operator_audit_invalid");
  if (envelope.ok !== true || audit.limit !== limit || !Array.isArray(audit.events) || audit.events.length > limit || audit.providerIdentifiersExposed !== false || audit.personalContactDataExposed !== false || typeof audit.testMode !== "boolean") {
    throw new BillingRequestError("The private economic audit page was invalid. No audit conclusion should be drawn.", 503, "economic_operator_audit_invalid");
  }
  const actorKinds = new Set<EconomicAuditActorKind>(["system", "user", "economic_operator", "provider_webhook"]);
  const events = audit.events.map((value): EconomicAuditEvent => {
    const event = exactRecord(value, ["eventId", "action", "targetType", "targetId", "actorKind", "createdAt"], "economic_operator_audit_invalid");
    const eventId = marketplaceUuid(event.eventId, "economic_operator_audit_invalid");
    const action = marketplaceString(event.action, 120, "economic_operator_audit_invalid");
    const targetType = marketplaceString(event.targetType, 120, "economic_operator_audit_invalid");
    const targetId = event.targetId === null ? null : marketplaceUuid(event.targetId, "economic_operator_audit_invalid");
    const createdAt = marketplaceString(event.createdAt, 40, "economic_operator_audit_invalid");
    if (!/^[a-z][a-z0-9_]{0,119}$/.test(action) || !/^[a-z][a-z0-9_]{0,119}$/.test(targetType) || typeof event.actorKind !== "string" || !actorKinds.has(event.actorKind as EconomicAuditActorKind) || Number.isNaN(Date.parse(createdAt))) {
      throw new BillingRequestError("The private economic audit page was invalid. No audit conclusion should be drawn.", 503, "economic_operator_audit_invalid");
    }
    return { eventId, action, targetType, targetId, actorKind: event.actorKind as EconomicAuditActorKind, createdAt };
  });
  let nextCursor: EconomicAuditCursor | null = null;
  if (audit.nextCursor !== null) {
    const cursor = exactRecord(audit.nextCursor, ["afterCreatedAt", "afterId"], "economic_operator_audit_invalid");
    const afterCreatedAt = marketplaceString(cursor.afterCreatedAt, 40, "economic_operator_audit_invalid");
    if (Number.isNaN(Date.parse(afterCreatedAt))) throw new BillingRequestError("The private economic audit cursor was invalid.", 503, "economic_operator_audit_invalid");
    nextCursor = { afterCreatedAt, afterId: marketplaceUuid(cursor.afterId, "economic_operator_audit_invalid") };
  }
  return { events, limit, nextCursor, providerIdentifiersExposed: false, personalContactDataExposed: false, testMode: currentBillingApiPublication() !== "live" };
}

export async function exportEconomicOperatorAccounting(input: OperatorAccountingExportInput, accessToken: string): Promise<OperatorAccountingExportResult> {
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  const from = normalizedEconomicTimestamp(input.from, "Accounting range start");
  const to = normalizedEconomicTimestamp(input.to, "Accounting range end");
  if (Date.parse(to) <= Date.parse(from) || Date.parse(to) - Date.parse(from) > 31 * 24 * 60 * 60 * 1_000) operatorInputError("Accounting exports must cover more than zero and no more than 31 days.", "economic_accounting_range_invalid");
  const afterCreatedAt = input.afterCreatedAt === null ? null : normalizedEconomicTimestamp(input.afterCreatedAt, "Accounting cursor time");
  const afterId = input.afterId === null ? null : normalizedOperatorUuid(input.afterId, "Accounting cursor ID");
  if ((afterCreatedAt === null) !== (afterId === null)) operatorInputError("Accounting cursor time and ID must be supplied together.", "economic_accounting_cursor_invalid");
  if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 100) operatorInputError("Accounting export page size must be 1 through 100.", "economic_accounting_limit_invalid");
  if (input.confirmation !== "EXPORT PRIVATE ECONOMIC ACCOUNTING") operatorInputError("Type EXPORT PRIVATE ECONOMIC ACCOUNTING exactly before continuing.", "economic_accounting_confirmation_invalid");
  const body: OperatorAccountingExportInput = { clientRequestId, from, to, afterCreatedAt, afterId, limit: input.limit, confirmation: "EXPORT PRIVATE ECONOMIC ACCOUNTING" };
  const data = await billingFetch("/api/billing/operator/accounting-export", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const accounting = operatorMutationEnvelope(data, "accountingExport", ["exportVersion", "entries", "limit", "from", "to", "providerIdentifiersExposed", "personalContactDataExposed", "testMode", "idempotentReplay"], "economic_accounting_export_invalid");
  if (accounting.exportVersion !== "economic-accounting-v1" || accounting.limit !== input.limit || accounting.from !== from || accounting.to !== to || accounting.providerIdentifiersExposed !== false || accounting.personalContactDataExposed !== false || typeof accounting.testMode !== "boolean" || typeof accounting.idempotentReplay !== "boolean" || !Array.isArray(accounting.entries) || accounting.entries.length > input.limit) {
    throw new BillingRequestError("The private accounting export was invalid. No export should be retained.", 503, "economic_accounting_export_invalid");
  }
  const nullableMinor = (value: unknown) => {
    if (value === null) return null;
    if (!Number.isSafeInteger(value) || Math.abs(Number(value)) > 1_000_000_000_000) throw new BillingRequestError("The private accounting export was invalid. No export should be retained.", 503, "economic_accounting_export_invalid");
    return Number(value);
  };
  const entries = accounting.entries.map((value): EconomicAccountingExportEntry => {
    const entry = exactRecord(value, ["exportVersion", "eventId", "effectiveAt", "recordedAt", "category", "economicFlow", "direction", "grossMinor", "refundMinor", "disputeMinor", "processorFeeMinor", "platformCommissionMinor", "sellerPayableMinor", "netMinor", "currency", "internalOrderReference", "provider", "providerEventDate", "jurisdiction", "taxTreatmentPendingReview", "reconciliationStatus"], "economic_accounting_export_invalid");
    const effectiveAt = marketplaceString(entry.effectiveAt, 40, "economic_accounting_export_invalid");
    const recordedAt = marketplaceString(entry.recordedAt, 40, "economic_accounting_export_invalid");
    const category = marketplaceString(entry.category, 80, "economic_accounting_export_invalid");
    const economicFlow = marketplaceString(entry.economicFlow, 40, "economic_accounting_export_invalid");
    const internalOrderReference = marketplaceString(entry.internalOrderReference, 160, "economic_accounting_export_invalid");
    const jurisdiction = entry.jurisdiction === null ? null : marketplaceString(entry.jurisdiction, 64, "economic_accounting_export_invalid");
    if (entry.exportVersion !== "economic-accounting-v1" || !billingUuidPattern.test(String(entry.eventId)) || Number.isNaN(Date.parse(effectiveAt)) || Number.isNaN(Date.parse(recordedAt)) || !new Set(["payment_received", "payment_state", "refund", "dispute", "marketplace_allocation"]).has(category) || !new Set(["support_one_time", "support_recurring", "sandbox_credits", "job_post_fee", "marketplace_purchase", "organization_service", "sponsorship"]).has(economicFlow) || !new Set(["inflow", "outflow", "memo"]).has(String(entry.direction)) || !/^[a-z]{3}$/.test(String(entry.currency)) || !/^[A-Za-z0-9_-]{24,160}$/.test(internalOrderReference) || entry.provider !== "stripe" || Number.isNaN(Date.parse(String(entry.providerEventDate))) || entry.taxTreatmentPendingReview !== true || !new Set(["recorded", "settlement_details_pending", "review"]).has(String(entry.reconciliationStatus))) {
      throw new BillingRequestError("The private accounting export was invalid. No export should be retained.", 503, "economic_accounting_export_invalid");
    }
    const grossMinor = nullableMinor(entry.grossMinor);
    const refundMinor = nullableMinor(entry.refundMinor);
    const disputeMinor = nullableMinor(entry.disputeMinor);
    const processorFeeMinor = nullableMinor(entry.processorFeeMinor);
    const platformCommissionMinor = nullableMinor(entry.platformCommissionMinor);
    const sellerPayableMinor = nullableMinor(entry.sellerPayableMinor);
    const netMinor = nullableMinor(entry.netMinor);
    if (entry.reconciliationStatus === "settlement_details_pending" && (category !== "payment_received" || (processorFeeMinor !== null && netMinor !== null))) {
      throw new BillingRequestError("The private accounting export contained a contradictory settlement state.", 503, "economic_accounting_export_invalid");
    }
    if (category === "payment_received" && entry.reconciliationStatus === "recorded" && (processorFeeMinor === null || (economicFlow !== "marketplace_purchase" && netMinor === null))) {
      throw new BillingRequestError("The private accounting export contained an incomplete recorded settlement.", 503, "economic_accounting_export_invalid");
    }
    return { exportVersion: "economic-accounting-v1", eventId: String(entry.eventId), effectiveAt, recordedAt, category, economicFlow: economicFlow as EconomicAccountingExportEntry["economicFlow"], direction: entry.direction as "inflow" | "outflow" | "memo", grossMinor, refundMinor, disputeMinor, processorFeeMinor, platformCommissionMinor, sellerPayableMinor, netMinor, currency: String(entry.currency), internalOrderReference, provider: "stripe", providerEventDate: String(entry.providerEventDate), jurisdiction, taxTreatmentPendingReview: true, reconciliationStatus: entry.reconciliationStatus as EconomicAccountingExportEntry["reconciliationStatus"] };
  });
  return { exportVersion: "economic-accounting-v1", entries, limit: input.limit, from, to, providerIdentifiersExposed: false, personalContactDataExposed: false, testMode: currentBillingApiPublication() !== "live", idempotentReplay: accounting.idempotentReplay };
}

export async function setEconomicOperatorAssignment(input: OperatorAssignmentInput, accessToken: string): Promise<OperatorAssignmentResult> {
  if (!economicOperatorCapabilities.has(input.capability)) operatorInputError("Choose a recognized narrow economic capability.", "operator_capability_invalid");
  const userId = normalizedOperatorUuid(input.userId, "Target Website Account ID");
  const confirmation = input.enabled ? "grant-economic-capability" : "revoke-economic-capability";
  if (input.confirmation !== confirmation) operatorInputError(`Type ${confirmation} exactly before continuing.`, "operator_assignment_confirmation_invalid");
  const body: OperatorAssignmentInput = {
    userId,
    capability: input.capability,
    enabled: input.enabled,
    confirmation,
    reason: normalizedOperatorReason(input.reason)
  };
  const data = await billingFetch("/api/billing/operator/assignment", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const assignment = operatorMutationEnvelope(data, "assignment", ["assignmentId", "userId", "capability", "active", "idempotentReplay"], "economic_operator_assignment_invalid");
  const assignmentId = assignment.assignmentId;
  if ((assignmentId !== null && (typeof assignmentId !== "string" || !billingUuidPattern.test(assignmentId)))
    || assignment.userId !== userId
    || assignment.capability !== input.capability
    || assignment.active !== input.enabled
    || typeof assignment.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The capability assignment result was invalid. No completed assignment should be assumed.", 503, "economic_operator_assignment_invalid");
  }
  return { assignmentId, userId, capability: input.capability, active: input.enabled, idempotentReplay: assignment.idempotentReplay };
}

export async function grantEconomicOperatorSandboxCredits(input: OperatorSandboxCreditGrantInput, accessToken: string): Promise<OperatorSandboxCreditGrantResult> {
  const userId = normalizedOperatorUuid(input.userId, "Target Website Account ID");
  const idempotencyKey = normalizedOperatorUuid(input.idempotencyKey, "Idempotency key");
  if (!Number.isSafeInteger(input.units) || input.units < 1 || input.units > 1_000_000_000) operatorInputError("Credit units must be a whole number from 1 through 1,000,000,000.", "operator_units_invalid");
  if (!operatorSandboxSources.has(input.sourceType)) operatorInputError("Choose a recognized non-purchase credit source.", "operator_source_type_invalid");
  const sourceReference = input.sourceReference?.trim() || null;
  if (sourceReference !== null && (sourceReference.length > 160 || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(sourceReference))) {
    operatorInputError("The optional source reference must start with a letter or number and use only letters, numbers, period, underscore, colon, slash, or hyphen.", "operator_source_reference_invalid");
  }
  const expiresAt = normalizedOperatorExpiration(input.expiresAt);
  const body = {
    userId,
    units: input.units,
    sourceType: input.sourceType,
    sourceReference,
    expiresAt,
    idempotencyKey,
    confirmation: "GRANT TEST SANDBOX SERVICE UNITS" as const,
    reason: normalizedOperatorReason(input.reason)
  };
  const data = await billingFetch("/api/billing/operator/sandbox-credit-grant", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const grant = operatorMutationEnvelope(data, "grant", ["creditLotId", "grantedUnits", "sourceCategory", "expiresAt", "idempotentReplay", "testMode"], "economic_operator_credit_grant_invalid");
  const returnedExpiration = grant.expiresAt;
  if (typeof grant.creditLotId !== "string" || !billingUuidPattern.test(grant.creditLotId)
    || grant.grantedUnits !== input.units
    || grant.sourceCategory !== input.sourceType
    || (returnedExpiration !== null && (typeof returnedExpiration !== "string" || !Number.isFinite(Date.parse(returnedExpiration))))
    || (expiresAt === null ? returnedExpiration !== null : Date.parse(String(returnedExpiration)) !== Date.parse(expiresAt))
    || typeof grant.idempotentReplay !== "boolean"
    || typeof grant.testMode !== "boolean") {
    throw new BillingRequestError("The sandbox credit grant result was invalid. No completed grant should be assumed.", 503, "economic_operator_credit_grant_invalid");
  }
  return {
    creditLotId: grant.creditLotId,
    grantedUnits: input.units,
    sourceCategory: input.sourceType,
    expiresAt: returnedExpiration as string | null,
    idempotentReplay: grant.idempotentReplay,
    testMode: currentBillingApiPublication() !== "live"
  };
}

export async function placeEconomicOperatorRefundHold(input: OperatorRefundHoldInput, accessToken: string): Promise<OperatorRefundHoldResult> {
  const orderId = normalizedOperatorUuid(input.orderId, "Internal economic order ID");
  const paymentTransactionId = normalizedOperatorUuid(input.paymentTransactionId, "Internal payment transaction ID");
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 1 || input.amountMinor > 1_000_000_000) {
    operatorInputError("Refund amount must be a whole number of minor currency units from 1 through 1,000,000,000.", "operator_refund_amount_invalid");
  }
  const body = { orderId, paymentTransactionId, amountMinor: input.amountMinor, clientRequestId, confirmation: "PLACE TEST REFUND HOLD" as const, reason: normalizedOperatorReason(input.reason) };
  const data = await billingFetch("/api/billing/operator/refund-hold", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const refundHold = operatorMutationEnvelope(data, "refundHold", ["refundRequestId", "orderId", "paymentTransactionId", "amountMinor", "currency", "status", "idempotentReplay"], "economic_operator_refund_hold_invalid");
  if (typeof refundHold.refundRequestId !== "string" || !billingUuidPattern.test(refundHold.refundRequestId)
    || refundHold.orderId !== orderId
    || refundHold.paymentTransactionId !== paymentTransactionId
    || refundHold.amountMinor !== input.amountMinor
    || refundHold.currency !== "usd"
    || typeof refundHold.status !== "string" || !refundHoldStatuses.has(refundHold.status as OperatorRefundHoldResult["status"])
    || typeof refundHold.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The refund-hold result was invalid. No completed refund action should be assumed.", 503, "economic_operator_refund_hold_invalid");
  }
  return {
    refundRequestId: refundHold.refundRequestId,
    orderId,
    paymentTransactionId,
    amountMinor: input.amountMinor,
    currency: "usd",
    status: refundHold.status as OperatorRefundHoldResult["status"],
    idempotentReplay: refundHold.idempotentReplay
  };
}

export async function executeEconomicOperatorTestRefund(input: OperatorTestRefundExecutionInput, accessToken: string): Promise<OperatorTestRefundExecutionResult> {
  const refundRequestId = normalizedOperatorUuid(input.refundRequestId, "Internal refund request ID");
  const approvalClientRequestId = normalizedOperatorUuid(input.approvalClientRequestId, "Approval request ID");
  const providerAttachClientRequestId = normalizedOperatorUuid(input.providerAttachClientRequestId, "Provider-result attachment request ID");
  if (approvalClientRequestId === providerAttachClientRequestId) operatorInputError("Approval and provider-result attachment require two independent request IDs.", "operator_refund_execution_idempotency_invalid");
  if (input.confirmation !== "AUTHORIZE TEST REFUND") operatorInputError("Type AUTHORIZE TEST REFUND exactly before continuing.", "operator_refund_execution_confirmation_invalid");
  const body: OperatorTestRefundExecutionInput = {
    refundRequestId,
    approvalClientRequestId,
    providerAttachClientRequestId,
    confirmation: "AUTHORIZE TEST REFUND",
    reason: normalizedOperatorReason(input.reason)
  };
  let data: JsonRecord;
  try {
    data = await billingFetch("/api/billing/operator/refund-execution", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  } catch (error) {
    if (error instanceof BillingRequestError && (error.status === 0 || error.status >= 500)) {
      throw new BillingRequestError("The Stripe test-refund result could not be confirmed. No completed test refund should be assumed. Retry the unchanged form so its same request identifiers are reused.", error.status, error.code);
    }
    throw error;
  }
  const refund = operatorMutationEnvelope(data, "refund", ["refundRequestId", "orderId", "amountMinor", "currency", "status", "providerStatus", "idempotentReplay", "testMode"], "economic_operator_refund_execution_invalid");
  if (refund.refundRequestId !== refundRequestId
    || typeof refund.orderId !== "string" || !billingUuidPattern.test(refund.orderId)
    || !Number.isSafeInteger(refund.amountMinor) || Number(refund.amountMinor) < 1 || Number(refund.amountMinor) > 1_000_000_000
    || refund.currency !== "usd"
    || typeof refund.status !== "string" || !testRefundStatuses.has(refund.status as OperatorTestRefundExecutionResult["status"])
    || typeof refund.providerStatus !== "string" || !testRefundProviderStatuses.has(refund.providerStatus as OperatorTestRefundExecutionResult["providerStatus"])
    || typeof refund.idempotentReplay !== "boolean"
    || typeof refund.testMode !== "boolean") {
    throw new BillingRequestError("The test-refund result was invalid. No completed refund should be assumed.", 503, "economic_operator_refund_execution_invalid");
  }
  return {
    refundRequestId,
    orderId: refund.orderId,
    amountMinor: Number(refund.amountMinor),
    currency: "usd",
    status: refund.status as OperatorTestRefundExecutionResult["status"],
    providerStatus: refund.providerStatus as OperatorTestRefundExecutionResult["providerStatus"],
    idempotentReplay: refund.idempotentReplay,
    testMode: currentBillingApiPublication() !== "live"
  };
}

export async function openEconomicOperatorReconciliationCase(input: OperatorReconciliationInput, accessToken: string): Promise<OperatorReconciliationResult> {
  const orderId = normalizedOperatorUuid(input.orderId, "Internal economic order ID");
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  const body = { orderId, clientRequestId, confirmation: "OPEN ECONOMIC RECONCILIATION CASE" as const, reason: normalizedOperatorReason(input.reason) };
  const data = await billingFetch("/api/billing/operator/reconciliation", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const reconciliation = operatorMutationEnvelope(data, "reconciliation", ["reconciliationCaseId", "orderId", "status", "idempotentReplay"], "economic_operator_reconciliation_invalid");
  if (typeof reconciliation.reconciliationCaseId !== "string" || !billingUuidPattern.test(reconciliation.reconciliationCaseId)
    || reconciliation.orderId !== orderId
    || typeof reconciliation.status !== "string" || !reconciliationStatuses.has(reconciliation.status as OperatorReconciliationResult["status"])
    || typeof reconciliation.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The reconciliation result was invalid. No completed case should be assumed.", 503, "economic_operator_reconciliation_invalid");
  }
  return {
    reconciliationCaseId: reconciliation.reconciliationCaseId,
    orderId,
    status: reconciliation.status as OperatorReconciliationResult["status"],
    idempotentReplay: reconciliation.idempotentReplay
  };
}

const operatorJobClassifications = new Set<OperatorJobPostClassification>(["community_free", "commercial", "waived", "subsidized"]);
const operatorJobEconomicStatuses = new Set(["not_assessed", "not_required", "payment_required", "payment_pending", "satisfied", "waived", "subsidized", "refunded", "disputed", "reconciliation_required"]);

export async function assessEconomicOperatorJobPostFee(input: OperatorJobPostFeeAssessmentInput, accessToken: string): Promise<OperatorJobPostFeeAssessmentResult> {
  const jobPostId = normalizedOperatorUuid(input.jobPostId, "Job Post ID");
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  if (!operatorJobClassifications.has(input.classification)) operatorInputError("Choose a supported Job Post economic classification.", "job_post_classification_invalid");
  if (input.confirmation !== "ASSESS JOB POST ECONOMIC CONDITION") operatorInputError("Type ASSESS JOB POST ECONOMIC CONDITION exactly before continuing.", "job_post_assessment_confirmation_invalid");
  const priceCode = input.priceCode?.trim() || null;
  const waiverId = input.waiverId ? normalizedOperatorUuid(input.waiverId, "Waiver ID") : null;
  const subsidyId = input.subsidyId ? normalizedOperatorUuid(input.subsidyId, "Subsidy ID") : null;
  if ((input.classification === "commercial") !== (priceCode !== null)
    || (input.classification === "waived") !== (waiverId !== null)
    || (input.classification === "subsidized") !== (subsidyId !== null)
    || (priceCode !== null && !/^job_post_[a-z0-9]+(?:_[a-z0-9]+)*_usd$/.test(priceCode))) {
    operatorInputError("Commercial assessments require one approved Job Post USD price code; waived/subsidized assessments require only their matching internal grant ID.", "job_post_assessment_references_invalid");
  }
  const body = { jobPostId, classification: input.classification, priceCode, waiverId, subsidyId, clientRequestId, confirmation: "ASSESS JOB POST ECONOMIC CONDITION" as const, reason: normalizedOperatorReason(input.reason) };
  const data = await billingFetch("/api/billing/operator/job-post-fee-assessment", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const assessment = operatorMutationEnvelope(data, "assessment", ["jobPostId", "classification", "economicStatus", "publicationStatus", "published", "idempotentReplay"], "economic_operator_job_post_assessment_invalid");
  const economicStatus = marketplaceString(assessment.economicStatus, 40, "economic_operator_job_post_assessment_invalid");
  const publicationStatus = assessment.publicationStatus === null ? null : marketplaceString(assessment.publicationStatus, 40, "economic_operator_job_post_assessment_invalid");
  if (assessment.jobPostId !== jobPostId || assessment.classification !== input.classification || !operatorJobEconomicStatuses.has(economicStatus)
    || (publicationStatus !== null && !marketplaceEconomicStatusPattern.test(publicationStatus)) || typeof assessment.published !== "boolean" || typeof assessment.idempotentReplay !== "boolean") {
    throw new BillingRequestError("The Job Post economic assessment result was invalid. No fee, waiver, content approval, or publication result should be assumed.", 503, "economic_operator_job_post_assessment_invalid");
  }
  return { jobPostId, classification: input.classification, economicStatus, publicationStatus, published: assessment.published, idempotentReplay: assessment.idempotentReplay };
}

export async function configureEconomicOperatorMarketplaceTerms(input: OperatorMarketplaceCommercialTermsInput, accessToken: string): Promise<OperatorMarketplaceCommercialTermsResult> {
  const clientRequestId = normalizedOperatorUuid(input.clientRequestId, "Client request ID");
  const termsCode = input.termsCode.trim();
  if (!/^[a-z0-9][a-z0-9_:-]{2,116}$/.test(termsCode)) operatorInputError("Enter a stable lowercase Marketplace terms code.", "marketplace_commercial_terms_code_invalid");
  if (!Number.isSafeInteger(input.commissionBps) || input.commissionBps < 0 || input.commissionBps > 5_000) operatorInputError("Commission must be 0 through 5,000 basis points.", "marketplace_commission_invalid");
  if (input.confirmation !== "CONFIGURE MARKETPLACE TEST COMMERCIAL TERMS") operatorInputError("Type CONFIGURE MARKETPLACE TEST COMMERCIAL TERMS exactly before continuing.", "marketplace_terms_confirmation_invalid");
  const sellerAgreementVersion = marketplaceDocumentVersion(input.sellerAgreementVersion, "seller_agreement_version_invalid");
  const buyerTermsVersion = marketplaceDocumentVersion(input.buyerTermsVersion, "marketplace_buyer_terms_version_invalid");
  const body: OperatorMarketplaceCommercialTermsInput = { clientRequestId, termsCode, commissionBps: input.commissionBps, sellerAgreementVersion, buyerTermsVersion, active: input.active, confirmation: "CONFIGURE MARKETPLACE TEST COMMERCIAL TERMS", reason: normalizedOperatorReason(input.reason) };
  const data = await billingFetch("/api/billing/operator/marketplace-commercial-terms", { method: "POST", cache: "no-store", body: JSON.stringify(body) }, accessToken);
  const terms = operatorMutationEnvelope(data, "terms", ["commercialTermsVersionId", "termsCode", "commissionBps", "sellerAgreementVersion", "buyerTermsVersion", "active", "approvedForLiveUse", "testMode"], "economic_operator_marketplace_terms_invalid");
  if (terms.termsCode !== termsCode || terms.commissionBps !== input.commissionBps || terms.sellerAgreementVersion !== sellerAgreementVersion || terms.buyerTermsVersion !== buyerTermsVersion
    || terms.active !== input.active || terms.approvedForLiveUse !== false || typeof terms.testMode !== "boolean") {
    throw new BillingRequestError("The Marketplace commercial-terms result was invalid. No active terms or live approval should be assumed.", 503, "economic_operator_marketplace_terms_invalid");
  }
  return { commercialTermsVersionId: marketplaceUuid(terms.commercialTermsVersionId, "economic_operator_marketplace_terms_invalid"), termsCode, commissionBps: input.commissionBps, sellerAgreementVersion, buyerTermsVersion, active: input.active, approvedForLiveUse: false, testMode: currentBillingApiPublication() !== "live" };
}

async function loadCustomerPortalRedirect(accessToken: string): Promise<RedirectActionResult> {
  const path = "/api/billing/portal";
  const data = await billingFetch(path, { method: "POST", body: JSON.stringify({ clientRequestId: createBillingClientRequestId() }) }, accessToken);
  const candidate = safeInternalOrStripeUrl(data.url ?? data.portalUrl ?? data.portal_url);
  let url: string | null = null;
  try {
    const parsed = candidate ? new URL(candidate) : null;
    if (parsed?.origin === "https://billing.stripe.com" && !parsed.username && !parsed.password) url = parsed.href;
  } catch { url = null; }
  return { ok: Boolean(url), url, message: url ? "Opening the secure provider-hosted page." : "The server did not return a safe provider-hosted destination." };
}

export function createBillingPortal(accessToken: string) {
  return loadCustomerPortalRedirect(accessToken);
}

export async function reduceJobPostFee(input: { jobPostId: string; clientRequestId: string; amountDueMinor: number; reason: string }, accessToken: string) {
  const envelope = await billingFetch("/api/billing/operator/job-post-reduction", { method: "POST", body: JSON.stringify(input) }, accessToken);
  const result = exactRecord(envelope.result, ["jobPostId", "amountDueMinor", "idempotentReplay", "publicationGranted"], "job_post_reduction_invalid");
  if (result.jobPostId !== input.jobPostId || result.amountDueMinor !== input.amountDueMinor || result.publicationGranted !== false || typeof result.idempotentReplay !== "boolean") throw new BillingRequestError(genericUnavailableMessage,503,"job_post_reduction_invalid");
  return result;
}
