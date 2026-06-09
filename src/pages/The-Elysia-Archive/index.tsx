import FeatureCard from "../../shared/components/FeatureCard";
import PageHero from "../../shared/components/PageHero";
import StatusBadge from "../../shared/components/StatusBadge";

export default function ArchivePage() {
  return (
    <div className="page-stack">
      <PageHero eyebrow="Downloads" title="The Elysia Archive">
        <p>Elysia is a free, local-first AI companion application from Elysia Ecobotics™, an EcoSyneva Commons LLC initiative.</p>
        <p>No public installer, release download, or public source repository is available yet. The Archive is being prepared to hold release notes, install instructions, checksums, signatures, compatibility notes, and historical versions when the first public release is ready.</p>
      </PageHero>
      <section className="feature-grid feature-grid--three">
        <FeatureCard title="Latest Elysia download"><p>Linux-first release cards will appear here for AppImage, .deb, tarball, and source build options when they are ready.</p><StatusBadge label="Coming soon" tone="warning" /></FeatureCard>
        <FeatureCard title="Source-first availability"><p>Early users should expect clear source build instructions, dependency notes, and transparent known limitations before broad binary distribution.</p></FeatureCard>
        <FeatureCard title="Historical archive"><p>Older releases will include release notes, compatibility notes, known issues, and warnings when a version should no longer be used.</p></FeatureCard>
      </section>
      <section className="section-card">
        <h2>What this page will track</h2>
        <div className="table-grid"><div>Release channel and platform notes.</div><div>Checksums, signatures, and provenance when available.</div><div>Minimal, respectful account preferences such as watched release channels.</div></div>
      </section>
    </div>
  );
}
