import fs from "node:fs/promises";
import { BillingHttpError } from "../functions/api/billing/_shared/http.ts";
import {
  closeOperatorSponsorshipAssistanceAllocation,
  configureOperatorAssistanceProgram,
  createOperatorEconomicOrganization,
  createOperatorOrganizationServiceEngagement,
  createOperatorSponsorshipAgreement,
  createOperatorSponsorshipAssistanceAllocation,
  endOperatorAssistanceGrant,
  issueOperatorAssistanceGrant,
  loadCurrentEconomicOrganizations,
  loadPublicSponsorshipRecognition,
  prepareOrganizationServiceCheckout,
  prepareSponsorshipCheckout,
  reconcileOperatorJobPostAssistanceGrant,
  reviewOperatorOrganizationServiceEngagement,
  reviewOperatorSponsorshipAgreement,
  setCurrentUserSponsorshipRecognitionPreference,
  setOperatorAssistanceProgramStatus,
  setOperatorEconomicOrganizationMembership,
  setOperatorSponsorshipPublicRecognition
} from "../functions/api/billing/_shared/database.ts";
import {
  parseOperatorAssistanceGrant,
  parseOperatorAssistanceEnd,
  parseOperatorAssistanceProgram,
  parseOperatorAssistanceProgramStatus,
  parseOperatorEconomicOrganization,
  parseOperatorEconomicOrganizationMembership,
  parseOperatorOrganizationServiceEngagement,
  parseOperatorOrganizationServiceReview,
  parseOrganizationServiceCheckout,
  parseOperatorJobPostAssistanceReconciliation,
  parseOperatorSponsorshipAgreement,
  parseOperatorSponsorshipAssistanceAllocation,
  parseOperatorSponsorshipAssistanceAllocationClose,
  parseOperatorSponsorshipRecognition,
  parseOperatorSponsorshipReview,
  parseSponsorshipCheckout,
  parseSponsorshipRecognitionPreference
} from "../functions/api/billing/_shared/schema.ts";
import { handleEconomicOrganizationStatus } from "../functions/api/billing/organizations/status.ts";
import { handleOrganizationServiceCheckout } from "../functions/api/billing/organizations/checkout.ts";
import { handleOperatorAssistanceEnd } from "../functions/api/billing/operator/assistance-end.ts";
import { handleOperatorAssistanceGrant } from "../functions/api/billing/operator/assistance-grant.ts";
import { handleOperatorAssistanceProgram } from "../functions/api/billing/operator/assistance-program.ts";
import { handleOperatorAssistanceProgramStatus } from "../functions/api/billing/operator/assistance-program-status.ts";
import { handleOperatorJobPostAssistanceReconciliation } from "../functions/api/billing/operator/job-post-assistance-reconciliation.ts";
import { handleOperatorOrganization } from "../functions/api/billing/operator/organization.ts";
import { handleOperatorOrganizationMembership } from "../functions/api/billing/operator/organization-membership.ts";
import { handleOperatorOrganizationService } from "../functions/api/billing/operator/organization-service.ts";
import { handleOperatorOrganizationServiceReview } from "../functions/api/billing/operator/organization-service-review.ts";
import { handleOperatorSponsorshipAgreement } from "../functions/api/billing/operator/sponsorship-agreement.ts";
import { handleOperatorSponsorshipAllocation } from "../functions/api/billing/operator/sponsorship-allocation.ts";
import { handleOperatorSponsorshipAllocationClose } from "../functions/api/billing/operator/sponsorship-allocation-close.ts";
import { handleOperatorSponsorshipRecognition } from "../functions/api/billing/operator/sponsorship-recognition.ts";
import { handleOperatorSponsorshipReview } from "../functions/api/billing/operator/sponsorship-review.ts";
import { handleSponsorshipRecognitionPreference } from "../functions/api/billing/sponsorships/preference.ts";
import { handleSponsorshipCheckout } from "../functions/api/billing/sponsorships/checkout.ts";
import { handleSponsorshipRecognition } from "../functions/api/billing/sponsorships/recognition.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parserRejects(parser, value) {
  try { parser(value); }
  catch (error) { return error instanceof BillingHttpError; }
  return false;
}

const origin = "https://elysiaecobotics.com";
const env = {
  BILLING_ENABLED: "true",
  BILLING_MODE: "test",
  BILLING_PUBLIC_ORIGIN: origin,
  BILLING_STAGING_ACCESS_CONFIRMED: "true",
  BILLING_EDGE_RATE_LIMIT_CONFIRMED: "true",
  BILLING_ORGANIZATION_SERVICES_ENABLED: "true",
  BILLING_SPONSORSHIP_ADMIN_ENABLED: "true",
  BILLING_SPONSORSHIP_CHECKOUT_ENABLED: "true",
  BILLING_SPONSORSHIP_RECOGNITION_ENABLED: "true",
  BILLING_WEBHOOK_FULFILLMENT_ENABLED: "true",
  BILLING_NOTIFICATION_RETRY_ENABLED: "true",
  BILLING_ASSISTANCE_ADMIN_ENABLED: "true",
  STRIPE_LIVE_ENABLED: "false"
};
const actorUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const contactUserId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const organizationId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const engagementId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const resourceId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const clientRequestId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const auth = { accessToken: "synthetic", userId: actorUserId, email: "private@example.invalid", supabase: {} };

const organizationInput = {
  clientRequestId,
  accountName: "Watershed Restoration Cooperative",
  countryCode: "us",
  initialContactUserId: contactUserId,
  confirmation: "CREATE ECONOMIC ORGANIZATION",
  reason: "Create a test-mode organization record after a private service inquiry."
};
const parsedOrganization = parseOperatorEconomicOrganization(organizationInput);
assert(parsedOrganization.countryCode === "US", "Organization parser did not normalize its country code.");
for (const invalid of [
  { ...organizationInput, providerCustomerReference: "cus_attacker" },
  { ...organizationInput, authorityRole: "administrator" },
  { ...organizationInput, publicSupportAmount: 5000 },
  { ...organizationInput, confirmation: "yes" },
  { ...organizationInput, countryCode: "USA" }
]) assert(parserRejects(parseOperatorEconomicOrganization, invalid), "Organization parser accepted provider, authority, financial, confirmation, or malformed country input.");

const membershipInput = {
  clientRequestId: "01010101-0101-4101-8101-010101010101",
  organizationId,
  targetUserId: contactUserId,
  relationship: "authorized_signer",
  enabled: true,
  confirmation: "SET ECONOMIC ORGANIZATION MEMBERSHIP",
  reason: "Authorize the reviewed organization signer for its private test contract workflow."
};
assert(parseOperatorEconomicOrganizationMembership(membershipInput).relationship === "authorized_signer", "Organization membership parser rejected a bounded relationship.");
assert(parserRejects(parseOperatorEconomicOrganizationMembership, { ...membershipInput, governanceRole: "steward" }), "Organization membership accepted a Commons authority role.");

