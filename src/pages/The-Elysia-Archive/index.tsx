import { Link } from "react-router-dom";
import FeatureCard from "../../shared/components/FeatureCard";
import PageHero from "../../shared/components/PageHero";
import StatusBadge from "../../shared/components/StatusBadge";
import releaseManifest from "./releaseManifest.json";

function formatBytes(bytes: number) {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(2)} KB`;
  return `${bytes} bytes`;
}

const visibleArtifacts = releaseManifest.artifacts.filter((artifact) => artifact.archive_visible);

export default function ArchivePage() {
  return (
    <div className="page-stack">
      <PageHero eyebrow="Downloads" title="The Elysia Archive" brandMark="standard">
        <p>Elysia v1.0.0 is the stable, free, local-first release of Elysia by EcoSyneva Commons LLC.</p>
        <p>Download Linux packages, public source, Codev, checksums, the signed release manifest, SBOMs, provenance, notices, requirements, and release notes from the exact official records below.</p>
        <p>Canonical downloads come only from this Archive and the linked <a href={releaseManifest.repositories.elysia_release} target="_blank" rel="noreferrer">Elysia</a> and <a href={releaseManifest.repositories.codev_release} target="_blank" rel="noreferrer">Codev</a> GitHub Releases. Treat third-party mirrors, reposted installers, and unofficial checksums as unverified.</p>
      </PageHero>

      <section className="section-card archive-download-choice" aria-labelledby="local-download-choice-title">
        <p className="eyebrow">Pay what you can · including $0</p>
        <h2 id="local-download-choice-title">Local Elysia stays free</h2>
        <p>The ordinary local release path and optional financial support are independent choices. A contribution never unlocks, accelerates, verifies, personalizes, or changes an artifact.</p>
        <div className="two-column">
          <article className="feature-card"><p className="eyebrow">Free path</p><h3>$0 — Local Elysia release</h3><p>No Website Account, email, Stripe checkout, card, contribution, recurring plan, supporter recognition, or payment-tracking gate is required. The links below go directly to the same official artifacts and verification materials available to everyone.</p><p className="boundary-note">Choose Setup for the guided user-local path, or select the exact package form that fits your Linux system.</p><a className="button-link button-link--primary" href="#release-downloads-title">Go to free downloads</a></article>
          <article className="feature-card"><p className="eyebrow">Separate and optional</p><h3>Contribute toward release work</h3><p>People who want to help sustain release engineering, security, hosting, documentation, and accessibility may choose a one-time contribution. Checkout remains separate from every download and grants no extra capability or authority.</p><Link className="button-link" to="/support?source=products#support-checkout">Consider optional support</Link></article>
        </div>
      </section>

      <section className="page-stack archive-release-availability" aria-labelledby="release-availability">
        <div className="section-heading">
          <p className="eyebrow">Official stable release</p>
          <h2 id="release-availability">Elysia {releaseManifest.version}</h2>
          <p>Release date: {releaseManifest.release_date}. Channel: {releaseManifest.channel}. Live availability is authoritative at the canonical external release surfaces.</p>
        </div>
        <div className="feature-grid feature-grid--three">
          <FeatureCard title="Stable release" tone="safe"><p>Elysia and Codev are published as version {releaseManifest.version} from their canonical public repositories.</p><StatusBadge label="v1.0 stable" tone="safe" /></FeatureCard>
          <FeatureCard title="Public source"><p><a href={releaseManifest.repositories.elysia} target="_blank" rel="noreferrer">Elysia source</a></p><p><a href={releaseManifest.repositories.codev} target="_blank" rel="noreferrer">Codev source</a></p><p>Website and Artisan source remain private.</p></FeatureCard>
          <FeatureCard title="Signed and inspectable"><p>Every exact payload is SHA-256 bound. The release manifest is signed by the governed Elysia updater authority, and SBOM/provenance/license material is public.</p><StatusBadge label="Fail-closed verification" tone="safe" /></FeatureCard>
        </div>
      </section>

      <section className="section-card" id="release-downloads" aria-labelledby="release-downloads-title">
        <p className="eyebrow">Exact official bytes</p>
        <h2 id="release-downloads-title" tabIndex={-1}>Downloads</h2>
        <p>The supported qualification baseline is Ubuntu 24.04 on x86-64. Core is CPU-capable. Optional profiles may require additional disk, memory, models, containers, or qualified CUDA resources.</p>
        <div className="feature-grid feature-grid--three">
          {visibleArtifacts.map((artifact) => (
            <article className="feature-card" key={artifact.filename}>
              <p className="eyebrow">{artifact.product} · {artifact.artifact_type}</p>
              <h3>{artifact.label}</h3>
              <p>{artifact.description}</p>
              <dl className="mini-facts">
                <div><dt>File</dt><dd><code>{artifact.filename}</code></dd></div>
                <div><dt>Size</dt><dd>{formatBytes(artifact.size_bytes)}</dd></div>
                <div><dt>SHA-256</dt><dd><code>{artifact.sha256}</code></dd></div>
              </dl>
              <a className="button-link button-link--primary" href={artifact.download_url}>Download exact file</a>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card" aria-labelledby="verify-release-title">
        <p className="eyebrow">Verify before installing</p>
        <h2 id="verify-release-title">Checksums, signature, SBOM, and provenance</h2>
        <p>Compare the downloaded file's SHA-256 with both this page and the signed release record. A signature authenticates the release manifest; Local Admin approval remains separately required for installation-wide updater mutation.</p>
        <div className="table-grid">
          {releaseManifest.verification.map((item) => <div key={item.url}><a href={item.url}>{item.label}</a> — {item.description}</div>)}
          <div><a href="/release-manifest.json">Machine-readable Archive release manifest</a> — exact filenames, sizes, SHA-256 values, canonical URLs, and scope.</div>
        </div>
      </section>

      <section className="section-card">
        <h2>Install and release documentation</h2>
        <div className="table-grid">
          {releaseManifest.documentation.map((item) => <div key={item.url}><a href={item.url}>{item.label}</a> — {item.description}</div>)}
        </div>
      </section>

      <section className="section-card archive-support-boundary">
        <p className="eyebrow">Optional support</p>
        <h2>Downloads remain independent of payment</h2>
        <p>Local Elysia is free and local-first. Its ordinary downloads require no Website Account, recurring plan, donation, or supporter badge.</p>
        <p>People who choose to help sustain release engineering, hosting, documentation, and security can use the separate Support page. Payment creates no earlier access, governance authority, trust, or preferred place in the Commons.</p>
        <div className="button-row"><a className="button-link button-link--primary" href="#release-downloads-title">Use the $0 release path</a><Link className="button-link" to="/support?source=products">Learn about separate optional support</Link></div>
      </section>

      <section className="section-card">
        <h2>Release status and safety notes</h2>
        <div className="table-grid">
          <div><strong>Public release:</strong> Elysia and Codev v1.0.0 stable.</div>
          <div><strong>Checksums:</strong> exact SHA-256 values are public here and in the release checksum file.</div>
          <div><strong>Signatures:</strong> the detached Ed25519 signature verifies the exact release manifest.</div>
          <div><strong>Mirrors:</strong> no unofficial mirror is endorsed as a source of truth.</div>
          <div><strong>Installer trust:</strong> run Elysia files only when their bytes match an official release record.</div>
          <div><strong>Local-first boundary:</strong> downloads contain no Local Elysia memory, profiles, logs, credentials, conversations, or private vault data.</div>
        </div>
      </section>
    </div>
  );
}
