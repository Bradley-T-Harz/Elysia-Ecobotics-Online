import FeatureCard from "../../shared/components/FeatureCard";
import PageHero from "../../shared/components/PageHero";
import StatusBadge from "../../shared/components/StatusBadge";

export default function ArchivePage() {
  return (
    <div className="page-stack">
      <PageHero eyebrow="Downloads" title="The Elysia Archive" brandMark="standard">
        <p>Elysia is a free, local-first AI companion application from Elysia Ecobotics™, an EcoSyneva Commons LLC initiative.</p>
        <p>No public installer, release download, or public source release is available yet. The Archive is being prepared to hold release notes, install instructions, checksums, signatures, compatibility notes, and historical versions when the first public release is ready.</p>
        <p>Until official releases appear here or in the linked public repository, treat third-party mirrors, reposted installers, and unofficial checksums as unverified.</p>
      </PageHero>
      <section className="feature-grid feature-grid--three">
        <FeatureCard title="Latest Elysia download"><p>No public installer exists yet. Linux-first release cards will appear here for AppImage, .deb, tarball, and source build options when they are ready.</p><StatusBadge label="Coming soon" tone="warning" /></FeatureCard>
        <FeatureCard title="Public source repository reserved"><p><a href="https://github.com/Bradley-T-Harz/Elysia" target="_blank" rel="noreferrer">https://github.com/Bradley-T-Harz/Elysia</a></p><p>The public Elysia repository has been reserved, but cleaned public source code has not been published yet. The first legal public source release will appear there when it is ready.</p></FeatureCard>
        <FeatureCard title="Historical archive"><p>Release notes, compatibility notes, known issues, system requirements, older-version warnings, and historical versions are all preparing for later public releases.</p></FeatureCard>
      </section>
      <section className="section-card">
        <h2>What this page will track</h2>
        <div className="table-grid">
          <div>Release channel and platform notes.</div>
          <div>Linux install instructions when public builds exist.</div>
          <div>AppImage, .deb, tarball, and source build options.</div>
          <div>GitHub repository and source-linked release references.</div>
          <div>Checksums, signatures, and provenance when available.</div>
          <div>Release notes, compatibility notes, known issues, and older-version warnings.</div>
          <div>System requirements and supported platform notes.</div>
          <div><code>public/release-manifest.json</code> machine-readable release metadata.</div>
          <div>Minimal account preferences such as watched release channel or preferred platform.</div>
        </div>
      </section>
      <section className="section-card">
        <h2>Release status and safety notes</h2>
        <div className="table-grid">
          <div><strong>Public release:</strong> not available yet.</div>
          <div><strong>Checksums:</strong> will be published only with real release artifacts.</div>
          <div><strong>Signatures:</strong> will be published only after signing is actually in place.</div>
          <div><strong>Mirrors:</strong> no unofficial mirror is endorsed as a source of truth.</div>
          <div><strong>Installer trust:</strong> do not run files claiming to be Elysia releases unless they are linked from an official release record.</div>
          <div><strong>Local-first boundary:</strong> public downloads will not contain private Local Elysia memory, logs, credentials, or vault data.</div>
        </div>
      </section>
    </div>
  );
}
