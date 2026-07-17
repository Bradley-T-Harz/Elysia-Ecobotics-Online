import fs from "node:fs/promises";
import { BillingHttpError } from "../functions/api/billing/_shared/http.ts";
import {
  attachOperatorTestRefundResult,
  grantOperatorSandboxCredits,
  loadCurrentEconomicAuditEvents,
  loadCurrentEconomicOperatorOverview,
  markOperatorReconciliationNeeded,
  placeOperatorRefundHold,
  prepareOperatorTestRefund,
  setEconomicOperatorAssignment
} from "../functions/api/billing/_shared/database.ts";
import {
  parseOperatorAssignment,
  parseOperatorReconciliation,
  parseOperatorRefundHold,
  parseOperatorTestRefundExecution,
  parseOperatorSandboxCreditGrant
} from "../functions/api/billing/_shared/schema.ts";
import { handleOperatorOverview } from "../functions/api/billing/operator/overview.ts";
import { handleOperatorAudit, parseEconomicAuditQuery } from "../functions/api/billing/operator/audit.ts";
import { handleOperatorAssignment } from "../functions/api/billing/operator/assignment.ts";
import { handleOperatorReconciliation } from "../functions/api/billing/operator/reconciliation.ts";
import { handleOperatorRefundHold } from "../functions/api/billing/operator/refund-hold.ts";
import { handleOperatorTestRefundExecution } from "../functions/api/billing/operator/refund-execution.ts";
import { handleOperatorSandboxCreditGrant } from "../functions/api/billing/operator/sandbox-credit-grant.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const origin = "https://elysiaecobotics.com";
const env = {
  BILLING_ENABLED: "true",
  BILLING_MODE: "test",
  BILLING_PUBLIC_ORIGIN: origin,
  BILLING_STAGING_ACCESS_CONFIRMED: "true",
  BILLING_EDGE_RATE_LIMIT_CONFIRMED: "true",
  BILLING_TEST_REFUNDS_ENABLED: "true",
  STRIPE_LIVE_ENABLED: "false"
};
const actorUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const targetUserId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const orderId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const paymentTransactionId = "abababab-abab-4bab-8bab-abababababab";
const clientRequestId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const auth = { accessToken: "synthetic", userId: actorUserId, email: "operator@example.invalid", supabase: {} };

