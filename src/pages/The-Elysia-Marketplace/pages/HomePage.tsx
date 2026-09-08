import { FundingLink } from "../../../shared/billing/FundingExplanation";
import { BookOpen, GitPullRequest, Search, ShieldCheck, Store, UploadCloud } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import PageBrandMark from "../../../shared/components/PageBrandMark";
import { useMarketplaceContext } from "./useMarketplaceContext";

const steps = [
  { title: "Catalog", detail: "Browse reviewed public listings and explicitly non-installable candidates without granting local authority." },
  { title: "Manifest", detail: "Inspect dependencies, action kinds, network behavior, and security declarations." },
  { title: "Review", detail: "Trust tiers and admin review state separate official, reviewed, community, and unreviewed entries." },
  { title: "Review record", detail: "A catalog listing or private review record grants no local install or execution authority." },
  { title: "Local authority", detail: "A user-selected package is independently revalidated by Local Elysia before any staged or enabled state." }
];

export default function MarketplaceHomePage() {
  const [searchParams] = useSearchParams();
  const { catalogStatusMessage, seedFallbackActive, sortedAddons, supabaseConfigured } = useMarketplaceContext();
  return (
    <div className="home-page">
      {searchParams.get("commerce") === "canceled" && <div className="boundary-note" role="status">Stripe test checkout was canceled or left. No completed payment, fulfilled license, trust change, download, or installation is being claimed.</div>}
      <header className="hero page-hero">
        <div className="hero-copy">
          <p className="eyebrow">Elysia Marketplace</p>
          <h1>The Elysia Marketplace</h1>
          <p>
            The Elysia Marketplace distributes digital add-ons, extensions, themes, tools, and manifests for Elysia while keeping local install authority inside local Elysia.
          </p>
          <p className="boundary-note">
            Marketplace actions prepare plans only. It never accesses private Elysia memory, logs, credentials, identity vaults, or unselected machine data. Developer submission can transfer only files the developer explicitly selects after a clear remote-upload confirmation.
          </p>
          <p>Free catalog access remains available. Creator sales and EcoSyneva’s own offerings are being prepared separately; paid checkout and seller payouts are not active.</p>
          <FundingLink />
          <div className="hero-actions">
            <Link className="button-link button-link--primary" to="/marketplace/browse"><Store size={18} /> Browse Add-ons</Link>
            <Link className="button-link" to="/marketplace/submit"><GitPullRequest size={18} /> Submit Add-on</Link>
            <Link className="button-link" to="/marketplace/trust"><ShieldCheck size={18} /> View Trust Policy</Link>
            <Link className="button-link" to="/marketplace/manifest-api"><BookOpen size={18} /> View Manifest API</Link>
          </div>
        </div>
        <div className="marketplace-hero-side">
          <PageBrandMark variant="marketplace-column" />
          <aside className="hero-card production-card">
            <ShieldCheck size={38} />
            <h2>{supabaseConfigured ? "Supabase status" : "Candidate catalog ready"}</h2>
            <p>{catalogStatusMessage}</p>
            {seedFallbackActive && <p className="boundary-note">Static official-release fallback is active. The Codev record binds the canonical public download and checksum, but the Website does not install, enable, or grant local authority.</p>}
            <dl className="mini-facts">
              <div><dt>Catalog entries</dt><dd>{sortedAddons.length}</dd></div>
              <div><dt>Local machine data</dt><dd>Unselected data not collected</dd></div>
              <div><dt>Commerce</dt><dd>Paid transactions not active</dd></div>
              <div><dt>Website execution</dt><dd>Unavailable</dd></div>
            </dl>
          </aside>
        </div>
      </header>

      <section className="section-card page-card">
        <div className="section-heading section-heading--inline">
          <div>
            <p className="eyebrow"><Search size={16} /> How it works</p>
            <h2>From public catalog to local approval.</h2>
          </div>
          <p>The website is an information and account surface. It is not a remote control surface for a private computer.</p>
        </div>
        <div className="process-grid">
          {steps.map((step, index) => (
            <article className="process-step" key={step.title}>
              <span>{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card split-callout">
        <div>
          <p className="eyebrow"><UploadCloud size={16} /> Developer-ready</p>
          <h2>Manifests and review records, without website execution.</h2>
          <p>
            Developers can prepare add-on manifests and submissions. Reviewers can inspect dependency sources,
            action kinds, network boundaries, rollback notes, and trust tiers before anything is offered as safe.
          </p>
        </div>
        <Link className="button-link button-link--primary" to="/marketplace/manifest-api">Read the Manifest API</Link>
      </section>
    </div>
  );
}
