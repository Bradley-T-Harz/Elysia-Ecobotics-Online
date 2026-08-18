import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import FeatureCard from "../../shared/components/FeatureCard";
import PageHero from "../../shared/components/PageHero";
import StatusBadge from "../../shared/components/StatusBadge";
import { billingErrorMessage, createBillingClientRequestId, createSupportCheckout, loadBillingCapabilities, loadPublicSponsorshipRecognition, loadPublicSupportRecognition, type BillingCapabilities, type RecurringSupportPriceCode, type SponsorshipRecognitionCatalog, type SupportCadence, type SupportRecognitionCatalog } from "../../shared/billing/billingClient";
import { exactUsdDecimalToMinor } from "../../shared/billing/exactMoney";
import { useAuth } from "../../shared/auth/useAuth";

const presetAmounts = [100, 500, 1500, 3000] as const;
const recurringPlans: ReadonlyArray<{ code: RecurringSupportPriceCode; name: string; cents: number; purpose: string }> = [
  { code: "support_monthly_seed_usd", name: "$1 monthly support", cents: 100, purpose: "A small recurring contribution toward shared infrastructure" },
  { code: "support_monthly_commons_usd", name: "$5 monthly support", cents: 500, purpose: "Helps with ordinary maintenance and documentation" },
  { code: "support_monthly_infrastructure_usd", name: "$12 monthly support", cents: 1200, purpose: "Helps fund hosting, security, and release work" },
  { code: "support_monthly_sandbox_usd", name: "$25 monthly support", cents: 2500, purpose: "Helps fund online sandbox and other infrastructure costs" },
  { code: "support_monthly_50_usd", name: "$50 monthly support", cents: 5000, purpose: "Helps subsidize broader public-interest access" }
];

function dollars(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(cents / 100);
}

