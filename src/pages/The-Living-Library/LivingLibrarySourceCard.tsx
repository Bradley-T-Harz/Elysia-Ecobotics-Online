import { Link } from "react-router-dom";
import type { LivingLibrarySearchResult } from "./livingLibrarySearch";

function traitTone(value: string) {
  if (/retired|unavailable|subscription|required|preprint/i.test(value)) return "library-trait--caution";
  if (/open|not required|peer review expected/i.test(value)) return "library-trait--positive";
  return "library-trait--neutral";
}
export default function LivingLibrarySourceCard({
  result,
  saved,
  citationSaved,
  onSave,
  onCite,
}: {
  result: LivingLibrarySearchResult;
  saved: boolean;
  citationSaved: boolean;
  onSave: (sourceId: string) => void;
  onCite: (sourceId: string) => void;
}) {
  const { source, matchedIn } = result;
  const primaryLink = source.links.find((link) => link.primary) ?? source.links[0];
  return (
    <article className="library-result-card" data-source-id={source.id}>
      <div className="library-result-card__topline">
        <span className="eyebrow">{source.browseCategory}</span>
        <span>{source.resourceType}</span>
      </div>
      <div>
        <h3><Link to={`/living-library/source/${source.id}`}>{source.name}</Link></h3>
        <p className="library-operator">Operated by {source.operator}</p>
      </div>
      <p className="library-result-card__summary">{source.bestFor}</p>
      <div className="library-chip-row" aria-label={`Scientific fields for ${source.name}`}>
        {source.scienceDomains.slice(0, 3).map((domain) => <span key={domain}>{domain}</span>)}
      </div>
      <div className="library-trait-row" aria-label={`Access and content traits for ${source.name}`}>
        <span className={traitTone(source.access.public)}>Access: {source.access.public}</span>
        {source.access.api !== "no API" ? <span className={traitTone(source.access.api)}>API: {source.access.api}</span> : null}
        <span className={traitTone(source.content.reviewStatus)}>Content: {source.content.reviewStatus}</span>
      </div>
      {matchedIn.length ? <p className="library-match-reason">Matched in {matchedIn.slice(0, 3).join(", ")}</p> : null}
      <div className="library-result-card__actions">
        <a
          className="button-link library-external-link"
          href={primaryLink.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${source.name} — external site, opens in a new tab`}
        >
          Open {source.name} <span aria-hidden="true">↗</span>
        </a>
        <Link className="button-link button-link--quiet" to={`/living-library/source/${source.id}`}>Source details</Link>
        <button type="button" aria-pressed={saved} onClick={() => onSave(source.id)}>{saved ? "Saved" : "Save"}</button>
        <button type="button" aria-pressed={citationSaved} onClick={() => onCite(source.id)}>{citationSaved ? "Citation saved" : "Cite"}</button>
      </div>
    </article>
  );
}