function postRequest(path, body, options = {}) {
  return new Request(`${origin}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: options.origin ?? origin,
      ...(options.authorization === false ? {} : { authorization: "Bearer synthetic" })
    },
    body: JSON.stringify(body)
  });
}

const overviewValue = {
  authorized: true,
  capabilities: ["economic_reconciliation_manage", "economic_refunds_manage", "sandbox_credits_adjust"],
  queueLimit: 10,
  orderQueue: null,
  paymentQueue: null,
  refundablePaymentQueue: [{
    paymentTransactionId,
    orderId,
    publicReference: "opaque_order_reference_1234567890",
    flow: "support_one_time",
    status: "succeeded",
    grossAmountMinor: 900,
    refundableAmountMinor: 400,
    currency: "usd",
    occurredAt: "2026-07-16T11:55:00.000Z"
  }],
  refundQueue: [{
    requestId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    orderId,
    paymentTransactionId,
    status: "held_for_review",
    amountMinor: 500,
    currency: "usd",
    createdAt: "2026-07-16T12:00:00.000Z"
  }],
  subscriptionQueue: null,
  disputeQueue: [],
  webhookQueue: [],
  reconciliationQueue: [{
    caseId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    orderId,
    caseKind: "organization_service_settlement_hold",
    status: "open",
    openedAt: "2026-07-16T12:00:00.000Z"
  }],
  sandboxCorrectionQueue: [],
  jobPostEconomicQueue: null,
  sellerPayableQueue: null,
  sellerPayoutPreparationQueue: null,
  organizationServiceQueue: null,
  sponsorshipQueue: null,
  accountRequestQueue: null,
  assistanceProgramQueue: null,
  assistanceQueue: null,
  featureFlags: null,
  providerIdentifiersExposed: false,
  personalContactDataExposed: false,
  testMode: true
};
const overviewResponse = await handleOperatorOverview(
  new Request(`${origin}/api/billing/operator/overview`, { headers: { authorization: "Bearer synthetic" } }),
  env,
  { authenticate: async () => auth, load: async () => overviewValue }
);
const overviewPayload = await overviewResponse.json();
assert(overviewResponse.status === 200 && overviewPayload.operator.refundQueue.length === 1, "Authenticated operator overview queue was unavailable.");
assert(
  overviewPayload.operator.refundablePaymentQueue[0].paymentTransactionId === paymentTransactionId
    && overviewPayload.operator.refundablePaymentQueue[0].refundableAmountMinor === 400
    && !JSON.stringify(overviewPayload).includes("providerPayment"),
  "Operator overview did not expose a bounded internal refundable transaction choice safely."
);
assert(overviewResponse.headers.get("cache-control") === "no-store" && !JSON.stringify(overviewPayload).includes(actorUserId), "Operator overview was cached or exposed its actor identifier.");
assert((await handleOperatorOverview(
  new Request(`${origin}/api/billing/operator/overview`, { headers: { authorization: "Bearer synthetic" } }),
  { ...env, BILLING_ENABLED: "false" },
  { authenticate: async () => auth, load: async () => overviewValue }
)).status === 200, "Acquisition kill switch removed private operator queue visibility.");
assert((await handleOperatorOverview(
  new Request(`${origin}/api/billing/operator/overview`, { headers: { authorization: "Bearer synthetic" } }),
  { ...env, BILLING_PUBLIC_ORIGIN: undefined },
  { authenticate: async () => auth, load: async () => overviewValue }
)).status === 200, "Read-only operator history incorrectly required a Checkout redirect origin.");
const anonymousOverview = await handleOperatorOverview(new Request(`${origin}/api/billing/operator/overview`), env, {
  authenticate: async () => { throw new BillingHttpError(401, "authentication_required"); },
  load: async () => { throw new Error("must not load"); }
});
assert(anonymousOverview.status === 401, "Anonymous operator overview access was accepted.");
assert((await handleOperatorOverview(new Request(`${origin}/api/billing/operator/overview`), { ...env, BILLING_MODE: "live" }, {
  authenticate: async () => auth,
  load: async () => overviewValue
})).status === 503, "Operator overview did not fail closed in live mode.");

function boundedUuid(index) {
  return `10000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}
const busyRows = Array.from({ length: 10 }, (_, index) => ({
  index,
  id: boundedUuid(index + 1),
  orderId: boundedUuid(index + 101),
  transactionId: boundedUuid(index + 201),
  publicReference: `${"r".repeat(150)}${String(index).padStart(2, "0")}`
}));
const reviewedFeatureKeys = [
  "customer_portal", "economic_assistance_workflow", "economic_webhooks",
  "job_post_fee_enforcement", "live_stripe", "marketplace_paid_offers",
  "marketplace_payout_preparation", "marketplace_payouts", "marketplace_seller_onboarding",
  "organization_billing", "organization_contract_workflow", "public_support_recognition",
  "recurring_support", "sandbox_credit_display", "sandbox_credit_enforcement",
  "sandbox_credit_purchase", "sponsorship_checkout", "sponsorship_display",
  "sponsorship_review_workflow", "support_checkout", "test_refund_execution"
];
const busiestAllowedOverview = {
  authorized: true,
  capabilities: [
    "economic_orders_view", "economic_payments_view", "economic_operator_assignments_manage",
    "economic_feature_flags_manage", "economic_refunds_manage", "economic_reconciliation_manage",
    "recurring_support_manage", "sandbox_credits_adjust", "job_fee_assess", "marketplace_payout_manage",
    "organization_billing_manage", "sponsorship_manage", "economic_assistance_manage",
    "economic_account_requests_manage", "economic_audit_view", "accounting_export"
  ],
  queueLimit: 10,
  orderQueue: busyRows.map((row) => ({
    orderId: row.orderId, publicReference: row.publicReference, flow: "organization_service",
    status: "partially_refunded", amountMinor: 100_000_000_000, currency: "usd",
    createdAt: "2026-07-16T12:00:00.000Z"
  })),
  paymentQueue: busyRows.map((row) => ({
    paymentTransactionId: row.transactionId, orderId: row.orderId, publicReference: row.publicReference,
    flow: "organization_service", status: "succeeded", grossAmountMinor: 100_000_000_000,
    processorFeeMinor: 1_000_000, netAmountMinor: 99_999_000_000, currency: "usd",
    occurredAt: "2026-07-16T12:00:00.000Z"
  })),
  refundablePaymentQueue: busyRows.map((row) => ({
    paymentTransactionId: row.transactionId, orderId: row.orderId, publicReference: row.publicReference,
    flow: "organization_service", status: "disputed", grossAmountMinor: 100_000_000_000,
    refundableAmountMinor: 100_000_000_000, currency: "usd", occurredAt: "2026-07-16T12:00:00.000Z"
  })),
  refundQueue: busyRows.map((row) => ({
    requestId: row.id, orderId: row.orderId, paymentTransactionId: row.transactionId,
    status: "approved_for_provider", amountMinor: 100_000_000_000, currency: "usd",
    createdAt: "2026-07-16T12:00:00.000Z"
  })),
  subscriptionQueue: busyRows.map((row) => ({
    subscriptionId: row.id, userId: row.transactionId, originatingOrderId: row.orderId,
    status: "canceling", cancelAtPeriodEnd: true, currentPeriodEnd: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-07-16T12:00:00.000Z"
  })),
  disputeQueue: busyRows.map((row) => ({
    disputeId: row.id, orderId: row.orderId, paymentTransactionId: row.transactionId,
    status: "needs_response", reasonCode: "fraudulent", amountMinor: 100_000_000_000,
    currency: "usd", createdAt: "2026-07-16T12:00:00.000Z", updatedAt: "2026-07-16T12:00:00.000Z"
  })),
  webhookQueue: busyRows.map((row) => ({
    eventId: row.id, eventType: "checkout.session.completed", processingStatus: "unmatched",
    processingAttempts: 100, eventCreatedAt: "2026-07-16T12:00:00.000Z",
    receivedAt: "2026-07-16T12:00:00.000Z"
  })),
  reconciliationQueue: busyRows.map((row) => ({
    caseId: row.id, orderId: row.orderId, caseKind: "economic_reconciliation_case", status: "waiting_for_provider",
    openedAt: "2026-07-16T12:00:00.000Z"
  })),
  sandboxCorrectionQueue: busyRows.map((row) => ({
    shortfallId: row.id, fulfillmentId: row.transactionId,
    fulfillmentScope: row.index % 2 === 0 ? "sandbox_credit_order" : "recurring_support_payment",
    orderId: row.orderId, paymentTransactionId: row.index % 2 === 0 ? null : row.transactionId,
    adjustmentKind: "refund_or_lost_dispute",
    targetUnits: 10_000_000, appliedUnits: 1, missingUnits: 9_999_999, status: "reviewed",
    createdAt: "2026-07-16T12:00:00.000Z"
  })),
  jobPostEconomicQueue: busyRows.map((row) => ({
    conditionId: row.id, jobPostId: row.orderId, authorUserId: row.transactionId,
    classification: "commercial", status: "payment_required", orderId: null,
    termsVersion: "job-post-test-terms-v1", updatedAt: "2026-07-16T12:00:00.000Z"
  })),
  sellerPayableQueue: busyRows.map((row) => ({
    sellerAccountId: row.id, currency: "usd", availablePayableMinor: 100_000_000_000,
    sellerStatus: "ready"
  })),
  sellerPayoutPreparationQueue: busyRows.map((row) => ({
    payoutPreparationId: row.id, sellerAccountId: row.transactionId, amountMinor: 100_000_000_000,
    currency: "usd", status: "transfer_pending", createdAt: "2026-07-16T12:00:00.000Z"
  })),
  organizationServiceQueue: busyRows.map((row) => ({
    engagementId: row.id, organizationId: row.transactionId, serviceCode: "ecological_system_review",
    status: "reconciliation_required", entitlementState: "suspended", supportAgreementState: "suspended",
    orderId: row.orderId, updatedAt: "2026-07-16T12:00:00.000Z"
  })),
  sponsorshipQueue: busyRows.map((row) => ({
    sponsorshipAgreementId: row.id, organizationId: row.transactionId, status: "reconciliation_required",
    purposeCode: "commons_infrastructure", publicRecognitionOptIn: true,
    publicRecognitionApproved: true, orderId: row.orderId, updatedAt: "2026-07-16T12:00:00.000Z"
  })),
  accountRequestQueue: busyRows.map((row) => ({
    requestId: row.id, requestType: "economic_account_closure", status: "identity_verification",
    submittedAt: "2026-07-16T12:00:00.000Z", providerCancellationRequired: true
  })),
  assistanceProgramQueue: busyRows.map((row) => ({
    programId: row.id, programCode: `sandbox_access_${row.index}`, kind: "sponsored_access",
    scope: "sandbox_credits", status: "active", startsAt: "2026-07-16T12:00:00.000Z",
    endsAt: "2027-07-16T12:00:00.000Z", updatedAt: "2026-07-16T12:00:00.000Z"
  })),
  assistanceQueue: busyRows.map((row) => ({
    grantId: row.id, scope: "sandbox_credits", status: "consumed",
    expiresAt: "2027-07-16T12:00:00.000Z"
  })),
  featureFlags: reviewedFeatureKeys.map((featureKey) => ({
    featureKey, enabled: featureKey !== "live_stripe" && featureKey !== "marketplace_payouts", testModeOnly: featureKey !== "live_stripe",
    updatedAt: "2026-07-16T12:00:00.000Z"
  })),
  providerIdentifiersExposed: false,
  personalContactDataExposed: false,
  testMode: true
};
const busiestOverviewResponse = await handleOperatorOverview(
  new Request(`${origin}/api/billing/operator/overview`, { headers: { authorization: "Bearer synthetic" } }),
  env,
  { authenticate: async () => auth, load: async () => busiestAllowedOverview }
);
const busiestOverviewText = await busiestOverviewResponse.text();
assert(
  busiestOverviewResponse.status === 200
    && new TextEncoder().encode(busiestOverviewText).byteLength <= 131_072,
  "A fully privileged eighteen-queue operator response exceeded the shared 128 KiB response contract."
);
const parsedBusiestOverview = await loadCurrentEconomicOperatorOverview({
  rpc: async () => ({ data: busiestAllowedOverview, error: null })
});
assert(
  parsedBusiestOverview.orderQueue?.length === 10
    && parsedBusiestOverview.paymentQueue?.length === 10
    && parsedBusiestOverview.featureFlags?.length === reviewedFeatureKeys.length,
  "The complete operator projection rejected a bounded queue or truncated the reviewed kill-switch inventory."
);
let truncatedFlagsRejected = false;
try {
  await loadCurrentEconomicOperatorOverview({ rpc: async () => ({
    data: { ...busiestAllowedOverview, featureFlags: busiestAllowedOverview.featureFlags.slice(0, 10) }, error: null
  }) });
} catch (error) { truncatedFlagsRejected = error instanceof BillingHttpError; }
assert(truncatedFlagsRejected, "Operator overview accepted a truncated kill-switch inventory.");
let mismatchedSandboxCorrectionScopeRejected = false;
try {
  await loadCurrentEconomicOperatorOverview({ rpc: async () => ({
    data: {
      ...busiestAllowedOverview,
      sandboxCorrectionQueue: [{
        ...busiestAllowedOverview.sandboxCorrectionQueue[0],
        fulfillmentScope: "recurring_support_payment",
        paymentTransactionId: null
      }]
    }, error: null
  }) });
} catch (error) { mismatchedSandboxCorrectionScopeRejected = error instanceof BillingHttpError; }
assert(mismatchedSandboxCorrectionScopeRejected, "Operator overview accepted a recurring-payment correction without an internal payment transaction.");

const auditQuery = parseEconomicAuditQuery(new Request(`${origin}/api/billing/operator/audit?limit=2`));
assert(auditQuery.limit === 2 && auditQuery.afterId === null, "Economic audit query did not apply bounded first-page semantics.");
for (const unsafeUrl of [
  `${origin}/api/billing/operator/audit?limit=201`,
  `${origin}/api/billing/operator/audit?afterId=${orderId}`,
  `${origin}/api/billing/operator/audit?limit=2&limit=3`,
  `${origin}/api/billing/operator/audit?providerEventId=evt_private`
]) {
  let rejected = false;
  try { parseEconomicAuditQuery(new Request(unsafeUrl)); } catch (error) { rejected = error instanceof BillingHttpError; }
  assert(rejected, "Economic audit query accepted an over-broad, incomplete, duplicate, or provider cursor.");
}
const auditRows = [{
  eventId: boundedUuid(901), action: "economic_assistance_program_paused",
  targetType: "economic_assistance_program", targetId: boundedUuid(902),
  actorKind: "economic_operator", createdAt: "2026-07-16T12:00:00.000Z"
}, {
  eventId: boundedUuid(903), action: "economic_webhook_ignored",
  targetType: "economic_webhook_event", targetId: null,
  actorKind: "provider_webhook", createdAt: "2026-07-16T11:59:00.000Z"
}];
let auditRpcArgs = null;
const normalizedAudit = await loadCurrentEconomicAuditEvents({ rpc: async (_name, args) => {
  auditRpcArgs = args;
  return { data: {
    events: auditRows, limit: 2, providerIdentifiersExposed: false,
    personalContactDataExposed: false, testMode: true
  }, error: null };
} }, auditQuery);
assert(auditRpcArgs.p_limit === 2 && normalizedAudit.nextCursor?.afterId === auditRows[1].eventId, "Economic audit adapter lost its bounded cursor or next-page token.");
assert(!JSON.stringify(normalizedAudit).includes("reason") && !JSON.stringify(normalizedAudit).includes("metadata"), "Economic audit API exposed private reasons or metadata.");
const auditResponse = await handleOperatorAudit(
  new Request(`${origin}/api/billing/operator/audit?limit=2`, { headers: { authorization: "Bearer synthetic" } }),
  { ...env, BILLING_ENABLED: "false", BILLING_PUBLIC_ORIGIN: undefined },
  { authenticate: async () => auth, load: async (_auth, query) => ({ ...normalizedAudit, limit: query.limit }) }
);
assert(auditResponse.status === 200 && (await auditResponse.json()).audit.events.length === 2, "Private economic audit became unavailable when acquisition or redirect configuration was disabled.");

const sandboxBody = {
  userId: targetUserId,
  units: 4_000,
  sourceType: "waiver",
  sourceReference: "waiver:case-17",
  expiresAt: null,
  idempotencyKey: clientRequestId,
  confirmation: "GRANT TEST SANDBOX SERVICE UNITS",
  reason: "Approved accessibility waiver for hosted sandbox testing."
};
assert(parseOperatorSandboxCreditGrant(sandboxBody).units === 4_000, "Valid operator sandbox grant was rejected.");
for (const invalidBody of [
  { ...sandboxBody, units: 0 },
  { ...sandboxBody, units: 1_000_000_001 },
  { ...sandboxBody, sourceType: "purchased" },
  { ...sandboxBody, reason: "short" },
  { ...sandboxBody, confirmation: "yes" },
  { ...sandboxBody, idempotencyKey: "not-a-uuid" },
  { ...sandboxBody, actorUserId }
]) {
  let rejected = false;
  try { parseOperatorSandboxCreditGrant(invalidBody); } catch (error) { rejected = error instanceof BillingHttpError; }
  assert(rejected, "Operator sandbox schema accepted an invalid, overbroad, or forged-actor request.");
}

let sandboxActor = null;
let sandboxMutations = 0;
const sandboxDependencies = {
  authenticate: async () => auth,
  mutate: async (_env, actor, input) => {
    sandboxActor = actor;
    sandboxMutations += 1;
    return {
      creditLotId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      grantedUnits: input.units,
      sourceCategory: input.sourceType,
      expiresAt: input.expiresAt,
      idempotentReplay: false,
      testMode: true
    };
  }
};
const sandboxResponse = await handleOperatorSandboxCreditGrant(postRequest("/api/billing/operator/sandbox-credit-grant", sandboxBody), env, sandboxDependencies);
assert(sandboxResponse.status === 201 && sandboxActor === actorUserId && sandboxMutations === 1, "Sandbox grant did not derive its operator actor from authentication.");
const forgedSandboxResponse = await handleOperatorSandboxCreditGrant(
  postRequest("/api/billing/operator/sandbox-credit-grant", { ...sandboxBody, actorUserId: targetUserId }),
  env,
  sandboxDependencies
);
assert(forgedSandboxResponse.status === 400 && sandboxMutations === 1, "Forged sandbox operator actor reached a mutation.");
const anonymousSandboxResponse = await handleOperatorSandboxCreditGrant(postRequest("/api/billing/operator/sandbox-credit-grant", sandboxBody, { authorization: false }), env, {
  ...sandboxDependencies,
  authenticate: async () => { throw new BillingHttpError(401, "authentication_required"); }
});
assert(anonymousSandboxResponse.status === 401 && sandboxMutations === 1, "Anonymous sandbox operator mutation was accepted.");
assert((await handleOperatorSandboxCreditGrant(postRequest("/api/billing/operator/sandbox-credit-grant", sandboxBody, { origin: "https://attacker.example" }), env, sandboxDependencies)).status === 403, "Cross-origin operator mutation was accepted.");

const refundBody = {
  orderId,
  paymentTransactionId,
  amountMinor: 500,
  clientRequestId,
  confirmation: "PLACE TEST REFUND HOLD",
  reason: "Customer requested a test-mode refund; held for separate review."
};
assert(parseOperatorRefundHold(refundBody).amountMinor === 500, "Valid refund hold request was rejected.");
for (const invalidBody of [
  { ...refundBody, amountMinor: 0 },
  { ...refundBody, amountMinor: 1_000_000_001 },
  { ...refundBody, actorUserId },
  { ...refundBody, confirmation: "refund it" },
  { ...refundBody, orderId: "bad" },
  { ...refundBody, paymentTransactionId: "bad" }
]) {
  let rejected = false;
  try { parseOperatorRefundHold(invalidBody); } catch (error) { rejected = error instanceof BillingHttpError; }
  assert(rejected, "Refund hold schema accepted an invalid amount, identifier, or forged actor.");
}
let refundActor = null;
const refundResponse = await handleOperatorRefundHold(postRequest("/api/billing/operator/refund-hold", refundBody), env, {
  authenticate: async () => auth,
  mutate: async (_env, actor, input) => {
    refundActor = actor;
    return {
      refundRequestId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      orderId: input.orderId,
      paymentTransactionId: input.paymentTransactionId,
      amountMinor: input.amountMinor,
      currency: "usd",
      status: "held_for_review",
      idempotentReplay: false
    };
  }
});
assert(refundResponse.status === 201 && refundActor === actorUserId, "Refund hold did not bind the authenticated operator.");
const refundPayload = await refundResponse.json();
assert(
  refundPayload.refundHold.paymentTransactionId === paymentTransactionId
    && !JSON.stringify(refundPayload).includes("pi_"),
  "Refund hold response lost its internal transaction scope or exposed a provider payment identifier."
);
assert((await handleOperatorRefundHold(
  postRequest("/api/billing/operator/refund-hold", refundBody),
  { ...env, BILLING_ENABLED: "false" },
  {
    authenticate: async () => auth,
    mutate: async (_env, _actor, input) => ({
      refundRequestId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      orderId: input.orderId, paymentTransactionId: input.paymentTransactionId,
      amountMinor: input.amountMinor, currency: "usd", status: "held_for_review", idempotentReplay: true
    })
  }
)).status === 201, "Acquisition kill switch prevented refund remediation.");

const refundExecutionBody = {
  refundRequestId: "13131313-1313-4313-8313-131313131313",
  approvalClientRequestId: "14141414-1414-4414-8414-141414141414",
  providerAttachClientRequestId: "15151515-1515-4515-8515-151515151515",
  confirmation: "AUTHORIZE TEST REFUND",
  reason: "Independently approve and execute the reviewed test-mode refund hold."
};
assert(parseOperatorTestRefundExecution(refundExecutionBody).confirmation === "AUTHORIZE TEST REFUND", "Valid test refund execution was rejected.");
for (const invalidBody of [
  { ...refundExecutionBody, confirmation: "AUTHORIZE REFUND" },
  { ...refundExecutionBody, providerPaymentReference: "pi_attacker" },
  { ...refundExecutionBody, providerRefundReference: "re_attacker" },
  { ...refundExecutionBody, amountMinor: 500 },
  { ...refundExecutionBody, actorUserId }
]) {
  let rejected = false;
  try { parseOperatorTestRefundExecution(invalidBody); } catch (error) { rejected = error instanceof BillingHttpError; }
  assert(rejected, "Test refund execution accepted browser pricing, provider identifiers, actor, or weak confirmation.");
}
let refundExecutionActor = null;
let refundProviderInput = null;
let refundAttachActor = null;
const refundExecutionResponse = await handleOperatorTestRefundExecution(
  postRequest("/api/billing/operator/refund-execution", refundExecutionBody),
  env,
  {
    authenticate: async () => auth,
    prepare: async (_env, actor) => {
      refundExecutionActor = actor;
      return {
        refundRequestId: refundExecutionBody.refundRequestId,
        orderId,
        providerPaymentReference: "pi_private_fixture",
        amountMinor: 500,
        currency: "usd",
        providerIdempotencyKey: `refund:${refundExecutionBody.refundRequestId}`,
        idempotentReplay: false
      };
    },
    provider: () => ({ createRefund: async (input) => {
      refundProviderInput = input;
      return {
        providerRefundReference: "re_private_fixture",
        status: "succeeded",
        providerEventCreatedAt: "2026-07-16T12:00:00.000Z",
        providerResponseSha256: "a".repeat(64)
      };
    } }),
    attach: async (_env, actor) => {
      refundAttachActor = actor;
      return {
        refundRequestId: refundExecutionBody.refundRequestId,
        orderId,
        economicRefundId: "16161616-1616-4616-8616-161616161616",
        status: "completed",
        providerStatus: "succeeded",
        idempotentReplay: false,
        testMode: true
      };
    }
  }
);
const refundExecutionPayload = await refundExecutionResponse.json();
assert(refundExecutionResponse.status === 200 && refundExecutionActor === actorUserId && refundAttachActor === actorUserId, "Test refund did not use the authenticated approving operator throughout.");
assert(refundProviderInput.providerPaymentReference === "pi_private_fixture" && refundProviderInput.idempotencyKey === `refund:${refundExecutionBody.refundRequestId}`, "Test refund did not use private DB provider data and DB-derived idempotency.");
assert(!JSON.stringify(refundExecutionPayload).includes("pi_private") && !JSON.stringify(refundExecutionPayload).includes("re_private") && !JSON.stringify(refundExecutionPayload).includes("aaaa"), "Test refund response exposed provider identifiers or response hash.");
assert((await handleOperatorTestRefundExecution(
  postRequest("/api/billing/operator/refund-execution", refundExecutionBody),
  { ...env, BILLING_TEST_REFUNDS_ENABLED: "false" },
  { authenticate: async () => auth, prepare: async () => { throw new Error("must not prepare"); }, provider: () => ({}), attach: async () => { throw new Error("must not attach"); } }
)).status === 503, "Test refund execution kill switch did not fail closed.");
const selfApprovalResponse = await handleOperatorTestRefundExecution(postRequest("/api/billing/operator/refund-execution", refundExecutionBody), env, {
  authenticate: async () => auth,
  prepare: (_env, actor, input) => prepareOperatorTestRefund(
    { rpc: async () => ({ data: null, error: { code: "42501" } }) }, actor, input
  ),
  provider: () => ({ createRefund: async () => { throw new Error("must not call provider"); } }),
  attach: async () => { throw new Error("must not attach"); }
});
assert(selfApprovalResponse.status === 403, "Original refund requester could approve and execute their own hold.");

const reconciliationBody = {
  orderId,
  clientRequestId,
  confirmation: "OPEN ECONOMIC RECONCILIATION CASE",
  reason: "Provider and internal order state need private reconciliation review."
};
assert(parseOperatorReconciliation(reconciliationBody).orderId === orderId, "Valid reconciliation request was rejected.");
let weakReconciliationRejected = false;
try { parseOperatorReconciliation({ ...reconciliationBody, confirmation: "open" }); }
catch (error) { weakReconciliationRejected = error instanceof BillingHttpError; }
assert(weakReconciliationRejected, "Reconciliation accepted a weak confirmation.");
let reconciliationActor = null;
const reconciliationResponse = await handleOperatorReconciliation(postRequest("/api/billing/operator/reconciliation", reconciliationBody), env, {
  authenticate: async () => auth,
  mutate: async (_env, actor, input) => {
    reconciliationActor = actor;
    return {
      reconciliationCaseId: "11111111-1111-4111-8111-111111111111",
      orderId: input.orderId,
      status: "open",
      idempotentReplay: false
    };
  }
});
assert(reconciliationResponse.status === 201 && reconciliationActor === actorUserId, "Reconciliation case did not bind the authenticated operator.");
assert((await handleOperatorReconciliation(
  postRequest("/api/billing/operator/reconciliation", reconciliationBody),
  { ...env, BILLING_ENABLED: "false" },
  {
    authenticate: async () => auth,
    mutate: async (_env, _actor, input) => ({
      reconciliationCaseId: "11111111-1111-4111-8111-111111111111",
      orderId: input.orderId, status: "open", idempotentReplay: true
    })
  }
)).status === 201, "Acquisition kill switch prevented reconciliation remediation.");

const assignmentBody = {
  userId: targetUserId,
  capability: "job_fee_assess",
  enabled: true,
  confirmation: "grant-economic-capability",
  reason: "Assign Job Post fee assessment without granting community review authority."
};
assert(parseOperatorAssignment(assignmentBody).capability === "job_fee_assess", "Valid economic capability assignment was rejected.");
assert(
  parseOperatorAssignment({ ...assignmentBody, capability: "economic_feature_flags_manage" }).capability === "economic_feature_flags_manage",
  "The bootstrap manager cannot grant the separately reviewed feature-flag capability."
);
for (const invalidBody of [
  { ...assignmentBody, capability: "administrator" },
  { ...assignmentBody, enabled: "true" },
  { ...assignmentBody, confirmation: "revoke-economic-capability" },
  { ...assignmentBody, actorUserId },
  { ...assignmentBody, communityRole: "administrator" }
]) {
  let rejected = false;
  try { parseOperatorAssignment(invalidBody); } catch (error) { rejected = error instanceof BillingHttpError; }
  assert(rejected, "Economic capability assignment accepted forged authority or an invalid confirmation.");
}
let assignmentActor = null;
const assignmentResponse = await handleOperatorAssignment(postRequest("/api/billing/operator/assignment", assignmentBody), env, {
  authenticate: async () => auth,
  mutate: async (_env, actor, input) => {
    assignmentActor = actor;
    return {
      assignmentId: "12121212-1212-4212-8212-121212121212",
      userId: input.userId,
      capability: input.capability,
      active: input.enabled,
      idempotentReplay: false
    };
  }
});
assert(assignmentResponse.status === 200 && assignmentActor === actorUserId, "Manager assignment route did not derive its actor from bearer authentication.");
const forgedAssignment = await handleOperatorAssignment(
  postRequest("/api/billing/operator/assignment", { ...assignmentBody, actorUserId: targetUserId }),
  env,
  { authenticate: async () => auth, mutate: async () => { throw new Error("forged body reached mutation"); } }
);
assert(forgedAssignment.status === 400, "A forged assignment actor reached the operator mutation.");
const nonManagerAssignment = await handleOperatorAssignment(postRequest("/api/billing/operator/assignment", assignmentBody), env, {
  authenticate: async () => auth,
  mutate: (_env, actor, input) => setEconomicOperatorAssignment(
    { rpc: async () => ({ data: null, error: { code: "42501" } }) }, actor, input
  )
});
assert(nonManagerAssignment.status === 403, "A user without economic_operator_assignments_manage was allowed to assign finance capabilities.");

let rpcCall = null;
const rpc = async (name, args) => {
  rpcCall = { name, args };
  if (name === "operator_grant_sandbox_credit_units") return { data: {
    creditLotId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    grantedUnits: sandboxBody.units,
    sourceCategory: sandboxBody.sourceType,
    expiresAt: null,
    idempotentReplay: false,
    testMode: true,
    operatorActorId: actorUserId
  }, error: null };
  if (name === "operator_place_refund_hold") return { data: {
    refundRequestId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    orderId,
    paymentTransactionId,
    amountMinor: refundBody.amountMinor,
    currency: "usd",
    status: "held_for_review",
    idempotentReplay: false
  }, error: null };
  if (name === "operator_prepare_test_refund") return { data: {
    refundRequestId: refundExecutionBody.refundRequestId,
    orderId,
    provider: "stripe",
    providerPaymentReference: "pi_private_fixture",
    amountMinor: 500,
    currency: "usd",
    providerIdempotencyKey: `refund:${refundExecutionBody.refundRequestId}`,
    status: "approved_for_provider",
    testMode: true,
    idempotentReplay: false
  }, error: null };
  if (name === "attach_economic_test_refund_result") return { data: {
    refundRequestId: refundExecutionBody.refundRequestId,
    orderId,
    economicRefundId: "16161616-1616-4616-8616-161616161616",
    status: "completed",
    providerStatus: "succeeded",
    testMode: true,
    idempotentReplay: false
  }, error: null };
  if (name === "operator_mark_reconciliation_needed") return { data: {
    reconciliationCaseId: "11111111-1111-4111-8111-111111111111",
    orderId,
    status: "open",
    idempotentReplay: false
  }, error: null };
  if (name === "set_economic_operator_assignment") return { data: {
    assignmentId: "12121212-1212-4212-8212-121212121212",
    userId: assignmentBody.userId,
    capability: assignmentBody.capability,
    active: true,
    idempotentReplay: false
  }, error: null };
  if (name === "current_user_economic_operator_overview") return { data: {
    ...overviewValue
  }, error: null };
  throw new Error(`Unexpected RPC ${name}`);
};
const mockSupabase = { rpc };
await grantOperatorSandboxCredits(mockSupabase, actorUserId, parseOperatorSandboxCreditGrant(sandboxBody));
assert(rpcCall.name === "operator_grant_sandbox_credit_units" && rpcCall.args.p_actor_user_id === actorUserId && !("actorUserId" in rpcCall.args), "Sandbox RPC did not use the server-derived actor parameter.");
await placeOperatorRefundHold(mockSupabase, actorUserId, parseOperatorRefundHold(refundBody));
assert(
  rpcCall.name === "operator_place_refund_hold"
    && rpcCall.args.p_actor_user_id === actorUserId
    && rpcCall.args.p_payment_transaction_id === paymentTransactionId
    && Object.keys(rpcCall.args).sort().join(",") === "p_actor_user_id,p_amount_minor,p_client_request_id,p_order_id,p_payment_transaction_id,p_reason",
  "Refund RPC did not use the frozen transaction-scoped six-argument contract."
);
const parsedRefundExecution = parseOperatorTestRefundExecution(refundExecutionBody);
await prepareOperatorTestRefund(mockSupabase, actorUserId, parsedRefundExecution);
assert(rpcCall.name === "operator_prepare_test_refund" && rpcCall.args.p_actor_user_id === actorUserId && rpcCall.args.p_confirmation === "AUTHORIZE TEST REFUND", "Refund approval RPC lost its server-derived actor or explicit confirmation.");
await attachOperatorTestRefundResult(mockSupabase, actorUserId, parsedRefundExecution, {
  providerRefundReference: "re_private_fixture",
  status: "succeeded",
  providerEventCreatedAt: "2026-07-16T12:00:00.000Z",
  providerResponseSha256: "a".repeat(64)
});
assert(rpcCall.name === "attach_economic_test_refund_result" && rpcCall.args.p_actor_user_id === actorUserId && rpcCall.args.p_provider_attach_client_request_id === refundExecutionBody.providerAttachClientRequestId, "Refund result attachment lost its actor or independent idempotency key.");
await markOperatorReconciliationNeeded(mockSupabase, actorUserId, parseOperatorReconciliation(reconciliationBody));
assert(rpcCall.name === "operator_mark_reconciliation_needed" && rpcCall.args.p_actor_user_id === actorUserId, "Reconciliation RPC did not use the server-derived actor parameter.");
await setEconomicOperatorAssignment(mockSupabase, actorUserId, parseOperatorAssignment(assignmentBody));
assert(rpcCall.name === "set_economic_operator_assignment" && rpcCall.args.p_actor_user_id === actorUserId && !("p_actor_user_id" in assignmentBody), "Assignment RPC did not use only the server-derived actor parameter.");
const parsedOverview = await loadCurrentEconomicOperatorOverview(mockSupabase);
assert(
  parsedOverview.authorized
    && parsedOverview.refundQueue?.length === 1
    && parsedOverview.refundQueue[0].paymentTransactionId === paymentTransactionId
    && parsedOverview.refundablePaymentQueue?.[0].refundableAmountMinor === 400
    && parsedOverview.reconciliationQueue?.length === 1
    && parsedOverview.reconciliationQueue[0].caseKind === "organization_service_settlement_hold",
  "Final 70000 operator queue projection was not transaction-scoped and strictly parsed."
);
let legacyOverviewRejected = false;
try {
  await loadCurrentEconomicOperatorOverview({ rpc: async () => ({ data: {
    authorized: true,
    capabilities: overviewValue.capabilities,
    open_refund_holds: 2,
    open_reconciliation_cases: 3,
    test_mode: true
  }, error: null }) });
} catch (error) {
  legacyOverviewRejected = error instanceof BillingHttpError && error.code === "billing_database_invalid";
}
assert(legacyOverviewRejected, "Stale pre-70000 operator-count projection was accepted as the final queue contract.");

let capabilityDenied = false;
try {
  await placeOperatorRefundHold({ rpc: async () => ({ data: null, error: { code: "42501" } }) }, actorUserId, parseOperatorRefundHold(refundBody));
} catch (error) {
  capabilityDenied = error instanceof BillingHttpError && error.status === 403 && error.code === "economic_operator_forbidden";
}
assert(capabilityDenied, "Missing economic capability did not fail closed independently of community role.");

const operatorRouteFiles = await fs.readdir("functions/api/billing/operator");
assert(!operatorRouteFiles.some((name) => /bootstrap/i.test(name)), "Economic-operator bootstrap was exposed as a browser billing route.");
assert(operatorRouteFiles.includes("assignment.ts"), "The capability-manager assignment route is missing.");
const assignmentRouteSource = await fs.readFile("functions/api/billing/operator/assignment.ts", "utf8");
assert(!/(has_role|user_roles|profiles|administrator|is_admin)/i.test(assignmentRouteSource), "Assignment route inferred finance authority from community administration.");

console.log("Billing economic operator route smoke test ok.");
