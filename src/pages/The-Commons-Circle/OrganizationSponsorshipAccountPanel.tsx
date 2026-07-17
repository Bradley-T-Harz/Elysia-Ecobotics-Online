import { useRef, useState, type FormEvent, type RefObject } from "react";
import { Link } from "react-router-dom";
import StatusBadge from "../../shared/components/StatusBadge";
import {
  billingErrorMessage,
  createBillingClientRequestId,
  createOrganizationServiceCheckout,
  createSponsorshipCheckout,
  setSponsorshipRecognitionPreference,
  type BillingCapabilities,
  type BillingLegalConsentBundle,
  type EconomicOrganizationAccount,
  type EconomicOrganizationEngagement,
  type EconomicOrganizationStatus,
  type EconomicSponsorshipAgreement
} from "../../shared/billing/billingClient";

function privateMoney(amountMinor: number, currency: string) {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amountMinor / 100); }
  catch { return `${amountMinor.toLocaleString()} ${currency.toUpperCase()} minor units`; }
}

function CheckoutFeedback({ error, status, errorRef }: { error: string; status: string; errorRef: RefObject<HTMLDivElement | null> }) {
  return <>{error && <div className="validation validation--bad" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}<p className="inline-status operator-live-region" role="status" aria-live="polite" aria-atomic="true">{status}</p></>;
}

