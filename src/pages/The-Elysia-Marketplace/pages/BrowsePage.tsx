import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AddonFilters from "../components/AddonFilters";
import MarketplaceBrowser from "../components/MarketplaceBrowser";
import { filterAddons } from "../lib/addonCatalog";
import type { CatalogFilters } from "../types";
import { useMarketplaceContext } from "./useMarketplaceContext";

const defaultFilters: CatalogFilters = {
  search: "",
  category: "all",
  trustTier: "all",
  locality: "all"
};

export default function BrowsePage() {
  const navigate = useNavigate();
  const { sortedAddons, categories, trustTiers, profile, saveAddon, removeAddon } = useMarketplaceContext();
  const [filters, setFilters] = useState<CatalogFilters>(defaultFilters);
  const filteredAddons = useMemo(() => filterAddons(sortedAddons, filters), [filters, sortedAddons]);

  return (
    <section className="section-card page-card catalog-page">
      <div className="page-header">
        <p className="eyebrow">Marketplace Catalog</p>
        <h1>Browse Elysia add-ons</h1>
        <p>
          Browse reviewed public add-ons and clearly labeled official releases. Core dependencies are not add-ons,
          candidates are not installable, and admin review reduces risk but does not guarantee safety.
        </p>
        <div className="page-header__actions">
          <Link className="button-link" to="/marketplace/trust">How trust tiers work</Link>
          <Link className="button-link" to="/marketplace/manifest-api">Manifest schema</Link>
        </div>
      </div>

      <AddonFilters filters={filters} categories={categories} trustTiers={trustTiers} onChange={setFilters} />
      <MarketplaceBrowser
        addons={filteredAddons}
        totalCount={sortedAddons.length}
        selectedAddonId={null}
        savedAddonIds={profile?.saved_addon_ids ?? []}
        onSelectAddon={(addonId) => navigate(`/marketplace/addons/${addonId}`)}
        onPrepareInstall={(addonId) => navigate(`/marketplace/action-preview?addon=${encodeURIComponent(addonId)}`)}
        onSaveAddon={saveAddon}
        onRemoveAddon={removeAddon}
      />
    </section>
  );
}
