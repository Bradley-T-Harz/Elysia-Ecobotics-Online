const canonicalOrigin = "https://elysiaecobotics.com";
const siteName = "Elysia Ecobotics Online";

export type RouteMetadataRecord = {
  title: string;
  description: string;
  canonicalUrl: string;
};

const exactTitles: Record<string, string> = {
  "/": siteName,
  "/archive": "Elysia Archive",
  "/marketplace": "Elysia Marketplace",
  "/marketplace/browse": "Browse the Elysia Marketplace",
  "/marketplace/action-preview": "Marketplace Action Preview",
  "/marketplace/account": "Marketplace Account",
  "/marketplace/submit": "Submit to the Elysia Marketplace",
  "/marketplace/trust": "Marketplace Trust & Safety",
  "/marketplace/manifest-api": "Marketplace Manifest API",
  "/marketplace/admin": "Marketplace Submission Administration",
  "/browse": "Browse the Elysia Marketplace",
  "/action-preview": "Marketplace Action Preview",
  "/account": "Marketplace Account",
  "/submit": "Submit to the Elysia Marketplace",
  "/trust": "Marketplace Trust & Safety",
  "/manifest-api": "Marketplace Manifest API",
  "/products": "Elysia Ecobotics Products",
  "/lab": "The Elysia Ecobotics Lab",
  "/developer-forge": "Developer Forge",
  "/developer-forge/profile": "Developer Forge Profile",
  "/developer-forge/dashboard": "Developer Forge Dashboard",
  "/developer-forge/drafts": "Developer Forge Drafts",
  "/developer-forge/drafts/new": "New Developer Forge Draft",
  "/developer-forge/submissions": "Developer Forge Submissions",
  "/developer-forge/docs": "Developer Forge Documentation",
  "/developer-forge/docs/workbench": "Developer Forge Workbench Guide",
  "/developer-forge/docs/manifest": "Developer Forge Manifest Guide",
  "/developer-forge/docs/permissions": "Developer Forge Permissions Guide",
  "/developer-forge/docs/security": "Developer Forge Security Guide",
  "/developer-forge/docs/templates": "Developer Forge Templates",
  "/developer-forge/docs/compatibility": "Developer Forge Compatibility",
  "/living-library": "The Living Library",
  "/commune": "The Elysia Commune",
  "/commune/rooms": "Elysia Commune Rooms",
  "/commune/new": "New Commune Post",
  "/commune/repository-showcase": "Repository Showcase",
  "/commune/repository-showcase/new": "New Repository Showcase",
  "/commune/repository-showcase/sandbox-request": "Repository Showcase Sandbox Request",
  "/commune/elysia-iteration-showcase/sandbox-request": "Elysia Iteration Sandbox Request",
  "/commune/troubleshooting": "Commune Troubleshooting",
  "/commune/troubleshooting-grove/review": "Troubleshooting Grove Review",
  "/commune/troubleshooting-grove/sandbox-request": "Troubleshooting Grove Sandbox Request",
  "/commune/sandbox-review": "Commune Sandbox Review",
  "/commune/coding-cornucopia/review": "Coding Cornucopia Review",
  "/commune/coding-cornucopia/sandbox-request": "Coding Cornucopia Sandbox Request",
  "/commune/code-sharing/review": "Code Sharing Review",
  "/commune/code-sharing/sandbox-request": "Code Sharing Sandbox Request",
  "/commune/realtime": "Commune Realtime Rooms",
  "/commune/moderation": "Commune Moderation",
  "/work-with-elysia-ecobotics": "Work With Elysia Ecobotics",
  "/support": "Support Elysia Ecobotics",
  "/support/thank-you": "Support Status",
  "/account/forgot-password": "Recover Account Access",
  "/account/recovery": "Choose a New Password",
  "/account/export": "Request a community data export",
  "/account/delete": "Permanently Delete Account",
  "/account/change-password": "Change Password",
  "/account/deactivate": "Temporarily Deactivate Account",
  "/account/reactivate": "Reactivate Account",
  "/commons-circle": "The Commons Circle",
  "/commons-circle/admin-console": "Commons Circle Admin Console",
  "/commons-circle/admin-communications": "Admin Communications",
  "/commons-circle/admin/messaging-access": "Messaging Access Administration",
  "/commons-circle/saved-shelves": "Saved Shelves",
  "/commons-circle/inbox": "Commons Circle Inbox",
  "/commons-circle/notifications": "Commons Circle Notifications",
  "/commons-circle/requests-reviews": "Commons Circle Requests & Reviews",
  "/commons-circle/signals": "Commons Circle Signals",
  "/commons-circle/signals/inbox": "Commons Circle Inbox",
  "/commons-circle/signals/inbox/new": "New Private Conversation",
  "/commons-circle/signals/inbox/settings": "Messaging Settings",
  "/commons-circle/signals/notifications": "Notifications",
  "/commons-circle/signals/requests-reviews": "Requests & Reviews",
  "/commons-circle/signals/coding-proposals": "Coding Proposal Signals",
  "/commons-circle/signals/troubleshooting": "Troubleshooting Signals",
  "/commons-circle/signals/research-notes": "Research Note Signals",
  "/commons-circle/signals/repository-showcases": "Repository Showcase Signals",
  "/commons-circle/signals/iteration-showcases": "Iteration Showcase Signals",
  "/commons-circle/signals/job-posts": "Job Post Signals",
  "/commons-circle/signals/voting-room": "Voting Room Signals",
  "/commons-circle/signals/official-updates": "Official Update Signals",
  "/commons-circle/signals/sandbox-reviews": "Sandbox Review Signals",
  "/commons-circle/signals/work-with": "Work With Signals",
  "/commons-circle/signals/marketplace-forge": "Marketplace & Forge Signals",
  "/commons-circle/signals/circle": "Your Commons Circle",
  "/commons-circle/support-billing": "Support & Billing",
  "/commons-circle/onboarding": "Commons Circle Setup",
  "/commons-circle/settings": "Account & Profile Settings",
  "/commons-circle/settings/privacy": "Privacy & Public Profile",
  "/commons-circle/settings/notifications": "Notification Preferences",
  "/commons-circle/settings/appearance": "Profile & Appearance",
  "/artisan-collective": "Elysia Artisan Collective",
  "/story": "The Story of Elysia",
  "/about": "About Elysia Ecobotics",
  "/mission": "The Elysia Mission",
  "/legal": "Legal & Trust",
  "/admin": "Elysia Administration",
  "/admin/moderation": "Moderation Administration",
  "/admin/reports": "Reports Administration",
  "/admin/addon-submissions": "Add-on Submission Administration",
  "/admin/developers": "Developer Administration",
  "/admin/library-sources": "Living Library Administration",
  "/admin/work-submissions": "Work Submission Administration",
  "/admin/review": "Review Administration",
  "/admin/review/work-with": "Work With Review",
  "/admin/review/stewardship": "Stewardship Review",
  "/admin/review/commune": "Commune Review",
  "/admin/review/living-library": "Living Library Review",
  "/admin/review/marketplace": "Marketplace Review",
  "/admin/review/broken-links": "Broken Link Review",
  "/admin/roles": "Role Administration",
  "/admin/audit": "Audit Administration",
  "/admin/economic-operations": "Economic Operations",
  "/admin/badges": "Badge Administration",
};

