import { legalDocumentLink } from "../../../shared/billing/legalDocumentLink";
import { FundingLink } from "../../../shared/billing/FundingExplanation";
import SellerPreparationPanel from "./SellerPreparationPanel";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../shared/auth/useAuth";
import CheckoutReturnStatus from "../../../shared/billing/CheckoutReturnStatus";
import { exactUsdDecimalToMinor } from "../../../shared/billing/exactMoney";
import {
  billingErrorMessage,
  acceptMarketplaceFreeSellerAgreement,
  configureMarketplaceSellerOffer,
  createBillingClientRequestId,
  createMarketplaceSellerOnboarding,
  linkMarketplaceSellerPublisher,
  loadBillingCapabilities,
  loadMarketplacePurchases,
  loadMarketplaceSellerStatus,
  marketplaceSellerOfferStatusConfirmations,
  refreshMarketplaceSellerStatus,
  setMarketplaceSellerOfferStatus,
  type MarketplaceOwnedLicense,
  type MarketplaceSellerEligibleVersion,
  type MarketplaceSellerOfferTargetStatus,
  type MarketplaceSellerOwnedOffer,
  type MarketplaceSellerPublisherOption,
  type MarketplaceSellerStatus,
  type BillingCapabilities
} from "../../../shared/billing/billingClient";

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Date unavailable" : parsed.toLocaleString();
}

function money(amountMinor: number, currency: string) {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amountMinor / 100); }
  catch { return `${amountMinor} ${currency.toUpperCase()} minor units`; }
}

function LicenseList({ licenses }: { licenses: MarketplaceOwnedLicense[] }) {
  if (!licenses.length) return <p className="commons-empty-state">No Marketplace licenses are connected to this Website Account. Saving an add-on is not a license, and free catalog browsing remains available.</p>;
  return <div className="marketplace-license-list">{licenses.map((license) => <article className="economic-summary-card" key={`${license.listingSlug}:${license.version}:${license.acquiredAt}`}>
    <div className="addon-card__topline"><strong>{license.listingName}</strong><span className="trust-badge">{license.safetyStatus}</span></div>
    <dl className="mini-facts"><div><dt>Version</dt><dd>{license.version}</dd></div><div><dt>License</dt><dd>{license.licenseKey} · {license.licenseVersion}</dd></div><div><dt>Acquisition</dt><dd>{license.acquisitionKind === "paid_order" ? "Test-mode paid order" : "Free terms acceptance"}</dd></div><div><dt>Economic state</dt><dd>{license.economicStatus.replace(/_/g, " ")}</dd></div><div><dt>Recorded</dt><dd>{date(license.acquiredAt)}</dd></div></dl>
    <p className="boundary-note">This license does not authorize installation. {license.safetyStatus === "revoked" ? "The reviewed listing or version is revoked; do not prepare a local install." : "Local Elysia still performs its own manifest, safety, permission, and operator review."}</p>
    <Link className="button-link" to={`/marketplace/addons/${encodeURIComponent(license.listingSlug)}`}>View reviewed listing</Link>
  </article>)}</div>;
}