const engagementInput = {
  clientRequestId: "02020202-0202-4202-8202-020202020202",
  organizationId,
  authorizedSignerUserId: contactUserId,
  serviceCode: "ecological_systems_review",
  priceCode: "organization_service_review_usd",
  statementOfWorkVersion: "sow-v1",
  serviceTermsVersion: "organization-terms-v1",
  dataHandlingDisclosureVersion: "organization-data-v1",
  confidentialityClass: "confidential",
  proposalReference: "PROP-TEST-001",
  contractReference: null,
  invoiceReference: null,
  startsAt: "2026-08-01T00:00:00.000Z",
  endsAt: "2026-09-01T00:00:00.000Z",
  confirmation: "CREATE TEST ORGANIZATION SERVICE ENGAGEMENT",
  reason: "Create the reviewed private test engagement without changing Commons identity or authority."
};
assert(parseOperatorOrganizationServiceEngagement(engagementInput).confidentialityClass === "confidential", "Organization engagement parser rejected reviewed contract metadata.");
assert(parserRejects(parseOperatorOrganizationServiceEngagement, { ...engagementInput, paymentGrantsAuthority: true }), "Organization engagement accepted authority-bearing economics.");
const engagementReviewInput = {
  engagementId,
  clientRequestId: "03030303-0303-4303-8303-030303030303",
  action: "reconciliation_required",
  confirmation: "MARK TEST ORGANIZATION RECONCILIATION REQUIRED",
  reason: "Pause the service entitlement while its private payment state is reconciled."
};
assert(parseOperatorOrganizationServiceReview(engagementReviewInput).action === "reconciliation_required", "Organization review parser rejected a safe state transition.");
assert(parserRejects(parseOperatorOrganizationServiceReview, { ...engagementReviewInput, confirmation: "yes" }), "Organization review accepted a weak confirmation.");

const sponsorshipAgreementId = "04040404-0404-4404-8404-040404040404";
const sponsorshipInput = {
  clientRequestId: "05050505-0505-4505-8505-050505050505",
  organizationId,
  authorizedSignerUserId: contactUserId,
  purposeCode: "commons_infrastructure",
  priceCode: "sponsorship_commons_infrastructure_usd",
  agreementVersion: "sponsorship-no-control-v1",
  disclosureVersion: "sponsorship-data-v1",
  publicLabel: "Regional Watershed Cooperative",
  publicSummary: "Supports shared ecological infrastructure without influence or endorsement.",
  confirmation: "CREATE TEST SPONSORSHIP AGREEMENT WITHOUT CONTROL",
  reason: "Create a test sponsorship agreement for independent ethical review and no-control verification."
};
assert(parseOperatorSponsorshipAgreement(sponsorshipInput).purposeCode === "commons_infrastructure", "Sponsorship agreement parser rejected reviewed metadata.");
assert(parserRejects(parseOperatorSponsorshipAgreement, { ...sponsorshipInput, searchProminence: true }), "Sponsorship agreement accepted purchased prominence.");
const sponsorshipReviewInput = {
  sponsorshipAgreementId,
  clientRequestId: "06060606-0606-4606-8606-060606060606",
  action: "approve",
  confirmation: "APPROVE TEST SPONSORSHIP WITHOUT CONTROL",
  reason: "Approve only after independently verifying every no-control and no-tracking boundary."
};
assert(parseOperatorSponsorshipReview(sponsorshipReviewInput).action === "approve", "Sponsorship review parser rejected ethical approval.");
assert(parserRejects(parseOperatorSponsorshipReview, { ...sponsorshipReviewInput, action: "grant_authority" }), "Sponsorship review accepted an authority action.");
const sponsorshipRecognitionInput = {
  sponsorshipAgreementId,
  clientRequestId: "07070707-0707-4707-8707-070707070707",
  approved: true,
  confirmation: "APPROVE NEUTRAL SPONSORSHIP RECOGNITION",
  reason: "Approve the neutral public label after signer opt-in and payment verification."
};
assert(parseOperatorSponsorshipRecognition(sponsorshipRecognitionInput).approved, "Sponsorship recognition parser rejected reviewed approval.");
const sponsorshipPreferenceInput = {
  sponsorshipAgreementId,
  clientRequestId: "08080808-0808-4808-8808-080808080808",
  optedIn: true,
  sourceRoute: "/commons-circle/support-billing",
  agreementVersion: sponsorshipInput.agreementVersion,
  disclosureVersion: sponsorshipInput.disclosureVersion,
  confirmation: "PUBLISH NEUTRAL SPONSORSHIP RECOGNITION"
};
assert(parseSponsorshipRecognitionPreference(sponsorshipPreferenceInput).optedIn, "Signer recognition preference parser rejected an explicit opt-in.");
assert(parserRejects(parseSponsorshipRecognitionPreference, { ...sponsorshipPreferenceInput, amountPublic: true }), "Signer recognition preference accepted a public amount.");

const organizationCheckoutInput = {
  engagementId,
  clientRequestId: "19191919-1919-4919-8919-191919191919",
  sourceRoute: "/commons-circle/support-billing",
  legalBundleVersion: "organization-checkout-bundle-v1",
  statementOfWorkVersion: engagementInput.statementOfWorkVersion,
  serviceTermsVersion: engagementInput.serviceTermsVersion,
  dataHandlingDisclosureVersion: engagementInput.dataHandlingDisclosureVersion
};
assert(parseOrganizationServiceCheckout(organizationCheckoutInput).engagementId === engagementId, "Organization service checkout parser rejected exact reviewed document versions.");
assert(parserRejects(parseOrganizationServiceCheckout, { ...organizationCheckoutInput, amountMinor: 1 }), "Organization service checkout accepted a browser-supplied price.");
const sponsorshipCheckoutInput = {
  sponsorshipAgreementId,
  clientRequestId: "20202020-2020-4020-8020-202020202020",
  sourceRoute: "/commons-circle/support-billing",
  legalBundleVersion: "sponsorship-checkout-bundle-v1",
  agreementVersion: sponsorshipInput.agreementVersion,
  disclosureVersion: sponsorshipInput.disclosureVersion
};
assert(parseSponsorshipCheckout(sponsorshipCheckoutInput).sponsorshipAgreementId === sponsorshipAgreementId, "Sponsorship checkout parser rejected exact reviewed agreement versions.");
assert(parserRejects(parseSponsorshipCheckout, { ...sponsorshipCheckoutInput, publicRecognitionOptIn: true }), "Sponsorship checkout coupled payment to public recognition.");

const allocationId = "09090909-0909-4909-8909-090909090909";
const assistanceProgramId = "10101010-1010-4010-8010-101010101010";
const allocationInput = {
  clientRequestId: "11111111-1111-4111-8111-111111111111",
  sponsorshipAgreementId,
  assistanceProgramId,
  allocationKind: "sandbox_credit_units",
  allocationCap: 500,
  currency: null,
  confirmation: "CREATE SPONSORSHIP ASSISTANCE ALLOCATION",
  reason: "Reserve bounded sponsored sandbox access without revealing or delegating recipient choice."
};
assert(parseOperatorSponsorshipAssistanceAllocation(allocationInput).allocationCap === 500, "Sponsorship allocation parser rejected a bounded service-unit allocation.");
assert(parserRejects(parseOperatorSponsorshipAssistanceAllocation, { ...allocationInput, currency: "usd" }), "Service-unit sponsorship allocation accepted a money currency.");
const allocationCloseInput = {
  clientRequestId: "12121212-1212-4212-8212-121212121212",
  allocationId,
  confirmation: "CLOSE SPONSORSHIP ASSISTANCE ALLOCATION",
  reason: "Close the remaining allocation after the approved sponsorship program ends."
};
assert(parseOperatorSponsorshipAssistanceAllocationClose(allocationCloseInput).allocationId === allocationId, "Sponsorship allocation close parser rejected an audited close.");

