import FeatureCard from "../../shared/components/FeatureCard";
import PageHero from "../../shared/components/PageHero";

export default function AboutPage() {
  return (
    <div className="page-stack">
      <PageHero eyebrow="About" title="About Elysia Ecobotics"><p>EcoSyneva Commons LLC is the legal and business umbrella. Elysia Ecobotics™ is the public project and brand initiative. Elysia Ecobotics Online is the public website. Elysia is the private local-first AI product and system.</p><p>The project joins local-first AI, ecological intelligence, add-on tooling, source libraries, public collaboration, and future robotics into one careful ecosystem.</p></PageHero>
      <section className="feature-grid feature-grid--three"><FeatureCard title="Why local-first matters"><p>Private memory, local identity, files, logs, and tool authority should stay user-controlled instead of silently becoming cloud material.</p></FeatureCard><FeatureCard title="Why add-ons exist"><p>Add-ons let Elysia grow while keeping the core clean and requiring manifests, permission truth, review, and local approval.</p></FeatureCard><FeatureCard title="What ecological robotics means"><p>Practical intelligence for plant care, sensing, restoration, field work, accessibility, and responsible help in the living world.</p></FeatureCard></section>
      <section className="section-card"><h2>What Elysia Ecobotics is not</h2><p>It is not omniscient. It is not a surveillance platform. It is not a replacement for human conscience. It is not autonomous ecological intervention without humans. It is not a cloud wrapper pretending to be local.</p></section>
    </div>
  );
}
