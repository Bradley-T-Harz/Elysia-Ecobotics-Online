import { useCallback, useEffect, useMemo, useState } from "react";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import { seedAddons } from "../The-Elysia-Marketplace/data/seedAddons";
import type { AddonManifest } from "../The-Elysia-Marketplace/types";
import {
  allLivingLibrarySources,
  formatLivingLibraryCitation,
  type LivingLibrarySource,
} from "../The-Living-Library/livingLibraryCatalog";
import {
  loadCommonsHomebase,
  markFollowedThreadRead,
  removeSavedAddon,
  removeSavedCitation,
  removeSavedCommunePost,
  removeSavedLivingSource,
  removeSourceCollection,
  saveCitationToAccount,
  setFollowedThreadMuted,
  unfollowCommuneThread,
  updateSourceCollectionVisibility
} from "./commonsCircleApi";
import type { CommonsHomebaseData, SavedLivingSourcePreview } from "./commonsCircleApi";

type ShelfFilter = "all" | "marketplace" | "living" | "citations" | "collections" | "commune" | "threads";

const filters: Array<{ key: ShelfFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "marketplace", label: "Marketplace" },
  { key: "living", label: "Living Library" },
  { key: "citations", label: "Citations" },
  { key: "collections", label: "Collections" },
  { key: "commune", label: "Commune" },
  { key: "threads", label: "Followed Threads" }
];

function EmptyShelf({ children }: { children: string }) {
  return <p className="commons-empty-state saved-shelves-empty">{children}</p>;
}

function ShelfPills({ labels }: { labels: string[] }) {
  return <div className="commons-badge-row">{labels.filter(Boolean).slice(0, 8).map((label) => <span key={label}>{label}</span>)}</div>;
}

function sourceCitation(source: LivingLibrarySource | SavedLivingSourcePreview) {
  if ("officialUrl" in source) return formatLivingLibraryCitation(source);
  return `${source.source_name}. ${source.source_url ?? "Official source URL not stored"}.`;
}

function asUrl(value: unknown) {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim()) ? value.trim() : null;
}

function isPlaceholderUrl(url: string) {
  return /\.example\//i.test(url) || /\/\/example\.com\//i.test(url);
}

function officialSourceUrl(source?: unknown) {
  if (!source) return null;
  const flexibleSource = source as Record<string, unknown>;
  return (
    asUrl(flexibleSource.official_url) ??
    asUrl(flexibleSource.source_url) ??
    asUrl(flexibleSource.url) ??
    asUrl(flexibleSource.website) ??
    asUrl(flexibleSource.homepage_url) ??
    asUrl(flexibleSource.officialUrl) ??
    asUrl(flexibleSource.homepageUrl)
  );
}

function marketplaceExternalUrl(addon?: AddonManifest | null) {
  const url = asUrl(addon?.homepage_url) ?? asUrl(addon?.source_url);
  return url && !isPlaceholderUrl(url) ? url : null;
}

function OfficialSourceAction({ url, label = "saved source", historical = false }: { url: string | null; label?: string; historical?: boolean }) {
  return url
    ? <a className="button-link saved-shelf-official-link" href={url} target="_blank" rel="noopener noreferrer" aria-label={`${historical ? "View historical context for" : "Open"} ${label} — external site, opens in a new tab`}>{historical ? "View historical context" : `Open ${label}`} <span aria-hidden="true">↗</span></a>
    : <span className="saved-shelf-link-missing">Official source link unavailable</span>;
}

function livingLibraryLink(source?: unknown) {
  const flexibleSource = source as Record<string, unknown> | null | undefined;
  const id = typeof flexibleSource?.id === "string" ? flexibleSource.id : typeof flexibleSource?.source_id === "string" ? flexibleSource.source_id : null;
  return id ? `/living-library/source/${id}` : "/living-library";
}

