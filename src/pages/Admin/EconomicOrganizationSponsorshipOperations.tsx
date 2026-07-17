import { useRef, useState, type FormEvent } from "react";
import {
  billingErrorMessage,
  closeEconomicOperatorSponsorshipAllocation,
  createBillingClientRequestId,
  createEconomicOperatorOrganization,
  createEconomicOperatorOrganizationService,
  createEconomicOperatorSponsorshipAgreement,
  createEconomicOperatorSponsorshipAllocation,
  isBillingUuid,
  operatorOrganizationServiceReviewConfirmations,
  operatorSponsorshipReviewConfirmations,
  reviewEconomicOperatorOrganizationService,
  reviewEconomicOperatorSponsorship,
  setEconomicOperatorOrganizationMembership,
  setEconomicOperatorSponsorshipRecognition,
  type OperatorOrganizationRelationship,
  type OperatorOrganizationServiceReviewAction,
  type OperatorSponsorshipAllocationKind,
  type OperatorSponsorshipReviewAction
} from "../../shared/billing/billingClient";

type OperationProps = { accessToken: string; onComplete: () => Promise<void> };

function validReason(value: string) {
  const trimmed = value.trim();
  return trimmed.length >= 8 && trimmed.length <= 1_000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(trimmed);
}

function validCode(value: string, maximum = 120) {
  return value.length <= maximum && /^[a-z][a-z0-9_]{2,120}$/.test(value);
}

function validVersion(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._:+-]{0,119}$/.test(value);
}

function validOptionalText(value: string, minimum: number, maximum: number) {
  if (!value) return true;
  const trimmed = value.trim();
  return trimmed.length >= minimum && trimmed.length <= maximum && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(trimmed);
}

function validLocalTimestamp(value: string) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp >= Date.UTC(2020, 0, 1) && timestamp <= Date.now() + Math.floor(10 * 365.25 * 24 * 60 * 60 * 1_000);
}

function usePrivateOperation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef("");
  function changed(change: () => void) {
    change();
    requestIdRef.current = "";
    setError("");
    setStatus("");
  }
  function requestId() {
    requestIdRef.current ||= createBillingClientRequestId();
    return requestIdRef.current;
  }
  function start(message: string) { setBusy(true); setError(""); setStatus(message); }
  function succeed(message: string) { requestIdRef.current = ""; setError(""); setStatus(message); }
  function fail(error: unknown) { setStatus(""); setError(billingErrorMessage(error)); requestAnimationFrame(() => errorRef.current?.focus()); }
  function invalid(message: string) { setStatus(""); setError(message); requestAnimationFrame(() => errorRef.current?.focus()); }
  return { busy, setBusy, error, status, errorRef, changed, requestId, start, succeed, fail, invalid };
}

function Feedback({ operation }: { operation: ReturnType<typeof usePrivateOperation> }) {
  return <>
    {operation.error && <div className="validation validation--bad" role="alert" tabIndex={-1} ref={operation.errorRef}>{operation.error}</div>}
    <p className="inline-status operator-live-region" role="status" aria-live="polite" aria-atomic="true">{operation.status}</p>
  </>;
}

