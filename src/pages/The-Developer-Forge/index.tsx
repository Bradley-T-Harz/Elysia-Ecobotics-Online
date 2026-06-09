import { Link } from "react-router-dom";
import FeatureCard from "../../shared/components/FeatureCard";
import PageHero from "../../shared/components/PageHero";

export default function DeveloperForgePage() {
  return (
    <div className="page-stack">
      <PageHero eyebrow="Builder workshop" title="The Developer Forge">
        <p>The Developer Forge is the private, account-bound builder doorway for Elysia add-ons: docs, manifests, validation, packaging preparation, and publishing support.</p>
        <p>It is not the public Marketplace and not the Commune. The Forge is where builders prepare work before it becomes public.</p>
      </PageHero>
      <section className="feature-grid feature-grid--three">
        <FeatureCard title="Add-on docs"><p>Quickstarts, manifest structure, permission labels, examples, compatibility notes, and safety expectations belong here.</p></FeatureCard>
        <FeatureCard title="Manifest validation"><p>Future tools can validate manifests, dependency declarations, local/network boundaries, rollback notes, and review readiness before submission.</p></FeatureCard>
        <FeatureCard title="Publishing prep"><p>Packaging, review status, draft management, and Marketplace submission should feel connected without pretending a full online IDE exists yet.</p><Link to="/marketplace/submit">Open submission</Link></FeatureCard>
      </section>
      <section className="section-card"><h2>Local-first development boundary</h2><p>Developer Forge may later connect to local Elysia or Codev through explicit user action. It should not upload private repositories, secrets, or local machine data by surprise.</p></section>
    </div>
  );
}
