import type { CatalogFilters } from "../types";

type AddonFiltersProps = {
  filters: CatalogFilters;
  categories: string[];
  trustTiers: string[];
  onChange: (filters: CatalogFilters) => void;
};

export default function AddonFilters({ filters, categories, trustTiers, onChange }: AddonFiltersProps) {
  return (
    <form className="filters" onSubmit={(event) => event.preventDefault()}>
      <label>
        <span>Search</span>
        <input
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Search name, tag, dependency, publisher"
        />
      </label>
      <label>
        <span>Category</span>
        <select value={filters.category} onChange={(event) => onChange({ ...filters, category: event.target.value as CatalogFilters["category"] })}>
          <option value="all">All</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </label>
      <label>
        <span>Trust tier</span>
        <select value={filters.trustTier} onChange={(event) => onChange({ ...filters, trustTier: event.target.value as CatalogFilters["trustTier"] })}>
          <option value="all">All</option>
          {trustTiers.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
        </select>
      </label>
      <label>
        <span>Boundary</span>
        <select value={filters.locality} onChange={(event) => onChange({ ...filters, locality: event.target.value as CatalogFilters["locality"] })}>
          <option value="all">All</option>
          <option value="local_only">Local-only plans</option>
          <option value="networked">Networked</option>
        </select>
      </label>
    </form>
  );
}
