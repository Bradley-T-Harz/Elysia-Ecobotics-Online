import PageHero from "../../shared/components/PageHero";

export default function ArchivePage() {
  return (
    <div className="page-stack">
      <PageHero eyebrow="Release blocker" title="No public Elysia download is published" brandMark="standard">
        <p>Elysia is a free, local-first AI companion application from Elysia Ecobotics™, an EcoSyneva Commons LLC initiative.</p>
        <p>No public installer, source release, or verified release archive is available from this website. This route intentionally exposes no download control.</p>
        <p>Do not run files presented as Elysia releases unless they are bound to an official release record with an exact checksum and provenance evidence.</p>
      </PageHero>
      <section className="section-card">
        <h2>Current release gate</h2>
        <div className="table-grid">
          <div><strong>Public release:</strong> unavailable.</div>
          <div><strong>Download controls:</strong> hidden because no public artifact is authorized.</div>
          <div><strong>Checksums and signatures:</strong> absent because no public artifact is authorized.</div>
          <div><strong>Mirrors:</strong> no unofficial mirror is endorsed as a source of truth.</div>
          <div><strong>Pass 10 authority:</strong> final publication requires the release gate, artifact verification, and an explicit publication decision.</div>
          <div><strong>Private data:</strong> local memory, logs, credentials, and vault material are never valid public package inputs.</div>
        </div>
      </section>
    </div>
  );
}
