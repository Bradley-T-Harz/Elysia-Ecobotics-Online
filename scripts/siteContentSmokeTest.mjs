import fs from "node:fs/promises";

async function read(file) {
  return fs.readFile(new URL(`../${file}`, import.meta.url), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const nav = await read("src/shared/components/SiteNav.tsx");
const footer = await read("src/shared/components/SiteFooter.tsx");
const app = await read("src/App.tsx");
const commons = await read("src/pages/The-Commons-Circle/index.tsx");
const commonsAdminConsole = await read("src/pages/The-Commons-Circle/CommonsCircleAdminConsolePage.tsx");
const adminPage = await read("src/pages/Admin/index.tsx");
const reviewClient = await read("src/shared/review/reviewClient.ts");
const publicProfile = await read("src/pages/Public-Commons-Profile/index.tsx");
const commune = await read("src/pages/The-Elysia-Commune/index.tsx");
const forgeValidator = await read("src/pages/The-Developer-Forge/developerForgeValidator.ts");
const forgeTemplates = await read("src/pages/The-Developer-Forge/developerForgeTemplates.ts");
const legalIndex = await read("src/pages/Legal/index.tsx");
const legalPolicies = await read("src/pages/Legal/legalPolicyPages.ts");
const archive = await read("src/pages/The-Elysia-Archive/index.tsx");
const marketplaceHome = await read("src/pages/The-Elysia-Marketplace/pages/HomePage.tsx");
const marketplaceCard = await read("src/pages/The-Elysia-Marketplace/components/AddonCard.tsx");
const marketplaceDetails = await read("src/pages/The-Elysia-Marketplace/components/AddonDetails.tsx");
const sandboxHandoff = await read("src/shared/sandbox/sandboxHandoffBuilder.ts");

const expectedNav = ["Home", "Archive", "Marketplace", "Products", "Lab", "Developer Forge", "Living Library", "Commune", "Work With", "Commons Circle", "Story", "About", "Mission", "Legal"];
let cursor = -1;
for (const label of expectedNav) {
  const next = nav.indexOf(`label: "${label}"`);
  assert(next > cursor, `Nav order missing or out of order: ${label}`);
  cursor = next;
}

assert(footer.includes("Elysia Ecobotics™ is an EcoSyneva Commons LLC initiative."), "Footer initiative trademark text missing.");
assert(footer.includes("Elysia Ecobotics™ is a trademark of EcoSyneva Commons LLC."), "Footer trademark owner text missing.");
assert(app.includes("lazy(() => import"), "App routes are not lazy-loaded.");
assert(app.includes('path="commons-circle/admin-console"'), "Commons Circle admin console route missing.");
assert(app.includes('path="commons-circle/@:username"'), "Commons Circle public profile route missing.");
assert(app.includes('path="admin/reports"'), "Admin reports route missing.");
assert(app.includes('path="admin/addon-submissions"'), "Admin add-on submissions route missing.");
assert(app.includes('path="admin/developers"'), "Admin developers route missing.");
assert(app.includes('path="admin/library-sources"'), "Admin library source route missing.");
assert(app.includes('path="admin/work-submissions"'), "Admin work submissions route missing.");
assert(reviewClient.includes("syncCommuneReviewSubject"), "Admin review actions should sync Commune review subjects.");
assert(reviewClient.includes("createReviewHistoryItem"), "Admin History/All should support history-only review items.");
assert(reviewClient.includes("history_only: true") && reviewClient.includes("active_queue: false"), "Direct-published history items should not enter the active queue.");
assert(reviewClient.includes("activeReviewStatuses") && reviewClient.includes("historyReviewStatuses"), "Admin review queues should distinguish active queue from history.");
assert(reviewClient.includes('filter: ReviewQueueFilter = "active"'), "Admin review queue should default to active items only.");
assert(reviewClient.includes('item.source_table === "commune_posts"'), "Commune review sync should target commune_posts.");
assert(reviewClient.includes('status: "published"') && reviewClient.includes('visibility: "public"'), "Commune approval should publish the underlying post.");
assert(reviewClient.includes("approved Commune post thread repair") && reviewClient.includes('post_id: item.source_id'), "Commune approval should repair missing discussion threads for approved posts.");
assert(reviewClient.includes('status: "archived"') && reviewClient.includes('visibility: "private_draft"'), "Commune archive should make the underlying post non-public.");
assert(reviewClient.includes('status: "removed_by_moderator"'), "Commune rejection should remove the underlying post from public workflow.");
assert(reviewClient.includes("grantCommuneThreadApproval"), "Approving Commune comments should grant thread participation approval.");
assert(adminPage.includes("Reject and remove this submitted item?"), "Admin rejected actions should require explicit confirmation.");
assert(adminPage.includes("Yes, reject/remove") && adminPage.includes("No, keep it"), "Admin rejection confirmation yes/no buttons missing.");
assert(adminPage.includes("Admin review history") && adminPage.includes("Archive is an admin-selected saved state"), "Admin review history/archive distinction missing.");
assert(!commons.includes("plannedBadges.map"), "Commons Circle appears to render planned/locked badge catalog.");
assert(!publicProfile.includes("plannedBadges.map"), "Public profile appears to render planned/locked badge catalog.");
assert(commons.includes("Recognition, not authority") || commons.includes("Badges are recognition"), "Commons Circle badge/role authority separation copy missing.");
assert(commons.includes("CommonsCircleAdminEntryCard"), "Commons Circle should show a compact admin-console entry card instead of the full panel.");
assert(commons.includes("`/commons-circle/@${encodeURIComponent(profile.username)}`"), "Commons Circle View public profile should use /commons-circle/@username.");
assert(!commons.includes("href=\"/\"") || !commons.includes("View public profile"), "Commons Circle View public profile should not point to the homepage.");
assert(!commons.includes("<h2>Moderation and governance tools</h2>"), "Commons Circle main page should not render the full Admin Console panel inline.");
assert(commonsAdminConsole.includes("Moderation and governance tools"), "Commons Circle Admin Console page must preserve the full console panel.");
assert(commonsAdminConsole.includes("Admin dashboard") && commonsAdminConsole.includes("User role management") && commonsAdminConsole.includes("Audit logs"), "Commons Circle Admin Console links missing.");
assert(commonsAdminConsole.includes("Role required") && commonsAdminConsole.includes("Sign in required"), "Commons Circle Admin Console role/sign-in gate copy missing.");
assert(commune.includes("Code executes nowhere by default") || commune.includes("execute nowhere"), "Commune code-execution safety copy missing.");
assert(commune.includes("`/commons-circle/@${encodeURIComponent(username)}`"), "Commune author links should route to /commons-circle/@username.");
assert(!commune.includes("to={`/commons/@${encodeURIComponent(username)}`"), "Commune author links should not use the old /commons/@username path.");
for (const blocked of ["vault_access", "credential_access", "private_memory_access", "silent_shell_execution", "read_all_files", "write_arbitrary_files"]) {
  assert(forgeValidator.includes(blocked), `Developer Forge blocked permission missing: ${blocked}`);
}
for (const scannerTerm of ["SUPABASE_SERVICE_ROLE", "AWS_ACCESS_KEY_ID", "reserved_name", "broad_filesystem_claim", "dangerousShellPattern"]) {
  assert(forgeValidator.includes(scannerTerm), `Developer Forge scanner coverage missing: ${scannerTerm}`);
}
assert(forgeTemplates.includes("buildTemplatePackage"), "Developer Forge inert template package export missing.");
assert(forgeTemplates.includes("checksums.json"), "Developer Forge template package checksum manifest missing.");

const legalCombined = `${legalIndex}\n${legalPolicies}`;
for (const forbidden of ["elysiaecobotics.example", "Draft, not attorney-reviewed", "Contact placeholders", "[Replace placeholder", "DMCA Agent Name", "Mailing Address", "Phone Number"]) {
  assert(!legalCombined.includes(forbidden), `Public legal placeholder still visible: ${forbidden}`);
}
for (const email of ["hello@elysiaecobotics.com", "contact@elysiaecobotics.com", "support@elysiaecobotics.com", "privacy@elysiaecobotics.com", "security@elysiaecobotics.com", "abuse@elysiaecobotics.com", "legal@elysiaecobotics.com", "dmca@elysiaecobotics.com", "marketplace@elysiaecobotics.com", "stewardship@elysiaecobotics.com", "volunteer@elysiaecobotics.com"]) {
  assert(legalCombined.includes(email), `Role-based legal contact missing: ${email}`);
}
assert(archive.includes("No public installer exists yet"), "Archive must not imply a public installer exists.");
assert(archive.includes("unofficial mirror") || archive.includes("unofficial mirrors"), "Archive unofficial mirror warning missing.");
assert(archive.includes("Signatures") && archive.includes("after signing is actually in place"), "Archive signature honesty copy missing.");
assert(marketplaceHome.includes("Seed catalog fallback") || marketplaceHome.includes("local seed catalog"), "Marketplace seed/demo catalog clarity missing.");
assert(marketplaceCard.includes("Seed/example catalog"), "Marketplace cards must label seed/example catalog entries.");
assert(marketplaceCard.includes("Unsigned or unverified package"), "Marketplace cards must avoid fake signature claims.");
assert(marketplaceDetails.includes("Install intent blocked"), "Marketplace details must block install intent for revoked/unavailable listings.");
assert(marketplaceDetails.includes("This website does not install this add-on locally"), "Marketplace details local-install boundary copy missing.");
assert(sandboxHandoff.includes("private_reviewer_notes_included") && sandboxHandoff.includes("false"), "Sandbox handoff must explicitly exclude private reviewer notes.");

console.log("Site content smoke test ok.");