const assistanceProgramInput = {
  clientRequestId,
  programCode: "sandbox_access_waiver_2026",
  assistanceKind: "waiver",
  scope: "sandbox_credits",
  publicLabel: "Community sandbox access",
  termsVersion: "assistance-terms-v1",
  startsAt: "2026-07-16T12:00:00.000Z",
  endsAt: "2027-07-16T12:00:00.000Z",
  maxGrants: 100,
  activate: true,
  confirmation: "CONFIGURE ECONOMIC ASSISTANCE PROGRAM",
  reason: "Configure a bounded test-mode access program without public beneficiary status."
};
assert(parseOperatorAssistanceProgram(assistanceProgramInput).scope === "sandbox_credits", "Valid assistance program input was rejected.");
for (const invalid of [
  { ...assistanceProgramInput, amountMinor: 500 },
  { ...assistanceProgramInput, badgeKey: "supporter" },
  { ...assistanceProgramInput, governanceRole: "steward" },
  { ...assistanceProgramInput, scope: "general_membership" },
  { ...assistanceProgramInput, endsAt: assistanceProgramInput.startsAt }
]) assert(parserRejects(parseOperatorAssistanceProgram, invalid), "Assistance program accepted money, recognition, authority, scope, or invalid date input.");
const assistanceProgramStatusInput = {
  clientRequestId: "15151515-1515-4515-8515-151515151515",
  programId: assistanceProgramId,
  targetStatus: "paused",
  confirmation: "PAUSE TEST ECONOMIC ASSISTANCE PROGRAM",
  reason: "Pause new assistance issuance while preserving all existing grant records for review."
};
assert(parseOperatorAssistanceProgramStatus(assistanceProgramStatusInput).targetStatus === "paused", "Assistance program pause parser rejected a safe lifecycle action.");
assert(parserRejects(parseOperatorAssistanceProgramStatus, { ...assistanceProgramStatusInput, targetStatus: "deleted" }), "Assistance program lifecycle accepted destructive deletion.");

const assistanceGrantInput = {
  clientRequestId,
  programCode: assistanceProgramInput.programCode,
  beneficiaryUserId: contactUserId,
  resourceId,
  units: 20,
  expiresAt: "2027-01-01T00:00:00.000Z",
  sponsorshipAllocationId: null,
  allocationConsumption: null,
  confirmation: "ISSUE ECONOMIC ASSISTANCE GRANT",
  reason: "Issue private test sandbox access under the approved assistance program."
};
assert(parseOperatorAssistanceGrant(assistanceGrantInput).units === 20, "Valid assistance grant input was rejected.");
for (const invalid of [
  { ...assistanceGrantInput, publiclyVisible: true },
  { ...assistanceGrantInput, providerPaymentReference: "pi_attacker" },
  { ...assistanceGrantInput, badgeKey: "sponsored_member" },
  { ...assistanceGrantInput, units: 0 },
  { ...assistanceGrantInput, sponsorshipAllocationId: resourceId },
  { ...assistanceGrantInput, allocationConsumption: 1 },
  { ...assistanceGrantInput, confirmation: "ISSUE GRANT" }
]) assert(parserRejects(parseOperatorAssistanceGrant, invalid), "Assistance grant accepted visibility, provider, recognition, unit, or weak confirmation input.");

const sponsoredGrantInput = {
  ...assistanceGrantInput,
  clientRequestId: "12121212-1212-4212-8212-121212121212",
  sponsorshipAllocationId: "13131313-1313-4313-8313-131313131313",
  allocationConsumption: 20
};
assert(parseOperatorAssistanceGrant(sponsoredGrantInput).allocationConsumption === 20, "Paired private sponsorship allocation was rejected.");
const assistanceEndInput = {
  clientRequestId: "14141414-1414-4414-8414-141414141414",
  grantId: "15151515-1515-4515-8515-151515151515",
  action: "revoke",
  confirmation: "END ECONOMIC ASSISTANCE GRANT",
  reason: "Revoke unspent private assistance after the underlying approval ended."
};
assert(parseOperatorAssistanceEnd(assistanceEndInput).action === "revoke", "Assistance revocation schema was rejected.");
assert(parserRejects(parseOperatorAssistanceEnd, { ...assistanceEndInput, action: "delete" }), "Assistance end accepted a destructive unknown action.");
const jobPostAssistanceReconciliationInput = {
  clientRequestId: "18181818-1818-4818-8818-181818181818",
  jobPostId: resourceId,
  grantId: assistanceEndInput.grantId,
  endAction: "revoke",
  confirmation: "RECONCILE AND END TEST JOB POST ASSISTANCE",
  reason: "Return the affected Job Post to economic review without changing its content approval."
};
assert(parseOperatorJobPostAssistanceReconciliation(jobPostAssistanceReconciliationInput).endAction === "revoke", "Job Post assistance reconciliation parser rejected a safe reset.");
assert(parserRejects(parseOperatorJobPostAssistanceReconciliation, { ...jobPostAssistanceReconciliationInput, contentApproval: "approved" }), "Job Post economic reconciliation accepted a content-approval mutation.");

