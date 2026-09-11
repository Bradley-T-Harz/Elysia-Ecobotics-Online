import { ExternalLink } from "lucide-react";
import { ECOSYNEVA_COMMONS_LLC_URL } from "../../config/siteUrls";
import FeatureCard from "../../shared/components/FeatureCard";
import PageHero from "../../shared/components/PageHero";

export default function AboutPage() {
  return (
    <div className="page-stack">
      <PageHero
        eyebrow="About"
        title="About Elysia Ecobotics"
        brandMark="standard"
        actions={(
          <a className="button-link" href={ECOSYNEVA_COMMONS_LLC_URL}>
            Visit EcoSyneva Commons LLC
            <ExternalLink size={17} aria-hidden="true" />
          </a>
        )}
      >
        <p>EcoSyneva Commons LLC is the legal and business umbrella. Elysia Ecobotics™ is the public project and brand initiative. Elysia Ecobotics Online is the public website. Elysia is the private local-first AI product and system.</p>
        <p>Elysia grew from ecological, environmental, and Earth-system work, but its tools are for people across disciplines. Those origins guide EcoSyneva’s stewardship and responsibility without limiting who Elysia is for.</p>
      </PageHero>
      <section className="section-card"><h2>Why the name Elysia?</h2><p>Elysia is derived from Elysium, a word associated with a place or condition of perfect happiness, bliss, or paradise.</p><p>For this project, the name is not a claim that technology can create utopia or replace heaven. It is an orientation: a hope that careful tools, community, education, creativity, ecological restoration, and sustainable technology can help make life on Earth more compassionate, more understandable, and more habitable.</p><p>Ecobotics is a coined project word joining ecological care with robotics and technical craft. “Eco” points back to home, habitat, and living systems; “botics” points toward practical machines, sensors, tools, and intelligent systems.</p><p>Together, Elysia Ecobotics names the mission: careful technology in service of a more compassionate and living world, without pretending there are no trade-offs.</p></section>
      <section className="feature-grid feature-grid--three"><FeatureCard title="Why local-first matters"><p>Private memory, local identity, files, logs, and tool authority should stay user-controlled instead of silently becoming cloud material.</p></FeatureCard><FeatureCard title="Why add-ons exist"><p>Add-ons let Elysia grow while keeping the core clean and requiring manifests, permission truth, review, and local approval.</p></FeatureCard><FeatureCard title="What ecological robotics means"><p>Practical intelligence for plant care, sensing, restoration, field work, accessibility, and responsible help in the living world.</p></FeatureCard></section>
      <section className="section-card"><h2>What Elysia Ecobotics is not</h2><p>It is not omniscient. It is not a surveillance platform. It is not a replacement for human conscience. It is not autonomous ecological intervention without humans. It is not a cloud wrapper pretending to be local.</p></section>
    </div>
  );
}
