import { useMemo, useState } from "react";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import { hasSupabaseConfig, supabase, supabaseNotConfiguredMessage } from "../The-Elysia-Marketplace/lib/supabase";
import { createReviewItem } from "../../shared/review/reviewClient";
import {
  livingLibraryAccountFunctions,
  livingLibraryEthicsPrinciples,
  livingLibraryPageCopy,
  livingLibrarySources,
  livingLibraryStarterPacks,
  type LivingLibrarySource
} from "./livingLibrarySources";

type LibraryFilters = {
  search: string;
  category: string;
  sourceType: string;
  topic: string;
  usefulFor: string;
  riskLabel: string;
  signupRequired: string;
  cloudRequired: string;
  apiAvailable: string;
  bulkDownloadAvailable: string;
};

type LocalCollection = {
  name: string;
  sourceIds: string[];
};

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

const STORAGE_KEYS = {
  savedSources: "elysiaLivingLibrary.savedSources.v1",
  savedCitations: "elysiaLivingLibrary.savedCitations.v1",
  bookmarkedPacks: "elysiaLivingLibrary.bookmarkedPacks.v1",
  collections: "elysiaLivingLibrary.collections.v1",
  drafts: "elysiaLivingLibrary.drafts.v1"
} as const;

const defaultFilters: LibraryFilters = {
  search: "",
  category: "all",
  sourceType: "all",
  topic: "all",
  usefulFor: "all",
  riskLabel: "all",
  signupRequired: "all",
  cloudRequired: "all",
  apiAvailable: "all",
  bulkDownloadAvailable: "all"
};

const categoryOrder = [
  "Trusted Data Portals",
  "Model Training Commons",
  "Environmental Data",
  "Social & Economic Data",
  "Physical Science Data",
  "Biology & Health Data",
  "Code Datasets",
  "Research Papers & Scholarly Graphs",
  "Dataset Ethics & Licensing",
  "Stewardship Organizations",
  "Local AI Tools",
  "Elysia Technical Foundations"
];

