import { Link } from "react-router-dom";
import {
  buildLogAreaLabels,
  buildLogTypeLabels,
  formatBuildLogDate,
} from "./buildLogEntries.ts";
import type { BuildLogEntry } from "./buildLogTypes.ts";

export default function BuildLogEntryCard({ entry }: { entry: BuildLogEntry }) {
  return (
    <article className="build-log-entry-card">
      <div className="build-log-entry-meta">
        <time dateTime={entry.publishedAt}>{formatBuildLogDate(entry.publishedAt)}</time>
        <span className="build-log-entry-type">{buildLogTypeLabels[entry.type]}</span>
      </div>

      <h2>
        <Link to={`/build-log/${entry.slug}`}>{entry.title}</Link>
      </h2>

      <p>{entry.summary}</p>

      <div className="build-log-area-row" aria-label="Build Log subject areas">
        {entry.areas.map((area) => (
          <span key={area}>{buildLogAreaLabels[area]}</span>
        ))}
      </div>

      <div className="button-row">
        <Link
          className="button-link button-link--primary"
          to={`/build-log/${entry.slug}`}
        >
          Read entry
        </Link>
      </div>
    </article>
  );
}
