import fs from "node:fs/promises";
import { BillingHttpError } from "../functions/api/billing/_shared/http.ts";
import { assessOperatorJobPostFee, loadCurrentUserJobPostEconomicStatus, prepareJobPostCheckout } from "../functions/api/billing/_shared/database.ts";
import { parseJobPostCheckout, parseOperatorJobPostFeeAssessment } from "../functions/api/billing/_shared/schema.ts";
import { handleJobPostCheckout } from "../functions/api/billing/job-post/checkout.ts";
import { handleJobPostStatus } from "../functions/api/billing/job-post/status.ts";
import { handleOperatorJobPostFeeAssessment } from "../functions/api/billing/operator/job-post-fee-assessment.ts";

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
  BILLING_JOB_POST_FEES_ENABLED: "true",
  BILLING_WEBHOOK_FULFILLMENT_ENABLED: "true",
  BILLING_NOTIFICATION_RETRY_ENABLED: "true",
  STRIPE_LIVE_ENABLED: "false"
};
const actorUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const jobPostId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const communePostId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const clientRequestId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const orderId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const auth = { accessToken: "synthetic", userId: actorUserId, email: "private@example.invalid", supabase: {} };

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

function getRequest(path, options = {}) {
  return new Request(`${origin}${path}`, {
    headers: options.authorization === false ? {} : { authorization: "Bearer synthetic" }
  });
}

const commercialAssessment = {
  jobPostId,
  classification: "commercial",
  priceCode: "job_post_approved_test_usd",
  waiverId: null,
  subsidyId: null,
  clientRequestId,
  confirmation: "ASSESS JOB POST ECONOMIC CONDITION",
  reason: "Commercial listing fee assessed independently from anti-scam content review."
};
assert(parseOperatorJobPostFeeAssessment(commercialAssessment).priceCode === "job_post_approved_test_usd", "Valid Job Post assessment was rejected.");
const waiverId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
assert(parseOperatorJobPostFeeAssessment({
  ...commercialAssessment,
  classification: "waived",
  priceCode: null,
  waiverId
}).waiverId === waiverId, "Valid private waiver association was rejected.");
for (const invalidBody of [
  { ...commercialAssessment, amountMinor: 500 },
  { ...commercialAssessment, providerPriceId: "price_attacker" },
  { ...commercialAssessment, contentApproved: true },
  { ...commercialAssessment, reviewStatus: "approved" },
  { ...commercialAssessment, actorUserId },
  { ...commercialAssessment, communityRole: "administrator" },
  { ...commercialAssessment, classification: "community_free" },
  { ...commercialAssessment, classification: "waived", priceCode: null, waiverId: null },
  { ...commercialAssessment, classification: "subsidized", priceCode: null, subsidyId: null },
  { ...commercialAssessment, priceCode: "price_external" },
  { ...commercialAssessment, confirmation: "yes" }
]) {
  let rejected = false;
  try { parseOperatorJobPostFeeAssessment(invalidBody); } catch (error) { rejected = error instanceof BillingHttpError; }
  assert(rejected, "Job Post assessment accepted financial, authority, or review fields outside its strict contract.");
}

let assessmentActor = null;
let assessmentInput = null;
const assessmentResponse = await handleOperatorJobPostFeeAssessment(
  postRequest("/api/billing/operator/job-post-fee-assessment", commercialAssessment),
  env,
  {
    authenticate: async () => auth,
    mutate: async (_env, actor, input) => {
      assessmentActor = actor;
      assessmentInput = input;
      return {
        jobPostId,
        classification: "commercial",
        economicStatus: "payment_required",
        publicationStatus: "pending_review",
        published: false,
        idempotentReplay: false
      };
    }
  }
);
assert(assessmentResponse.status === 200 && assessmentActor === actorUserId, "Job Post assessment did not bind the bearer-derived economic operator.");
assert(!("contentApproved" in assessmentInput) && !("reviewStatus" in assessmentInput), "Economic fee assessment carried content-review authority.");
assert((await handleOperatorJobPostFeeAssessment(
  postRequest("/api/billing/operator/job-post-fee-assessment", commercialAssessment, { origin: "https://attacker.example" }),
  env,
  { authenticate: async () => auth, mutate: async () => { throw new Error("must not mutate"); } }
)).status === 403, "Cross-origin Job Post assessment was accepted.");
assert((await handleOperatorJobPostFeeAssessment(
  postRequest("/api/billing/operator/job-post-fee-assessment", commercialAssessment),
  { ...env, BILLING_JOB_POST_FEES_ENABLED: "false" },
  { authenticate: async () => auth, mutate: async () => { throw new Error("must not mutate"); } }
)).status === 503, "Disabled Job Post economics did not fail closed.");

