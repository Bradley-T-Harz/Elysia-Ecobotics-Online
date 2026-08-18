import { Link } from "react-router-dom";
import type { AddonManifest } from "../types";
import { toneForRisk } from "../lib/securityLabels";
import TrustBadge from "./TrustBadge";
import { canPrepareMarketplaceInstall } from "../lib/listingTruth";

type ActionPreviewProps = {
  addon: AddonManifest | null;
  onSaveAddon: (addonId: string) => void;
  onPrepareLocalInstall: (addonId: string) => void;
};

function actionIntent(actionKey: string): string {
  const key = actionKey.toLowerCase();
  if (key.includes("uninstall")) return "Uninstall preview";
  if (key.includes("enable")) return "Enable preview";
  if (key.includes("disable")) return "Disable preview";
  if (key.includes("review")) return "Review preview";
  return "Install preview";
}

export default function ActionPreview({ addon, onSaveAddon, onPrepareLocalInstall }: ActionPreviewProps) {
  if (!addon) {
    return (
      <section className="action-preview muted-panel">
        <h2>Choose an add-on first</h2>
        <p>Action previews are generated from a selected add-on manifest.</p>
        <Link className="button-link button-link--primary" to="/marketplace/browse">Browse Add-ons</Link>
      </section>
    );
  }
  const installAvailable = canPrepareMarketplaceInstall(addon);

  return (
    <section className="action-preview action-preview--full">
      <p className="eyebrow">Action Preview Only</p>
      <h1>{addon.name}</h1>
      <p className="boundary-note">No install, uninstall, enable, disable, or local mutation occurs on this website. This page discloses manifest actions for review; it grants no local authority.</p>
      <div className="action-preview-grid">
        {addon.actions.map((action) => (
          <article className="action-card" key={action.action_key}>
            <div className="addon-card__topline">
              <TrustBadge label={actionIntent(action.action_key)} tone="neutral" />
              <TrustBadge label={action.risk_level} tone={toneForRisk(action.risk_level)} />
            </div>
            <h3>{action.action_label}</h3>
            <dl className="action-list">
              <div><dt>Action kind</dt><dd>{action.action_kind}</dd></div>
              <div><dt>Allowed by manifest</dt><dd>{action.allowed ? "Declared" : "Not declared"}</dd></div>
              <div><dt>Network contact</dt><dd>{action.network_access ? "Declared" : "Not declared"}</dd></div>
              <div><dt>Declared local approval</dt><dd>{action.requires_local_operator_password ? "Required" : "Not declared"}</dd></div>
            </dl>
            <ul>{action.notes.map((note) => <li key={note}>{note}</li>)}</ul>
          </article>
        ))}
      </div>
      <div className="button-row">
        {installAvailable && <button type="button" onClick={() => onSaveAddon(addon.id)}>Save plan</button>}
        <Link className="button-link" to={`/marketplace/addons/${addon.id}`}>View Manifest</Link>
        <Link className="button-link" to="/marketplace/browse">Browse Add-ons</Link>
        {installAvailable && <button type="button" onClick={() => onPrepareLocalInstall(addon.id)}>Prepare Local Install</button>}
        <a className="button-link" href="/catalog-preview.json" target="_blank" rel="noreferrer">View catalog preview JSON</a>
      </div>
      {!installAvailable && <p className="boundary-note">This candidate is not an approved public install listing. The action information above is disclosure metadata only.</p>}
    </section>
  );
}
