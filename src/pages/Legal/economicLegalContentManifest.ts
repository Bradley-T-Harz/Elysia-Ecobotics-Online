export type EconomicLegalSemanticPage = {
  route: string;
  title: string;
  status: string;
  lastUpdated: string;
  body: string;
};

// This exact property order and JSON encoding are the content-addressing
// contract. Changing any semantic field requires a new reviewed version and
// updated digest; presentation markup outside these fields is not hashed.
export function serializeEconomicLegalSemanticContent(page: EconomicLegalSemanticPage): string {
  return JSON.stringify({
    route: page.route,
    title: page.title,
    status: page.status,
    lastUpdated: page.lastUpdated,
    body: page.body
  });
}

export const economicLegalPageIntegrity = {
  supportAndBillingTerms: {
    slug: "support-and-billing-terms",
    route: "/legal/support-and-billing-terms",
    title: "Support and Billing Terms",
    status: "Test-mode operating terms",
    lastUpdated: "2026-07-16",
    version: "2026-07-16",
    contentSha256: "a7fbe15d1a2703599575aec68dc509f37780c606b3a10706aad8bb7dc2631ee9"
  },
  privacyPolicy: {
    slug: "privacy-policy",
    route: "/legal/privacy-policy",
    title: "Privacy Policy",
    status: "Public operating policy",
    lastUpdated: "2026-07-16",
    version: "2026-07-16",
    contentSha256: "d2f82159647705585a7b2790db8ddd80152b9989480e6f0417ba652b3185a046"
  },
  accountClosureFinancialRetention: {
    slug: "account-closure-financial-retention",
    route: "/legal/account-closure-financial-retention",
    title: "Account Closure and Financial Record Retention",
    status: "Test-mode operating terms",
    lastUpdated: "2026-07-16",
    version: "2026-07-16",
    contentSha256: "9a9ce6fb29063e659e97936e9f1337e53c26cd34248d860d54533c2fec0bd36e"
  },
  marketplaceCommerceTerms: {
    slug: "marketplace-commerce-terms",
    route: "/legal/marketplace-commerce-terms",
    title: "Marketplace Commerce Terms",
    status: "Test-mode operating terms",
    lastUpdated: "2026-07-16",
    version: "2026-07-16",
    contentSha256: "f3ed0731ddfcfaf301e9ff2579318bc9c1b71b0e518ab239877a258dbb98ff97"
  },
  refundAndCancellationPolicy: {
    slug: "refund-and-cancellation-policy",
    route: "/legal/refund-and-cancellation-policy",
    title: "Refund and Cancellation Policy",
    status: "Test-mode operating terms",
    lastUpdated: "2026-07-16",
    version: "2026-07-16",
    contentSha256: "55fac0bc05879913ef9e4eb169048fa963444c3cfb745e3a498bc97a5371b5c3"
  },
  sandboxCreditTerms: {
    slug: "sandbox-credit-terms",
    route: "/legal/sandbox-credit-terms",
    title: "Online Sandbox Credit Terms",
    status: "Test-mode operating terms",
    lastUpdated: "2026-07-16",
    version: "2026-07-16",
    contentSha256: "0935b5242ee9079dd0246b8e051b371839bf08ebd43c59480305e542553fc8d6"
  },
  jobPostFeeTerms: {
    slug: "job-post-fee-terms",
    route: "/legal/job-post-fee-terms",
    title: "Commercial Job Post Fee Terms",
    status: "Test-mode operating terms",
    lastUpdated: "2026-07-16",
    version: "2026-07-16",
    contentSha256: "ac05dc2722b77486e2ae20a89665d9e721806940809ff54fd803c25cb133b747"
  },
  organizationServicesTerms: {
    slug: "organization-services-terms",
    route: "/legal/organization-services-terms",
    title: "Organization Services Terms",
    status: "Test-mode operating terms",
    lastUpdated: "2026-07-16",
    version: "2026-07-16",
    contentSha256: "bcce00db17bceb807fc3a10a4be378630439e9be3c2b3cc1987b93fef8c1a6f4"
  },
  sponsorshipIndependencePolicy: {
    slug: "sponsorship-independence-policy",
    route: "/legal/sponsorship-independence-policy",
    title: "Sponsorship Independence Policy",
    status: "Test-mode operating terms",
    lastUpdated: "2026-07-16",
    version: "2026-07-16",
    contentSha256: "9f1c84832dca67e60a1716d1d7b8d42a77da1f62feb9a6af1ce5cbfb3c295ceb"
  }
} as const;
const page = economicLegalPageIntegrity;