let assessmentRpc = null;
const assessed = await assessOperatorJobPostFee({ rpc: async (name, args) => {
  assessmentRpc = { name, args };
  return { data: {
    jobPostId,
    classification: "commercial",
    economicStatus: "payment_required",
    publicationStatus: "pending_review",
    published: false,
    idempotentReplay: false
  }, error: null };
} }, actorUserId, parseOperatorJobPostFeeAssessment(commercialAssessment));
assert(assessed.economicStatus === "payment_required", "Job Post assessment RPC result was not strictly normalized.");
assert(assessmentRpc.name === "operator_assess_job_post_fee" && assessmentRpc.args.p_actor_user_id === actorUserId, "Job Post assessment RPC actor was not server-derived.");
assert(!Object.keys(assessmentRpc.args).some((key) => /amount|provider|review|approv/i.test(key)), "Job Post assessment RPC could set price amounts, provider identifiers, or content approval.");
let communityAdminDenied = false;
try {
  await assessOperatorJobPostFee(
    { rpc: async () => ({ data: null, error: { code: "42501" } }) },
    actorUserId,
    parseOperatorJobPostFeeAssessment(commercialAssessment)
  );
} catch (error) {
  communityAdminDenied = error instanceof BillingHttpError && error.status === 403;
}
assert(communityAdminDenied, "Community identity without job_fee_assess economic capability was accepted.");

const checkoutBody = {
  jobPostId,
  clientRequestId,
  sourceRoute: "/commune/rooms/job-post",
  consentVersion: "economic-checkout-v1"
};
assert(parseJobPostCheckout(checkoutBody).jobPostId === jobPostId, "Valid Job Post checkout request was rejected.");
for (const invalidBody of [
  { ...checkoutBody, amountMinor: 500 },
  { ...checkoutBody, priceCode: "job_post_approved_test_usd" },
  { ...checkoutBody, providerPriceId: "price_attacker" },
  { ...checkoutBody, contentApproved: true },
  { ...checkoutBody, actorUserId },
  { ...checkoutBody, sourceRoute: "/admin/economic-operations" },
  { ...checkoutBody, consentVersion: "contains spaces" }
]) {
  let rejected = false;
  try { parseJobPostCheckout(invalidBody); } catch (error) { rejected = error instanceof BillingHttpError; }
  assert(rejected, "Job Post checkout accepted client pricing, provider, approval, actor, route, or consent data.");
}

const preparation = {
  jobPostId,
  postId: communePostId,
  orderId,
  publicReference: "opaque_job_order_reference_123456789",
  idempotencyKey: `checkout:${clientRequestId}`,
  amountMinor: 2500,
  currency: "usd",
  providerProductReference: "prod_jobfixture",
  providerPriceReference: "price_jobfixture",
  providerCustomerReference: null
};
let checkoutActor = null;
let providerInput = null;
let attached = 0;
let customerAttached = 0;
const checkoutResponse = await handleJobPostCheckout(
  postRequest("/api/billing/job-post/checkout", checkoutBody),
  env,
  {
    authenticate: async () => auth,
    provider: () => ({
      ensureCustomer: async (input) => {
        assert(input.idempotencyKey === `billing-customer:${actorUserId}`, "Job Post checkout did not use its stable account Customer key.");
        return { providerCustomerReference: "cus_jobfixture" };
      },
      createCheckout: async (input) => {
        providerInput = input;
        return { providerSessionId: "cs_test_job_fixture", providerCustomerReference: null, checkoutUrl: "https://checkout.stripe.com/c/pay/job" };
      }
    }),
    prepare: async (_env, actor) => { checkoutActor = actor; return preparation; },
    attachCustomer: async (_env, exactOrderId, customerReference) => {
      assert(exactOrderId === orderId && customerReference === "cus_jobfixture", "Job Post checkout attached the wrong canonical Customer.");
      customerAttached += 1;
    },
    attach: async () => { attached += 1; },
    fail: async () => undefined
  }
);
const checkoutPayload = await checkoutResponse.json();
assert(checkoutResponse.status === 201 && checkoutActor === actorUserId && customerAttached === 1 && attached === 1, "Owner Job Post checkout did not authenticate, establish its canonical Customer, and attach its hosted session.");
assert(providerInput.flow === "job_post_fee" && providerInput.providerPriceReference === "price_jobfixture", "Job Post checkout did not use its trusted fixed catalog price.");
assert(providerInput.successUrl.startsWith(`${origin}/commune/posts/${communePostId}?job-payment=complete&order=`) && providerInput.cancelUrl.startsWith(`${origin}/commune/posts/${communePostId}?job-payment=canceled&order=`), "Job Post Checkout did not return the owner to the exact private fee panel with an opaque order reference.");
assert(checkoutPayload.postId === communePostId, "Job Post checkout response omitted its exact Commune return target.");
assert(!JSON.stringify(checkoutPayload).includes("2500") && !JSON.stringify(checkoutPayload).includes("price_jobfixture") && !JSON.stringify(checkoutPayload).includes("cs_test"), "Job Post response exposed private pricing or provider identifiers.");
assert((await handleJobPostCheckout(
  postRequest("/api/billing/job-post/checkout", checkoutBody, { authorization: false }),
  env,
  { authenticate: async () => { throw new BillingHttpError(401, "authentication_required"); }, provider: () => ({}), prepare: async () => { throw new Error("must not prepare"); }, attach: async () => undefined, fail: async () => undefined }
)).status === 401, "Anonymous Job Post checkout was accepted.");
assert((await handleJobPostCheckout(
  postRequest("/api/billing/job-post/checkout", checkoutBody),
  { ...env, BILLING_WEBHOOK_FULFILLMENT_ENABLED: "false" },
  { authenticate: async () => auth, provider: () => ({}), prepare: async () => { throw new Error("must not prepare"); }, attach: async () => undefined, fail: async () => undefined }
)).status === 503, "Job Post checkout opened without durable webhook fulfillment.");