const exactDescriptions: Record<string, string> = {
  "/": "Elysia Ecobotics Online: governed Marketplace intake, Developer Forge, Living Library, Commons Circle, and public project documentation around local Elysia.",
  "/account/export": "Request a portable export of shared Elysia public-community account data.",
  "/account/delete": "Request permanent deletion through the governed shared Elysia Website Account lifecycle.",
  "/account/change-password": "Change the signed-in user's shared Elysia Website Account password.",
  "/account/deactivate": "Voluntarily pause the current shared Elysia Website Account without changing its participation state.",
  "/account/reactivate": "Explicitly reactivate the current voluntarily paused shared Elysia Website Account.",
  "/commons-circle/settings": "Private settings for the current Elysia Website Account and Commons Profile.",
  "/commons-circle/settings/privacy": "Privacy Lanterns and public Commons Profile publication settings.",
  "/commons-circle/settings/notifications": "Account event and legacy signal notification preferences for the signed-in Website Account.",
  "/commons-circle/settings/appearance": "Customize the current Commons Profile appearance.",
  "/artisan-collective": "Meet the Elysia Artisan Collective, a separate creative commons for credited human-made, AI-assisted, generative, hybrid, and difficult-to-classify art.",
};

function titleCaseSlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((word) => word === "api" ? "API" : word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizedPathname(value: string) {
  const pathOnly = value.split(/[?#]/, 1)[0] || "/";
  if (!pathOnly.startsWith("/")) return "/";
  return pathOnly.length > 1 ? pathOnly.replace(/\/+$/, "") : "/";
}

function titleForPath(pathname: string) {
  const exact = exactTitles[pathname];
  if (exact) return exact;
  if (/^\/marketplace\/addons\/[^/]+$/.test(pathname) || /^\/addons\/[^/]+$/.test(pathname)) return "Marketplace Add-on";
  if (/^\/developer-forge\/drafts\/[^/]+\/manifest$/.test(pathname)) return "Developer Forge Draft Manifest";
  if (/^\/developer-forge\/drafts\/[^/]+\/permissions$/.test(pathname)) return "Developer Forge Draft Permissions";
  if (/^\/developer-forge\/drafts\/[^/]+\/package$/.test(pathname)) return "Developer Forge Draft Package";
  if (/^\/developer-forge\/drafts\/[^/]+\/validate$/.test(pathname)) return "Validate Developer Forge Draft";
  if (/^\/developer-forge\/drafts\/[^/]+\/preview$/.test(pathname)) return "Preview Developer Forge Draft";
  if (/^\/developer-forge\/drafts\/[^/]+\/submit$/.test(pathname)) return "Submit Developer Forge Draft";
  if (/^\/developer-forge\/drafts\/[^/]+$/.test(pathname)) return "Developer Forge Draft";
  if (/^\/developer-forge\/submissions\/[^/]+$/.test(pathname)) return "Developer Forge Submission";
  if (/^\/living-library\/browse\/[^/]+$/.test(pathname)) return "Browse the Living Library";
  if (/^\/living-library\/source\/[^/]+$/.test(pathname)) return "Living Library Source";
  if (/^\/commune\/rooms\/[^/]+\/new$/.test(pathname) || /^\/commune\/[^/]+\/new$/.test(pathname)) return "New Commune Post";
  if (/^\/commune\/rooms\/[^/]+\/posts$/.test(pathname)) return "Commune Room Posts";
  if (/^\/commune\/rooms\/[^/]+$/.test(pathname) || /^\/commune\/[^/]+$/.test(pathname)) return "Commune Room";
  if (/^\/commune\/posts\/[^/]+$/.test(pathname)) return "Commune Post";
  if (/^\/commons-circle\/signals\/inbox\/conversations\/[^/]+$/.test(pathname)) return "Private Conversation";
  if (/^\/commons-circle\/setup\/[^/]+$/.test(pathname)) return "Commons Circle Setup";
  if (/^\/commons\/[^/]+$/.test(pathname) || /^\/commons-circle\/[^/]+$/.test(pathname)) return "Public Commons Profile";
  if (/^\/legal\/[^/]+$/.test(pathname)) {
    const segments = pathname.split("/");
    return titleCaseSlug(segments[segments.length - 1] || "Legal Policy");
  }
  return siteName;
}

function descriptionForPath(pathname: string) {
  const exact = exactDescriptions[pathname];
  if (exact) return exact;
  if (pathname.startsWith("/marketplace") || ["/browse", "/addons", "/action-preview", "/account", "/submit", "/trust", "/manifest-api"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return "Browse, review, submit, and manage governed Elysia Marketplace add-ons while preserving separate security, license, account, and installation boundaries.";
  }
  if (pathname.startsWith("/developer-forge")) return "Build, validate, review, document, and submit Elysia add-ons through the governed Developer Forge workflow.";
  if (pathname.startsWith("/living-library")) return "Explore the curated Living Library and its source-aware environmental, scientific, technical, and public-interest research paths.";
  if (pathname.startsWith("/commune")) return "Participate in the Elysia Commune's established rooms, discussions, reviews, realtime spaces, and governed code-sharing workflows.";
  if (pathname.startsWith("/commons-circle") || pathname.startsWith("/commons/")) return "Use the Commons Circle's shared account, public profile, Signals, private communication, settings, participation, and review surfaces.";
  if (pathname.startsWith("/admin")) return "Use the authority-scoped Elysia administration and review surface; server and database controls remain authoritative.";
  if (pathname.startsWith("/account/")) return "Use the governed security, recovery, export, deactivation, reactivation, and deletion controls for the shared Elysia Website Account.";
  if (pathname.startsWith("/legal")) return "Read the current public legal, privacy, safety, participation, economic, and trust policies for Elysia Ecobotics Online.";
  if (pathname === "/archive") return "Download and verify preserved Elysia and Codev public release artifacts and supporting documentation.";
  if (pathname === "/products") return "Explore established Elysia Ecobotics products while keeping local Elysia and local computation free and private.";
  if (pathname === "/lab") return "Explore the Elysia Ecobotics Lab and its experimental research and development work.";
  if (pathname === "/work-with-elysia-ecobotics") return "Review established ways to work, participate, contribute, or propose a professional engagement with Elysia Ecobotics.";
  if (pathname.startsWith("/support")) return "Learn about voluntary support for the commons, separately from free participation, local Elysia, and hosted execution usage.";
  if (pathname === "/story") return "Read the established story, origins, and evolving public context of Elysia Ecobotics.";
  if (pathname === "/about") return "Learn what Elysia Ecobotics is, how its public and local worlds relate, and which boundaries they preserve.";
  if (pathname === "/mission") return "Read the public mission and practical commitments guiding Elysia Ecobotics.";
  if (pathname === "/artisan-collective") return exactDescriptions["/artisan-collective"];
  return exactDescriptions["/"];
}

export function routeMetadataForPath(value: string): RouteMetadataRecord {
  const pathname = normalizedPathname(value);
  const pageTitle = titleForPath(pathname);
  return {
    title: pageTitle === siteName ? siteName : `${pageTitle} | ${siteName}`,
    description: descriptionForPath(pathname),
    canonicalUrl: `${canonicalOrigin}${pathname === "/" ? "/" : encodeURI(pathname)}`,
  };
}
