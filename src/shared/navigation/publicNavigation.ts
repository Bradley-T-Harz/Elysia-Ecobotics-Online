export const publicNavigationUtilities = [
  { id: "home", label: "Home", to: "/" },
  { id: "download", label: "Download", to: "/archive" },
  { id: "account", label: "Account / Sign In", to: "/commons-circle" }
] as const;

export const publicNavigationTerritories = [
  {
    id: "get-elysia",
    label: "Get Elysia",
    destinations: [
      {
        label: "Archive & Release Status",
        to: "/archive",
        description: "See release availability, system information, verification guidance, and the public release history."
      }
    ]
  },
  {
    id: "explore",
    label: "Explore",
    destinations: [
      {
        label: "Marketplace",
        to: "/marketplace",
        description: "Discover approved add-ons, review permissions and trust information, and explore ways to extend Elysia."
      },
      {
        label: "Products",
        to: "/products",
        description: "Explore the long-term physical product directions being developed around Elysia Ecobotics."
      },
      {
        label: "Living Library",
        to: "/living-library",
        description: "Browse curated research sources, ecological knowledge, source ethics, and starter collections."
      }
    ]
  },
  {
    id: "build",
    label: "Build",
    destinations: [
      {
        label: "Creator Studio",
        to: "/marketplace/creator-studio",
        description: "Manage your add-ons, drafts, submissions, review outcomes and publisher identity."
      },
      {
        label: "Developer Forge",
        to: "/developer-forge",
        description: "Design, validate, document, and submit add-ons through Elysia’s governed developer workspace."
      },
      {
        label: "Lab",
        to: "/lab",
        description: "See the research, experiments, people, and projects shaping future Elysia Ecobotics work."
      }
    ]
  },
  {
    id: "community",
    label: "Community",
    destinations: [
      {
        label: "Commune",
        to: "/commune",
        description: "Enter the public commons for discussion, research notes, troubleshooting, code, projects, and community work."
      },
      {
        label: "Work With Elysia Ecobotics",
        to: "/work-with-elysia-ecobotics",
        description: "Learn how to contribute, collaborate, volunteer, or submit a private request to work with Elysia Ecobotics."
      },
      {
        label: "Commons Circle",
        to: "/commons-circle",
        description: "Your shared account home for profile, participation, saved resources, and community activity."
      },
      {
        label: "Artisan Collective",
        to: "/artisan-collective",
        description: "Visit the separate creative commons for artists, challenges, galleries, and community expression.",
        bridge: "separate-elysia-portal"
      }
    ]
  },
  {
    id: "about-trust",
    label: "About & Trust",
    destinations: [
      {
        label: "Story",
        to: "/story",
        description: "Follow the history of Elysia Ecobotics and how the work has developed."
      },
      {
        label: "About",
        to: "/about",
        description: "Learn what Elysia Ecobotics is, how it is organized, and what it is building."
      },
      {
        label: "Mission",
        to: "/mission",
        description: "Read the mission, values, and stewardship commitments guiding the work."
      },
      {
        label: "Support",
        to: "/support",
        description: "See ways to support the work, with access remaining separate from payment."
      },
      {
        label: "Legal",
        to: "/legal",
        description: "Review policies, terms, privacy, security, community standards, and economic boundaries."
      }
    ]
  }
] as const;

export type PublicNavigationTerritory = (typeof publicNavigationTerritories)[number];
export type PublicNavigationDestination = PublicNavigationTerritory["destinations"][number];
