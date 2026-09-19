export type StartHereAction = {
  label: string;
  to: string;
  primary?: boolean;
};

export const modeCards = [
  {
    title: "Default",
    description: "Use this for normal questions, thinking, planning, analysis, and everyday work."
  },
  {
    title: "Tutor",
    description: "Use this when you want something taught step by step instead of only getting the final answer."
  },
  {
    title: "Researcher",
    description: "Use this when evidence, sources, uncertainty, and comparing claims matter. Public research can cross the internet boundary when enabled."
  },
  {
    title: "Writer",
    description: "Use this for drafting, editing, tone, structure, creative work, and preserving a particular voice."
  },
  {
    title: "Coder",
    description: "Use this for repositories, debugging, code review, and proposed changes. It is not an unrestricted terminal or Git robot."
  }
] as const;

export const roomGroups = [
  {
    title: "Workrooms",
    description: "Where most practical work happens.",
    rooms: [
      { name: "Conversations", description: "Talk, ask, analyze, learn, plan, write, and work with Elysia." },
      { name: "Projects", description: "Keep ongoing work, conversations, files, outputs, milestones, and next steps together." },
      { name: "Artifacts", description: "Review saved outputs such as reports, tables, plots, and other generated files." },
      { name: "Requests", description: "Inspect what happened during a task, including tools, boundaries, approvals, and evidence." },
      { name: "Codev", description: "A governed local development workspace that appears when Codev is installed." }
    ]
  },
  {
    title: "Memory & Identity",
    description: "Continuity and the person using the local system.",
    rooms: [
      { name: "Memory", description: "Inspect continuity and how Elysia is handling remembered information." },
      { name: "Personal Identity", description: "Your sealed local identity and private profile, separate from the public website." }
    ]
  },
  {
    title: "Control & System",
    description: "Truth about what Elysia can do and what she is allowed to do.",
    rooms: [
      { name: "Governance", description: "Understand permissions, approvals, boundaries, and the rules controlling actions." },
      { name: "Capabilities", description: "See what your installed Elysia can actually do now." },
      { name: "Add-ons", description: "View and manage add-on capability and Marketplace-related paths." },
      { name: "Health", description: "Check whether Elysia's local services and supporting pieces are working." }
    ]
  }
] as const;

export const trustWords = [
  {
    label: "Local",
    description: "This path stays on your machine."
  },
  {
    label: "Read-only",
    description: "Elysia can inspect something here but cannot change it from this path."
  },
  {
    label: "Draft only",
    description: "Elysia can prepare something but cannot execute or publish it from here."
  },
  {
    label: "Approval needed",
    description: "Elysia has reached a real action boundary and needs your decision."
  },
  {
    label: "Sandboxed",
    description: "Riskier work is being run inside an isolated, limited environment."
  },
  {
    label: "External",
    description: "Something is crossing outside your local Elysia environment."
  },
  {
    label: "Blocked",
    description: "That action is not allowed or cannot proceed from the current path."
  },
  {
    label: "Degraded / Unavailable",
    description: "Something expected is only partly working or is currently offline."
  }
] as const;

export const publicDestinations = [
  {
    title: "Archive",
    to: "/archive",
    account: "No Website Account required.",
    description: "Download Elysia, see the current stable release, read installation guidance, and verify checksums and release records."
  },
  {
    title: "Living Library",
    to: "/living-library",
    account: "No account needed to browse.",
    description: "Find research sources, data, tools, methods, ecological knowledge, and curated starting points."
  },
  {
    title: "Developer Forge",
    to: "/developer-forge",
    account: "Public documentation is open; account-backed developer work requires sign-in.",
    description: "Design, prepare, validate, document, and submit Elysia add-ons without giving the website control over local Elysia."
  },
  {
    title: "Artisan Collective",
    to: "/artisan-collective",
    account: "Participation uses your existing Commons public identity.",
    description: "The creative commons for artists, designers, writers, musicians, photographers, filmmakers, and other makers."
  },
  {
    title: "Commune",
    to: "/commune",
    account: "Public reading is separate from account-backed participation.",
    description: "Public and private discussion, troubleshooting, research notes, code, projects, opportunities, community work, and official updates."
  },
  {
    title: "Commons Circle",
    to: "/commons-circle",
    account: "A Website Account is required for your personal areas.",
    description: "Your public-site account home for your Commons Profile, saved resources, messages, activity, settings, and participation."
  },
  {
    title: "Marketplace",
    to: "/marketplace",
    account: "Browsing is public; saved, account, and developer actions require sign-in.",
    description: "Browse Elysia add-ons and inspect their permissions, dependencies, review state, and trust information before local use."
  },
  {
    title: "Work With Elysia Ecobotics",
    to: "/work-with-elysia-ecobotics",
    account: "Local drafts can be made without sign-in; private review submission requires a Website Account.",
    description: "Volunteer, collaborate, contribute, express professional interest, or privately submit a resume or CV for review."
  }
] as const;