function post(path, body, currentEnv = env) {
  return new Request(`${origin}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, authorization: "Bearer synthetic" },
    body: JSON.stringify(body)
  });
}

let lastOperatorActor = null;
const operatorRouteCases = [
  [handleOperatorOrganization, "/api/billing/operator/organization", organizationInput, 201, {
    organizationId, accountName: organizationInput.accountName, status: "active", testMode: true, idempotentReplay: false
  }],
  [handleOperatorOrganizationMembership, "/api/billing/operator/organization-membership", membershipInput, 200, {
    membershipId: "13131313-1313-4313-8313-131313131313", organizationId, userId: contactUserId,
    relationship: "authorized_signer", active: true, testMode: true, idempotentReplay: false
  }],
  [handleOperatorOrganizationService, "/api/billing/operator/organization-service", engagementInput, 201, {
    engagementId, organizationId, serviceCode: engagementInput.serviceCode, status: "contract_pending",
    serviceTermsVersion: engagementInput.serviceTermsVersion, testMode: true, idempotentReplay: false
  }],
  [handleOperatorOrganizationServiceReview, "/api/billing/operator/organization-service-review", engagementReviewInput, 200, {
    engagementId, action: "reconciliation_required", status: "reconciliation_required", testMode: true, idempotentReplay: false
  }],
  [handleOperatorSponsorshipAgreement, "/api/billing/operator/sponsorship-agreement", sponsorshipInput, 201, {
    sponsorshipAgreementId, organizationId, status: "ethical_review", publicRecognitionOptIn: false,
    publicRecognitionApproved: false, grantsAuthority: false, testMode: true, idempotentReplay: false
  }],
  [handleOperatorSponsorshipReview, "/api/billing/operator/sponsorship-review", sponsorshipReviewInput, 200, {
    sponsorshipAgreementId, action: "approve", status: "contract_pending", grantsAuthority: false,
    testMode: true, idempotentReplay: false
  }],
  [handleOperatorSponsorshipRecognition, "/api/billing/operator/sponsorship-recognition", sponsorshipRecognitionInput, 200, {
    sponsorshipAgreementId, publicRecognitionApproved: true, amountsPublic: false,
    grantsAuthority: false, testMode: true, idempotentReplay: false
  }],
  [handleOperatorSponsorshipAllocation, "/api/billing/operator/sponsorship-allocation", allocationInput, 201, {
    allocationId, sponsorshipAgreementId, assistanceProgramId, scope: "sandbox_credits",
    allocationKind: "sandbox_credit_units", allocationCap: 500, currency: null,
    sponsorSelectsRecipients: false, sponsorReceivesRecipientData: false,
    grantsAuthority: false, testMode: true, idempotentReplay: false
  }],
  [handleOperatorSponsorshipAllocationClose, "/api/billing/operator/sponsorship-allocation-close", allocationCloseInput, 200, {
    allocationId, status: "canceled", testMode: true, idempotentReplay: false
  }]
];
for (const [handler, path, input, expectedStatus, result] of operatorRouteCases) {
  const response = await handler(post(path, input), env, {
    authenticate: async () => auth,
    mutate: async (_env, actor) => { lastOperatorActor = actor; return result; }
  });
  const payload = await response.json();
  assert(response.status === expectedStatus && payload.ok === true && lastOperatorActor === actorUserId, `${path} did not authenticate, derive its actor, or return its bounded result.`);
  assert(!JSON.stringify(payload).includes("privateReason") && !JSON.stringify(payload).includes("provider"), `${path} exposed private reason or provider state.`);
}

const preferenceResponse = await handleSponsorshipRecognitionPreference(
  post("/api/billing/sponsorships/preference", sponsorshipPreferenceInput), env,
  {
    authenticate: async () => auth,
    mutate: async (_env, actor, input) => ({
      sponsorshipAgreementId: input.sponsorshipAgreementId,
      publicRecognitionOptIn: input.optedIn, amountsPublic: false,
      grantsAuthority: false, testMode: true, idempotentReplay: false,
      ...(lastOperatorActor = actor, {})
    })
  }
);
assert(preferenceResponse.status === 200 && lastOperatorActor === actorUserId, "Signer sponsorship recognition preference did not derive its actor.");
const optInWithDisplayOff = await handleSponsorshipRecognitionPreference(
  post("/api/billing/sponsorships/preference", sponsorshipPreferenceInput),
  { ...env, BILLING_SPONSORSHIP_RECOGNITION_ENABLED: "false" },
  { authenticate: async () => auth, mutate: async (_env, _actor, input) => ({
    sponsorshipAgreementId: input.sponsorshipAgreementId, publicRecognitionOptIn: true,
    amountsPublic: false, grantsAuthority: false, testMode: true, idempotentReplay: false
  }) }
);
assert(optInWithDisplayOff.status === 200, "Public sponsorship display switch incorrectly disabled a private signer preference.");
const removePreference = { ...sponsorshipPreferenceInput, clientRequestId: "14141414-1414-4414-8414-141414141414", optedIn: false, confirmation: "REMOVE NEUTRAL SPONSORSHIP RECOGNITION" };
const removalWithDisplayOff = await handleSponsorshipRecognitionPreference(
  post("/api/billing/sponsorships/preference", removePreference),
  { ...env, BILLING_ENABLED: "false", BILLING_SPONSORSHIP_RECOGNITION_ENABLED: "false" },
  { authenticate: async () => auth, mutate: async (_env, _actor, input) => ({
    sponsorshipAgreementId: input.sponsorshipAgreementId, publicRecognitionOptIn: false,
    amountsPublic: false, grantsAuthority: false, testMode: true, idempotentReplay: false
  }) }
);
assert(removalWithDisplayOff.status === 200, "Public display or acquisition kill switches prevented signer opt-out.");

const checkoutPreparationBase = {
  orderId: "21212121-2121-4121-8121-212121212121",
  publicReference: "contract_checkout_reference_1234567890",
  idempotencyKey: "contract:checkout:fixture:123456",
  amountMinor: 50_000,
  currency: "usd",
  providerProductReference: null,
  providerPriceReference: "price_testcontract",
  providerCustomerReference: null
};
let contractProviderInput = null;
let attachedContractOrder = null;
let attachedContractCustomers = 0;
let failedContractOrders = 0;
let contractActor = null;
const contractProvider = {
  async ensureCustomer(input) {
    assert(input.idempotencyKey === `billing-customer:${actorUserId}`, "Contract checkout did not use its stable account Customer key.");
    return { providerCustomerReference: "cus_testcontract" };
  },
  async createCheckout(input) {
    contractProviderInput = input;
    return { providerSessionId: "cs_test_contract", providerCustomerReference: "cus_testcontract", checkoutUrl: "https://checkout.stripe.com/c/pay/test_contract" };
  }
};
const organizationCheckoutResponse = await handleOrganizationServiceCheckout(
  post("/api/billing/organizations/checkout", organizationCheckoutInput), env,
  {
    authenticate: async () => auth,
    provider: () => contractProvider,
    prepare: async (_env, actor, input) => {
      contractActor = actor;
      return { ...checkoutPreparationBase, engagementId: input.engagementId, organizationId };
    },
    attachCustomer: async (_env, order, customer) => {
      assert(order === checkoutPreparationBase.orderId && customer === "cus_testcontract", "Organization checkout attached the wrong canonical Customer.");
      attachedContractCustomers += 1;
    },
    attach: async (_env, order) => { attachedContractOrder = order; },
    fail: async () => { failedContractOrders += 1; }
  }
);
const organizationCheckoutPayload = await organizationCheckoutResponse.json();
assert(
  organizationCheckoutResponse.status === 201 && attachedContractOrder === checkoutPreparationBase.orderId
    && contractActor === actorUserId
    && attachedContractCustomers === 1
    && contractProviderInput.flow === "organization_service" && contractProviderInput.accountLinked === true
    && contractProviderInput.providerCustomerReference === "cus_testcontract"
    && organizationCheckoutPayload.paymentGrantsAuthority === false,
  "Organization service checkout was not account-linked, webhook-gated, or authority-neutral."
);
const sponsorshipCheckoutResponse = await handleSponsorshipCheckout(
  post("/api/billing/sponsorships/checkout", sponsorshipCheckoutInput), env,
  {
    authenticate: async () => auth,
    provider: () => contractProvider,
    prepare: async (_env, actor, input) => {
      contractActor = actor;
      return {
        ...checkoutPreparationBase, sponsorshipAgreementId: input.sponsorshipAgreementId,
        organizationId, grantsAuthority: false
      };
    },
    attachCustomer: async (_env, order, customer) => {
      assert(order === checkoutPreparationBase.orderId && customer === "cus_testcontract", "Sponsorship checkout attached the wrong canonical Customer.");
      attachedContractCustomers += 1;
    },
    attach: async (_env, order) => { attachedContractOrder = order; },
    fail: async () => { failedContractOrders += 1; }
  }
);
assert(
  sponsorshipCheckoutResponse.status === 201 && attachedContractCustomers === 2
    && contractProviderInput.flow === "sponsorship"
    && contractProviderInput.providerCustomerReference === "cus_testcontract"
    && (await sponsorshipCheckoutResponse.json()).paymentGrantsAuthority === false,
  "Sponsorship checkout was not isolated from authority."
);
async function assertContractAttachRetry(handler, path, input, preparation, label) {
  let attachAttempts = 0;
  const failureCodes = [];
  const dependencies = {
    authenticate: async () => auth,
    provider: () => ({
      ensureCustomer: async () => ({ providerCustomerReference: "cus_testcontract" }),
      createCheckout: async () => ({
        providerSessionId: `cs_test_${label}_retry`, providerCustomerReference: "cus_testcontract",
        checkoutUrl: `https://checkout.stripe.com/c/pay/${label}_retry`
      })
    }),
    prepare: async () => preparation,
    attachCustomer: async () => undefined,
    attach: async () => {
      attachAttempts += 1;
      if (attachAttempts === 1) throw new Error("simulated attach transport failure");
    },
    fail: async (_env, _order, code) => { failureCodes.push(code); }
  };
  const firstAttempt = await handler(post(path, input), env, dependencies);
  const retryAttempt = await handler(post(path, input), env, dependencies);
  assert(
    firstAttempt.status >= 500 && retryAttempt.status === 201
      && attachAttempts === 2 && failureCodes.length === 0,
    `${label} attach uncertainty poisoned the recoverable idempotent Checkout retry.`
  );
}
await assertContractAttachRetry(
  handleOrganizationServiceCheckout, "/api/billing/organizations/checkout", organizationCheckoutInput,
  { ...checkoutPreparationBase, engagementId, organizationId }, "organization_service"
);
await assertContractAttachRetry(
  handleSponsorshipCheckout, "/api/billing/sponsorships/checkout", sponsorshipCheckoutInput,
  { ...checkoutPreparationBase, sponsorshipAgreementId, organizationId, grantsAuthority: false }, "sponsorship"
);
async function assertContractCreationFailure(handler, path, input, preparation, label) {
  let failureCode = null;
  const response = await handler(post(path, input), env, {
    authenticate: async () => auth,
    provider: () => ({
      ensureCustomer: async () => ({ providerCustomerReference: "cus_testcontract" }),
      createCheckout: async () => { throw new Error("simulated provider creation failure"); }
    }),
    prepare: async () => preparation,
    attachCustomer: async () => undefined,
    attach: async () => { throw new Error("must not attach"); },
    fail: async (_env, _order, code) => { failureCode = code; }
  });
  assert(
    response.status === 502 && failureCode === "provider_checkout_creation_failed",
    `${label} provider-creation failure lost its sole recoverable failure code.`
  );
}
await assertContractCreationFailure(
  handleOrganizationServiceCheckout, "/api/billing/organizations/checkout", organizationCheckoutInput,
  { ...checkoutPreparationBase, engagementId, organizationId }, "organization_service"
);
await assertContractCreationFailure(
  handleSponsorshipCheckout, "/api/billing/sponsorships/checkout", sponsorshipCheckoutInput,
  { ...checkoutPreparationBase, sponsorshipAgreementId, organizationId, grantsAuthority: false }, "sponsorship"
);
let disabledContractPreparations = 0;
const disabledSponsorshipCheckout = await handleSponsorshipCheckout(
  post("/api/billing/sponsorships/checkout", sponsorshipCheckoutInput),
  { ...env, BILLING_SPONSORSHIP_CHECKOUT_ENABLED: "false" },
  {
    authenticate: async () => auth, provider: () => contractProvider,
    prepare: async () => { disabledContractPreparations += 1; throw new Error("must not prepare"); },
    attach: async () => undefined, fail: async () => undefined
  }
);
assert(disabledSponsorshipCheckout.status === 503 && disabledContractPreparations === 0, "Sponsorship checkout ignored its independent fail-closed acquisition flag.");
assert(failedContractOrders === 0, "Successful contract checkout was incorrectly marked failed.");

