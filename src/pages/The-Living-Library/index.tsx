import FeatureCard from "../../shared/components/FeatureCard";
import PageHero from "../../shared/components/PageHero";
import WarningCallout from "../../shared/components/WarningCallout";

const sections = [
  { title: "Trusted Data Portals", text: "Official and well-documented data sources with provenance, license notes, and clear limitations." },
  { title: "Model Training Commons", text: "Datasets and references that may help local models, RAG systems, benchmarks, or fine-tuning research." },
  { title: "Environmental Data", text: "Climate, biodiversity, land, water, air, agriculture, and ecosystem monitoring sources." },
  { title: "Research and papers", text: "Scholarly graphs, open papers, citation trails, and careful research starting points." },
  { title: "Code and tools", text: "Developer datasets, public code sources, local AI tools, and technical foundations for Elysia work." },
  { title: "Ethics and licensing", text: "Reuse terms, attribution, privacy cautions, consent issues, and dataset limitations made visible." },
  { title: "Stewardship organizations", text: "Independent organizations people may learn from or support directly, without implied official partnership." },
  { title: "Elysia foundations", text: "Sources that help explain local-first AI, governed tools, ecological robotics, and public-service technology." }
];

export default function LivingLibraryPage() {
  return (
    <div className="page-stack">
      <PageHero eyebrow="Curated sources" title="The Living Library"><p>A curated source, data, research, and tool directory for ecological intelligence. It is organized like a living reference shelf, not a giant data dump.</p></PageHero>
      <WarningCallout title="Source ethics warning"><p>Public availability is not the same as consent. Check license, provenance, privacy risk, attribution rules, and permitted use before training, publishing, or redistributing a model.</p></WarningCallout>
      <section className="filter-strip"><input placeholder="Search sources, topics, organizations..." /><select><option>Any topic</option><option>RAG</option><option>Fine-tuning</option><option>Mapping</option><option>Computer vision</option></select><select><option>Any license</option><option>Open data</option><option>Attribution required</option><option>Review needed</option></select></section>
      <section className="feature-grid feature-grid--four">{sections.map((section) => <FeatureCard key={section.title} title={section.title}><p>{section.text}</p></FeatureCard>)}</section>
      <section className="section-card"><h2>Future member tools</h2><p>Free members may later save sources, create collections, bookmark starter packs, suggest sources, flag broken links, save citations, and export collections.</p></section>
    </div>
  );
}