let prepareRpc = null;
const prepared = await prepareJobPostCheckout({ rpc: async (name, args) => {
  prepareRpc = { name, args };
  return { data: preparation, error: null };
} }, actorUserId, parseJobPostCheckout(checkoutBody));
assert(prepared.providerPriceReference === "price_jobfixture" && prepareRpc.name === "prepare_job_post_economic_checkout", "Job Post checkout did not use the trusted service preparation RPC.");
assert(prepareRpc.args.p_actor_user_id === actorUserId && !Object.keys(prepareRpc.args).some((key) => /amount|provider|approv|review/i.test(key)), "Job Post checkout preparation accepted client economic or review authority.");

const ownerStatusRow = {
  job_post_id: jobPostId,
  classification: "commercial",
  economic_status: "payment_required",
  content_approved: true,
  publication_status: "approved",
  published: false,
  amount_minor: 2500,
  currency: "usd",
  terms_version: "job-post-fee-bundle-v1",
  test_mode: true
};
let statusRpc = null;
const normalizedStatus = await loadCurrentUserJobPostEconomicStatus({ rpc: async (name, args) => {
  statusRpc = { name, args };
  return { data: ownerStatusRow, error: null };
} }, jobPostId);
assert(normalizedStatus.amountMinor === 2500 && normalizedStatus.contentApproved === true && normalizedStatus.termsVersion === "job-post-fee-bundle-v1", "Owner Job Post status did not normalize its private quote, canonical terms version, and independent content-review facts.");
assert(statusRpc.name === "current_user_job_post_economic_status" && statusRpc.args.p_job_post_id === jobPostId, "Owner Job Post status called the wrong user-scoped RPC.");
const heldStatus = await loadCurrentUserJobPostEconomicStatus({ rpc: async () => ({
  data: { ...ownerStatusRow, economic_status: "reconciliation_required", content_approved: false }, error: null
}) }, jobPostId);
assert(heldStatus.economicStatus === "reconciliation_required" && heldStatus.published === false, "Owner Job Post status rejected the private paid-after-ineligibility reconciliation hold.");
const unassessedStatus = await loadCurrentUserJobPostEconomicStatus({ rpc: async () => ({
  data: {
    ...ownerStatusRow,
    classification: "not_assessed",
    economic_status: "not_assessed",
    content_approved: false,
    amount_minor: null,
    currency: null,
    terms_version: null
  }, error: null
}) }, jobPostId);
assert(unassessedStatus.classification === "not_assessed", "A newly created Job Post's explicit unassessed state was flattened or rejected.");
let unsafeStatusRejected = false;
try {
  await loadCurrentUserJobPostEconomicStatus({ rpc: async () => ({
    data: { ...ownerStatusRow, providerPriceId: "price_secret" }, error: null
  }) }, jobPostId);
} catch (error) {
  unsafeStatusRejected = error instanceof BillingHttpError && error.status === 503;
}
assert(unsafeStatusRejected, "Owner Job Post status accepted a provider identifier outside its exact projection.");

