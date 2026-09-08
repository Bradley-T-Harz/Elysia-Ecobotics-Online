import type { FormEvent, ReactNode } from "react";
import "./preparation.css";
import { Link } from "react-router-dom";
import { formatMinorAmount } from "../billing/paymentRecord";
import { acknowledgmentBoundary } from "./providerBoundary.ts";
import type { PreparationOverview } from "./preProviderContracts.ts";
export const preparationMoney = (amount: number | null, currency: string) => amount !== null && amount < 0 ? `−${formatMinorAmount(-amount, currency.toUpperCase())}` : formatMinorAmount(amount, currency.toUpperCase());
export function PreparationStatus({ status }: { status: "TEST" | "DISABLED" | "READY" | "BLOCKED" }) {
  return <span className={`preparation-status preparation-status--${status.toLowerCase()}`}>{status}</span>;
}
export function PreparationForm({ title, children, submit, busy, label }: { title: string; children: ReactNode; submit: (data: FormData) => Promise<unknown>; busy: boolean; label: string }) {
  async function handle(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (busy) return; await submit(new FormData(event.currentTarget)); }
  return <form className="auth-form preparation-form" onSubmit={handle}><h3>{title}</h3><fieldset disabled={busy}>{children}<button className="button-primary" type="submit">{busy ? "Recording…" : label}</button></fieldset></form>;
}
export function PreparationReason() { return <label><span>Private audit reason</span><textarea name="reason" minLength={8} maxLength={500} required rows={2} /><small>Briefly explain the decision. Do not enter banking, card, tax identifiers, credentials or sensitive evidence.</small></label>; }
export function PreparationBlockers({ blockers }: { blockers: string[] }) { return blockers.length ? <ul className="preparation-blockers">{blockers.map(value => <li key={value}>{value.replace(/_/g, " ")}</li>)}</ul> : <p>Internal prerequisites are satisfied. Financial activation is a separate decision.</p>; }
export function ProviderHandoffNotice() {
  return <section className="section-card preparation-provider-boundary"><PreparationStatus status="DISABLED" /><h3>Seller payment onboarding is not active yet.</h3><p>EcoSyneva is preparing Marketplace payments and provider onboarding but has not enabled real-money seller processing. No banking information is requested or stored by EcoSyneva here. When enabled, financial onboarding will occur through the approved payment provider.</p><div className="button-row"><button type="button" disabled>Payment-provider onboarding unavailable</button><button type="button" disabled>Creator payouts unavailable</button></div></section>;
}
export function PreparationRecords({ records }: { records: PreparationOverview["records"] }) {
  return <section className="section-card"><h2>Separate financial records</h2><p>Payment, refund, creator payout and provider delivery are separate facts. Independent external giving never creates an EcoSyneva donation receipt.</p>{!records.length && <p>No records are in this bounded view. An empty view does not prove an empty history.</p>}<div className="economic-capability-grid">{records.map(record => {
    const boundary = acknowledgmentBoundary(record.kind);
    return <article className="economic-summary-card" key={`${record.kind}:${record.recordId}`}><PreparationStatus status={boundary.preparationOnly ? "BLOCKED" : "TEST"} /><h3>{boundary.title}</h3><p><strong>{preparationMoney(record.amountMinor, record.currency)}</strong> · {record.status.replace(/_/g, " ")}</p><p>{record.evidence === "preparation_only" ? "Preparation only. No provider transfer or bank payout is established." : "Verified internal test record. It does not establish creator settlement."}</p><p>Provider delivery: not established by this record.</p><p className="small-note">Recorded {new Date(record.createdAt).toLocaleString()} · reference <code>{record.recordId}</code></p><p className="boundary-note">This is not a charitable donation receipt or a claim of tax-invoice sufficiency.</p></article>;
  })}</div></section>;
}
export function PreparationUnavailable({ signedIn, published }: { signedIn: boolean; published: boolean }) {
  return <section className="section-card"><PreparationStatus status="DISABLED" /><h3>{signedIn ? "Internal preparation is not available here yet" : "Sign in to view private preparation"}</h3><p>{published ? "This account needs the appropriate server-verified access and enabled internal preparation lane." : "These workflows are locally prepared. Their production endpoint remains unpublished; no preparation or payment request was sent."}</p><Link className="button-link" to="/commons-circle">Open Website Account</Link></section>;
}
