import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import { createReviewItem } from "../../shared/review/reviewClient";
import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../The-Elysia-Marketplace/lib/supabase";
import {
  activeLivingLibrarySources,
  allLivingLibrarySources,
  formatLivingLibraryCitation,
  legacyLivingLibrarySources,
  livingLibraryBrowseCategories,
  livingLibraryCategorySlug,
  resolveLivingLibrarySource,
  type LivingLibraryBrowseCategory,
  type LivingLibrarySource,
} from "./livingLibraryCatalog";
import {
  defaultLivingLibraryFilters,
  livingLibrarySearchParams,
  parseLivingLibrarySearchParams,
  searchLivingLibrarySources,
  type LivingLibrarySearchFilters,
} from "./livingLibrarySearch";
import {
  livingLibraryEthicsPrinciples,
  livingLibraryPageCopy,
  livingLibraryStarterPacks,
} from "./livingLibrarySources";
import LivingLibrarySourceCard from "./LivingLibrarySourceCard";
import LivingLibrarySourceDetail from "./LivingLibrarySourceDetail";

type LocalCollection = { name: string; sourceIds: string[] };
type SavedCitationRecord = { sourceId: string; citationText: string; accessedAt: string };
type LocalDraft = {
  id: string;
  kind: "suggestion" | "broken-link";
  sourceName: string;
  officialUrl: string;
  category?: string;
  submitterNote?: string;
  notes: string;
  createdAt: string;
};

export const livingLibraryStorageKeys = {
  savedSources: "elysiaLivingLibrary.savedSources.v1",
  savedCitations: "elysiaLivingLibrary.savedCitations.v1",
  savedCitationRecords: "elysiaLivingLibrary.savedCitationRecords.v2",
  bookmarkedPacks: "elysiaLivingLibrary.bookmarkedPacks.v1",
  collections: "elysiaLivingLibrary.collections.v1",
  drafts: "elysiaLivingLibrary.drafts.v1",
} as const;

const pageSize = 12;
const featuredIds = [
  "nasa-earthdata", "noaa-climate-data-online", "gbif", "pubmed", "crossref", "materials-project",
  "world-bank-data", "data-gov", "usgs-epa-water-quality-portal", "ncbi-datasets", "arxiv", "software-heritage",
];

const queryExamples = ["atmospheric", "ocean", "hydrology", "biodiversity", "wildfire", "peer reviewed", "preprint", "DOI", "genomics", "materials", "API"];

