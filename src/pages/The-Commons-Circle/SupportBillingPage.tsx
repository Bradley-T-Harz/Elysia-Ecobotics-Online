import { legalDocumentLink } from "../../shared/billing/legalDocumentLink";
import PaymentRecordCard from "../../shared/billing/PaymentRecordCard";
import { FundingLink } from "../../shared/billing/FundingExplanation";
import SupportPreparationPanel from "../../shared/economics/SupportPreparationPanel";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import StatusBadge from "../../shared/components/StatusBadge";
import WarningCallout from "../../shared/components/WarningCallout";
import CheckoutReturnStatus from "../../shared/billing/CheckoutReturnStatus";
import { billingErrorMessage, createBillingClientRequestId, createBillingPortal, loadBillingAccount, loadBillingCapabilities, loadEconomicClosureReadiness, loadEconomicOrganizationAccount, requestEconomicAccountAction, setSupportRecognitionPreference, type BillingAccountSummary, type BillingCapabilities, type BillingLegalDocumentVersions, type EconomicAccountRequestType, type EconomicClosureReadiness, type EconomicOrganizationAccount, type EconomicSupportRecognitionSummary } from "../../shared/billing/billingClient";
import { useAuth } from "../../shared/auth/useAuth";
import OrganizationSponsorshipAccountPanel from "./OrganizationSponsorshipAccountPanel";

