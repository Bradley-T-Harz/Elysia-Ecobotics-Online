import type { BuildLogEntry } from "../buildLogTypes.ts";

export const buildingElysiaInPublicEntry: BuildLogEntry = {
  slug: "building-elysia-in-public-without-building-a-surveillance-goblin",
  title: "Building Elysia in Public, Without Building a Surveillance Goblin",
  publishedAt: "2026-09-19",
  type: "development",
  areas: [
    "elysia-core",
    "elysia-ecobotics-online",
    "privacy-governance",
  ],
  summary:
    "Elysia is becoming more capable, but capability is not permission. Her private local core and Elysia Ecobotics Online remain deliberately separate, with boundaries, verification, and visible consent around what can cross between them.",
  sections: [
    {
      id: "what-happened",
      heading: "What happened",
      paragraphs: [
        "Elysia has grown into a connected ecosystem whose pieces deliberately do not all share the same authority. Local Elysia is the private companion-intelligence system. Elysia Ecobotics Online is the public website and commons around that work. Codev provides a separately governed local coding subsystem. The Elysia Artisan Collective is a separate creative commons connected through a bounded public bridge.",
        "That growth created a communication problem. A person arriving from the outside should be able to follow what is being built without being asked to decode internal architecture documents, and without the project solving transparency by exposing the private core.",
        "The Elysia Build Log is the answer to that problem: a public, version-controlled development record for major decisions, milestones, corrections, experiments, releases, and lessons.",
      ],
    },
    {
      id: "why-we-did-it",
      heading: "Why we did it",
      paragraphs: [
        "Building in public should increase accountability, not widen the attack surface. It should make claims easier to inspect without turning private memory, files, credentials, logs, or machine state into public material.",
        "That distinction matters because one of Elysia's central design principles is simple: greater capability does not automatically deserve greater permission. The system should earn new authority through explicit boundaries, verification, approval, and visible consequences.",
      ],
    },
    {
      id: "what-changed",
      heading: "What changed",
      bullets: [
        "The Build Log becomes the canonical narrative record of Elysia's ongoing development.",
        "The Story of Elysia remains the long-form historical and philosophical chronicle.",
        "Official Updates remain the authority-bearing place for formal releases, incidents, governance changes, security notices, and policy notices.",
        "The Commune remains the place for public conversation around the work.",
        "Elysia Iteration Showcase remains the place for visible demos, screenshots, build artifacts, and iteration-specific discussion.",
        "None of those public surfaces gain access to private local Elysia merely because they are connected conceptually.",
      ],
    },
    {
      id: "what-is-real-now",
      heading: "What is real now",
      paragraphs: [
        "Local Elysia exists as a working local-first, privacy-first, governed companion-intelligence platform with a local runtime, a local API bridge, a desktop chamber, explicit policy and memory boundaries, and bounded capability paths.",
        "Elysia Ecobotics Online exists as the separate public, cloud-facing ecosystem for releases, documentation, the Marketplace, Developer Forge, Living Library, Commune, Commons Circle, public project context, and other participation surfaces.",
        "Codev remains a separately governed local coding subsystem used through Elysia and explicitly paired surfaces. A website page does not inherit repository, shell, Git, package, or machine authority merely because Codev exists.",
        "The Elysia Artisan Collective remains a separate creative commons. Its approved bridge is public identity and attribution, not private local Elysia memory, files, conversations, prompts, sockets, runtime state, or machine data.",
      ],
    },
    {
      id: "what-is-not-live-yet",
      heading: "What is not live yet",
      paragraphs: [
        "The public website is not, by default, a remote-control panel for a person's private local Elysia system. Explicitly paired Codev and Online workflows remain narrow, separately governed, and do not turn the public website into general local-machine authority. Publishing the Build Log does not change that boundary.",
        "Long-horizon ecological, robotic, sensing, and subsystem ambitions should not be read as claims that every envisioned capability is already active. A design document, research direction, or future architecture is not the same thing as a deployed capability.",
        "The Build Log itself does not automatically post into the Commune, create Official Updates, publish Iteration Showcases, or mutate any other public system. Those remain separate workflows.",
      ],
    },
    {
      id: "privacy-boundary-check",
      heading: "Privacy and boundary check",
      paragraphs: [
        "This entry contains public-safe architectural and project context only. It does not publish private Elysia memory, personal files, raw journals, raw runtime logs, credentials, secrets, hidden prompts, private account records, local repository paths, or sensitive machine details.",
        "That rule is not merely editorial taste. It is part of the same public/private separation the entry is describing.",
      ],
    },
    {
      id: "what-we-learned",
      heading: "What we learned",
      paragraphs: [
        "As Elysia grows across local AI, coding tools, a public website, creative spaces, research resources, and eventually ecological technology, the difficult part is not only connecting things. It is connecting them without quietly erasing the boundaries that made them trustworthy.",
        "Good architecture sometimes means refusing a convenient shortcut. The public commons can know that work happened without receiving the private material that made the work possible.",
      ],
    },
    {
      id: "what-comes-next",
      heading: "What comes next",
      paragraphs: [
        "The Build Log will gradually gain carefully sourced retrospective entries so people can trace how Elysia moved from constitution and architecture into working local software and a public commons.",
        "New entries will focus on meaningful milestones rather than manufacturing a constant stream of content. When a Build Log entry has a genuine Commune discussion, Official Update, or Iteration Showcase connected to it, that relationship can be linked explicitly instead of being implied.",
      ],
    },
  ],
  relatedLinks: [
    { label: "Read The Story of Elysia", href: "/story" },
    { label: "About Elysia Ecobotics", href: "/about" },
    { label: "Download and verify Elysia", href: "/archive" },
    { label: "Explore Developer Forge", href: "/developer-forge" },
    { label: "Visit the Living Library", href: "/living-library" },
    { label: "Enter the Elysia Commune", href: "/commune" },
    { label: "Visit the Elysia Artisan Collective bridge", href: "/artisan-collective" },
  ],
};
