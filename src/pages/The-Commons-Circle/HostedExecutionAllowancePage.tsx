import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ELYSIA_ECOBOTICS_ONLINE_URL } from "../../config/siteUrls";
import RequireMember from "../../shared/auth/RequireMember";
import { useAuth } from "../../shared/auth/useAuth";
import PageHero from "../../shared/components/PageHero";
import PageMetadata from "../../shared/components/PageMetadata";
import WarningCallout from "../../shared/components/WarningCallout";
import {
  formatHostedAllowance,
  loadSandboxCreditSummary,
  sandboxCreditClientMessage,
  type SandboxCreditReceiptType,
  type SandboxCreditSummary,
} from "../../shared/sandbox/hostedAllowanceClient";

function receiptLabel(type: SandboxCreditReceiptType) {
  switch (type) {
    case "grant": return "Allowance added";
    case "reserve": return "Run reservation";
    case "consume": return "Measured usage";
    case "release": return "Unused reservation released";
    case "expire": return "Allowance expiry";
    case "refund_adjustment": return "Usage adjustment";
    case "dispute_hold": return "Temporary hold";
    case "admin_correction": return "Account correction";
    case "compensating_credit": return "Allowance returned";
    case "compensating_debit": return "Allowance corrected";
  }
}

function allowanceType(summary: SandboxCreditSummary) {
  if (summary.allowanceType === "one_time_starter") return "One-time starter allowance";
  if (summary.allowanceType === "replenishing") return "Replenishing service allowance";
  if (summary.allowanceType === "mixed") return "Service-provided allowance";
  return "Production policy not active";
}

