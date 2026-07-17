import fs from "node:fs/promises";
import { BillingHttpError } from "../functions/api/billing/_shared/http.ts";
import {
  exportOperatorEconomicAccounting,
  loadCurrentEconomicClosureReadiness,
  loadPublicSupportRecognition,
  requestCurrentUserEconomicAccountAction,
  setCurrentUserSupportRecognition,
  setOperatorEconomicServiceRestriction,
  updateOperatorEconomicAccountAction
} from "../functions/api/billing/_shared/database.ts";
import {
  parseEconomicAccountAction,
  parseOperatorAccountingExport,
  parseOperatorEconomicAccountAction,
  parseOperatorEconomicServiceRestriction,
  parseSupportRecognitionPreference
} from "../functions/api/billing/_shared/schema.ts";
import { handleEconomicAccountAction } from "../functions/api/billing/account/action.ts";
import { handleEconomicClosureReadiness } from "../functions/api/billing/account/closure-readiness.ts";
import { handleSupportRecognitionPreference } from "../functions/api/billing/account/support-recognition.ts";
import { handleOperatorAccountingExport } from "../functions/api/billing/operator/accounting-export.ts";
import { handleOperatorEconomicAccountAction } from "../functions/api/billing/operator/account-action.ts";
import { handleOperatorEconomicServiceRestriction } from "../functions/api/billing/operator/service-restriction.ts";
import { handlePublicSupportRecognition } from "../functions/api/billing/support-recognition.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const origin = "https://elysiaecobotics.com";
const publicUsername = "watershed_friend";
const env = {
  BILLING_ENABLED: "true",
  BILLING_MODE: "test",
  BILLING_PUBLIC_ORIGIN: origin,
  BILLING_STAGING_ACCESS_CONFIRMED: "true",
  BILLING_EDGE_RATE_LIMIT_CONFIRMED: "true",
  BILLING_SUPPORT_RECOGNITION_ENABLED: "true",
  BILLING_ACCOUNT_LIFECYCLE_ENABLED: "true",
  BILLING_ACCOUNTING_EXPORT_ENABLED: "true",
  STRIPE_LIVE_ENABLED: "false"
};
const projection = {
  enabled: true,
  supporters: [{
    username: publicUsername,
    displayName: "Watershed Friend",
    grantsAuthority: false,
    amountPublic: false
  }],
  ranked: false,
  amountsPublic: false,
  paymentGrantsAuthority: false
};

const normalized = await loadPublicSupportRecognition({
  rpc: async () => ({ data: projection, error: null })
});
assert(normalized.supporters.length === 1 && normalized.ranked === false, "Public support recognition did not preserve its unranked boundary.");
assert(!JSON.stringify(normalized).includes("profileId"), "Public support recognition exposed an auth-linked profile UUID.");
for (const unsafe of [
  { ...projection, amountsPublic: true },
  { ...projection, ranked: true },
  { ...projection, supporters: [{ ...projection.supporters[0], amountMinor: 500 }] },
  { ...projection, supporters: [{ ...projection.supporters[0], grantsAuthority: true }] }
]) {
  let rejected = false;
  try { await loadPublicSupportRecognition({ rpc: async () => ({ data: unsafe, error: null }) }); }
  catch (error) { rejected = error instanceof BillingHttpError; }
  assert(rejected, "Public support recognition accepted amount, ranking, authority, or an extra private field.");
}

const response = await handlePublicSupportRecognition(
  new Request(`${origin}/api/billing/support-recognition`),
  env,
  { load: async () => normalized }
);
const payload = await response.json();
assert(response.status === 200 && payload.recognition.paymentGrantsAuthority === false, "Public support recognition route changed the no-authority boundary.");
assert(!JSON.stringify(payload).includes("amountMinor"), "Public support recognition exposed a support amount.");
let disabledLoads = 0;
const disabled = await handlePublicSupportRecognition(
  new Request(`${origin}/api/billing/support-recognition`),
  { ...env, BILLING_SUPPORT_RECOGNITION_ENABLED: "false" },
  { load: async () => { disabledLoads += 1; return normalized; } }
);
const disabledPayload = await disabled.json();
assert(disabled.status === 200 && disabledLoads === 0 && disabledPayload.recognition.supporters.length === 0, "Disabled public recognition queried or exposed supporter records.");
assert((await handlePublicSupportRecognition(
  new Request(`${origin}/api/billing/support-recognition`, { method: "POST" }), env,
  { load: async () => normalized }
)).status === 405, "Public recognition accepted a mutation method.");