function OrganizationServiceCheckoutForm({ engagement, accessToken, bundle }: { engagement: EconomicOrganizationEngagement; accessToken: string; bundle: BillingLegalConsentBundle }) {
  const [privateDocumentReviewed, setPrivateDocumentReviewed] = useState(false);
  const [publicPoliciesReviewed, setPublicPoliciesReviewed] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const requestIdRef = useRef("");
  const errorRef = useRef<HTMLDivElement>(null);
  const requiredConfirmation = "CONTINUE TO ORGANIZATION SERVICE TEST CHECKOUT";
  const serviceTerms = bundle.documents.organizationServiceTerms;
  const refundPolicy = bundle.documents.refundPolicy;
  const privacyDisclosure = bundle.documents.privacyDisclosure;
  const documentsComplete = Boolean(serviceTerms && refundPolicy && privacyDisclosure);
  const canSubmit = documentsComplete && privateDocumentReviewed && publicPoliciesReviewed && confirmation === requiredConfirmation && !busy;
  function change(changeInput: () => void) { changeInput(); requestIdRef.current = ""; setError(""); setStatus(""); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!canSubmit) {
      setError("Confirm that you separately received and reviewed the exact private statement of work and that you reviewed the canonical public service, refund, and privacy policies, then type the exact confirmation.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setBusy(true);
    setError("");
    setStatus("Preparing the exact Stripe-hosted organization-service checkout in test mode...");
    try {
      requestIdRef.current ||= createBillingClientRequestId();
      const result = await createOrganizationServiceCheckout({ engagementId: engagement.engagementId, clientRequestId: requestIdRef.current, sourceRoute: "/commons-circle/support-billing", legalBundleVersion: bundle.version, statementOfWorkVersion: engagement.statementOfWorkVersion, serviceTermsVersion: engagement.serviceTermsVersion, dataHandlingDisclosureVersion: engagement.dataHandlingDisclosureVersion }, accessToken);
      setStatus("Opening Stripe-hosted test checkout. A browser return is not payment proof; service activation requires signed-webhook fulfillment and human review.");
      window.location.assign(result.checkoutUrl);
    } catch (requestError) {
      setBusy(false);
      setStatus("");
      setError(billingErrorMessage(requestError));
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }
  return <form className="auth-form economic-operation-form" onSubmit={submit} noValidate>
    <h4>Deliberate test checkout</h4>
    <dl className="mini-facts"><div><dt>Exact test amount</dt><dd>{privateMoney(engagement.amountMinor, engagement.currency)}</dd></div><div><dt>Statement of work</dt><dd>{engagement.statementOfWorkVersion}</dd></div><div><dt>Service terms binding</dt><dd>{engagement.serviceTermsVersion}</dd></div><div><dt>Data disclosure binding</dt><dd>{engagement.dataHandlingDisclosureVersion}</dd></div><div><dt>Canonical public bundle</dt><dd>{bundle.version}</dd></div></dl>
    <label className="checkbox-line"><input type="checkbox" checked={privateDocumentReviewed} onChange={(event) => change(() => setPrivateDocumentReviewed(event.target.checked))} /><span>I confirm that the authorized representative separately delivered the private statement of work identified above and that I received and reviewed that exact version. I understand this website does not host, reproduce, or replace the private statement of work, proposal, contract, or invoice.</span></label>
    <label className="checkbox-line"><input type="checkbox" checked={publicPoliciesReviewed} onChange={(event) => change(() => setPublicPoliciesReviewed(event.target.checked))} /><span>I reviewed the <Link to={serviceTerms?.path ?? "/legal/organization-services-terms"}>Organization Services Terms</Link>, <Link to={refundPolicy?.path ?? "/legal/refund-and-cancellation-policy"}>Refund and Cancellation Policy</Link>, and <Link to={privacyDisclosure?.path ?? "/legal/privacy-policy"}>Privacy Policy</Link> in canonical consent bundle {bundle.version}. I understand payment grants no Commons authority, profile affiliation, badge, trust, review outcome, or governance power.</span></label>
    <label><span>Type <strong>{requiredConfirmation}</strong> exactly</span><input value={confirmation} onChange={(event) => change(() => setConfirmation(event.target.value))} autoComplete="off" spellCheck={false} required /></label>
    <CheckoutFeedback error={error} status={status} errorRef={errorRef} />
    <button className="button-primary" type="submit" disabled={!canSubmit}>{busy ? "Opening Stripe test checkout..." : "Continue to exact test checkout"}</button>
    <p className="small-note">Only the server-projected engagement UUID, stable request UUID, source route, canonical bundle version, and exact document versions are sent. The browser cannot choose or alter the price, currency, organization, signer, entitlement, payment status, or activation state.</p>
  </form>;
}

function SponsorshipCheckoutForm({ agreement, accessToken, bundle }: { agreement: EconomicSponsorshipAgreement; accessToken: string; bundle: BillingLegalConsentBundle }) {
  const [privateAgreementReviewed, setPrivateAgreementReviewed] = useState(false);
  const [publicPoliciesReviewed, setPublicPoliciesReviewed] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const requestIdRef = useRef("");
  const errorRef = useRef<HTMLDivElement>(null);
  const requiredConfirmation = "CONTINUE TO SPONSORSHIP TEST CHECKOUT";
  const sponsorshipTerms = bundle.documents.sponsorshipTerms;
  const refundPolicy = bundle.documents.refundPolicy;
  const privacyDisclosure = bundle.documents.privacyDisclosure;
  const documentsComplete = Boolean(sponsorshipTerms && refundPolicy && privacyDisclosure);
  const canSubmit = documentsComplete && privateAgreementReviewed && publicPoliciesReviewed && confirmation === requiredConfirmation && !busy;
  function change(changeInput: () => void) { changeInput(); requestIdRef.current = ""; setError(""); setStatus(""); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!canSubmit) {
      setError("Confirm that you separately received and reviewed the exact private no-control agreement and that you reviewed the canonical public sponsorship, refund, and privacy policies, then type the exact confirmation.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setBusy(true);
    setError("");
    setStatus("Preparing the exact Stripe-hosted ethical-sponsorship checkout in test mode...");
    try {
      requestIdRef.current ||= createBillingClientRequestId();
      const result = await createSponsorshipCheckout({ sponsorshipAgreementId: agreement.agreementId, clientRequestId: requestIdRef.current, sourceRoute: "/commons-circle/support-billing", legalBundleVersion: bundle.version, agreementVersion: agreement.agreementVersion, disclosureVersion: agreement.disclosureVersion }, accessToken);
      setStatus("Opening Stripe-hosted test checkout. A browser return is not payment proof, public recognition, endorsement, or authority.");
      window.location.assign(result.checkoutUrl);
    } catch (requestError) {
      setBusy(false);
      setStatus("");
      setError(billingErrorMessage(requestError));
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }
  return <form className="auth-form economic-operation-form" onSubmit={submit} noValidate>
    <h4>Deliberate test sponsorship checkout</h4>
    <dl className="mini-facts"><div><dt>Exact test amount</dt><dd>{privateMoney(agreement.amountMinor, agreement.currency)}</dd></div><div><dt>Private agreement</dt><dd>{agreement.agreementVersion}</dd></div><div><dt>Disclosure binding</dt><dd>{agreement.disclosureVersion}</dd></div><div><dt>Canonical public bundle</dt><dd>{bundle.version}</dd></div></dl>
    <label className="checkbox-line"><input type="checkbox" checked={privateAgreementReviewed} onChange={(event) => change(() => setPrivateAgreementReviewed(event.target.checked))} /><span>I confirm that the authorized representative separately delivered the private no-control sponsorship agreement identified above and that I received and reviewed that exact version. I understand this website does not host, reproduce, or replace the private signed agreement.</span></label>
    <label className="checkbox-line"><input type="checkbox" checked={publicPoliciesReviewed} onChange={(event) => change(() => setPublicPoliciesReviewed(event.target.checked))} /><span>I reviewed the <Link to={sponsorshipTerms?.path ?? "/legal/sponsorship-independence-policy"}>Sponsorship Independence Policy</Link>, <Link to={refundPolicy?.path ?? "/legal/refund-and-cancellation-policy"}>Refund and Cancellation Policy</Link>, and <Link to={privacyDisclosure?.path ?? "/legal/privacy-policy"}>Privacy Policy</Link> in canonical consent bundle {bundle.version}. I understand sponsorship grants no authority, trust, moderation, editorial control, tracking access, ranking, endorsement, recipient choice, or governance power.</span></label>
    <label><span>Type <strong>{requiredConfirmation}</strong> exactly</span><input value={confirmation} onChange={(event) => change(() => setConfirmation(event.target.value))} autoComplete="off" spellCheck={false} required /></label>
    <CheckoutFeedback error={error} status={status} errorRef={errorRef} />
    <button className="button-primary" type="submit" disabled={!canSubmit}>{busy ? "Opening Stripe test checkout..." : "Continue to exact sponsorship test checkout"}</button>
    <p className="small-note">Only the signer-owned server projection and canonical versions are sent. The browser cannot supply amount, currency, price, organization, signer, recognition, payment status, or authority.</p>
  </form>;
}

function SponsorshipRecognitionPreference({ agreement, accessToken, onComplete }: { agreement: EconomicSponsorshipAgreement; accessToken: string; onComplete: () => Promise<void> }) {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const requestIdRef = useRef("");
  const errorRef = useRef<HTMLDivElement>(null);
  const optedIn = agreement.publicRecognitionOptIn;
  const nextOptedIn = !optedIn;
  const requiredConfirmation = nextOptedIn ? "PUBLISH NEUTRAL SPONSORSHIP RECOGNITION" : "REMOVE NEUTRAL SPONSORSHIP RECOGNITION";
  const available = optedIn || agreement.recognitionPreferenceAvailable;
  const canSubmit = available && confirmation === requiredConfirmation && !busy;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!canSubmit) {
      setError("The signer-owned agreement projection and exact typed confirmation are required before changing neutral public recognition.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setBusy(true);
    setError("");
    setStatus(nextOptedIn ? "Recording your optional neutral-recognition preference..." : "Withdrawing your public-recognition preference...");
    try {
      requestIdRef.current ||= createBillingClientRequestId();
      const result = await setSponsorshipRecognitionPreference({ sponsorshipAgreementId: agreement.agreementId, clientRequestId: requestIdRef.current, optedIn: nextOptedIn, sourceRoute: "/commons-circle/support-billing", agreementVersion: agreement.agreementVersion, disclosureVersion: agreement.disclosureVersion, confirmation: requiredConfirmation }, accessToken);
      setStatus(result.publicRecognitionOptIn ? `${result.idempotentReplay ? "Existing preference confirmed" : "Neutral-recognition preference recorded"}. Public display still requires independent operator approval; no amount or authority is published.` : `${result.idempotentReplay ? "Existing private preference confirmed" : "Neutral-recognition preference withdrawn"}. Financial and agreement records remain private.`);
      requestIdRef.current = "";
      setConfirmation("");
      await onComplete();
    } catch (requestError) {
      setStatus("");
      setError(billingErrorMessage(requestError));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally { setBusy(false); }
  }
  return <div className="confirmation-panel">
    <h4>Optional neutral public acknowledgment</h4>
    <dl className="mini-facts"><div><dt>Your signer preference</dt><dd>{optedIn ? "Opted in" : "Private"}</dd></div><div><dt>Independent operator approval</dt><dd>{agreement.publicRecognitionApproved ? "Approved" : "Not approved"}</dd></div><div><dt>Signer and reviewer approvals both present</dt><dd>{optedIn && agreement.publicRecognitionApproved ? "Yes" : "No"}</dd></div><div><dt>Amounts public</dt><dd>Never</dd></div><div><dt>Authority granted</dt><dd>None</dd></div></dl>
    <p>Review the <Link to="/legal/sponsorship-independence-policy">Sponsorship Independence Policy</Link>. Agreement binding {agreement.agreementVersion}; disclosure binding {agreement.disclosureVersion}. Public acknowledgment is neutral, unranked, and never an endorsement.</p>
    {available ? <form className="auth-form economic-operation-form" onSubmit={submit} noValidate>
      <p>{optedIn ? "You may withdraw even when new opt-ins or public display are disabled." : "Opting in does not guarantee display: the separate ethical-review approval must also remain active."}</p>
      <label><span>Type <strong>{requiredConfirmation}</strong> exactly</span><input value={confirmation} onChange={(event) => { setConfirmation(event.target.value); requestIdRef.current = ""; setError(""); setStatus(""); }} autoComplete="off" spellCheck={false} required /></label>
      <CheckoutFeedback error={error} status={status} errorRef={errorRef} />
      <button className={optedIn ? "button-danger" : "button-primary"} type="submit" disabled={!canSubmit}>{busy ? "Saving private preference..." : optedIn ? "Withdraw public acknowledgment" : "Opt in to neutral acknowledgment"}</button>
    </form> : <p className="boundary-note">A new recognition preference is unavailable for this agreement. Nothing is published or changed by this message.</p>}
    <p className="small-note">Two approvals do not by themselves prove current public display. Deployment and database display kill switches still control publication. No amount, plan, contract term, payment history, provider ID, assistance status, recipient identity, badge, rank, or authority can be published through this preference.</p>
  </div>;
}

function OrganizationRecord({ organization, accessToken, capabilities, onComplete }: { organization: EconomicOrganizationStatus; accessToken: string; capabilities: BillingCapabilities | null; onComplete: () => Promise<void> }) {
  const organizationBundle = capabilities?.legalConsentBundles?.organization_service_checkout_bundle ?? null;
  const sponsorshipBundle = capabilities?.legalConsentBundles?.sponsorship_checkout_bundle ?? null;
  return <article className="economic-summary-card">
    <div className="addon-card__topline"><strong>{organization.accountName}</strong><StatusBadge label={organization.status.replace(/_/g, " ")} tone={organization.status === "active" ? "safe" : organization.status === "restricted" ? "warning" : "neutral"} /></div>
    <p>Private economic relationship: {organization.relationships.map((item) => item.replace(/_/g, " ")).join(", ") || "none projected"}.</p>
    {!organization.engagements.length && <p>No signer-owned organization-service engagement is projected. This does not prove that the organization has no other private contract record.</p>}
    {organization.engagements.map((engagement) => <div className="confirmation-panel" key={engagement.engagementId}>
      <div className="addon-card__topline"><strong>{engagement.serviceCode.replace(/_/g, " ")}</strong><StatusBadge label={engagement.status.replace(/_/g, " ")} tone={engagement.status === "active" || engagement.status === "completed" ? "safe" : engagement.status === "reconciliation_required" ? "warning" : "neutral"} /></div>
      <dl className="mini-facts"><div><dt>Private test amount</dt><dd>{privateMoney(engagement.amountMinor, engagement.currency)}</dd></div><div><dt>Statement of work</dt><dd>{engagement.statementOfWorkVersion}</dd></div><div><dt>Service terms</dt><dd>{engagement.serviceTermsVersion}</dd></div><div><dt>Data disclosure</dt><dd>{engagement.dataHandlingDisclosureVersion}</dd></div></dl>
      {engagement.checkoutAvailable && capabilities?.organizationServiceCheckout && organizationBundle ? <OrganizationServiceCheckoutForm engagement={engagement} accessToken={accessToken} bundle={organizationBundle} /> : engagement.status === "contract_pending" ? <p className="boundary-note">Test checkout is not fully available for this engagement. The browser requires both signer-owned database eligibility and independently verified server/provider/webhook/canonical-policy capability. No price or activation is guessed.</p> : <p className="small-note">No checkout is offered for this service state.</p>}
    </div>)}
    {!organization.sponsorshipAgreements.length && <p>No signer-owned sponsorship agreement is projected for this organization.</p>}
    {organization.sponsorshipAgreements.map((agreement) => <div className="confirmation-panel" key={agreement.agreementId}>
      <div className="addon-card__topline"><strong>Ethical sponsorship</strong><StatusBadge label={agreement.status.replace(/_/g, " ")} tone={agreement.status === "active" || agreement.status === "completed" ? "safe" : agreement.status === "reconciliation_required" || agreement.status === "rejected" ? "warning" : "neutral"} /></div>
      <dl className="mini-facts"><div><dt>Private test amount</dt><dd>{privateMoney(agreement.amountMinor, agreement.currency)}</dd></div><div><dt>Agreement version</dt><dd>{agreement.agreementVersion}</dd></div><div><dt>Disclosure version</dt><dd>{agreement.disclosureVersion}</dd></div></dl>
      {agreement.checkoutAvailable && capabilities?.sponsorshipCheckout && sponsorshipBundle ? <SponsorshipCheckoutForm agreement={agreement} accessToken={accessToken} bundle={sponsorshipBundle} /> : agreement.status === "contract_pending" ? <p className="boundary-note">Sponsorship test checkout is not fully available. Both signer-owned database eligibility and independently verified server/provider/webhook/canonical-policy capability are required. No payment, recognition, or authority is inferred.</p> : <p className="small-note">No checkout is offered for this sponsorship state.</p>}
      <SponsorshipRecognitionPreference agreement={agreement} accessToken={accessToken} onComplete={onComplete} />
    </div>)}
  </article>;
}

export default function OrganizationSponsorshipAccountPanel({ account, accessToken, capabilities, onComplete }: { account: EconomicOrganizationAccount | null; accessToken: string; capabilities: BillingCapabilities | null; onComplete: () => Promise<void> }) {
  return <article className="section-card economic-room-card">
    <p className="eyebrow">Organizations and ethical sponsorships</p>
    <h2>Your private signer relationships</h2>
    {!account ? <p className="commons-empty-state">The private organization projection could not be verified. This does not mean no relationship, engagement, agreement, or payment record exists, and no mutation is offered.</p> : !account.organizations.length ? <p className="commons-empty-state">No private economic organization relationship is connected to this Website Account. Public profile organization text does not create one.</p> : account.organizations.map((organization) => <OrganizationRecord key={organization.organizationId} organization={organization} accessToken={accessToken} capabilities={capabilities} onComplete={onComplete} />)}
    {account?.organizations.length && !capabilities ? <p className="boundary-note">Canonical checkout capabilities and legal bundles could not be verified, so private relationship status is shown read-only and this browser will not create a checkout or guess a policy version.</p> : null}
    <p className="boundary-note">Only signer-owned bounded records appear. Other contacts, proposals, contracts, invoices, signatures, provider references, and financial history remain restricted. These records do not alter Commons identity, Free Member recognition, badges, roles, moderation, reviews, developer status, publisher identity, publication, search rank, or governance.</p>
    <div className="button-row"><Link className="button-link" to="/legal/organization-services-terms">Organization Services Terms</Link><Link className="button-link" to="/legal/sponsorship-independence-policy">Sponsorship Independence Policy</Link></div>
  </article>;
}
