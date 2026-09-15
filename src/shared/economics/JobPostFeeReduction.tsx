import { useRef, useState, type FormEvent } from "react";
import { billingErrorMessage, currentBillingApiPublication, reduceJobPostFee } from "../billing/billingClient";
export default function JobPostFeeReduction({ jobPostId, token, refresh }: { jobPostId: string; token: string; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const pending = useRef<{ fingerprint: string; id: string } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget); const amountDueMinor = Number(form.get("amount")); const reason = String(form.get("reason") ?? "").trim();
    const fingerprint = JSON.stringify([jobPostId, amountDueMinor, reason]);
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, id: crypto.randomUUID() };
    setBusy(true); setMessage("");
    try { await reduceJobPostFee({ jobPostId, amountDueMinor, reason, clientRequestId: pending.current.id }, token); pending.current = null; setMessage("Reduced fee recorded. Content approval and publication remain separate."); await refresh(); }
    catch (error) { setMessage(billingErrorMessage(error)); } finally { setBusy(false); }
  }
  if (currentBillingApiPublication() === "disabled") return null;
  return <details className="economic-summary-card"><summary>Reduce EcoSyneva’s posting fee</summary><form className="auth-form" onSubmit={submit}><fieldset disabled={busy}><legend>Independent economic operator decision</legend><p>Applies to an assessed $10 commercial fee before checkout starts. Both fee-assessment and assistance authority are required. Use the existing full-waiver tools when no payment should be collected.</p><label>Amount due in USD cents<input name="amount" type="number" min="50" max="999" step="1" required /></label><label>Private decision reason<textarea name="reason" minLength={8} maxLength={1000} required /></label><button type="submit">{busy ? "Recording…" : "Record reduced fee"}</button></fieldset></form>{message && <p role="status">{message}</p>}</details>;
}
