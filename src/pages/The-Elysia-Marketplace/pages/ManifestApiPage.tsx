import { UploadCloud } from "lucide-react";
import { useMarketplaceContext } from "./useMarketplaceContext";

export default function ManifestApiPage() {
  const { sortedAddons } = useMarketplaceContext();
  const example = sortedAddons[0] ?? null;
  return (
    <section className="section-card api-card page-card manifest-page">
      <p className="eyebrow"><UploadCloud size={16} /> Manifest API</p>
      <h1>Developer-facing manifest and catalog contract.</h1>
      <p>
        Manifests let developers describe add-ons, dependencies, actions, and security posture in a machine-readable way.
        The Marketplace exposes intake and catalog contracts. Local Elysia separately performs final package validation before install-disabled staging or enablement.
      </p>
      <div className="details-grid details-grid--wide">
        <div><h3>Schema</h3><p><a href="/manifest-schema.json" target="_blank" rel="noreferrer">/manifest-schema.json</a></p><p>Machine-readable contract for add-on submissions and catalog validation.</p></div>
        <div><h3>Catalog preview</h3><p><a href="/catalog-preview.json" target="_blank" rel="noreferrer">/catalog-preview.json</a></p><p>Static candidate metadata for website fallback testing. Candidate metadata is not publication or install authority.</p></div>
        <div><h3>Cloudflare route fallback</h3><p><code>public/_redirects</code> keeps client routes like <code>/marketplace/browse</code> and legacy aliases refresh-safe.</p></div>
        <div><h3>Review boundary</h3><p>Submission creates a private review record. It does not create a public listing, package authority, or install control.</p></div>
        <div><h3>Local validation</h3><p>A package selected by the user is independently revalidated by Local Elysia. The website does not invoke Local Elysia or execute package code.</p></div>
        <div><h3>Privacy boundary</h3><p>No local inventory is uploaded by catalog browsing. Developer submission transfers only the files explicitly selected after the remote-upload disclosure is acknowledged.</p></div>
      </div>
      {example && (
        <details className="manifest-preview" open>
          <summary>Example add-on manifest preview</summary>
          <pre>{JSON.stringify(example, null, 2)}</pre>
        </details>
      )}
    </section>
  );
}
