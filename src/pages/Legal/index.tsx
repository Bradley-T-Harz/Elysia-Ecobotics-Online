import { type ReactNode } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import PageHero from "../../shared/components/PageHero";
import StatusBadge from "../../shared/components/StatusBadge";
import {
  getLegalPolicy,
  getLegalPolicyDescription,
  legalPolicyGroups,
  legalPolicyMetadata,
  legalPolicyPages
} from "./legalPolicyPages";

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${match.index}-${token}`;
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        const external = /^https?:\/\//.test(href);
        parts.push(<a key={key} href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>{label}</a>);
      } else {
        parts.push(token);
      }
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function MarkdownPolicyBody({ body }: { body: string }) {
  const elements: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) return;
    const items = listItems;
    listItems = [];
    elements.push(
      <ul key={`list-${elements.length}`}>
        {items.map((item, index) => <li key={`${item}-${index}`}>{renderInline(item)}</li>)}
      </ul>
    );
  };

  body.split("\n").forEach((rawLine, index) => {
    const line = rawLine.trim().replace(/\s{2,}$/u, "");
    if (!line) {
      flushList();
      return;
    }
    if (line.startsWith("### ")) {
      flushList();
      elements.push(<h4 key={index}>{renderInline(line.slice(4))}</h4>);
      return;
    }
    if (line.startsWith("## ")) {
      flushList();
      elements.push(<h3 key={index}>{renderInline(line.slice(3))}</h3>);
      return;
    }
    if (line.startsWith("# ")) {
      flushList();
      elements.push(<h2 key={index}>{renderInline(line.slice(2))}</h2>);
      return;
    }
    if (line.startsWith("- ")) {
      listItems.push(line.slice(2));
      return;
    }
    flushList();
    elements.push(<p key={index}>{renderInline(line)}</p>);
  });
  flushList();
  return <div className="legal-policy-body">{elements}</div>;
}

function PolicyQuickLinks() {
  return (
    <nav className="legal-quick-links" aria-label="Policy quick links">
      <Link to="/legal">Back to Legal</Link>
      <Link to="/legal/privacy-policy">Privacy Policy</Link>
      <Link to="/legal/terms-of-use">Terms of Use</Link>
      <Link to="/legal/support-and-billing-terms">Support &amp; Billing</Link>
      <Link to="/legal/refund-and-cancellation-policy">Refund &amp; Cancellation</Link>
      <Link to="/legal/organization-services-terms">Organization Services</Link>
      <Link to="/legal/community-guidelines">Community Guidelines</Link>
      <Link to="/legal/vulnerability-disclosure-policy">Security</Link>
      <Link to="/legal/trademark-notice">Trademark Notice</Link>
      <Link to="/legal/third-party-media-credits">Media Credits</Link>
      <Link to="/legal/living-library-third-party-resources">Living Library Resources</Link>
    </nav>
  );
}

export default function LegalPage() {
  return (
    <div className="page-stack legal-page">
      <PageHero eyebrow="Legal" title="Legal, Safety, and Community Policies" brandMark="standard">
        <p>Elysia Ecobotics Online is a public website and commons around a private local-first Elysia core. These policies explain how the public site handles privacy, accounts, community participation, Marketplace add-ons, security review, copyright, third-party research-resource discovery, volunteer requests, stewardship recognition, optional support, paid online services, seller preparation, and sponsorship independence.</p>
        <p>The public website is cloud-facing. The private local Elysia core remains local, governed, and user-controlled. These policies do not turn private local Elysia memory, files, vaults, logs, passwords, or credentials into public website data.</p>
      </PageHero>

      <section className="legal-note-grid" aria-label="Legal policy status notes">
        <article className="section-card legal-note-card">
          <StatusBadge label="Public operating policy" tone="warning" />
          <h2>Operating policies</h2>
          <p>These policies are public operating guidance and are not a substitute for legal advice. Economic policies describe test-mode and pre-activation boundaries; live charges, payouts, pricing, and service sales remain disabled until the applicable business, banking, provider, legal, tax, accounting, and operational reviews are complete.</p>
        </article>
        <article className="section-card legal-note-card">
          <StatusBadge label="Official contacts" tone="warning" />
          <h2>Contact addresses</h2>
          <p>Use the role-based addresses below for public website matters: hello@elysiaecobotics.com, contact@elysiaecobotics.com, support@elysiaecobotics.com, privacy@elysiaecobotics.com, security@elysiaecobotics.com, abuse@elysiaecobotics.com, legal@elysiaecobotics.com, dmca@elysiaecobotics.com, marketplace@elysiaecobotics.com, stewardship@elysiaecobotics.com, and volunteer@elysiaecobotics.com.</p>
          <section className="legal-company-contact" aria-labelledby="ecosyneva-company-contact-heading">
            <h3 id="ecosyneva-company-contact-heading">EcoSyneva Commons LLC</h3>
            <p>General company inquiries: <a href="mailto:EcoSyneva@proton.me">EcoSyneva@proton.me</a>. This address is for matters concerning EcoSyneva Commons LLC itself. For Elysia Ecobotics Online support, privacy, security, abuse, copyright, legal, Marketplace, stewardship, volunteer, or other operational matters, use the role-based addresses above.</p>
            <p className="small-note">Do not send passwords, payment information, identity documents, private Elysia data, or confidential material by ordinary email.</p>
          </section>
        </article>
      </section>

      {legalPolicyGroups.map((group) => (
        <section className="legal-category-section" key={group.category}>
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">{group.category}</p>
              <h2>{group.category}</h2>
              <p>{group.description}</p>
            </div>
            <StatusBadge label={group.slugs.length === 1 ? "1 policy" : `${group.slugs.length} policies`} tone="safe" />
          </div>
          <div className="legal-policy-grid">
            {group.slugs.map((slug) => {
              const policy = legalPolicyPages.find((item) => item.slug === slug);
              if (!policy) return null;
              const metadata = legalPolicyMetadata[slug];
              return (
                <Link className="legal-policy-card" to={policy.route} key={policy.slug}>
                  <span className="legal-policy-category">{metadata?.category ?? group.category}</span>
                  <h3>{policy.title}</h3>
                  <p>{metadata?.description ?? getLegalPolicyDescription(policy.slug)}</p>
                  <span className="legal-policy-card-footer">
                    <StatusBadge label={policy.status} tone="warning" />
                    <span>Updated {policy.lastUpdated}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function LegalPolicyPage() {
  const { slug } = useParams();
  const [search] = useSearchParams();
  const requestedVersion = search.get("version");
  const policy = getLegalPolicy(slug, requestedVersion);

  // The retired policy index is a compatibility URL, not a consent version.
  if (slug === "legal") return <Navigate to="/legal" replace />;

  if (!policy) {
    return (
      <div className="page-stack legal-policy-page">
        <section className="section-card not-found-panel">
          <p className="eyebrow">Legal</p>
          <h1>Policy Not Found</h1>
          <p>The policy route you opened does not match a public policy page.</p>
          <PolicyQuickLinks />
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack legal-policy-page">
      <section className="section-card legal-policy-header">
        <p className="eyebrow">{legalPolicyMetadata[policy.slug]?.category ?? "Legal"}</p>
        <h1 className="hero-title-brand-font">{policy.title}</h1>
        <div className="legal-policy-meta">
          <StatusBadge label={policy.status} tone="warning" />
          <span>Last updated {policy.lastUpdated}</span>
        </div>
        {requestedVersion && <p className="boundary-note">Version-specific text: {requestedVersion}. <Link to={policy.route}>Read the current public explanation</Link>. Historical text does not enable checkout.</p>}
        <p className="legal-policy-summary"><strong>What this covers:</strong> {getLegalPolicyDescription(policy.slug)}</p>
        <PolicyQuickLinks />
      </section>
      <section className="section-card legal-policy-content-card">
        <MarkdownPolicyBody body={policy.body} />
      </section>
      <section className="section-card legal-policy-footer-note">
        <p><strong>Private-core boundary:</strong> Elysia Ecobotics Online is public and cloud-facing. The private local Elysia core remains local, governed, and user-controlled.</p>
        <PolicyQuickLinks />
      </section>
    </div>
  );
}
