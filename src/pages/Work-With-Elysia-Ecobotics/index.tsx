import FeatureCard from "../../shared/components/FeatureCard";
import PageHero from "../../shared/components/PageHero";

const roles = [
  { title: "Developer", text: "Help build, test, document, or review Elysia systems and add-ons." },
  { title: "Documentation writer", text: "Turn complex local-first systems into clear, humane instructions." },
  { title: "UI/UX designer", text: "Make Elysia feel calm, useful, beautiful, and understandable." },
  { title: "Living Library curator", text: "Review sources, licenses, citations, and ethics notes." },
  { title: "Marketplace reviewer", text: "Inspect add-on manifests, trust labels, permissions, and rollback stories." },
  { title: "Security reviewer", text: "Help keep public systems, add-ons, and local boundaries honest." },
  { title: "Ecological research helper", text: "Connect Elysia to useful environmental, agricultural, and restoration knowledge." },
  { title: "Tester", text: "Try real workflows, report friction, and help make releases less mysterious." },
  { title: "Artist/media helper", text: "Help shape imagery, demos, public explainers, and the living style of the project." }
];

export default function WorkWithPage() {
  return (
    <div className="page-stack">
      <PageHero eyebrow="Contribute" title="Work With Elysia Ecobotics"><p>Elysia Ecobotics is still early. Current roles are volunteer, contributor, or collaborator roles unless a role is explicitly marked paid.</p><p>The goal is to be transparent: useful work deserves respect, expectations should be clear, and future paid roles should not be implied before they exist.</p></PageHero>
      <section className="section-card"><h2>How to think about this page</h2><p>This is a doorway for people who want to help with software, documentation, design, research, security review, ecological knowledge, testing, and community care. It is not a promise of employment.</p></section>
      <section className="feature-grid feature-grid--three">{roles.map((role) => <FeatureCard key={role.title} title={role.title}><p>{role.text}</p></FeatureCard>)}</section>
    </div>
  );
}