const categoryDescriptions: Record<string, string> = {
  "Trusted Data Portals": "Official public data portals, APIs, and civic discovery shelves with provenance and dataset-specific terms.",
  "Model Training Commons": "Dataset repositories and benchmark sources that require careful license, privacy, and training-use review.",
  "Environmental Data": "Climate, biodiversity, land, water, air, agriculture, ecosystem, and geospatial source pathways.",
  "Social & Economic Data": "Public-interest, economic, housing, demographic, health, and policy data with human-context cautions.",
  "Physical Science Data": "Chemistry, materials, space, geology, hazards, and physical-science repositories.",
  "Biology & Health Data": "Biomedical, genomic, neuroscience, health, and life-science sources with extra privacy care.",
  "Code Datasets": "Code archives, package ecosystems, public repositories, and software-source datasets with license risk made visible.",
  "Research Papers & Scholarly Graphs": "Scholarly metadata, open papers, citation graphs, research repositories, and evidence-map starting points.",
  "Dataset Ethics & Licensing": "License, consent, provenance, attribution, and training-use guidance sources.",
  "Stewardship Organizations": "Organizations people may learn from or support directly, without implied affiliation or partnership.",
  "Local AI Tools": "Local-first and self-hostable AI tools, search, model, and data infrastructure references.",
  "Elysia Technical Foundations": "Technical foundations for private local Elysia, secure releases, governed local tools, and public infrastructure."
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
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function categoryAnchor(category: string) {
  return `library-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function orderedCategories(categories: string[]) {
  const known = categoryOrder.filter((category) => categories.includes(category));
  const extra = uniqueSorted(categories.filter((category) => !categoryOrder.includes(category)));
  return [...known, ...extra];
}

function accessBadge(label: string, value: string) {
  const normalized = value.toLowerCase();
  const tone = normalized === "yes" ? "library-badge--warning" : normalized === "no" ? "library-badge--safe" : "library-badge--neutral";
  return <span className={`library-badge ${tone}`}>{label}: {value}</span>;
}

function sourceCitation(source: LivingLibrarySource) {
  return `${source.name}. Official website. ${source.officialUrl}. Accessed ${source.lastChecked}. ${source.citationAttributionNotes}`;
}

function matchesFilter(value: string, selected: string) {
  return selected === "all" || value === selected;
}

function sourceMatches(source: LivingLibrarySource, filters: LibraryFilters) {
  const haystack = [
    source.name,
    source.organization,
    source.category,
    source.sourceType,
    source.bestFor,
    source.licenseReuseNotes,
    source.privacyEthicsWarnings,
    source.whyItBelongs,
    source.limitationsCautions,
    ...source.primaryTopics,
    ...source.usefulFor,
    ...source.riskLabels
  ].join(" ").toLowerCase();
  const searchOk = !filters.search.trim() || haystack.includes(filters.search.trim().toLowerCase());
  return searchOk
    && matchesFilter(source.category, filters.category)
    && matchesFilter(source.sourceType, filters.sourceType)
    && (filters.topic === "all" || source.primaryTopics.includes(filters.topic))
    && (filters.usefulFor === "all" || source.usefulFor.includes(filters.usefulFor))
    && (filters.riskLabel === "all" || source.riskLabels.includes(filters.riskLabel))
    && matchesFilter(source.signupRequired, filters.signupRequired)
    && matchesFilter(source.cloudRequired, filters.cloudRequired)
    && matchesFilter(source.apiAvailable, filters.apiAvailable)
    && matchesFilter(source.bulkDownloadAvailable, filters.bulkDownloadAvailable);
}

function downloadText(filename: string, text: string, type: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([text], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

function collectionToMarkdown(name: string, sources: LivingLibrarySource[]) {
  return [
    `# ${name}`,
    "",
    "Saved locally in this browser for now. Account sync can come later after Supabase tables and RLS are intentionally designed.",
    `Export date: ${new Date().toISOString().slice(0, 10)}`,
    "",
    ...sources.flatMap((source) => [
      `## ${source.name}`,
      `- Official URL: ${source.officialUrl}`,
      `- Category: ${source.category}`,
      `- Source type: ${source.sourceType}`,
      `- Best for: ${source.bestFor}`,
      `- Primary topics: ${source.primaryTopics.join(", ")}`,
      `- Useful for: ${source.usefulFor.join(", ")}`,
      `- Risk labels: ${source.riskLabels.join(", ") || "None listed"}`,
      `- License/reuse notes: ${source.licenseReuseNotes}`,
      `- Privacy/ethics warnings: ${source.privacyEthicsWarnings}`,
      `- Citation: ${sourceCitation(source)}`,
      ""
    ])
  ].join("\n");
}

function SourceCard({
  source,
  saved,
  citationSaved,
  onSave,
  onToggleCitation,
  onCopyCitation,
  onAddToCollection
}: {
  source: LivingLibrarySource;
  saved: boolean;
  citationSaved: boolean;
  onSave: (sourceId: string) => void;
  onToggleCitation: (sourceId: string) => void;
  onCopyCitation: (source: LivingLibrarySource) => void;
  onAddToCollection: (sourceId: string) => void;
}) {
  return (
    <article className="library-source-card">
      <div className="library-source-card__topline">
        <span className="eyebrow">{source.category}</span>
        <span className="library-last-checked">Last checked {source.lastChecked}</span>
      </div>
      <h3>{source.name}</h3>
      <p className="library-source-type">{source.sourceType} by {source.organization}</p>
      <p>{source.bestFor}</p>
      <p><a href={source.officialUrl} target="_blank" rel="noreferrer">Official source</a></p>
      <div className="library-badge-row">
        {accessBadge("Signup", source.signupRequired)}
        {accessBadge("Cloud", source.cloudRequired)}
        {accessBadge("API", source.apiAvailable)}
        {accessBadge("Bulk", source.bulkDownloadAvailable)}
      </div>
      <div className="library-chip-row" aria-label="Primary topics">
        {source.primaryTopics.slice(0, 5).map((topic) => <span key={topic}>{topic}</span>)}
      </div>
      <div className="library-chip-row" aria-label="Useful-for tags">
        {source.usefulFor.slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}
      </div>
      <div className="library-risk-row">
        {source.riskLabels.length ? source.riskLabels.map((risk) => <span key={risk}>{risk}</span>) : <span>No special risk label listed</span>}
      </div>
      <p className="library-card-caution"><strong>Caution:</strong> {source.limitationsCautions}</p>
      <details>
        <summary>Details, cautions, citation</summary>
        <dl className="library-detail-list">
          <div><dt>Useful for</dt><dd>{source.usefulFor.join(", ")}</dd></div>
          <div><dt>Why it belongs</dt><dd>{source.whyItBelongs}</dd></div>
          <div><dt>License/reuse notes</dt><dd>{source.licenseReuseNotes}</dd></div>
          <div><dt>Privacy/ethics warnings</dt><dd>{source.privacyEthicsWarnings}</dd></div>
          <div><dt>Attribution/citation</dt><dd>{source.citationAttributionNotes}</dd></div>
          <div><dt>Plain citation</dt><dd>{sourceCitation(source)}</dd></div>
          <div><dt>Limitations/cautions</dt><dd>{source.limitationsCautions}</dd></div>
        </dl>
      </details>
      <div className="button-row library-card-actions">
        <button type="button" onClick={() => onSave(source.id)}>{saved ? "Unsave" : "Save"}</button>
        <button type="button" onClick={() => onToggleCitation(source.id)}>{citationSaved ? "Drop citation" : "Save citation"}</button>
        <button type="button" onClick={() => onCopyCitation(source)}>Copy citation</button>
        <button type="button" onClick={() => onAddToCollection(source.id)}>Add to collection</button>
      </div>
    </article>
  );
}

