import FeatureCard from "../../shared/components/FeatureCard";
import PageHero from "../../shared/components/PageHero";

export default function LabPage() {
  return (
    <div className="page-stack">
      <PageHero eyebrow="People and partners" title="The Elysia Ecobotics Lab">
        <p>The Lab is the human face of Elysia Ecobotics: the place for founders, collaborators, volunteers, advisors, partners, research helpers, artists, developers, moderators, and project teams as they become public.</p>
        <p className="boundary-note">Consent rule: nobody appears here without explicit permission. People may choose a real photo, avatar, no image, or limited public details.</p>
      </PageHero>
      <section className="feature-grid feature-grid--three">
        <FeatureCard title="Bradley"><p>Founder and project steward. Current public areas include Elysia architecture, ecological intelligence direction, product imagination, local-first boundaries, and the public commons around the work.</p></FeatureCard>
        <FeatureCard title="Collaborators later"><p>This page will later hold clean profiles for volunteers, contributors, partners, researchers, builders, and creative helpers who want to be listed.</p></FeatureCard>
        <FeatureCard title="Project teams"><p>Lab notes and project teams can eventually connect people to Marketplace review, Living Library curation, product testing, documentation, and outreach.</p></FeatureCard>
      </section>
    </div>
  );
}
