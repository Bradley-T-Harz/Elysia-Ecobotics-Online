import { Link, useSearchParams } from "react-router-dom";
import ActionPreview from "../components/ActionPreview";
import { useMarketplaceContext } from "./useMarketplaceContext";

export default function ActionPreviewPage() {
  const [params] = useSearchParams();
  const { getAddon, saveAddon } = useMarketplaceContext();
  const selectedId = params.get("addon") ?? undefined;
  const addon = getAddon(selectedId);

  if (!selectedId || !addon) {
    return (
      <section className="section-card page-card empty-state-page">
        <p className="eyebrow">Action Preview</p>
        <h1>Choose an add-on first.</h1>
        <p>
          Action previews are tied to a specific manifest. Browse the catalog and choose
          Prepare Install to inspect install, uninstall, enable, disable, and review plans.
        </p>
        <Link className="button-link button-link--primary" to="/marketplace/browse">Browse Add-ons</Link>
      </section>
    );
  }

  return (
    <div className="page-card">
      <ActionPreview addon={addon} onSaveAddon={saveAddon} />
    </div>
  );
}
