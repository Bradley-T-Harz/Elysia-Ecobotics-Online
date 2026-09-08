import { useState } from "react";
import { usePreparation } from "./usePreparation.ts";
import { PreparationForm, PreparationReason, PreparationRecords, PreparationStatus, PreparationUnavailable } from "./PreparationComponents";

export default function SupportPreparationPanel() {
  const work = usePreparation("account");
  const [kind, setKind] = useState<"support_cancellation" | "support_refund" | "acknowledgment_delivery">("support_cancellation");
  const state = work.state;
  return <section className="preparation-workspace" aria-labelledby="support-preparation-title"><div className="section-card"><p className="eyebrow">Optional support</p><h2 id="support-preparation-title">Support records and service requests</h2><p>One-time and recurring support remain separate from account standing, governance and personal compute. A request for cancellation or refund is not proof the provider completed it.</p></div>
    {work.loading && <p role="status">Loading private support preparation…</p>}{work.error && <p role="alert" className="validation validation--bad">{work.error}</p>}<p role="status" aria-live="polite">{work.message}</p>
    {!state && !work.loading && <PreparationUnavailable signedIn={work.signedIn} published={work.published} />}
    {state && <>
      <section className="section-card"><h3>Recurring support state</h3>{state.subscriptions.length ? state.subscriptions.map(subscription => <article className="economic-summary-card" key={subscription.subscriptionId}><PreparationStatus status="TEST" /><p>{subscription.status.replace(/_/g, " ")}{subscription.cancelAtPeriodEnd ? " · cancellation scheduled in the verified subscription record" : " · no scheduled cancellation in this record"}</p><p>Current period ends: {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleString() : "not established"}</p><code>{subscription.subscriptionId}</code></article>) : <p>No subscriptions are in this bounded view.</p>}</section>
      <PreparationForm title="Request support follow-up" busy={work.busy || work.loading || !state.lanes.support} label="Record follow-up request" submit={data => work.run({ action: "support_request", kind, targetId: String(data.get("targetId") ?? ""), amountMinor: kind === "support_refund" ? Number(data.get("amountMinor")) : null, reason: String(data.get("reason") ?? "") })}>
        <label><span>Request kind</span><select value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="support_cancellation">Cancel recurring support</option><option value="support_refund">Request a support refund</option><option value="acknowledgment_delivery">Ask about acknowledgment delivery</option></select></label>
        <label><span>{kind === "support_cancellation" ? "Your recurring subscription" : "Your Support Acknowledgment"}</span><select name="targetId" key={kind} required defaultValue=""><option value="">Choose a verified record</option>{kind === "support_cancellation" ? state.subscriptions.filter(item => !["canceled", "ended"].includes(item.status)).map(item => <option key={item.subscriptionId} value={item.subscriptionId}>{item.status} · {item.subscriptionId}</option>) : state.records.filter(item => item.kind === "support_acknowledgment" && item.orderId).map(item => <option key={item.recordId} value={item.orderId!}>{new Date(item.createdAt).toLocaleDateString()} · {item.orderId}</option>)}</select></label>
        {kind === "support_refund" && <label><span>Requested amount in the record's minor currency units</span><input type="number" name="amountMinor" min={1} max={100_000_000_000} step={1} required /></label>}<PreparationReason /><p>Internal review can prepare a provider handoff. It cannot complete cancellation, send money or establish email delivery.</p>
      </PreparationForm>
      <section className="section-card"><h3>Your follow-up requests</h3>{state.supportCases.length ? state.supportCases.map(item => <article className="economic-summary-card" key={item.caseId}><strong>{item.kind.replace(/_/g, " ")}</strong><p>{item.status.replace(/_/g, " ")} · revision {item.revision}</p><p>{item.reason}</p><p className="boundary-note">Provider action remains separate and unconfirmed.</p></article>) : <p>No requests are in this bounded view.</p>}</section>
      <PreparationRecords records={state.records} />
    </>}
  </section>;
}
