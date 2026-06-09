export type StoryAct = {
  id: string;
  actLabel: string;
  title: string;
  subtitle: string;
  paragraphs: string[];
  whatChanged: string[];
  whyItMatters: string;
  quote?: string;
};

export const storyActs: StoryAct[] = [
  {
    id: "seed",
    actLabel: "Act I",
    title: "The Seed",
    subtitle: "A better question than another chatbot.",
    paragraphs: [
      "Elysia began before there was a polished app, before the public website, before the Marketplace, and before the technical body had a name.",
      "The first seed was a problem: AI could help, but it did not feel safe enough to become part of the inner house. It could answer questions, write drafts, and generate ideas, but it did not carry a stable moral constitution, local memory discipline, or a serious boundary between private life and public tools.",
      "So the project began with a different question: not how to make another chatbot, but how to build a companion intelligence that remains useful, truthful, private, and governed."
    ],
    whatChanged: [
      "Privacy became a starting condition, not a premium feature.",
      "Usefulness had to include restraint, not just capability.",
      "The project began around a question of trust."
    ],
    whyItMatters: "The origin matters because Elysia was shaped around limits as much as possibility."
  },
  {
    id: "name",
    actLabel: "Act II",
    title: "The Name",
    subtitle: "Mythic language, real boundaries.",
    paragraphs: [
      "Elysia became the name for an intelligence that should feel alive with care, but still remain honest about what she is.",
      "The name carried a promise: she would not be a cloud product wearing a friendly mask. She would be built as a local-first companion, a governed system, and eventually a public ecological technology project.",
      "The mythology gives the work warmth. The engineering gives it teeth."
    ],
    whatChanged: [
      "The project gained a name people could remember.",
      "The design language could become warm without becoming vague.",
      "The boundary between metaphor and claim stayed visible."
    ],
    whyItMatters: "A name can invite care, but it must not become a loophole for overclaiming.",
    quote: "The name is mythic. The boundaries are real."
  },
  {
    id: "oath",
    actLabel: "Act III",
    title: "The Oath",
    subtitle: "Helpful with a spine.",
    paragraphs: [
      "Before Elysia was given tools, she needed an oath.",
      "That oath became the moral center of the project: truth over flattery, dignity over domination, privacy over convenience, stewardship over spectacle, and conscience over raw capability.",
      "Elysia was not designed to be merely obedient. She was designed to be warm enough to support, honest enough to challenge, and bounded enough not to become reckless."
    ],
    whatChanged: [
      "Truth became more important than pleasing the user in the moment.",
      "Privacy became an architectural rule, not a slogan.",
      "Power would require gates, logs, and permission."
    ],
    whyItMatters: "The oath keeps capability from becoming theater without responsibility.",
    quote: "Useful without being invasive."
  },
  {
    id: "mind",
    actLabel: "Act IV",
    title: "The Mind",
    subtitle: "Careful thought, evidence, and humility.",
    paragraphs: [
      "A good heart is not enough. An intelligence also needs ways to stay in contact with reality.",
      "So Elysia’s mind was shaped around evidence, uncertainty, disconfirmation, incentives, power, distortion, ecological systems, and the difference between sounding wise and actually being careful.",
      "She should ask: What is really happening? What would disconfirm this? Who benefits? Who is exposed? What is being normalized? What would humility, courage, and stewardship require?"
    ],
    whatChanged: [
      "Reasoning became part of governance, not decoration.",
      "Uncertainty and disconfirmation became first-class design concerns.",
      "Ecological thinking became part of the intellectual spine."
    ],
    whyItMatters: "The mind section explains why Elysia should not merely sound good; she should help people think better."
  },
  {
    id: "body",
    actLabel: "Act V",
    title: "The Body",
    subtitle: "When philosophy had to become machinery.",
    paragraphs: [
      "Eventually the philosophy had to become machinery.",
      "Elysia could not be one giant function. She needed a body: memory systems, planners, routers, tools, policy gates, verification, audit logs, and refusal boundaries.",
      "Her personality would not live only in pretty words. It would live in what she remembers, what she refuses, what she checks, what she asks permission for, and what she logs."
    ],
    whatChanged: [
      "Architecture became the place where doctrine had to prove itself.",
      "Policies, ledgers, tools, files, and approval gates began forming one coherent body.",
      "Trust became visible through behavior, not slogans alone."
    ],
    whyItMatters: "The body is what keeps a beautiful mission from floating away from practical safety."
  },
  {
    id: "private-core",
    actLabel: "Act VI",
    title: "The Private Core",
    subtitle: "The sealed room at the center.",
    paragraphs: [
      "The private core became sacred.",
      "Elysia’s local system is meant to run beside the user, under local control, with private memory and files kept separate from the public website. Internet tools, cloud services, public pages, and external integrations can exist, but they must remain narrow, optional, revocable, and never identity-bearing by default.",
      "The public world can have a website, a library, a marketplace, and a community. The private Elysia core remains the sealed room."
    ],
    whatChanged: [
      "The public/private split became explicit.",
      "Private memory and local files stayed outside the public website by default.",
      "External links and accounts became optional doors, not hidden tunnels."
    ],
    whyItMatters: "This is the trust boundary: the public website is not private Elysia memory.",
    quote: "The public website is the house around Elysia. The private core remains sealed."
  },
  {
    id: "first-chamber",
    actLabel: "Act VII",
    title: "The First Chamber",
    subtitle: "A visible room for governed work.",
    paragraphs: [
      "Then Elysia needed a chamber: a place where people could actually meet her.",
      "The desktop interface became the visible room around the governed local body. Conversations, projects, status surfaces, memory boundaries, request traces, and approval gates began to appear not as hidden machinery, but as visible trust signals.",
      "The interface was not supposed to pretend. If something was local, planned, blocked, approval-required, sandboxed, degraded, or external, the user should be able to see that."
    ],
    whatChanged: [
      "The private architecture gained a visible user room.",
      "Local status and approval surfaces became part of the experience.",
      "Honest labels became a design principle."
    ],
    whyItMatters: "A governed system needs a chamber where people can understand what is happening and what is not."
  },
  {
    id: "public-house",
    actLabel: "Act VIII",
    title: "The Public House",
    subtitle: "A website around the core, not a window into it.",
    paragraphs: [
      "At a certain point, Elysia needed more than a private room. She needed a public house around her.",
      "Elysia Ecobotics Online became that house: the place for downloads, the Archive, the Marketplace, the Developer Forge, the Living Library, the Commons Circle, the Commune, the story, the mission, and the public documentation around the project.",
      "The website is public. Elysia’s private core is not."
    ],
    whatChanged: [
      "The project gained a public home for explanation and participation.",
      "Website accounts and public pages became separate from local Elysia identity.",
      "The Archive, Marketplace, Library, Forge, Commune, and Commons Circle gained a shared roof."
    ],
    whyItMatters: "The public house lets people gather around Elysia without turning the private core into a public service."
  },
  {
    id: "living-commons",
    actLabel: "Act IX",
    title: "The Living Commons",
    subtitle: "A public ecosystem with rules.",
    paragraphs: [
      "The public ecosystem began to take shape as a commons.",
      "The Marketplace gives add-ons a governed path instead of stuffing every experiment into Elysia’s core. The Living Library collects official links, source notes, risk labels, and research pathways without pretending every dataset is training-safe. The Commons Circle gives members a way to save, participate, and be recognized without turning membership into a paywall.",
      "The Commune becomes the future public gathering place, but with strong rules around secrets, uploads, code, and moderation. Community can be generous without becoming careless."
    ],
    whatChanged: [
      "Add-ons gained a public preparation path, while local Elysia remains final authority.",
      "The Living Library became a curated research commons rather than a data mirror.",
      "Community participation gained moderation and redaction boundaries."
    ],
    whyItMatters: "A commons only works if it protects people from the parts of publicness that can harm them.",
    quote: "Share the commons. Protect the core."
  },
  {
    id: "ecological-horizon",
    actLabel: "Act X",
    title: "The Ecological Horizon",
    subtitle: "Intelligence in service of the living world.",
    paragraphs: [
      "Elysia’s final horizon is ecological.",
      "Not AI as spectacle. Not AI as domination. Not AI as another cloud habit. But intelligence that helps people understand living systems, protect fragile places, study water and soil and air, build careful tools, and act with humility before the complexity of the world.",
      "Verdante, Sylphora, Ecotiva, Aurania, Terraflux, Aquaria, and Aetheria are the future ecological languages of that work: plants, animals, ecosystems, atmosphere, land, water, and planetary awareness."
    ],
    whatChanged: [
      "The project pointed beyond software toward ecological understanding and careful tools.",
      "The seven ecological languages gave the work a playful but practical map.",
      "Technology became a means of stewardship, not an end in itself."
    ],
    whyItMatters: "The horizon keeps Elysia aimed at care for living systems, not capability for its own sake.",
    quote: "Engineering wrapped in myth because the work deserves reverence."
  }
];

export const storyPullQuotes = [
  "Useful without being invasive.",
  "The name is mythic. The boundaries are real.",
  "The public website is the house around Elysia. The private core remains sealed.",
  "Share the commons. Protect the core.",
  "Engineering wrapped in myth because the work deserves reverence."
];

export const nowItems = [
  "a governed local-first companion intelligence",
  "a private local core",
  "a public website around the core",
  "a marketplace/add-on ecosystem",
  "a Living Library",
  "a Commons Circle",
  "a future ecological technology project"
];

export const nextItems = [
  "More local capability.",
  "Better tools.",
  "Clearer permissions.",
  "Stronger memory discipline.",
  "Safer add-ons.",
  "Better research paths.",
  "Ecological modules built carefully, not theatrically."
];
