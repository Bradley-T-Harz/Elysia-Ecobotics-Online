import { Link, useParams } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import {
  buildLogAreaLabels,
  buildLogEntryForSlug,
  buildLogTypeLabels,
  formatBuildLogDate,
} from "./buildLogEntries.ts";
import type { BuildLogLink } from "./buildLogTypes.ts";

function RelatedLink({ link }: { link: BuildLogLink }) {
  const external = link.external || /^https?:\/\//i.test(link.href);

  if (external) {
    return (
      <a className="button-link" href={link.href} target="_blank" rel="noreferrer">
        {link.label}
      </a>
    );
  }

  return <Link className="button-link" to={link.href}>{link.label}</Link>;
}

export default function BuildLogEntryPage() {
  const { slug } = useParams();
  const entry = buildLogEntryForSlug(slug);

  if (!entry) {
    return (
      <div className="page-stack build-log-entry-page">
        <PageHero eyebrow="Build Log" title="Build Log entry not found" brandMark="standard">
          <p>This path does not match a published Build Log entry.</p>
          <p>Unpublished drafts and private project material are not exposed through guessed URLs.</p>
        </PageHero>

        <section className="section-card build-log-not-found">
          <h2>Return to the public record</h2>
          <p>Browse the published Build Log instead.</p>
          <Link className="button-link button-link--primary" to="/build-log">
            Open the Build Log
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack build-log-entry-page">
      <PageHero
        eyebrow={`${buildLogTypeLabels[entry.type]} · ${formatBuildLogDate(entry.publishedAt)}`}
        title={entry.title}
        brandMark="standard"
        actions={(
          <>
            <Link className="button-link" to="/build-log">← Build Log</Link>
            <Link className="button-link" to="/story">The Story of Elysia</Link>
          </>
        )}
      >
        <p>{entry.summary}</p>
        {entry.milestonePeriod && (
          <p><strong>Milestone period:</strong> {entry.milestonePeriod}</p>
        )}
        <div className="build-log-area-row" aria-label="Build Log subject areas">
          {entry.areas.map((area) => (
            <span key={area}>{buildLogAreaLabels[area]}</span>
          ))}
        </div>
      </PageHero>

      <article className="build-log-entry-shell">
        {entry.correctionNote && (
          <section className="section-card build-log-correction-note" aria-label="Correction note">
            <p className="eyebrow">Correction note</p>
            <p>{entry.correctionNote}</p>
          </section>
        )}

        {entry.sections.map((section) => (
          <section
            className="section-card build-log-entry-section"
            id={section.id}
            key={section.id}
          >
            <h2>{section.heading}</h2>

            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}

            {section.bullets && (
              <ul>
                {section.bullets.map((item) => <li key={item}>{item}</li>)}
              </ul>
            )}
          </section>
        ))}

        {entry.supersededBy && (
          <section className="section-card build-log-superseded-note">
            <p className="eyebrow">Superseded</p>
            <p>This entry has a newer public successor.</p>
            <Link className="button-link" to={`/build-log/${entry.supersededBy}`}>
              Read the newer entry
            </Link>
          </section>
        )}

        {entry.relatedLinks?.length ? (
          <section className="section-card build-log-related-links">
            <p className="eyebrow">Explore further</p>
            <h2>Related public paths</h2>
            <div className="button-row">
              {entry.relatedLinks.map((link) => (
                <RelatedLink key={`${link.href}-${link.label}`} link={link} />
              ))}
            </div>
          </section>
        ) : null}

        {(entry.discussionUrl || entry.officialUpdateUrl || entry.iterationShowcaseUrl) && (
          <section className="section-card build-log-connected-records">
            <p className="eyebrow">Connected public records</p>
            <h2>Continue the trail</h2>
            <div className="button-row">
              {entry.discussionUrl && (
                <Link className="button-link" to={entry.discussionUrl}>Discuss in the Commune</Link>
              )}
              {entry.officialUpdateUrl && (
                <Link className="button-link" to={entry.officialUpdateUrl}>Read the Official Update</Link>
              )}
              {entry.iterationShowcaseUrl && (
                <Link className="button-link" to={entry.iterationShowcaseUrl}>Open the Iteration Showcase</Link>
              )}
            </div>
          </section>
        )}
      </article>
    </div>
  );
}
