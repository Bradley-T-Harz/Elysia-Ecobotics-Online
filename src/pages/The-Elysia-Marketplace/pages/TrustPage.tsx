import SecurityTrustPanel from "../components/SecurityTrustPanel";
import TrustBadge from "../components/TrustBadge";

export default function TrustPage() {
  return (
    <div className="trust-page page-card">
      <section className="section-card page-header-card">
        <p className="eyebrow">Trust & Security Policy</p>
        <h1>Review before power.</h1>
        <p>
          Elysia Marketplace separates public catalog discovery from private local execution.
          Trust labels identify review evidence, declared permissions, and unsafe or unavailable states.
          Ecological imagery, names, and metaphors are not evidence of environmental impact; environmental claims require supporting evidence.
        </p>
      </section>
      <SecurityTrustPanel />
      <section className="section-card">
        <h2>Boundary rules</h2>
        <div className="details-grid">
          <div><h3>Local/cloud boundary</h3><p>Marketplace profile and catalog data may live in Supabase. Local files, memory, dependency inventory, and private machine data do not leave local control by default.</p></div>
          <div><h3>Command execution</h3><p>No manifest grants arbitrary command execution. This website executes no add-on code; Local Elysia independently enforces its own validation, permission, and approval boundaries.</p></div>
          <div><h3>Permissions</h3><div className="tag-row"><TrustBadge label="Local-only" tone="safe" /><TrustBadge label="Networked" tone="warning" /><TrustBadge label="Uses Docker" tone="warning" /><TrustBadge label="External account" tone="warning" /></div></div>
          <div><h3>Final authority</h3><p>Local Elysia remains the final authority for local installation, removal, enablement, disablement, and execution.</p></div>
        </div>
      </section>
    </div>
  );
}