function CreateOrganizationForm({ accessToken, onComplete }: OperationProps) {
  const operation = usePrivateOperation();
  const [accountName, setAccountName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [initialContactUserId, setInitialContactUserId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const validName = accountName.trim().length >= 2 && accountName.trim().length <= 200 && !/[\u0000-\u001f\u007f]/.test(accountName.trim());
  const canSubmit = validName && (!countryCode || /^[A-Za-z]{2}$/.test(countryCode)) && isBillingUuid(initialContactUserId) && validReason(reason) && confirmation === "CREATE ECONOMIC ORGANIZATION" && !operation.busy;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (operation.busy) return;
    if (!canSubmit) { operation.invalid("Enter a valid organization name, optional two-letter country code, initial-contact Website Account UUID, private audit reason, and exact confirmation."); return; }
    operation.start("Creating the private test-mode organization record...");
    try {
      const result = await createEconomicOperatorOrganization({ clientRequestId: operation.requestId(), accountName, countryCode: countryCode || null, initialContactUserId, confirmation: "CREATE ECONOMIC ORGANIZATION", reason }, accessToken);
      operation.succeed(`${result.idempotentReplay ? "Existing idempotent organization confirmed" : "Private organization created"}: ${result.accountName}. Internal organization UUID: ${result.organizationId}.`);
      setConfirmation("");
      await onComplete();
    } catch (error) { operation.fail(error); } finally { operation.setBusy(false); }
  }
  return <details className="section-card economic-operation-card"><summary><strong>Create a private organization account</strong></summary>
    <p>This record is an economic and contracting sidecar. It does not create a public affiliation, Commons role, badge, trust marker, review permission, or governance authority.</p>
    <form className="auth-form economic-operation-form" onSubmit={submit} noValidate>
      <label><span>Organization account name</span><input value={accountName} onChange={(event) => operation.changed(() => setAccountName(event.target.value))} minLength={2} maxLength={200} autoComplete="organization" required /></label>
      <label><span>Country code (optional)</span><input value={countryCode} onChange={(event) => operation.changed(() => setCountryCode(event.target.value))} minLength={2} maxLength={2} autoComplete="country" spellCheck={false} /><small>Two letters only; this is private contracting data, not a public location claim.</small></label>
      <label><span>Initial contact Website Account UUID</span><input value={initialContactUserId} onChange={(event) => operation.changed(() => setInitialContactUserId(event.target.value))} autoComplete="off" spellCheck={false} required /><small>Use an internal Auth user UUID, never an email, Stripe customer, tax, or bank identifier.</small></label>
      <label><span>Private audit reason</span><textarea value={reason} onChange={(event) => operation.changed(() => setReason(event.target.value))} minLength={8} maxLength={1000} rows={4} required /></label>
      <label><span>Type <strong>CREATE ECONOMIC ORGANIZATION</strong> exactly</span><input value={confirmation} onChange={(event) => { setConfirmation(event.target.value); }} autoComplete="off" spellCheck={false} required /></label>
      <Feedback operation={operation} />
      <button className="button-primary" type="submit" disabled={!canSubmit}>{operation.busy ? "Creating private record..." : "Create private organization record"}</button>
    </form>
  </details>;
}

const organizationRelationships: ReadonlyArray<{ value: OperatorOrganizationRelationship; label: string }> = [
  { value: "owner", label: "Economic account owner" },
  { value: "billing_admin", label: "Billing administrator" },
  { value: "technical_contact", label: "Technical contact" },
  { value: "procurement_contact", label: "Procurement contact" },
  { value: "billing_contact", label: "Billing contact" },
  { value: "authorized_signer", label: "Authorized signer" },
  { value: "service_participant", label: "Service participant" }
];

function OrganizationMembershipForm({ accessToken, onComplete }: OperationProps) {
  const operation = usePrivateOperation();
  const [organizationId, setOrganizationId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [relationship, setRelationship] = useState<OperatorOrganizationRelationship | "">("");
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const canSubmit = isBillingUuid(organizationId) && isBillingUuid(targetUserId) && Boolean(relationship) && enabled !== null && validReason(reason) && confirmation === "SET ECONOMIC ORGANIZATION MEMBERSHIP" && !operation.busy;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (operation.busy) return;
    if (!canSubmit || !relationship || enabled === null) { operation.invalid("Choose the exact private organization relationship and action, then enter valid internal UUIDs, audit reason, and confirmation."); return; }
    operation.start("Recording the audited private organization relationship...");
    try {
      const result = await setEconomicOperatorOrganizationMembership({ clientRequestId: operation.requestId(), organizationId, targetUserId, relationship, enabled, confirmation: "SET ECONOMIC ORGANIZATION MEMBERSHIP", reason }, accessToken);
      operation.succeed(`${result.idempotentReplay ? "Existing idempotent relationship confirmed" : "Organization relationship recorded"}: ${result.relationship.replace(/_/g, " ")} is ${result.active ? "active" : "revoked"}.`);
      setConfirmation("");
      await onComplete();
    } catch (error) { operation.fail(error); } finally { operation.setBusy(false); }
  }
  return <details className="section-card economic-operation-card"><summary><strong>Grant or revoke one private organization relationship</strong></summary>
    <p>Organization relationships govern only the private contracting/account surface. They do not alter public profiles, Commons membership, moderation, review, publication, badge, developer, or stewardship status.</p>
    <form className="auth-form economic-operation-form" onSubmit={submit} noValidate>
      <label><span>Internal organization UUID</span><input value={organizationId} onChange={(event) => operation.changed(() => setOrganizationId(event.target.value))} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Target Website Account UUID</span><input value={targetUserId} onChange={(event) => operation.changed(() => setTargetUserId(event.target.value))} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Private relationship</span><select value={relationship} onChange={(event) => operation.changed(() => setRelationship(event.target.value as OperatorOrganizationRelationship | ""))} required><option value="">Choose one relationship</option>{organizationRelationships.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <fieldset><legend>Relationship action</legend><label className="checkbox-line"><input type="radio" name="organization-membership-action" checked={enabled === true} onChange={() => operation.changed(() => setEnabled(true))} /><span>Grant this relationship</span></label><label className="checkbox-line"><input type="radio" name="organization-membership-action" checked={enabled === false} onChange={() => operation.changed(() => setEnabled(false))} /><span>Revoke this relationship</span></label></fieldset>
      <label><span>Private audit reason</span><textarea value={reason} onChange={(event) => operation.changed(() => setReason(event.target.value))} minLength={8} maxLength={1000} rows={4} required /></label>
      <label><span>Type <strong>SET ECONOMIC ORGANIZATION MEMBERSHIP</strong> exactly</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} required /></label>
      <Feedback operation={operation} />
      <button className="button-primary" type="submit" disabled={!canSubmit}>{operation.busy ? "Recording relationship..." : "Record private relationship action"}</button>
    </form>
  </details>;
}

function OrganizationServiceForm({ accessToken, onComplete }: OperationProps) {
  const operation = usePrivateOperation();
  const [organizationId, setOrganizationId] = useState("");
  const [authorizedSignerUserId, setAuthorizedSignerUserId] = useState("");
  const [serviceCode, setServiceCode] = useState("");
  const [priceCode, setPriceCode] = useState("");
  const [statementOfWorkVersion, setStatementOfWorkVersion] = useState("");
  const [serviceTermsVersion, setServiceTermsVersion] = useState("");
  const [dataHandlingDisclosureVersion, setDataHandlingDisclosureVersion] = useState("");
  const [confidentialityClass, setConfidentialityClass] = useState<"internal" | "confidential" | "restricted" | "">("");
  const [proposalReference, setProposalReference] = useState("");
  const [contractReference, setContractReference] = useState("");
  const [invoiceReference, setInvoiceReference] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const endsValid = !endsAt || (validLocalTimestamp(endsAt) && new Date(endsAt).getTime() > new Date(startsAt).getTime());
  const canSubmit = isBillingUuid(organizationId) && isBillingUuid(authorizedSignerUserId) && validCode(serviceCode, 100) && validCode(priceCode) && validVersion(statementOfWorkVersion) && validVersion(serviceTermsVersion) && validVersion(dataHandlingDisclosureVersion) && Boolean(confidentialityClass) && validOptionalText(proposalReference, 1, 120) && validOptionalText(contractReference, 1, 120) && validOptionalText(invoiceReference, 1, 120) && validLocalTimestamp(startsAt) && endsValid && validReason(reason) && confirmation === "CREATE TEST ORGANIZATION SERVICE ENGAGEMENT" && !operation.busy;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (operation.busy) return;
    if (!canSubmit || !confidentialityClass) { operation.invalid("Complete the reviewed organization, signer, catalog, document-version, confidentiality, timing, audit, and confirmation fields. Optional references must be 120 characters or fewer."); return; }
    operation.start("Creating a private contract-pending organization-service record...");
    try {
      const result = await createEconomicOperatorOrganizationService({ clientRequestId: operation.requestId(), organizationId, authorizedSignerUserId, serviceCode, priceCode, statementOfWorkVersion, serviceTermsVersion, dataHandlingDisclosureVersion, confidentialityClass, proposalReference: proposalReference.trim() || null, contractReference: contractReference.trim() || null, invoiceReference: invoiceReference.trim() || null, startsAt: new Date(startsAt).toISOString(), endsAt: endsAt ? new Date(endsAt).toISOString() : null, confirmation: "CREATE TEST ORGANIZATION SERVICE ENGAGEMENT", reason }, accessToken);
      operation.succeed(`${result.idempotentReplay ? "Existing idempotent engagement confirmed" : "Private engagement created"}: ${result.serviceCode} remains ${result.status.replace(/_/g, " ")}. Internal engagement UUID: ${result.engagementId}. No payment or entitlement was created.`);
      setConfirmation("");
      await onComplete();
    } catch (error) { operation.fail(error); } finally { operation.setBusy(false); }
  }
  const change = operation.changed;
  return <details className="section-card economic-operation-card"><summary><strong>Create a contract-pending organization service</strong></summary>
    <p>This binds reviewed identifiers and document versions in test mode. The site does not host or replace the private statement of work, proposal, contract, or invoice, and creation does not activate an entitlement or collect payment.</p>
    <form className="auth-form economic-operation-form" onSubmit={submit} noValidate>
      <label><span>Internal organization UUID</span><input value={organizationId} onChange={(event) => change(() => setOrganizationId(event.target.value))} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Authorized signer Website Account UUID</span><input value={authorizedSignerUserId} onChange={(event) => change(() => setAuthorizedSignerUserId(event.target.value))} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Reviewed service code</span><input value={serviceCode} onChange={(event) => change(() => setServiceCode(event.target.value))} maxLength={100} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Active test price code</span><input value={priceCode} onChange={(event) => change(() => setPriceCode(event.target.value))} maxLength={120} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Statement-of-work version</span><input value={statementOfWorkVersion} onChange={(event) => change(() => setStatementOfWorkVersion(event.target.value))} maxLength={120} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Organization-service terms version</span><input value={serviceTermsVersion} onChange={(event) => change(() => setServiceTermsVersion(event.target.value))} maxLength={120} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Data-handling disclosure version</span><input value={dataHandlingDisclosureVersion} onChange={(event) => change(() => setDataHandlingDisclosureVersion(event.target.value))} maxLength={120} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Confidentiality class</span><select value={confidentialityClass} onChange={(event) => change(() => setConfidentialityClass(event.target.value as typeof confidentialityClass))} required><option value="">Choose one</option><option value="internal">Internal</option><option value="confidential">Confidential</option><option value="restricted">Restricted</option></select></label>
      <fieldset><legend>Private external-document references (optional)</legend><label><span>Proposal reference</span><input value={proposalReference} onChange={(event) => change(() => setProposalReference(event.target.value))} maxLength={120} autoComplete="off" /></label><label><span>Contract reference</span><input value={contractReference} onChange={(event) => change(() => setContractReference(event.target.value))} maxLength={120} autoComplete="off" /></label><label><span>Invoice reference</span><input value={invoiceReference} onChange={(event) => change(() => setInvoiceReference(event.target.value))} maxLength={120} autoComplete="off" /></label><p className="small-note">References only—never paste contract text, signatures, payment credentials, tax IDs, bank details, or private evidence into these fields.</p></fieldset>
      <label><span>Proposed service start</span><input type="datetime-local" value={startsAt} onChange={(event) => change(() => setStartsAt(event.target.value))} required /></label>
      <label><span>Service end (optional)</span><input type="datetime-local" value={endsAt} onChange={(event) => change(() => setEndsAt(event.target.value))} /></label>
      <label><span>Private audit reason</span><textarea value={reason} onChange={(event) => change(() => setReason(event.target.value))} minLength={8} maxLength={1000} rows={4} required /></label>
      <label><span>Type <strong>CREATE TEST ORGANIZATION SERVICE ENGAGEMENT</strong> exactly</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} required /></label>
      <Feedback operation={operation} />
      <button className="button-primary" type="submit" disabled={!canSubmit}>{operation.busy ? "Creating contract-pending record..." : "Create contract-pending test record"}</button>
    </form>
  </details>;
}

