import { Link } from "react-router-dom";
import type { AddonManifest } from "../types";
import { toneForRisk } from "../lib/securityLabels";
import TrustBadge from "./TrustBadge";

type ActionPreviewProps = {
  addon: AddonManifest | null;
  onSaveAddon: (addonId: string) => void;
};

function actionIntent(actionKey: string): string {
  const key = actionKey.toLowerCase();
  if (key.includes("uninstall")) return "Uninstall preview";
  if (key.includes("enable")) return "Enable preview";
  if (key.includes("disable")) return "Disable preview";
  if (key.includes("review")) return "Review preview";
  return "Install preview";
}

export default function ActionPreview({ addon, onSaveAddon }: ActionPreviewProps) {
  if (!addon) {
    return (
      <section className="action-preview muted-panel">
        <h2>Choose an add-on first</h2>
        <p>Action previews are generated from a selected add-on manifest.</p>
        <Link className="button-link button-link--primary" to="/browse">Browse Add-ons</Link>
      </section>
    );
  }

  return (
    <section className="action-preview action-preview--full">
      <p className="eyebrow">Action Preview Only</p>
      <h1>{addon.name}</h1>
      <p className="boundary-note">No install, uninstall, enable, disable, or local mutation occurs on this website. These are marketplace plans for later local Elysia review. Add-ons install later into an Elysia_Add-ons folder beside the Elysia folder, not inside Elysia core.</p>
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
              <div><dt>Future local approval</dt><dd>{action.requires_local_operator_password ? "Required" : "Not declared"}</dd></div>
            </dl>
            <ul>{action.notes.map((note) => <li key={note}>{note}</li>)}</ul>
          </article>
        ))}
      </div>
      <div className="button-row">
        <button type="button" onClick={() => onSaveAddon(addon.id)}>Save plan</button>
        <Link className="button-link" to={`/addons/${addon.id}`}>View Manifest</Link>
        <Link className="button-link" to="/browse">Browse Add-ons</Link>
        <a className="button-link" href={`elysia://addons/install?manifest_url=${encodeURIComponent(`/catalog-preview.json#${addon.id}`)}`}>Open in Elysia</a><a className="button-link" href="/catalog-preview.json" download>Download .elysia-addon</a><button type="button" disabled>Copy install command, planned</button>
      </div>
    </section>
  );
}
