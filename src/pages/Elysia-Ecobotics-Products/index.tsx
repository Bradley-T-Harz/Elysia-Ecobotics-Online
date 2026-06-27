import FeatureCard from "../../shared/components/FeatureCard";
import PageHero from "../../shared/components/PageHero";

export default function ProductsPage() {
  return (
    <div className="page-stack">
      <PageHero eyebrow="Physical products" title="Elysia Ecobotics Products" brandMark="standard">
        <p>Physical products from Elysia Ecobotics will appear here as they become ready. The first planned direction is an affordable, AI-powered at-home gardening drone for practical plant care, accessibility, and ecological responsibility.</p>
        <p className="boundary-note">Nothing here is for sale, preorder, or shipping yet. Physical products may be mission-aligned and affordable, but they are commercial hardware with real material, labor, shipping, support, and maintenance costs.</p>
      </PageHero>
      <section className="feature-grid feature-grid--three">
        <FeatureCard title="At-home gardening drone"><p>A future helper for watering awareness, plant monitoring, gentle reminders, and accessible garden care, designed to be useful rather than flashy.</p></FeatureCard>
        <FeatureCard title="Repairable ecosystem"><p>Future categories may include replacement parts, sensor kits, robotics kits, plant-care modules, field monitoring tools, maintenance guides, and repair notes.</p></FeatureCard>
        <FeatureCard title="Member interest"><p>Free members may later save product interests or request updates, but there are no payments, carts, or preorder promises in this version.</p></FeatureCard>
      </section>
    </div>
  );
}
