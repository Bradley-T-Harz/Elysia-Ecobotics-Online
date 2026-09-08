import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { Link } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import {
  assessEconomicOperatorJobPostFee,
  billingErrorMessage,
  configureEconomicOperatorMarketplaceTerms,
  configureEconomicOperatorAssistanceProgram,
  createBillingClientRequestId,
  economicOperatorCapabilityKeys,
  endEconomicOperatorAssistanceGrant,
  executeEconomicOperatorTestRefund,
  exportEconomicOperatorAccounting,
  grantEconomicOperatorSandboxCredits,
  isBillingUuid,
  issueEconomicOperatorAssistanceGrant,
  loadEconomicOperatorAudit,
  loadEconomicOperatorOverview,
  openEconomicOperatorReconciliationCase,
  operatorAssistanceProgramStatusConfirmations,
  placeEconomicOperatorRefundHold,
  prepareEconomicOperatorMarketplaceTestPayout,
  reconcileEconomicOperatorJobPostAssistanceGrant,
  setEconomicOperatorAssignment,
  setEconomicOperatorAssistanceProgramStatus,
  setEconomicOperatorServiceRestriction,
  updateEconomicOperatorAccountAction,
  type EconomicServiceRestrictionScope,
  type EconomicOperatorCapability,
  type EconomicOperatorOverview,
  type EconomicOperatorRefundablePaymentQueueItem,
  type EconomicAssistanceKind,
  type EconomicAssistanceProgramTargetStatus,
  type EconomicAssistanceScope,
  type EconomicAuditCursor,
  type EconomicAuditEvent,
  type OperatorEconomicAccountActionStatus,
  type OperatorJobPostClassification,
  type OperatorSandboxCreditSource
} from "../../shared/billing/billingClient";
import { useAuth } from "../../shared/auth/useAuth";
import EconomicOrganizationSponsorshipOperations from "./EconomicOrganizationSponsorshipOperations";
import EconomicOperationsNavigation from "./EconomicOperationsNavigation";

const capabilityDescriptions: Record<EconomicOperatorCapability, string> = {
  economic_orders_view: "View normalized private order summaries.",
  economic_payments_view: "View normalized payment state without raw payment credentials.",
  economic_operator_assignments_manage: "Assign or revoke narrow economic capabilities through separately audited server operations.",
  economic_refunds_manage: "Manage bounded refund workflows with audit.",
  economic_reconciliation_manage: "Reconcile verified provider events and internal state.",
  recurring_support_manage: "Assist with recurring support without changing community standing.",
  sandbox_credits_adjust: "Create audited compensating sandbox ledger entries.",
  job_fee_assess: "Assess fee, free, or waived economic conditions without approving content.",
  marketplace_payout_manage: "Reconcile seller payables without approving listings or publishers.",
  organization_billing_manage: "Manage private organization-service records without changing Commons identity or public profile affiliation.",
  sponsorship_manage: "Manage private agreements and public-safe disclosures.",
  economic_assistance_manage: "Manage private waiver, subsidy, and sponsored-access programs without creating public status.",
  economic_account_requests_manage: "Review bounded account economic requests without gaining governance or profile authority.",
  economic_feature_flags_manage: "Authorize separately audited server-side economic feature-flag changes; this browser exposes no flag toggle.",
  economic_audit_view: "View immutable economic audit records.",
  accounting_export: "Prepare bounded accounting exports."
};

const sandboxSources: ReadonlyArray<{ value: OperatorSandboxCreditSource; label: string }> = [
  { value: "starter", label: "Starter access" },
  { value: "sponsored", label: "Sponsored access" },
  { value: "waiver", label: "Approved waiver" },
  { value: "waived", label: "Waived service condition" },
  { value: "operational", label: "Operational correction" },
  { value: "operator", label: "Operator grant" },
  { value: "test", label: "Test verification" }
];

function validReason(value: string) {
  const trimmed = value.trim();
  return trimmed.length >= 8 && trimmed.length <= 1_000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(trimmed);
}

function validWholeNumber(value: string) {
  if (!/^\d+$/.test(value)) return false;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 1 && number <= 1_000_000_000;
}

function clearFeedback(setError: (value: string) => void, setStatus: (value: string) => void) {
  setError("");
  setStatus("");
}

function focusError(errorRef: RefObject<HTMLDivElement | null>) {
  requestAnimationFrame(() => errorRef.current?.focus());
}

function OperationFeedback({ error, status, errorRef }: { error: string; status: string; errorRef: RefObject<HTMLDivElement | null> }) {
  return <>
    {error && <div className="validation validation--bad" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
    <p className="inline-status operator-live-region" role="status" aria-live="polite" aria-atomic="true">{status}</p>
  </>;
}

function operatorMoney(amountMinor: number, currency: string) {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amountMinor / 100); }
  catch { return `${amountMinor} ${currency.toUpperCase()} minor units`; }
}

function operatorWhen(value: string | null) {
  if (!value) return "No expiration";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Date unavailable" : parsed.toLocaleString();
}

function QueueCard({ title, count, empty, children, boundary }: { title: string; count: number; empty: string; children: ReactNode; boundary?: ReactNode }) {
  return <article className="economic-summary-card"><strong>{title} · {count}</strong>{count ? children : <p>{empty}</p>}{boundary && <p className="boundary-note">{boundary}</p>}</article>;
}

function OperatorQueueOverview({ overview }: { overview: EconomicOperatorOverview }) {
  const hasQueue = overview.orderQueue !== null || overview.paymentQueue !== null || overview.refundablePaymentQueue !== null || overview.refundQueue !== null || overview.subscriptionQueue !== null || overview.disputeQueue !== null || overview.webhookQueue !== null || overview.reconciliationQueue !== null || overview.sandboxCorrectionQueue !== null || overview.jobPostEconomicQueue !== null || overview.sellerPayableQueue !== null || overview.sellerPayoutPreparationQueue !== null || overview.organizationServiceQueue !== null || overview.sponsorshipQueue !== null || overview.accountRequestQueue !== null || overview.assistanceProgramQueue !== null || overview.assistanceQueue !== null || overview.featureFlags !== null;
  if (!hasQueue) return null;
  return <section className="section-card" aria-live="polite">
    <p className="eyebrow">Capability-filtered private reporting</p>
    <h2>Bounded economic queues</h2>
    <p>Operational queues contain at most {overview.queueLimit} restricted test-mode summaries and appear only with their matching capability. The feature-flag card is instead the complete reviewed kill-switch inventory. Provider identifiers, payment credentials, private resolution notes, personal contact data, and raw financial evidence are omitted. An empty bounded operational queue is never proof that no older record exists.</p>
    <div className="economic-capability-grid">
      {overview.orderQueue !== null && <QueueCard title="Recent orders" count={overview.orderQueue.length} empty="No order summary is in this bounded page.">{overview.orderQueue.map((item) => <div key={item.orderId}><p><strong>{operatorMoney(item.amountMinor, item.currency)}</strong> · {item.flow.replace(/_/g, " ")} · {item.status.replace(/_/g, " ")}</p><p className="small-note">Public reference {item.publicReference} · internal order <code>{item.orderId}</code> · {operatorWhen(item.createdAt)}</p></div>)}</QueueCard>}
      {overview.paymentQueue !== null && <QueueCard title="Payment accounting" count={overview.paymentQueue.length} empty="No payment accounting summary is in this bounded page." boundary="These are Elysia accounting summaries, not raw Stripe objects. Provider customer, charge, payment-intent, payment-method, subscription, event, and bank identifiers remain excluded.">{overview.paymentQueue.map((item) => <div key={item.paymentTransactionId}><p><strong>{operatorMoney(item.grossAmountMinor, item.currency)}</strong> · {item.flow.replace(/_/g, " ")} · {item.status.replace(/_/g, " ")}</p><p>Processor fee: {item.processorFeeMinor === null ? "not projected" : operatorMoney(item.processorFeeMinor, item.currency)} · net: {item.netAmountMinor === null ? "not projected" : operatorMoney(item.netAmountMinor, item.currency)}</p><p className="small-note">Public reference {item.publicReference} · transaction <code>{item.paymentTransactionId}</code> · order <code>{item.orderId}</code> · {operatorWhen(item.occurredAt)}</p></div>)}</QueueCard>}
      {overview.refundablePaymentQueue !== null && <QueueCard title="Refundable payment transactions" count={overview.refundablePaymentQueue.length} empty="No payment transaction has a positive refundable balance in this bounded page." boundary="This is the only browser source for starting a refund hold. It contains Elysia internal references, never Stripe payment-intent, charge, customer, subscription, or payment-method identifiers.">{overview.refundablePaymentQueue.map((item) => <div key={item.paymentTransactionId}><p><strong>{operatorMoney(item.refundableAmountMinor, item.currency)} refundable</strong> of {operatorMoney(item.grossAmountMinor, item.currency)} · {item.flow.replace(/_/g, " ")} · {item.status}</p><p className="small-note">Public reference {item.publicReference} · transaction <code>{item.paymentTransactionId}</code> · order <code>{item.orderId}</code> · {operatorWhen(item.occurredAt)}</p></div>)}</QueueCard>}
      {overview.refundQueue !== null && <QueueCard title="Open refund review" count={overview.refundQueue.length} empty="No open refund review is in this bounded page.">{overview.refundQueue.map((item) => <div key={item.requestId}><p><strong>{operatorMoney(item.amountMinor, item.currency)}</strong> · {item.status.replace(/_/g, " ")}</p><p className="small-note">Refund request <code>{item.requestId}</code> · transaction <code>{item.paymentTransactionId}</code> · order <code>{item.orderId}</code> · {operatorWhen(item.createdAt)}</p></div>)}</QueueCard>}
      {overview.subscriptionQueue !== null && <QueueCard title="Recurring-support attention" count={overview.subscriptionQueue.length} empty="No recurring-support summary is in this bounded page." boundary="A subscription condition affects only optional recurring support. It cannot change a Commons Account, profile, badge, role, trust, or ordinary free participation.">{overview.subscriptionQueue.map((item) => <div key={item.subscriptionId}><p><strong>{item.status.replace(/_/g, " ")}</strong>{item.cancelAtPeriodEnd ? " · cancellation scheduled" : ""}</p><p>Current period ends: {operatorWhen(item.currentPeriodEnd)}</p><p className="small-note">Subscription <code>{item.subscriptionId}</code> · Website Account <code>{item.userId}</code>{item.originatingOrderId ? <> · order <code>{item.originatingOrderId}</code></> : ""} · updated {operatorWhen(item.updatedAt)}</p></div>)}</QueueCard>}
      {overview.disputeQueue !== null && <QueueCard title="Dispute attention" count={overview.disputeQueue.length} empty="No dispute summary is in this bounded page." boundary="Reason codes are bounded categories, not raw provider evidence. Disputes cannot become general community bans or trust judgments.">{overview.disputeQueue.map((item) => <div key={item.disputeId}><p><strong>{operatorMoney(item.amountMinor, item.currency)}</strong> · {item.status.replace(/_/g, " ")}</p><p>Reason code: {item.reasonCode?.replace(/_/g, " ") ?? "not projected"}</p><p className="small-note">Dispute <code>{item.disputeId}</code> · transaction <code>{item.paymentTransactionId}</code> · order <code>{item.orderId}</code> · updated {operatorWhen(item.updatedAt)}</p></div>)}</QueueCard>}
      {overview.webhookQueue !== null && <QueueCard title="Webhook processing attention" count={overview.webhookQueue.length} empty="No failed, unmatched, or newly received webhook summary is in this bounded page." boundary="Event IDs are Elysia internal UUIDs. Provider event references, payloads, signatures, customer data, and secrets are not exposed.">{overview.webhookQueue.map((item) => <div key={item.eventId}><p><strong>{item.eventType.replace(/_/g, " ")}</strong> · {item.processingStatus.replace(/_/g, " ")} · {item.processingAttempts} attempt{item.processingAttempts === 1 ? "" : "s"}</p><p className="small-note">Internal event <code>{item.eventId}</code> · provider-created {operatorWhen(item.eventCreatedAt)} · received {operatorWhen(item.receivedAt)}</p></div>)}</QueueCard>}
      {overview.reconciliationQueue !== null && <QueueCard title="Open reconciliation" count={overview.reconciliationQueue.length} empty="No open reconciliation case is in this bounded page.">{overview.reconciliationQueue.map((item) => <div key={item.caseId}><p><strong>{item.caseKind.replace(/_/g, " ")}</strong> · {item.status.replace(/_/g, " ")} · opened {operatorWhen(item.openedAt)}</p><p className="small-note">Case <code>{item.caseId}</code> · order <code>{item.orderId}</code></p></div>)}</QueueCard>}
      {overview.sandboxCorrectionQueue !== null && <QueueCard title="Sandbox-credit correction shortfalls" count={overview.sandboxCorrectionQueue.length} empty="No unresolved sandbox-credit correction shortfall is in this bounded page." boundary="One-time pack and recurring-support-payment shortfalls share this bounded correction queue. Sandbox units are service accounting—not money, recognition credits, safety privileges, network access, reviewer status, or authority.">{overview.sandboxCorrectionQueue.map((item) => <div key={item.shortfallId}><p><strong>{item.missingUnits.toLocaleString()} units missing</strong> of {item.targetUnits.toLocaleString()} · {item.adjustmentKind.replace(/_/g, " ")} · {item.status}</p><p>{item.fulfillmentScope === "recurring_support_payment" ? "Recurring-support payment credit fulfillment" : "One-time sandbox pack fulfillment"}</p><p className="small-note">Shortfall <code>{item.shortfallId}</code> · fulfillment <code>{item.fulfillmentId}</code> · order <code>{item.orderId}</code>{item.paymentTransactionId ? <> · payment transaction <code>{item.paymentTransactionId}</code></> : ""} · {operatorWhen(item.createdAt)}</p></div>)}</QueueCard>}
      {overview.jobPostEconomicQueue !== null && <QueueCard title="Job Post economic conditions" count={overview.jobPostEconomicQueue.length} empty="No assessable Job Post condition is in this bounded page." boundary="Economic assessment cannot approve content, bypass anti-scam review, publish a post, or grant employer trust.">{overview.jobPostEconomicQueue.map((item) => <div key={item.conditionId}><p><strong>{item.classification.replace(/_/g, " ")}</strong> · {item.status.replace(/_/g, " ")}</p><p>Terms: {item.termsVersion ?? "not bound"}</p><p className="small-note">Condition <code>{item.conditionId}</code> · Job Post <code>{item.jobPostId}</code> · author <code>{item.authorUserId}</code>{item.orderId ? <> · order <code>{item.orderId}</code></> : ""} · {operatorWhen(item.updatedAt)}</p></div>)}</QueueCard>}
      {overview.sellerPayableQueue !== null && <QueueCard title="Marketplace seller payables" count={overview.sellerPayableQueue.length} empty="No positive seller payable is in this bounded page." boundary="These are private test accounting balances, not live funds, provider balances, payout promises, public seller income, or review authority.">{overview.sellerPayableQueue.map((item) => <div key={`${item.sellerAccountId}:${item.currency}`}><p><strong>{operatorMoney(item.availablePayableMinor, item.currency)}</strong> available test payable · seller {item.sellerStatus.replace(/_/g, " ")}</p><p className="small-note">Seller account <code>{item.sellerAccountId}</code></p></div>)}</QueueCard>}
      {overview.sellerPayoutPreparationQueue !== null && <QueueCard title="Marketplace payout preparations" count={overview.sellerPayoutPreparationQueue.length} empty="No prepared test payable is in this bounded page." boundary="Preparation does not execute a provider transfer or payout. Live payout execution remains unavailable.">{overview.sellerPayoutPreparationQueue.map((item) => <div key={item.payoutPreparationId}><p><strong>{operatorMoney(item.amountMinor, item.currency)}</strong> · {item.status.replace(/_/g, " ")}</p><p className="small-note">Preparation <code>{item.payoutPreparationId}</code> · seller <code>{item.sellerAccountId}</code> · {operatorWhen(item.createdAt)}</p></div>)}</QueueCard>}
      {overview.organizationServiceQueue !== null && <QueueCard title="Organization-service attention" count={overview.organizationServiceQueue.length} empty="No organization-service attention item is in this bounded page." boundary="Private organization records do not create public profile affiliation, membership, badges, trust, review authority, or governance power.">{overview.organizationServiceQueue.map((item) => <div key={item.engagementId}><p><strong>{item.serviceCode.replace(/_/g, " ")}</strong> · {item.status.replace(/_/g, " ")}</p><p>Entitlement: {item.entitlementState.replace(/_/g, " ")} · support agreement: {item.supportAgreementState.replace(/_/g, " ")}</p><p className="small-note">Engagement <code>{item.engagementId}</code> · organization <code>{item.organizationId}</code>{item.orderId ? <> · order <code>{item.orderId}</code></> : ""} · {operatorWhen(item.updatedAt)}</p></div>)}</QueueCard>}
      {overview.sponsorshipQueue !== null && <QueueCard title="Ethical-sponsorship attention" count={overview.sponsorshipQueue.length} empty="No sponsorship attention item is in this bounded page." boundary="Signer opt-in plus reviewer approval still does not prove public display; independent deployment and database kill switches control publication. Sponsorship grants no authority or endorsement.">{overview.sponsorshipQueue.map((item) => <div key={item.sponsorshipAgreementId}><p><strong>{item.purposeCode.replace(/_/g, " ")}</strong> · {item.status.replace(/_/g, " ")}</p><p>Signer opted in: {item.publicRecognitionOptIn ? "yes" : "no"} · reviewer approved: {item.publicRecognitionApproved ? "yes" : "no"}</p><p className="small-note">Agreement <code>{item.sponsorshipAgreementId}</code> · organization <code>{item.organizationId}</code>{item.orderId ? <> · order <code>{item.orderId}</code></> : ""} · {operatorWhen(item.updatedAt)}</p></div>)}</QueueCard>}
      {overview.accountRequestQueue !== null && <QueueCard title="Economic account requests" count={overview.accountRequestQueue.length} empty="No export or economic-closure request is in this bounded page." boundary="Economic closure never deletes Auth identity, the Commons Profile, community content, badges, roles, or retained financial records. Processing remains a separate audited operation.">{overview.accountRequestQueue.map((item) => <div key={item.requestId}><p><strong>{item.requestType === "data_export" ? "Data export" : "Economic account closure"}</strong> · {item.status.replace(/_/g, " ")}</p><p className="small-note">Request <code>{item.requestId}</code> · {operatorWhen(item.submittedAt)}{item.providerCancellationRequired ? " · active provider cancellation must be resolved before closure" : ""}</p></div>)}</QueueCard>}
      {overview.assistanceProgramQueue !== null && <QueueCard title="Economic assistance programs" count={overview.assistanceProgramQueue.length} empty="No assistance-program summary is in this bounded page." boundary="Program capacity never identifies beneficiaries publicly or creates a badge, rank, stigma, debt, sponsor control, or governance signal.">{overview.assistanceProgramQueue.map((item) => <div key={item.programId}><p><strong>{item.programCode.replace(/_/g, " ")}</strong> · {item.kind.replace(/_/g, " ")} for {item.scope.replace(/_/g, " ")} · {item.status}</p><p>{operatorWhen(item.startsAt)} through {operatorWhen(item.endsAt)}</p><p className="small-note">Program <code>{item.programId}</code> · updated {operatorWhen(item.updatedAt)}</p></div>)}</QueueCard>}
      {overview.assistanceQueue !== null && <QueueCard title="Private assistance grants" count={overview.assistanceQueue.length} empty="No private assistance summary is in this bounded page." boundary="Assistance is legitimate and private. It is not a badge, public rank, governance signal, sponsor-selected benefit, or measure of dignity.">{overview.assistanceQueue.map((item) => <div key={item.grantId}><p><strong>{item.scope.replace(/_/g, " ")}</strong> · {item.status.replace(/_/g, " ")}</p><p className="small-note">Grant <code>{item.grantId}</code> · {operatorWhen(item.expiresAt)}</p></div>)}</QueueCard>}
      {overview.featureFlags !== null && <QueueCard title="Economic feature-flag state" count={overview.featureFlags.length} empty="The complete reviewed feature inventory is unavailable; fail closed." boundary="This is the complete reviewed kill-switch inventory, not a ten-row queue. The browser is read-only for flags. Assignment of economic_feature_flags_manage does not create a browser toggle; changes require the separately audited server/CLI workflow.">{overview.featureFlags.map((item) => <div key={item.featureKey}><p><strong>{item.featureKey.replace(/_/g, " ")}</strong> · {item.enabled ? "enabled" : "disabled"}{item.testModeOnly ? " · test-mode only" : ""}</p><p className="small-note">Updated {operatorWhen(item.updatedAt)}</p></div>)}</QueueCard>}
    </div>
  </section>;
}