const organizationReviewLabels: Record<OperatorOrganizationServiceReviewAction, string> = {
  activate: "Activate after reviewed contract and payment conditions",
  complete: "Complete active service",
  cancel: "Cancel pending or active service",
  reconciliation_required: "Mark reconciliation required",
  resolve_resume: "Resolve reconciliation as active",
  resolve_complete: "Resolve reconciliation as completed",
  resolve_cancel: "Resolve reconciliation as canceled"
};

function OrganizationServiceReviewForm({ accessToken, onComplete }: OperationProps) {
  const operation = usePrivateOperation();
  const [engagementId, setEngagementId] = useState("");
  const [action, setAction] = useState<OperatorOrganizationServiceReviewAction | "">("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const requiredConfirmation = action ? operatorOrganizationServiceReviewConfirmations[action] : "";
  const canSubmit = isBillingUuid(engagementId) && Boolean(action) && validReason(reason) && Boolean(requiredConfirmation) && confirmation === requiredConfirmation && !operation.busy;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (operation.busy) return;
    if (!canSubmit || !action) { operation.invalid("Select one reviewed service action and enter its internal engagement UUID, private reason, and exact action-specific confirmation."); return; }
    operation.start("Recording the human-reviewed organization-service status action...");
    try {
      const result = await reviewEconomicOperatorOrganizationService({ engagementId, clientRequestId: operation.requestId(), action, confirmation: operatorOrganizationServiceReviewConfirmations[action], reason }, accessToken);
      operation.succeed(`${result.idempotentReplay ? "Existing idempotent review confirmed" : "Organization-service review recorded"}: status is ${result.status.replace(/_/g, " ")}.`);
      setConfirmation("");
      await onComplete();
    } catch (error) { operation.fail(error); } finally { operation.setBusy(false); }
  }
  return <details className="section-card economic-operation-card"><summary><strong>Review an organization-service state</strong></summary>
    <p>Activation is a separate human-reviewed transition. It cannot grant Commons authority, approve content, change a profile, or infer that a redirect or browser state proves payment.</p>
    <form className="auth-form economic-operation-form" onSubmit={submit} noValidate>
      <label><span>Internal engagement UUID</span><input value={engagementId} onChange={(event) => operation.changed(() => setEngagementId(event.target.value))} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Reviewed state action</span><select value={action} onChange={(event) => operation.changed(() => { setAction(event.target.value as OperatorOrganizationServiceReviewAction | ""); setConfirmation(""); })} required><option value="">Choose one action</option>{Object.entries(organizationReviewLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span>Private audit reason</span><textarea value={reason} onChange={(event) => operation.changed(() => setReason(event.target.value))} minLength={8} maxLength={1000} rows={4} required /></label>
      <label><span>Type {requiredConfirmation ? <strong>{requiredConfirmation}</strong> : "the confirmation shown after choosing an action"} exactly</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} required disabled={!action} /></label>
      <Feedback operation={operation} />
      <button className="button-primary" type="submit" disabled={!canSubmit}>{operation.busy ? "Recording reviewed state..." : "Record organization-service review"}</button>
    </form>
  </details>;
}

function SponsorshipAgreementForm({ accessToken, onComplete }: OperationProps) {
  const operation = usePrivateOperation();
  const [organizationId, setOrganizationId] = useState("");
  const [authorizedSignerUserId, setAuthorizedSignerUserId] = useState("");
  const [purposeCode, setPurposeCode] = useState("");
  const [priceCode, setPriceCode] = useState("");
  const [agreementVersion, setAgreementVersion] = useState("");
  const [disclosureVersion, setDisclosureVersion] = useState("");
  const [publicLabel, setPublicLabel] = useState("");
  const [publicSummary, setPublicSummary] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const canSubmit = isBillingUuid(organizationId) && isBillingUuid(authorizedSignerUserId) && validCode(purposeCode, 100) && validCode(priceCode) && validVersion(agreementVersion) && validVersion(disclosureVersion) && validOptionalText(publicLabel, 2, 120) && validOptionalText(publicSummary, 1, 500) && validReason(reason) && confirmation === "CREATE TEST SPONSORSHIP AGREEMENT WITHOUT CONTROL" && !operation.busy;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (operation.busy) return;
    if (!canSubmit) { operation.invalid("Complete the reviewed organization, signer, purpose, price, document versions, optional neutral public copy, private reason, and no-control confirmation."); return; }
    operation.start("Creating a private ethical-review sponsorship record...");
    try {
      const result = await createEconomicOperatorSponsorshipAgreement({ clientRequestId: operation.requestId(), organizationId, authorizedSignerUserId, purposeCode, priceCode, agreementVersion, disclosureVersion, publicLabel: publicLabel.trim() || null, publicSummary: publicSummary.trim() || null, confirmation: "CREATE TEST SPONSORSHIP AGREEMENT WITHOUT CONTROL", reason }, accessToken);
      operation.succeed(`${result.idempotentReplay ? "Existing idempotent agreement confirmed" : "Private sponsorship agreement created"}: status is ${result.status.replace(/_/g, " ")}. Internal agreement UUID: ${result.sponsorshipAgreementId}. It grants no authority and is not publicly recognized.`);
      setConfirmation("");
      await onComplete();
    } catch (error) { operation.fail(error); } finally { operation.setBusy(false); }
  }
  const change = operation.changed;
  return <details className="section-card economic-operation-card"><summary><strong>Create an ethical-review sponsorship agreement</strong></summary>
    <p>The record begins in ethical review with every no-control invariant enforced. Optional neutral copy is only a candidate: the signer must opt in and an operator must separately approve it before public display.</p>
    <form className="auth-form economic-operation-form" onSubmit={submit} noValidate>
      <label><span>Internal organization UUID</span><input value={organizationId} onChange={(event) => change(() => setOrganizationId(event.target.value))} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Authorized signer Website Account UUID</span><input value={authorizedSignerUserId} onChange={(event) => change(() => setAuthorizedSignerUserId(event.target.value))} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Reviewed purpose code</span><input value={purposeCode} onChange={(event) => change(() => setPurposeCode(event.target.value))} maxLength={100} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Active test price code</span><input value={priceCode} onChange={(event) => change(() => setPriceCode(event.target.value))} maxLength={120} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Private sponsorship agreement version</span><input value={agreementVersion} onChange={(event) => change(() => setAgreementVersion(event.target.value))} maxLength={120} autoComplete="off" spellCheck={false} required /><small>This is a version binding only. The website does not host or replace the privately delivered agreement.</small></label>
      <label><span>Public disclosure version</span><input value={disclosureVersion} onChange={(event) => change(() => setDisclosureVersion(event.target.value))} maxLength={120} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Candidate neutral public label (optional)</span><input value={publicLabel} onChange={(event) => change(() => setPublicLabel(event.target.value))} minLength={2} maxLength={120} autoComplete="off" /></label>
      <label><span>Candidate neutral public summary (optional)</span><textarea value={publicSummary} onChange={(event) => change(() => setPublicSummary(event.target.value))} maxLength={500} rows={4} /></label>
      <p className="small-note">Never include amount, plan, contract terms, tracking claims, endorsement language, recipient identity, private evidence, or contact/payment details in public copy.</p>
      <label><span>Private audit reason</span><textarea value={reason} onChange={(event) => change(() => setReason(event.target.value))} minLength={8} maxLength={1000} rows={4} required /></label>
      <label><span>Type <strong>CREATE TEST SPONSORSHIP AGREEMENT WITHOUT CONTROL</strong> exactly</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} required /></label>
      <Feedback operation={operation} />
      <button className="button-primary" type="submit" disabled={!canSubmit}>{operation.busy ? "Creating ethical-review record..." : "Create private sponsorship record"}</button>
    </form>
    <p className="boundary-note">Sponsorship cannot buy governance, moderation, editorial control, user tracking, search prominence, endorsement, badges, trust, review authority, or recipient selection.</p>
  </details>;
}

