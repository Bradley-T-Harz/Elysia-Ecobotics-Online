import PageHero from "../../shared/components/PageHero";

const chapters = [
  { title: "The Seed", text: "A small local-first idea: make an AI companion useful without making privacy feel like a luxury feature." },
  { title: "The Name", text: "Elysia became the name for a system that should feel alive with care, but still be honest about what it is." },
  { title: "The Constitution", text: "The project gathered rules around local control, consent, traceability, refusal, and user-governed power." },
  { title: "The First Spine", text: "Backend organs, policies, ledgers, modes, files, artifacts, and tools started becoming one coherent body." },
  { title: "The Desktop Chamber", text: "The local app became the private room where Elysia can work with the user without turning everything into a cloud habit." },
  { title: "The Marketplace Idea", text: "Add-ons offered a way to grow capability without stuffing every experiment into Elysia core." },
  { title: "Public Code, Private Core", text: "The public ecosystem can be lively, but the user's local Elysia remains private, governed, and user-controlled." },
  { title: "The Ecological Subsystems", text: "Verdante, Sylphora, Ecotiva, Aurania, Terraflux, Aquaria, and Aetheria gave the work a playful ecological language." },
  { title: "Where We Are Now", text: "The public website is becoming a clean home for the Archive, Marketplace, Commons Circle, Forge, Library, Commune, and story." },
  { title: "Where We Are Going", text: "Toward useful local intelligence, ecological tools, careful robotics, public knowledge, and technology that asks before it acts." }
];

export default function StoryPage() {
  return <div className="page-stack"><PageHero eyebrow="History" title="The Story of Elysia"><p>A readable, non-overtechnical timeline of how Elysia became a local-first companion, a public commons, and an ecological technology project.</p></PageHero><section className="timeline-list">{chapters.map((chapter, index) => <article key={chapter.title}><span>{String(index + 1).padStart(2, "0")}</span><h2>{chapter.title}</h2><p>{chapter.text}</p></article>)}</section></div>;
}
