import { useState } from "react";
import { Link } from "react-router-dom";
import { usePreparation } from "../../../shared/economics/usePreparation.ts";
import { PreparationBlockers, PreparationForm, PreparationReason, PreparationStatus, PreparationUnavailable, ProviderHandoffNotice, preparationMoney } from "../../../shared/economics/PreparationComponents";
import type { OfferPreparation } from "../../../shared/economics/preProviderContracts.ts";
const value = (data: FormData, key: string) => String(data.get(key) ?? "");

export default function SellerPreparationPanel() {
  const work = usePreparation("seller");
  const [editing, setEditing] = useState<OfferPreparation | null>(null);
  const [offerId, setOfferId] = useState(() => crypto.randomUUID());
  const [kind, setKind] = useState<"free" | "commercial">("free");
  const state = work.state; const seller = state?.sellers[0];
  const disabled = work.busy || work.loading || !state?.lanes.sellers;
  return <section className="preparation-workspace" aria-labelledby="seller-preparation-title">
    <div className="section-card"><p className="eyebrow">Creator Marketplace</p><h2 id="seller-preparation-title">Prepare your seller account</h2><p>Prepare your identity link, terms acknowledgment and free or commercial offerings. This does not approve a publisher or add-on, enable payments, or change community standing.</p></div>
    {work.loading && <p role="status">Loading private seller preparation…</p>}
    {work.error && <p className="validation validation--bad" role="alert">{work.error}</p>}
    <p role="status" aria-live="polite">{work.message}</p>
    {!state && !work.loading && <PreparationUnavailable signedIn={work.signedIn} published={work.published} />}
    {state && <>
      <section className="section-card"><div className="section-heading section-heading--inline"><h3>Internal seller readiness</h3><PreparationStatus status={seller?.status === "approved" && seller.blockers.every(blocker => ["commercial_policy_pending", "provider_onboarding_disabled", "payouts_disabled"].includes(blocker)) ? "READY" : "BLOCKED"} /></div><p>{seller ? `Application: ${seller.status.replace(/_/g, " ")} · revision ${seller.revision}` : "No seller application has been recorded."} READY describes internal review only.</p>{!state.sellerEligible && <p>A recoverable Website Account and an eligible developer profile are required. <Link to="/developer-forge/dashboard">Open Developer Forge</Link>.</p>}{seller?.reviewReason && <p>Review response: {seller.reviewReason}</p>}<PreparationBlockers blockers={seller?.blockers ?? ["seller_application_required"]} /><button type="button" onClick={() => void work.refresh()} disabled={work.busy}>Refresh seller state</button></section>
      {state.sellerEligible && (!seller || !["submitted", "suspended"].includes(seller.status)) && <PreparationForm key={`profile-${seller?.revision ?? 0}`} title="Seller profile" busy={disabled} label="Save seller preparation" submit={data => work.run({ action: "seller_save", expectedRevision: seller?.revision ?? 0, displayName: value(data, "displayName"), supportUrl: value(data, "supportUrl"), intent: value(data, "intent") as "free" | "commercial" | "both" })}>
        <label><span>Seller display name</span><input name="displayName" defaultValue={seller?.displayName ?? ""} minLength={2} maxLength={80} required /></label>
        <label><span>Public support page (optional)</span><input name="supportUrl" type="url" defaultValue={seller?.supportUrl ?? ""} maxLength={300} placeholder="https://example.org/support" /><small>Use a public page without private access tokens. Do not enter a bank, card or tax identifier.</small></label>
        <label><span>Offering intent</span><select name="intent" defaultValue={seller?.intent ?? "free"}><option value="free">Free offerings</option><option value="commercial">Intended commercial offerings</option><option value="both">Free and intended commercial offerings</option></select></label>
        <p>Changing this preparation returns it to draft for a fresh internal review. It never changes your verified creator identity.</p>
      </PreparationForm>}
      {seller && !["submitted", "suspended"].includes(seller.status) && <>
        <PreparationForm title="Terms acknowledgment" busy={disabled} label="Record terms acknowledgment" submit={() => work.run({ action: "seller_terms", expectedRevision: seller.revision, documentVersion: state.termsVersion, accept: true })}>
          <label className="checkbox-line"><input type="checkbox" required /><span>I accept the <Link to={`${state.termsPath}?version=${encodeURIComponent(state.termsVersion)}`}>Marketplace Commerce Terms ({state.termsVersion})</Link> for this seller preparation. Final commercial fee and provider arrangements still require review and any further applicable consent. This does not authorize payment-provider onboarding.</span></label>
        </PreparationForm>
        <PreparationForm title="Link your publisher identity" busy={disabled} label="Record publisher link" submit={data => work.run({ action: "seller_link", expectedRevision: seller.revision, publisherId: value(data, "publisherId"), reason: value(data, "reason") })}>
          <label><span>Your publisher</span><select name="publisherId" defaultValue={seller.publisherId ?? ""} required><option value="">Choose your publisher</option>{state.publisherOptions.map(option => <option key={option.publisherId} value={option.publisherId}>{option.name} · {option.verified ? "verified" : "verification pending"}</option>)}</select></label><PreparationReason /><p>Linking proves ownership of an existing publisher record. It cannot grant publisher verification.</p>
        </PreparationForm>
        {seller.status !== "approved" && <div className="section-card"><button className="button-primary" type="button" disabled={disabled || !seller.publisherId || seller.termsVersion !== state.termsVersion} onClick={() => void work.run({ action: "seller_submit", expectedRevision: seller.revision })}>Submit internal seller review</button><p>Verified publisher ownership, current terms and creator eligibility are checked again by the server.</p></div>}
      </>}
      {seller && !["suspended", "withdrawn"].includes(seller.status) && <PreparationForm title="Withdraw this preparation" busy={disabled} label="Withdraw seller preparation" submit={data => work.run({ action: "seller_withdraw", expectedRevision: seller.revision, reason: value(data, "reason") })}><PreparationReason /><p>Withdrawal retains records and history. It does not delete your account or cancel a provider agreement.</p></PreparationForm>}
      {seller && !["suspended", "withdrawn", "rejected"].includes(seller.status) && <PreparationForm key={editing?.offerId ?? offerId} title={editing ? "Revise offering preparation" : "Prepare an offering"} busy={disabled} label="Save offering draft" submit={async data => {
        const success = await work.run({ action: "offer_save", expectedRevision: editing?.revision ?? 0, offerId: editing?.offerId ?? offerId, addonVersionId: value(data, "addonVersionId"), kind, amountMinor: kind === "free" ? 0 : Number(value(data, "amountMinor")), currency: "usd", licenseKey: value(data, "licenseKey"), licenseVersion: value(data, "licenseVersion"), feeProposalId: kind === "free" ? null : value(data, "feeProposalId") });
        if (success) { setEditing(null); setOfferId(crypto.randomUUID()); setKind("free"); }
      }}>
        <label><span>Reviewed add-on version</span><select name="addonVersionId" defaultValue={editing?.addonVersionId ?? ""} required><option value="">Choose a reviewed version</option>{state.versionOptions.map(option => <option key={option.addonVersionId} value={option.addonVersionId}>{option.name} · {option.version}</option>)}</select></label>
        <label><span>Offering kind</span><select value={kind} onChange={event => setKind(event.target.value as "free" | "commercial")}><option value="free">Free</option><option value="commercial">Intended commercial offering</option></select></label>
        {kind === "commercial" && <><label><span>Proposed price in USD cents</span><input name="amountMinor" type="number" defaultValue={editing?.amountMinor ?? ""} min={1} max={100_000_000_000} step={1} required /></label><label><span>Fee proposal to review</span><select name="feeProposalId" defaultValue={editing?.feeProposalId ?? "e9090800-0000-4000-8000-000000000005"} required>{state.proposals.filter(proposal => proposal.kind === "marketplace_fee_bps").map(proposal => <option key={proposal.proposalId} value={proposal.proposalId}>{proposal.value / 100}% · owner decision pending · {new Date(proposal.createdAt).toLocaleDateString()}</option>)}</select></label><p>The proposed default is 5%. No fee is adopted, no price is created at a provider, and the draft is not a purchasable offer.</p></>}
        {kind === "free" && <p>Free offerings have a zero price and no platform fee. They do not require payment-provider onboarding.</p>}
        <label><span>Buyer license identifier</span><input name="licenseKey" defaultValue={editing?.licenseKey ?? ""} minLength={2} maxLength={100} required /></label><label><span>License version</span><input name="licenseVersion" defaultValue={editing?.licenseVersion ?? ""} maxLength={120} required /></label><p>The selected add-on version, license, price and fee proposal are retained with the draft. Internal preparation never bypasses content or security review.</p>
        {editing && <button type="button" onClick={() => { setEditing(null); setKind("free"); }}>Cancel editing</button>}
      </PreparationForm>}
      <section className="section-card"><h3>Your prepared offerings</h3>{!state.offers.length && <p>No offering drafts are in this bounded view.</p>}<div className="economic-capability-grid">{state.offers.map(offer => <article className="economic-summary-card" key={offer.offerId}><h4>{offer.kind === "free" ? "Free offering" : "Commercial preparation"} · {preparationMoney(offer.amountMinor, offer.currency)}</h4><p>{offer.status.replace(/_/g, " ")} · {offer.licenseKey} {offer.licenseVersion}</p><PreparationBlockers blockers={offer.blockers} />{offer.status !== "retired" && <button type="button" disabled={disabled} onClick={() => { setEditing(offer); setKind(offer.kind); }}>Revise this offering</button>}</article>)}</div></section>
      {state.truncated && <p className="boundary-note">This is a bounded view. More retained records may exist; hidden records are not treated as absent.</p>}
    </>}
    <ProviderHandoffNotice />
  </section>;
}