const sponsorshipReviewLabels: Record<OperatorSponsorshipReviewAction, string> = {
  approve: "Approve ethical review; keep contract pending",
  activate: "Activate after verified paid test order",
  reject: "Reject sponsorship",
  complete: "Complete active sponsorship",
  cancel: "Cancel pending or active sponsorship",
  resolve_resume: "Resolve reconciliation as active",
  resolve_complete: "Resolve reconciliation as completed",
  resolve_cancel: "Resolve reconciliation as canceled"
};

function SponsorshipReviewForm({ accessToken, onComplete }: OperationProps) {
  const operation = usePrivateOperation();
  const [agreementId, setAgreementId] = useState("");
  const [action, setAction] = useState<OperatorSponsorshipReviewAction | "">("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const requiredConfirmation = action ? operatorSponsorshipReviewConfirmations[action] : "";
  const canSubmit = isBillingUuid(agreementId) && Boolean(action) && validReason(reason) && Boolean(requiredConfirmation) && confirmation === requiredConfirmation && !operation.busy;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (operation.busy) return;
    if (!canSubmit || !action) { operation.invalid("Select one human-reviewed sponsorship action and enter a valid agreement UUID, private reason, and exact action-specific confirmation."); return; }
    operation.start("Recording the reviewed no-control sponsorship action...");
    try {
      const result = await reviewEconomicOperatorSponsorship({ sponsorshipAgreementId: agreementId, clientRequestId: operation.requestId(), action, confirmation: operatorSponsorshipReviewConfirmations[action], reason }, accessToken);
      operation.succeed(`${result.idempotentReplay ? "Existing idempotent review confirmed" : "Sponsorship review recorded"}: status is ${result.status.replace(/_/g, " ")}; grants authority: no.`);
      setConfirmation("");
      await onComplete();
    } catch (error) { operation.fail(error); } finally { operation.setBusy(false); }
  }
  return <details className="section-card economic-operation-card"><summary><strong>Review a no-control sponsorship state</strong></summary>
    <p>Ethical approval and payment activation are separate transitions. Activation is accepted only after server-verified test payment state; no redirect or typed provider identifier is proof.</p>
    <form className="auth-form economic-operation-form" onSubmit={submit} noValidate>
      <label><span>Internal sponsorship-agreement UUID</span><input value={agreementId} onChange={(event) => operation.changed(() => setAgreementId(event.target.value))} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Reviewed action</span><select value={action} onChange={(event) => operation.changed(() => { setAction(event.target.value as OperatorSponsorshipReviewAction | ""); setConfirmation(""); })} required><option value="">Choose one action</option>{Object.entries(sponsorshipReviewLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span>Private audit reason</span><textarea value={reason} onChange={(event) => operation.changed(() => setReason(event.target.value))} minLength={8} maxLength={1000} rows={4} required /></label>
      <label><span>Type {requiredConfirmation ? <strong>{requiredConfirmation}</strong> : "the confirmation shown after choosing an action"} exactly</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} required disabled={!action} /></label>
      <Feedback operation={operation} />
      <button className="button-primary" type="submit" disabled={!canSubmit}>{operation.busy ? "Recording reviewed sponsorship state..." : "Record sponsorship review"}</button>
    </form>
  </details>;
}

function SponsorshipRecognitionForm({ accessToken, onComplete }: OperationProps) {
  const operation = usePrivateOperation();
  const [agreementId, setAgreementId] = useState("");
  const [approved, setApproved] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const requiredConfirmation = approved === true ? "APPROVE NEUTRAL SPONSORSHIP RECOGNITION" : approved === false ? "REVOKE NEUTRAL SPONSORSHIP RECOGNITION" : "";
  const canSubmit = isBillingUuid(agreementId) && approved !== null && validReason(reason) && confirmation === requiredConfirmation && !operation.busy;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (operation.busy) return;
    if (!canSubmit || approved === null) { operation.invalid("Choose approval or revocation, then enter the internal agreement UUID, private reason, and exact confirmation."); return; }
    operation.start("Recording the separate neutral-recognition review...");
    try {
      const result = await setEconomicOperatorSponsorshipRecognition({ sponsorshipAgreementId: agreementId, clientRequestId: operation.requestId(), approved, confirmation: requiredConfirmation as "APPROVE NEUTRAL SPONSORSHIP RECOGNITION" | "REVOKE NEUTRAL SPONSORSHIP RECOGNITION", reason }, accessToken);
      operation.succeed(`${result.idempotentReplay ? "Existing idempotent recognition decision confirmed" : "Recognition review recorded"}: operator approval is ${result.publicRecognitionApproved ? "active" : "revoked"}. Amounts remain private and no authority is granted.`);
      setConfirmation("");
      await onComplete();
    } catch (error) { operation.fail(error); } finally { operation.setBusy(false); }
  }
  return <details className="section-card economic-operation-card"><summary><strong>Approve or revoke neutral public sponsorship copy</strong></summary>
    <p>This is one half of a dual-consent public display. Operator approval alone cannot publish anything without the authorized signer’s independent opt-in. Either side may withdraw, and amounts always remain private.</p>
    <form className="auth-form economic-operation-form" onSubmit={submit} noValidate>
      <label><span>Internal sponsorship-agreement UUID</span><input value={agreementId} onChange={(event) => operation.changed(() => setAgreementId(event.target.value))} autoComplete="off" spellCheck={false} required /></label>
      <fieldset><legend>Neutral-recognition review</legend><label className="checkbox-line"><input type="radio" name="sponsorship-recognition-action" checked={approved === true} onChange={() => operation.changed(() => { setApproved(true); setConfirmation(""); })} /><span>Approve eligible neutral copy</span></label><label className="checkbox-line"><input type="radio" name="sponsorship-recognition-action" checked={approved === false} onChange={() => operation.changed(() => { setApproved(false); setConfirmation(""); })} /><span>Revoke operator approval</span></label></fieldset>
      <label><span>Private audit reason</span><textarea value={reason} onChange={(event) => operation.changed(() => setReason(event.target.value))} minLength={8} maxLength={1000} rows={4} required /></label>
      <label><span>Type {requiredConfirmation ? <strong>{requiredConfirmation}</strong> : "the confirmation shown after choosing an action"} exactly</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} required disabled={approved === null} /></label>
      <Feedback operation={operation} />
      <button className="button-primary" type="submit" disabled={!canSubmit}>{operation.busy ? "Recording recognition review..." : "Record neutral-recognition decision"}</button>
    </form>
    <p className="boundary-note">Never approve amounts, plans, rankings, endorsements, privileged access, recipient identities, private evidence, or claims that sponsorship grants trust or control.</p>
  </details>;
}

