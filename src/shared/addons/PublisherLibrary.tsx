import { Link } from "react-router-dom";
import { usePublisherWorkspace } from "./publisherOwnership";

export default function PublisherLibrary() {
  const workspace = usePublisherWorkspace();
  if (!workspace.signedIn) return null;
  return <section className="section-card publisher-provenance" aria-labelledby="publisher-library-title">
    <h2 id="publisher-library-title">Your publisher identities &amp; releases</h2>
    <p>These relationships come from publisher records. Developer identity, review approval and financial authority remain separate.</p>
    {workspace.loading && <p role="status">Checking publisher records…</p>}{workspace.error && <p role="status">{workspace.error}</p>}
    {workspace.state && <>
      {workspace.state.publishers.map(publisher => <article className="feature-card" key={publisher.id}><h3>{publisher.displayName}</h3><p>{publisher.entityKind === "organization" ? publisher.legalName : "Individual publisher"}</p><p>You are an authorized manager. This is not a reviewer, administrator, economic operator or local installation grant.</p></article>)}
      {!workspace.state.publishers.length && <p>No authorized publisher relationship was returned. You can create your individual publisher while preparing a new draft; an organization relationship requires governed authorization.</p>}
      {workspace.state.releaseReferences.map(release => <article className="feature-card" key={release.id}>
        <h3>{release.addonKey} · {release.version}</h3><p><strong>{release.official ? "Official external release reference" : "External release reference"} · Free</strong></p>
        <dl className="mini-facts"><div><dt>Creator / Organization</dt><dd>{release.creatorAttribution}</dd></div><div><dt>Publisher account at release reference</dt><dd>{release.publisherDisplayName}</dd></div></dl>
        <p>Publisher ownership is recorded. This external release reference does not establish a reviewed Marketplace listing. The existing public release remains available while any remote listing follows the normal submission and independent review workflow.</p>
        <p>Seller payment account: not required by this free release. No payout or provider relationship is created.</p>
        <p>Ownership recorded from {new Date(release.recordedAt).toLocaleDateString()}; this does not invent an earlier ownership or review event.</p>
        <div className="button-row"><Link className="button-link" to={`/marketplace/addons/${encodeURIComponent(release.addonKey)}`}>View public release &amp; manifest</Link><Link className="button-link" to="/developer-forge/drafts/new">Prepare a draft or update</Link><a className="button-link" href={release.releaseReferenceUrl} target="_blank" rel="noreferrer">Release source</a></div>
      </article>)}
      {workspace.state.listings.map(listing => <article className="feature-card" key={listing.id}><h3>{listing.name} · {listing.version}</h3><p>{listing.status.replace(/_/g, " ")}</p><p>Creator / Organization: {listing.creatorAttribution ?? "Historical attribution not recorded"}</p><p>Publisher account at submission: {listing.publisherDisplayName ?? "Historical publisher name not recorded"}</p>{listing.status === "published" && <Link to={`/marketplace/addons/${encodeURIComponent(listing.slug)}`}>View published listing &amp; manifest</Link>}</article>)}
      {!workspace.state.listings.length && <p>No Marketplace listings were returned for your authorized publisher identities. An external release reference is kept separate from a reviewed listing.</p>}
    </>}
  </section>;
}