function SellerPublisherLinkForm({ accessToken, publishers, onComplete }: { accessToken: string; publishers: MarketplaceSellerPublisherOption[]; onComplete: () => Promise<void> }) {
  const [publisherId, setPublisherId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const requestIdRef = useRef("");
  const errorRef = useRef<HTMLDivElement>(null);
  const unlinkedPublishers = publishers.filter((publisher) => !publisher.linked);
  const canSubmit = Boolean(publisherId && reason.trim().length >= 8 && confirmation === "LINK MARKETPLACE SELLER TO PUBLISHER" && !busy);

  function change(action: () => void) {
    action();
    requestIdRef.current = "";
    setStatus("");
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setStatus("Recording a private seller-to-publisher relationship without changing publisher verification…");
    setError("");
    requestIdRef.current ||= createBillingClientRequestId();
    try {
      const result = await linkMarketplaceSellerPublisher({
        publisherId,
        clientRequestId: requestIdRef.current,
        confirmation: "LINK MARKETPLACE SELLER TO PUBLISHER",
        reason
      }, accessToken);
      requestIdRef.current = "";
      setPublisherId("");
      setReason("");
      setConfirmation("");
      setStatus(`${result.idempotentReplay ? "The matching previously recorded publisher relationship was recovered." : "Publisher relationship recorded."} Verification, ownership review, listing review, trust, ranking, and authority were not changed.`);
      await onComplete();
    } catch (requestError) {
      setStatus("");
      setError(billingErrorMessage(requestError));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  }

  return <form className="seller-onboarding-consent" onSubmit={submit} noValidate>
    <h4>Connect an owned publisher identity</h4>
    <p>This optional private sidecar lets a later offer reference an existing publisher you own. It cannot create a publisher, change verification, approve a listing, or grant trust.</p>
    {publishers.filter((publisher) => publisher.linked).length > 0 && <p className="inline-status">Linked publisher identities: {publishers.filter((publisher) => publisher.linked).map((publisher) => `${publisher.name}${publisher.verified ? " (independently verified)" : ""}`).join(", ")}.</p>}
    {!publishers.length ? <p className="commons-empty-state">No publisher identity owned by this Website Account is available. Seller setup does not invent one.</p> : !unlinkedPublishers.length ? <p className="commons-empty-state">Every eligible owned publisher is already linked.</p> : <>
      <label><span>Owned publisher</span><select value={publisherId} disabled={busy} required onChange={(event) => change(() => setPublisherId(event.target.value))}><option value="">Choose one publisher</option>{unlinkedPublishers.map((publisher) => <option value={publisher.publisherId} key={publisher.publisherId}>{publisher.name} · {publisher.verified ? "verified independently" : "not verified"}</option>)}</select></label>
      <label><span>Private audit reason</span><textarea value={reason} minLength={8} maxLength={1000} disabled={busy} required onChange={(event) => change(() => setReason(event.target.value))} /></label>
      <label><span>Typed confirmation</span><input value={confirmation} disabled={busy} autoComplete="off" spellCheck={false} onChange={(event) => change(() => setConfirmation(event.target.value))} aria-describedby="publisher-link-confirmation-help" /></label><p id="publisher-link-confirmation-help" className="small-note">Type <code>LINK MARKETPLACE SELLER TO PUBLISHER</code> exactly.</p>
      {error && <div className="validation validation--bad" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
      <p className="inline-status operator-live-region" role="status" aria-live="polite" aria-atomic="true">{status}</p>
      <button className="button-primary" type="submit" disabled={!canSubmit}>{busy ? "Linking publisher…" : "Link owned publisher"}</button>
    </>}
  </form>;
}

function exactUsdFromMinor(amountMinor: number) {
  return `${Math.floor(amountMinor / 100)}.${String(amountMinor % 100).padStart(2, "0")}`;
}

function marketplaceOfferTargets(status: MarketplaceSellerOwnedOffer["status"]): MarketplaceSellerOfferTargetStatus[] {
  if (status === "draft") return ["active", "retired"];
  if (status === "active") return ["suspended", "retired"];
  if (status === "suspended") return ["active", "retired"];
  return [];
}

function SellerOfferStatusControl({ accessToken, offer, onComplete }: { accessToken: string; offer: MarketplaceSellerOwnedOffer; onComplete: () => Promise<void> }) {
  const [targetStatus, setTargetStatus] = useState<MarketplaceSellerOfferTargetStatus | "">("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const requestIdRef = useRef("");
  const errorRef = useRef<HTMLDivElement>(null);
  const allowedTargets = marketplaceOfferTargets(offer.status);
  const expectedConfirmation = targetStatus ? marketplaceSellerOfferStatusConfirmations[targetStatus] : "";
  const canSubmit = Boolean(targetStatus && allowedTargets.includes(targetStatus) && reason.trim().length >= 8 && confirmation === expectedConfirmation && !busy);

  function change(action: () => void) {
    action();
    requestIdRef.current = "";
    setStatus("");
    setError("");
  }

  function chooseTarget(next: MarketplaceSellerOfferTargetStatus) {
    change(() => {
      setTargetStatus(next);
      setReason("");
      setConfirmation("");
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !targetStatus) return;
    setBusy(true);
    setError("");
    setStatus(`Requesting the private test offer status change to ${targetStatus}…`);
    requestIdRef.current ||= createBillingClientRequestId();
    try {
      const result = await setMarketplaceSellerOfferStatus({
        clientRequestId: requestIdRef.current,
        offerId: offer.offerId,
        targetStatus,
        confirmation: marketplaceSellerOfferStatusConfirmations[targetStatus],
        reason
      }, accessToken);
      requestIdRef.current = "";
      setTargetStatus("");
      setReason("");
      setConfirmation("");
      setStatus(`${result.idempotentReplay ? "The matching prior status request was recovered." : `The ${result.offerKind} test offer is now ${result.status}.`} Review, publication, trust, ranking, developer status, publisher verification, and install authority were not changed.`);
      await onComplete();
    } catch (requestError) {
      setStatus("");
      setError(billingErrorMessage(requestError));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  }

  if (!allowedTargets.length) return <p className="small-note">A retired offer is terminal. Create or revise a separate draft for a later offer; this record is retained for accounting and audit history.</p>;

  return <form className="confirmation-panel" onSubmit={submit} noValidate>
    <strong>Change this offer's economic availability</strong>
    <div className="button-row">{allowedTargets.map((target) => <button type="button" key={target} disabled={busy} aria-pressed={targetStatus === target} onClick={() => chooseTarget(target)}>{target === "active" ? offer.status === "suspended" ? "Reactivate" : "Activate" : target === "suspended" ? "Suspend" : "Retire"}</button>)}</div>
    {targetStatus && <>
      <p className="small-note">This changes only the test offer from <strong>{offer.status}</strong> to <strong>{targetStatus}</strong>. {targetStatus === "retired" ? "Retirement is permanent for this offer record." : "It does not change the reviewed add-on or any community authority."}</p>
      <label><span>Private audit reason</span><textarea value={reason} minLength={8} maxLength={1000} disabled={busy} required onChange={(event) => change(() => setReason(event.target.value))} /></label>
      <label><span>Typed confirmation</span><input value={confirmation} disabled={busy} autoComplete="off" spellCheck={false} onChange={(event) => change(() => setConfirmation(event.target.value))} aria-describedby={`seller-offer-status-help-${offer.offerId}`} /></label>
      <p id={`seller-offer-status-help-${offer.offerId}`} className="small-note">Type <code>{expectedConfirmation}</code> exactly.</p>
      {error && <div className="validation validation--bad" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
      <p className="inline-status operator-live-region" role="status" aria-live="polite" aria-atomic="true">{status}</p>
      <button className={targetStatus === "retired" ? "button-danger" : "button-primary"} type="submit" disabled={!canSubmit}>{busy ? "Recording status…" : `${targetStatus === "active" ? "Activate" : targetStatus === "suspended" ? "Suspend" : "Retire"} test offer`}</button>
    </>}
  </form>;
}

function SellerOwnedOffers({ accessToken, offers, totalCount, truncated, onRevise, onComplete }: { accessToken: string; offers: MarketplaceSellerOwnedOffer[]; totalCount: number; truncated: boolean; onRevise: (offer: MarketplaceSellerOwnedOffer) => void; onComplete: () => Promise<void> }) {
  return <section className="seller-owned-offers" aria-labelledby="seller-owned-offers-title">
    <div className="section-heading section-heading--inline"><div><p className="eyebrow">Private seller records</p><h4 id="seller-owned-offers-title">Your configured offers</h4></div><span className="trust-badge">{offers.length} of {totalCount}</span></div>
    {truncated && <p className="boundary-note" role="status">This bounded account view shows the first {offers.length} of {totalCount} owned offers. Hidden records were not deleted or treated as absent; status changes and revision are available only for offers shown here.</p>}
    {!offers.length ? <p className="commons-empty-state">No configured offer is present in this bounded private seller projection. Drafts, suspended offers, and retired records will reappear here after reload when they exist.</p> : <div className="marketplace-license-list">{offers.map((offer) => <article className="economic-summary-card" key={offer.offerId}>
      <div className="addon-card__topline"><strong>{offer.listingName} · {offer.version}</strong><span className="trust-badge">{offer.status}</span></div>
      <dl className="mini-facts">
        <div><dt>Offer</dt><dd>{offer.offerKind === "free" ? "Free license" : money(offer.amountMinor ?? 0, offer.currency ?? "usd")}</dd></div>
        <div><dt>Commission</dt><dd>{(offer.commissionBps / 100).toFixed(2)}%</dd></div>
        <div><dt>License</dt><dd>{offer.licenseKey} · {offer.licenseVersion}</dd></div>
        <div><dt>Buyer terms</dt><dd>{offer.buyerTermsVersion}</dd></div>
        <div><dt>Publisher sidecar</dt><dd>{offer.publisherId ? "Linked privately" : "None"}</dd></div>
        <div><dt>Last changed</dt><dd>{date(offer.updatedAt)}</dd></div>
      </dl>
      {offer.commercialTermsCode && <p className="small-note">Commercial terms: {offer.commercialTermsCode}. Seller agreement: {offer.sellerAgreementVersion}.</p>}
      {offer.canRevise && <div className="button-row"><button type="button" onClick={() => onRevise(offer)}>Load draft into revision form</button></div>}
      <SellerOfferStatusControl accessToken={accessToken} offer={offer} onComplete={onComplete} />
      <p className="boundary-note">This economic record does not expose payment-provider identifiers and does not prove review, publication, trust, ranking, download eligibility, installation authority, or governance authority.</p>
    </article>)}</div>}
  </section>;
}

function SellerOfferForm({ accessToken, reviewedVersions, publisherOptions, sellerAgreementVersion, freeSellerAgreementVersion, buyerTermsVersion, allowFree, allowPaid, revisionOffer, onCancelRevision, onComplete }: { accessToken: string; reviewedVersions: MarketplaceSellerEligibleVersion[]; publisherOptions: MarketplaceSellerPublisherOption[]; sellerAgreementVersion: string; freeSellerAgreementVersion: string; buyerTermsVersion: string; allowFree: boolean; allowPaid: boolean; revisionOffer: MarketplaceSellerOwnedOffer | null; onCancelRevision: () => void; onComplete: () => Promise<void> }) {
  const [addonVersionId, setAddonVersionId] = useState("");
  const [publisherId, setPublisherId] = useState("");
  const [offerKind, setOfferKind] = useState<"free" | "paid" | "">("");
  const [amountDollars, setAmountDollars] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseVersion, setLicenseVersion] = useState("1.0");
  const [commercialTermsCode, setCommercialTermsCode] = useState("");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const requestIdRef = useRef("");
  const errorRef = useRef<HTMLDivElement>(null);
  const selectedKindAllowed = (offerKind === "free" && allowFree) || (offerKind === "paid" && allowPaid);
  const parsedAmountMinor = exactUsdDecimalToMinor(amountDollars);
  const amountMinor = parsedAmountMinor !== null && parsedAmountMinor >= 50 && parsedAmountMinor <= 10_000_000 ? parsedAmountMinor : null;
  const canConfigure = Boolean(addonVersionId && offerKind && selectedKindAllowed && licenseKey.trim() && licenseVersion.trim() && reason.trim().length >= 8 && confirmation === "CONFIGURE MARKETPLACE TEST OFFER" && !busy && (offerKind === "free" || (amountMinor !== null && commercialTermsCode.trim())));
  const versionOptions = revisionOffer && !reviewedVersions.some((version) => version.addonVersionId === revisionOffer.addonVersionId)
    ? [{ addonVersionId: revisionOffer.addonVersionId, listingId: revisionOffer.listingId, listingSlug: revisionOffer.listingSlug, listingName: revisionOffer.listingName, version: revisionOffer.version }, ...reviewedVersions]
    : reviewedVersions;
  const revisionPublisherMissingFromProjection = Boolean(revisionOffer?.publisherId && !publisherOptions.some((publisher) => publisher.publisherId === revisionOffer.publisherId && publisher.linked));

  useEffect(() => {
    if (!revisionOffer) return;
    setAddonVersionId(revisionOffer.addonVersionId);
    setPublisherId(revisionOffer.publisherId ?? "");
    setOfferKind(revisionOffer.offerKind);
    setAmountDollars(revisionOffer.amountMinor === null ? "" : exactUsdFromMinor(revisionOffer.amountMinor));
    setLicenseKey(revisionOffer.licenseKey);
    setLicenseVersion(revisionOffer.licenseVersion);
    setCommercialTermsCode(revisionOffer.commercialTermsCode ?? "");
    setReason("");
    setConfirmation("");
    requestIdRef.current = "";
    setError("");
    setStatus("Draft details loaded from the durable private seller projection. Review every value and accept the current published terms before submitting a revision.");
  }, [revisionOffer]);

  function change(action: () => void) {
    action();
    requestIdRef.current = "";
    setStatus("");
    setError("");
  }

  async function configure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !canConfigure) return;
    setBusy(true);
    setError("");
    setStatus("Creating a separate inactive Marketplace test offer…");
    requestIdRef.current ||= createBillingClientRequestId();
    try {
      const result = await configureMarketplaceSellerOffer({
        clientRequestId: requestIdRef.current,
        addonVersionId,
        publisherId: publisherId || null,
        offerKind: offerKind as "free" | "paid",
        amountMinor: offerKind === "paid" ? amountMinor : null,
        licenseKey: licenseKey.trim(),
        licenseVersion: licenseVersion.trim(),
        buyerTermsVersion,
        commercialTermsCode: offerKind === "paid" ? commercialTermsCode.trim() : null,
        sellerAgreementVersion: offerKind === "free" ? freeSellerAgreementVersion : sellerAgreementVersion,
        confirmation: "CONFIGURE MARKETPLACE TEST OFFER",
        reason
      }, accessToken);
      requestIdRef.current = "";
      setAddonVersionId("");
      setPublisherId("");
      setOfferKind("");
      setAmountDollars("");
      setLicenseKey("");
      setLicenseVersion("1.0");
      setCommercialTermsCode("");
      setReason("");
      setConfirmation("");
      setStatus(`${result.idempotentReplay ? "The matching prior inactive-offer request was recovered." : revisionOffer ? "The inactive draft was revised safely." : `Inactive ${result.offerKind} test offer configured.`} Commission is ${(result.commissionBps / 100).toFixed(2)}%. ${result.providerCatalogConfigured ? "The Stripe test catalog entry was prepared." : "No provider price was created for this free offer."} Activation remains a separate deliberate status action in the durable owned-offer list.`);
      await onComplete();
    } catch (requestError) {
      setError(billingErrorMessage(requestError));
      setStatus("");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  }

  return <form className="seller-offer-form" onSubmit={configure} noValidate>
    <div className="section-heading section-heading--inline"><div><h4>{revisionOffer ? "Revise an inactive draft offer" : "Prepare a license offer for an owned reviewed version"}</h4></div>{revisionOffer && <button type="button" disabled={busy} onClick={() => { setAddonVersionId(""); setPublisherId(""); setOfferKind(""); setAmountDollars(""); setLicenseKey(""); setLicenseVersion("1.0"); setCommercialTermsCode(""); setReason(""); setConfirmation(""); requestIdRef.current = ""; setStatus(""); setError(""); onCancelRevision(); }}>Cancel revision</button>}</div>
    <p>Only a published, approved, non-revoked version owned by your developer profile is eligible; the server enforces ownership. Configuration creates a new inactive draft or safely revises the existing inactive draft for that version. It never reviews or publishes the version.</p>
    {!versionOptions.length ? <p className="commons-empty-state">No reviewed live version is available in the current bounded Marketplace projection. Submit and complete ordinary review before configuring an offer.</p> : <>
      <label><span>Reviewed listing version</span><select value={addonVersionId} disabled={busy || Boolean(revisionOffer)} required onChange={(event) => change(() => setAddonVersionId(event.target.value))}><option value="">Choose one reviewed version</option>{versionOptions.map((addon) => <option value={addon.addonVersionId} key={addon.addonVersionId}>{addon.listingName} · {addon.version}</option>)}</select></label>{revisionOffer && <p className="small-note">A revision remains bound to this draft's reviewed version. Cancel the revision to prepare a different version.</p>}
      <label><span>Publisher identity on this offer (optional)</span><select value={publisherId} disabled={busy} onChange={(event) => change(() => setPublisherId(event.target.value))}><option value="">No separate publisher sidecar</option>{revisionPublisherMissingFromProjection && revisionOffer?.publisherId && <option value={revisionOffer.publisherId}>Previously linked publisher (details outside bounded options)</option>}{publisherOptions.filter((publisher) => publisher.linked).map((publisher) => <option value={publisher.publisherId} key={publisher.publisherId}>{publisher.name} · {publisher.verified ? "verified independently" : "not verified"}</option>)}</select><small>Only an already-linked publisher owned by this account may be selected. Choosing it does not change verification or listing review; the server rechecks a retained link during revision.</small></label>
      <fieldset className="operator-choice-fieldset"><legend>Offer kind</legend><div className="button-row"><label className="checkbox-line"><input type="radio" name="seller-offer-kind" checked={offerKind === "free"} disabled={busy || !allowFree} onChange={() => change(() => setOfferKind("free"))} /> Free license</label><label className="checkbox-line"><input type="radio" name="seller-offer-kind" checked={offerKind === "paid"} disabled={busy || !allowPaid} onChange={() => change(() => setOfferKind("paid"))} /> Paid test offer</label></div><p className="small-note">No new offer kind is preselected. Free offers require the separate free-seller agreement but no Stripe Connect account. Paid test offers require completed test seller onboarding and remain unavailable unless all economic, webhook, seller, and payout gates allow them.</p></fieldset>
      {offerKind === "paid" && <><label><span>One-time test price in US dollars</span><input type="number" min="0.50" max="100000" step="0.01" inputMode="decimal" value={amountDollars} disabled={busy} required onChange={(event) => change(() => setAmountDollars(event.target.value))} aria-describedby="seller-price-help" /></label><p id="seller-price-help" className="small-note">Enter between $0.50 and $100,000 with no more than two decimal places. The browser rejects—not rounds—fractional cents.</p>{amountDollars && amountMinor === null && <p className="validation validation--bad" role="alert">Enter an exact USD amount with at most two decimal places; no price has been configured.</p>}<label><span>Approved commercial-terms code</span><input value={commercialTermsCode} maxLength={117} disabled={busy} required onChange={(event) => change(() => setCommercialTermsCode(event.target.value))} aria-describedby="commercial-terms-help" /></label><p id="commercial-terms-help" className="small-note">Use only the active test commercial-terms code supplied through the approved seller agreement. Do not invent a commission or terms code.</p></>}
      <label><span>License key</span><input value={licenseKey} maxLength={101} disabled={busy} required placeholder="example.license" onChange={(event) => change(() => setLicenseKey(event.target.value))} /></label>
      <label><span>License version</span><input value={licenseVersion} maxLength={120} disabled={busy} required onChange={(event) => change(() => setLicenseVersion(event.target.value))} /></label>
      <label><span>Private audit reason</span><textarea value={reason} minLength={8} maxLength={1000} disabled={busy} required onChange={(event) => change(() => setReason(event.target.value))} /></label>
      <label><span>Typed confirmation</span><input value={confirmation} disabled={busy} autoComplete="off" spellCheck={false} onChange={(event) => change(() => setConfirmation(event.target.value))} aria-describedby="seller-offer-confirmation-help" /></label><p id="seller-offer-confirmation-help" className="small-note">Type <code>CONFIGURE MARKETPLACE TEST OFFER</code> exactly. Configuration creates or revises only an inactive draft; activation remains separate.</p>
      {error && <div className="validation validation--bad" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
      <p className="inline-status operator-live-region" role="status" aria-live="polite" aria-atomic="true">{status}</p>
      <div className="button-row"><button className="button-primary" type="submit" disabled={!canConfigure}>{busy ? revisionOffer ? "Revising draft…" : "Configuring…" : revisionOffer ? "Revise inactive draft" : "Configure inactive test offer"}</button></div>
    </>}
    <p className="boundary-note">Neither configuration nor activation changes listing review, publication, safety labels, developer approval, publisher verification, search rank, governance, download, or Local Elysia installation authority.</p>
  </form>;
}

export default function MarketplaceCommerceAccountPanel() {
  const [searchParams] = useSearchParams();
  const commerceReturnState = searchParams.get("commerce");
  const sellerReturnState = searchParams.get("seller");
  const needsFreshOnboardingLink = sellerReturnState === "refresh";
  const { accessToken, loading: authLoading } = useAuth();
  const [licenses, setLicenses] = useState<MarketplaceOwnedLicense[]>([]);
  const [seller, setSeller] = useState<MarketplaceSellerStatus | null>(null);
  const [revisionOffer, setRevisionOffer] = useState<MarketplaceSellerOwnedOffer | null>(null);
  const [capabilities, setCapabilities] = useState<BillingCapabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sellerAgreementAccepted, setSellerAgreementAccepted] = useState(false);
  const [connectDisclosureAccepted, setConnectDisclosureAccepted] = useState(false);
  const [freeAgreementAccepted, setFreeAgreementAccepted] = useState(false);
  const [freeAgreementConfirmation, setFreeAgreementConfirmation] = useState("");
  const [freeAgreementAcceptedVersion, setFreeAgreementAcceptedVersion] = useState<string | null>(null);
  const [busy, setBusy] = useState<"free-agreement" | "onboarding" | "refresh" | null>(null);
  const freeAgreementRequestIdRef = useRef("");
  const onboardingRequestIdRef = useRef("");
  const refreshRequestIdRef = useRef("");
  const errorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!accessToken) {
      setLicenses([]);
      setSeller(null);
      setRevisionOffer(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [purchaseResult, sellerResult] = await Promise.allSettled([
      loadMarketplacePurchases(accessToken),
      loadMarketplaceSellerStatus(accessToken)
    ]);
    if (purchaseResult.status === "fulfilled") setLicenses(purchaseResult.value.licenses);
    else setError(billingErrorMessage(purchaseResult.reason));
    if (sellerResult.status === "fulfilled") {
      setSeller(sellerResult.value);
      setRevisionOffer((current) => {
        if (!current) return null;
        const refreshed = sellerResult.value.ownedOffers.find((offer) => offer.offerId === current.offerId);
        return refreshed?.canRevise ? refreshed : null;
      });
    }
    else setSeller(null);
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let active = true;
    void loadBillingCapabilities().then((result) => { if (active) setCapabilities(result); }).catch(() => {
      if (!active) return;
      setCapabilities(null);
      setError((current) => current || "Marketplace commerce legal-version availability could not be verified. License and seller records remain readable where available, but agreement and offer mutations stay disabled.");
    });
    return () => { active = false; };
  }, []);

  const sellerAgreementDocument = capabilities?.legalDocumentVersions?.marketplaceSellerAgreement ?? null;
  const freeSellerAgreementDocument = capabilities?.legalDocumentVersions?.marketplaceFreeSellerAgreement ?? null;
  const connectDisclosureDocument = capabilities?.legalDocumentVersions?.stripeConnectSellerDisclosure ?? null;
  const effectiveFreeAgreementVersion = seller?.freeSellerAgreementVersion ?? freeAgreementAcceptedVersion;
  const currentFreeAgreementAccepted = Boolean(freeSellerAgreementDocument && effectiveFreeAgreementVersion === freeSellerAgreementDocument.version);

  async function acceptFreeSellerAgreement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !accessToken || !freeSellerAgreementDocument) return;
    setError("");
    setMessage("");
    if (!freeAgreementAccepted || freeAgreementConfirmation !== "ACCEPT FREE MARKETPLACE SELLER AGREEMENT") {
      setError("Accept the free-seller agreement and type the exact confirmation before continuing.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setBusy("free-agreement");
    freeAgreementRequestIdRef.current ||= createBillingClientRequestId();
    try {
      const result = await acceptMarketplaceFreeSellerAgreement({
        clientRequestId: freeAgreementRequestIdRef.current,
        agreementVersion: freeSellerAgreementDocument.version,
        sourceRoute: "/marketplace/account",
        acceptAgreement: true,
        confirmation: "ACCEPT FREE MARKETPLACE SELLER AGREEMENT"
      }, accessToken);
      setFreeAgreementAcceptedVersion(result.agreementVersion);
      setFreeAgreementAccepted(false);
      setFreeAgreementConfirmation("");
      freeAgreementRequestIdRef.current = "";
      setMessage("The free Marketplace seller agreement is recorded. Stripe Connect is not required for free offers; review, publication, developer status, publisher identity, and offer activation remain separate.");
      await load();
    } catch (requestError) {
      setError(billingErrorMessage(requestError));
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(null);
    }
  }

  async function beginOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !accessToken) return;
    setError("");
    setMessage("");
    if (!sellerAgreementDocument || !connectDisclosureDocument) {
      setError("The reviewed Marketplace seller agreement or Stripe Connect disclosure version is unavailable. No onboarding link was created.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    if (!sellerAgreementAccepted || !connectDisclosureAccepted) {
      setError("Accept both the seller agreement and the separate Stripe Connect test-mode disclosure before continuing.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setBusy("onboarding");
    onboardingRequestIdRef.current ||= createBillingClientRequestId();
    try {
      const result = await createMarketplaceSellerOnboarding({
        clientRequestId: onboardingRequestIdRef.current,
        sellerAgreementVersion: sellerAgreementDocument.version,
        stripeConnectDisclosureVersion: connectDisclosureDocument.version,
        sourceRoute: "/marketplace/account",
        acceptSellerAgreement: true,
        acceptStripeConnectDisclosure: true
      }, accessToken);
      setMessage("Opening Stripe Connect test onboarding. Identity, tax, and bank details are entered on Stripe, not in a Commons Profile.");
      window.location.assign(result.onboardingUrl);
    } catch (requestError) {
      setBusy(null);
      setError(billingErrorMessage(requestError));
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }

  async function refreshSeller() {
    if (busy || !accessToken) return;
    setBusy("refresh");
    setError("");
    setMessage("Refreshing seller readiness from Stripe test mode by explicit request…");
    refreshRequestIdRef.current ||= createBillingClientRequestId();
    try {
      const next = await refreshMarketplaceSellerStatus(refreshRequestIdRef.current, accessToken);
      setSeller(next);
      refreshRequestIdRef.current = "";
      setMessage("Private seller readiness refreshed. No provider identifiers or private provider reasons are shown here.");
    } catch (requestError) {
      setError(billingErrorMessage(requestError));
      setMessage("");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(null);
    }
  }

  return <section className="marketplace-commerce-account section-card"><FundingLink />
    <SellerPreparationPanel />
    <div className="section-heading section-heading--inline"><div><p className="eyebrow">Private Marketplace commerce</p><h2>Licenses and seller readiness</h2></div><span className="trust-badge">Test mode only</span></div>
    <p>These private economic records remain separate from your Commons Profile, Free Member recognition, badges, governance roles, developer status, publisher identity, listing review, and Local Elysia account.</p>
    {accessToken && (commerceReturnState === "success" || commerceReturnState === "canceled") && <CheckoutReturnStatus
      accessToken={accessToken}
      orderReference={searchParams.get("reference") ?? ""}
      returnState={commerceReturnState === "success" ? "complete" : "canceled"}
      expectedFlow="marketplace_purchase"
      serviceLabel="Marketplace license"
      boundary="Verified payment and a separately fulfilled license are required; neither authorizes download, installation, review, trust, ranking, publisher identity, or authority."
      onRefresh={load}
    />}
    {sellerReturnState === "returned" && <p className="boundary-note" role="status">Stripe Connect returned to Elysia. Provider return alone does not establish seller readiness. Use the explicit status-refresh button below to request current private test status.</p>}
    {needsFreshOnboardingLink && <p className="boundary-note" role="status">The Stripe Connect hosted onboarding link expired or was already visited. No seller-state change is being claimed. To obtain a fresh test-mode link, review and reaccept both disclosures below, then deliberately submit the onboarding form; this return page does not create a link automatically.</p>}
    {error && <div className="validation validation--bad" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
    <p className="inline-status operator-live-region" role="status" aria-live="polite" aria-atomic="true">{message}</p>
    {authLoading || loading ? <p aria-live="polite">Loading private Marketplace records…</p> : !accessToken ? <div className="member-gate"><p>Sign in to view account licenses or seller readiness. Public browsing, security review information, and free local Elysia remain available without purchasing anything.</p><div className="button-row"><Link className="button-link button-link--primary" to="/commons-circle">Sign in through Commons Circle</Link><Link className="button-link" to="/account/forgot-password">Recover account access</Link></div></div> : <>
      <div><h3>Account licenses</h3><LicenseList licenses={licenses} /></div>
      <div className="marketplace-seller-readiness"><div className="section-heading section-heading--inline"><div><p className="eyebrow">Eligible creators only</p><h3>Seller readiness</h3></div>{seller && <span className="trust-badge">{seller.status.replace(/_/g, " ")}</span>}</div>
        {!seller ? <p>Seller onboarding is disabled or unavailable. Developer submissions and free reviewed Marketplace listings remain separate and unchanged.</p> : <>
          <dl className="mini-facts"><div><dt>Seller eligibility</dt><dd>{seller.eligible ? "Eligible" : "Not currently eligible"}</dd></div><div><dt>Seller record</dt><dd>{seller.configured ? "Configured in test mode" : "Not configured"}</dd></div><div><dt>Provider details</dt><dd>{seller.detailsSubmitted ? "Submitted in test mode" : "Not complete"}</dd></div><div><dt>Test charges</dt><dd>{seller.chargesEnabled ? "Provider enabled in test mode" : "Disabled"}</dd></div><div><dt>Provider payout readiness</dt><dd>{seller.payoutsEnabled ? "Provider reports ready in test mode" : "Not ready"}</dd></div><div><dt>Elysia payout feature</dt><dd>{seller.payoutsEnabledByFeature ? "Enabled" : "Disabled"}</dd></div><div><dt>Payout preparation</dt><dd>{seller.payoutPreparationEnabled ? "Private test preparation enabled" : "Disabled"}</dd></div><div><dt>Payout execution</dt><dd>{seller.payoutExecutionAvailable ? "Available" : "Unavailable"}</dd></div><div><dt>Active offers</dt><dd>{seller.activeOfferCount}</dd></div><div><dt>Owned offer records</dt><dd>{seller.totalOwnedOfferCount}</dd></div></dl>
          {Object.keys(seller.availablePayableByCurrency).length > 0 && <div className="economic-summary-card"><strong>Private test accounting summary</strong>{Object.entries(seller.availablePayableByCurrency).map(([currency, amount]) => <p key={currency}>{money(amount, currency)} payable accounting state</p>)}<p className="small-note">These balances are private test records. They are not live funds, a payout promise, or proof that payout execution is available. Provider, bank, tax, buyer, and event identifiers are intentionally omitted.</p></div>}
          {seller.configured && <SellerOwnedOffers accessToken={accessToken} offers={seller.ownedOffers} totalCount={seller.totalOwnedOfferCount} truncated={seller.offersTruncated} onRevise={setRevisionOffer} onComplete={async () => { setRevisionOffer(null); await load(); }} />}
          {!seller.eligible ? <p className="boundary-note">Seller eligibility is server-assigned and cannot be purchased or self-declared. It does not grant developer approval, publisher verification, listing approval, reviewer power, or governance authority.</p> : <>
            {seller.publisherOptionsTruncated && <p className="boundary-note" role="status">This bounded view shows {seller.publisherOptions.length} of {seller.publisherOptionCount} owned publisher identities. Hidden publisher identities are not treated as absent and cannot be newly linked from this page.</p>}
            {seller.configured && <SellerPublisherLinkForm accessToken={accessToken} publishers={seller.publisherOptions} onComplete={load} />}
            <form className="seller-onboarding-consent" onSubmit={acceptFreeSellerAgreement} noValidate>
              <h4>Enable free license offers without Stripe Connect</h4>
              <p>A free offer has no checkout, seller payout, commission, bank, tax, or provider-account requirement. The ordinary Marketplace review and publication boundary still applies.</p>
              {!freeSellerAgreementDocument && <p className="boundary-note" role="status">The server has not published the exact free-seller agreement version. Acceptance stays disabled and this page will not guess a version.</p>}
              {currentFreeAgreementAccepted ? <p className="inline-status">Free-seller agreement version {effectiveFreeAgreementVersion} is recorded privately for this Website Account. Stripe Connect is not required for free offers.</p> : <>
                <label className="checkbox-line"><input type="checkbox" checked={freeAgreementAccepted} disabled={busy !== null || !freeSellerAgreementDocument} onChange={(event) => { setFreeAgreementAccepted(event.target.checked); freeAgreementRequestIdRef.current = ""; }} /><span>I accept the <Link to={legalDocumentLink(freeSellerAgreementDocument, "/legal/marketplace-commerce-terms")}>free Marketplace seller agreement{freeSellerAgreementDocument ? ` version ${freeSellerAgreementDocument.version}` : ""}</Link>. It permits only separate free-offer setup and grants no review, publication, developer, publisher, ranking, trust, or governance authority.</span></label>
                <label><span>Typed confirmation</span><input value={freeAgreementConfirmation} disabled={busy !== null || !freeSellerAgreementDocument} autoComplete="off" spellCheck={false} onChange={(event) => { setFreeAgreementConfirmation(event.target.value); freeAgreementRequestIdRef.current = ""; }} aria-describedby="free-seller-confirmation-help" /></label><p id="free-seller-confirmation-help" className="small-note">Type <code>ACCEPT FREE MARKETPLACE SELLER AGREEMENT</code> exactly.</p>
                <button className="button-primary" type="submit" disabled={busy !== null || !freeSellerAgreementDocument || !freeAgreementAccepted || freeAgreementConfirmation !== "ACCEPT FREE MARKETPLACE SELLER AGREEMENT"}>{busy === "free-agreement" ? "Recording agreement…" : "Accept free-seller agreement"}</button>
              </>}
            </form>
            <form className="seller-onboarding-consent" onSubmit={beginOnboarding} noValidate>
              <h4>{needsFreshOnboardingLink ? "Request a fresh Stripe Connect test link" : seller.configured ? "Continue or update Stripe Connect test onboarding" : "Begin Stripe Connect test onboarding"}</h4>
              <p>Stripe hosts identity, tax, bank, and payout-readiness collection. Do not put those details in profile fields, add-on manifests, submissions, Commune posts, or this website form.</p>
              {(!sellerAgreementDocument || !connectDisclosureDocument) && <p className="boundary-note" role="status">The server has not published the exact reviewed seller-agreement and Stripe Connect disclosure versions. Onboarding stays disabled and this page will not guess a version.</p>}
              <label className="checkbox-line"><input type="checkbox" checked={sellerAgreementAccepted} disabled={busy !== null || !sellerAgreementDocument} onChange={(event) => { setSellerAgreementAccepted(event.target.checked); onboardingRequestIdRef.current = ""; }} /><span>I accept the <Link to={legalDocumentLink(sellerAgreementDocument, "/legal/marketplace-commerce-terms")}>Marketplace Commerce Terms{sellerAgreementDocument ? ` (seller agreement version ${sellerAgreementDocument.version})` : ""}</Link>. I understand that seller onboarding, developer status, publisher identity, listing review, commercial-offer activation, and payout readiness are separate.</span></label>
              <label className="checkbox-line"><input type="checkbox" checked={connectDisclosureAccepted} disabled={busy !== null || !connectDisclosureDocument} onChange={(event) => { setConnectDisclosureAccepted(event.target.checked); onboardingRequestIdRef.current = ""; }} /><span>I accept the <Link to={legalDocumentLink(connectDisclosureDocument, "/legal/marketplace-commerce-terms")}>Stripe Connect test disclosure{connectDisclosureDocument ? ` version ${connectDisclosureDocument.version}` : ""}</Link>. Stripe—not Elysia's public profile system—receives the identity, tax, and bank information entered on its hosted surface. Test onboarding creates no live payout.</span></label>
              <div className="button-row"><button className="button-primary" type="submit" disabled={busy !== null || !sellerAgreementDocument || !connectDisclosureDocument || !sellerAgreementAccepted || !connectDisclosureAccepted}>{busy === "onboarding" ? "Opening Stripe Connect…" : needsFreshOnboardingLink ? "Create fresh Stripe Connect test link" : "Continue to Stripe Connect test mode"}</button>{seller.configured && <button type="button" disabled={busy !== null} onClick={() => void refreshSeller()}>{busy === "refresh" ? "Refreshing…" : "Refresh test seller status"}</button>}</div>
            </form>
          </>}
          <p className="boundary-note">Payment and provider onboarding never verify a publisher, approve or rank an add-on, grant authority, relax security review, or authorize local installation. A paid order is not evidence of a transfer, available provider balance, initiated payout or completed bank payout. No platform fee rate is adopted here. Real payouts remain disabled until business, legal, tax, banking, Stripe live-verification, and feature activation requirements are complete.</p>
          {seller.eligibleReviewedVersionsTruncated && <p className="boundary-note" role="status">Offer configuration shows {seller.eligibleReviewedVersions.length} of {seller.eligibleReviewedVersionCount} eligible reviewed versions. Versions outside this bounded projection are not treated as ineligible or absent.</p>}
          {seller.eligible && capabilities?.legalDocumentVersions && (currentFreeAgreementAccepted || (seller.configured && seller.status === "ready"))
            ? <SellerOfferForm accessToken={accessToken} reviewedVersions={seller.eligibleReviewedVersions} publisherOptions={seller.publisherOptions} sellerAgreementVersion={capabilities.legalDocumentVersions.marketplaceSellerAgreement.version} freeSellerAgreementVersion={capabilities.legalDocumentVersions.marketplaceFreeSellerAgreement.version} buyerTermsVersion={capabilities.legalDocumentVersions.marketplaceBuyerTerms.version} allowFree={currentFreeAgreementAccepted} allowPaid={seller.configured && seller.status === "ready"} revisionOffer={revisionOffer} onCancelRevision={() => setRevisionOffer(null)} onComplete={async () => { setRevisionOffer(null); await load(); }} />
            : seller.eligible && (effectiveFreeAgreementVersion !== null || (seller.configured && seller.status === "ready")) && <p className="boundary-note">Offer configuration remains disabled until the server publishes all exact Marketplace seller and buyer terms versions. No version will be guessed.</p>}
        </>}
      </div>
    </>}
  </section>;
}
