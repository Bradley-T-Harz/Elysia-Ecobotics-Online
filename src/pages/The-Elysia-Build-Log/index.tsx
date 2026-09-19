import { Link } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import BuildLogEntryCard from "./BuildLogEntryCard";
import { buildLogEntries } from "./buildLogEntries.ts";

export default function BuildLogPage() {
  const latestEntry = buildLogEntries[0];

  return (
    <div className="page-stack build-log-page">
      <PageHero
        eyebrow="Build in public"
        title="The Elysia Build Log"
        brandMark="standard"
      >
        <p>A public record of what we're building, what changed, what is real, and what comes next.</p>
        <p>The Build Log explains meaningful development without turning private local Elysia memory, files, credentials, logs, or machine state into public material.</p>
      </PageHero>

      <section className="section-card build-log-boundary-card">
        <p className="eyebrow">Public record, private core</p>
        <h2>Transparency does not require surveillance.</h2>
        <p>Elysia Ecobotics Online is public and cloud-facing. Local Elysia is a separate private system under the user's control. Build Log entries describe public-safe development and deliberately stop at that boundary.</p>
      </section>

      <section className="section-card build-log-focus-card">
        <p className="eyebrow">Current focus</p>
        <h2>Making the build legible</h2>
        <p>The first phase of the Build Log establishes the public/private boundary and then reconstructs major milestones from verified project history. New entries should mark meaningful change, not manufacture activity for its own sake.</p>
        {latestEntry && (
          <div className="button-row">
            <Link
              className="button-link button-link--primary"
              to={`/build-log/${latestEntry.slug}`}
            >
              Read the latest entry
            </Link>
          </div>
        )}
      </section>

      <section className="build-log-archive" aria-labelledby="build-log-archive-title">
        <div className="build-log-section-heading">
          <div>
            <p className="eyebrow">Chronological record</p>
            <h2 id="build-log-archive-title">Browse the Build Log</h2>
          </div>
          <p>Newest entries appear first.</p>
        </div>

        <div className="build-log-entry-grid">
          {buildLogEntries.map((entry) => (
            <BuildLogEntryCard entry={entry} key={entry.slug} />
          ))}
        </div>
      </section>

      <section className="section-card build-log-orientation-card">
        <p className="eyebrow">Looking for the larger arc?</p>
        <h2>The Story explains how we got here.</h2>
        <p>The Build Log follows ongoing development. The Story of Elysia carries the longer historical, philosophical, and architectural chronicle.</p>
        <div className="button-row">
          <Link className="button-link" to="/story">Read The Story of Elysia</Link>
          <Link className="button-link" to="/about">About Elysia Ecobotics</Link>
        </div>
      </section>
    </div>
  );
}