export const billingLegalDocumentIntegrityExpectations = {
  supportOneTime: { version: "2026-07-16", path: page.supportAndBillingTerms.route, contentSha256: page.supportAndBillingTerms.contentSha256 },
  supportRecurring: { version: "2026-07-16", path: page.supportAndBillingTerms.route, contentSha256: page.supportAndBillingTerms.contentSha256 },
  supportRecognition: { version: "2026-07-16", path: page.supportAndBillingTerms.route, contentSha256: page.supportAndBillingTerms.contentSha256 },
  dataExportRequest: { version: "2026-07-16", path: page.privacyPolicy.route, contentSha256: page.privacyPolicy.contentSha256 },
  economicAccountClosureRequest: { version: "2026-07-16", path: page.accountClosureFinancialRetention.route, contentSha256: page.accountClosureFinancialRetention.contentSha256 },
  marketplaceSellerAgreement: { version: "2026-07-16", path: page.marketplaceCommerceTerms.route, contentSha256: page.marketplaceCommerceTerms.contentSha256 },
  marketplaceFreeSellerAgreement: { version: "2026-07-16", path: page.marketplaceCommerceTerms.route, contentSha256: page.marketplaceCommerceTerms.contentSha256 },
  stripeConnectSellerDisclosure: { version: "stripe-connect-test-2026-07-16", path: page.marketplaceCommerceTerms.route, contentSha256: page.marketplaceCommerceTerms.contentSha256 },
  marketplaceBuyerTerms: { version: "2026-07-16", path: page.marketplaceCommerceTerms.route, contentSha256: page.marketplaceCommerceTerms.contentSha256 }
} as const;

const document = (version: string, path: string, contentSha256: string) => ({ version, path, contentSha256 });
const refundPolicy = document(page.refundAndCancellationPolicy.version, page.refundAndCancellationPolicy.route, page.refundAndCancellationPolicy.contentSha256);
const privacyDisclosure = document(page.privacyPolicy.version, page.privacyPolicy.route, page.privacyPolicy.contentSha256);

export const billingLegalConsentBundleIntegrityExpectations = {
  support_one_time_checkout_bundle: {
    version: "2026-07-16", path: page.supportAndBillingTerms.route,
    documents: { supportTerms: document(page.supportAndBillingTerms.version, page.supportAndBillingTerms.route, page.supportAndBillingTerms.contentSha256), refundPolicy, privacyDisclosure }
  },
  support_recurring_checkout_bundle: {
    version: "2026-07-16", path: page.supportAndBillingTerms.route,
    documents: { recurringSupportTerms: document(page.supportAndBillingTerms.version, page.supportAndBillingTerms.route, page.supportAndBillingTerms.contentSha256), refundPolicy, privacyDisclosure }
  },
  sandbox_credits_checkout_bundle: {
    version: "2026-07-16", path: page.sandboxCreditTerms.route,
    documents: { sandboxCreditTerms: document(page.sandboxCreditTerms.version, page.sandboxCreditTerms.route, page.sandboxCreditTerms.contentSha256), refundPolicy, privacyDisclosure }
  },
  job_post_fee_checkout_bundle: {
    version: "2026-07-16", path: page.jobPostFeeTerms.route,
    documents: { jobPostFeeTerms: document(page.jobPostFeeTerms.version, page.jobPostFeeTerms.route, page.jobPostFeeTerms.contentSha256), refundPolicy, privacyDisclosure }
  },
  marketplace_purchase_checkout_bundle: {
    version: "2026-07-16", path: page.marketplaceCommerceTerms.route,
    documents: { marketplaceBuyerTerms: document(page.marketplaceCommerceTerms.version, page.marketplaceCommerceTerms.route, page.marketplaceCommerceTerms.contentSha256), refundPolicy, privacyDisclosure }
  },
  marketplace_free_license_bundle: {
    version: "2026-07-16", path: page.marketplaceCommerceTerms.route,
    documents: { marketplaceLicenseTerms: document(page.marketplaceCommerceTerms.version, page.marketplaceCommerceTerms.route, page.marketplaceCommerceTerms.contentSha256), privacyDisclosure }
  },
  organization_service_checkout_bundle: {
    version: "2026-07-16", path: page.organizationServicesTerms.route,
    documents: { organizationServiceTerms: document(page.organizationServicesTerms.version, page.organizationServicesTerms.route, page.organizationServicesTerms.contentSha256), refundPolicy, privacyDisclosure }
  },
  sponsorship_checkout_bundle: {
    version: "2026-07-16", path: page.sponsorshipIndependencePolicy.route,
    documents: { sponsorshipTerms: document(page.sponsorshipIndependencePolicy.version, page.sponsorshipIndependencePolicy.route, page.sponsorshipIndependencePolicy.contentSha256), refundPolicy, privacyDisclosure }
  }
} as const;