export default function LivingLibraryPage() {
  const [filters, setFilters] = useState<LibraryFilters>(defaultFilters);
  const [savedSourceIds, setSavedSourceIds] = useState<string[]>(() => readStorage(STORAGE_KEYS.savedSources, []));
  const [savedCitationIds, setSavedCitationIds] = useState<string[]>(() => readStorage(STORAGE_KEYS.savedCitations, []));
  const [bookmarkedPackIds, setBookmarkedPackIds] = useState<string[]>(() => readStorage(STORAGE_KEYS.bookmarkedPacks, []));
  const [collections, setCollections] = useState<LocalCollection[]>(() => readStorage(STORAGE_KEYS.collections, [{ name: "Research shelf", sourceIds: [] }]));
  const [activeCollectionName, setActiveCollectionName] = useState(() => collections[0]?.name ?? "Research shelf");
  const [collectionName, setCollectionName] = useState("");
  const [drafts, setDrafts] = useState<LocalDraft[]>(() => readStorage(STORAGE_KEYS.drafts, []));
  const [suggestion, setSuggestion] = useState({ sourceName: "", officialUrl: "", category: "", notes: "", submitterNote: "" });
  const [brokenLink, setBrokenLink] = useState({ sourceName: "", officialUrl: "", notes: "" });
  const [statusMessage, setStatusMessage] = useState("Saved locally in this browser for now. Account sync can come later after Supabase tables and RLS are intentionally designed.");

  const filterOptions = useMemo(() => ({
    categories: uniqueSorted(livingLibrarySources.map((source) => source.category)),
    sourceTypes: uniqueSorted(livingLibrarySources.map((source) => source.sourceType)),
    topics: uniqueSorted(livingLibrarySources.flatMap((source) => source.primaryTopics)),
    usefulFor: uniqueSorted(livingLibrarySources.flatMap((source) => source.usefulFor)),
    riskLabels: uniqueSorted(livingLibrarySources.flatMap((source) => source.riskLabels)),
    accessValues: uniqueSorted(livingLibrarySources.flatMap((source) => [source.signupRequired, source.cloudRequired, source.apiAvailable, source.bulkDownloadAvailable]))
  }), []);

  const filteredSources = useMemo(() => livingLibrarySources.filter((source) => sourceMatches(source, filters)), [filters]);
  const activeFiltersCount = Object.values(filters).filter((value) => value !== "" && value !== "all").length;
  const groupedSources = useMemo(() => {
    const categories = orderedCategories(uniqueSorted(filteredSources.map((source) => source.category)));
    return categories.map((category) => ({
      category,
      description: categoryDescriptions[category] ?? "Curated sources with visible access, license, reuse, and caution notes.",
      sources: filteredSources.filter((source) => source.category === category)
    })).filter((section) => section.sources.length > 0);
  }, [filteredSources]);
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    livingLibrarySources.forEach((source) => counts.set(source.category, (counts.get(source.category) ?? 0) + 1));
    return counts;
  }, []);
  const navCategories = orderedCategories(uniqueSorted(livingLibrarySources.map((source) => source.category)));
  const activeCollection = collections.find((collection) => collection.name === activeCollectionName) ?? collections[0];
  const savedSources = livingLibrarySources.filter((source) => savedSourceIds.includes(source.id));
  const activeCollectionSources = livingLibrarySources.filter((source) => activeCollection?.sourceIds.includes(source.id));
  const stewardshipSources = livingLibrarySources.filter((source) => source.category === "Stewardship Organizations");

  function updateSavedSources(next: string[]) {
    setSavedSourceIds(next);
    writeStorage(STORAGE_KEYS.savedSources, next);
  }

  function updateSavedCitations(next: string[]) {
    setSavedCitationIds(next);
    writeStorage(STORAGE_KEYS.savedCitations, next);
  }

  function updateBookmarkedPacks(next: string[]) {
    setBookmarkedPackIds(next);
    writeStorage(STORAGE_KEYS.bookmarkedPacks, next);
  }

  function updateCollections(next: LocalCollection[]) {
    setCollections(next);
    writeStorage(STORAGE_KEYS.collections, next);
  }

  function updateDrafts(next: LocalDraft[]) {
    setDrafts(next);
    writeStorage(STORAGE_KEYS.drafts, next);
  }

  function toggleSavedSource(sourceId: string) {
    const next = savedSourceIds.includes(sourceId) ? savedSourceIds.filter((id) => id !== sourceId) : [...savedSourceIds, sourceId];
    updateSavedSources(next);
    setStatusMessage(savedSourceIds.includes(sourceId) ? "Source removed from this browser's local saves." : "Source saved locally in this browser.");
  }

  function toggleCitation(sourceId: string) {
    const next = savedCitationIds.includes(sourceId) ? savedCitationIds.filter((id) => id !== sourceId) : [...savedCitationIds, sourceId];
    updateSavedCitations(next);
    setStatusMessage(savedCitationIds.includes(sourceId) ? "Citation removed from local saved citations." : "Citation saved locally in this browser.");
  }

  async function copyCitation(source: LivingLibrarySource) {
    const citation = sourceCitation(source);
    try {
      await navigator.clipboard.writeText(citation);
      setStatusMessage(`Copied citation for ${source.name}.`);
    } catch {
      setStatusMessage(`Citation ready: ${citation}`);
    }
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

  function addToActiveCollection(sourceId: string) {
    if (!activeCollection) return;
    const next = collections.map((collection) => collection.name === activeCollection.name
      ? { ...collection, sourceIds: Array.from(new Set([...collection.sourceIds, sourceId])) }
      : collection);
    updateCollections(next);
    setStatusMessage("Added source to the active local collection.");
  }

  function exportActiveCollection(format: "markdown" | "json") {
    if (!activeCollection) return;
    if (format === "markdown") {
      downloadText(`${activeCollection.name.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase() || "living-library-collection"}.md`, collectionToMarkdown(activeCollection.name, activeCollectionSources), "text/markdown");
    } else {
      downloadText(`${activeCollection.name.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase() || "living-library-collection"}.json`, JSON.stringify({ note: statusMessage, collection: activeCollection, sources: activeCollectionSources }, null, 2), "application/json");
    }
    setStatusMessage(`Exported ${activeCollection.name} as ${format.toUpperCase()} from local browser state.`);
  }

  async function saveDraft(kind: LocalDraft["kind"], draft: { sourceName: string; officialUrl: string; category?: string; submitterNote?: string; notes: string }) {
    if (!draft.sourceName.trim() && !draft.officialUrl.trim() && !draft.notes.trim()) return;
    const localDraft = { id: `${kind}-${Date.now()}`, kind, sourceName: draft.sourceName, officialUrl: draft.officialUrl, category: draft.category, submitterNote: draft.submitterNote, notes: draft.notes, createdAt: new Date().toISOString() };
    if (!hasSupabaseConfig || !supabase) {
      updateDrafts([localDraft, ...drafts]);
      setStatusMessage(`${supabaseNotConfiguredMessage} ${kind === "suggestion" ? "Source request" : "Broken-link report"} saved locally as a draft.`);
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      updateDrafts([localDraft, ...drafts]);
      setStatusMessage(`Sign in to a Website Account to save this ${kind === "suggestion" ? "source suggestion" : "broken-link report"} for review. A local draft was saved.`);
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
        status: "pending_review"
      });
      if (error) {
        updateDrafts([localDraft, ...drafts]);
        setStatusMessage(`Could not save source suggestion remotely: ${error.message}. A local draft was saved.`);
        return;
      }
      const reviewResult = await createReviewItem({ domain: "living_library_source", sourceTable: "living_library_source_suggestions", sourceId: requestId, submittedBy: auth.user.id, title: draft.sourceName.trim(), summary: draft.notes.trim().slice(0, 280) });
      setStatusMessage(reviewResult.ok ? "Source suggestion saved for source-reviewer review." : `Source suggestion saved, but review routing needs attention: ${reviewResult.warning}`);
      setSuggestion({ sourceName: "", officialUrl: "", category: "", notes: "", submitterNote: "" });
    } else {
      const { error } = await supabase.from("broken_link_reports").insert({
        id: requestId,
        user_id: auth.user.id,
        page_url: typeof window === "undefined" ? "/living-library" : window.location.pathname,
        broken_url: draft.officialUrl.trim(),
        source_context: draft.sourceName.trim() || "Living Library",
        report_note: draft.notes.trim() || null,
        status: "pending_review"
      });
      if (error) {
        updateDrafts([localDraft, ...drafts]);
        setStatusMessage(`Could not save broken-link report remotely: ${error.message}. A local draft was saved.`);
        return;
      }
      const reviewResult = await createReviewItem({ domain: "living_library_broken_link", sourceTable: "broken_link_reports", sourceId: requestId, submittedBy: auth.user.id, title: `Broken link: ${draft.sourceName || draft.officialUrl}`, summary: draft.notes.trim().slice(0, 280) });
      setStatusMessage(reviewResult.ok ? "Broken-link report saved for review." : `Broken-link report saved, but review routing needs attention: ${reviewResult.warning}`);
      setBrokenLink({ sourceName: "", officialUrl: "", notes: "" });
    }
  }

  return (
    <div className="page-stack living-library-page">
      <PageHero eyebrow={livingLibraryPageCopy.heroEyebrow} title={livingLibraryPageCopy.heroTitle} brandMark="standard">
        <p>{livingLibraryPageCopy.heroBody}</p>
      </PageHero>

      <section className="library-truth-grid">
        <WarningCallout title="Research commons doctrine"><p>{livingLibraryPageCopy.doctrineCallout}</p></WarningCallout>
        <WarningCallout title="Private Elysia boundary"><p>{livingLibraryPageCopy.privateBoundary}</p></WarningCallout>
        <WarningCallout title="Training safety warning"><p>{livingLibraryPageCopy.trainingSafetyWarning}</p></WarningCallout>
        <WarningCallout title="Last checked"><p>{livingLibraryPageCopy.lastCheckedNote}</p></WarningCallout>
      </section>

      <section className="section-card library-status-card">
        <p className="boundary-note">Some official links may change over time. Broken-link reports and source updates will be reviewed through the future administrator workflow.</p>
        <p className="eyebrow">Local Library Shelf</p>
        <h2>Browser-local tools, no account sync yet.</h2>
        <p>{statusMessage}</p>
        <div className="library-stats-row">
          <span>{livingLibrarySources.length} sources</span>
          <span>{savedSourceIds.length} saved</span>
          <span>{savedCitationIds.length} citations</span>
          <span>{bookmarkedPackIds.length} starter packs</span>
          <span>{drafts.length} local drafts</span>
        </div>
      </section>

      <section className="section-card library-filter-card">
        <div className="section-heading section-heading--inline">
          <div>
            <p className="eyebrow">Search & Filters</p>
            <h2>{filteredSources.length} matching sources</h2>
          </div>
          <button type="button" onClick={() => setFilters(defaultFilters)}>Reset filters</button>
        </div>
        <div className="library-category-nav" aria-label="Living Library category navigation">
          {(activeFiltersCount ? groupedSources.map((section) => section.category) : navCategories).map((category) => {
            const matchingCount = groupedSources.find((section) => section.category === category)?.sources.length;
            const count = activeFiltersCount ? matchingCount ?? 0 : categoryCounts.get(category) ?? 0;
            return <a key={category} href={`#${categoryAnchor(category)}`}>{category} ({count})</a>;
          })}
        </div>
        <div className="library-filter-grid">
          <label><span>Search</span><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search names, topics, cautions..." /></label>
          <label><span>Category</span><select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="all">All categories</option>{filterOptions.categories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>Source type</span><select value={filters.sourceType} onChange={(event) => setFilters({ ...filters, sourceType: event.target.value })}><option value="all">All source types</option>{filterOptions.sourceTypes.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>Topic</span><select value={filters.topic} onChange={(event) => setFilters({ ...filters, topic: event.target.value })}><option value="all">All topics</option>{filterOptions.topics.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>Useful for</span><select value={filters.usefulFor} onChange={(event) => setFilters({ ...filters, usefulFor: event.target.value })}><option value="all">All uses</option>{filterOptions.usefulFor.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>Risk label</span><select value={filters.riskLabel} onChange={(event) => setFilters({ ...filters, riskLabel: event.target.value })}><option value="all">All risk labels</option>{filterOptions.riskLabels.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>Signup</span><select value={filters.signupRequired} onChange={(event) => setFilters({ ...filters, signupRequired: event.target.value })}><option value="all">Any signup state</option>{filterOptions.accessValues.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>Cloud</span><select value={filters.cloudRequired} onChange={(event) => setFilters({ ...filters, cloudRequired: event.target.value })}><option value="all">Any cloud state</option>{filterOptions.accessValues.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>API</span><select value={filters.apiAvailable} onChange={(event) => setFilters({ ...filters, apiAvailable: event.target.value })}><option value="all">Any API state</option>{filterOptions.accessValues.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>Bulk download</span><select value={filters.bulkDownloadAvailable} onChange={(event) => setFilters({ ...filters, bulkDownloadAvailable: event.target.value })}><option value="all">Any bulk state</option>{filterOptions.accessValues.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        </div>
      </section>

      <section className="section-card">
        <p className="eyebrow">Starter Packs</p>
        <h2>Curated first shelves</h2>
        <div className="library-pack-grid">
          {livingLibraryStarterPacks.map((pack) => (
            <article className="library-pack-card" key={pack.id}>
              <h3>{pack.name}</h3>
              <p>{pack.description}</p>
              <p><strong>Best for:</strong> {pack.bestFor}</p>
              <p><strong>Sources:</strong> {pack.sourceNames.join(", ")}</p>
              <p><strong>Risk notes:</strong> {pack.riskNotes}</p>
              <div className="library-chip-row">{pack.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              <button type="button" onClick={() => updateBookmarkedPacks(bookmarkedPackIds.includes(pack.id) ? bookmarkedPackIds.filter((id) => id !== pack.id) : [...bookmarkedPackIds, pack.id])}>{bookmarkedPackIds.includes(pack.id) ? "Unbookmark starter pack" : "Bookmark starter pack"}</button>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card library-local-tools">
        <p className="eyebrow">Local Collections</p>
        <h2>Save, cite, group, and export locally.</h2>
        <p className="boundary-note">Saved locally in this browser for now. Account sync can come later after Supabase tables and RLS are intentionally designed.</p>
        <div className="library-filter-grid library-filter-grid--compact">
          <label><span>Active collection</span><select value={activeCollectionName} onChange={(event) => setActiveCollectionName(event.target.value)}>{collections.map((collection) => <option key={collection.name} value={collection.name}>{collection.name}</option>)}</select></label>
          <label><span>New collection name</span><input value={collectionName} onChange={(event) => setCollectionName(event.target.value)} placeholder="Watershed research shelf" /></label>
        </div>
        <div className="button-row"><button type="button" onClick={createCollection}>Create local collection</button><button type="button" onClick={() => exportActiveCollection("markdown")}>Export active collection as Markdown</button><button type="button" onClick={() => exportActiveCollection("json")}>Export active collection as JSON</button></div>
        <p>{activeCollection?.name ?? "No active collection"}: {activeCollectionSources.length} sources. Saved sources: {savedSources.length}.</p>
        <div className="library-account-grid">
          {livingLibraryAccountFunctions.map((item) => <article key={item.name}><h3>{item.name}</h3><p className="library-source-type">{item.status}</p><p>{item.copy}</p></article>)}
        </div>
      </section>

      <section className="section-card library-draft-panel">
        <p className="eyebrow">Local Drafts</p>
        <h2>Request a new source</h2>
        <p>Source requests save locally when signed out and save for source-reviewer review when signed in with Supabase configured.</p>
        <div className="two-column">
          <div>
            <h3>Request a new source</h3>
            <label><span>Source name</span><input value={suggestion.sourceName} onChange={(event) => setSuggestion({ ...suggestion, sourceName: event.target.value })} /></label>
            <label><span>Official URL</span><input value={suggestion.officialUrl} onChange={(event) => setSuggestion({ ...suggestion, officialUrl: event.target.value })} /></label>
            <label><span>Category</span><input value={suggestion.category} onChange={(event) => setSuggestion({ ...suggestion, category: event.target.value })} placeholder="Environmental Data" /></label>
            <label><span>Why it belongs</span><textarea value={suggestion.notes} onChange={(event) => setSuggestion({ ...suggestion, notes: event.target.value })} rows={4} /></label>
            <label><span>Caution/license/privacy notes or submitter contact</span><textarea value={suggestion.submitterNote} onChange={(event) => setSuggestion({ ...suggestion, submitterNote: event.target.value })} rows={3} /></label>
            <button type="button" onClick={() => void saveDraft("suggestion", suggestion)}>Save source request draft locally</button>
          </div>
          <div>
            <h3>Draft broken-link report</h3>
            <label><span>Source name</span><input value={brokenLink.sourceName} onChange={(event) => setBrokenLink({ ...brokenLink, sourceName: event.target.value })} /></label>
            <label><span>Official URL</span><input value={brokenLink.officialUrl} onChange={(event) => setBrokenLink({ ...brokenLink, officialUrl: event.target.value })} /></label>
            <label><span>What seems broken?</span><textarea value={brokenLink.notes} onChange={(event) => setBrokenLink({ ...brokenLink, notes: event.target.value })} rows={4} /></label>
            <button type="button" onClick={() => void saveDraft("broken-link", brokenLink)}>Save broken-link draft locally</button>
          </div>
        </div>
      </section>

      <section className="section-card library-source-sections-card">
        <p className="eyebrow">Source Cards</p>
        <h2>{activeFiltersCount ? `${filteredSources.length} filtered sources grouped by category` : "Official links grouped by category"}</h2>
        <p>Long license, privacy, citation, and caution notes stay inside each card's details toggle so the library remains browsable.</p>
        {filteredSources.length === 0 ? <div className="empty-state">No Living Library sources match the current search and filters. Clear filters to return to the full category shelf.</div> : null}
        <div className="library-grouped-sections">
          {groupedSources.map((section) => (
            <section className="library-category-section" id={categoryAnchor(section.category)} key={section.category}>
              <div className="library-category-heading">
                <div>
                  <p className="eyebrow">{section.category}</p>
                  <h3>{section.category}</h3>
                  <p>{section.description}</p>
                </div>
                <span>{section.sources.length} {activeFiltersCount ? "matching" : "total"} source{section.sources.length === 1 ? "" : "s"}</span>
              </div>
              <div className="library-source-grid">
                {section.sources.map((source) => (
                  <SourceCard
                    key={source.id}
                    source={source}
                    saved={savedSourceIds.includes(source.id)}
                    citationSaved={savedCitationIds.includes(source.id)}
                    onSave={toggleSavedSource}
                    onToggleCitation={toggleCitation}
                    onCopyCitation={copyCitation}
                    onAddToCollection={addToActiveCollection}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="section-card">
        <p className="eyebrow">Dataset Ethics & Licensing</p>
        <h2>Principles before reuse</h2>
        <div className="library-ethics-grid">
          {livingLibraryEthicsPrinciples.map((principle) => <article key={principle.title}><h3>{principle.title}</h3><p>{principle.body}</p></article>)}
        </div>
      </section>

      <section className="section-card">
        <p className="eyebrow">Stewardship Organizations</p>
        <h2>Stewardship Organizations We Encourage Members to Support</h2>
        <p className="boundary-note">This listing is informational and does not imply affiliation, sponsorship, or partnership.</p>
        <div className="library-stewardship-list">
          {stewardshipSources.map((source) => <a key={source.id} href={source.officialUrl} target="_blank" rel="noreferrer">{source.name}</a>)}
        </div>
      </section>
    </div>
  );
}