let workflowRpc = null;
const workflowSupabase = { rpc: async (name, args) => {
  workflowRpc = { name, args };
  const rows = {
    prepare_organization_service_checkout: {
      ...checkoutPreparationBase, engagementId, organizationId
    },
    prepare_sponsorship_checkout: {
      ...checkoutPreparationBase, sponsorshipAgreementId, organizationId, grantsAuthority: false
    },
    operator_create_economic_organization: {
      organizationId, accountName: organizationInput.accountName, status: "active", testMode: true, idempotentReplay: false
    },
    operator_set_economic_organization_membership: {
      membershipId: "13131313-1313-4313-8313-131313131313", organizationId, userId: contactUserId,
      relationship: "authorized_signer", active: true, testMode: true, idempotentReplay: false
    },
    operator_create_organization_service_engagement: {
      engagementId, organizationId, serviceCode: engagementInput.serviceCode, status: "contract_pending",
      serviceTermsVersion: engagementInput.serviceTermsVersion, testMode: true, idempotentReplay: false
    },
    operator_review_organization_service_engagement: {
      engagementId, action: "reconciliation_required", testMode: true, idempotentReplay: true
    },
    operator_create_sponsorship_agreement: {
      sponsorshipAgreementId, organizationId, status: "ethical_review", publicRecognitionOptIn: false,
      publicRecognitionApproved: false, grantsAuthority: false, testMode: true, idempotentReplay: false
    },
    operator_review_sponsorship_agreement: {
      sponsorshipAgreementId, action: "approve", testMode: true, idempotentReplay: true
    },
    operator_set_sponsorship_public_recognition: {
      sponsorshipAgreementId, publicRecognitionApproved: true, testMode: true, idempotentReplay: true
    },
    set_current_user_sponsorship_recognition_preference: {
      sponsorshipAgreementId, publicRecognitionOptIn: true, amountsPublic: false,
      grantsAuthority: false, testMode: true, idempotentReplay: true
    },
    operator_create_sponsorship_assistance_allocation: {
      allocationId, sponsorshipAgreementId, assistanceProgramId, scope: "sandbox_credits",
      allocationKind: "sandbox_credit_units", allocationCap: 500, currency: null,
      sponsorSelectsRecipients: false, sponsorReceivesRecipientData: false,
      grantsAuthority: false, testMode: true, idempotentReplay: false
    },
    operator_close_sponsorship_assistance_allocation: {
      allocationId, status: "canceled", testMode: true, idempotentReplay: false
    }
  };
  if (!(name in rows)) throw new Error(`Unexpected organization/sponsorship RPC ${name}`);
  return { data: rows[name], error: null };
} };
await prepareOrganizationServiceCheckout(workflowSupabase, actorUserId, parseOrganizationServiceCheckout(organizationCheckoutInput));
assert(
  workflowRpc.args.p_actor_user_id === actorUserId
    && workflowRpc.args.p_statement_of_work_version === engagementInput.statementOfWorkVersion
    && workflowRpc.args.p_legal_bundle_version === organizationCheckoutInput.legalBundleVersion,
  "Organization checkout adapter lost signer identity or exact reviewed documents."
);
await prepareSponsorshipCheckout(workflowSupabase, actorUserId, parseSponsorshipCheckout(sponsorshipCheckoutInput));
assert(
  workflowRpc.args.p_actor_user_id === actorUserId
    && workflowRpc.args.p_agreement_version === sponsorshipInput.agreementVersion
    && !("p_public_recognition" in workflowRpc.args),
  "Sponsorship checkout adapter lost exact no-control documents or coupled recognition."
);
await createOperatorEconomicOrganization(workflowSupabase, actorUserId, parsedOrganization);
assert(workflowRpc.args.p_initial_contact_user_id === contactUserId && !("p_confirmation" in workflowRpc.args), "Organization adapter lost its reviewed contact or sent an undeclared database argument.");
await setOperatorEconomicOrganizationMembership(workflowSupabase, actorUserId, parseOperatorEconomicOrganizationMembership(membershipInput));
assert(workflowRpc.args.p_relationship === "authorized_signer" && workflowRpc.args.p_enabled === true, "Organization membership adapter lost its bounded relationship state.");
await createOperatorOrganizationServiceEngagement(workflowSupabase, actorUserId, parseOperatorOrganizationServiceEngagement(engagementInput));
assert(workflowRpc.args.p_data_handling_disclosure_version === engagementInput.dataHandlingDisclosureVersion && workflowRpc.args.p_confidentiality_class === "confidential", "Organization engagement adapter lost its disclosure or confidentiality boundary.");
const normalizedEngagementReplay = await reviewOperatorOrganizationServiceEngagement(workflowSupabase, actorUserId, parseOperatorOrganizationServiceReview(engagementReviewInput));
assert(normalizedEngagementReplay.status === "reconciliation_required" && normalizedEngagementReplay.idempotentReplay, "Organization review replay was not normalized to a stable safe status.");
await createOperatorSponsorshipAgreement(workflowSupabase, actorUserId, parseOperatorSponsorshipAgreement(sponsorshipInput));
assert(workflowRpc.args.p_public_summary === sponsorshipInput.publicSummary && !("p_governance_role" in workflowRpc.args), "Sponsorship adapter lost its neutral summary or introduced authority.");
const normalizedSponsorshipReplay = await reviewOperatorSponsorshipAgreement(workflowSupabase, actorUserId, parseOperatorSponsorshipReview(sponsorshipReviewInput));
assert(normalizedSponsorshipReplay.status === "contract_pending" && normalizedSponsorshipReplay.grantsAuthority === false, "Sponsorship review replay did not preserve no-control semantics.");
await setOperatorSponsorshipPublicRecognition(workflowSupabase, actorUserId, parseOperatorSponsorshipRecognition(sponsorshipRecognitionInput));
assert(workflowRpc.args.p_approved === true, "Sponsorship recognition adapter lost reviewed approval.");
await setCurrentUserSponsorshipRecognitionPreference(workflowSupabase, actorUserId, parseSponsorshipRecognitionPreference(sponsorshipPreferenceInput));
assert(workflowRpc.args.p_actor_user_id === actorUserId && workflowRpc.args.p_source_route === "/commons-circle/support-billing", "Sponsorship preference adapter did not bind the authenticated signer and exact source route.");
await createOperatorSponsorshipAssistanceAllocation(workflowSupabase, actorUserId, parseOperatorSponsorshipAssistanceAllocation(allocationInput));
assert(workflowRpc.args.p_allocation_cap === 500 && workflowRpc.args.p_currency === null, "Sponsorship allocation adapter confused service units with money.");
await closeOperatorSponsorshipAssistanceAllocation(workflowSupabase, actorUserId, parseOperatorSponsorshipAssistanceAllocationClose(allocationCloseInput));
assert(workflowRpc.args.p_allocation_id === allocationId, "Sponsorship allocation close adapter lost its target.");

