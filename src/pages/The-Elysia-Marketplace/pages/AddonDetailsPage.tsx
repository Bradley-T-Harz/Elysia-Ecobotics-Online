import { Link, useNavigate, useParams } from "react-router-dom";
import AddonDetails from "../components/AddonDetails";
import { useMarketplaceContext } from "./useMarketplaceContext";

export default function AddonDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { getAddon } = useMarketplaceContext();
  const addon = getAddon(id);

  if (!addon) {
    return (
      <section className="section-card page-card not-found-panel">
        <p className="eyebrow">Add-on not found</p>
        <h1>No marketplace add-on matches this route.</h1>
        <p>
          The add-on may not exist in the current seed catalog, may still be in review,
          or may require Supabase catalog data that is not configured yet.
        </p>
        <Link className="button-link button-link--primary" to="/marketplace/browse">Back to Browse Add-ons</Link>
      </section>
    );
  }

  return (
    <div className="page-card details-page">
      <AddonDetails
        addon={addon}
        onPrepareInstall={(addonId) => navigate(`/marketplace/action-preview?addon=${encodeURIComponent(addonId)}`)}
      />
    </div>
  );
}
