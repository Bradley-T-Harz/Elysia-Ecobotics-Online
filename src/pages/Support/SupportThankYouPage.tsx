import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import StatusBadge from "../../shared/components/StatusBadge";
import { loadBillingOrder, type BillingOrderSummary } from "../../shared/billing/billingClient";
import { useAuth } from "../../shared/auth/useAuth";

const initialOrder: BillingOrderSummary = {
  flow: null,
  status: "processing",
  cadence: null,
  createdAt: null,
  verifiedAt: null,
  message: "Checking the server-verified order state. The browser redirect alone is not proof of payment."
};

const statusPresentation = {
  processing: { title: "Verification is processing", badge: "Processing", tone: "warning" as const },
  verified: { title: "Thank you for supporting Elysia", badge: "Verified by server", tone: "safe" as const },
  canceled: { title: "Checkout was not completed", badge: "Canceled or incomplete", tone: "warning" as const },
  failed: { title: "Payment was not verified", badge: "Needs attention", tone: "danger" as const },
  refunded: { title: "Payment refund recorded", badge: "Refunded", tone: "warning" as const },
  disputed: { title: "Payment dispute recorded", badge: "Disputed", tone: "warning" as const },
  unavailable: { title: "Verification is temporarily unavailable", badge: "Unavailable", tone: "warning" as const },
  unknown: { title: "No payment result is being claimed", badge: "Unknown", tone: "warning" as const }
};

export default function SupportThankYouPage() {
  const { accessToken, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const reference = searchParams.get("order") ?? "";
  const [order, setOrder] = useState<BillingOrderSummary>(initialOrder);
  const [loading, setLoading] = useState(Boolean(reference) || authLoading);

  const refresh = useCallback(async () => {
    if (authLoading) return;
    if (!reference) {
      setOrder({ flow: null, status: "unknown", cadence: null, createdAt: null, verifiedAt: null, message: "This page was opened without a private order reference. No payment success is being claimed. If Stripe sent a receipt, retain it and contact support if you need help." });
      setLoading(false);
      return;
    }
    setLoading(true);
    setOrder(await loadBillingOrder(reference, accessToken));
    setLoading(false);
  }, [accessToken, authLoading, reference]);

  useEffect(() => { void refresh(); }, [refresh]);

  const supportFlowMatches = order.flow === "support_one_time" || order.flow === "support_recurring";
  const flowMismatch = order.flow !== null && !supportFlowMatches;
  const presentation = flowMismatch ? statusPresentation.unknown : statusPresentation[order.status];
  return <div className="page-stack support-page support-thank-you-page">
    <PageHero eyebrow="Support Elysia" title={loading ? "Checking support status" : presentation.title} brandMark="standard">
      <p>{loading ? initialOrder.message : order.message}</p>
      <p>Payment never grants authority, special moderation treatment, developer approval, publication approval, or elevated community status.</p>
    </PageHero>
    <section className="section-card support-order-state" aria-live="polite" aria-busy={loading}>
      <div className="section-heading section-heading--inline"><div><p className="eyebrow">Private verification result</p><h2>{loading ? "Contacting the billing service" : presentation.title}</h2></div><StatusBadge label={loading ? "Checking" : presentation.badge} tone={loading ? "warning" : presentation.tone} /></div>
      <p>{loading ? "Please wait while the website checks its private order record. Do not refresh repeatedly or create another checkout while verification is pending." : flowMismatch ? "The private reference belongs to a different economic flow. This Support page does not identify it as support and claims no support payment or recognition from it." : order.message}</p>
      {order.status === "verified" && supportFlowMatches && <p className="inline-status">Stripe normally sends the payment receipt to the email entered during checkout. Signed-in support will appear in Support &amp; Billing after private reconciliation completes.</p>}
      {order.status === "processing" && supportFlowMatches && !loading && <p className="boundary-note">Webhook delivery can take a moment. The server—not this page—decides when a support record is verified.</p>}
      {(order.status === "failed" || order.status === "refunded" || order.status === "disputed" || order.status === "unavailable" || order.status === "unknown") && <p className="boundary-note">For help, email <a href="mailto:support@elysiaecobotics.com">support@elysiaecobotics.com</a>. Do not send card details, bank details, passwords, or full Stripe identifiers.</p>}
      <div className="button-row">
        {(order.status === "processing" || order.status === "unavailable") && <button type="button" disabled={loading} onClick={() => void refresh()}>{loading ? "Checking..." : "Check again"}</button>}
        <Link className="button-link button-link--primary" to="/commons-circle/support-billing">Open private Support &amp; Billing</Link>
        <Link className="button-link" to="/support">Back to Support</Link>
        <Link className="button-link" to="/archive#release-availability">Open the free release path</Link>
        <Link className="button-link" to="/">Return home</Link>
      </div>
    </section>
    <section className="section-card"><p className="eyebrow">Receipt and cancellation help</p><h2>Keep financial details private</h2><p>Receipts, recurring-support state, cancellation, sandbox credits, purchases, and seller summaries belong in private account or provider-hosted surfaces—not public profiles, badges, Commune posts, or Signal Console bodies.</p><div className="button-row"><Link className="button-link" to="/legal/refund-and-cancellation-policy">Refund and cancellation policy</Link><Link className="button-link" to="/legal/privacy-policy">Privacy policy</Link></div></section>
  </div>;
}