let assistanceActor = null;
const programResponse = await handleOperatorAssistanceProgram(post("/api/billing/operator/assistance-program", assistanceProgramInput), env, {
  authenticate: async () => auth,
  mutate: async (_env, actor, input) => {
    assistanceActor = actor;
    return {
      programId: "16161616-1616-4616-8616-161616161616",
      programCode: input.programCode, kind: input.assistanceKind, scope: input.scope,
      status: "active", publicLabel: input.publicLabel, testMode: true, idempotentReplay: false
    };
  }
});
assert(programResponse.status === 201 && assistanceActor === actorUserId, "Assistance program route did not derive its operator actor.");
const programStatusResponse = await handleOperatorAssistanceProgramStatus(
  post("/api/billing/operator/assistance-program-status", assistanceProgramStatusInput), env,
  { authenticate: async () => auth, mutate: async (_env, actor, input) => {
    assistanceActor = actor;
    return { programId: input.programId, status: input.targetStatus, testMode: true, idempotentReplay: false };
  } }
);
assert(programStatusResponse.status === 200 && assistanceActor === actorUserId, "Assistance program lifecycle route did not derive its operator actor.");
const grantResponse = await handleOperatorAssistanceGrant(post("/api/billing/operator/assistance-grant", assistanceGrantInput), env, {
  authenticate: async () => auth,
  mutate: async (_env, actor, input) => ({
    grantId: assistanceEndInput.grantId, scope: "sandbox_credits", status: "consumed",
    expiresAt: input.expiresAt, publiclyVisible: false,
    sandboxCreditResult: { creditLotId: "17171717-1717-4717-8717-171717171717", grantedUnits: 20, sourceCategory: "waiver", expiresAt: input.expiresAt },
    testMode: true, idempotentReplay: false
  })
});
const grantPayload = await grantResponse.json();
assert(grantResponse.status === 201 && grantPayload.grant.publiclyVisible === false && !("actor" in grantPayload.grant), "Assistance grant route exposed beneficiary recognition or extra operator internals.");
const endResponse = await handleOperatorAssistanceEnd(post("/api/billing/operator/assistance-end", assistanceEndInput), env, {
  authenticate: async () => auth,
  mutate: async () => ({ grantId: assistanceEndInput.grantId, status: "revoked", reversedUnits: 10, publiclyVisible: false, idempotentReplay: false })
});
assert(endResponse.status === 200, "Assistance end route was unavailable.");
const jobPostReconciliationResponse = await handleOperatorJobPostAssistanceReconciliation(
  post("/api/billing/operator/job-post-assistance-reconciliation", jobPostAssistanceReconciliationInput),
  { ...env, BILLING_ENABLED: "false" },
  { authenticate: async () => auth, mutate: async (_env, actor, input) => {
    assistanceActor = actor;
    return {
      jobPostId: input.jobPostId, grantId: input.grantId, grantStatus: "revoked",
      economicStatus: "not_assessed", publicationStatus: "pending", published: false,
      testMode: true, idempotentReplay: false
    };
  } }
);
assert(jobPostReconciliationResponse.status === 200 && assistanceActor === actorUserId, "Acquisition kill switch stranded consumed Job Post assistance reconciliation.");

