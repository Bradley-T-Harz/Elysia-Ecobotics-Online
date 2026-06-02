import type { AddonManifest, CatalogFilters, TrustTier } from "../types";

export function filterAddons(addons: AddonManifest[], filters: CatalogFilters): AddonManifest[] {
  const search = filters.search.trim().toLowerCase();
  return addons.filter((addon) => {
    const matchesSearch = !search || [
      addon.name,
      addon.id,
      addon.publisher,
      addon.summary,
      addon.category,
      addon.trust_tier,
      ...addon.tags,
      ...addon.dependencies.map((dependency) => dependency.package_name)
    ].join(" ").toLowerCase().includes(search);

    const matchesCategory = filters.category === "all" || addon.category === filters.category;
    const matchesTrust = filters.trustTier === "all" || addon.trust_tier === filters.trustTier;
    const matchesLocality =
      filters.locality === "all" ||
      (filters.locality === "local_only" && addon.local_only) ||
      (filters.locality === "networked" && addon.network_access);

    return matchesSearch && matchesCategory && matchesTrust && matchesLocality;
  });
}

export function sortAddons(addons: AddonManifest[]): AddonManifest[] {
  const trustOrder: Record<TrustTier, number> = {
    official: 0,
    reviewed: 1,
    community: 2,
    unreviewed: 3,
    deprecated: 4,
    blocked: 5
  };
  return [...addons].sort((a, b) => trustOrder[a.trust_tier] - trustOrder[b.trust_tier] || a.name.localeCompare(b.name));
}

export function getAddonById(addons: AddonManifest[], id: string): AddonManifest | undefined {
  return addons.find((addon) => addon.id === id);
}

export function getCategories(addons: AddonManifest[]): string[] {
  return Array.from(new Set(addons.map((addon) => addon.category))).sort();
}

export function getTrustTiers(addons: AddonManifest[]): TrustTier[] {
  return Array.from(new Set(addons.map((addon) => addon.trust_tier)));
}
