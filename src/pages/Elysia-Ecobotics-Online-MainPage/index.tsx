import { Link } from "react-router-dom";
import FeatureCard from "../../shared/components/FeatureCard";
import PageBrandMark from "../../shared/components/PageBrandMark";
import StatusBadge from "../../shared/components/StatusBadge";

const subsystems = [
  { name: "Verdante", detail: "Plants, gardens, restoration, and practical green care." },
  { name: "Sylphora", detail: "Animals, wildlife, pollinators, care, and interspecies understanding." },
  { name: "Ecotiva", detail: "Ecosystems, habitats, interdependence, and the living weave of place." },
  { name: "Aurania", detail: "Air, atmosphere, climate, weather, and the moving patterns above us." },
  { name: "Terraflux", detail: "Soil, land, terrain, hazards, and changing ground conditions." },
  { name: "Aquaria", detail: "Water, wetlands, watersheds, streams, and careful monitoring." },
  { name: "Aetheria", detail: "Space, planetary awareness, wider systems, and the long horizon of intelligence." }
];

export default function OnlineMainPage() {
  return (
    <div className="page-stack home-garden">
      <section className="home-hero page-hero-block" aria-labelledby="home-title">
        <img className="home-hero__vine home-hero__vine--left" src="/images/home/home-left-vine.png" alt="" aria-hidden="true" />
        <img className="home-hero__vine home-hero__vine--right" src="/images/home/home-right-vine.png" alt="" aria-hidden="true" />
        <img className="home-hero__geometry" src="/images/home/flower-of-life-pattern.png" alt="" aria-hidden="true" />
        <div className="home-hero__mist" aria-hidden="true" />
        <PageBrandMark variant="home-floating" />
        <div className="home-hero__content">
          <p className="eyebrow">Public commons</p>
          <h1 id="home-title" className="home-hero__title">Elysia Ecobotics Online</h1>
          <div className="hero-text">
            <p>Elysia Ecobotics Online is the moonlit public garden around Elysia: the place for downloads, add-ons, project updates, research sources, developer tools, community spaces, and the long story of the work.</p>
            <p>It is meant to feel useful before it feels huge. Browse, learn, save what matters, and follow the pieces that are ready without needing to understand every inner organ of local Elysia.</p>
            <p className="boundary-note">The website is public and cloud-facing. The private local Elysia core remains local unless a user explicitly chooses to export or connect something.</p>
          </div>
          <div className="hero-actions"><Link className="button-link button-link--primary" to="/archive">Download Elysia</Link><Link className="button-link" to="/marketplace">Explore Marketplace</Link><Link className="button-link" to="/commons-circle">Join the Commons Circle</Link><Link className="button-link" to="/living-library">Visit the Living Library</Link><Link className="button-link" to="/developer-forge">Build Add-ons</Link><Link className="button-link" to="/mission">Read the Mission</Link></div>
        </div>
      </section>
      <section className="feature-grid feature-grid--three home-polish-grid">
        <FeatureCard title="What is Elysia?"><p>Elysia is a free, local-first AI companion application built around privacy, user approval, readable traces, and useful governed tools.</p></FeatureCard>
        <FeatureCard title="What is Elysia Ecobotics?"><p>An EcoSyneva Commons LLC initiative for ecological intelligence, careful robotics, public-service science, and tools that help people care for the living world.</p></FeatureCard>
        <FeatureCard title="What is this website?"><p>The public account ecosystem: a home for the Archive, Marketplace, Products, Lab, Developer Forge, Living Library, Commune, Commons Circle, Story, About, and Mission.</p></FeatureCard>
      </section>
      <section className="section-card home-section-card">
        <p className="eyebrow">What is happening now</p>
        <h2>A polished public shell around a private local core.</h2>
        <p>Elysia Ecobotics Online is beginning with honest structure: clear routes, safe Marketplace behavior, account scaffolding, and pages that explain where the project is going without pretending unfinished systems are already live.</p>
        <div className="feature-grid feature-grid--four home-polish-grid">
          <FeatureCard title="Featured release"><p>The Archive is ready to describe Linux-first builds, source-first availability, checksums, signatures, and historical releases as they become real.</p><StatusBadge label="Coming soon" tone="warning" /></FeatureCard>
          <FeatureCard title="Marketplace preview"><p>Add-ons show manifest, permission, dependency, and trust information before local Elysia ever performs an action.</p><p className="small-note">Elysia is free. Some community add-ons may be free or paid, depending on the developer.</p><Link to="/marketplace">Open Marketplace</Link></FeatureCard>
          <FeatureCard title="Developer Forge"><p>A calm builder doorway for add-on docs, manifest validation, packaging preparation, and Marketplace submission.</p><Link to="/developer-forge">Visit Forge</Link></FeatureCard>
          <FeatureCard title="Living Library"><p>A curated directory for data, research, tools, source ethics, and ecological intelligence foundations.</p><Link to="/living-library">Browse library</Link></FeatureCard>
        </div>
      </section>
      <section className="section-card home-section-card">
        <p className="eyebrow">Ecological subsystem cards</p>
        <h2>Seven names for a living technical imagination.</h2>
        <div className="subsystem-grid home-subsystem-grid">{subsystems.map((item) => <article key={item.name}><h3>{item.name}</h3><p>{item.detail}</p></article>)}</div>
      </section>
      <section className="feature-grid feature-grid--three home-polish-grid">
        <FeatureCard title="Products"><p>Future physical products stay separate from digital Marketplace add-ons, with broad directions in environmental robotics, sensing tools, repairable hardware, and field-support technology.</p><Link to="/products">See products</Link></FeatureCard>
        <FeatureCard title="Lab"><p>The Lab will hold people, partners, collaborators, volunteers, and team members by consent.</p><Link to="/lab">Meet the Lab</Link></FeatureCard>
        <FeatureCard title="Commune"><p>The Commune will support public posts, troubleshooting, code sharing, and repository showcases with visible safety boundaries.</p><Link to="/commune">Visit Commune</Link></FeatureCard>
      </section>
    </div>
  );
}
