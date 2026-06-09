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
        The marketplace can publish approved catalog metadata; local Elysia later validates those manifests before showing local operator actions.
      </p>
      <div className="details-grid details-grid--wide">
        <div><h3>Schema</h3><p><a href="/manifest-schema.json" target="_blank" rel="noreferrer">/manifest-schema.json</a></p><p>Machine-readable contract for add-on submissions and catalog validation.</p></div>
        <div><h3>Catalog preview</h3><p><a href="/catalog-preview.json" target="_blank" rel="noreferrer">/catalog-preview.json</a></p><p>Static seed preview for early marketplace and local Elysia testing.</p></div>
        <div><h3>Cloudflare route fallback</h3><p><code>public/_redirects</code> keeps client routes like <code>/browse</code> and <code>/addons/:id</code> refresh-safe.</p></div>
        <div><h3>Planned public endpoints</h3><p><code>/api/public/addons</code> and <code>/api/public/addons/:id</code> after hosting/API choice.</p></div>
        <div><h3>Future local consumption</h3><p>Local Elysia fetches approved catalog data, validates schema, compares local status, and requests operator approval before any local action.</p></div>
        <div><h3>Privacy boundary</h3><p>No local inventory upload by default. Pairing and sync are future explicit flows.</p></div>
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
