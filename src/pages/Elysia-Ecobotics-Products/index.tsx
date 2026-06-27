import FeatureCard from "../../shared/components/FeatureCard";
import PageHero from "../../shared/components/PageHero";

export default function ProductsPage() {
  return (
    <div className="page-stack">
      <PageHero eyebrow="Physical products" title="Elysia Ecobotics Products" brandMark="standard">
        <p>Physical products from Elysia Ecobotics will appear here only when they are ready, tested, repairable, and honestly documented. Future directions may include environmental robotics, sensing tools, field-support hardware, repair kits, and ecological technology designed for practical care rather than flash.</p>
        <p className="boundary-note">Nothing here is for sale, listed for ordering, or shipping yet. Physical products may become mission-aligned and affordable over time, but they will involve real material, labor, testing, safety review, support, repair, and maintenance costs.</p>
      </PageHero>
      <section className="feature-grid feature-grid--three">
        <FeatureCard title="Environmental robotics"><p>Future product directions may include small-scale robotics and sensing tools for environmental awareness, field support, restoration work, and practical ecological care.</p></FeatureCard>
        <FeatureCard title="Repairable ecosystem"><p>Future categories may include replacement parts, sensor kits, robotics kits, care modules, field monitoring tools, maintenance guides, and repair notes.</p></FeatureCard>
        <FeatureCard title="Member interest"><p>Members may later save broad product interests, request updates, or help review documentation. No payments, purchase queues, or purchase promises exist in this version.</p></FeatureCard>
      </section>
    </div>
  );
}