let assistanceRpc = null;
const assistanceSupabase = { rpc: async (name, args) => {
  assistanceRpc = { name, args };
  if (name === "operator_configure_assistance_program") return { data: {
    programId: "16161616-1616-4616-8616-161616161616",
    programCode: assistanceProgramInput.programCode, kind: "waiver", scope: "sandbox_credits",
    status: "active", publicLabel: assistanceProgramInput.publicLabel, testMode: true, idempotentReplay: false
  }, error: null };
  if (name === "operator_set_economic_assistance_program_status") return { data: {
    programId: assistanceProgramId, status: "paused", testMode: true, idempotentReplay: true
  }, error: null };
  if (name === "operator_issue_economic_assistance_grant") return { data: {
    grantId: assistanceEndInput.grantId, scope: "sandbox_credits", status: "consumed",
    expiresAt: assistanceGrantInput.expiresAt, publiclyVisible: false,
    sandboxCreditResult: {
      creditLotId: "17171717-1717-4717-8717-171717171717", grantedUnits: 20,
      sourceCategory: "waiver", expiresAt: assistanceGrantInput.expiresAt,
      idempotentReplay: false, testMode: true, operatorActorId: actorUserId
    },
    testMode: true, idempotentReplay: false
  }, error: null };
  if (name === "operator_end_economic_assistance_grant") return { data: {
    grantId: assistanceEndInput.grantId, status: "revoked", reversedUnits: 10,
    publiclyVisible: false, idempotentReplay: false
  }, error: null };
  if (name === "operator_reconcile_job_post_assistance_grant") return { data: {
    jobPostId: resourceId, grantId: assistanceEndInput.grantId, grantStatus: "revoked",
    economicStatus: "not_assessed", testMode: true, idempotentReplay: true
  }, error: null };
  throw new Error(`Unexpected assistance RPC ${name}`);
} };
await configureOperatorAssistanceProgram(assistanceSupabase, actorUserId, parseOperatorAssistanceProgram(assistanceProgramInput));
assert(assistanceRpc.args.p_actor_user_id === actorUserId && assistanceRpc.args.p_scope === "sandbox_credits", "Assistance program RPC lost its actor or narrow scope.");
await setOperatorAssistanceProgramStatus(assistanceSupabase, actorUserId, parseOperatorAssistanceProgramStatus(assistanceProgramStatusInput));
assert(assistanceRpc.args.p_target_status === "paused" && assistanceRpc.args.p_confirmation === "PAUSE TEST ECONOMIC ASSISTANCE PROGRAM", "Assistance program lifecycle RPC lost its audited transition.");
const issuedGrant = await issueOperatorAssistanceGrant(assistanceSupabase, actorUserId, parseOperatorAssistanceGrant(assistanceGrantInput));
assert(assistanceRpc.args.p_sponsorship_allocation_id === null && issuedGrant.sandboxCreditResult?.grantedUnits === 20 && !("operatorActorId" in issuedGrant.sandboxCreditResult), "Assistance grant RPC lost allocation shape or leaked its operator actor.");
await endOperatorAssistanceGrant(assistanceSupabase, actorUserId, parseOperatorAssistanceEnd(assistanceEndInput));
assert(assistanceRpc.args.p_action === "revoke", "Assistance end RPC lost its audited action.");
const reconciledJobAssistance = await reconcileOperatorJobPostAssistanceGrant(
  assistanceSupabase, actorUserId, parseOperatorJobPostAssistanceReconciliation(jobPostAssistanceReconciliationInput)
);
assert(assistanceRpc.args.p_end_action === "revoke" && reconciledJobAssistance.economicStatus === "not_assessed" && reconciledJobAssistance.publicationStatus === null, "Job Post assistance replay was not normalized without changing content approval.");

const organizationProjection = {
  organizations: [{
    organizationId,
    accountName: organizationInput.accountName,
    status: "active",
    relationships: ["authorized_signer", "billing_contact"],
    engagements: [{
      engagementId,
      serviceCode: "ecological_systems_review",
      status: "contract_pending",
      statementOfWorkVersion: engagementInput.statementOfWorkVersion,
      serviceTermsVersion: engagementInput.serviceTermsVersion,
      dataHandlingDisclosureVersion: engagementInput.dataHandlingDisclosureVersion,
      amountMinor: 50000,
      currency: "usd",
      checkoutAvailable: true
    }],
    sponsorshipAgreements: [{
      agreementId: sponsorshipAgreementId,
      status: "contract_pending",
      agreementVersion: sponsorshipInput.agreementVersion,
      disclosureVersion: sponsorshipInput.disclosureVersion,
      amountMinor: 100000,
      currency: "usd",
      publicRecognitionOptIn: false,
      publicRecognitionApproved: false,
      checkoutAvailable: true,
      recognitionPreferenceAvailable: false
    }]
  }],
  financialDetailsPrivate: true,
  affectsCommonsIdentity: false,
  testMode: true
};
const normalizedOrganizations = await loadCurrentEconomicOrganizations({
  rpc: async () => ({ data: organizationProjection, error: null })
});
assert(normalizedOrganizations.organizations.length === 1, "Organization self projection was not normalized.");
assert(
  normalizedOrganizations.organizations[0].engagements[0].amountMinor === 50000
    && normalizedOrganizations.organizations[0].sponsorshipAgreements[0].checkoutAvailable === true
    && !JSON.stringify(normalizedOrganizations).includes("provider")
    && !JSON.stringify(normalizedOrganizations).includes("privateReason"),
  "Signer self projection lost its private payable contract or exposed provider/private-reason data."
);
let unsafeOrganizationProjectionRejected = false;
try {
  await loadCurrentEconomicOrganizations({ rpc: async () => ({ data: {
    ...organizationProjection,
    organizations: [{ ...organizationProjection.organizations[0], providerCustomerReference: "cus_private" }]
  }, error: null }) });
} catch (error) { unsafeOrganizationProjectionRejected = error instanceof BillingHttpError; }
assert(unsafeOrganizationProjectionRejected, "Organization self projection accepted a provider identifier.");
const statusResponse = await handleEconomicOrganizationStatus(
  new Request(`${origin}/api/billing/organizations/status`),
  env,
  { authenticate: async () => auth, load: async () => normalizedOrganizations }
);
const statusPayload = await statusResponse.json();
assert(
  statusResponse.status === 200
    && Object.keys(statusPayload).sort().join(",") === "ok,status"
    && statusPayload.status.financialDetailsPrivate === true
    && statusPayload.status.affectsCommonsIdentity === false,
  "Organization status route did not preserve its private-finance and Commons-identity boundaries."
);
let disabledOrganizationLoads = 0;
const disabledOrganizationResponse = await handleEconomicOrganizationStatus(
  new Request(`${origin}/api/billing/organizations/status`),
  { ...env, BILLING_ORGANIZATION_SERVICES_ENABLED: "false" },
  {
    authenticate: async () => auth,
    load: async () => { disabledOrganizationLoads += 1; return normalizedOrganizations; }
  }
);
assert(disabledOrganizationResponse.status === 200 && disabledOrganizationLoads === 1, "Organization acquisition switch hid existing signer obligations and recognition withdrawal state.");