export default function SavedShelvesPage() {
  const [homebase, setHomebase] = useState<CommonsHomebaseData | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<ShelfFilter>("all");
  const sourceById = useMemo(() => new Map(allLivingLibrarySources.map((source) => [source.id, source])), []);
  const addonBySlug = useMemo(() => new Map(seedAddons.map((addon) => [addon.id, addon])), []);

  const pushMessages = useCallback((next: string[]) => {
    setMessages((current) => [...next.filter(Boolean), ...current].slice(0, 8));
  }, []);

  const refresh = useCallback(async () => {
    const result = await loadCommonsHomebase();
    setHomebase(result);
    if (import.meta.env.DEV && result.warnings.length) console.warn("[Saved Shelves diagnostics]", result.warnings);
  }, [pushMessages]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function runAction(action: () => Promise<string[]>) {
    const result = await action();
    pushMessages(result);
    await refresh();
  }

  const accountSources = homebase?.savedLivingSources ?? [];
  const localSources = homebase?.localLiving.savedSources ?? [];
  const localCitations = homebase?.localLiving.savedCitations ?? [];
  const localCollections = homebase?.localLiving.collections ?? [];
  const communeItems = [...(homebase?.communePosts ?? []), ...(homebase?.localCommuneDrafts ?? [])];
  const followedThreads = [...(homebase?.followedThreads ?? []), ...(homebase?.localFollowedThreads ?? [])];
  const counts = {
    marketplace: homebase?.savedAddons.length ?? 0,
    living: accountSources.length + localSources.length,
    citations: (homebase?.savedCitations.length ?? 0) + localCitations.length,
    collections: (homebase?.sourceCollections.length ?? 0) + localCollections.length,
    commune: communeItems.length,
    threads: followedThreads.length
  };
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const show = (key: ShelfFilter) => activeFilter === "all" || activeFilter === key;

  return <div className="page-stack commons-circle-page commons-homebase saved-shelves-page">
    <PageHero eyebrow="Private account room" title="Saved Shelves">
      <p>Everything you have saved across Elysia Ecobotics Online, gathered in one private account room.</p>
      <p>Saved Shelves are private by default. Public profile visibility is controlled separately.</p>
    </PageHero>

    <WarningCallout title="Private by default">
      <p>Saved add-ons, sources, citations, collections, Commune posts, and followed threads belong to your Website Account or this browser. They are not public profile content unless a future visibility setting explicitly says so.</p>
    </WarningCallout>

    {messages.length ? <section className="message-stack" aria-live="polite">{messages.map((message) => <p className="message" key={message}>{message}</p>)}</section> : null}

    {!homebase?.signedIn && <section className="section-card saved-shelves-signin">
      <p className="eyebrow">Website Account</p>
      <h2>Sign in for account-backed shelves</h2>
      <p>Browser-local Living Library saves can appear here, but account-backed Saved Shelves require a Website Account. Nothing is uploaded silently.</p>
      <a className="button-link button-link--primary" href="/commons-circle">Open Commons Circle sign-in</a>
    </section>}

    <section className="section-card saved-shelves-overview">
      <div className="section-heading section-heading--inline">
        <div>
          <p className="eyebrow">Shelf index</p>
          <h2>{total} saved items gathered</h2>
          <p>Use filters to move between shelves without leaving Commons Circle.</p>
        </div>
        <a className="button-link" href="/commons-circle">Back to Commons Circle</a>
      </div>
      <div className="saved-shelves-filter-row">
        {filters.map((filter) => <button className={activeFilter === filter.key ? "button-primary" : ""} type="button" key={filter.key} onClick={() => setActiveFilter(filter.key)}>{filter.label}</button>)}
      </div>
      <dl className="mini-facts">
        <div><dt>Marketplace</dt><dd>{counts.marketplace}</dd></div>
        <div><dt>Living Library</dt><dd>{counts.living}</dd></div>
        <div><dt>Citations</dt><dd>{counts.citations}</dd></div>
        <div><dt>Collections</dt><dd>{counts.collections}</dd></div>
        <div><dt>Commune</dt><dd>{counts.commune}</dd></div>
        <div><dt>Threads</dt><dd>{counts.threads}</dd></div>
      </dl>
    </section>

    {show("marketplace") && <section className="section-card saved-shelf-section saved-shelf-marketplace">
      <p className="eyebrow">Marketplace Shelf</p>
      <h2>Saved add-ons</h2>
      <div className="saved-shelves-grid">{homebase?.savedAddons.length ? homebase.savedAddons.map((addon) => {
        const seedAddon = addonBySlug.get(addon.addon_slug);
        const externalUrl = marketplaceExternalUrl(seedAddon);
        return <article className="saved-shelf-card" key={addon.addon_slug}>
        <p className="eyebrow">Marketplace</p>
        <h3>{addon.addon_name || seedAddon?.name || addon.addon_slug}</h3>
        <p>{addon.notes || seedAddon?.summary || "Saved Marketplace add-on. Local Elysia still reviews and approves any install intent."}</p>
        <ShelfPills labels={[addon.addon_version_id ? `version ${addon.addon_version_id}` : "version not pinned", addon.saved_at ? `saved ${new Date(addon.saved_at).toLocaleDateString()}` : "saved", "account-backed"]} />
        <div className="button-row"><a className="button-link" href={`/marketplace/addons/${addon.addon_slug}`}>View details</a>{externalUrl ? <a className="button-link saved-shelf-official-link" href={externalUrl} target="_blank" rel="noreferrer">External project link</a> : null}<a className="button-link" href={`/marketplace/action-preview?addon=${addon.addon_slug}`}>Prepare local install</a><button type="button" onClick={() => void runAction(() => removeSavedAddon(addon.addon_slug))}>Remove from saved</button></div>
      </article>;
      }) : <EmptyShelf>No saved Marketplace add-ons yet.</EmptyShelf>}</div>
    </section>}

    {show("living") && <section className="section-card saved-shelf-section saved-shelf-living">
      <p className="eyebrow">Living Library Shelf</p>
      <h2>Saved sources</h2>
      <div className="saved-shelves-grid">
        {accountSources.length ? accountSources.map((saved) => {
          const fullSource = sourceById.get(saved.source_id);
          const citation = fullSource ? sourceCitation(fullSource) : sourceCitation(saved);
          const officialUrl = officialSourceUrl(saved) ?? officialSourceUrl(fullSource);
          return <article className="saved-shelf-card saved-source-card" key={saved.source_id}>
            <p className="eyebrow">{fullSource?.category ?? saved.category ?? "Saved source"}</p>
            <h3>{fullSource?.name ?? saved.source_name}</h3>
            <p>{fullSource?.bestFor ?? saved.notes ?? "Saved Living Library source."}</p>
            {fullSource ? <ShelfPills labels={[fullSource.resourceType, fullSource.lifecycle.status, ...fullSource.scienceDomains, `Verified ${fullSource.verification.urlLastVerified}`]} /> : <ShelfPills labels={[saved.category ?? "category not stored", saved.saved_at ? `saved ${new Date(saved.saved_at).toLocaleDateString()}` : "account-backed"]} />}
            {fullSource && <p className="boundary-note">{fullSource.active ? fullSource.limitationsCautions : `Legacy record: ${fullSource.lifecycle.legacyReason}`}</p>}
            <div className="button-row"><OfficialSourceAction url={fullSource?.verification.status === "unavailable" ? null : officialUrl} label={fullSource?.name ?? saved.source_name} historical={fullSource?.links[0]?.role === "historical"} /><a className="button-link" href={livingLibraryLink(fullSource ?? saved)}>View source details</a><button type="button" onClick={() => void navigator.clipboard?.writeText(citation)}>Copy current citation</button><button type="button" onClick={() => void runAction(() => saveCitationToAccount(saved.source_id, citation))}>Save current citation</button><button type="button" onClick={() => void runAction(() => removeSavedLivingSource(saved.source_id))}>Remove from saved</button></div>
          </article>;
        }) : null}
        {!accountSources.length && localSources.length ? localSources.map((source) => <article className="saved-shelf-card saved-source-card" key={source.id}>
          <p className="eyebrow">{source.category}</p>
          <h3>{source.name}</h3>
          <p>{source.bestFor}</p>
          <ShelfPills labels={[source.resourceType, source.lifecycle.status, ...source.scienceDomains, "browser-local"]} />
          <p className="boundary-note">This source is saved locally in this browser. Use explicit sync from Commons Circle to copy browser-local saves to your Website Account.</p>
          <div className="button-row"><OfficialSourceAction url={source.verification.status === "unavailable" ? null : officialSourceUrl(source)} label={source.name} historical={source.links[0]?.role === "historical"} /><a className="button-link" href={livingLibraryLink(source)}>View source details</a><button type="button" onClick={() => void navigator.clipboard?.writeText(sourceCitation(source))}>Copy current citation</button><button type="button" disabled>Account removal after sync</button></div>
        </article>) : null}
        {!accountSources.length && !localSources.length && <EmptyShelf>No saved Living Library sources yet.</EmptyShelf>}
      </div>
    </section>}

    {show("citations") && <section className="section-card saved-shelf-section">
      <p className="eyebrow">Citation Shelf</p>
      <h2>Saved citations</h2>
      <div className="saved-shelves-grid">{homebase?.savedCitations.length ? homebase.savedCitations.map((citation) => {
        const source = sourceById.get(citation.source_id);
        return <article className="saved-shelf-card" key={citation.id || citation.source_id}>
        <p className="eyebrow">{citation.citation_format || "plain citation"}</p>
        <h3>{source?.name ?? citation.source_id}</h3>
        <p>{citation.citation_text}</p>
        <ShelfPills labels={[citation.saved_at ? `saved ${new Date(citation.saved_at).toLocaleDateString()}` : "account-backed"]} />
        <div className="button-row"><OfficialSourceAction url={source?.verification.status === "unavailable" ? null : officialSourceUrl(source)} label={source?.name ?? citation.source_id} historical={source?.links[0]?.role === "historical"} /><a className="button-link" href={livingLibraryLink(source ?? citation)}>View source details</a><button type="button" onClick={() => void navigator.clipboard?.writeText(citation.citation_text)}>Copy saved citation</button>{citation.id ? <button type="button" onClick={() => void runAction(() => removeSavedCitation(citation.id!))}>Remove</button> : <button type="button" disabled>Remove unavailable</button>}</div>
      </article>;
      }) : localCitations.length ? localCitations.map((citation) => {
        const source = sourceById.get(citation.source_id);
        return <article className="saved-shelf-card" key={citation.source_id}>
        <p className="eyebrow">browser-local</p>
        <h3>{source?.name ?? citation.source_id}</h3>
        <p>{citation.citation_text}</p>
        <div className="button-row"><OfficialSourceAction url={source?.verification.status === "unavailable" ? null : officialSourceUrl(source)} label={source?.name ?? citation.source_id} historical={source?.links[0]?.role === "historical"} /><a className="button-link" href={livingLibraryLink(source ?? citation)}>View source details</a><button type="button" onClick={() => void navigator.clipboard?.writeText(citation.citation_text)}>Copy saved citation</button></div>
      </article>;
      }) : <EmptyShelf>No saved citations yet.</EmptyShelf>}</div>
    </section>}

    {show("collections") && <section className="section-card saved-shelf-section">
      <p className="eyebrow">Source Collections</p>
      <h2>Research shelves and collections</h2>
      <div className="saved-shelves-grid">{homebase?.sourceCollections.length ? homebase.sourceCollections.map((collection) => <article className="saved-shelf-card" key={collection.id || collection.title}>
        <p className="eyebrow">{collection.visibility}</p>
        <h3>{collection.title}</h3>
        <p>{collection.description || "Saved source collection."}</p>
        <ShelfPills labels={[`${collection.source_count} sources`, collection.created_at ? `created ${new Date(collection.created_at).toLocaleDateString()}` : "account-backed"]} />
        <details><summary>Collection details</summary>{collection.source_ids?.length ? <ul className="saved-shelf-source-list">{collection.source_ids.map((sourceId) => {
          const source = sourceById.get(sourceId);
          return <li key={sourceId}><span>{source?.name ?? sourceId}</span><OfficialSourceAction url={source?.verification.status === "unavailable" ? null : officialSourceUrl(source)} label={source?.name ?? sourceId} /></li>;
        })}</ul> : <p>Source previews will expand here as account-backed collection item metadata grows. Current count: {collection.source_count}.</p>}</details>
        <div className="button-row"><button type="button" onClick={() => void navigator.clipboard?.writeText(`${collection.title}\n${collection.description ?? ""}`)}>Export summary</button>{collection.id && <><button type="button" onClick={() => void runAction(() => updateSourceCollectionVisibility(collection.id!, collection.visibility === "public" ? "private" : "public"))}>{collection.visibility === "public" ? "Make private" : "Make public"}</button><button type="button" onClick={() => void runAction(() => removeSourceCollection(collection.id!))}>Remove collection</button></>}<a className="button-link" href="/living-library">View in Living Library</a></div>
      </article>) : localCollections.length ? localCollections.map((collection) => <article className="saved-shelf-card" key={collection.id || collection.title}>
        <p className="eyebrow">browser-local</p>
        <h3>{collection.title}</h3>
        <p>{collection.description || "Local source collection."}</p>
        <ShelfPills labels={[`${collection.source_count} sources`, collection.visibility]} />
        <details><summary>Collection details</summary>{collection.source_ids?.length ? <ul className="saved-shelf-source-list">{collection.source_ids.map((sourceId) => {
          const source = sourceById.get(sourceId);
          return <li key={sourceId}><span>{source?.name ?? sourceId}</span><OfficialSourceAction url={source?.verification.status === "unavailable" ? null : officialSourceUrl(source)} label={source?.name ?? sourceId} /></li>;
        })}</ul> : <p>No source links are stored for this local collection yet.</p>}</details>
        <button type="button" disabled>Account-backed management after sync</button>
      </article>) : <EmptyShelf>No source collections yet.</EmptyShelf>}</div>
    </section>}

    {show("commune") && <section className="section-card saved-shelf-section">
      <p className="eyebrow">Commune Shelf</p>
      <h2>Saved posts and drafts</h2>
      <div className="saved-shelves-grid">{communeItems.length ? communeItems.map((post) => <article className="saved-shelf-card" key={`${post.source}-${post.id}`}>
        <p className="eyebrow">{post.type}</p>
        <h3>{post.title}</h3>
        <p>{post.status} · {post.source}</p>
        <ShelfPills labels={[post.updated_at ? `updated ${new Date(post.updated_at).toLocaleDateString()}` : "date not stored"]} />
        <div className="button-row"><a className="button-link" href={post.source === "account" && post.target_id ? `/commune/posts/${post.target_id}` : "/commune/new"}>{post.source === "account" ? "Open saved post detail" : "Continue draft"}</a>{post.source === "account" ? <button type="button" onClick={() => void runAction(() => removeSavedCommunePost(post.id))}>Remove from saved</button> : <button type="button" disabled>Local draft management remains in Commune</button>}</div>
      </article>) : <EmptyShelf>No saved Commune posts or drafts yet.</EmptyShelf>}</div>
    </section>}

    {show("threads") && <section className="section-card saved-shelf-section">
      <p className="eyebrow">Followed Threads</p>
      <h2>Commune threads you follow</h2>
      <div className="saved-shelves-grid">{followedThreads.length ? followedThreads.map((thread) => <article className="saved-shelf-card" key={`${thread.source}-${thread.id}`}>
        <p className="eyebrow">{thread.source}</p>
        <h3>{thread.title}</h3>
        <p>{thread.unread_count ?? 0} unread · {thread.muted ? "muted" : "active"}</p>
        <ShelfPills labels={[thread.muted ? "muted" : "not muted", thread.source === "account" ? "account-backed" : "browser-local"]} />
        <div className="button-row"><a className="button-link" href={`/commune/posts/${thread.id}`}>Open thread</a>{thread.source === "account" ? <><button type="button" onClick={() => void runAction(() => markFollowedThreadRead(thread.id))}>Mark read</button><button type="button" onClick={() => void runAction(() => setFollowedThreadMuted(thread.id, !thread.muted))}>{thread.muted ? "Unmute" : "Mute"}</button><button type="button" onClick={() => void runAction(() => unfollowCommuneThread(thread.id))}>Unfollow</button></> : <button type="button" disabled>Account-backed management after sync</button>}</div>
      </article>) : <EmptyShelf>No followed Commune threads yet.</EmptyShelf>}</div>
    </section>}
  </div>;
}