function money(cents: number | null, currency = "USD") {
  if (cents === null) return "Amount private or unavailable";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function when(value: string | null) {
  if (!value) return "Not scheduled";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Date unavailable" : parsed.toLocaleString();
}

function EmptyPrivateState({ children }: { children: ReactNode }) {
  return <p className="commons-empty-state">{children}</p>;
}

function SupportRecognitionPreferencePanel({ accessToken, recognition, legalDocument, onComplete }: { accessToken: string; recognition: EconomicSupportRecognitionSummary | null; legalDocument: BillingLegalDocumentVersions["supportRecognition"] | null; onComplete: () => Promise<void> }) {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef("");
  const optedIn = recognition?.optedIn === true;
  const nextOptedIn = !optedIn;
  const requiredConfirmation = nextOptedIn ? "PUBLISH SUPPORT RECOGNITION" : "REMOVE SUPPORT RECOGNITION";
  const canOptIn = Boolean(recognition?.eligible && recognition.publicDisplayEnabled);
  const preferenceAvailable = Boolean(legalDocument && (optedIn || canOptIn));
  const canSubmit = preferenceAvailable && confirmation === requiredConfirmation && !busy;

  function changeConfirmation(value: string) {
    setConfirmation(value);
    requestIdRef.current = "";
    setStatus("");
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!legalDocument || !canSubmit) {
      setError("The canonical recognition terms, current eligibility, and exact typed confirmation are required before changing this preference.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setBusy(true);
    setStatus(nextOptedIn ? "Recording your optional public acknowledgment preference..." : "Removing your public acknowledgment preference...");
    setError("");
    try {
      requestIdRef.current ||= createBillingClientRequestId();
      const result = await setSupportRecognitionPreference({
        clientRequestId: requestIdRef.current,
        optedIn: nextOptedIn,
        consentVersion: legalDocument.version,
        confirmation: requiredConfirmation
      }, accessToken);
      setStatus(result.optedIn
        ? `${result.idempotentReplay ? "Existing preference confirmed" : "Public acknowledgment preference recorded"}. No amount, plan, provider, waiver, refund, dispute, badge, or authority is published.`
        : `${result.idempotentReplay ? "Existing private preference confirmed" : "Public acknowledgment removed"}. Financial activity remains private.`);
      requestIdRef.current = "";
      setConfirmation("");
      await onComplete();
    } catch (requestError) {
      setStatus("");
      setError(billingErrorMessage(requestError));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  }

  return <article className="section-card economic-room-card">
    <p className="eyebrow">Public recognition</p>
    <h2>Financial privacy first</h2>
    {recognition ? <dl className="mini-facts"><div><dt>Your preference</dt><dd>{optedIn ? "Opted in" : "Private"}</dd></div><div><dt>Eligible support record</dt><dd>{recognition.eligible ? "Yes" : "No"}</dd></div>{recognition.eligibilityRevokedAt && <div><dt>Eligibility withdrawn</dt><dd>{when(recognition.eligibilityRevokedAt)}</dd></div>}{recognition.eligibilityExpiresAt && <div><dt>Eligibility expires</dt><dd>{when(recognition.eligibilityExpiresAt)}</dd></div>}<div><dt>Database public-display eligibility</dt><dd>{recognition.publicDisplayEnabled ? "Eligible" : "Disabled"}</dd></div><div><dt>Amounts public</dt><dd>Never</dd></div><div><dt>Authority granted</dt><dd>None</dd></div></dl> : <EmptyPrivateState>No support-recognition preference is projected for this Website Account. This does not publish financial activity.</EmptyPrivateState>}
    <p className="small-note">Database eligibility does not prove current public display. An independent deployment kill switch may still keep acknowledgments off, and either layer may disable publication. Existing opt-out remains available.</p>
    <p>{canOptIn ? "Optional support recognition may publish only your chosen public display name in an unranked acknowledgment." : "A new public acknowledgment is unavailable. Payment records remain private and no supporter badge is granted automatically."}</p>
    {preferenceAvailable && <form className="auth-form economic-operation-form" onSubmit={submit} noValidate>
      <p>{optedIn ? "You may withdraw this acknowledgment even when new opt-ins or the public display are disabled." : "Publishing is optional. Choosing privacy has no effect on access, trust, roles, badges, reviews, or standing."}</p>
      <p>Review the <Link to={legalDocumentLink(legalDocument, "/legal/support-and-billing-terms")}>Support and Billing Terms</Link>{legalDocument ? ` version ${legalDocument.version}` : ""}.</p>
      <label><span>Type <strong>{requiredConfirmation}</strong> exactly</span><input value={confirmation} onChange={(event) => changeConfirmation(event.target.value)} autoComplete="off" spellCheck={false} required /></label>
      {error && <div className="validation validation--bad" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
      <p className="inline-status operator-live-region" role="status" aria-live="polite" aria-atomic="true">{status}</p>
      <button className={optedIn ? "button-danger" : "button-primary"} type="submit" disabled={!canSubmit}>{busy ? "Saving preference..." : optedIn ? "Remove public acknowledgment" : "Publish optional acknowledgment"}</button>
    </form>}
    {!legalDocument && <p className="boundary-note">The canonical recognition-terms version could not be verified, so this browser will not send a preference mutation. No existing preference is inferred to have changed.</p>}
    <p className="boundary-note">Existing stewardship recognition and contribution badges are not payment records and are not reused here. Amounts, plans, waivers, failures, refunds, disputes, and provider identifiers never appear in this acknowledgment.</p>
  </article>;
}

const closureBlockerLabels: Array<[keyof EconomicClosureReadiness, string]> = [
  ["activeSubscriptions", "Active subscriptions"], ["unsettledOrders", "Unsettled orders"], ["openRefunds", "Open refunds"],
  ["openDisputes", "Open disputes"], ["openReconciliationCases", "Open reconciliation cases"], ["pendingSellerPayouts", "Pending seller payouts"],
  ["sellerPayableObligations", "Seller payable obligations"], ["pendingMarketplaceFulfillment", "Pending Marketplace fulfillment"],
  ["pendingJobPostFulfillment", "Pending Job Post fulfillment"], ["organizationSignerDuties", "Organization signer duties"],
  ["sponsorshipSignerDuties", "Sponsorship signer duties"]
];

function EconomicLifecyclePanel({ accessToken, account, legalDocuments, enabled, onComplete }: { accessToken: string; account: BillingAccountSummary; legalDocuments: BillingLegalDocumentVersions | null; enabled: boolean; onComplete: () => Promise<void> }) {
  const [requestType, setRequestType] = useState<EconomicAccountRequestType | "">("");
  const [userNote, setUserNote] = useState("");
  const [retentionAcknowledged, setRetentionAcknowledged] = useState(false);
  const [authProfileAcknowledged, setAuthProfileAcknowledged] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [readiness, setReadiness] = useState(account.closureReadiness);
  const [busy, setBusy] = useState(false);
  const [checkingReadiness, setCheckingReadiness] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const requestIdRef = useRef("");
  const errorRef = useRef<HTMLDivElement>(null);
  const activeStatuses = new Set(["submitted", "identity_verification", "operator_review", "processing"]);
  const duplicateActiveRequest = requestType ? account.accountRequests.some((request) => request.requestType === requestType && activeStatuses.has(request.status)) : false;
  const requiredConfirmation = requestType === "data_export" ? "REQUEST ECONOMIC DATA EXPORT" : requestType === "economic_account_closure" ? "REQUEST ECONOMIC ACCOUNT CLOSURE" : "";
  const legalDocument = requestType === "data_export" ? legalDocuments?.dataExportRequest : requestType === "economic_account_closure" ? legalDocuments?.economicAccountClosureRequest : null;
  const canSubmit = Boolean(enabled && requestType && legalDocument && !duplicateActiveRequest && userNote.trim().length <= 1_000 && retentionAcknowledged && authProfileAcknowledged && confirmation === requiredConfirmation && !busy);

  useEffect(() => { setReadiness(account.closureReadiness); }, [account.closureReadiness]);

  function changeIntent(change: () => void) {
    change();
    requestIdRef.current = "";
    setStatus("");
    setError("");
  }

  async function verifyReadiness() {
    if (checkingReadiness) return;
    setCheckingReadiness(true);
    setStatus("Checking the latest economic-only closure blockers...");
    setError("");
    try {
      setReadiness(await loadEconomicClosureReadiness(accessToken));
      setStatus("Latest economic closure readiness verified. Website Auth/Profile, earned licenses, remaining sandbox credits, and retained financial records remain separate.");
    } catch (requestError) {
      setStatus("");
      setError(billingErrorMessage(requestError));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setCheckingReadiness(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!requestType || !legalDocument || !canSubmit) {
      setError("Choose one request, review its canonical policy, acknowledge both boundaries, and type the exact confirmation. A second active request of the same kind is not sent.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setBusy(true);
    setStatus("Submitting a private economic lifecycle request...");
    setError("");
    try {
      requestIdRef.current ||= createBillingClientRequestId();
      const result = await requestEconomicAccountAction({
        clientRequestId: requestIdRef.current,
        requestType,
        consentVersion: legalDocument.version,
        userNote,
        acknowledgeFinancialRecordsRetained: true,
        acknowledgeAuthProfileUnchanged: true,
        confirmation: requiredConfirmation as "REQUEST ECONOMIC DATA EXPORT" | "REQUEST ECONOMIC ACCOUNT CLOSURE"
      }, accessToken);
      if (result.closureReadiness) setReadiness(result.closureReadiness);
      setStatus(`${result.idempotentReplay ? "Existing request confirmed" : "Request submitted"}: ${result.requestType === "data_export" ? "economic data export" : "economic account closure"} is ${result.status.replace(/_/g, " ")}. This does not delete or change Website Auth/Profile, community identity, badges, roles, content, or governance.`);
      requestIdRef.current = "";
      setConfirmation("");
      await onComplete();
    } catch (requestError) {
      setStatus("");
      setError(billingErrorMessage(requestError));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  }

  return <article className="section-card economic-room-card">
    <p className="eyebrow">Economic lifecycle</p>
    <h2>Export and closure requests</h2>
    {!enabled && <p className="boundary-note">New economic export and closure requests are disabled until the assisted private handling process is reviewed. Existing request history and closure-readiness information remain visible; this form will not collect an unusable request.</p>}
    {!account.accountRequests.length && <EmptyPrivateState>No economic data-export or economic-account-closure request is recorded for this Website Account.</EmptyPrivateState>}
    {account.accountRequests.map((request) => <div className="economic-summary-card" key={request.requestId}><div className="addon-card__topline"><strong>{request.requestType === "data_export" ? "Economic data export" : "Economic account closure"}</strong><StatusBadge label={request.status.replace(/_/g, " ")} tone={request.status === "completed" ? "safe" : request.status === "rejected" || request.status === "canceled" ? "warning" : "neutral"} /></div><p>Submitted {when(request.submittedAt)}</p><p className="small-note">Financial records retained: yes · Website Auth/Profile unchanged: yes{request.providerCancellationRequired ? " · Provider cancellation coordination required" : ""}</p></div>)}
    <div className="confirmation-panel">
      <div className="addon-card__topline"><strong>Economic closure readiness</strong><StatusBadge label={readiness.canComplete ? "no current blockers" : `${readiness.blockingCount} blocker${readiness.blockingCount === 1 ? "" : "s"}`} tone={readiness.canComplete ? "safe" : "warning"} /></div>
      {readiness.scheduledSubscriptionCancellations > 0 && <p>{readiness.scheduledSubscriptionCancellations} recurring-support cancellation{readiness.scheduledSubscriptionCancellations === 1 ? " is" : "s are"} already scheduled. This is informational and not counted twice as a blocker.</p>}
      {!readiness.canComplete && <dl className="mini-facts">{closureBlockerLabels.flatMap(([key, label]) => typeof readiness[key] === "number" && readiness[key] > 0 ? [<div key={key}><dt>{label}</dt><dd>{readiness[key] as number}</dd></div>] : [])}</dl>}
      <ul>{readiness.guidance.map((item) => <li key={item}>{item}</li>)}</ul>
      <p className="small-note">Earned licenses preserved: yes · remaining sandbox credits preserved: yes · restricted financial records retained: yes · Website Auth/Profile unchanged: yes.</p>
      <button type="button" onClick={() => void verifyReadiness()} disabled={checkingReadiness || busy}>{checkingReadiness ? "Checking readiness..." : "Refresh closure readiness"}</button>
    </div>
    <form className="auth-form economic-operation-form" onSubmit={submit} noValidate>
      <fieldset disabled={!enabled}>
      <label><span>Private lifecycle request</span><select value={requestType} onChange={(event) => changeIntent(() => { setRequestType(event.target.value as EconomicAccountRequestType | ""); setConfirmation(""); setRetentionAcknowledged(false); setAuthProfileAcknowledged(false); })} required><option value="">Choose one request</option><option value="data_export">Request economic data export</option><option value="economic_account_closure">Request economic account closure</option></select></label>
      <p className="small-note">An economic data-export choice creates an assisted private request only. It does not generate an immediate browser download; an approved access-controlled artifact and delivery process must be arranged separately before this feature is enabled.</p>
      {duplicateActiveRequest && <p className="boundary-note" role="status">An active request of this kind is already recorded. This browser will not submit a duplicate; review the history above or contact private billing support.</p>}
      {requestType && legalDocument && <p>Review the <Link to={legalDocumentLink(legalDocument, "/legal")}>{requestType === "data_export" ? "Privacy Policy" : "Account Closure and Financial Retention Policy"}</Link> version {legalDocument.version}.</p>}
      {requestType && !legalDocument && <p className="boundary-note">The canonical policy version is unavailable, so this browser will not submit this lifecycle request.</p>}
      <label><span>Optional private note</span><textarea value={userNote} onChange={(event) => changeIntent(() => setUserNote(event.target.value))} maxLength={1000} rows={4} aria-describedby="economic-lifecycle-note-help" /></label><p className="small-note" id="economic-lifecycle-note-help">Up to 1,000 characters. Do not include card, bank, tax, password, identity-document, medical, local Elysia, or provider-secret data.</p>
      <label className="checkbox-line"><input type="checkbox" checked={retentionAcknowledged} onChange={(event) => changeIntent(() => setRetentionAcknowledged(event.target.checked))} /><span>I understand minimum accounting, tax, consent, refund, dispute, fraud-prevention, security, and audit records may remain under restricted retention.</span></label>
      <label className="checkbox-line"><input type="checkbox" checked={authProfileAcknowledged} onChange={(event) => changeIntent(() => setAuthProfileAcknowledged(event.target.checked))} /><span>I understand this request does not delete, deactivate, or alter my Website Auth user, Commons Profile, public content, badges, roles, recognition, or governance state.</span></label>
      {requestType && <label><span>Type <strong>{requiredConfirmation}</strong> exactly</span><input value={confirmation} onChange={(event) => changeIntent(() => setConfirmation(event.target.value))} autoComplete="off" spellCheck={false} required /></label>}
      {error && <div className="validation validation--bad" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
      <p className="inline-status operator-live-region" role="status" aria-live="polite" aria-atomic="true">{status}</p>
      <button className={requestType === "economic_account_closure" ? "button-danger" : "button-primary"} type="submit" disabled={!canSubmit}>{busy ? "Submitting request..." : requestType === "economic_account_closure" ? "Request economic-only closure" : "Request economic data export"}</button>
      </fieldset>
    </form>
    <p className="boundary-note">Submitting closure may begin coordination while blockers exist, but completion cannot be represented until subscriptions, refunds, disputes, reconciliation, fulfillment, seller obligations, payouts, and signer duties are resolved. This is never a general Website Account deletion.</p>
  </article>;
}

export default function SupportBillingPage() {
  const [searchParams] = useSearchParams();
  const { accessToken, email, loading: authLoading } = useAuth();
  const [capabilities, setCapabilities] = useState<BillingCapabilities | null>(null);
  const [account, setAccount] = useState<BillingAccountSummary | null>(null);
  const [organizationAccount, setOrganizationAccount] = useState<EconomicOrganizationAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<string[]>([]);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const featureResult = await loadBillingCapabilities()
      .then((value) => ({ value, failed: false as const }))
      .catch(() => ({ value: null, failed: true as const }));
    const featureState = featureResult.value;
    const availabilityWarnings = featureResult.failed
      ? ["Billing capability and legal-version availability could not be verified. Mutating controls remain safely disabled; no absence of account records should be inferred."]
      : [];
    setCapabilities(featureState);
    if (!accessToken) {
      setAccount(null);
      setOrganizationAccount(null);
      setMessages(availabilityWarnings);
      setLoading(false);
      return;
    }
    try {
      const [summary, organizationSummary] = await Promise.all([
        loadBillingAccount(accessToken),
        loadEconomicOrganizationAccount(accessToken).catch(() => null)
      ]);
      setAccount(summary);
      setOrganizationAccount(organizationSummary);
      setMessages([...availabilityWarnings, ...summary.warnings]);
    } catch (error) {
      setAccount(null);
      setOrganizationAccount(null);
      setMessages([...availabilityWarnings, billingErrorMessage(error)]);
    }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function openPortal() {
    if (!accessToken || !capabilities?.customerPortal) return;
    setActionBusy("portal");
    try {
      const result = await createBillingPortal(accessToken);
      if (!result.url) throw new Error(result.message);
      window.location.assign(result.url);
    } catch (error) {
      setMessages([error instanceof Error && error.message.includes("safe provider-hosted") ? error.message : billingErrorMessage(error)]);
      setActionBusy(null);
    }
  }

  async function cancelRecurring() {
    if (!accessToken || !capabilities?.customerPortal || !cancelConfirm) return;
    setCancelConfirm(false);
    await openPortal();
  }

  const checkoutReturn = ([
    ["sandbox-payment", "sandbox_credits", "sandbox service", "Verified payment and the separate sandbox-credit ledger must both complete before service units exist; safety privileges never change."],
    ["organization-payment", "organization_service", "organization service", "Verified payment does not activate a service, affiliation, or authority; the separate reviewed engagement state decides."],
    ["sponsorship-payment", "sponsorship", "ethical sponsorship", "Verified payment does not publish recognition, imply endorsement, or grant authority; separate ethical and recognition review still applies."]
  ] as const).map(([parameter, expectedFlow, serviceLabel, boundary]) => ({
    state: searchParams.get(parameter), expectedFlow, serviceLabel, boundary
  })).find((item) => item.state === "complete" || item.state === "canceled");

  return <div className="page-stack commons-circle-page commons-support-billing-page">
    <PageHero eyebrow="Commons Circle" title="Support & Billing" brandMark="standard"><p>Your private account room for account-linked support and recurring-support management, with clearly labeled availability and dedicated private paths for receipts, service credits, Marketplace licenses, Job Post fees, and seller readiness.</p><p>This is not an upgrade-membership page. Payment does not alter Free Member recognition, badges, roles, moderation authority, developer approval, publisher identity, or governance.</p></PageHero>
    <div className="button-row"><FundingLink /></div>
    <SupportPreparationPanel />
    <section className="commons-doctrine-grid">
      <WarningCallout title="Private financial room"><p>Amounts, balances, payment failures, waivers, refunds, disputes, and seller income never belong on a public profile.</p></WarningCallout>
      <WarningCallout title="No pay-to-govern"><p>Economic entitlements are narrow service rights. They do not purchase trust, authority, review outcomes, rankings, or control of the Commons.</p></WarningCallout>
      <WarningCallout title="Stripe is a payment rail"><p>Stripe may host checkout, billing management, and seller onboarding. It does not receive local Elysia memory, files, conversations, or sandbox source code from this room.</p></WarningCallout>
    </section>

    {accessToken && checkoutReturn && <CheckoutReturnStatus
      accessToken={accessToken}
      orderReference={searchParams.get("order") ?? ""}
      returnState={checkoutReturn.state as "complete" | "canceled"}
      expectedFlow={checkoutReturn.expectedFlow}
      serviceLabel={checkoutReturn.serviceLabel}
      boundary={checkoutReturn.boundary}
      onRefresh={refresh}
    />}

    <section className="section-card">
      <div className="section-heading section-heading--inline"><div><p className="eyebrow">Website Account</p><h2>Private account access</h2></div><Link className="button-link" to="/commons-circle">Back to Commons Circle</Link></div>
      {authLoading || loading ? <p className="inline-status" aria-live="polite">Loading private billing availability...</p> : accessToken ? <p className="inline-status">Signed in as {email ?? "Website Account member"}. Private summaries are loaded through billing APIs, not from public profile fields; every section says when this overview does not project its records.</p> : <div className="member-gate"><p>Sign in through Commons Circle to view account-linked support and recurring-support management, plus the available private status and dedicated paths for other economic records.</p><div className="button-row"><Link className="button-link button-link--primary" to="/commons-circle">Sign in through Commons Circle</Link><Link className="button-link" to="/account/forgot-password">Recover account access</Link><Link className="button-link" to="/support">Continue with guest one-time support</Link></div></div>}
      {capabilities && <div className="button-row"><StatusBadge label={capabilities.mode === "test" ? "Stripe test mode" : capabilities.mode === "live" ? "Live mode" : "Billing disabled"} tone={capabilities.available ? "safe" : "warning"} /><span className="small-note">{capabilities.message}</span></div>}
    </section>

    {messages.length > 0 && <section className="message-stack" aria-live="polite">{messages.map((message, index) => <div className="message" key={`${message}-${index}`}>{message}</div>)}</section>}

    {accessToken && account && (account.subscription?.status === "past due" || account.subscription?.status === "grace period" || account.subscription?.status === "incomplete" || account.contributions.some((item) => item.status === "failed" || item.status === "payment failed")) && <section className="section-card economic-room-card" aria-live="polite">
      <p className="eyebrow">Payment needs attention</p>
      <h2>Private billing guidance</h2>
      <p>A provider-confirmed recurring-support or checkout state needs attention. It affects only that economic flow: it does not ban the Website Account, remove the Commons Profile, change badges or roles, lower trust, or block ordinary free community participation.</p>
      <div className="button-row">{capabilities?.customerPortal && <button type="button" disabled={actionBusy !== null} onClick={() => void openPortal()}>{actionBusy === "portal" ? "Opening portal..." : "Review billing in Stripe"}</button>}<a className="button-link" href="mailto:support@elysiaecobotics.com?subject=Private%20test-mode%20billing%20help">Contact private billing support</a></div>
      <p className="boundary-note">Do not email card, bank, tax, identity, password, or full provider-transaction details. A public Elysia order reference and a short description are enough to begin review. Retrying a checkout does not repair an existing recurring-support state.</p>
    </section>}

    {accessToken && account && <>
      <section className="section-card economic-room-card">
        <div className="section-heading section-heading--inline"><div><p className="eyebrow">Voluntary support</p><h2>Support Elysia</h2></div><Link className="button-link button-link--primary" to="/support">Start another support checkout</Link></div>
        <p>Support sustains development and infrastructure. It remains separate from membership, badges, stewardship recognition, and community authority.</p>
        {account.subscription ? <article className="economic-summary-card">
          <div className="addon-card__topline"><strong>{account.subscription.label}</strong><StatusBadge label={account.subscription.status} tone={account.subscription.status.includes("past") ? "warning" : "safe"} /></div>
          <dl className="mini-facts"><div><dt>Amount</dt><dd>{money(account.subscription.amountCents, account.subscription.currency)} / month</dd></div><div><dt>Next renewal</dt><dd>{when(account.subscription.nextRenewalAt)}</dd></div><div><dt>Cancellation</dt><dd>{account.subscription.cancelAtPeriodEnd ? "Scheduled at period end" : "Not scheduled"}</dd></div></dl>
          <div className="button-row">
            {capabilities?.customerPortal && <button type="button" disabled={actionBusy !== null} onClick={() => void openPortal()}>{actionBusy === "portal" ? "Opening portal..." : "Manage billing in Stripe"}</button>}
            {capabilities?.customerPortal && !account.subscription.cancelAtPeriodEnd && !cancelConfirm && <button type="button" disabled={actionBusy !== null} onClick={() => setCancelConfirm(true)}>Cancel recurring support</button>}
            {!capabilities?.customerPortal && !account.subscription.cancelAtPeriodEnd && <a className="button-link button-link--primary" href="mailto:support@elysiaecobotics.com?subject=Private%20recurring-support%20cancellation%20request">Request private cancellation help</a>}
          </div>
          {!capabilities?.customerPortal && !account.subscription.cancelAtPeriodEnd && <p className="boundary-note">The self-service Stripe portal is temporarily unavailable, but cancellation is not hidden. Email private billing support with only your Elysia public order reference and request to stop renewal; never send card, bank, password, tax, identity, or full Stripe details.</p>}
          {cancelConfirm && <div className="confirmation-panel" role="group" aria-label="Continue to recurring support cancellation"><p>Open Stripe's secure Customer Portal to cancel renewal? The portal will show the effective date before confirmation. Cancellation does not remove your profile, content, Free Member recognition, existing badges, purchases, or community standing.</p><div className="button-row"><button type="button" className="button-danger" disabled={actionBusy !== null} onClick={() => void cancelRecurring()}>Continue to cancellation</button><button type="button" disabled={actionBusy !== null} onClick={() => setCancelConfirm(false)}>Keep recurring support</button></div></div>}
        </article> : <EmptyPrivateState>No recurring support is connected to this Website Account. One-time support remains optional, and monthly support appears only when explicitly chosen and enabled.</EmptyPrivateState>}
      </section>

      <section className="two-column">
        <article className="section-card economic-room-card"><p className="eyebrow">One-time support</p><h2>Private history</h2>{!account.contributions.length && <EmptyPrivateState>No account-linked support history is available. Guest support is not linked automatically by email.</EmptyPrivateState>}{account.contributions.map((item) => <div className="economic-summary-card" key={item.id}><div className="addon-card__topline"><strong>{money(item.amountCents, item.currency)}</strong><span>{item.status}</span></div><p>{item.cadence === "monthly" ? "Recurring support event" : "One-time support"} · {when(item.createdAt)}</p></div>)}</article>
        <article className="section-card economic-room-card"><p className="eyebrow">Receipts</p><h2>Private transaction summaries</h2>{!account.projectionCoverage.receipts ? <EmptyPrivateState>The current private account summary does not include receipt projections. This does not mean no receipt exists. Provider email delivery depends on its settings and is not confirmed here.</EmptyPrivateState> : !account.receipts.length && <EmptyPrivateState>No private transaction summaries are connected to this Website Account. Stripe may send a receipt to the checkout email.</EmptyPrivateState>}{account.receipts.map((receipt) => <PaymentRecordCard key={receipt.id} receipt={receipt} />)}<p className="small-note">Use only the Elysia reference when asking about a payment, refund, or dispute. Never email card, bank, identity, tax, password, or full Stripe identifiers.</p></article>
      </section>

      <section className="section-card economic-room-card"><p className="eyebrow">Hosted execution</p><h2>Allowance has its own account page</h2><p>Hosted execution is finite service-use infrastructure, separate from voluntary support and billing. Review the authoritative remaining percentage, reservations, and private usage receipts in Account &amp; Profile Settings.</p><div className="button-row"><Link className="button-link button-link--primary" to="/commons-circle/settings/hosted-execution">View Hosted Execution Allowance</Link></div><p className="boundary-note">Additional paid hosted execution is unavailable pending the separate payment-system decision. Local Elysia computation is unaffected.</p></section>

      <section className="two-column">
        <article className="section-card economic-room-card"><p className="eyebrow">Marketplace</p><h2>Purchase summaries</h2>{!account.projectionCoverage.marketplacePurchases ? <EmptyPrivateState>The support-account summary does not include Marketplace licenses. This does not mean no license exists; view the <Link to="/marketplace/account">Marketplace Account</Link> for the dedicated private record.</EmptyPrivateState> : !account.marketplacePurchases.length && <EmptyPrivateState>No commercial Marketplace purchases are connected to this Website Account. Free add-ons remain separate.</EmptyPrivateState>}{account.marketplacePurchases.map((item) => <div className="economic-summary-card" key={item.id}><strong>{item.label}</strong><p>{item.status} · {when(item.purchasedAt)}</p></div>)}<p className="boundary-note">A purchase never approves, verifies, publishes, downloads, or installs an add-on. Local Elysia retains installation authority.</p></article>
        <article className="section-card economic-room-card"><p className="eyebrow">Job Posts</p><h2>Payment conditions</h2>{!account.projectionCoverage.jobPostPayments ? <EmptyPrivateState>The current private account summary does not include Job Post fee projections. No conclusion about whether a fee record exists is being made here.</EmptyPrivateState> : !account.jobPostPayments.length && <EmptyPrivateState>No Job Post fee records are connected to this Website Account.</EmptyPrivateState>}{account.jobPostPayments.map((item) => <div className="economic-summary-card" key={item.id}><strong>{item.label}</strong><p>{item.status} · {when(item.updatedAt)}</p></div>)}<p className="boundary-note">Payment cannot approve a listing or bypass anti-scam review.</p></article>
      </section>

      {account.seller?.summaryAvailable && <section className="section-card economic-room-card"><div className="section-heading section-heading--inline"><div><p className="eyebrow">Eligible creator finance</p><h2>Seller readiness</h2></div><StatusBadge label={account.seller.status} tone={account.seller.eligible ? "safe" : "warning"} /></div><p>Seller finance is distinct from developer status, publisher identity, listing review, and local installation trust.</p><dl className="mini-facts"><div><dt>Seller eligible</dt><dd>{account.seller.eligible ? "Yes" : "No"}</dd></div><div><dt>Test onboarding</dt><dd>{account.seller.onboardingAvailable ? "Available" : "Unavailable"}</dd></div><div><dt>Provider test readiness</dt><dd>{account.seller.payoutsEnabled ? "Provider reports ready" : "Not ready"}</dd></div><div><dt>Payout preparation</dt><dd>{account.seller.payoutPreparationEnabled ? "Private test preparation enabled" : "Disabled"}</dd></div><div><dt>Payout execution</dt><dd>{account.seller.payoutExecutionAvailable ? "Available" : "Unavailable"}</dd></div></dl>{Object.keys(account.seller.payableByCurrency).length > 0 && <div className="economic-summary-card"><strong>Private test payable accounting</strong>{Object.entries(account.seller.payableByCurrency).map(([currency, amount]) => <p key={currency}>{money(amount, currency)} test accounting state</p>)}<p className="small-note">These are private test records, not live funds, a payout promise, or seller income visible to other members.</p></div>}{capabilities?.sellerOnboarding && account.seller.onboardingAvailable && <Link className="button-link" to="/marketplace/account">Review seller terms and onboarding</Link>}<p className="boundary-note">Seller onboarding requires separate, explicit Marketplace seller-agreement and Stripe Connect disclosures on the Marketplace Account page. Identity, bank, and tax details belong on the provider-hosted surface—not Commons profiles or Commune posts. Payout execution and real payouts remain unavailable.</p></section>}

      <section className="two-column">
        <OrganizationSponsorshipAccountPanel account={organizationAccount} accessToken={accessToken} capabilities={capabilities} onComplete={refresh} />
        <article className="section-card economic-room-card">
          <p className="eyebrow">Assistance and access</p>
          <h2>Waivers and subsidies are legitimate</h2>
          <p>Free, sponsored, waived, and subsidized access are ordinary ways to keep scarce online services available without making wealth a measure of dignity or participation.</p>
          {!account.assistance.length && <EmptyPrivateState>No active or historical economic-assistance summary is connected to this Website Account.</EmptyPrivateState>}
          {account.assistance.map((assistance, index) => <div className="economic-summary-card" key={`${assistance.scope}:${assistance.status}:${assistance.expiresAt ?? "open"}:${index}`}><div className="addon-card__topline"><strong>{assistance.scope.replace(/_/g, " ")}</strong><StatusBadge label={assistance.status.replace(/_/g, " ")} tone={assistance.status === "granted" || assistance.status === "active" ? "safe" : "neutral"} /></div><p>{assistance.expiresAt ? `Expires ${when(assistance.expiresAt)}` : "No expiration is projected."}</p><p className="small-note">Publicly visible: never.</p></div>)}
          <p className="boundary-note">Assistance status, reasons, program eligibility, balances, and financial circumstances are private. They never appear on a Commons Profile, badge, public sponsor list, Commune post, or governance role.</p>
          <p>There is no public self-service assistance application on this page yet. For a genuine access need, email <a href="mailto:support@elysiaecobotics.com?subject=Private%20access%20assistance%20inquiry">support@elysiaecobotics.com</a> with only the minimum information needed; never send bank, card, tax, medical, or identity documents by ordinary email.</p>
        </article>
      </section>

      <section className="section-card economic-room-card">
        <p className="eyebrow">Narrow service boundaries</p>
        <h2>Scoped economic restrictions</h2>
        {!account.activeRestrictions.length ? <EmptyPrivateState>No active economic-service restriction is projected for this Website Account.</EmptyPrivateState> : account.activeRestrictions.map((restriction, index) => <div className="economic-summary-card" key={`${restriction.scope}:${restriction.reasonCode}:${restriction.expiresAt ?? "open"}:${index}`}><div className="addon-card__topline"><strong>{restriction.scope.replace(/_/g, " ")}</strong><StatusBadge label="service restricted" tone="warning" /></div><p>Reason code: {restriction.reasonCode.replace(/_/g, " ")}</p><p>{restriction.expiresAt ? `Scheduled through ${when(restriction.expiresAt)}` : "No automatic end date is projected."}</p></div>)}
        <p className="boundary-note">A failed payment, refund, dispute, or chargeback may affect only a specifically named economic service. It cannot become a general community ban, erase a Commons Profile, revoke unrelated content or badges, change governance roles, or lower a person's dignity.</p>
      </section>

      <section className="two-column">
        <SupportRecognitionPreferencePanel accessToken={accessToken} recognition={account.recognition} legalDocument={capabilities?.legalDocumentVersions?.supportRecognition ?? null} onComplete={refresh} />
        <EconomicLifecyclePanel accessToken={accessToken} account={account} legalDocuments={capabilities?.legalDocumentVersions ?? null} enabled={capabilities?.accountLifecycle === true} onComplete={refresh} />
      </section>
    </>}
  </div>;
}