function EconomicAuditPanel({ accessToken }: { accessToken: string }) {
  const [events, setEvents] = useState<EconomicAuditEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<EconomicAuditCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshAudit = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const page = await loadEconomicOperatorAudit(accessToken, { limit: 50 });
      setEvents(page.events);
      setNextCursor(page.nextCursor);
    } catch (requestError) {
      setEvents([]);
      setNextCursor(null);
      setError(billingErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { void refreshAudit(); }, [refreshAudit]);

  async function loadMore() {
    if (loading || !nextCursor) return;
    setLoading(true);
    setError("");
    try {
      const page = await loadEconomicOperatorAudit(accessToken, { limit: 50, cursor: nextCursor });
      setEvents((current) => {
        const known = new Set(current.map((event) => event.eventId));
        return [...current, ...page.events.filter((event) => !known.has(event.eventId))];
      });
      setNextCursor(page.nextCursor);
    } catch (requestError) {
      setError(billingErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  return <section className="section-card" aria-labelledby="economic-audit-title">
    <div className="section-heading section-heading--inline"><div><p className="eyebrow">Capability: economic audit view</p><h2 id="economic-audit-title">Redacted economic audit trail</h2></div><button type="button" onClick={() => void refreshAudit()} disabled={loading}>{loading ? "Loading..." : "Refresh audit"}</button></div>
    <p>This cursor-bounded test-mode view exposes only action category, target category, optional internal target UUID, actor kind, and timestamp. It omits reasons, metadata, provider references, actor user IDs, personal contact details, payment credentials, bank data, and tax data.</p>
    {error && <p className="message" role="alert">{error}</p>}
    {!events.length && !loading && !error && <p>No events are present in this bounded page. This is not proof that no older retained audit event exists.</p>}
    {events.length > 0 && <div className="economic-capability-grid">{events.map((event) => <article className="economic-summary-card" key={event.eventId}><strong>{event.action.replace(/_/g, " ")}</strong><p>{event.targetType.replace(/_/g, " ")} · {event.actorKind.replace(/_/g, " ")} · {operatorWhen(event.createdAt)}</p><p className="small-note">Event <code>{event.eventId}</code>{event.targetId ? <> · target <code>{event.targetId}</code></> : " · no target UUID exposed"}</p></article>)}</div>}
    <p className="inline-status" role="status" aria-live="polite">{loading ? "Loading a bounded private audit page..." : `${events.length} redacted event${events.length === 1 ? "" : "s"} loaded.`}</p>
    {nextCursor && <button type="button" onClick={() => void loadMore()} disabled={loading}>Load next bounded page</button>}
    <p className="boundary-note">Audit visibility does not grant mutation authority. The absence of raw evidence here does not authorize workarounds through direct database writes, provider dashboards, copied secrets, or unrelated community-admin tools.</p>
  </section>;
}

function EconomicAccountingExportForm({ accessToken }: { accessToken: string }) {
  const [fromLocal, setFromLocal] = useState("");
  const [toLocal, setToLocal] = useState("");
  const [limit, setLimit] = useState("50");
  const [confirmation, setConfirmation] = useState("");
  const [cursor, setCursor] = useState<{ afterCreatedAt: string; afterId: string } | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const requestIdRef = useRef("");
  const errorRef = useRef<HTMLDivElement>(null);
  const parsedLimit = Number(limit);
  const fromTimestamp = fromLocal ? new Date(fromLocal).getTime() : Number.NaN;
  const toTimestamp = toLocal ? new Date(toLocal).getTime() : Number.NaN;
  const rangeValid = Number.isFinite(fromTimestamp) && Number.isFinite(toTimestamp) && toTimestamp > fromTimestamp && toTimestamp - fromTimestamp <= 31 * 24 * 60 * 60 * 1_000;
  const canSubmit = Boolean(rangeValid && Number.isSafeInteger(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 100 && confirmation === "EXPORT PRIVATE ECONOMIC ACCOUNTING" && !busy);

  function change(action: () => void, resetCursor = true) {
    action();
    requestIdRef.current = "";
    if (resetCursor) { setCursor(null); setPageNumber(1); }
    clearFeedback(setError, setStatus);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      setError("Choose a valid UTC-convertible range of no more than 31 days, a page size from 1 through 100, and type EXPORT PRIVATE ECONOMIC ACCOUNTING exactly.");
      focusError(errorRef);
      return;
    }
    setBusy(true);
    clearFeedback(setError, setStatus);
    setStatus("Preparing one bounded, redacted test accounting page…");
    requestIdRef.current ||= createBillingClientRequestId();
    try {
      const result = await exportEconomicOperatorAccounting({
        clientRequestId: requestIdRef.current,
        from: new Date(fromTimestamp).toISOString(),
        to: new Date(toTimestamp).toISOString(),
        afterCreatedAt: cursor?.afterCreatedAt ?? null,
        afterId: cursor?.afterId ?? null,
        limit: parsedLimit,
        confirmation: "EXPORT PRIVATE ECONOMIC ACCOUNTING"
      }, accessToken);
      const artifact = {
        exportVersion: result.exportVersion,
        generatedBy: "Elysia Ecobotics Online private economic operations",
        testMode: true,
        page: pageNumber,
        from: result.from,
        to: result.to,
        providerIdentifiersExposed: false,
        personalContactDataExposed: false,
        entries: result.entries
      };
      const blob = new Blob([JSON.stringify(artifact, null, 2)], { type: "application/json" });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `elysia-economic-accounting-test-${result.from.slice(0, 10)}-${result.to.slice(0, 10)}-page-${pageNumber}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      const last = result.entries[result.entries.length - 1];
      if (result.entries.length === result.limit && last) {
        setCursor({ afterCreatedAt: last.recordedAt, afterId: last.eventId });
        setPageNumber((value) => value + 1);
        setStatus(`Downloaded ${result.entries.length} redacted test accounting entries. Another bounded page may exist; the next-page cursor is ready but not displayed.`);
      } else {
        setCursor(null);
        setStatus(`Downloaded ${result.entries.length} redacted test accounting entries. This bounded range has no further page indicated.`);
      }
      requestIdRef.current = "";
      setConfirmation("");
    } catch (requestError) {
      setStatus("");
      setError(billingErrorMessage(requestError));
      focusError(errorRef);
    } finally {
      setBusy(false);
    }
  }

  return <section className="section-card economic-operation-card" aria-labelledby="economic-accounting-export-title">
    <p className="eyebrow">Capability: accounting export</p>
    <h2 id="economic-accounting-export-title">Download a bounded private accounting page</h2>
    <p>This exports normalized test accounting entries only. Provider identifiers, personal contact data, card or bank data, secrets, raw webhook payloads, community identity, badges, roles, and governance state are excluded.</p>
    <form className="auth-form economic-operation-form" onSubmit={submit} noValidate>
      <label><span>Range start</span><input type="datetime-local" value={fromLocal} onChange={(event) => change(() => setFromLocal(event.target.value))} required /></label>
      <label><span>Range end</span><input type="datetime-local" value={toLocal} onChange={(event) => change(() => setToLocal(event.target.value))} required /><small>The range must be no more than 31 days. Browser-local input is converted to an explicit UTC timestamp before the request.</small></label>
      <label><span>Entries per bounded page</span><input type="number" min={1} max={100} step={1} inputMode="numeric" value={limit} onChange={(event) => change(() => setLimit(event.target.value))} required /><small>Pages are capped at 100 entries so the private browser transport remains within its hard response-size ceiling.</small></label>
      {cursor && <div className="confirmation-panel"><p>Page {pageNumber - 1} reached the selected limit. The next request will use the private cursor returned by the last entry; the cursor itself is not rendered.</p><button type="button" disabled={busy} onClick={() => change(() => setConfirmation(""))}>Start again from the range beginning</button></div>}
      <label><span>Type <strong>EXPORT PRIVATE ECONOMIC ACCOUNTING</strong> exactly</span><input value={confirmation} onChange={(event) => change(() => setConfirmation(event.target.value), false)} autoComplete="off" spellCheck={false} required /></label>
      <OperationFeedback error={error} status={status} errorRef={errorRef} />
      <button className="button-primary" type="submit" disabled={!canSubmit}>{busy ? "Preparing private export…" : cursor ? "Download next bounded page" : "Download bounded accounting page"}</button>
    </form>
    <p className="boundary-note">The downloaded file is private financial operations material. Store and transmit it only through an approved accounting process. A download does not change payment, refund, payout, tax, recognition, account, or governance state.</p>
  </section>;
}

function OperatorAssignmentForm({ accessToken, onComplete }: { accessToken: string; onComplete: () => Promise<void> }) {
  const [userId, setUserId] = useState("");
  const [capability, setCapability] = useState<EconomicOperatorCapability>("economic_orders_view");
  const [enabled, setEnabled] = useState(true);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  const requiredConfirmation = enabled ? "grant-economic-capability" : "revoke-economic-capability";
  const canSubmit = isBillingUuid(userId) && validReason(reason) && confirmation === requiredConfirmation && !busy;

  function changeInput(change: () => void) {
    change();
    clearFeedback(setError, setStatus);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    clearFeedback(setError, setStatus);
    if (!canSubmit) {
      setError(`Enter a valid Website Account UUID, an audit reason of at least 8 characters, and type ${requiredConfirmation} exactly.`);
      focusError(errorRef);
      return;
    }
    setBusy(true);
    setStatus("Submitting the audited test-mode capability change...");
    try {
      const result = await setEconomicOperatorAssignment({ userId, capability, enabled, confirmation: requiredConfirmation, reason }, accessToken);
      setStatus(`${result.idempotentReplay ? "Existing audited result confirmed" : "Audited capability change confirmed"}: ${capability.replace(/_/g, " ")} is ${result.active ? "active" : "inactive"}.`);
      setConfirmation("");
      await onComplete();
    } catch (requestError) {
      setStatus("");
      setError(billingErrorMessage(requestError));
      focusError(errorRef);
    } finally {
      setBusy(false);
    }
  }

  return <section className="section-card economic-operation-card" aria-labelledby="operator-assignment-title">
    <p className="eyebrow">Capability: economic operator assignments manage</p>
    <h2 id="operator-assignment-title">Assign or revoke one economic capability</h2>
    <p>This changes only a narrow private economic capability. It cannot grant a community role, badge, trust, review authority, or publication approval.</p>
    <form className="auth-form economic-operation-form" onSubmit={submit} noValidate>
      <label><span>Target Website Account UUID</span><input type="text" value={userId} onChange={(event) => changeInput(() => setUserId(event.target.value))} autoComplete="off" spellCheck={false} placeholder="00000000-0000-4000-8000-000000000000" required aria-describedby="operator-assignment-user-help" /></label>
      <p className="small-note" id="operator-assignment-user-help">Use the internal Auth user UUID only. Never enter an email address, Stripe customer ID, bank identifier, or provider credential.</p>
      <label><span>Narrow economic capability</span><select value={capability} onChange={(event) => changeInput(() => setCapability(event.target.value as EconomicOperatorCapability))}>{economicOperatorCapabilityKeys.map((key) => <option value={key} key={key}>{key.replace(/_/g, " ")}</option>)}</select></label>
      <fieldset className="operator-choice-fieldset"><legend>Assignment action</legend><div className="button-row">
        <label className="checkbox-line"><input type="radio" name="operator-assignment-action" checked={enabled} onChange={() => changeInput(() => { setEnabled(true); setConfirmation(""); })} /><span>Grant this capability</span></label>
        <label className="checkbox-line"><input type="radio" name="operator-assignment-action" checked={!enabled} onChange={() => changeInput(() => { setEnabled(false); setConfirmation(""); })} /><span>Revoke this capability</span></label>
      </div></fieldset>
      <label><span>Private audit reason</span><textarea value={reason} onChange={(event) => changeInput(() => setReason(event.target.value))} minLength={8} maxLength={1000} rows={4} required aria-describedby="operator-assignment-reason-help" /></label>
      <p className="small-note" id="operator-assignment-reason-help">8–1,000 characters. This belongs in the restricted audit record; do not include payment credentials, bank details, or unnecessary personal data.</p>
      <div className="confirmation-panel"><label><span>Type <strong>{requiredConfirmation}</strong> to confirm</span><input type="text" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); clearFeedback(setError, setStatus); }} autoComplete="off" spellCheck={false} required /></label></div>
      <OperationFeedback error={error} status={status} errorRef={errorRef} />
      <button className="button-primary" type="submit" disabled={!canSubmit}>{busy ? "Recording audited change..." : enabled ? "Grant narrow capability" : "Revoke narrow capability"}</button>
    </form>
    <p className="boundary-note">Bootstrap assignment remains server-only and is unavailable in this browser. This form works only after an assignment manager already exists through the governed bootstrap process.</p>
  </section>;
}

function SandboxCreditGrantForm({ accessToken, onComplete }: { accessToken: string; onComplete: () => Promise<void> }) {
  const [userId, setUserId] = useState("");
  const [units, setUnits] = useState("");
  const [sourceType, setSourceType] = useState<OperatorSandboxCreditSource | "">("");
  const [sourceReference, setSourceReference] = useState("");
  const [expiresAtLocal, setExpiresAtLocal] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  const idempotencyKeyRef = useRef("");
  const sourceReferenceValid = !sourceReference || /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(sourceReference.trim());
  const expirationValid = !expiresAtLocal || (Number.isFinite(new Date(expiresAtLocal).getTime()) && new Date(expiresAtLocal).getTime() > Date.now());
  const canSubmit = isBillingUuid(userId) && validWholeNumber(units) && Boolean(sourceType) && sourceReferenceValid && expirationValid && validReason(reason) && confirmed && !busy;

  function changeEconomicInput(change: () => void) {
    change();
    idempotencyKeyRef.current = "";
    clearFeedback(setError, setStatus);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    clearFeedback(setError, setStatus);
    if (!canSubmit || !sourceType) {
      setError("Complete every required field with a valid UUID, whole-unit amount, source, private reason, optional reference/expiration, and explicit confirmation.");
      focusError(errorRef);
      return;
    }
    setBusy(true);
    setStatus("Recording an audited test-mode sandbox credit grant...");
    try {
      idempotencyKeyRef.current ||= createBillingClientRequestId();
      const expiresAt = expiresAtLocal ? new Date(expiresAtLocal).toISOString() : null;
      const result = await grantEconomicOperatorSandboxCredits({ userId, units: Number(units), sourceType, sourceReference: sourceReference.trim() || null, expiresAt, idempotencyKey: idempotencyKeyRef.current, reason }, accessToken);
      setStatus(`${result.idempotentReplay ? "Existing idempotent grant confirmed" : "Audited grant confirmed"}: ${result.grantedUnits.toLocaleString()} test-mode sandbox service units from ${result.sourceCategory.replace(/_/g, " ")}.`);
      idempotencyKeyRef.current = "";
      setConfirmed(false);
      await onComplete();
    } catch (requestError) {
      setStatus("");
      setError(billingErrorMessage(requestError));
      focusError(errorRef);
    } finally {
      setBusy(false);
    }
  }

  return <section className="section-card economic-operation-card" aria-labelledby="sandbox-credit-grant-title">
    <p className="eyebrow">Capability: sandbox credits adjust</p>
    <h2 id="sandbox-credit-grant-title">Grant test-mode sandbox service units</h2>
    <p>This appends an audited service-credit lot. These units are not money, badge credits, recognition, safety privilege, network permission, or community authority.</p>
    <form className="auth-form economic-operation-form" onSubmit={submit} noValidate>
      <label><span>Target Website Account UUID</span><input type="text" value={userId} onChange={(event) => changeEconomicInput(() => setUserId(event.target.value))} autoComplete="off" spellCheck={false} placeholder="00000000-0000-4000-8000-000000000000" required /></label>
      <label><span>Service units</span><input type="number" value={units} onChange={(event) => changeEconomicInput(() => setUnits(event.target.value))} min={1} max={1_000_000_000} step={1} inputMode="numeric" required aria-describedby="sandbox-credit-units-help" /></label>
      <p className="small-note" id="sandbox-credit-units-help">Enter whole internal units, not dollars, cents, badge credits, or a public rank.</p>
      <label><span>Source category</span><select value={sourceType} onChange={(event) => changeEconomicInput(() => setSourceType(event.target.value as OperatorSandboxCreditSource | ""))} required><option value="">Choose a source</option>{sandboxSources.map((source) => <option value={source.value} key={source.value}>{source.label}</option>)}</select></label>
      <label><span>Optional internal source reference</span><input type="text" value={sourceReference} onChange={(event) => changeEconomicInput(() => setSourceReference(event.target.value))} maxLength={160} autoComplete="off" spellCheck={false} aria-describedby="sandbox-credit-source-help" /></label>
      <p className="small-note" id="sandbox-credit-source-help">Restricted case reference only. Do not enter a Stripe object ID, payment credential, secret, email address, or bank information.</p>
      <label><span>Optional expiration in your local time</span><input type="datetime-local" value={expiresAtLocal} onChange={(event) => changeEconomicInput(() => setExpiresAtLocal(event.target.value))} aria-describedby="sandbox-credit-expiration-help" /></label>
      <p className="small-note" id="sandbox-credit-expiration-help">A supplied future time is converted to UTC and must be no more than ten years away.</p>
      <label><span>Private audit reason</span><textarea value={reason} onChange={(event) => changeEconomicInput(() => setReason(event.target.value))} minLength={8} maxLength={1000} rows={4} required /></label>
      <div className="confirmation-panel"><label className="checkbox-line"><input type="checkbox" checked={confirmed} onChange={(event) => { setConfirmed(event.target.checked); clearFeedback(setError, setStatus); }} /><span>I confirm this creates test-mode service units only and grants no recognition, safety privilege, trust, or authority.</span></label></div>
      <OperationFeedback error={error} status={status} errorRef={errorRef} />
      <button className="button-primary" type="submit" disabled={!canSubmit}>{busy ? "Recording audited grant..." : "Grant sandbox service units"}</button>
    </form>
  </section>;
}

function RefundHoldForm({ accessToken, refundablePayments, onComplete }: { accessToken: string; refundablePayments: EconomicOperatorRefundablePaymentQueueItem[]; onComplete: () => Promise<void> }) {
  const [paymentTransactionId, setPaymentTransactionId] = useState("");
  const [amountMinor, setAmountMinor] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  const clientRequestIdRef = useRef("");
  const selectedPayment = refundablePayments.find((payment) => payment.paymentTransactionId === paymentTransactionId) ?? null;
  const numericAmount = Number(amountMinor);
  const canSubmit = Boolean(selectedPayment && isBillingUuid(selectedPayment.orderId) && isBillingUuid(paymentTransactionId)
    && validWholeNumber(amountMinor) && numericAmount <= selectedPayment.refundableAmountMinor && validReason(reason) && confirmed && !busy);

  function changeEconomicInput(change: () => void) {
    change();
    clientRequestIdRef.current = "";
    clearFeedback(setError, setStatus);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    clearFeedback(setError, setStatus);
    if (!canSubmit) {
      setError("Choose one payment transaction from the bounded refundable queue, enter a whole amount no greater than its current refundable balance, add a private audit reason, and confirm the separate-review boundary.");
      focusError(errorRef);
      return;
    }
    setBusy(true);
    setStatus("Recording a private test-mode refund hold for separate review...");
    try {
      clientRequestIdRef.current ||= createBillingClientRequestId();
      const result = await placeEconomicOperatorRefundHold({ orderId: selectedPayment?.orderId ?? "", paymentTransactionId, amountMinor: numericAmount, clientRequestId: clientRequestIdRef.current, reason }, accessToken);
      setStatus(`${result.idempotentReplay ? "Existing idempotent hold confirmed" : "Refund hold recorded"} for transaction ${result.paymentTransactionId}. Current state: ${result.status.replace(/_/g, " ")}. No provider refund is claimed.`);
      clientRequestIdRef.current = "";
      setPaymentTransactionId("");
      setAmountMinor("");
      setConfirmed(false);
      await onComplete();
    } catch (requestError) {
      setStatus("");
      setError(billingErrorMessage(requestError));
      focusError(errorRef);
    } finally {
      setBusy(false);
    }
  }

  return <section className="section-card economic-operation-card" aria-labelledby="refund-hold-title">
    <p className="eyebrow">Capability: economic refunds manage</p>
    <h2 id="refund-hold-title">Place a refund hold for separate review</h2>
    <p>This creates a private internal hold against one exact payment transaction. It does not send a Stripe refund, disclose provider identifiers, or treat payment status as community standing.</p>
    <form className="auth-form economic-operation-form" onSubmit={submit} noValidate>
      {!refundablePayments.length ? <p className="boundary-note" role="status">No bounded refundable payment transaction is available. A refund hold cannot be started from an order alone, and this form will not ask for or accept a Stripe identifier.</p> : <label><span>Bounded refundable payment transaction</span><select value={paymentTransactionId} onChange={(event) => changeEconomicInput(() => { setPaymentTransactionId(event.target.value); setAmountMinor(""); setConfirmed(false); })} required aria-describedby="refund-payment-help"><option value="">Choose one exact payment transaction</option>{refundablePayments.map((payment) => <option key={payment.paymentTransactionId} value={payment.paymentTransactionId}>{payment.publicReference} · {payment.flow.replace(/_/g, " ")} · {operatorMoney(payment.refundableAmountMinor, payment.currency)} refundable · {operatorWhen(payment.occurredAt)}</option>)}</select></label>}
      <p className="small-note" id="refund-payment-help">The server supplies only Elysia internal transaction and order references with a current refundable balance. No provider payment-intent, charge, customer, subscription, or payment-method ID reaches this browser.</p>
      {selectedPayment && <div className="confirmation-panel" aria-live="polite"><p><strong>Selected payment:</strong> {selectedPayment.publicReference} · {selectedPayment.flow.replace(/_/g, " ")} · {operatorMoney(selectedPayment.grossAmountMinor, selectedPayment.currency)} gross · {operatorMoney(selectedPayment.refundableAmountMinor, selectedPayment.currency)} currently refundable.</p><p className="small-note">Internal transaction <code>{selectedPayment.paymentTransactionId}</code> · internal order <code>{selectedPayment.orderId}</code> · {operatorWhen(selectedPayment.occurredAt)}</p></div>}
      <label><span>Requested amount in minor currency units</span><input type="number" value={amountMinor} onChange={(event) => changeEconomicInput(() => setAmountMinor(event.target.value))} min={1} max={selectedPayment ? Math.min(selectedPayment.refundableAmountMinor, 1_000_000_000) : 1} step={1} inputMode="numeric" disabled={!selectedPayment} required aria-describedby="refund-amount-help" /></label>
      <p className="small-note" id="refund-amount-help">Whole minor units only (for USD, cents), no greater than the selected transaction's current refundable balance or the endpoint's 1,000,000,000-unit safety ceiling. The server rechecks all prior refunds and holds.</p>
      <label><span>Private audit reason</span><textarea value={reason} onChange={(event) => changeEconomicInput(() => setReason(event.target.value))} minLength={8} maxLength={1000} rows={4} required /></label>
      <div className="confirmation-panel"><label className="checkbox-line"><input type="checkbox" checked={confirmed} disabled={!selectedPayment} onChange={(event) => { setConfirmed(event.target.checked); clearFeedback(setError, setStatus); }} /><span>I confirm this hold is limited to the selected payment transaction and amount, requires separate review, and does not promise or send a provider refund.</span></label></div>
      <OperationFeedback error={error} status={status} errorRef={errorRef} />
      <button className="button-primary" type="submit" disabled={!canSubmit}>{busy ? "Recording refund hold..." : "Place refund hold"}</button>
    </form>
  </section>;
}

function TestRefundExecutionForm({ accessToken, onComplete }: { accessToken: string; onComplete: () => Promise<void> }) {
  const [refundRequestId, setRefundRequestId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  const requestIdsRef = useRef<{ approvalClientRequestId: string; providerAttachClientRequestId: string } | null>(null);
  const canSubmit = isBillingUuid(refundRequestId) && validReason(reason) && confirmation === "AUTHORIZE TEST REFUND" && !busy;

  function changeEconomicInput(change: () => void) {
    change();
    requestIdsRef.current = null;
    clearFeedback(setError, setStatus);
  }

  function requestIdsForIntent() {
    if (requestIdsRef.current) return requestIdsRef.current;
    const approvalClientRequestId = createBillingClientRequestId();
    let providerAttachClientRequestId = createBillingClientRequestId();
    while (providerAttachClientRequestId === approvalClientRequestId) providerAttachClientRequestId = createBillingClientRequestId();
    requestIdsRef.current = { approvalClientRequestId, providerAttachClientRequestId };
    return requestIdsRef.current;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    clearFeedback(setError, setStatus);
    if (!canSubmit) {
      setError("Enter a valid internal refund-request UUID, a private audit reason of at least 8 characters, and type AUTHORIZE TEST REFUND exactly.");
      focusError(errorRef);
      return;
    }
    setBusy(true);
    setStatus("Authorizing a Stripe test-mode refund through the two-step audited server workflow...");
    try {
      const requestIds = requestIdsForIntent();
      const result = await executeEconomicOperatorTestRefund({ refundRequestId, ...requestIds, confirmation: "AUTHORIZE TEST REFUND", reason }, accessToken);
      setStatus(`${result.idempotentReplay ? "Existing idempotent test-refund result confirmed" : "Stripe test-refund result recorded"}. Provider state: ${result.providerStatus}; internal state: ${result.status.replace(/_/g, " ")}. No live funds moved.`);
      requestIdsRef.current = null;
      setConfirmation("");
      await onComplete();
    } catch (requestError) {
      setStatus("");
      setError(billingErrorMessage(requestError));
      focusError(errorRef);
    } finally {
      setBusy(false);
    }
  }

  return <section className="section-card economic-operation-card" aria-labelledby="test-refund-execution-title">
    <p className="eyebrow">Capability: economic refunds manage · test mode only</p>
    <h2 id="test-refund-execution-title">Authorize one Stripe test refund</h2>
    <p>This is the separately audited second step after a refund hold. The server prevents the operator who requested the hold from approving it, rechecks cumulative refund limits, and uses Stripe's test API only.</p>
    <form className="auth-form economic-operation-form" onSubmit={submit} noValidate>
      <label><span>Internal refund-request UUID</span><input type="text" value={refundRequestId} onChange={(event) => changeEconomicInput(() => setRefundRequestId(event.target.value))} autoComplete="off" spellCheck={false} placeholder="00000000-0000-4000-8000-000000000000" required aria-describedby="test-refund-request-help" /></label>
      <p className="small-note" id="test-refund-request-help">Use the private Elysia refund-request UUID from the reviewed hold. Do not enter an order ID, amount, Stripe object ID, payment credential, or provider secret.</p>
      <label><span>Private approval reason</span><textarea value={reason} onChange={(event) => changeEconomicInput(() => setReason(event.target.value))} minLength={8} maxLength={1000} rows={4} required aria-describedby="test-refund-reason-help" /></label>
      <p className="small-note" id="test-refund-reason-help">Explain the independent review decision without copying payment credentials, bank data, or unnecessary personal information.</p>
      <div className="confirmation-panel"><p><strong>TEST MODE ONLY:</strong> this calls the Stripe test refund API. It cannot move live funds, but it does create durable test-mode provider and audit state.</p><label><span>Type <strong>AUTHORIZE TEST REFUND</strong> exactly</span><input type="text" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); clearFeedback(setError, setStatus); }} autoComplete="off" spellCheck={false} required /></label></div>
      <OperationFeedback error={error} status={status} errorRef={errorRef} />
      <button className="button-danger" type="submit" disabled={!canSubmit}>{busy ? "Authorizing Stripe test refund..." : "Authorize Stripe test refund"}</button>
    </form>
    <p className="boundary-note">If the response is ambiguous, retry the unchanged form: this browser retains the same two independent request identifiers. Changing the refund request or reason starts a new operator intent. The server remains authoritative.</p>
  </section>;
}

function ReconciliationForm({ accessToken, onComplete }: { accessToken: string; onComplete: () => Promise<void> }) {
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  const clientRequestIdRef = useRef("");
  const canSubmit = isBillingUuid(orderId) && validReason(reason) && confirmed && !busy;

  function changeEconomicInput(change: () => void) {
    change();
    clientRequestIdRef.current = "";
    clearFeedback(setError, setStatus);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    clearFeedback(setError, setStatus);
    if (!canSubmit) {
      setError("Enter a valid internal order UUID, a private audit reason of at least 8 characters, and explicit confirmation.");
      focusError(errorRef);
      return;
    }
    setBusy(true);
    setStatus("Opening a private test-mode reconciliation case...");
    try {
      clientRequestIdRef.current ||= createBillingClientRequestId();
      const result = await openEconomicOperatorReconciliationCase({ orderId, clientRequestId: clientRequestIdRef.current, reason }, accessToken);
      setStatus(`${result.idempotentReplay ? "Existing idempotent case confirmed" : "Reconciliation case opened"}. Current state: ${result.status.replace(/_/g, " ")}. No payment truth was inferred by this browser.`);
      clientRequestIdRef.current = "";
      setConfirmed(false);
      await onComplete();
    } catch (requestError) {
      setStatus("");
      setError(billingErrorMessage(requestError));
      focusError(errorRef);
    } finally {
      setBusy(false);
    }
  }

  return <section className="section-card economic-operation-card" aria-labelledby="reconciliation-title">
    <p className="eyebrow">Capability: economic reconciliation manage</p>
    <h2 id="reconciliation-title">Open a reconciliation case</h2>
    <p>This marks an internal order for private comparison with verified provider events. Browser redirects and operator assertions never establish payment truth.</p>
    <form className="auth-form economic-operation-form" onSubmit={submit} noValidate>
      <label><span>Internal economic order UUID</span><input type="text" value={orderId} onChange={(event) => changeEconomicInput(() => setOrderId(event.target.value))} autoComplete="off" spellCheck={false} placeholder="00000000-0000-4000-8000-000000000000" required aria-describedby="reconciliation-order-help" /></label>
      <p className="small-note" id="reconciliation-order-help">Use the private Elysia economic order UUID. It is not a Stripe checkout, payment, charge, customer, or subscription ID. Do not paste a provider object ID or secret.</p>
      <label><span>Private audit reason</span><textarea value={reason} onChange={(event) => changeEconomicInput(() => setReason(event.target.value))} minLength={8} maxLength={1000} rows={4} required /></label>
      <div className="confirmation-panel"><label className="checkbox-line"><input type="checkbox" checked={confirmed} onChange={(event) => { setConfirmed(event.target.checked); clearFeedback(setError, setStatus); }} /><span>I confirm this opens a private test-mode review case and does not mark the order paid, refunded, trusted, or publicly visible.</span></label></div>
      <OperationFeedback error={error} status={status} errorRef={errorRef} />
      <button className="button-primary" type="submit" disabled={!canSubmit}>{busy ? "Opening reconciliation case..." : "Open reconciliation case"}</button>
    </form>
  </section>;
}

function JobPostEconomicAssessmentForm({ accessToken, onComplete }: { accessToken: string; onComplete: () => Promise<void> }) {
  const [jobPostId, setJobPostId] = useState("");
  const [classification, setClassification] = useState<OperatorJobPostClassification | "">("");
  const [priceCode, setPriceCode] = useState("");
  const [grantId, setGrantId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const requestIdRef = useRef("");
  const errorRef = useRef<HTMLDivElement>(null);
  const referenceValid = classification === "community_free"
    || (classification === "commercial" && /^job_post_[a-z0-9]+(?:_[a-z0-9]+)*_usd$/.test(priceCode.trim()))
    || ((classification === "waived" || classification === "subsidized") && isBillingUuid(grantId));
  const canSubmit = isBillingUuid(jobPostId) && Boolean(classification) && referenceValid && validReason(reason) && confirmation === "ASSESS JOB POST ECONOMIC CONDITION" && !busy;

  function change(changeInput: () => void) {
    changeInput();
    requestIdRef.current = "";
    clearFeedback(setError, setStatus);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !classification) {
      setError("Choose one classification, supply only its required internal reference, give a private audit reason, and type the confirmation exactly.");
      focusError(errorRef);
      return;
    }
    setBusy(true);
    setError("");
    setStatus("Recording a separate Job Post economic condition in test mode…");
    requestIdRef.current ||= createBillingClientRequestId();
    try {
      const result = await assessEconomicOperatorJobPostFee({
        jobPostId,
        classification,
        priceCode: classification === "commercial" ? priceCode.trim() : null,
        waiverId: classification === "waived" ? grantId : null,
        subsidyId: classification === "subsidized" ? grantId : null,
        clientRequestId: requestIdRef.current,
        confirmation: "ASSESS JOB POST ECONOMIC CONDITION",
        reason
      }, accessToken);
      requestIdRef.current = "";
      setConfirmation("");
      setStatus(`${result.idempotentReplay ? "Existing assessment confirmed" : "Economic condition recorded"}: ${result.economicStatus.replace(/_/g, " ")}. ${result.published ? "The server reports publication only because independent content approval and the service condition were both satisfied." : "The listing remains non-public unless independent content review and every required service condition are satisfied."}`);
      await onComplete();
    } catch (requestError) {
      setStatus("");
      setError(billingErrorMessage(requestError));
      focusError(errorRef);
    } finally {
      setBusy(false);
    }
  }

  return <section className="section-card economic-operation-card" aria-labelledby="job-post-economic-assessment-title">
    <p className="eyebrow">Capability: job fee assess</p>
    <h2 id="job-post-economic-assessment-title">Assess one Job Post service condition</h2>
    <p>This classifies the economic sidecar only. It cannot approve content, bypass anti-scam review, publish a rejected listing, change the author’s role, or sell trust.</p>
    <form className="auth-form economic-operation-form" onSubmit={submit} noValidate>
      <label><span>Structured Job Post UUID</span><input value={jobPostId} onChange={(event) => change(() => setJobPostId(event.target.value))} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Economic classification</span><select value={classification} onChange={(event) => change(() => { setClassification(event.target.value as OperatorJobPostClassification | ""); setPriceCode(""); setGrantId(""); })} required><option value="">Choose one</option><option value="community_free">Community free</option><option value="commercial">Commercial fee required</option><option value="waived">Waived</option><option value="subsidized">Subsidized</option></select></label>
      {classification === "commercial" && <label><span>Approved test Job Post price code</span><input value={priceCode} onChange={(event) => change(() => setPriceCode(event.target.value))} placeholder="job_post_approved_test_usd" autoComplete="off" spellCheck={false} required /><small>Use the reviewed server-catalog code. Do not enter an amount or provider price ID.</small></label>}
      {(classification === "waived" || classification === "subsidized") && <label><span>{classification === "waived" ? "Waiver" : "Subsidy"} grant UUID</span><input value={grantId} onChange={(event) => change(() => setGrantId(event.target.value))} autoComplete="off" spellCheck={false} required /><small>Use the existing private assistance-grant UUID. Financial circumstances and evidence never belong here.</small></label>}
      <label><span>Private audit reason</span><textarea value={reason} onChange={(event) => change(() => setReason(event.target.value))} minLength={8} maxLength={1000} rows={4} required /></label>
      <label><span>Typed confirmation</span><input value={confirmation} onChange={(event) => { setConfirmation(event.target.value); clearFeedback(setError, setStatus); }} autoComplete="off" spellCheck={false} required /></label><p className="small-note">Type <code>ASSESS JOB POST ECONOMIC CONDITION</code> exactly.</p>
      <OperationFeedback error={error} status={status} errorRef={errorRef} />
      <button className="button-primary" type="submit" disabled={!canSubmit}>{busy ? "Recording assessment…" : "Record separate economic condition"}</button>
    </form>
    <p className="boundary-note">Free, waived, and subsidized conditions are legitimate. A commercial payment can satisfy only a service condition; it can never perform or influence content review.</p>
  </section>;
}

function EconomicAccountRequestReviewForm({ accessToken, overview, onComplete }: { accessToken: string; overview: EconomicOperatorOverview; onComplete: () => Promise<void> }) {
  const requests = overview.accountRequestQueue ?? [];
  const [requestId, setRequestId] = useState("");
  const [nextStatus, setNextStatus] = useState<OperatorEconomicAccountActionStatus | "">("");
  const [artifactSha256, setArtifactSha256] = useState("");
  const [artifactExpiresAtLocal, setArtifactExpiresAtLocal] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const clientRequestIdRef = useRef("");
  const errorRef = useRef<HTMLDivElement>(null);
  const selectedRequest = requests.find((request) => request.requestId === requestId) ?? null;
  const hasArtifact = Boolean(artifactSha256 || artifactExpiresAtLocal);
  const artifactValid = !hasArtifact || (/^[0-9a-f]{64}$/.test(artifactSha256) && Number.isFinite(new Date(artifactExpiresAtLocal).getTime()) && new Date(artifactExpiresAtLocal).getTime() > Date.now());
  const canSubmit = Boolean(selectedRequest && nextStatus && artifactValid && validReason(reason) && confirmation === "UPDATE ECONOMIC ACCOUNT REQUEST" && !busy);

  function change(changeInput: () => void) {
    changeInput();
    clientRequestIdRef.current = "";
    clearFeedback(setError, setStatus);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    clearFeedback(setError, setStatus);
    if (!selectedRequest || !nextStatus || !canSubmit) {
      setError("Choose one bounded request and next state, provide a private audit reason, supply both artifact fields or neither, and type UPDATE ECONOMIC ACCOUNT REQUEST exactly.");
      focusError(errorRef);
      return;
    }
    setBusy(true);
    setStatus("Recording an audited economic account-request transition...");
    try {
      clientRequestIdRef.current ||= createBillingClientRequestId();
      const result = await updateEconomicOperatorAccountAction({
        requestId: selectedRequest.requestId,
        status: nextStatus,
        clientRequestId: clientRequestIdRef.current,
        artifactSha256: artifactSha256 || null,
        artifactExpiresAt: artifactExpiresAtLocal ? new Date(artifactExpiresAtLocal).toISOString() : null,
        confirmation: "UPDATE ECONOMIC ACCOUNT REQUEST",
        reason
      }, accessToken);
      setStatus(`${result.idempotentReplay ? "Existing audited transition confirmed" : "Economic account request updated"}: ${result.requestType.replace(/_/g, " ")} is ${result.status.replace(/_/g, " ")}. Financial records remain retained and Website Auth/Profile remains unchanged.`);
      clientRequestIdRef.current = "";
      setConfirmation("");
      await onComplete();
    } catch (requestError) {
      setStatus("");
      setError(billingErrorMessage(requestError));
      focusError(errorRef);
    } finally {
      setBusy(false);
    }
  }

  return <section className="section-card economic-operation-card" aria-labelledby="economic-account-request-review-title">
    <p className="eyebrow">Capability: economic account requests manage</p>
    <h2 id="economic-account-request-review-title">Review one economic lifecycle request</h2>
    <p>This changes only a private economic data-export or economic-closure workflow state. It cannot delete or alter Auth identity, Commons profiles, public content, badges, roles, moderation, recognition, or governance.</p>
    <form className="auth-form economic-operation-form" onSubmit={submit} noValidate>
      {!requests.length ? <p className="boundary-note" role="status">No bounded open economic lifecycle request is available. This does not prove that no completed, rejected, canceled, or older request exists.</p> : <label><span>Bounded open request</span><select value={requestId} onChange={(event) => change(() => { setRequestId(event.target.value); setNextStatus(""); setArtifactSha256(""); setArtifactExpiresAtLocal(""); setConfirmation(""); })} required><option value="">Choose one request</option>{requests.map((request) => <option key={request.requestId} value={request.requestId}>{request.requestType === "data_export" ? "Economic data export" : "Economic account closure"} · {request.status.replace(/_/g, " ")} · {operatorWhen(request.submittedAt)}</option>)}</select></label>}
      {selectedRequest && <div className="confirmation-panel"><p><strong>Request:</strong> {selectedRequest.requestType.replace(/_/g, " ")} · current state {selectedRequest.status.replace(/_/g, " ")}</p><p className="small-note">Internal request <code>{selectedRequest.requestId}</code>{selectedRequest.providerCancellationRequired ? " · provider cancellation coordination is required" : ""}</p></div>}
      <label><span>Reviewed next state</span><select value={nextStatus} onChange={(event) => change(() => setNextStatus(event.target.value as OperatorEconomicAccountActionStatus | ""))} disabled={!selectedRequest} required><option value="">Choose one</option><option value="identity_verification">Identity verification</option><option value="operator_review">Operator review</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="rejected">Rejected</option></select></label>
      <fieldset><legend>Optional restricted export artifact reference</legend><p className="small-note">Supply both fields only for an artifact already prepared and stored through an approved private process. Do not paste export contents, customer data, provider IDs, signed URLs, secrets, or storage paths here.</p><label><span>Artifact SHA-256 (lowercase hexadecimal)</span><input value={artifactSha256} onChange={(event) => change(() => setArtifactSha256(event.target.value.trim()))} minLength={64} maxLength={64} autoComplete="off" spellCheck={false} /></label><label><span>Artifact expiration</span><input type="datetime-local" value={artifactExpiresAtLocal} onChange={(event) => change(() => setArtifactExpiresAtLocal(event.target.value))} /></label></fieldset>
      <label><span>Private audit reason</span><textarea value={reason} onChange={(event) => change(() => setReason(event.target.value))} minLength={8} maxLength={1000} rows={4} required /></label>
      <label><span>Type <strong>UPDATE ECONOMIC ACCOUNT REQUEST</strong> exactly</span><input value={confirmation} onChange={(event) => { setConfirmation(event.target.value); clearFeedback(setError, setStatus); }} autoComplete="off" spellCheck={false} required /></label>
      <OperationFeedback error={error} status={status} errorRef={errorRef} />
      <button className={nextStatus === "rejected" ? "button-danger" : "button-primary"} type="submit" disabled={!canSubmit}>{busy ? "Recording reviewed transition..." : "Update economic request"}</button>
    </form>
    <p className="boundary-note">A completion state must reflect actual private processing. The browser never manufactures an export artifact, cancels a provider subscription, erases retained records, or broadens economic closure into general account deletion.</p>
  </section>;
}

function EconomicAssistanceManagement({ accessToken, overview, onComplete }: { accessToken: string; overview: EconomicOperatorOverview; onComplete: () => Promise<void> }) {
  const statusPrograms = (overview.assistanceProgramQueue ?? []).filter((program) => program.status !== "retired");
  const endableGrants = (overview.assistanceQueue ?? []).filter((grant) => grant.status === "granted" || (grant.scope === "sandbox_credits" && grant.status === "consumed"));
  const consumedJobPostGrants = (overview.assistanceQueue ?? []).filter((grant) => grant.scope === "job_post_fee" && grant.status === "consumed");
  const canReconcileJobPostAssistance = overview.capabilities.includes("job_fee_assess");
  const [busy, setBusy] = useState<"program" | "program-status" | "grant" | "end" | "job-reconciliation" | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  const programRequestRef = useRef("");
  const programStatusRequestRef = useRef("");
  const grantRequestRef = useRef("");
  const endRequestRef = useRef("");
  const jobReconciliationRequestRef = useRef("");

  const [programCode, setProgramCode] = useState("");
  const [assistanceKind, setAssistanceKind] = useState<EconomicAssistanceKind | "">("");
  const [assistanceScope, setAssistanceScope] = useState<EconomicAssistanceScope | "">("");
  const [publicLabel, setPublicLabel] = useState("");
  const [termsVersion, setTermsVersion] = useState("");
  const [startsAtLocal, setStartsAtLocal] = useState("");
  const [endsAtLocal, setEndsAtLocal] = useState("");
  const [maxGrants, setMaxGrants] = useState("");
  const [programReason, setProgramReason] = useState("");
  const [programConfirmation, setProgramConfirmation] = useState("");

  const [statusProgramId, setStatusProgramId] = useState("");
  const [programTargetStatus, setProgramTargetStatus] = useState<EconomicAssistanceProgramTargetStatus | "">("");
  const [programStatusReason, setProgramStatusReason] = useState("");
  const [programStatusConfirmation, setProgramStatusConfirmation] = useState("");

  const [grantProgramCode, setGrantProgramCode] = useState("");
  const [beneficiaryUserId, setBeneficiaryUserId] = useState("");
  const [resourceId, setResourceId] = useState("");
  const [grantUnits, setGrantUnits] = useState("");
  const [grantExpiresAtLocal, setGrantExpiresAtLocal] = useState("");
  const [sponsorshipAllocationId, setSponsorshipAllocationId] = useState("");
  const [allocationConsumption, setAllocationConsumption] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [grantConfirmation, setGrantConfirmation] = useState("");

  const [endGrantId, setEndGrantId] = useState("");
  const [endAction, setEndAction] = useState<"revoke" | "expire" | "">("");
  const [endReason, setEndReason] = useState("");
  const [endConfirmation, setEndConfirmation] = useState("");

  const [jobReconciliationGrantId, setJobReconciliationGrantId] = useState("");
  const [jobReconciliationPostId, setJobReconciliationPostId] = useState("");
  const [jobReconciliationAction, setJobReconciliationAction] = useState<"revoke" | "expire" | "">("");
  const [jobReconciliationReason, setJobReconciliationReason] = useState("");
  const [jobReconciliationConfirmation, setJobReconciliationConfirmation] = useState("");

  const programCodeValid = (value: string) => /^[a-z][a-z0-9_]{2,100}$/.test(value);
  const versionValid = (value: string) => /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(value);
  const localDateValid = (value: string) => Boolean(value && Number.isFinite(new Date(value).getTime()));
  const maxGrantsValid = !maxGrants || (/^\d+$/.test(maxGrants) && Number(maxGrants) >= 1 && Number(maxGrants) <= 1_000_000);
  const programDatesValid = localDateValid(startsAtLocal) && (!endsAtLocal || (localDateValid(endsAtLocal) && new Date(endsAtLocal).getTime() > new Date(startsAtLocal).getTime()));
  const canConfigureProgram = programCodeValid(programCode) && Boolean(assistanceKind && assistanceScope) && publicLabel.trim().length >= 2 && publicLabel.trim().length <= 120 && versionValid(termsVersion) && programDatesValid && maxGrantsValid && validReason(programReason) && programConfirmation === "CONFIGURE ECONOMIC ASSISTANCE PROGRAM" && busy === null;
  const selectedStatusProgram = statusPrograms.find((program) => program.programId === statusProgramId);
  const availableProgramTargets: EconomicAssistanceProgramTargetStatus[] = selectedStatusProgram?.status === "active"
    ? ["paused", "retired"]
    : selectedStatusProgram?.status === "draft" || selectedStatusProgram?.status === "paused"
      ? ["active", "retired"]
      : [];
  const expectedProgramStatusConfirmation = programTargetStatus ? operatorAssistanceProgramStatusConfirmations[programTargetStatus] : "";
  const canSetProgramStatus = isBillingUuid(statusProgramId) && Boolean(programTargetStatus && availableProgramTargets.includes(programTargetStatus)) && validReason(programStatusReason) && programStatusConfirmation === expectedProgramStatusConfirmation && busy === null;
  const unitsValid = !grantUnits || (/^\d+$/.test(grantUnits) && Number(grantUnits) >= 1 && Number(grantUnits) <= 1_000_000_000);
  const allocationPairValid = (!sponsorshipAllocationId && !allocationConsumption) || (isBillingUuid(sponsorshipAllocationId) && /^\d+$/.test(allocationConsumption) && Number(allocationConsumption) >= 1 && Number(allocationConsumption) <= 100_000_000_000);
  const expirationValid = !grantExpiresAtLocal || (localDateValid(grantExpiresAtLocal) && new Date(grantExpiresAtLocal).getTime() > Date.now());
  const canIssueGrant = programCodeValid(grantProgramCode) && isBillingUuid(beneficiaryUserId) && (!resourceId || isBillingUuid(resourceId)) && unitsValid && allocationPairValid && expirationValid && validReason(grantReason) && grantConfirmation === "ISSUE ECONOMIC ASSISTANCE GRANT" && busy === null;
  const canEndGrant = endableGrants.some((grant) => grant.grantId === endGrantId) && Boolean(endAction) && validReason(endReason) && endConfirmation === "END ECONOMIC ASSISTANCE GRANT" && busy === null;
  const canReconcileJobPostGrant = canReconcileJobPostAssistance && consumedJobPostGrants.some((grant) => grant.grantId === jobReconciliationGrantId) && isBillingUuid(jobReconciliationPostId) && Boolean(jobReconciliationAction) && validReason(jobReconciliationReason) && jobReconciliationConfirmation === "RECONCILE AND END TEST JOB POST ASSISTANCE" && busy === null;

  function change(ref: { current: string }, changeInput: () => void) {
    changeInput();
    ref.current = "";
    clearFeedback(setError, setStatus);
  }

  async function configureProgram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!canConfigureProgram || !assistanceKind || !assistanceScope) { setError("Complete the neutral program identity, narrow scope, terms version, dates, optional cap, private reason, and exact typed confirmation."); focusError(errorRef); return; }
    setBusy("program"); setError(""); setStatus("Recording a private test assistance-program definition...");
    try {
      programRequestRef.current ||= createBillingClientRequestId();
      const result = await configureEconomicOperatorAssistanceProgram({ clientRequestId: programRequestRef.current, programCode, assistanceKind, scope: assistanceScope, publicLabel, termsVersion, startsAt: new Date(startsAtLocal).toISOString(), endsAt: endsAtLocal ? new Date(endsAtLocal).toISOString() : null, maxGrants: maxGrants ? Number(maxGrants) : null, confirmation: "CONFIGURE ECONOMIC ASSISTANCE PROGRAM", reason: programReason }, accessToken);
      setStatus(`${result.idempotentReplay ? "Existing program intent confirmed" : "Assistance program recorded"}: ${result.publicLabel} is ${result.status}. Beneficiary eligibility and financial circumstances remain private.`);
      programRequestRef.current = ""; setProgramConfirmation(""); await onComplete();
    } catch (requestError) { setStatus(""); setError(billingErrorMessage(requestError)); focusError(errorRef); }
    finally { setBusy(null); }
  }

  async function changeProgramStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!canSetProgramStatus || !programTargetStatus) { setError("Choose one bounded non-retired program and an allowed next state, add a private reason, and type the status-specific confirmation exactly."); focusError(errorRef); return; }
    setBusy("program-status"); setError(""); setStatus("Recording one separately reviewed assistance-program status transition...");
    try {
      programStatusRequestRef.current ||= createBillingClientRequestId();
      const result = await setEconomicOperatorAssistanceProgramStatus({ clientRequestId: programStatusRequestRef.current, programId: statusProgramId, targetStatus: programTargetStatus, confirmation: operatorAssistanceProgramStatusConfirmations[programTargetStatus], reason: programStatusReason }, accessToken);
      setStatus(`${result.idempotentReplay ? "Existing status transition confirmed" : "Assistance-program status changed"}: ${result.status}. This changes program availability only; it creates no public beneficiary status or authority.`);
      programStatusRequestRef.current = ""; setProgramStatusConfirmation(""); await onComplete();
    } catch (requestError) { setStatus(""); setError(billingErrorMessage(requestError)); focusError(errorRef); }
    finally { setBusy(null); }
  }

  async function issueGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!canIssueGrant) { setError("Use an active program code and valid beneficiary/resource fields, provide both sponsorship-allocation fields or neither, add a private reason, and type the exact confirmation."); focusError(errorRef); return; }
    setBusy("grant"); setError(""); setStatus("Issuing one private, scoped test assistance grant...");
    try {
      grantRequestRef.current ||= createBillingClientRequestId();
      const result = await issueEconomicOperatorAssistanceGrant({ clientRequestId: grantRequestRef.current, programCode: grantProgramCode, beneficiaryUserId, resourceId: resourceId || null, units: grantUnits ? Number(grantUnits) : null, expiresAt: grantExpiresAtLocal ? new Date(grantExpiresAtLocal).toISOString() : null, sponsorshipAllocationId: sponsorshipAllocationId || null, allocationConsumption: allocationConsumption ? Number(allocationConsumption) : null, confirmation: "ISSUE ECONOMIC ASSISTANCE GRANT", reason: grantReason }, accessToken);
      setStatus(`${result.idempotentReplay ? "Existing grant intent confirmed" : "Private assistance grant recorded"}: ${result.scope.replace(/_/g, " ")} is ${result.status}. Internal grant ${result.grantId}. Publicly visible: never.${result.sandboxCreditResult ? ` ${result.sandboxCreditResult.grantedUnits.toLocaleString()} sandbox service units were recorded through the separate ledger.` : ""}`);
      grantRequestRef.current = ""; setGrantConfirmation(""); await onComplete();
    } catch (requestError) { setStatus(""); setError(billingErrorMessage(requestError)); focusError(errorRef); }
    finally { setBusy(null); }
  }

  async function endGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!canEndGrant || !endAction) { setError("Choose one active bounded grant, reviewed end state, private reason, and exact typed confirmation."); focusError(errorRef); return; }
    setBusy("end"); setError(""); setStatus("Ending one private assistance grant through an audited compensating workflow...");
    try {
      endRequestRef.current ||= createBillingClientRequestId();
      const result = await endEconomicOperatorAssistanceGrant({ clientRequestId: endRequestRef.current, grantId: endGrantId, action: endAction, confirmation: "END ECONOMIC ASSISTANCE GRANT", reason: endReason }, accessToken);
      setStatus(`${result.idempotentReplay ? "Existing end action confirmed" : "Assistance grant ended"}: ${result.status}. ${result.reversedUnits.toLocaleString()} remaining sandbox units were reversed where applicable. No public label or community standing changed.`);
      endRequestRef.current = ""; setEndConfirmation(""); await onComplete();
    } catch (requestError) { setStatus(""); setError(billingErrorMessage(requestError)); focusError(errorRef); }
    finally { setBusy(null); }
  }

  async function reconcileJobPostGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!canReconcileJobPostGrant || !jobReconciliationAction) { setError("Choose one consumed Job Post grant from the bounded queue, supply its exact Job Post UUID, choose a reviewed end state, add a private reason, and type the exact reconciliation confirmation."); focusError(errorRef); return; }
    setBusy("job-reconciliation"); setError(""); setStatus("Reconciling one consumed Job Post assistance grant with its economic condition...");
    try {
      jobReconciliationRequestRef.current ||= createBillingClientRequestId();
      const result = await reconcileEconomicOperatorJobPostAssistanceGrant({ clientRequestId: jobReconciliationRequestRef.current, jobPostId: jobReconciliationPostId, grantId: jobReconciliationGrantId, endAction: jobReconciliationAction, confirmation: "RECONCILE AND END TEST JOB POST ASSISTANCE", reason: jobReconciliationReason }, accessToken);
      setStatus(`${result.idempotentReplay ? "Existing Job Post reconciliation confirmed" : "Consumed Job Post assistance reconciled"}: the grant is ${result.grantStatus} and the economic condition is ${result.economicStatus.replace(/_/g, " ")}. Content approval was not granted or changed.`);
      jobReconciliationRequestRef.current = ""; setJobReconciliationConfirmation(""); await onComplete();
    } catch (requestError) { setStatus(""); setError(billingErrorMessage(requestError)); focusError(errorRef); }
    finally { setBusy(null); }
  }

  return <section className="section-card economic-operation-card" aria-labelledby="economic-assistance-management-title">
    <p className="eyebrow">Capability: economic assistance manage</p><h2 id="economic-assistance-management-title">Private waivers, subsidies, and sponsored access</h2>
    <p>Assistance is a legitimate access path, never a public status or evidence of wealth, need, trust, merit, or governance fitness. Programs are neutral service rules; beneficiary records and reasons remain private.</p>
    {error && <div className="validation validation--bad" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}<p className="inline-status operator-live-region" role="status" aria-live="polite" aria-atomic="true">{status}</p>
    <form className="auth-form economic-operation-form" onSubmit={configureProgram} noValidate><h3>Create a draft test assistance program</h3>
      <label><span>Stable program code</span><input value={programCode} onChange={(event) => change(programRequestRef, () => setProgramCode(event.target.value))} maxLength={101} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Assistance kind</span><select value={assistanceKind} onChange={(event) => change(programRequestRef, () => setAssistanceKind(event.target.value as EconomicAssistanceKind | ""))} required><option value="">Choose one</option><option value="waiver">Waiver</option><option value="subsidy">Subsidy</option><option value="sponsored_access">Sponsored access</option></select></label>
      <label><span>Narrow service scope</span><select value={assistanceScope} onChange={(event) => change(programRequestRef, () => setAssistanceScope(event.target.value as EconomicAssistanceScope | ""))} required><option value="">Choose one</option><option value="job_post_fee">Job Post service fee</option><option value="sandbox_credits">Online sandbox credits</option></select></label>
      <label><span>Neutral public program label</span><input value={publicLabel} onChange={(event) => change(programRequestRef, () => setPublicLabel(event.target.value))} minLength={2} maxLength={120} required /><small>This describes the program only. It must not identify recipients, rank donors, or imply authority.</small></label>
      <label><span>Reviewed terms version</span><input value={termsVersion} onChange={(event) => change(programRequestRef, () => setTermsVersion(event.target.value))} maxLength={120} autoComplete="off" spellCheck={false} required /></label>
      <div className="two-column"><label><span>Starts</span><input type="datetime-local" value={startsAtLocal} onChange={(event) => change(programRequestRef, () => setStartsAtLocal(event.target.value))} required /></label><label><span>Optional end</span><input type="datetime-local" value={endsAtLocal} onChange={(event) => change(programRequestRef, () => setEndsAtLocal(event.target.value))} /></label></div>
      <label><span>Optional maximum grants</span><input type="number" value={maxGrants} onChange={(event) => change(programRequestRef, () => setMaxGrants(event.target.value))} min={1} max={1_000_000} step={1} /></label>
      <p className="boundary-note">A new program is always saved as a draft. Activation is a separate reviewed action with its own confirmation and server-side prerequisites.</p>
      <label><span>Private audit reason</span><textarea value={programReason} onChange={(event) => change(programRequestRef, () => setProgramReason(event.target.value))} minLength={8} maxLength={1000} rows={3} required /></label>
      <label><span>Type <strong>CONFIGURE ECONOMIC ASSISTANCE PROGRAM</strong> exactly</span><input value={programConfirmation} onChange={(event) => setProgramConfirmation(event.target.value)} autoComplete="off" spellCheck={false} required /></label>
      <button className="button-primary" type="submit" disabled={!canConfigureProgram}>{busy === "program" ? "Recording draft..." : "Save draft assistance program"}</button>
    </form>
    <form className="auth-form economic-operation-form" onSubmit={changeProgramStatus} noValidate><h3>Change one assistance-program status</h3>
      {!statusPrograms.length ? <p className="boundary-note">No draft, active, or paused assistance program is present in the bounded queue. This does not prove no older or retired record exists.</p> : <label><span>Bounded non-retired program</span><select value={statusProgramId} onChange={(event) => change(programStatusRequestRef, () => { setStatusProgramId(event.target.value); setProgramTargetStatus(""); setProgramStatusConfirmation(""); })} required><option value="">Choose one</option>{statusPrograms.map((program) => <option key={program.programId} value={program.programId}>{program.programCode.replace(/_/g, " ")} · {program.scope.replace(/_/g, " ")} · {program.status}</option>)}</select></label>}
      <label><span>Reviewed next state</span><select value={programTargetStatus} onChange={(event) => change(programStatusRequestRef, () => { setProgramTargetStatus(event.target.value as EconomicAssistanceProgramTargetStatus | ""); setProgramStatusConfirmation(""); })} disabled={!selectedStatusProgram} required><option value="">Choose one</option>{availableProgramTargets.map((target) => <option key={target} value={target}>{target === "active" ? "Activate test program" : target === "paused" ? "Pause test program" : "Retire program"}</option>)}</select></label>
      <label><span>Private audit reason</span><textarea value={programStatusReason} onChange={(event) => change(programStatusRequestRef, () => setProgramStatusReason(event.target.value))} minLength={8} maxLength={1000} rows={3} required /></label>
      <label><span>Type <strong>{expectedProgramStatusConfirmation || "the status-specific confirmation shown after choosing a state"}</strong> exactly</span><input value={programStatusConfirmation} onChange={(event) => change(programStatusRequestRef, () => setProgramStatusConfirmation(event.target.value))} autoComplete="off" spellCheck={false} disabled={!programTargetStatus} required /></label>
      <button className={programTargetStatus === "retired" ? "button-danger" : "button-primary"} type="submit" disabled={!canSetProgramStatus}>{busy === "program-status" ? "Recording status transition..." : "Change assistance-program status"}</button>
    </form>
    <form className="auth-form economic-operation-form" onSubmit={issueGrant} noValidate><h3>Issue one private assistance grant</h3>
      <label><span>Active program code</span><input value={grantProgramCode} onChange={(event) => change(grantRequestRef, () => setGrantProgramCode(event.target.value))} maxLength={101} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Beneficiary Website Account UUID</span><input value={beneficiaryUserId} onChange={(event) => change(grantRequestRef, () => setBeneficiaryUserId(event.target.value))} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Optional Job Post or other scoped resource UUID</span><input value={resourceId} onChange={(event) => change(grantRequestRef, () => setResourceId(event.target.value))} autoComplete="off" spellCheck={false} /></label>
      <label><span>Optional sandbox service units</span><input type="number" value={grantUnits} onChange={(event) => change(grantRequestRef, () => setGrantUnits(event.target.value))} min={1} max={1_000_000_000} step={1} /><small>The active program scope determines whether a resource ID or service-unit amount is required. The server enforces it.</small></label>
      <label><span>Optional expiration</span><input type="datetime-local" value={grantExpiresAtLocal} onChange={(event) => change(grantRequestRef, () => setGrantExpiresAtLocal(event.target.value))} /></label>
      <fieldset><legend>Optional sponsored allocation</legend><p className="small-note">Supply both fields or neither. Allocation funding never identifies the beneficiary publicly or grants the sponsor control.</p><label><span>Allocation UUID</span><input value={sponsorshipAllocationId} onChange={(event) => change(grantRequestRef, () => setSponsorshipAllocationId(event.target.value))} autoComplete="off" spellCheck={false} /></label><label><span>Allocation consumption units</span><input type="number" value={allocationConsumption} onChange={(event) => change(grantRequestRef, () => setAllocationConsumption(event.target.value))} min={1} max={100_000_000_000} step={1} /></label></fieldset>
      <label><span>Private audit reason</span><textarea value={grantReason} onChange={(event) => change(grantRequestRef, () => setGrantReason(event.target.value))} minLength={8} maxLength={1000} rows={3} required /><small>Do not include bank, tax, medical, identity-document, or unnecessary financial-circumstance details.</small></label>
      <label><span>Type <strong>ISSUE ECONOMIC ASSISTANCE GRANT</strong> exactly</span><input value={grantConfirmation} onChange={(event) => setGrantConfirmation(event.target.value)} autoComplete="off" spellCheck={false} required /></label>
      <button className="button-primary" type="submit" disabled={!canIssueGrant}>{busy === "grant" ? "Issuing private grant..." : "Issue private assistance grant"}</button>
    </form>
    <form className="auth-form economic-operation-form" onSubmit={endGrant} noValidate><h3>End one unconsumed or sandbox grant</h3>
      {!endableGrants.length ? <p className="boundary-note">No unconsumed grant or consumed sandbox-credit grant is present in the bounded queue. This does not prove no older record exists.</p> : <label><span>Bounded endable grant</span><select value={endGrantId} onChange={(event) => change(endRequestRef, () => setEndGrantId(event.target.value))} required><option value="">Choose one</option>{endableGrants.map((grant) => <option key={grant.grantId} value={grant.grantId}>{grant.scope.replace(/_/g, " ")} · {grant.status} · {operatorWhen(grant.expiresAt)}</option>)}</select></label>}
      <label><span>Reviewed end state</span><select value={endAction} onChange={(event) => change(endRequestRef, () => setEndAction(event.target.value as "revoke" | "expire" | ""))} required><option value="">Choose one</option><option value="revoke">Revoke for a reviewed reason</option><option value="expire">Record expiration</option></select></label>
      <label><span>Private audit reason</span><textarea value={endReason} onChange={(event) => change(endRequestRef, () => setEndReason(event.target.value))} minLength={8} maxLength={1000} rows={3} required /></label>
      <label><span>Type <strong>END ECONOMIC ASSISTANCE GRANT</strong> exactly</span><input value={endConfirmation} onChange={(event) => setEndConfirmation(event.target.value)} autoComplete="off" spellCheck={false} required /></label>
      <button className="button-danger" type="submit" disabled={!canEndGrant}>{busy === "end" ? "Ending private grant..." : "End assistance grant"}</button>
      <p className="boundary-note">Consumed Job Post grants are deliberately excluded here because their linked economic condition must be reconciled atomically through the dedicated workflow below.</p>
    </form>
    {canReconcileJobPostAssistance ? <form className="auth-form economic-operation-form" onSubmit={reconcileJobPostGrant} noValidate><h3>Reconcile one consumed Job Post assistance grant</h3>
      {!consumedJobPostGrants.length ? <p className="boundary-note">No consumed Job Post assistance grant is present in the bounded queue. This does not prove no older record exists.</p> : <label><span>Bounded consumed Job Post grant</span><select value={jobReconciliationGrantId} onChange={(event) => change(jobReconciliationRequestRef, () => setJobReconciliationGrantId(event.target.value))} required><option value="">Choose one</option>{consumedJobPostGrants.map((grant) => <option key={grant.grantId} value={grant.grantId}>Job Post fee · consumed · {operatorWhen(grant.expiresAt)}</option>)}</select></label>}
      <label><span>Linked Job Post UUID</span><input value={jobReconciliationPostId} onChange={(event) => change(jobReconciliationRequestRef, () => setJobReconciliationPostId(event.target.value))} autoComplete="off" spellCheck={false} required /><small>The server requires this exact Job Post to be the grant's consumed resource and resets only its economic condition.</small></label>
      <label><span>Reviewed end state</span><select value={jobReconciliationAction} onChange={(event) => change(jobReconciliationRequestRef, () => setJobReconciliationAction(event.target.value as "revoke" | "expire" | ""))} required><option value="">Choose one</option><option value="revoke">Revoke and return economic condition to not assessed</option><option value="expire">Record expiration and return economic condition to not assessed</option></select></label>
      <label><span>Private audit reason</span><textarea value={jobReconciliationReason} onChange={(event) => change(jobReconciliationRequestRef, () => setJobReconciliationReason(event.target.value))} minLength={8} maxLength={1000} rows={3} required /></label>
      <label><span>Type <strong>RECONCILE AND END TEST JOB POST ASSISTANCE</strong> exactly</span><input value={jobReconciliationConfirmation} onChange={(event) => change(jobReconciliationRequestRef, () => setJobReconciliationConfirmation(event.target.value))} autoComplete="off" spellCheck={false} required /></label>
      <button className="button-danger" type="submit" disabled={!canReconcileJobPostGrant}>{busy === "job-reconciliation" ? "Reconciling consumed grant..." : "Reconcile consumed Job Post grant"}</button>
      <p className="boundary-note">This requires both economic-assistance and Job Post fee-assessment capabilities. It does not approve, reject, edit, or otherwise change content review authority.</p>
    </form> : consumedJobPostGrants.length ? <p className="boundary-note">Consumed Job Post grants require a separately authorized operator who holds both economic assistance management and Job Post fee-assessment capabilities.</p> : null}
    <p className="boundary-note">Assistance records, reasons, recipients, sponsorship allocation, and balances remain private. No assistance action creates a badge, public tier, donor rank, governance signal, or general community restriction.</p>
  </section>;
}

const economicRestrictionScopes: ReadonlyArray<{ value: EconomicServiceRestrictionScope; label: string }> = [
  { value: "billing", label: "New billing acquisition" }, { value: "recurring_support", label: "Recurring support management" },
  { value: "sandbox", label: "Online sandbox service" }, { value: "marketplace_buying", label: "Marketplace buying" },
  { value: "marketplace_selling", label: "Marketplace selling" }, { value: "job_posting", label: "Job Post economic service" }
];

function EconomicServiceRestrictionForm({ accessToken, onComplete }: { accessToken: string; onComplete: () => Promise<void> }) {
  const [enabled, setEnabled] = useState(true);
  const [targetUserId, setTargetUserId] = useState("");
  const [restrictionId, setRestrictionId] = useState("");
  const [scope, setScope] = useState<EconomicServiceRestrictionScope | "">("");
  const [reasonCode, setReasonCode] = useState("");
  const [expiresAtLocal, setExpiresAtLocal] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const requestIdRef = useRef("");
  const errorRef = useRef<HTMLDivElement>(null);
  const requiredConfirmation = enabled ? "IMPOSE SCOPED ECONOMIC RESTRICTION" : "LIFT SCOPED ECONOMIC RESTRICTION";
  const expirationValid = !expiresAtLocal || (enabled && Number.isFinite(new Date(expiresAtLocal).getTime()) && new Date(expiresAtLocal).getTime() > Date.now());
  const canSubmit = isBillingUuid(targetUserId) && (enabled ? !restrictionId : isBillingUuid(restrictionId)) && Boolean(scope)
    && /^[a-z][a-z0-9_]{2,100}$/.test(reasonCode) && expirationValid && validReason(reason) && confirmation === requiredConfirmation && !busy;

  function change(changeInput: () => void) {
    changeInput();
    requestIdRef.current = "";
    clearFeedback(setError, setStatus);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    clearFeedback(setError, setStatus);
    if (!scope || !canSubmit) {
      setError(`Choose one narrow service scope, enter the required internal UUIDs and reviewed reason code, provide a private audit reason, and type ${requiredConfirmation} exactly.`);
      focusError(errorRef);
      return;
    }
    setBusy(true);
    setStatus(`${enabled ? "Imposing" : "Lifting"} one scoped economic-service restriction...`);
    try {
      requestIdRef.current ||= createBillingClientRequestId();
      const result = await setEconomicOperatorServiceRestriction({
        clientRequestId: requestIdRef.current,
        targetUserId,
        restrictionId: enabled ? null : restrictionId,
        scope,
        reasonCode,
        expiresAt: expiresAtLocal ? new Date(expiresAtLocal).toISOString() : null,
        enabled,
        confirmation: requiredConfirmation,
        reason
      }, accessToken);
      setStatus(`${result.idempotentReplay ? "Existing audited action confirmed" : "Scoped economic restriction updated"}: ${result.scope.replace(/_/g, " ")} is ${result.active ? "restricted" : "available"}. Internal restriction ${result.restrictionId}. The Commons account and community standing are unaffected.`);
      requestIdRef.current = "";
      setConfirmation("");
      if (enabled) setRestrictionId(result.restrictionId);
      await onComplete();
    } catch (requestError) {
      setStatus("");
      setError(billingErrorMessage(requestError));
      focusError(errorRef);
    } finally {
      setBusy(false);
    }
  }

  return <section className="section-card economic-operation-card" aria-labelledby="economic-service-restriction-title">
    <p className="eyebrow">Capability: economic reconciliation manage</p>
    <h2 id="economic-service-restriction-title">Manage one scoped economic-service restriction</h2>
    <p>This can limit only a named economic service. It cannot ban a Website Account, hide a Commons Profile, restrict ordinary community participation, revoke badges or roles, lower trust, or alter moderation and governance.</p>
    <form className="auth-form economic-operation-form" onSubmit={submit} noValidate>
      <fieldset className="operator-choice-fieldset"><legend>Restriction action</legend><div className="button-row"><label className="checkbox-line"><input type="radio" name="economic-restriction-action" checked={enabled} onChange={() => change(() => { setEnabled(true); setRestrictionId(""); setConfirmation(""); })} /><span>Impose one narrow restriction</span></label><label className="checkbox-line"><input type="radio" name="economic-restriction-action" checked={!enabled} onChange={() => change(() => { setEnabled(false); setExpiresAtLocal(""); setConfirmation(""); })} /><span>Lift an existing restriction</span></label></div></fieldset>
      <label><span>Target Website Account UUID</span><input value={targetUserId} onChange={(event) => change(() => setTargetUserId(event.target.value))} autoComplete="off" spellCheck={false} required /></label>
      {!enabled && <label><span>Existing economic restriction UUID</span><input value={restrictionId} onChange={(event) => change(() => setRestrictionId(event.target.value))} autoComplete="off" spellCheck={false} required /><small>Use the internal ID recorded by the audited impose action. Never enter a provider, payment, or community-moderation identifier.</small></label>}
      <label><span>Narrow service scope</span><select value={scope} onChange={(event) => change(() => setScope(event.target.value as EconomicServiceRestrictionScope | ""))} required><option value="">Choose one service</option>{economicRestrictionScopes.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
      <label><span>Reviewed reason code</span><input value={reasonCode} onChange={(event) => change(() => setReasonCode(event.target.value))} maxLength={101} placeholder="economic_account_closed" autoComplete="off" spellCheck={false} required /><small>Lowercase letters, numbers, and underscores only. The private audit reason below provides context.</small></label>
      {enabled && <label><span>Optional automatic expiration</span><input type="datetime-local" value={expiresAtLocal} onChange={(event) => change(() => setExpiresAtLocal(event.target.value))} /></label>}
      <label><span>Private audit reason</span><textarea value={reason} onChange={(event) => change(() => setReason(event.target.value))} minLength={8} maxLength={1000} rows={4} required /></label>
      <label><span>Type <strong>{requiredConfirmation}</strong> exactly</span><input value={confirmation} onChange={(event) => { setConfirmation(event.target.value); clearFeedback(setError, setStatus); }} autoComplete="off" spellCheck={false} required /></label>
      <OperationFeedback error={error} status={status} errorRef={errorRef} />
      <button className={enabled ? "button-danger" : "button-primary"} type="submit" disabled={!canSubmit}>{busy ? "Recording scoped action..." : enabled ? "Impose economic-service restriction" : "Lift economic-service restriction"}</button>
    </form>
    <p className="boundary-note">Failed payments, refunds, disputes, and chargebacks do not justify a general community ban. Use only the minimum service-specific restriction supported by reviewed evidence, then lift it when its narrow reason no longer applies.</p>
  </section>;
}

function MarketplacePayoutPreparationForm({ accessToken, onComplete }: { accessToken: string; onComplete: () => Promise<void> }) {
  const [sellerAccountId, setSellerAccountId] = useState("");
  const [amountMinor, setAmountMinor] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const requestIdRef = useRef("");
  const errorRef = useRef<HTMLDivElement>(null);
  const numericAmount = Number(amountMinor);
  const amountValid = /^\d+$/.test(amountMinor) && Number.isSafeInteger(numericAmount) && numericAmount >= 1 && numericAmount <= 100_000_000_000;
  const canSubmit = isBillingUuid(sellerAccountId) && amountValid && validReason(reason) && confirmation === "PREPARE TEST MARKETPLACE PAYOUT" && !busy;

  function change(changeInput: () => void) {
    changeInput();
    requestIdRef.current = "";
    clearFeedback(setError, setStatus);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    clearFeedback(setError, setStatus);
    if (!canSubmit) {
      setError("Enter a valid internal seller-account UUID, a whole USD-cent amount within the private test payable balance, a private audit reason, and the exact typed confirmation.");
      focusError(errorRef);
      return;
    }
    setBusy(true);
    setStatus("Preparing a private test Marketplace payable accounting record...");
    try {
      requestIdRef.current ||= createBillingClientRequestId();
      const result = await prepareEconomicOperatorMarketplaceTestPayout({ sellerAccountId, clientRequestId: requestIdRef.current, amountMinor: numericAmount, currency: "usd", confirmation: "PREPARE TEST MARKETPLACE PAYOUT", reason }, accessToken);
      setStatus(`${result.idempotentReplay ? "Existing idempotent preparation confirmed" : "Private test payout preparation recorded"}: ${operatorMoney(result.amountMinor, result.currency)}. Provider execution is unavailable; no transfer, bank movement, seller payment, or live payout occurred.`);
      requestIdRef.current = "";
      setConfirmation("");
      await onComplete();
    } catch (requestError) {
      setStatus("");
      setError(billingErrorMessage(requestError));
      focusError(errorRef);
    } finally {
      setBusy(false);
    }
  }

  return <section className="section-card economic-operation-card" aria-labelledby="marketplace-payout-preparation-title">
    <p className="eyebrow">Capability: marketplace payout manage · test records only</p>
    <h2 id="marketplace-payout-preparation-title">Prepare one private Marketplace test payable</h2>
    <p>This creates a bounded internal preparation against an already-earned private test payable balance. It does not call Stripe Connect transfer or payout APIs, move funds, promise payment, expose bank or tax data, approve a seller or listing, or grant authority.</p>
    <form className="auth-form economic-operation-form" onSubmit={submit} noValidate>
      <label><span>Internal Marketplace seller-account UUID</span><input value={sellerAccountId} onChange={(event) => change(() => setSellerAccountId(event.target.value))} autoComplete="off" spellCheck={false} required /><small>Use the restricted Elysia seller-account record, never a Stripe account ID, email address, bank reference, tax identifier, or public profile field.</small></label>
      <label><span>Test payable amount in USD cents</span><input type="number" value={amountMinor} onChange={(event) => change(() => setAmountMinor(event.target.value))} min={1} max={100_000_000_000} step={1} inputMode="numeric" required /><small>The server recomputes available private test payable accounting and rejects any excess. This is not a live balance.</small></label>
      <label><span>Private audit reason</span><textarea value={reason} onChange={(event) => change(() => setReason(event.target.value))} minLength={8} maxLength={1000} rows={4} required /></label>
      <label><span>Type <strong>PREPARE TEST MARKETPLACE PAYOUT</strong> exactly</span><input value={confirmation} onChange={(event) => { setConfirmation(event.target.value); clearFeedback(setError, setStatus); }} autoComplete="off" spellCheck={false} required /></label>
      <OperationFeedback error={error} status={status} errorRef={errorRef} />
      <button className="button-primary" type="submit" disabled={!canSubmit}>{busy ? "Preparing private test record..." : "Prepare test payable record"}</button>
    </form>
    <p className="boundary-note">Live payouts remain disabled. Future execution requires completed EIN, business banking, Stripe live verification, tax and accounting review, live feature activation, and a separate audited provider-execution operation that does not exist here.</p>
  </section>;
}

function MarketplaceCommercialTermsForm({ accessToken, onComplete }: { accessToken: string; onComplete: () => Promise<void> }) {
  const [termsCode, setTermsCode] = useState("");
  const [commissionBps, setCommissionBps] = useState("");
  const [sellerAgreementVersion, setSellerAgreementVersion] = useState("");
  const [buyerTermsVersion, setBuyerTermsVersion] = useState("");
  const [activeState, setActiveState] = useState<"active" | "inactive" | "">("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const requestIdRef = useRef("");
  const errorRef = useRef<HTMLDivElement>(null);
  const validTermsCode = /^[a-z0-9][a-z0-9_:-]{2,116}$/.test(termsCode.trim());
  const validCommission = /^\d+$/.test(commissionBps) && Number(commissionBps) >= 0 && Number(commissionBps) <= 5_000;
  const validVersion = (value: string) => /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(value.trim());
  const canSubmit = validTermsCode && validCommission && validVersion(sellerAgreementVersion) && validVersion(buyerTermsVersion) && Boolean(activeState) && validReason(reason) && confirmation === "CONFIGURE MARKETPLACE TEST COMMERCIAL TERMS" && !busy;

  function change(changeInput: () => void) {
    changeInput();
    requestIdRef.current = "";
    clearFeedback(setError, setStatus);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !activeState) {
      setError("Complete the reviewed terms code, whole basis-point commission, both exact document versions, active state, private reason, and typed confirmation.");
      focusError(errorRef);
      return;
    }
    setBusy(true);
    setError("");
    setStatus("Recording a Marketplace test commercial-terms version…");
    requestIdRef.current ||= createBillingClientRequestId();
    try {
      const result = await configureEconomicOperatorMarketplaceTerms({ clientRequestId: requestIdRef.current, termsCode: termsCode.trim(), commissionBps: Number(commissionBps), sellerAgreementVersion: sellerAgreementVersion.trim(), buyerTermsVersion: buyerTermsVersion.trim(), active: activeState === "active", confirmation: "CONFIGURE MARKETPLACE TEST COMMERCIAL TERMS", reason }, accessToken);
      requestIdRef.current = "";
      setConfirmation("");
      setStatus(`Test terms ${result.termsCode} recorded as ${result.active ? "active" : "inactive"} with ${(result.commissionBps / 100).toFixed(2)}% commission. They are explicitly not approved for live use and no payout was executed.`);
      await onComplete();
    } catch (requestError) {
      setStatus("");
      setError(billingErrorMessage(requestError));
      focusError(errorRef);
    } finally {
      setBusy(false);
    }
  }

  return <section className="section-card economic-operation-card" aria-labelledby="marketplace-commercial-terms-title">
    <p className="eyebrow">Capability: marketplace payout manage</p>
    <h2 id="marketplace-commercial-terms-title">Version Marketplace test commercial terms</h2>
    <p>This records test-only seller/buyer document bindings and a disclosed commission. It does not approve a seller, publisher, add-on, payment, payout, ranking, download, or installation.</p>
    <form className="auth-form economic-operation-form" onSubmit={submit} noValidate>
      <label><span>Commercial terms code</span><input value={termsCode} onChange={(event) => change(() => setTermsCode(event.target.value))} maxLength={117} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Commission in basis points</span><input type="number" value={commissionBps} onChange={(event) => change(() => setCommissionBps(event.target.value))} min={0} max={5000} step={1} inputMode="numeric" required /><small>100 basis points = 1.00%. Maximum 5,000 = 50.00%.</small></label>
      <label><span>Seller agreement version</span><input value={sellerAgreementVersion} onChange={(event) => change(() => setSellerAgreementVersion(event.target.value))} maxLength={120} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Buyer terms version</span><input value={buyerTermsVersion} onChange={(event) => change(() => setBuyerTermsVersion(event.target.value))} maxLength={120} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Test terms state</span><select value={activeState} onChange={(event) => change(() => setActiveState(event.target.value as "active" | "inactive" | ""))} required><option value="">Choose one</option><option value="inactive">Inactive</option><option value="active">Active in test mode</option></select></label>
      <label><span>Private audit reason</span><textarea value={reason} onChange={(event) => change(() => setReason(event.target.value))} minLength={8} maxLength={1000} rows={4} required /></label>
      <label><span>Typed confirmation</span><input value={confirmation} onChange={(event) => { setConfirmation(event.target.value); clearFeedback(setError, setStatus); }} autoComplete="off" spellCheck={false} required /></label><p className="small-note">Type <code>CONFIGURE MARKETPLACE TEST COMMERCIAL TERMS</code> exactly.</p>
      <OperationFeedback error={error} status={status} errorRef={errorRef} />
      <button className="button-primary" type="submit" disabled={!canSubmit}>{busy ? "Recording test terms…" : "Record Marketplace test terms"}</button>
    </form>
    <p className="boundary-note">Real payouts remain disabled. Any future payout execution requires separate business verification, live-mode activation, accounting review, and a dedicated audited server operation; this browser has no payout-execution control.</p>
  </section>;
}

export default function EconomicOperationsPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const [overview, setOverview] = useState<EconomicOperatorOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    if (!accessToken) { setOverview(null); setLoading(false); return; }
    setLoading(true);
    try {
      setOverview(await loadEconomicOperatorOverview(accessToken));
      setMessage("");
    } catch (error) {
      setOverview(null);
      setMessage(billingErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const authorized = Boolean(overview?.authorized && overview.capabilities.length);
  const hasCapability = (capability: EconomicOperatorCapability) => Boolean(overview?.capabilities.includes(capability));
  const capabilitiesWithoutBrowserMutation = overview?.capabilities.filter((capability) => [
    "recurring_support_manage",
    "economic_feature_flags_manage"
  ].includes(capability)) ?? [];
  return <div className="page-stack economic-operations-page">
    <EconomicOperationsNavigation />
    <PageHero eyebrow="Private economic operations" title="Financial separation of duties" brandMark="standard"><p>This console is gated by explicit private economic capabilities. Community administrator, moderator, reviewer, Free Member, badge, developer, publisher, and stewardship status do not grant access.</p></PageHero>
    <section className="commons-doctrine-grid">
      <WarningCallout title="Not governance"><p>Economic operators cannot use this console to grant roles, badges, trust, publication approval, moderator power, or social standing.</p></WarningCallout>
      <WarningCallout title="No raw payment secrets"><p>Card, bank, KYC, tax, webhook-secret, and provider credential data must remain on restricted server/provider surfaces.</p></WarningCallout>
      <WarningCallout title="Audited correction"><p>Ledgers and audit records are append-only. Corrections require explicit compensating events, reasons, actors, and timestamps.</p></WarningCallout>
    </section>
    {(authLoading || loading) && <p className="inline-status" role="status" aria-live="polite">Checking private economic capabilities...</p>}
    {message && <p className="message" role="alert">{message}</p>}
    {!authLoading && !loading && !accessToken && <section className="section-card"><h2>Sign in required</h2><p>Sign in to the Website Account that has been explicitly assigned economic capabilities.</p><div className="button-row"><Link className="button-link button-link--primary" to="/commons-circle">Open Website Account sign in</Link><Link className="button-link" to="/account/forgot-password">Recover account access</Link></div></section>}
    {!authLoading && !loading && accessToken && !authorized && <section className="section-card"><h2>Economic capability required</h2><p>The private operator overview reports no active economic capability for this Website Account. Community administrator or reviewer status is intentionally insufficient.</p><div className="button-row"><Link className="button-link" to="/admin">Return to governance console</Link><Link className="button-link" to="/commons-circle/support-billing">Open personal Support &amp; Billing</Link></div></section>}
    {authorized && overview && accessToken && <>
      <section className="section-card"><div className="section-heading section-heading--inline"><div><p className="eyebrow">Assigned authority · test mode only</p><h2>Economic capabilities</h2></div><button type="button" onClick={() => void refresh()} disabled={loading}>Refresh private state</button></div><div className="economic-capability-grid">{overview.capabilities.map((capability) => <article className="economic-summary-card" key={capability}><strong>{capability.replace(/_/g, " ")}</strong><p>{capabilityDescriptions[capability]}</p></article>)}</div></section>
      <OperatorQueueOverview overview={overview} />
      {hasCapability("economic_audit_view") && <EconomicAuditPanel accessToken={accessToken} />}
      {hasCapability("accounting_export") && <EconomicAccountingExportForm accessToken={accessToken} />}
      <section className="feature-grid feature-grid--three">
        <article className="feature-card"><h3>Orders and reconciliation</h3><p>Server-authorized operations use internal order UUIDs. Browser state and redirects never establish payment truth.</p></article>
        <article className="feature-card"><h3>Credits and service conditions</h3><p>Sandbox credit adjustments remain separate from payment, operational access, content review, recognition, and governance.</p></article>
        <article className="feature-card"><h3>Capability isolation</h3><p>Each form appears only for its exact server-reported capability. One economic capability never implies another.</p></article>
      </section>
      {capabilitiesWithoutBrowserMutation.length > 0 && <section className="section-card"><p className="eyebrow">Read-only here</p><h2>Capabilities without a browser mutation</h2><p>Their strict bounded queues are displayed above when defined, but this console intentionally provides no mutation action for these assignments. Empty queues do not prove empty records and do not replace restricted server procedures.</p><div className="economic-capability-grid">{capabilitiesWithoutBrowserMutation.map((capability) => <article className="economic-summary-card" key={`read-only:${capability}`}><strong>{capability.replace(/_/g, " ")}</strong><p>{capabilityDescriptions[capability]}</p><p className="small-note">No browser mutation is available; no completed action is being claimed.</p></article>)}</div><p className="boundary-note">Never work around a missing mutation with direct table writes, community-admin APIs, raw provider dashboards, copied secrets, or profile fields.</p></section>}
      {hasCapability("economic_operator_assignments_manage") && <OperatorAssignmentForm accessToken={accessToken} onComplete={refresh} />}
      {hasCapability("sandbox_credits_adjust") && <SandboxCreditGrantForm accessToken={accessToken} onComplete={refresh} />}
      {hasCapability("economic_refunds_manage") && <RefundHoldForm accessToken={accessToken} refundablePayments={overview.refundablePaymentQueue ?? []} onComplete={refresh} />}
      {hasCapability("economic_refunds_manage") && <TestRefundExecutionForm accessToken={accessToken} onComplete={refresh} />}
      {hasCapability("economic_reconciliation_manage") && <ReconciliationForm accessToken={accessToken} onComplete={refresh} />}
      {hasCapability("economic_reconciliation_manage") && <EconomicServiceRestrictionForm accessToken={accessToken} onComplete={refresh} />}
      {hasCapability("economic_account_requests_manage") && <EconomicAccountRequestReviewForm accessToken={accessToken} overview={overview} onComplete={refresh} />}
      {hasCapability("economic_assistance_manage") && <EconomicAssistanceManagement accessToken={accessToken} overview={overview} onComplete={refresh} />}
      <EconomicOrganizationSponsorshipOperations accessToken={accessToken} canManageOrganizations={hasCapability("organization_billing_manage")} canManageSponsorships={hasCapability("sponsorship_manage")} canManageAssistance={hasCapability("economic_assistance_manage")} onComplete={refresh} />
      {hasCapability("job_fee_assess") && <JobPostEconomicAssessmentForm accessToken={accessToken} onComplete={refresh} />}
      {hasCapability("marketplace_payout_manage") && <MarketplaceCommercialTermsForm accessToken={accessToken} onComplete={refresh} />}
      {hasCapability("marketplace_payout_manage") && <MarketplacePayoutPreparationForm accessToken={accessToken} onComplete={refresh} />}
      <section className="section-card"><h2>Browser and bootstrap boundaries</h2><p>Only audited test-mode workflows backed by narrow operator endpoints are actionable here. Capability-filtered queue projections remain read-only unless their own reviewed mutation endpoint and deliberate form are present.</p><p className="boundary-note">Never use community role-management APIs, direct browser table writes, profile flags, or provider identifiers to perform financial operations. Economic-operator bootstrap remains an explicit server-side procedure and is not available here.</p></section>
    </>}
  </div>;
}
