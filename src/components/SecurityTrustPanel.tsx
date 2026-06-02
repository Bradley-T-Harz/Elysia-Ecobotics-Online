import TrustBadge from "./TrustBadge";

export default function SecurityTrustPanel() {
  return (
    <section className="security-panel" id="trust">
      <p className="eyebrow">Trust & Security</p>
      <h2>Marketplace manifests are declarations, not permission grants.</h2>
      <div className="trust-grid">
        <div><h3>Trust tiers</h3><div className="tag-row"><TrustBadge label="Official" tone="official" /><TrustBadge label="Reviewed" tone="safe" /><TrustBadge label="Community" tone="safe" /><TrustBadge label="Unreviewed" tone="warning" /><TrustBadge label="Deprecated" tone="warning" /><TrustBadge label="Blocked" tone="danger" /></div></div>
        <div><h3>Permission labels</h3><div className="tag-row"><TrustBadge label="Local-only" /><TrustBadge label="Networked" tone="warning" /><TrustBadge label="Uses Docker" tone="warning" /><TrustBadge label="Reads selected files" tone="warning" /><TrustBadge label="External account" tone="warning" /></div></div>
      </div>
      <ul className="policy-list">
        <li>No add-on may execute arbitrary commands.</li>
        <li>No add-on may require local secrets or local Elysia passwords on the website.</li>
        <li>No add-on may exfiltrate local files or private machine inventory.</li>
        <li>No add-on may bypass Elysia operator approval.</li>
        <li>No add-on becomes chat/model-accessible without explicit governance review.</li>
      </ul>
    </section>
  );
}