export default function SupportPage() {
  const [searchParams] = useSearchParams();
  const fromLocalRelease = searchParams.get("source") === "products";
  const supportSourceRoute = fromLocalRelease ? "/products" as const : "/support" as const;
  const { accessToken, email, loading: authLoading } = useAuth();
  const [capabilities, setCapabilities] = useState<BillingCapabilities | null>(null);
  const [capabilitiesChecked, setCapabilitiesChecked] = useState(false);
  const [sponsorshipRecognition, setSponsorshipRecognition] = useState<SponsorshipRecognitionCatalog | null>(null);
  const [supportRecognition, setSupportRecognition] = useState<SupportRecognitionCatalog | null>(null);
  const [cadence, setCadence] = useState<SupportCadence>("one_time");
  const [amountChoice, setAmountChoice] = useState<string>(fromLocalRelease ? "" : "500");
  const [customAmount, setCustomAmount] = useState("");
  const [recurringPriceCode, setRecurringPriceCode] = useState<RecurringSupportPriceCode | "">("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);
  const checkoutRequestIdRef = useRef("");

  useEffect(() => {
    let active = true;
    void loadBillingCapabilities().then((result) => {
      if (!active) return;
      setCapabilities(result);
      setCapabilitiesChecked(true);
    }).catch(() => {
      if (!active) return;
      setCapabilities(null);
      setCapabilitiesChecked(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void loadPublicSupportRecognition().then((result) => { if (active) setSupportRecognition(result); }).catch(() => { if (active) setSupportRecognition(null); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    void loadPublicSponsorshipRecognition().then((result) => { if (active) setSponsorshipRecognition(result); }).catch(() => { if (active) setSponsorshipRecognition(null); });
    return () => { active = false; };
  }, []);

  const amountCents = useMemo(() => {
    if (cadence === "monthly") return recurringPlans.find((plan) => plan.code === recurringPriceCode)?.cents ?? 0;
    if (amountChoice !== "custom") return Number(amountChoice);
    return exactUsdDecimalToMinor(customAmount) ?? 0;
  }, [amountChoice, cadence, customAmount, recurringPriceCode]);

  const cadenceAvailable = cadence === "one_time"
    ? Boolean(capabilities?.supportCheckout)
    : Boolean(!fromLocalRelease && capabilities?.recurringSupport && accessToken);
  const activeSupportBundle = cadence === "one_time"
    ? capabilities?.legalConsentBundles?.support_one_time_checkout_bundle ?? null
    : capabilities?.legalConsentBundles?.support_recurring_checkout_bundle ?? null;
  const activeSupportTermsDocument = cadence === "one_time"
    ? activeSupportBundle?.documents.supportTerms ?? null
    : activeSupportBundle?.documents.recurringSupportTerms ?? null;
  const activeRefundDocument = activeSupportBundle?.documents.refundPolicy ?? null;
  const activePrivacyDocument = activeSupportBundle?.documents.privacyDisclosure ?? null;
  const canSubmit = Boolean(capabilities?.available && cadenceAvailable && activeSupportBundle && activeSupportTermsDocument && activeRefundDocument && activePrivacyDocument && amountCents >= 100 && amountCents <= 50_000 && (cadence === "one_time" || recurringPriceCode) && accepted && !busy);

  function chooseCadence(next: SupportCadence) {
    checkoutRequestIdRef.current = "";
    setCadence(next);
    setAccepted(false);
    setError("");
    setStatus("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setStatus("");
    if (cadence === "monthly" && !recurringPriceCode) {
      setError("Choose a fixed monthly support option before continuing.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    if (amountCents < 100 || amountCents > 50_000) {
      setError("Choose a support amount between $1 and $500.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    if (!accepted) {
      setError("Confirm the support, privacy, processor, and recurring-payment disclosures before continuing.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    if (cadence === "monthly" && !accessToken) {
      setError("Sign in to a Website Account before starting recurring support so renewal and cancellation remain recoverable.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    if (!cadenceAvailable) {
      setError("That checkout path is disabled. No payment was created.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    if (!activeSupportBundle || !activeSupportTermsDocument || !activeRefundDocument || !activePrivacyDocument) {
      setError("The reviewed legal-consent bundle for this support path is unavailable. No payment was created.");
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    setBusy(true);
    setStatus("Preparing a secure Stripe-hosted checkout...");
    try {
      checkoutRequestIdRef.current ||= createBillingClientRequestId();
      const result = await createSupportCheckout({ clientRequestId: checkoutRequestIdRef.current, amountCents, cadence, sourceRoute: supportSourceRoute, consentVersion: activeSupportBundle.version, priceCode: recurringPriceCode || undefined }, accessToken);
      if (!result.ok || !result.checkoutUrl) throw new Error(result.message);
      setStatus(result.message);
      window.location.assign(result.checkoutUrl);
    } catch (requestError) {
      setBusy(false);
      setStatus("");
      setError(requestError instanceof Error && requestError.message.includes("safe Stripe-hosted") ? requestError.message : billingErrorMessage(requestError));
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }

  return (
    <div className="page-stack support-page">
      <PageHero eyebrow="Voluntary support" title="Keep the commons alive" brandMark="standard" actions={<><a className="button-link button-link--primary" href="#support-checkout">Support Elysia</a><Link className="button-link" to="/archive">Continue without contributing</Link></>}>
        <p>Local Elysia and ordinary community participation remain free. Development, hosting, security, moderation, documentation, and the optional online coding sandbox still have real costs.</p>
        <p>Supporting Elysia is optional and deeply useful. EcoSyneva Commons LLC is building for sustainable operation, not extraction, wealth ranking, or control of the Commons.</p>
      </PageHero>
      {fromLocalRelease && <section className="section-card archive-support-boundary" aria-labelledby="release-support-separation-title"><p className="eyebrow">Separate from release availability</p><h2 id="release-support-separation-title">Nothing is being unlocked</h2><p>No public Elysia artifact is published yet. Optional support does not create a download, earlier access, a different artifact, updates, trust, authority, or support priority.</p><div className="button-row"><Link className="button-link button-link--primary" to="/archive">Return to release status</Link><a className="button-link" href="#support-checkout">Continue considering optional support</a></div></section>}
      {searchParams.get("checkout") === "canceled" && <div className="boundary-note" role="status">Stripe checkout was canceled or left before completion. No completed payment is being claimed, and nothing about your Website Account or community standing changed.</div>}

      <section className="feature-grid feature-grid--four support-promises" aria-label="Permanent support promises">
        <FeatureCard title="Free local core" tone="safe"><p>Local Elysia does not become subscription-locked. A website account is not required for ordinary local use.</p></FeatureCard>
        <FeatureCard title="No pay-to-govern" tone="safe"><p>Payment cannot purchase authority, moderation power, developer trust, publication approval, voting power, or preferential treatment.</p></FeatureCard>
        <FeatureCard title="No surveillance economy" tone="safe"><p>We do not sell local Elysia activity, conversations, private account data, or behavioral advertising profiles.</p></FeatureCard>
        <FeatureCard title="Honest infrastructure costs" tone="warning"><p>The online Commune sandbox uses remote infrastructure and remains separate from local coding and the free local application.</p></FeatureCard>
      </section>

      <section className="section-card support-checkout-card" id="support-checkout" aria-labelledby="support-checkout-title">
        <div className="section-heading section-heading--inline">
          <div><p className="eyebrow">Stripe-hosted checkout</p><h2 id="support-checkout-title">Choose support deliberately</h2></div>
          <StatusBadge
            label={!capabilitiesChecked
              ? "Checking availability"
              : capabilities === null
                ? "Availability unavailable"
                : capabilities.supportCheckout || capabilities.recurringSupport
                  ? "Stripe test checkout"
                  : "Support checkout disabled"}
            tone={capabilities?.supportCheckout || capabilities?.recurringSupport ? "safe" : "warning"}
          />
        </div>
        <p className="boundary-note">No recurring option is preselected. Stripe receives the payment, contact, device, and transaction information needed to process checkout. Stripe does not receive local Elysia memory, files, conversations, Commune content, profile interests, or sandbox source code through this form.</p>
        {capabilities && <p className={capabilities.supportCheckout || capabilities.recurringSupport ? "inline-status" : "demo-banner"}>{capabilities.supportCheckout || capabilities.recurringSupport ? "An explicitly enabled Stripe-hosted support checkout is available in test mode. No live charge can be created." : "Support checkout is disabled. Private cancellation or other account workflows may remain available separately."}</p>}
        {capabilitiesChecked && !capabilities && <p className="demo-banner" role="status">Checkout availability could not be verified. This page remains safely disabled; no payment was created and no legal version will be guessed.</p>}
        {!authLoading && <p className="support-account-context">{email ? <>Account-linked support will be associated with the signed-in Website Account for private history and cancellation. <strong>{email}</strong></> : <>One-time support can remain a guest checkout. Sign in through <Link to="/commons-circle">Commons Circle</Link> before choosing monthly support.</>}</p>}

        <form className="support-form" onSubmit={submit} noValidate>
          <fieldset>
            <legend>Support frequency</legend>
            <div className="support-choice-grid support-choice-grid--cadence">
              <label className={cadence === "one_time" ? "support-choice support-choice--selected" : "support-choice"}><input type="radio" name="support-cadence" value="one_time" checked={cadence === "one_time"} onChange={() => chooseCadence("one_time")} /><span><strong>One-time support</strong><small>No renewal.</small></span></label>
              <label className={cadence === "monthly" ? "support-choice support-choice--selected" : "support-choice"}><input type="radio" name="support-cadence" value="monthly" checked={cadence === "monthly"} onChange={() => chooseCadence("monthly")} disabled={fromLocalRelease || !capabilities?.recurringSupport || !accessToken} /><span><strong>Monthly sustaining support</strong><small>{fromLocalRelease ? "This archived release-context link permits no recurring selection; use the general Support page if desired." : "Renews monthly until canceled through Support & Billing or Stripe's secure portal."}</small></span></label>
            </div>
            {fromLocalRelease && <p className="small-note">This historical release-context link offers one-time support only, with no contribution amount preselected. Public artifact availability is controlled only by the Archive release status.</p>}
            {!capabilities?.recurringSupport && <p className="small-note">Recurring support is safely disabled until its test-mode product, webhook, account recovery, and cancellation path are configured.</p>}
          </fieldset>

          {cadence === "one_time" ? <fieldset>
            <legend>One-time amount in USD</legend>
            <div className="support-choice-grid support-choice-grid--amount">
              {presetAmounts.map((cents) => <label className={amountChoice === String(cents) ? "support-choice support-choice--selected" : "support-choice"} key={cents}><input type="radio" name="support-amount" value={cents} checked={amountChoice === String(cents)} onChange={() => { checkoutRequestIdRef.current = ""; setAmountChoice(String(cents)); }} /><span><strong>{dollars(cents)}</strong>{cents === 500 && <small>Suggested</small>}</span></label>)}
              <label className={amountChoice === "custom" ? "support-choice support-choice--selected support-choice--custom" : "support-choice support-choice--custom"}><input type="radio" name="support-amount" value="custom" checked={amountChoice === "custom"} onChange={() => { checkoutRequestIdRef.current = ""; setAmountChoice("custom"); }} /><span><strong>Custom</strong><small>$1–$500</small></span><input aria-label="Custom one-time support amount in US dollars" type="number" min="1" max="500" step="0.01" inputMode="decimal" value={customAmount} onFocus={() => setAmountChoice("custom")} onChange={(event) => { checkoutRequestIdRef.current = ""; setAmountChoice("custom"); setCustomAmount(event.target.value); }} /></label>
            </div>
          </fieldset> : <fieldset>
            <legend>Fixed monthly support option</legend>
            <div className="support-choice-grid support-choice-grid--plans">
              {recurringPlans.map((plan) => <label className={recurringPriceCode === plan.code ? "support-choice support-choice--selected" : "support-choice"} key={plan.code}><input type="radio" name="recurring-support-plan" value={plan.code} checked={recurringPriceCode === plan.code} onChange={() => { checkoutRequestIdRef.current = ""; setRecurringPriceCode(plan.code); }} /><span><strong>{plan.name}</strong><small>{plan.purpose}. It grants no authority, rank, or public financial status.</small></span></label>)}
            </div>
            <p className="small-note">No monthly option is preselected. Monthly support helps fund shared work; it does not itself promise sandbox credits or change safety limits, authority, badges, recognition, or rank.</p>
          </fieldset>}

          {cadence === "monthly" && <div className="boundary-note"><strong>Recurring-payment disclosure:</strong> {dollars(amountCents || 0)} will renew monthly until canceled. Cancellation does not remove your profile, Free Member recognition, content, developer status, purchases, existing badges, or governance participation.</div>}

          {(!activeSupportBundle || !activeSupportTermsDocument || !activeRefundDocument || !activePrivacyDocument) && <div className="boundary-note" role="status">The server has not published the complete reviewed consent bundle for this support path. Checkout remains disabled and no document or bundle version will be guessed.</div>}
          <label className="checkbox-line support-consent"><input type="checkbox" checked={accepted} disabled={!activeSupportBundle || !activeSupportTermsDocument || !activeRefundDocument || !activePrivacyDocument || busy} onChange={(event) => setAccepted(event.target.checked)} /><span>I understand this is optional support paid to EcoSyneva Commons LLC, not a tax-deductible charitable contribution; payment grants no authority; Stripe processes checkout; and the <Link to={activeSupportTermsDocument?.path ?? "/legal/support-and-billing-terms"}>Support &amp; Billing Terms{activeSupportBundle ? ` (consent bundle ${activeSupportBundle.version})` : ""}</Link>, <Link to={activeRefundDocument?.path ?? "/legal/refund-and-cancellation-policy"}>Refund and Cancellation Policy</Link>, and <Link to={activePrivacyDocument?.path ?? "/legal/privacy-policy"}>Privacy Policy</Link> apply.</span></label>

          {error && <div className="validation validation--bad" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
          {status && <p className="inline-status" aria-live="polite">{status}</p>}
          <div className="button-row"><button className="button-primary" type="submit" disabled={!canSubmit}>{busy ? "Opening secure checkout..." : `Continue to Stripe for ${dollars(amountCents || 0)}${cadence === "monthly" ? "/month" : ""}`}</button><Link className="button-link" to={fromLocalRelease ? "/archive" : "/"}>{fromLocalRelease ? "Return to release status" : "Not now"}</Link></div>
          <p className="small-note">This website never asks for card details. Checkout opens on Stripe. Arriving at the thank-you page does not by itself prove that a payment succeeded; the server verifies Stripe's signed webhook separately.</p>
        </form>
      </section>

      <section className="section-card">
        <p className="eyebrow">What support sustains</p>
        <h2>Practical work, public access, and careful infrastructure</h2>
        <div className="support-funds-grid">
          {["Local-first Elysia development", "Security review and release engineering", "Elysia Ecobotics Online hosting", "Commune moderation and safety", "Documentation and onboarding", "Sandbox server costs", "Subsidized student and public-interest access", "Environmental research and ecological technology"].map((item) => <div key={item}>{item}</div>)}
        </div>
      </section>

      <section className="section-card support-organization-path">
        <p className="eyebrow">Organizations and ethical sponsorship</p>
        <h2>Begin with a human-reviewed proposal, not a self-serve purchase.</h2>
        <p>Organizations may ask about clearly scoped training, implementation, research, accessibility, ecological technology, or other professional services. Potential sponsorships are reviewed for mission fit, truthful disclosure, privacy, and independence before any agreement is offered.</p>
        <p className="boundary-note">No payment or contract can purchase governance, moderation, review outcomes, publication approval, search prominence, endorsement, user data, or control of the Commons. Waived and subsidized access remain legitimate and private; they are not public status labels.</p>
        {sponsorshipRecognition?.enabled && sponsorshipRecognition.recognitions.length > 0 && <div className="sponsorship-recognition-list" aria-label="Reviewed opt-in sponsorship acknowledgments"><h3>Reviewed, opt-in acknowledgments</h3><p>Only a sponsor-approved public label, bounded summary, and purpose appear. Amounts, agreement terms, contacts, payment state, waivers, and balances remain private.</p>{sponsorshipRecognition.recognitions.map((recognition) => <article className="economic-summary-card" key={`${recognition.label}:${recognition.purposeCode}`}><strong>{recognition.label}</strong>{recognition.summary && <p>{recognition.summary}</p>}<p className="small-note">Purpose: {recognition.purposeCode.replace(/_/g, " ")}. This acknowledgment is not an endorsement and grants no authority.</p></article>)}</div>}
        <div className="button-row"><a className="button-link button-link--primary" href="mailto:contact@elysiaecobotics.com?subject=Organization%20services%20or%20ethical%20sponsorship%20inquiry">Contact EcoSyneva Commons LLC</a><Link className="button-link" to="/legal/organization-services-terms">Organization Services Terms</Link><Link className="button-link" to="/legal/sponsorship-independence-policy">Sponsorship Independence Policy</Link></div>
        <p className="small-note">Do not email payment credentials, bank details, tax records, identity documents, local Elysia memory, private files, or confidential source material. An initial inquiry should contain only the minimum information needed to understand the proposed scope.</p>
      </section>

      {supportRecognition?.enabled && supportRecognition.supporters.length > 0 && <section className="section-card support-recognition-public" aria-labelledby="support-recognition-title">
        <p className="eyebrow">Optional public thanks</p>
        <h2 id="support-recognition-title">Community members who chose acknowledgment</h2>
        <p>This unranked list contains only the member's chosen public display name after explicit opt-in. It never publishes an amount, cadence, plan, waiver, refund, dispute, balance, provider identifier, or financial history.</p>
        <ul className="support-recognition-list">{supportRecognition.supporters.map((supporter) => <li key={supporter.username}>{supporter.displayName}</li>)}</ul>
        <p className="boundary-note">Acknowledgment is gratitude, not a badge, endorsement, trust signal, donor rank, governance role, moderation power, review authority, service priority, or evidence of greater dignity. A member may withdraw it through their private Support &amp; Billing room.</p>
      </section>}

      <section className="section-card support-legal-disclosure">
        <p className="eyebrow">Entity and help</p>
        <h2>Clear responsibility</h2>
        <p>Elysia Ecobotics is a project and brand of EcoSyneva Commons LLC. Support payments are made to EcoSyneva Commons LLC and are not presented as tax-deductible charitable contributions.</p>
        <p>Questions, a mistaken payment, or a refund request: <a href="mailto:support@elysiaecobotics.com">support@elysiaecobotics.com</a>. Never email card numbers, bank details, passwords, identity documents, or Stripe credentials.</p>
        <div className="button-row"><Link className="button-link" to="/legal/support-and-billing-terms">Support terms</Link><Link className="button-link" to="/legal/refund-and-cancellation-policy">Refund and cancellation</Link><Link className="button-link" to="/legal/privacy-policy">Privacy</Link></div>
      </section>
    </div>
  );
}