const recognitionProjection = {
  enabled: true,
  recognitions: [{
    label: "Regional Watershed Cooperative",
    summary: "Supports shared ecological infrastructure.",
    purposeCode: "commons_infrastructure",
    grantsAuthority: false,
    isEndorsement: false,
    amountMinor: 1_000_000,
    providerPaymentReference: "pi_private",
    agreementId: resourceId
  }],
  paymentGrantsAuthority: false
};
const normalizedRecognition = await loadPublicSponsorshipRecognition({
  rpc: async () => ({ data: recognitionProjection, error: null })
});
assert(
  normalizedRecognition.recognitions.length === 1
    && !JSON.stringify(normalizedRecognition).includes("1000000")
    && !JSON.stringify(normalizedRecognition).includes("pi_private")
    && !JSON.stringify(normalizedRecognition).includes(resourceId),
  "Public sponsorship recognition exposed amount, provider, or private agreement identifiers."
);
const recognitionResponse = await handleSponsorshipRecognition(
  new Request(`${origin}/api/billing/sponsorships/recognition`),
  env,
  { load: async () => normalizedRecognition }
);
let recognitionLoadsWithAcquisitionOff = 0;
const recognitionWithAcquisitionOff = await handleSponsorshipRecognition(
  new Request(`${origin}/api/billing/sponsorships/recognition`),
  { ...env, BILLING_ENABLED: "false" },
  { load: async () => { recognitionLoadsWithAcquisitionOff += 1; return normalizedRecognition; } }
);
assert(recognitionWithAcquisitionOff.status === 200 && recognitionLoadsWithAcquisitionOff === 1, "Acquisition kill switch erased reviewed sponsorship recognition.");
assert(recognitionResponse.status === 200 && (await recognitionResponse.json()).recognition.paymentGrantsAuthority === false, "Public recognition did not preserve the no-authority boundary.");
let disabledRecognitionLoads = 0;
const disabledRecognitionResponse = await handleSponsorshipRecognition(
  new Request(`${origin}/api/billing/sponsorships/recognition`),
  { ...env, BILLING_SPONSORSHIP_RECOGNITION_ENABLED: "false" },
  { load: async () => { disabledRecognitionLoads += 1; return normalizedRecognition; } }
);
const disabledRecognition = await disabledRecognitionResponse.json();
assert(
  disabledRecognitionResponse.status === 200
    && disabledRecognition.recognition.enabled === false
    && disabledRecognition.recognition.recognitions.length === 0
    && disabledRecognitionLoads === 0,
  "Disabled sponsorship recognition queried or exposed recognition records."
);

const unsafeRecognition = { ...recognitionProjection, recognitions: [{ ...recognitionProjection.recognitions[0], grantsAuthority: true }] };
let unsafeRecognitionRejected = false;
try { await loadPublicSponsorshipRecognition({ rpc: async () => ({ data: unsafeRecognition, error: null }) }); }
catch (error) { unsafeRecognitionRejected = error instanceof BillingHttpError; }
assert(unsafeRecognitionRejected, "Public sponsorship projection accepted an authority-granting record.");

const sponsorshipRecognitionRouteSource = await fs.readFile(
  "functions/api/billing/sponsorships/recognition.ts", "utf8"
);
assert(
  sponsorshipRecognitionRouteSource.includes("createEconomicServerClient(env)")
    && !sponsorshipRecognitionRouteSource.includes("createEconomicPublicClient"),
  "Public sponsorship recognition can bypass its environment gate through direct browser-role RPC execution."
);

const organizationSidecarMigration = await fs.readFile(
  "supabase/migrations/20260716060000_organization_sponsorship_waiver_sidecars.sql", "utf8"
);
for (const marker of [
  "private.organization_sponsorship_settlement_holds",
  "private.organization_sponsorship_settlement_hold_events",
  "private.open_organization_sponsorship_settlement_hold",
  "private.resolve_organization_sponsorship_settlement_hold",
  "late_settlement_after_terminal_state",
  "late_settlement_after_checkout_ineligibility",
  "terminal_state_after_settlement",
  "full_refund_verified",
  "full_verified_refund_required",
  "quarantine_terminal_organization_service_settlement",
  "quarantine_terminal_sponsorship_settlement"
]) assert(organizationSidecarMigration.includes(marker), `Organization/sponsorship settlement quarantine omitted ${marker}.`);
assert(
  organizationSidecarMigration.includes("'organization_sponsorship_settlement_holds',")
    && organizationSidecarMigration.includes("'organization_sponsorship_settlement_hold_events',")
    && organizationSidecarMigration.includes("org_sponsor_hold_events_are_append_only")
    && organizationSidecarMigration.includes("revoke all privileges on function private.resolve_organization_sponsorship_settlement_hold(uuid)"),
  "Organization/sponsorship settlement holds are not private, RLS-hardened, revoked, and append-only audited."
);
assert(
  /v_order\.status <> 'refunded'[\s\S]*?v_verified_paid_minor <= 0[\s\S]*?v_verified_refunded_minor < v_verified_paid_minor/.test(organizationSidecarMigration)
    && /status = 'resolved_full_refund'[\s\S]*?event_type[\s\S]*?'full_refund_verified'/.test(organizationSidecarMigration)
    && /create trigger reconcile_organization_sponsorship_hold_from_refund[\s\S]*?on private\.economic_refunds/.test(organizationSidecarMigration)
    && /settlement_hold\.status = 'open'[\s\S]*?organization_service_reconciliation_resolution_prerequisites_required/.test(organizationSidecarMigration)
    && /settlement_hold\.status = 'open'[\s\S]*?sponsorship_reconciliation_resolution_prerequisites_required/.test(organizationSidecarMigration),
  "A late-settlement hold can resolve without a complete durable refund or through an operator terminal-state shortcut."
);
assert(
  organizationSidecarMigration.includes("private.organization_service_checkout_is_eligible")
    && organizationSidecarMigration.includes("private.sponsorship_checkout_is_eligible")
    && (organizationSidecarMigration.match(/for share of organization, membership, account, price, product;/g) || []).length === 2
    && (organizationSidecarMigration.match(/and organization\.status = 'active'/g) || []).length >= 4,
  "Organization and sponsorship checkout do not authoritatively recheck and lock current signer, organization, account, and price eligibility."
);

console.log("Billing organization, sponsorship, and assistance smoke tests passed.");