let loadedStatusId = null;
const statusResponse = await handleJobPostStatus(
  getRequest(`/api/billing/job-post/status?jobPostId=${jobPostId}`),
  env,
  {
    authenticate: async () => auth,
    load: async (_auth, requestedJobPostId) => {
      loadedStatusId = requestedJobPostId;
      return normalizedStatus;
    }
  }
);
const statusPayload = await statusResponse.json();
assert(statusResponse.status === 200 && loadedStatusId === jobPostId, "Authenticated Job Post owner could not load the economic quote/status projection.");
assert(statusPayload.status.amountMinor === 2500 && statusPayload.status.termsVersion === "job-post-fee-bundle-v1" && !JSON.stringify(statusPayload).includes("price_"), "Job Post owner status exposed provider data or omitted the server quote/terms version.");
for (const path of [
  "/api/billing/job-post/status",
  "/api/billing/job-post/status?jobPostId=not-a-uuid",
  `/api/billing/job-post/status?jobPostId=${jobPostId}&extra=true`,
  `/api/billing/job-post/status?jobPostId=${jobPostId}&jobPostId=${jobPostId}`
]) {
  const invalidResponse = await handleJobPostStatus(getRequest(path), env, {
    authenticate: async () => auth,
    load: async () => { throw new Error("must not load"); }
  });
  assert(invalidResponse.status === 400, "Job Post status accepted a missing, malformed, duplicate, or extra query parameter.");
}
assert((await handleJobPostStatus(
  getRequest(`/api/billing/job-post/status?jobPostId=${jobPostId}`, { authorization: false }),
  env,
  {
    authenticate: async () => { throw new BillingHttpError(401, "authentication_required"); },
    load: async () => { throw new Error("must not load"); }
  }
)).status === 401, "Anonymous caller could read an owner-only Job Post economic quote.");

const migration = await fs.readFile("supabase/migrations/20260716040000_job_post_economic_sidecar_and_publication_gate.sql", "utf8");
const commune = await fs.readFile("src/pages/The-Elysia-Commune/index.tsx", "utf8");
const assessmentFunction = migration.slice(
  migration.indexOf("create or replace function public.operator_assess_job_post_fee"),
  migration.indexOf("alter function public.operator_assess_job_post_fee")
);
assert(assessmentFunction.includes("payment_does_not_approve_content") && !assessmentFunction.includes("anti_scam_review_status ="), "Job Post economic assessment no longer proves separation from content approval.");
const checkoutFunction = migration.slice(
  migration.indexOf("create or replace function public.prepare_job_post_economic_checkout"),
  migration.indexOf("alter function public.prepare_job_post_economic_checkout")
);
const synchronizationFunction = migration.slice(
  migration.indexOf("create or replace function private.synchronize_job_post_economic_order"),
  migration.indexOf("alter function private.synchronize_job_post_economic_order")
);
assert(
  migration.includes("private.job_post_checkout_is_eligible")
    && checkoutFunction.includes("not private.job_post_checkout_is_eligible(v_condition.id)")
    && migration.includes("private.economic_service_is_restricted(\n        condition.author_user_id, 'job_posting'")
    && migration.includes("job.anti_scam_review_status = 'reviewed_clear'"),
  "The authoritative Job Post checkout boundary does not independently recheck review eligibility and scoped restrictions."
);
assert(
  migration.includes("create table private.job_post_payment_holds")
    && migration.includes("alter table private.job_post_payment_holds enable row level security")
    && migration.includes("revoke all privileges on table private.job_post_payment_holds")
    && synchronizationFunction.includes("job_post_payment_quarantined")
    && synchronizationFunction.includes("job_post_payment_hold_resolved_by_full_refund")
    && synchronizationFunction.includes("new.status = 'refunded'")
    && synchronizationFunction.includes("condition_status = 'reconciliation_required'")
    && synchronizationFunction.includes("'publication_granted', false"),
  "A delayed Job Post payment can bypass private quarantine, full-refund resolution, or the no-publication boundary."
);
assert(
  commune.includes('returnOrder?.flow === "job_post_fee"')
    && commune.includes("It is not being labeled as this Job Post fee")
    && commune.includes("The private server order flow could not be verified")
    && !commune.includes("Stripe test checkout returned to this exact Job Post."),
  "Job Post return presentation did not require the canonical Job Post fee order flow before labeling the returned order."
);

console.log("Billing Job Post economic boundary smoke test ok.");
