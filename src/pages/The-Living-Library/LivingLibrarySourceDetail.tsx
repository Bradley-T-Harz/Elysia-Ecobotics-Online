import { Link } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";
import type { LivingLibrarySource } from "./livingLibraryCatalog";

function DetailRow({ term, children }: { term: string; children: React.ReactNode }) {
  return <div><dt>{term}</dt><dd>{children}</dd></div>;
}

export default function LivingLibrarySourceDetail({
  source,
  relatedSources,
  successor,
  saved,
  citationSaved,
  onSave,
  onCite,
  onAddToCollection,
}: {
  source: LivingLibrarySource;
  relatedSources: LivingLibrarySource[];
  successor?: LivingLibrarySource;
  saved: boolean;
  citationSaved: boolean;
  onSave: (sourceId: string) => void;
  onCite: (sourceId: string) => void;
  onAddToCollection: (sourceId: string) => void;
}) {
  const primaryLink = source.links.find((link) => link.primary) ?? source.links[0];
  const canOpenPrimary = source.verification.status !== "unavailable";
  const primaryActionLabel = primaryLink.role === "historical" ? "View historical context" : `Open ${source.name}`;
  return (
    <div className="page-stack living-library-page library-detail-page">
      <nav className="library-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/living-library">Living Library</Link><span aria-hidden="true">/</span><span aria-current="page">{source.name}</span>
      </nav>
      <PageHero eyebrow={source.active ? source.browseCategory : "LEGACY CATALOG RECORD"} title={source.name} brandMark="standard">
        <p>{source.bestFor}</p>
      </PageHero>

      {!source.active ? <WarningCallout title="No longer in active discovery">
        <p>{source.lifecycle.legacyReason}</p>
        {successor ? <p>Current family record: <Link to={`/living-library/source/${successor.id}`}>{successor.name}</Link>.</p> : null}
        {source.id === "papers-with-code" ? <p>The linked surviving data project is historical context only and is not equivalent to the former benchmark portal.</p> : null}
      </WarningCallout> : null}

      <section className="section-card library-detail-summary" id="library-source-detail" data-route-focus-target>
        <div className="library-detail-summary__heading">
          <div>
            <p className="eyebrow">{source.resourceType}</p>
            <h2>What this resource actually is</h2>
            <p>{source.content.note}</p>
          </div>
          <div className="library-detail-actions">
            {canOpenPrimary ? <a
              className="button-link library-external-link"
              href={primaryLink.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${primaryActionLabel} — external site, opens in a new tab`}
            >{primaryActionLabel} <span aria-hidden="true">↗</span></a> : <span className="library-unavailable-label">No verified live destination</span>}
            <button type="button" aria-pressed={saved} onClick={() => onSave(source.id)}>{saved ? "Saved to shelf" : "Save to shelf"}</button>
            <button type="button" aria-pressed={citationSaved} onClick={() => onCite(source.id)}>{citationSaved ? "Citation saved" : "Create citation"}</button>
            <button type="button" onClick={() => onAddToCollection(source.id)}>Add to active collection</button>
          </div>
        </div>
        <div className="library-trait-grid">
          <article><span>Public access</span><strong>{source.access.public}</strong></article>
          <article><span>Content status</span><strong>{source.content.reviewStatus}</strong></article>
          <article><span>API</span><strong>{source.access.api}</strong></article>
          <article><span>Download / bulk</span><strong>{source.access.download}</strong></article>
          <article><span>Cloud</span><strong>{source.access.cloud}</strong></article>
          <article><span>Lifecycle</span><strong>{source.lifecycle.status}</strong></article>
        </div>
      </section>

      <section className="library-detail-columns">
        <article className="section-card">
          <p className="eyebrow">Identity & scientific role</p>
          <h2>Operator, field, and coverage</h2>
          <dl className="library-detail-list">
            <DetailRow term="Operator">{source.operator}</DetailRow>
            <DetailRow term="Operator type">{source.operatorType}</DetailRow>
            <DetailRow term="Resource type">{source.resourceType}</DetailRow>
            <DetailRow term="Hosts content">{source.content.hostsContent}</DetailRow>
            <DetailRow term="Scientific fields">{source.scienceDomains.join(", ")}</DetailRow>
            <DetailRow term="Geography">{source.geography.join(", ")}</DetailRow>
            <DetailRow term="Language coverage">{source.languages.join(", ")}</DetailRow>
          </dl>
        </article>
        <article className="section-card">
          <p className="eyebrow">Access</p>
          <h2>Account, API, download, and cloud</h2>
          <p>{source.access.note}</p>
          <dl className="library-detail-list">
            <DetailRow term="Public browsing">{source.access.public}</DetailRow>
            <DetailRow term="API authentication">{source.access.api}</DetailRow>
            <DetailRow term="Bulk/download">{source.access.download}</DetailRow>
            <DetailRow term="Cloud implication">{source.access.cloud}</DetailRow>
          </dl>
        </article>
      </section>

      <section className="section-card">
        <p className="eyebrow">Official destinations</p>
        <h2>Links by purpose</h2>
        <div className="library-link-list">
          {source.links.map((link) => <article key={`${link.role}-${link.url}`}>
            <div><span>{link.role}</span><strong>{link.label}</strong>{link.caution ? <p>{link.caution}</p> : null}</div>
            <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${link.label} — external site, opens in a new tab`}>Open <span aria-hidden="true">↗</span></a>
          </article>)}
        </div>
      </section>

      <section className="library-detail-columns" id="library-license-verification">
        <article className="section-card">
          <p className="eyebrow">License & responsible reuse</p>
          <h2>Rights are record-specific</h2>
          <p>{source.license.summary}</p>
          <p className="boundary-note">{source.license.trainingCaution}</p>
          <dl className="library-detail-list">
            <DetailRow term="Record-level variation">{source.license.recordLevelVariation ? "Yes" : "No"}</DetailRow>
            <DetailRow term="Attribution">{String(source.license.attributionRequired)}</DetailRow>
          </dl>
          {source.license.termsUrl ? <a className="library-external-link" href={source.license.termsUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open terms for ${source.name} — external site, opens in a new tab`}>Open official terms <span aria-hidden="true">↗</span></a> : null}
        </article>
        <article className="section-card">
          <p className="eyebrow">Verification</p>
          <h2>What Elysia checked</h2>
          <dl className="library-detail-list">
            <DetailRow term="URL last verified">{source.verification.urlLastVerified}</DetailRow>
            <DetailRow term="Annotation last verified">{source.verification.annotationLastVerified}</DetailRow>
            <DetailRow term="License/access reviewed">{source.verification.licenseAccessLastVerified}</DetailRow>
            <DetailRow term="Verification status">{source.verification.status}</DetailRow>
            <DetailRow term="Method">{source.verification.method}</DetailRow>
          </dl>
          {source.verification.limitation ? <p className="boundary-note">{source.verification.limitation}</p> : null}
        </article>
      </section>

      {relatedSources.length ? <section className="section-card">
        <p className="eyebrow">Related resources</p>
        <h2>Continue within this field</h2>
        <div className="library-related-grid">
          {relatedSources.map((related) => <Link key={related.id} to={`/living-library/source/${related.id}`}><strong>{related.name}</strong><span>{related.resourceType}</span></Link>)}
        </div>
      </section> : null}
    </div>
  );
}