let recognitionLoadsWithAcquisitionOff = 0;
const recognitionWithAcquisitionOff = await handlePublicSupportRecognition(
  new Request(`${origin}/api/billing/support-recognition`),
  { ...env, BILLING_ENABLED: "false" },
  { load: async () => { recognitionLoadsWithAcquisitionOff += 1; return normalized; } }
);
assert(recognitionWithAcquisitionOff.status === 200 && recognitionLoadsWithAcquisitionOff === 1, "Acquisition kill switch erased an existing public recognition projection.");
assert((await handlePublicSupportRecognition(
  new Request(`${origin}/api/billing/support-recognition`),
  { ...env, BILLING_PUBLIC_ORIGIN: undefined },
  { load: async () => normalized }
)).status === 200, "Read-only public recognition incorrectly required a redirect origin.");

const actorUserId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const requestId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const clientRequestId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const auth = { accessToken: "synthetic", userId: actorUserId, email: null, supabase: {} };
function post(path, body, currentEnv = env) {
  return {
    request: new Request(`${origin}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin, authorization: "Bearer synthetic" },
      body: JSON.stringify(body)
    }),
    env: currentEnv
  };
}
const closureReadiness = {
  canComplete: true,
  blockingCount: 0,
  activeSubscriptions: 0,
  scheduledSubscriptionCancellations: 1,
  unsettledOrders: 0,
  openRefunds: 0,
  openDisputes: 0,
  openReconciliationCases: 0,
  pendingSellerPayouts: 0,
  sellerPayableObligations: 0,
  pendingMarketplaceFulfillment: 0,
  pendingJobPostFulfillment: 0,
  organizationSignerDuties: 0,
  sponsorshipSignerDuties: 0,
  preservesEarnedLicenses: true,
  preservesRemainingSandboxCredits: true,
  financialRecordsRetained: true,
  authProfileUnchanged: true,
  guidance: [
    "Cancel recurring support through the Customer Portal before closure.",
    "Resolve open refunds, disputes, reconciliation, fulfillment, signer, and seller obligations.",
    "Already-earned licenses, remaining credits, receipts, and financial history are retained."
  ]
};

const recognitionInput = {
  clientRequestId,
  optedIn: false,
  consentVersion: "2026-07-16",
  confirmation: "REMOVE SUPPORT RECOGNITION"
};
assert(parseSupportRecognitionPreference(recognitionInput).optedIn === false, "Recognition opt-out schema was rejected.");
for (const invalid of [
  { ...recognitionInput, amountMinor: 500 },
  { ...recognitionInput, optedIn: "false" },
  { ...recognitionInput, confirmation: "PUBLISH SUPPORT RECOGNITION" }
]) {
  let rejected = false;
  try { parseSupportRecognitionPreference(invalid); } catch (error) { rejected = error instanceof BillingHttpError; }
  assert(rejected, "Recognition preference accepted financial fields, a non-boolean preference, or mismatched confirmation.");
}
let recognitionActor = null;
const recognitionMutation = post("/api/billing/account/support-recognition", recognitionInput, {
  ...env,
  BILLING_ENABLED: "false",
  BILLING_SUPPORT_RECOGNITION_ENABLED: "false"
});
const recognitionMutationResponse = await handleSupportRecognitionPreference(
  recognitionMutation.request,
  recognitionMutation.env,
  {
    authenticate: async () => auth,
    mutate: async (authenticated, input) => {
      recognitionActor = authenticated.userId;
      return {
        optedIn: input.optedIn, eligible: true, eligibilityExpiresAt: null,
        publicDisplayEnabled: false, amountsPublic: false, grantsAuthority: false,
        idempotentReplay: false
      };
    }
  }
);
assert(recognitionMutationResponse.status === 200 && recognitionActor === actorUserId, "Recognition opt-out depended on acquisition/public-display flags or lost its authenticated owner.");

const accountActionInput = {
  clientRequestId,
  requestType: "economic_account_closure",
  consentVersion: "2026-07-16",
  userNote: "Please close only my economic acquisition capability.",
  acknowledgeFinancialRecordsRetained: true,
  acknowledgeAuthProfileUnchanged: true,
  confirmation: "REQUEST ECONOMIC ACCOUNT CLOSURE"
};
assert(parseEconomicAccountAction(accountActionInput).requestType === "economic_account_closure", "Economic-only closure request schema was rejected.");
for (const invalid of [
  { ...accountActionInput, deleteAuthUser: true },
  { ...accountActionInput, acknowledgeFinancialRecordsRetained: false },
  { ...accountActionInput, confirmation: "DELETE MY ACCOUNT" }
]) {
  let rejected = false;
  try { parseEconomicAccountAction(invalid); } catch (error) { rejected = error instanceof BillingHttpError; }
  assert(rejected, "Economic closure request accepted Auth deletion, missing retention consent, or destructive confirmation drift.");
}
const accountActionMutation = post("/api/billing/account/action", accountActionInput, { ...env, BILLING_ENABLED: "false" });
let accountActionActor = null;
const accountActionResponse = await handleEconomicAccountAction(accountActionMutation.request, accountActionMutation.env, {
  authenticate: async () => auth,
  mutate: async (_env, actor, input) => {
    accountActionActor = actor;
    return {
      requestId, requestType: input.requestType, status: "submitted",
      providerCancellationRequired: false, closureReadiness,
      financialRecordsRetained: true, authProfileUnchanged: true, idempotentReplay: false
    };
  }
});
assert(accountActionResponse.status === 202 && accountActionActor === actorUserId, "Narrow lifecycle request lost its verified actor or was coupled to acquisition checkout.");
let disabledAccountAuthentications = 0;
let disabledAccountMutations = 0;
const disabledAccountActionResponse = await handleEconomicAccountAction(
  accountActionMutation.request,
  { ...accountActionMutation.env, BILLING_ACCOUNT_LIFECYCLE_ENABLED: "false" },
  {
    authenticate: async () => { disabledAccountAuthentications += 1; return auth; },
    mutate: async () => {
      disabledAccountMutations += 1;
      throw new Error("must not mutate");
    }
  }
);
assert(
  disabledAccountActionResponse.status === 503
    && disabledAccountAuthentications === 0
    && disabledAccountMutations === 0,
  "Disabled economic account lifecycle reached authentication or its service-role mutation boundary."
);
const closureResponse = await handleEconomicClosureReadiness(
  new Request(`${origin}/api/billing/account/closure-readiness`, { headers: { authorization: "Bearer synthetic" } }),
  { ...env, BILLING_ENABLED: "false" },
  { authenticate: async () => auth, load: async () => closureReadiness }
);
const closurePayload = await closureResponse.json();
assert(
  closureResponse.status === 200
    && closurePayload.closureReadiness.canComplete === true
    && closurePayload.closureReadiness.scheduledSubscriptionCancellations === 1
    && closurePayload.closureReadiness.authProfileUnchanged === true,
  "Closure readiness lost its nonblocking scheduled-cancellation or Auth/Profile preservation boundary."
);

const operatorActionInput = {
  requestId,
  status: "operator_review",
  clientRequestId,
  artifactSha256: null,
  artifactExpiresAt: null,
  confirmation: "UPDATE ECONOMIC ACCOUNT REQUEST",
  reason: "Identity review remains separate from general Commons account state."
};
assert(parseOperatorEconomicAccountAction(operatorActionInput).status === "operator_review", "Operator account-action schema was rejected.");
let operatorActionActor = null;
const operatorActionMutation = post("/api/billing/operator/account-action", operatorActionInput, { ...env, BILLING_ENABLED: "false" });
assert((await handleOperatorEconomicAccountAction(operatorActionMutation.request, operatorActionMutation.env, {
  authenticate: async () => auth,
  mutate: async (_env, actor, input) => {
    operatorActionActor = actor;
    return {
      requestId: input.requestId, requestType: "economic_account_closure", status: input.status,
      financialRecordsRetained: true, authProfileUnchanged: true, idempotentReplay: false
    };
  }
})).status === 200 && operatorActionActor === actorUserId, "Operator lifecycle route did not derive its actor or survive checkout disablement.");

const restrictionInput = {
  clientRequestId,
  targetUserId: actorUserId,
  restrictionId: null,
  scope: "billing",
  reasonCode: "economic_account_closed",
  expiresAt: null,
  enabled: true,
  confirmation: "IMPOSE SCOPED ECONOMIC RESTRICTION",
  reason: "Restrict only new economic acquisition after reviewed economic closure."
};
assert(parseOperatorEconomicServiceRestriction(restrictionInput).scope === "billing", "Scoped restriction schema was rejected.");
for (const invalid of [
  { ...restrictionInput, scope: "commons" },
  { ...restrictionInput, communityBan: true },
  { ...restrictionInput, restrictionId: requestId }
]) {
  let rejected = false;
  try { parseOperatorEconomicServiceRestriction(invalid); } catch (error) { rejected = error instanceof BillingHttpError; }
  assert(rejected, "Economic restriction accepted a Commons ban, forged field, or invalid impose identifier.");
}
const restrictionMutation = post("/api/billing/operator/service-restriction", restrictionInput, { ...env, BILLING_ENABLED: "false" });
const restrictionResponse = await handleOperatorEconomicServiceRestriction(restrictionMutation.request, restrictionMutation.env, {
  authenticate: async () => auth,
  mutate: async (_env, _actor, input) => ({
    restrictionId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    userId: input.targetUserId, scope: input.scope, active: true,
    commonsAccountAffected: false, idempotentReplay: false
  })
});
assert(restrictionResponse.status === 200 && !(JSON.stringify(await restrictionResponse.json())).includes("communityBan"), "Scoped restriction route broadened into Commons authority.");

const accountingInput = {
  clientRequestId,
  from: "2026-07-01T00:00:00.000Z",
  to: "2026-07-16T00:00:00.000Z",
  afterCreatedAt: null,
  afterId: null,
  limit: 50,
  confirmation: "EXPORT PRIVATE ECONOMIC ACCOUNTING"
};
assert(parseOperatorAccountingExport(accountingInput).limit === 50, "Bounded accounting export schema was rejected.");
const accountingMutation = post("/api/billing/operator/accounting-export", accountingInput, { ...env, BILLING_ENABLED: "false" });
const accountingResponse = await handleOperatorAccountingExport(accountingMutation.request, accountingMutation.env, {
  authenticate: async () => auth,
  load: async () => ({
    exportVersion: "economic-accounting-v1", entries: [], limit: 50,
    from: accountingInput.from, to: accountingInput.to,
    providerIdentifiersExposed: false, personalContactDataExposed: false,
    testMode: true, idempotentReplay: false
  })
});
assert(accountingResponse.status === 200, "Accounting export depended on new-acquisition availability.");

let rpcCall = null;
const rpc = async (name, args) => {
  rpcCall = { name, args };
  if (name === "set_current_user_support_recognition") return { data: {
    optedIn: false, eligible: true, eligibilityExpiresAt: null, publicDisplayEnabled: false,
    amountsPublic: false, grantsAuthority: false, idempotentReplay: false
  }, error: null };
  if (name === "current_user_economic_closure_readiness") return { data: closureReadiness, error: null };
  if (name === "request_economic_account_action") return { data: {
    requestId, requestType: "economic_account_closure", status: "submitted",
    providerCancellationRequired: false, closureReadiness,
    financialRecordsRetained: true, authProfileUnchanged: true, idempotentReplay: false
  }, error: null };
  if (name === "operator_update_economic_account_action") return { data: {
    requestId, requestType: "economic_account_closure", status: "operator_review",
    financialRecordsRetained: true, authProfileUnchanged: true, idempotentReplay: false
  }, error: null };
  if (name === "operator_set_economic_service_restriction") return { data: {
    restrictionId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", userId: actorUserId,
    scope: "billing", active: true, commonsAccountAffected: false, idempotentReplay: false
  }, error: null };
  if (name === "export_economic_accounting_events") return { data: {
    exportVersion: "economic-accounting-v1", entries: [{
      exportVersion: "economic-accounting-v1", eventId: clientRequestId,
      effectiveAt: "2026-07-10T00:00:00.000Z", recordedAt: "2026-07-10T00:00:01.000Z",
      category: "payment_received", economicFlow: "support_one_time", direction: "inflow",
      grossMinor: 500, refundMinor: null, disputeMinor: null, processorFeeMinor: 45,
      platformCommissionMinor: null, sellerPayableMinor: null, netMinor: 455,
      currency: "usd", internalOrderReference: "1234567890abcdef1234567890abcdef1234567890abcdef",
      provider: "stripe", providerEventDate: "2026-07-10T00:00:00.000Z", jurisdiction: null,
      taxTreatmentPendingReview: true, reconciliationStatus: "recorded"
    }, {
      exportVersion: "economic-accounting-v1", eventId: "abababab-abab-4bab-8bab-abababababab",
      effectiveAt: "2026-07-10T00:05:00.000Z", recordedAt: "2026-07-10T00:05:01.000Z",
      category: "payment_received", economicFlow: "support_one_time", direction: "inflow",
      grossMinor: 700, refundMinor: null, disputeMinor: null, processorFeeMinor: null,
      platformCommissionMinor: null, sellerPayableMinor: null, netMinor: null,
      currency: "usd", internalOrderReference: "abcdef1234567890abcdef1234567890abcdef1234567890",
      provider: "stripe", providerEventDate: "2026-07-10T00:05:00.000Z", jurisdiction: null,
      taxTreatmentPendingReview: true, reconciliationStatus: "settlement_details_pending"
    }], limit: 50,
    from: accountingInput.from, to: accountingInput.to,
    providerIdentifiersExposed: false, personalContactDataExposed: false,
    testMode: true, idempotentReplay: false
  }, error: null };
  throw new Error(`Unexpected lifecycle RPC ${name}`);
};
const mockSupabase = { rpc };
await setCurrentUserSupportRecognition(mockSupabase, parseSupportRecognitionPreference(recognitionInput));
assert(rpcCall.name === "set_current_user_support_recognition" && !("p_actor_user_id" in rpcCall.args), "Owner recognition RPC accepted a forged actor parameter.");
await loadCurrentEconomicClosureReadiness(mockSupabase);
await requestCurrentUserEconomicAccountAction(mockSupabase, actorUserId, parseEconomicAccountAction(accountActionInput));
assert(rpcCall.name === "request_economic_account_action" && rpcCall.args.p_actor_user_id === actorUserId, "Worker-only lifecycle RPC lost its verified actor parameter.");
await updateOperatorEconomicAccountAction(mockSupabase, actorUserId, parseOperatorEconomicAccountAction(operatorActionInput));
assert(rpcCall.args.p_actor_user_id === actorUserId, "Operator account-action RPC lost its server-derived actor.");
await setOperatorEconomicServiceRestriction(mockSupabase, actorUserId, parseOperatorEconomicServiceRestriction(restrictionInput));
assert(rpcCall.args.p_scope === "billing" && rpcCall.args.p_actor_user_id === actorUserId, "Scoped restriction RPC widened or lost its actor.");
const accountingExport = await exportOperatorEconomicAccounting(mockSupabase, actorUserId, parseOperatorAccountingExport(accountingInput));
assert(rpcCall.name === "export_economic_accounting_events" && rpcCall.args.p_limit === 50, "Accounting export RPC lost its bounded frozen signature.");
assert(accountingExport.entries[0]?.economicFlow === "support_one_time", "Accounting export flattened the economic flow needed to separate revenue categories.");
assert(accountingExport.entries[1]?.reconciliationStatus === "settlement_details_pending", "Accounting export rejected an honest verified-gross settlement whose processor fee and net are not yet recorded.");

const [accountActionRouteSource, supportRecognitionRouteSource] = await Promise.all([
  fs.readFile("functions/api/billing/account/action.ts", "utf8"),
  fs.readFile("functions/api/billing/support-recognition.ts", "utf8")
]);
assert(
  accountActionRouteSource.includes("createEconomicServerClient(env)")
    && accountActionRouteSource.includes("auth.userId")
    && !accountActionRouteSource.includes("requestCurrentUserEconomicAccountAction(auth.supabase"),
  "Economic account mutation can bypass the Worker kill switch through the browser-scoped Supabase client."
);
assert(
  supportRecognitionRouteSource.includes("createEconomicServerClient(env)")
    && !supportRecognitionRouteSource.includes("createEconomicPublicClient"),
  "Public support recognition can bypass its environment gate through direct browser-role RPC execution."
);

console.log("Billing lifecycle and public recognition smoke test ok.");