export default function HostedExecutionAllowancePage() {
  const { accessToken, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState<SandboxCreditSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async (force = false) => {
    if (!accessToken) {
      setSummary(null);
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      setSummary(await loadSandboxCreditSummary(accessToken, { force }));
    } catch (error) {
      setSummary(null);
      setMessage(sandboxCreditClientMessage(error));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const live = summary?.mode === "live" && summary.displayEnabled && summary.enforcementEnabled
    && summary.allowanceTotalUnits !== null && summary.usedUnits !== null && summary.remainingPercent !== null;

  return <div className="page-stack commons-circle-page hosted-allowance-page">
    <PageMetadata title="Hosted Execution Allowance | Elysia Ecobotics Online" description="Private hosted-execution allowance, reservations, and recent usage for the signed-in Website Account." canonicalUrl={`${ELYSIA_ECOBOTICS_ONLINE_URL}/commons-circle/settings/hosted-execution`} />
    <PageHero eyebrow="Account & Profile Settings" title="Hosted Execution Allowance" brandMark="standard"><p>Review the finite service-use allowance for EcoSyneva-operated hosted code execution. This private account state is separate from community participation, recognition, and local Elysia.</p></PageHero>
    <RequireMember label="Hosted Execution Allowance is private to the signed-in Website Account.">
      <div className="page-stack">
        {(authLoading || loading) && !summary && <p className="inline-status" aria-live="polite">Loading the authoritative hosted allowance…</p>}
        {message && <p className="boundary-note" role="status">{message}</p>}

        {summary && !live && <section className="section-card">
          <p className="eyebrow">Current production state</p>
          <h2>Allowance policy is not active yet</h2>
          <p>The hosted runner remains governed by its existing safety and operational quotas. A production allowance amount, measured-use rate, and replenishment policy have not been approved, so this page does not present test values as live account entitlement.</p>
          <p className="boundary-note">No payment is available and no automatic charge occurs.</p>
        </section>}

        {summary && live && <section className="section-card hosted-allowance-detail" aria-live="polite">
          {summary.administrativeOperationalAccess && <div className="boundary-note hosted-allowance-admin-state">
            <p className="eyebrow">Administrative operational access</p>
            <h2>Non-depleting accounting within bounded sandbox execution</h2>
            <p>Hosted execution usage is measured and audited, but administrator operations do not consume the ordinary starter allowance.</p>
            <p>This does not mean unlimited runtime, parallelism, CPU, RAM, network access, or server authority. Administrator operations remain subject to the same isolation, resource, timeout, concurrency, secret, network, and abuse controls.</p>
          </div>}
          <div className="section-heading section-heading--inline"><div><p className="eyebrow">{summary.administrativeOperationalAccess ? "Ordinary starter allowance preserved" : "Available hosted service use"}</p><h2>{formatHostedAllowance(summary.availableUnits, summary.unitScale)} / {formatHostedAllowance(summary.allowanceTotalUnits!, summary.unitScale)} units remaining</h2></div><strong>{summary.remainingPercent}%</strong></div>
          <progress max="100" value={summary.remainingPercent!} aria-label={`${summary.remainingPercent}% of hosted execution allowance remaining`}>{summary.remainingPercent}%</progress>
          <dl className="mini-facts">
            <div><dt>Used</dt><dd>{formatHostedAllowance(summary.usedUnits!, summary.unitScale)} units</dd></div>
            <div><dt>Reserved right now</dt><dd>{formatHostedAllowance(summary.reservedUnits, summary.unitScale)} units</dd></div>
            <div><dt>Available</dt><dd>{formatHostedAllowance(summary.availableUnits, summary.unitScale)} units</dd></div>
            <div><dt>Allowance type</dt><dd>{allowanceType(summary)}</dd></div>
            {summary.administrativeOperationalAccess && <div><dt>Operational reservation right now</dt><dd>{formatHostedAllowance(summary.operationalReservedUnits, summary.unitScale)} measured units</dd></div>}
            {summary.renewsAt && <div><dt>Next renewal</dt><dd>{new Date(summary.renewsAt).toLocaleString()}</dd></div>}
          </dl>
          <p>{summary.administrativeOperationalAccess ? "Administrator operations do not deplete this ordinary balance. If administrator authority ends, normal finite allowance policy resumes with the legitimate ordinary balance preserved." : "Hosted execution pauses when the available allowance cannot cover a run reservation."}</p>
          <p className="boundary-note">Unused reservation is released after finalization. Platform failure, cancellation, policy refusal, or cleanup failure does not consume allowance. A user-code error or timeout may consume the measured resources actually used.</p>
          <div className="button-row"><button type="button" disabled={loading} onClick={() => void refresh(true)}>{loading ? "Refreshing…" : "Refresh allowance"}</button></div>
        </section>}

        {summary && live && <section className="section-card">
          <p className="eyebrow">Private history</p><h2>Recent allowance receipts</h2>
          {summary.recentReceipts.length === 0 ? <p>No allowance receipts are available yet.</p> : <ul className="hosted-allowance-receipts">{summary.recentReceipts.map((receipt) => <li key={receipt.id}><strong>{receiptLabel(receipt.entryType)}</strong><span>{receipt.unitsDelta > 0 ? "+" : "−"}{formatHostedAllowance(Math.abs(receipt.unitsDelta), summary.unitScale)} units · {new Date(receipt.createdAt).toLocaleString()}</span></li>)}</ul>}
          <p className="small-note">Receipts are private service-accounting history. They are not money, a wallet, recognition, trust, or authority.</p>
        </section>}

        {summary?.administrativeOperationalAccess && live && <section className="section-card">
          <p className="eyebrow">Private measured operations</p><h2>Recent administrator hosted usage</h2>
          {summary.recentOperationalUsage.length === 0 ? <p>No completed administrator operations are available yet.</p> : <ul className="hosted-allowance-receipts">{summary.recentOperationalUsage.map((usage) => <li key={usage.runId}><strong>Measured administrator operation</strong><span>{formatHostedAllowance(usage.calculatedUnits, summary.unitScale)} units measured · 0 deducted · {new Date(usage.measuredAt).toLocaleString()}{usage.failureClass ? ` · ${usage.failureClass.replace(/_/g, " ")}` : ""}</span></li>)}</ul>}
          <p className="small-note">This history proves resource measurement without converting administrative access into money, prestige, trust, or broader sandbox power.</p>
        </section>}

        <section className="commons-doctrine-grid">
          <WarningCallout title="Hosted execution is finite"><p>EcoSyneva-operated execution consumes bounded server resources. The same authoritative allowance governs every runnable Website sandbox surface.</p></WarningCallout>
          <WarningCallout title="Local Elysia is unaffected"><p>Computation on your own local Elysia installation is not metered by EcoSyneva.</p></WarningCallout>
          <WarningCallout title="Additional paid allowance"><p>No paid top-up is offered. The current free starter allowance is provided once, without scheduled renewal or expiration. Voluntary support does not grant personal units or priority.</p></WarningCallout>
        </section>
        <div className="button-row"><Link className="button-link" to="/commons-circle/settings">Account &amp; Profile Settings</Link></div>
      </div>
    </RequireMember>
  </div>;
}