const legacyCategoryHashMap: Record<string, LivingLibraryBrowseCategory> = {
  "library-trusted-data-portals": "General & Government Data",
  "library-model-training-commons": "Code, Models & Technical Infrastructure",
  "library-environmental-data": "Earth, Environment & Climate",
  "library-social-economic-data": "Social, Economic & Policy Data",
  "library-physical-science-data": "Physical Sciences & Space",
  "library-research-papers-scholarly-graphs": "Scholarly Literature & Citations",
  "library-biology-health-data": "Life Sciences & Health",
  "library-code-datasets": "Code, Models & Technical Infrastructure",
  "library-elysia-technical-foundations": "Code, Models & Technical Infrastructure",
  "library-local-ai-tools": "Code, Models & Technical Infrastructure",
  "library-dataset-ethics-licensing": "Research Practice & Education",
  "library-stewardship-organizations": "Research Practice & Education",
};

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function downloadText(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

function collectionToMarkdown(name: string, sources: LivingLibrarySource[], accessDate: Date) {
  return [
    `# ${name}`,
    "",
    `Export date: ${accessDate.toISOString()}`,
    "",
    ...sources.flatMap((source) => [
      `## ${source.name}`,
      `- Official URL: ${source.officialUrl}`,
      `- Operator: ${source.operator}`,
      `- Resource type: ${source.resourceType}`,
      `- Scientific fields: ${source.scienceDomains.join(", ")}`,
      `- Access: ${source.access.public}; API ${source.access.api}; download ${source.access.download}`,
      `- Content status: ${source.content.reviewStatus}`,
      `- License/reuse: ${source.license.summary}`,
      `- Citation: ${formatLivingLibraryCitation(source, accessDate)}`,
      "",
    ]),
  ].join("\n");
}

function facetLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function LivingLibraryPage() {
  const { sourceId, categorySlug } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const parsedState = useMemo(
    () => parseLivingLibrarySearchParams(searchParams, activeLivingLibrarySources),
    [searchParams],
  );
  const routeCategory = livingLibraryBrowseCategories.find((category) => category.id === categorySlug || livingLibraryCategorySlug(category.name) === categorySlug)?.name;
  const invalidCategoryRoute = Boolean(categorySlug && !routeCategory);
  const effectiveFilters = useMemo(() => routeCategory ? { ...parsedState.filters, category: routeCategory } : parsedState.filters, [parsedState.filters, routeCategory]);
  const [searchDraft, setSearchDraft] = useState(parsedState.query);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const [savedSourceIds, setSavedSourceIds] = useState<string[]>(() => readStorage(livingLibraryStorageKeys.savedSources, []));
  const [savedCitationIds, setSavedCitationIds] = useState<string[]>(() => readStorage(livingLibraryStorageKeys.savedCitations, []));
  const [savedCitationRecords, setSavedCitationRecords] = useState<SavedCitationRecord[]>(() => readStorage(livingLibraryStorageKeys.savedCitationRecords, []));
  const [bookmarkedPackIds, setBookmarkedPackIds] = useState<string[]>(() => readStorage(livingLibraryStorageKeys.bookmarkedPacks, []));
  const [collections, setCollections] = useState<LocalCollection[]>(() => readStorage(livingLibraryStorageKeys.collections, [{ name: "Research shelf", sourceIds: [] }]));
  const [activeCollectionName, setActiveCollectionName] = useState(() => collections[0]?.name ?? "Research shelf");
  const [collectionName, setCollectionName] = useState("");
  const [drafts, setDrafts] = useState<LocalDraft[]>(() => readStorage(livingLibraryStorageKeys.drafts, []));
  const [suggestion, setSuggestion] = useState({ sourceName: "", officialUrl: "", category: "", notes: "", submitterNote: "" });
  const [brokenLink, setBrokenLink] = useState({ sourceName: "", officialUrl: "", notes: "" });
  const [citationPanel, setCitationPanel] = useState<SavedCitationRecord | null>(null);
  const [statusMessage, setStatusMessage] = useState("Local shelf ready. Saving here writes only to this browser unless you explicitly sync through Commons Circle.");

  useEffect(() => setSearchDraft(parsedState.query), [parsedState.query]);
  useEffect(() => setVisibleCount(pageSize), [location.pathname, location.search]);

  useEffect(() => {
    const target = location.hash.slice(1);
    const category = legacyCategoryHashMap[target];
    if (!category || location.pathname !== "/living-library") return;
    const params = livingLibrarySearchParams({ ...parsedState.filters, category }, parsedState.query);
    navigate({ pathname: "/living-library", search: `?${params.toString()}` }, { replace: true, state: { routeEntry: { targetId: "library-results" } } });
  }, [location.hash, location.pathname, navigate, parsedState.filters, parsedState.query]);

  const categoryCounts = useMemo(() => new Map(livingLibraryBrowseCategories.map((category) => [
    category.name,
    activeLivingLibrarySources.filter((source) => source.browseCategory === category.name).length,
  ])), []);
  const filterOptions = useMemo(() => ({
    resourceTypes: uniqueSorted(activeLivingLibrarySources.map((source) => source.resourceType)),
    publicAccess: uniqueSorted(activeLivingLibrarySources.map((source) => source.access.public)),
    reviewStatuses: uniqueSorted(activeLivingLibrarySources.map((source) => source.content.reviewStatus)),
    apiAccess: uniqueSorted(activeLivingLibrarySources.map((source) => source.access.api)),
    downloads: uniqueSorted(activeLivingLibrarySources.map((source) => source.access.download)),
  }), []);

  const searchResults = useMemo(() => {
    const results = searchLivingLibrarySources(activeLivingLibrarySources, parsedState.query, effectiveFilters);
    const hasDiscoveryState = Boolean(parsedState.query.trim()) || Object.values(effectiveFilters).some((value) => value !== "all");
    if (hasDiscoveryState) return results;
    const featuredOrder = new Map(featuredIds.map((id, index) => [id, index]));
    return results.slice().sort((left, right) => {
      const leftRank = featuredOrder.get(left.source.id) ?? Number.MAX_SAFE_INTEGER;
      const rightRank = featuredOrder.get(right.source.id) ?? Number.MAX_SAFE_INTEGER;
      return leftRank - rightRank || left.source.name.localeCompare(right.source.name);
    });
  }, [effectiveFilters, parsedState.query]);
  const visibleResults = searchResults.slice(0, visibleCount);
  const activeFiltersCount = Object.values(effectiveFilters).filter((value) => value !== "all").length;
  const activeCollection = collections.find((collection) => collection.name === activeCollectionName) ?? collections[0];
  const activeCollectionSources = (activeCollection?.sourceIds ?? []).map(resolveLivingLibrarySource).filter((source): source is LivingLibrarySource => Boolean(source));

  function updateSavedSources(next: string[]) {
    setSavedSourceIds(next);
    writeStorage(livingLibraryStorageKeys.savedSources, next);
  }

  function updateCitationState(nextIds: string[], nextRecords: SavedCitationRecord[]) {
    setSavedCitationIds(nextIds);
    setSavedCitationRecords(nextRecords);
    writeStorage(livingLibraryStorageKeys.savedCitations, nextIds);
    writeStorage(livingLibraryStorageKeys.savedCitationRecords, nextRecords);
  }

  function updateCollections(next: LocalCollection[]) {
    setCollections(next);
    writeStorage(livingLibraryStorageKeys.collections, next);
  }

  function toggleSavedSource(id: string) {
    const wasSaved = savedSourceIds.includes(id);
    updateSavedSources(wasSaved ? savedSourceIds.filter((sourceId) => sourceId !== id) : [...savedSourceIds, id]);
    setStatusMessage(wasSaved ? "Source removed from this browser's local shelf." : "Source saved to this browser's local shelf.");
  }

  function openCitation(id: string) {
    const source = resolveLivingLibrarySource(id);
    if (!source) return;
    const existing = savedCitationRecords.find((record) => record.sourceId === id);
    const accessedAt = new Date().toISOString();
    setCitationPanel(existing ?? { sourceId: id, citationText: formatLivingLibraryCitation(source, new Date(accessedAt)), accessedAt });
    setStatusMessage(`Citation prepared for ${source.name} using today's access date.`);
  }

  function saveCitationRecord(record: SavedCitationRecord) {
    const nextIds = [...new Set([...savedCitationIds, record.sourceId])];
    const nextRecords = [...savedCitationRecords.filter((item) => item.sourceId !== record.sourceId), record];
    updateCitationState(nextIds, nextRecords);
    setStatusMessage("Citation saved locally with its action-time access date.");
  }

  function removeCitationRecord(sourceIdToRemove: string) {
    updateCitationState(savedCitationIds.filter((id) => id !== sourceIdToRemove), savedCitationRecords.filter((record) => record.sourceId !== sourceIdToRemove));
    setStatusMessage("Citation removed from this browser's local shelf.");
  }

  async function copyCitation(record: SavedCitationRecord) {
    try {
      await navigator.clipboard.writeText(record.citationText);
      setStatusMessage("Citation copied. Its access date is the date this citation was created, not the catalog verification date.");
    } catch {
      setStatusMessage(`Copy unavailable. Citation text: ${record.citationText}`);
    }
  }

  function updateBookmarkedPacks(next: string[]) {
    setBookmarkedPackIds(next);
    writeStorage(livingLibraryStorageKeys.bookmarkedPacks, next);
  }

  function createCollection() {
    const name = collectionName.trim();
    if (!name) return;
    if (collections.some((collection) => collection.name.toLowerCase() === name.toLowerCase())) {
      setStatusMessage("A local collection with that name already exists.");
      return;
    }
    const next = [...collections, { name, sourceIds: [] }];
    updateCollections(next);
    setActiveCollectionName(name);
    setCollectionName("");
    setStatusMessage(`Created local collection: ${name}.`);
  }

  function addToActiveCollection(id: string) {
    if (!activeCollection) return;
    const next = collections.map((collection) => collection.name === activeCollection.name
      ? { ...collection, sourceIds: [...new Set([...collection.sourceIds, id])] }
      : collection);
    updateCollections(next);
    setStatusMessage(`Added ${resolveLivingLibrarySource(id)?.name ?? "source"} to ${activeCollection.name}.`);
  }

  function exportActiveCollection(format: "markdown" | "json") {
    if (!activeCollection) return;
    const actionDate = new Date();
    const filename = activeCollection.name.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase() || "living-library-collection";
    if (format === "markdown") {
      downloadText(`${filename}.md`, collectionToMarkdown(activeCollection.name, activeCollectionSources, actionDate), "text/markdown");
    } else {
      downloadText(`${filename}.json`, JSON.stringify({ exportedAt: actionDate.toISOString(), collection: activeCollection, sources: activeCollectionSources.map((source) => ({ ...source, citation: formatLivingLibraryCitation(source, actionDate) })) }, null, 2), "application/json");
    }
    setStatusMessage(`Exported ${activeCollection.name} as ${format.toUpperCase()} with action-time citation access dates.`);
  }

  async function saveDraft(kind: LocalDraft["kind"], draft: { sourceName: string; officialUrl: string; category?: string; submitterNote?: string; notes: string }) {
    if (!draft.sourceName.trim() && !draft.officialUrl.trim() && !draft.notes.trim()) return;
    const localDraft: LocalDraft = { id: `${kind}-${Date.now()}`, kind, sourceName: draft.sourceName, officialUrl: draft.officialUrl, category: draft.category, submitterNote: draft.submitterNote, notes: draft.notes, createdAt: new Date().toISOString() };
    const saveLocally = (message: string) => {
      const next = [localDraft, ...drafts];
      setDrafts(next);
      writeStorage(livingLibraryStorageKeys.drafts, next);
      setStatusMessage(message);
    };
    if (!hasSupabaseConfig || !supabase) {
      saveLocally(`${supabaseNotConfiguredMessage} ${kind === "suggestion" ? "Source request" : "Broken-link report"} saved locally as a draft.`);
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      saveLocally(`Sign in to submit this ${kind === "suggestion" ? "source request" : "broken-link report"} for review. A browser-local draft was saved instead.`);
      return;
    }
    const requestId = crypto.randomUUID?.() ?? `${kind}-${Date.now()}`;
    if (kind === "suggestion") {
      const { error } = await supabase.from("living_library_source_suggestions").insert({
        id: requestId,
        user_id: auth.user.id,
        source_name: draft.sourceName.trim(),
        official_url: draft.officialUrl.trim(),
        category: draft.category?.trim() || null,
        why_it_belongs: draft.notes.trim() || null,
        privacy_ethics_notes: draft.submitterNote?.trim() || null,
        submitter_notes: draft.submitterNote?.trim() || null,
        status: "pending_review",
      });
      if (error) {
        saveLocally(`Remote source request failed: ${error.message}. A browser-local draft was saved.`);
        return;
      }
      const reviewResult = await createReviewItem({ domain: "living_library_source", sourceTable: "living_library_source_suggestions", sourceId: requestId, submittedBy: auth.user.id, title: draft.sourceName.trim(), summary: draft.notes.trim().slice(0, 280) });
      setStatusMessage(reviewResult.ok ? "Source request submitted for source-reviewer review." : `Source request saved, but review routing needs attention: ${reviewResult.warning}`);
      setSuggestion({ sourceName: "", officialUrl: "", category: "", notes: "", submitterNote: "" });
    } else {
      const { error } = await supabase.from("broken_link_reports").insert({
        id: requestId,
        user_id: auth.user.id,
        page_url: window.location.pathname,
        broken_url: draft.officialUrl.trim(),
        source_context: draft.sourceName.trim() || "Living Library",
        report_note: draft.notes.trim() || null,
        status: "pending_review",
      });
      if (error) {
        saveLocally(`Remote broken-link report failed: ${error.message}. A browser-local draft was saved.`);
        return;
      }
      const reviewResult = await createReviewItem({ domain: "living_library_broken_link", sourceTable: "broken_link_reports", sourceId: requestId, submittedBy: auth.user.id, title: `Broken link: ${draft.sourceName || draft.officialUrl}`, summary: draft.notes.trim().slice(0, 280) });
      setStatusMessage(reviewResult.ok ? "Broken-link report submitted for review." : `Broken-link report saved, but review routing needs attention: ${reviewResult.warning}`);
      setBrokenLink({ sourceName: "", officialUrl: "", notes: "" });
    }
  }

  function commitDiscovery(query: string, filters: LivingLibrarySearchFilters, pathname = location.pathname) {
    const params = livingLibrarySearchParams(filters, query);
    navigate({ pathname, search: params.toString() ? `?${params.toString()}` : "" }, { state: { routeEntry: { targetId: "library-results" } } });
  }

  function updateFilter<Key extends keyof LivingLibrarySearchFilters>(key: Key, value: LivingLibrarySearchFilters[Key]) {
    const next = { ...effectiveFilters, [key]: value };
    commitDiscovery(parsedState.query, next, key === "category" ? "/living-library" : location.pathname);
  }

  function clearDiscovery() {
    setSearchDraft("");
    navigate("/living-library", { state: { routeEntry: { targetId: "library-search" } } });
  }

  if (sourceId) {
    const source = resolveLivingLibrarySource(sourceId);
    if (!source) {
      return <div className="page-stack living-library-page">
        <PageHero eyebrow="SOURCE NOT FOUND" title="That Living Library record does not exist" brandMark="standard"><p>The source ID is unknown or malformed.</p></PageHero>
        <section className="section-card"><h2>Return to active discovery</h2><p>No source, alias, or compatibility tombstone matches <code>{sourceId}</code>.</p><Link className="button-link" to="/living-library">Search the Living Library</Link></section>
      </div>;
    }
    const related = activeLivingLibrarySources.filter((candidate) => candidate.id !== source.id && candidate.browseCategory === source.browseCategory).slice(0, 4);
    return <>
      <LivingLibrarySourceDetail
        source={source}
        relatedSources={related}
        successor={resolveLivingLibrarySource(source.lifecycle.successorId)}
        saved={savedSourceIds.includes(source.id)}
        citationSaved={savedCitationIds.includes(source.id)}
        onSave={toggleSavedSource}
        onCite={openCitation}
        onAddToCollection={addToActiveCollection}
      />
      {citationPanel ? <CitationPanel
        record={citationPanel}
        source={resolveLivingLibrarySource(citationPanel.sourceId)}
        saved={savedCitationIds.includes(citationPanel.sourceId)}
        onClose={() => setCitationPanel(null)}
        onCopy={copyCitation}
        onSave={saveCitationRecord}
        onRemove={removeCitationRecord}
      /> : null}
      <p className="library-status-live" role="status" aria-live="polite">{statusMessage}</p>
    </>;
  }

  return (
    <div className="page-stack living-library-page">
      <PageHero eyebrow="GLOBAL SCIENCE GATEWAY" title="The Living Library" brandMark="standard">
        <p>A search-first gateway to scientific papers, data portals, repositories, observatories, APIs, and trustworthy research infrastructure around the world.</p>
      </PageHero>

      <section className="section-card library-search-hero" id="library-search" data-route-focus-target>
        <div className="library-search-hero__intro">
          <div>
            <p className="eyebrow">Find science without knowing the brand name</p>
            <h2>What are you trying to understand?</h2>
            <p>Search ordinary scientific language. Results explain who operates each resource, what it hosts or indexes, and what access or reuse cautions matter.</p>
          </div>
          <div className="library-stats-row" aria-label="Catalog size">
            <span>{activeLivingLibrarySources.length} active resources</span>
            <span>{livingLibraryBrowseCategories.length} fields</span>
            <span>{legacyLivingLibrarySources.length} compatibility records</span>
          </div>
        </div>
        <form className="library-primary-search" onSubmit={(event) => {
          event.preventDefault();
          commitDiscovery(searchDraft, { ...defaultLivingLibraryFilters }, "/living-library");
        }} role="search">
          <label htmlFor="living-library-search-input">Search scientific resources</label>
          <div>
            <input id="living-library-search-input" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Try atmospheric, peer reviewed, genomics, materials, or API" autoComplete="off" />
            <button type="submit">Search the library</button>
          </div>
        </form>
        <div className="library-query-examples" aria-label="Example searches">
          <span>Try:</span>{queryExamples.map((query) => <button key={query} type="button" onClick={() => { setSearchDraft(query); commitDiscovery(query, defaultLivingLibraryFilters, "/living-library"); }}>{query}</button>)}
        </div>
        <nav className="library-intent-grid" aria-label="Common discovery paths">
          <Link to="/living-library?q=papers" state={{ routeEntry: { targetId: "library-results" } }}><strong>Find papers</strong><span>Indexes, repositories, preprints, citations</span></Link>
          <Link to="/living-library?q=datasets" state={{ routeEntry: { targetId: "library-results" } }}><strong>Find data</strong><span>Portals, observatories, repositories, downloads</span></Link>
          <a href="#library-browse"><strong>Browse by field</strong><span>Eight clear scientific and technical areas</span></a>
        </nav>
      </section>

      {citationPanel ? <CitationPanel
        record={citationPanel}
        source={resolveLivingLibrarySource(citationPanel.sourceId)}
        saved={savedCitationIds.includes(citationPanel.sourceId)}
        onClose={() => setCitationPanel(null)}
        onCopy={copyCitation}
        onSave={saveCitationRecord}
        onRemove={removeCitationRecord}
      /> : null}

      <section className="section-card library-results-section" id="library-results">
        {Object.keys(legacyCategoryHashMap).map((id) => <span className="library-legacy-anchor" id={id} key={id} aria-hidden="true" />)}
        <div className="library-results-heading">
          <div>
            <p className="eyebrow">{routeCategory ? "Browse field" : parsedState.query ? "Search results" : "Curated starting points"}</p>
            <h2 tabIndex={-1}>{invalidCategoryRoute ? "Unknown browse field" : routeCategory ?? (parsedState.query ? `${searchResults.length} resources for “${parsedState.query}”` : "Explore the catalog")}</h2>
            <p aria-live="polite">{invalidCategoryRoute ? "This field route is not recognized." : `${searchResults.length} matching active resources. Showing ${Math.min(visibleCount, searchResults.length)}.`}</p>
          </div>
          <div className="library-results-heading__actions">
            {(parsedState.query || activeFiltersCount || routeCategory) ? <button type="button" onClick={clearDiscovery}>Clear search and filters</button> : null}
            {routeCategory ? <Link className="button-link button-link--quiet" to="/living-library">All fields</Link> : null}
          </div>
        </div>

        {!invalidCategoryRoute ? <details className="library-filter-panel">
          <summary><span>Filters</span><span>{activeFiltersCount ? `${activeFiltersCount} active` : "Optional"}</span></summary>
          <div className="library-filter-grid">
            <label><span>Science field</span><select value={effectiveFilters.category} onChange={(event) => updateFilter("category", event.target.value as LivingLibrarySearchFilters["category"])}><option value="all">All fields</option>{livingLibraryBrowseCategories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select></label>
            <label><span>Resource type</span><select value={effectiveFilters.resourceType} onChange={(event) => updateFilter("resourceType", event.target.value)}><option value="all">All resource types</option>{filterOptions.resourceTypes.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label><span>Public access</span><select value={effectiveFilters.publicAccess} onChange={(event) => updateFilter("publicAccess", event.target.value as LivingLibrarySearchFilters["publicAccess"])}><option value="all">Any public access</option>{filterOptions.publicAccess.map((value) => <option key={value} value={value}>{facetLabel(value)}</option>)}</select></label>
            <label><span>Content / review status</span><select value={effectiveFilters.reviewStatus} onChange={(event) => updateFilter("reviewStatus", event.target.value as LivingLibrarySearchFilters["reviewStatus"])}><option value="all">Any content status</option>{filterOptions.reviewStatuses.map((value) => <option key={value} value={value}>{facetLabel(value)}</option>)}</select></label>
            <label><span>API access</span><select value={effectiveFilters.apiAccess} onChange={(event) => updateFilter("apiAccess", event.target.value as LivingLibrarySearchFilters["apiAccess"])}><option value="all">Any API status</option>{filterOptions.apiAccess.map((value) => <option key={value} value={value}>{facetLabel(value)}</option>)}</select></label>
            <label><span>Download / bulk</span><select value={effectiveFilters.downloadAccess} onChange={(event) => updateFilter("downloadAccess", event.target.value as LivingLibrarySearchFilters["downloadAccess"])}><option value="all">Any download status</option>{filterOptions.downloads.map((value) => <option key={value} value={value}>{facetLabel(value)}</option>)}</select></label>
          </div>
        </details> : null}

        {invalidCategoryRoute ? <div className="empty-state"><p>No field matches <code>{categorySlug}</code>.</p><Link className="button-link" to="/living-library#library-browse">Browse the current fields</Link></div> : searchResults.length === 0 ? <div className="empty-state library-no-results"><h3>No active resources match this search</h3><p>Try a broader scientific term, remove one filter, or browse by field. Retired and removed records do not appear in ordinary search.</p><button type="button" onClick={clearDiscovery}>Clear search and filters</button></div> : <>
          <div className="library-results-grid">
            {visibleResults.map((result) => <LivingLibrarySourceCard key={result.source.id} result={result} saved={savedSourceIds.includes(result.source.id)} citationSaved={savedCitationIds.includes(result.source.id)} onSave={toggleSavedSource} onCite={openCitation} />)}
          </div>
          {visibleCount < searchResults.length ? <div className="library-load-more"><button type="button" onClick={() => setVisibleCount((count) => count + pageSize)}>Load {Math.min(pageSize, searchResults.length - visibleCount)} more</button><span>{searchResults.length - visibleCount} remain</span></div> : null}
        </>}
      </section>

      <section className="section-card library-browse-section" id="library-browse">
        <p className="eyebrow">Browse by field</p>
        <h2>Choose a scientific neighborhood</h2>
        <p>Fields stay broad enough for beginners. More precise resource, access, review, API, and download facets are available in results.</p>
        <div className="library-browse-grid">
          {livingLibraryBrowseCategories.map((category) => <Link key={category.id} to={`/living-library/browse/${category.id}`} state={{ routeEntry: { targetId: "library-results" } }}>
            <span>{categoryCounts.get(category.name) ?? 0} resources</span>
            <strong>{category.name}</strong>
            <p>{category.description}</p>
          </Link>)}
        </div>
      </section>

      <section className="library-progressive-tools" aria-label="Library tools and guidance">
        <details className="section-card">
          <summary><span><span className="eyebrow">LOCAL SHELF</span><strong>Save, cite, collect, and export</strong></span><span>{savedSourceIds.length} saved</span></summary>
          <div className="library-tools-body">
            <WarningCallout title="Local-first boundary"><p>{statusMessage}</p></WarningCallout>
            <div className="library-stats-row"><span>{savedSourceIds.length} sources</span><span>{savedCitationIds.length} citations</span><span>{bookmarkedPackIds.length} starter packs</span><span>{drafts.length} local drafts</span></div>
            <div className="library-filter-grid library-filter-grid--compact">
              <label><span>Active collection</span><select value={activeCollectionName} onChange={(event) => setActiveCollectionName(event.target.value)}>{collections.map((collection) => <option key={collection.name} value={collection.name}>{collection.name}</option>)}</select></label>
              <label><span>New collection name</span><input value={collectionName} onChange={(event) => setCollectionName(event.target.value)} placeholder="Watershed research shelf" /></label>
            </div>
            <div className="button-row"><button type="button" onClick={createCollection}>Create local collection</button><button type="button" onClick={() => exportActiveCollection("markdown")}>Export Markdown</button><button type="button" onClick={() => exportActiveCollection("json")}>Export JSON</button><Link className="button-link button-link--quiet" to="/commons-circle/saved-shelves">Open Commons Circle shelves</Link></div>
            <p>{activeCollection?.name ?? "No active collection"}: {activeCollectionSources.length} source{activeCollectionSources.length === 1 ? "" : "s"}.</p>
          </div>
        </details>

        <details className="section-card">
          <summary><span><span className="eyebrow">STARTER SHELVES</span><strong>Curated ways into the catalog</strong></span><span>{livingLibraryStarterPacks.length} packs</span></summary>
          <div className="library-pack-grid library-tools-body">
            {livingLibraryStarterPacks.map((pack) => <article className="library-pack-card" key={pack.id}>
              <h3>{pack.name}</h3><p>{pack.description}</p><p><strong>Best for:</strong> {pack.bestFor}</p><p className="boundary-note">{pack.riskNotes}</p>
              <button type="button" aria-pressed={bookmarkedPackIds.includes(pack.id)} onClick={() => updateBookmarkedPacks(bookmarkedPackIds.includes(pack.id) ? bookmarkedPackIds.filter((id) => id !== pack.id) : [...bookmarkedPackIds, pack.id])}>{bookmarkedPackIds.includes(pack.id) ? "Bookmarked" : "Bookmark pack"}</button>
            </article>)}
          </div>
        </details>

        <details className="section-card">
          <summary><span><span className="eyebrow">RESPONSIBLE REUSE</span><strong>Licensing, privacy, and training cautions</strong></span><span>Read before reuse</span></summary>
          <div className="library-tools-body">
            <p>{livingLibraryPageCopy.doctrineCallout}</p>
            <p className="boundary-note">{livingLibraryPageCopy.trainingSafetyWarning}</p>
            <div className="library-ethics-grid">{livingLibraryEthicsPrinciples.map((principle) => <article key={principle.title}><h3>{principle.title}</h3><p>{principle.body}</p></article>)}</div>
          </div>
        </details>

        <details className="section-card library-draft-panel">
          <summary><span><span className="eyebrow">CATALOG CARE</span><strong>Request a source or report a broken link</strong></span><span>Writes only when you act</span></summary>
          <div className="library-tools-body two-column">
            <div>
              <h3>Request a source</h3>
              <p>Signed-in requests go to source-reviewer review when Supabase is configured; otherwise a browser-local draft is saved.</p>
              <label><span>Source name</span><input value={suggestion.sourceName} onChange={(event) => setSuggestion({ ...suggestion, sourceName: event.target.value })} /></label>
              <label><span>Official URL</span><input inputMode="url" value={suggestion.officialUrl} onChange={(event) => setSuggestion({ ...suggestion, officialUrl: event.target.value })} /></label>
              <label><span>Suggested field</span><select value={suggestion.category} onChange={(event) => setSuggestion({ ...suggestion, category: event.target.value })}><option value="">Choose a field</option>{livingLibraryBrowseCategories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select></label>
              <label><span>Why it belongs</span><textarea value={suggestion.notes} onChange={(event) => setSuggestion({ ...suggestion, notes: event.target.value })} rows={4} /></label>
              <label><span>License, privacy, or contact note</span><textarea value={suggestion.submitterNote} onChange={(event) => setSuggestion({ ...suggestion, submitterNote: event.target.value })} rows={3} /></label>
              <button type="button" onClick={() => void saveDraft("suggestion", suggestion)}>Save or submit source request</button>
            </div>
            <div>
              <h3>Report a broken link</h3>
              <p>Nothing is sent until you use the button. Signed-out reports remain browser-local drafts.</p>
              <label><span>Source name</span><input value={brokenLink.sourceName} onChange={(event) => setBrokenLink({ ...brokenLink, sourceName: event.target.value })} /></label>
              <label><span>Official URL</span><input inputMode="url" value={brokenLink.officialUrl} onChange={(event) => setBrokenLink({ ...brokenLink, officialUrl: event.target.value })} /></label>
              <label><span>What seems broken?</span><textarea value={brokenLink.notes} onChange={(event) => setBrokenLink({ ...brokenLink, notes: event.target.value })} rows={4} /></label>
              <button type="button" onClick={() => void saveDraft("broken-link", brokenLink)}>Save or submit broken-link report</button>
            </div>
          </div>
        </details>
      </section>

      <section className="section-card library-legacy-note">
        <p className="eyebrow">Continuity without clutter</p>
        <h2>Saved legacy records still resolve</h2>
        <p>{legacyLivingLibrarySources.length} retired, superseded, folded, or out-of-scope records remain available by stable source ID for old shelves and citations. They never rank in ordinary active search.</p>
        <Link className="button-link button-link--quiet" to="/living-library/source/microsoft-academic-graph-legacy">View a retired-record example</Link>
      </section>

      <p className="library-status-live" role="status" aria-live="polite">{statusMessage}</p>
    </div>
  );
}

function CitationPanel({
  record,
  source,
  saved,
  onClose,
  onCopy,
  onSave,
  onRemove,
}: {
  record: SavedCitationRecord;
  source?: LivingLibrarySource;
  saved: boolean;
  onClose: () => void;
  onCopy: (record: SavedCitationRecord) => Promise<void>;
  onSave: (record: SavedCitationRecord) => void;
  onRemove: (sourceId: string) => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const returnTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    titleRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (returnTarget?.isConnected) returnTarget.focus();
    };
  }, [onClose]);

  return <section className="section-card library-citation-panel" role="dialog" aria-modal="false" aria-labelledby="library-citation-title" aria-describedby="library-citation-access-note">
    <div>
      <p className="eyebrow">Citation</p>
      <h2 id="library-citation-title" ref={titleRef} tabIndex={-1}>{source?.name ?? record.sourceId}</h2>
      <p>{record.citationText}</p>
      <p className="library-citation-date" id="library-citation-access-note">Access date generated at this citation action: {record.accessedAt.slice(0, 10)}. Catalog verification dates remain separate.</p>
    </div>
    <div className="button-row">
      <button type="button" onClick={() => void onCopy(record)}>Copy citation</button>
      {saved ? <button type="button" onClick={() => onRemove(record.sourceId)}>Remove saved citation</button> : <button type="button" onClick={() => onSave(record)}>Save citation locally</button>}
      <button type="button" onClick={onClose}>Close</button>
    </div>
  </section>;
}

export { activeLivingLibrarySources, allLivingLibrarySources };
