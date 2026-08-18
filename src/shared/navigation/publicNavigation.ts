export const publicNavigationUtilities = [
  { id: "home", label: "Home", to: "/" },
  { id: "account", label: "Account / Sign In", to: "/commons-circle" }
] as const;

export const publicNavigationTerritories = [
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
        label: "Developer Forge",
        to: "/developer-forge",
        description: "Design, validate, document, and submit add-ons through Elysia’s governed developer workspace."
      }
    ]
  },
  {
    id: "community",
    label: "Community",
    destinations: [
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
