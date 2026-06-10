import { type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
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
      elements.push(<h3 key={index}>{renderInline(line.slice(4))}</h3>);
      return;
    }
    if (line.startsWith("## ")) {
      flushList();
      elements.push(<h2 key={index}>{renderInline(line.slice(3))}</h2>);
      return;
    }
    if (line.startsWith("# ")) {
      flushList();
      elements.push(<h1 key={index}>{renderInline(line.slice(2))}</h1>);
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
      <Link to="/legal/community-guidelines">Community Guidelines</Link>
      <Link to="/legal/vulnerability-disclosure-policy">Security</Link>
      <Link to="/legal/trademark-notice">Trademark Notice</Link>
    </nav>
  );
}

export default function LegalPage() {
  return (
    <div className="page-stack legal-page">
      <PageHero eyebrow="Legal" title="Legal, Safety, and Community Policies">
        <p>Elysia Ecobotics Online is a public website and commons around a private local-first Elysia core. These policies explain how the public site handles privacy, accounts, community participation, Marketplace add-ons, security review, copyright, volunteer requests, and stewardship recognition.</p>
        <p>The public website is cloud-facing. The private local Elysia core remains local, governed, and user-controlled. These policies do not turn private local Elysia memory, files, vaults, logs, passwords, or credentials into public website data.</p>
      </PageHero>

      <section className="legal-note-grid" aria-label="Legal policy status notes">
        <article className="section-card legal-note-card">
          <StatusBadge label="Draft, not attorney-reviewed" tone="warning" />
          <h2>Operating drafts</h2>
          <p>These policies are public operating drafts for an early-stage project and are not a substitute for legal advice. They should be attorney-reviewed before major growth, paid add-ons, live uploads, public chat, backend moderation queues, or receipt storage.</p>
        </article>
        <article className="section-card legal-note-card">
          <StatusBadge label="Contact placeholders" tone="warning" />
          <h2>Contact addresses</h2>
          <p>Official contact addresses are being configured. Placeholder addresses remain in some draft policies until official Elysia Ecobotics contact emails are ready.</p>
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
            <StatusBadge label={`${group.slugs.length} policies`} tone="safe" />
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
  const policy = getLegalPolicy(slug);

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
