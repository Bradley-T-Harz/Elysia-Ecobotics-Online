import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../shared/auth/useAuth";
import {
  acceptMarketplaceFreeLicense,
  billingErrorMessage,
  createBillingClientRequestId,
  createMarketplaceCheckout,
  loadBillingCapabilities,
  loadMarketplaceCommerceCatalog,
  type BillingCapabilities,
  type MarketplaceCommercialOffer
} from "../../../shared/billing/billingClient";
import type { AddonManifest } from "../types";

function money(amountMinor: number, currency: "usd") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amountMinor / 100);
}

function matchingOffer(offers: MarketplaceCommercialOffer[], addon: AddonManifest) {
  if (!addon.marketplace_listing_id || !addon.marketplace_addon_version_id) return null;
  return offers.find((offer) => offer.listingId === addon.marketplace_listing_id && offer.addonVersionId === addon.marketplace_addon_version_id) ?? null;
}

export default function MarketplaceCommercePanel({ addon }: { addon: AddonManifest }) {
  const { accessToken, loading: authLoading } = useAuth();
  const [offer, setOffer] = useState<MarketplaceCommercialOffer | null>(null);
  const [catalogAvailable, setCatalogAvailable] = useState<boolean | null>(null);
  const [capabilities, setCapabilities] = useState<BillingCapabilities | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  const clientRequestIdRef = useRef("");

  useEffect(() => {
    let active = true;
    void Promise.allSettled([loadMarketplaceCommerceCatalog(), loadBillingCapabilities()]).then(([catalogResult, capabilitiesResult]) => {
      if (!active) return;
      if (catalogResult.status === "fulfilled") {
        setCatalogAvailable(catalogResult.value.available);
        setOffer(matchingOffer(catalogResult.value.offers, addon));
      } else {
        setCatalogAvailable(false);
        setOffer(null);
      }
      setCapabilities(capabilitiesResult.status === "fulfilled" ? capabilitiesResult.value : null);
    });
    return () => { active = false; };
  }, [addon]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setStatus("");
    if (!offer || !accessToken) {
      setError("Sign in to a Website Account before accepting a license or starting test checkout.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    if (!accepted) {
      setError("Read and accept this offer's Marketplace Commerce Terms before continuing.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    const consentBundle = offer.offerKind === "free"
      ? capabilities?.legalConsentBundles?.marketplace_free_license_bundle ?? null
      : capabilities?.legalConsentBundles?.marketplace_purchase_checkout_bundle ?? null;
    const offerTermsDocument = offer.offerKind === "free"
      ? consentBundle?.documents.marketplaceLicenseTerms ?? null
      : consentBundle?.documents.marketplaceBuyerTerms ?? null;
    if (!consentBundle || !offerTermsDocument || offerTermsDocument.version !== offer.buyerTermsVersion) {
      setError("The exact reviewed consent bundle for this offer is unavailable or does not match the offer. No license or payment action occurred.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setBusy(true);
    clientRequestIdRef.current ||= createBillingClientRequestId();
    const input = { offerId: offer.offerId, clientRequestId: clientRequestIdRef.current, sourceRoute: "/marketplace" as const, consentVersion: consentBundle.version };
    try {
      if (offer.offerKind === "free") {
        const result = await acceptMarketplaceFreeLicense(input, accessToken);
        setStatus(`Free license terms accepted (${result.licenseKey}, version ${result.licenseVersion}). This records a license only; it does not download, install, approve, or authorize the add-on.`);
        clientRequestIdRef.current = "";
        setAccepted(false);
        setBusy(false);
        return;
      }
      const result = await createMarketplaceCheckout(input, accessToken);
      if (result.alreadyOwned) {
        setStatus(`This Website Account already has the offer license (${result.economicStatus.replace(/_/g, " ")}). No new checkout or local installation occurred.`);
        clientRequestIdRef.current = "";
        setAccepted(false);
        setBusy(false);
        return;
      }
      setStatus("Opening Stripe-hosted test checkout. A browser return is not proof of payment or license fulfillment; the signed webhook and server ledger decide.");
      window.location.assign(result.checkoutUrl);
    } catch (requestError) {
      setBusy(false);
      setError(billingErrorMessage(requestError));
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }

  if (!addon.marketplace_listing_id || !addon.marketplace_addon_version_id) return null;
  if (catalogAvailable === null) return <section className="marketplace-commerce-panel boundary-note" aria-live="polite">Checking whether this reviewed version has a separate test-mode license offer…</section>;
  if (!catalogAvailable || !offer) return <section className="marketplace-commerce-panel boundary-note"><strong>No active economic offer for this version.</strong> Existing Marketplace review, saving, permission review, and local-install preparation remain available on their existing free paths.</section>;

  const consentBundle = offer.offerKind === "free"
    ? capabilities?.legalConsentBundles?.marketplace_free_license_bundle ?? null
    : capabilities?.legalConsentBundles?.marketplace_purchase_checkout_bundle ?? null;
  const offerTermsDocument = offer.offerKind === "free"
    ? consentBundle?.documents.marketplaceLicenseTerms ?? null
    : consentBundle?.documents.marketplaceBuyerTerms ?? null;
  const refundDocument = consentBundle?.documents.refundPolicy ?? null;
  const privacyDocument = consentBundle?.documents.privacyDisclosure ?? null;
  const exactLegalMatch = Boolean(consentBundle && offerTermsDocument && privacyDocument && offerTermsDocument.version === offer.buyerTermsVersion && (offer.offerKind === "free" || refundDocument));
  const canSubmit = Boolean(accessToken && accepted && exactLegalMatch && !busy && !authLoading);
  return <form className="marketplace-commerce-panel section-card" onSubmit={submit} noValidate aria-labelledby="marketplace-commerce-title">
    <div className="section-heading section-heading--inline"><div><p className="eyebrow">Separate test-mode offer</p><h2 id="marketplace-commerce-title">{offer.offerKind === "free" ? "Accept the free license terms" : `License offer · ${money(offer.amountMinor as number, "usd")}`}</h2></div><span className="trust-badge">Stripe test mode</span></div>
    <p>The reviewed listing, this commercial offer, a Website Account license, payment state, and Local Elysia installation are separate records and decisions.</p>
    <dl className="mini-facts"><div><dt>Listing version</dt><dd>{offer.version}</dd></div><div><dt>Offer</dt><dd>{offer.offerKind === "free" ? "Free license acceptance" : `${money(offer.amountMinor as number, "usd")} one time in test mode`}</dd></div><div><dt>License</dt><dd>{offer.licenseKey} · {offer.licenseVersion}</dd></div><div><dt>Buyer terms</dt><dd>{offer.buyerTermsVersion}</dd></div></dl>
    <p className="boundary-note">{offer.offerKind === "paid" ? "This is a Stripe test checkout and moves no live money. Payment fulfillment requires a verified server webhook." : "No payment is required for this offer."} A license never grants trust, review approval, developer or publisher status, ranking, authority, download, installation, or expanded local permissions.</p>
    {!accessToken && !authLoading && <p className="member-gate">Sign in before accepting license terms. <Link to="/marketplace/account">Open Marketplace Account</Link> or <Link to="/account/forgot-password">recover account access</Link>.</p>}
    {!exactLegalMatch && <p className="boundary-note" role="status">The server has not published a matching complete legal-consent bundle for this offer. License acceptance and checkout stay disabled; this page will not guess a version.</p>}
    <label className="checkbox-line support-consent"><input type="checkbox" checked={accepted} disabled={busy || !accessToken || !exactLegalMatch} onChange={(event) => { setAccepted(event.target.checked); setError(""); setStatus(""); clientRequestIdRef.current = ""; }} /><span>I accept Marketplace Commerce Terms version {offer.buyerTermsVersion} in consent bundle {consentBundle?.version ?? "unavailable"} for this specific license offer; I understand that {offer.offerKind === "paid" ? "Stripe handles test checkout" : "no payment is required"}; and I understand that purchase or acceptance does not install or authorize the add-on. {offerTermsDocument && <Link to={offerTermsDocument.path}>Read the Marketplace Commerce Terms</Link>}{offer.offerKind === "paid" && refundDocument && <>, <Link to={refundDocument.path}>refund policy</Link></>}{privacyDocument && <>, and <Link to={privacyDocument.path}>privacy policy</Link></>}.</span></label>
    {error && <div className="validation validation--bad" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
    <p className="inline-status operator-live-region" role="status" aria-live="polite" aria-atomic="true">{status}</p>
    <button className="button-primary" type="submit" disabled={!canSubmit}>{busy ? "Working…" : offer.offerKind === "free" ? "Accept free license terms" : "Continue to Stripe test checkout"}</button>
  </form>;
}