function SponsorshipAllocationForm({ accessToken, onComplete }: OperationProps) {
  const createOperation = usePrivateOperation();
  const closeOperation = usePrivateOperation();
  const [agreementId, setAgreementId] = useState("");
  const [programId, setProgramId] = useState("");
  const [kind, setKind] = useState<OperatorSponsorshipAllocationKind | "">("");
  const [cap, setCap] = useState("");
  const [createReason, setCreateReason] = useState("");
  const [createConfirmation, setCreateConfirmation] = useState("");
  const [allocationId, setAllocationId] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [closeConfirmation, setCloseConfirmation] = useState("");
  const numericCap = Number(cap);
  const capValid = /^\d+$/.test(cap) && Number.isSafeInteger(numericCap) && numericCap >= 1 && numericCap <= 100_000_000_000;
  const canCreate = isBillingUuid(agreementId) && isBillingUuid(programId) && Boolean(kind) && capValid && validReason(createReason) && createConfirmation === "CREATE SPONSORSHIP ASSISTANCE ALLOCATION" && !createOperation.busy;
  const canClose = isBillingUuid(allocationId) && validReason(closeReason) && closeConfirmation === "CLOSE SPONSORSHIP ASSISTANCE ALLOCATION" && !closeOperation.busy;
  async function createAllocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createOperation.busy) return;
    if (!canCreate || !kind) { createOperation.invalid("Choose an allocation kind and enter valid internal agreement/program UUIDs, whole-unit cap, private reason, and exact confirmation."); return; }
    createOperation.start("Creating the restricted sponsorship-to-assistance allocation...");
    try {
      const result = await createEconomicOperatorSponsorshipAllocation({ clientRequestId: createOperation.requestId(), sponsorshipAgreementId: agreementId, assistanceProgramId: programId, allocationKind: kind, allocationCap: numericCap, currency: kind === "funding_minor" ? "usd" : null, confirmation: "CREATE SPONSORSHIP ASSISTANCE ALLOCATION", reason: createReason }, accessToken);
      createOperation.succeed(`${result.idempotentReplay ? "Existing idempotent allocation confirmed" : "Private assistance allocation created"}: ${result.allocationCap.toLocaleString()} ${result.allocationKind.replace(/_/g, " ")} for ${result.scope.replace(/_/g, " ")}. Allocation UUID: ${result.allocationId}. Sponsor recipient selection and recipient data access remain disabled.`);
      setCreateConfirmation("");
      await onComplete();
    } catch (error) { createOperation.fail(error); } finally { createOperation.setBusy(false); }
  }
  async function closeAllocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (closeOperation.busy) return;
    if (!canClose) { closeOperation.invalid("Enter a valid internal allocation UUID, private reason, and exact close confirmation."); return; }
    closeOperation.start("Closing future use of the private sponsorship allocation...");
    try {
      const result = await closeEconomicOperatorSponsorshipAllocation({ clientRequestId: closeOperation.requestId(), allocationId, confirmation: "CLOSE SPONSORSHIP ASSISTANCE ALLOCATION", reason: closeReason }, accessToken);
      closeOperation.succeed(`${result.idempotentReplay ? "Existing idempotent close confirmed" : "Allocation closed"}: status is ${result.status}. Existing audited grant history is retained.`);
      setCloseConfirmation("");
      await onComplete();
    } catch (error) { closeOperation.fail(error); } finally { closeOperation.setBusy(false); }
  }
  return <details className="section-card economic-operation-card"><summary><strong>Bind sponsorship to private assistance capacity</strong></summary>
    <p>A sponsorship allocation may fund a reviewed assistance program, but the sponsor can never select recipients, receive recipient data, create badges, or gain authority. Beneficiary grants remain a separate assistance-operator decision.</p>
    <form className="auth-form economic-operation-form" onSubmit={createAllocation} noValidate>
      <h3>Create allocation</h3>
      <label><span>Internal active sponsorship-agreement UUID</span><input value={agreementId} onChange={(event) => createOperation.changed(() => setAgreementId(event.target.value))} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Internal active assistance-program UUID</span><input value={programId} onChange={(event) => createOperation.changed(() => setProgramId(event.target.value))} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Allocation kind</span><select value={kind} onChange={(event) => createOperation.changed(() => setKind(event.target.value as OperatorSponsorshipAllocationKind | ""))} required><option value="">Choose one</option><option value="funding_minor">Test funding in USD cents</option><option value="sandbox_credit_units">Sandbox service units</option><option value="grant_count">Number of assistance grants</option></select></label>
      <label><span>Allocation cap</span><input type="number" value={cap} onChange={(event) => createOperation.changed(() => setCap(event.target.value))} min={1} max={100_000_000_000} step={1} inputMode="numeric" required /><small>{kind === "funding_minor" ? "Whole USD cents in private test accounting." : kind === "sandbox_credit_units" ? "Whole sandbox service units—not money or badge credits." : kind === "grant_count" ? "Maximum number of private assistance grants." : "Choose a kind before interpreting this whole-unit cap."}</small></label>
      <label><span>Private audit reason</span><textarea value={createReason} onChange={(event) => createOperation.changed(() => setCreateReason(event.target.value))} minLength={8} maxLength={1000} rows={4} required /></label>
      <label><span>Type <strong>CREATE SPONSORSHIP ASSISTANCE ALLOCATION</strong> exactly</span><input value={createConfirmation} onChange={(event) => setCreateConfirmation(event.target.value)} autoComplete="off" spellCheck={false} required /></label>
      <Feedback operation={createOperation} />
      <button className="button-primary" type="submit" disabled={!canCreate}>{createOperation.busy ? "Creating private allocation..." : "Create private assistance allocation"}</button>
    </form>
    <form className="auth-form economic-operation-form" onSubmit={closeAllocation} noValidate>
      <h3>Close future allocation use</h3>
      <label><span>Internal allocation UUID</span><input value={allocationId} onChange={(event) => closeOperation.changed(() => setAllocationId(event.target.value))} autoComplete="off" spellCheck={false} required /></label>
      <label><span>Private audit reason</span><textarea value={closeReason} onChange={(event) => closeOperation.changed(() => setCloseReason(event.target.value))} minLength={8} maxLength={1000} rows={4} required /></label>
      <label><span>Type <strong>CLOSE SPONSORSHIP ASSISTANCE ALLOCATION</strong> exactly</span><input value={closeConfirmation} onChange={(event) => setCloseConfirmation(event.target.value)} autoComplete="off" spellCheck={false} required /></label>
      <Feedback operation={closeOperation} />
      <button className="button-danger" type="submit" disabled={!canClose}>{closeOperation.busy ? "Closing allocation..." : "Close future allocation use"}</button>
    </form>
  </details>;
}