export const secondaryDestinations = [
  {
    title: "Products",
    to: "/products",
    description: "Future environmental robotics, sensing, field-support, and repairable ecological technology. Nothing is for sale yet."
  },
  {
    title: "Lab",
    to: "/lab",
    description: "The human side of the project: people, collaborators, partners, researchers, builders, and project teams as they become public."
  },
  {
    title: "Story",
    to: "/story",
    description: "The longer history of why Elysia exists and how the project developed."
  },
  {
    title: "Build Log",
    to: "/build-log",
    description: "The continuing public record of what changed, what is real, and what is being built next."
  },
  {
    title: "Mission",
    to: "/mission",
    description: "The purpose and stewardship commitments guiding the work."
  },
  {
    title: "About",
    to: "/about",
    description: "Understand EcoSyneva Commons LLC, Elysia Ecobotics, Elysia Ecobotics Online, and local Elysia."
  },
  {
    title: "Legal & Trust",
    to: "/legal",
    description: "Privacy, security, community standards, economic boundaries, policies, and terms."
  },
  {
    title: "Support",
    to: "/support",
    description: "Optional ways to help sustain the work. Payment does not unlock local Elysia or buy authority."
  }
] as const;

export const placePaths: ReadonlyArray<{
  title: string;
  audience: string;
  description: string;
  actions: ReadonlyArray<StartHereAction>;
}> = [
  {
    title: "Learn & Research",
    audience: "Students, teachers, researchers, scientists, conservation practitioners, and curious learners.",
    description: "Start with trusted sources and evidence, then move into research discussion or collaboration when you are ready.",
    actions: [
      { label: "Open the Living Library", to: "/living-library", primary: true },
      { label: "Research Notes", to: "/commune/rooms/research-notes" }
    ]
  },
  {
    title: "Build & Tinker",
    audience: "Programmers, engineers, AI builders, roboticists, drone builders, sensor people, citizen scientists, and makers.",
    description: "Build add-ons, inspect code and technical ideas, share safe development work, and extend Elysia through governed paths.",
    actions: [
      { label: "Developer Forge", to: "/developer-forge", primary: true },
      { label: "Marketplace", to: "/marketplace" },
      { label: "Coding Cornucopia", to: "/commune/rooms/coding-cornucopia" }
    ]
  },
  {
    title: "Create",
    audience: "Artists, designers, musicians, photographers, writers, storytellers, filmmakers, and other creatives.",
    description: "Create, share, collaborate, and explore how human and AI-assisted creative work can live honestly inside the wider project.",
    actions: [
      { label: "Artisan Collective", to: "/artisan-collective", primary: true },
      { label: "Media Garden", to: "/commune/rooms/media-garden" }
    ]
  },
  {
    title: "Community & Collaboration",
    audience: "Community members, nonprofits, universities, institutions, professionals, organizers, and potential collaborators.",
    description: "Use the Commune for public and private conversation, Commons Circle for sustained account-based participation, or Work With for a direct collaboration request.",
    actions: [
      { label: "Visit the Commune", to: "/commune", primary: true },
      { label: "Commons Circle", to: "/commons-circle" },
      { label: "Work With Elysia", to: "/work-with-elysia-ecobotics" }
    ]
  },
  {
    title: "Work & Experience",
    audience: "Job seekers, students seeking experience, employers, research groups, and organizations with opportunities.",
    description: "Job Posts are the public opportunities board. Private applications and resumes belong in Work With. Public postings are reviewed before publication, and commercial postings may have a governed posting fee.",
    actions: [
      { label: "Browse Job Posts", to: "/commune/rooms/job-post/posts", primary: true },
      { label: "Private application / CV", to: "/work-with-elysia-ecobotics" },
      { label: "Post an opportunity", to: "/commune/rooms/job-post/new" }
    ]
  },
  {
    title: "Understand & Follow",
    audience: "Curious visitors, ethicists, philosophers, public-interest thinkers, and anyone who simply wants to follow the project.",
    description: "Learn why Elysia exists, how the work developed, what is being built now, and which commitments guide it.",
    actions: [
      { label: "Read the Story", to: "/story", primary: true },
      { label: "Build Log", to: "/build-log" },
      { label: "Mission", to: "/mission" },
      { label: "About", to: "/about" }
    ]
  }
];

export const ecologicalDomains = [
  {
    name: "Verdante",
    plainName: "Plants",
    description: "Plant health, cultivation, restoration, vegetation monitoring, and plant-system sensing."
  },
  {
    name: "Sylphora",
    plainName: "Animals & wildlife",
    description: "Wildlife monitoring, biodiversity, habitat awareness, and humane ecological interaction."
  },
  {
    name: "Ecotiva",
    plainName: "Ecosystems",
    description: "Ecosystem health, habitat relationships, restoration, pollution, and ecological change."
  },
  {
    name: "Aurania",
    plainName: "Atmosphere & climate",
    description: "Air quality, weather and climate context, atmospheric change, and resilience."
  },
  {
    name: "Terraflux",
    plainName: "Hazards & resilience",
    description: "Wildfire, flood, drought, landslide, and other natural-hazard awareness and preparedness."
  },
  {
    name: "Aquaria",
    plainName: "Water",
    description: "Water quality, watersheds, aquatic systems, flow, pollution, and water stewardship."
  },
  {
    name: "Aetheria",
    plainName: "Planetary & space awareness",
    description: "Long-range planetary risk, near-Earth objects, and broader planetary resilience."
  }
] as const;