export default function EconomicOrganizationSponsorshipOperations({ accessToken, canManageOrganizations, canManageSponsorships, canManageAssistance, onComplete }: OperationProps & { canManageOrganizations: boolean; canManageSponsorships: boolean; canManageAssistance: boolean }) {
  if (!canManageOrganizations && !canManageSponsorships) return null;
  return <section className="page-stack" aria-labelledby="organization-sponsorship-operations-title">
    <section className="section-card">
      <p className="eyebrow">Private test records · human review required</p>
      <h2 id="organization-sponsorship-operations-title">Organizations and ethical sponsorships</h2>
      <p>These records live beside—not inside—the Commons Profile and governance systems. The browser never accepts provider IDs, bank data, tax data, payment secrets, raw contracts, signatures, private evidence, or recipient identity for public display.</p>
      <p className="boundary-note">No operation below grants public status, badges, trust, governance, moderation, review, developer approval, publisher verification, publication approval, search prominence, voting power, or control of the Commons.</p>
    </section>
    {canManageOrganizations && <>
      <CreateOrganizationForm accessToken={accessToken} onComplete={onComplete} />
      <OrganizationMembershipForm accessToken={accessToken} onComplete={onComplete} />
      <OrganizationServiceForm accessToken={accessToken} onComplete={onComplete} />
      <OrganizationServiceReviewForm accessToken={accessToken} onComplete={onComplete} />
    </>}
    {canManageSponsorships && <>
      <SponsorshipAgreementForm accessToken={accessToken} onComplete={onComplete} />
      <SponsorshipReviewForm accessToken={accessToken} onComplete={onComplete} />
      <SponsorshipRecognitionForm accessToken={accessToken} onComplete={onComplete} />
    </>}
    {canManageSponsorships && canManageAssistance && <SponsorshipAllocationForm accessToken={accessToken} onComplete={onComplete} />}
    {canManageSponsorships && !canManageAssistance && <section className="section-card"><h3>Sponsorship assistance allocations require two capabilities</h3><p>Creating or closing a sponsor-funded assistance allocation requires both <code>sponsorship_manage</code> and <code>economic_assistance_manage</code>. This console does not broaden either capability.</p></section>}
  </section>;
}
