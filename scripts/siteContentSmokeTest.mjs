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
const commonsApi = await read("src/pages/The-Commons-Circle/commonsCircleApi.ts");
const commonsSetup = await read("src/pages/The-Commons-Circle/CommonsCircleSetupPage.tsx");
const commonsAvatarViewer = await read("src/shared/components/CommonsAvatarViewer.tsx");
const commonsAdminConsole = await read("src/pages/The-Commons-Circle/CommonsCircleAdminConsolePage.tsx");
const publicProfileFieldsMigration = await read("supabase/migrations/2026_06_22_commons_public_profile_fields.sql");
const adminPage = await read("src/pages/Admin/index.tsx");
const reviewClient = await read("src/shared/review/reviewClient.ts");
const publicProfile = await read("src/pages/Public-Commons-Profile/index.tsx");
const commune = await read("src/pages/The-Elysia-Commune/index.tsx");
const forgeValidator = await read("src/pages/The-Developer-Forge/developerForgeValidator.ts");
const forgeTemplates = await read("src/pages/The-Developer-Forge/developerForgeTemplates.ts");
const legalIndex = await read("src/pages/Legal/index.tsx");
const legalPolicies = await read("src/pages/Legal/legalPolicyPages.ts");
const archive = await read("src/pages/The-Elysia-Archive/index.tsx");
const styles = await read("src/styles.css");
const pageHero = await read("src/shared/components/PageHero.tsx");
const pageBrandMark = await read("src/shared/components/PageBrandMark.tsx");
const homeMain = await read("src/pages/Elysia-Ecobotics-Online-MainPage/index.tsx");
const marketplaceHome = await read("src/pages/The-Elysia-Marketplace/pages/HomePage.tsx");
const marketplaceCard = await read("src/pages/The-Elysia-Marketplace/components/AddonCard.tsx");
const marketplaceDetails = await read("src/pages/The-Elysia-Marketplace/components/AddonDetails.tsx");
const productsPage = await read("src/pages/Elysia-Ecobotics-Products/index.tsx");
const labPage = await read("src/pages/The-Elysia-Ecobotics-Lab/index.tsx");
const forgePage = await read("src/pages/The-Developer-Forge/index.tsx");
const livingLibraryPage = await read("src/pages/The-Living-Library/index.tsx");
const workWithPage = await read("src/pages/Work-With-Elysia-Ecobotics/index.tsx");
const storyPage = await read("src/pages/The-Story-of-Elysia/index.tsx");
const aboutPage = await read("src/pages/About-Elysia-Ecobotics/index.tsx");
const missionPage = await read("src/pages/The-Elysia-Mission/index.tsx");
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
assert(pageBrandMark.includes("page-brand-mark__name") && pageBrandMark.includes("page-brand-mark__tm") && pageBrandMark.includes("<sup") && pageBrandMark.includes("TM"), "Page brand mark should render text plus a separate TM superscript element.");
assert(pageHero.includes("{brandMark && <PageBrandMark") && pageHero.includes('<h1 className="hero-title-brand-font">{title}</h1>'), "PageHero should keep the brand mark separate from the H1 title.");
for (const [label, source] of [
  ["Archive", archive],
  ["Products", productsPage],
  ["Lab", labPage],
  ["Developer Forge", forgePage],
  ["Living Library", livingLibraryPage],
  ["Commune", commune],
  ["Work With", workWithPage],
  ["Commons Circle", commons],
  ["Story", storyPage],
  ["About", aboutPage],
  ["Legal", legalIndex]
]) {
  assert(source.includes('brandMark="standard"'), `${label} should opt into the standard top-right Elysia Ecobotics page mark.`);
}
assert(homeMain.includes('variant="home-floating"'), "Homepage should use the floating hero brand mark placement.");
assert(marketplaceHome.includes("marketplace-hero-side") && marketplaceHome.includes('variant="marketplace-column"'), "Marketplace should place the page mark with the right-side status column.");
assert(missionPage.includes('brandMark="mission-centered"'), "Mission page should use the centered ceremonial brand mark placement.");
assert(styles.includes('font-family: "Cormorant Garamond"') && styles.includes("font-family: Verdana") && styles.includes(".page-brand-mark--standard") && styles.includes(".page-brand-mark--home-floating") && styles.includes(".page-brand-mark--marketplace-column") && styles.includes(".page-brand-mark--mission-centered"), "Page brand mark typography and placement styles missing.");
assert(productsPage.includes('title="Elysia Ecobotics Products"'), "Products page title should remain Elysia Ecobotics Products.");
assert(productsPage.includes("Physical products from Elysia Ecobotics will appear here only when they are ready, tested, repairable, and honestly documented"), "Products page should keep broad future physical-products boundary copy.");
assert(productsPage.includes("Environmental robotics") && productsPage.includes("sensing tools") && productsPage.includes("repairable") && productsPage.includes("field-support"), "Products page should use broad environmental robotics, sensing, repairable hardware, and field-support language.");
assert(footer.includes("The private local Elysia core remains local, governed, and user-controlled."), "Shared public/private Elysia boundary copy should remain available on public pages.");
const productsPublicCopy = `${productsPage}\n${homeMain}`.toLowerCase();
for (const blockedProductPhrase of [
  "ai-powered",
  "at-home",
  "gardening drone",
  "garden drone",
  "plant care",
  "watering awareness",
  "plant monitoring",
  "gentle reminders",
  "accessible garden care",
  "plant-care modules",
  "preorder",
  "preorders",
  "cart",
  "carts"
]) {
  assert(!productsPublicCopy.includes(blockedProductPhrase), `Products page public copy should not reveal specific product-pipeline language: ${blockedProductPhrase}`);
}
assert(app.includes("lazy(() => import"), "App routes are not lazy-loaded.");
assert(app.includes('path="commons-circle/admin-console"'), "Commons Circle admin console route missing.");
assert(app.includes('path="commons-circle/:publicHandle"'), "Commons Circle public profile route missing.");
assert(app.includes('path="commons/:publicHandle"'), "Legacy Commons public profile route missing.");
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
assert(reviewClient.includes('"moderated"') && reviewClient.includes("moderatedContentStates"), "Admin review queues should include a moderated recovery filter.");
assert(reviewClient.includes("enrichCommuneReviewItems") && reviewClient.includes("moderation_state") && reviewClient.includes("public_visibility"), "Commune review items should surface source moderation state separately from review status.");
assert(reviewClient.includes("restoreCommuneReviewSubject") && reviewClient.includes("restore_to_public"), "Commune review recovery should support restoring hidden/flagged content to public visibility.");
assert(reviewClient.includes("review_status_preserved: true"), "Commune restore should preserve the original review decision in history.");
assert(reviewClient.includes("recoverRejectedCommuneReviewSubject") && reviewClient.includes("commune_rejection_reopened") && reviewClient.includes("commune_rejected_approved_and_restored"), "Commune rejected recovery should support reopening review and approving/restoring rejected source content.");
assert(reviewClient.includes("original_rejection_preserved: true"), "Commune rejected recovery should preserve original rejection history.");
assert(reviewClient.includes('item.source_table === "commune_posts"'), "Commune review sync should target commune_posts.");
assert(reviewClient.includes('status: "published"') && reviewClient.includes('visibility: "public"'), "Commune approval should publish the underlying post.");
assert(reviewClient.includes("approved Commune post thread repair") && reviewClient.includes('post_id: item.source_id'), "Commune approval should repair missing discussion threads for approved posts.");
assert(reviewClient.includes('status: "archived"') && reviewClient.includes('visibility: "private_draft"'), "Commune archive should make the underlying post non-public.");
assert(reviewClient.includes('status: "removed_by_moderator"'), "Commune rejection should remove the underlying post from public workflow.");
assert(reviewClient.includes("grantCommuneThreadApproval"), "Approving Commune comments should grant thread participation approval.");
assert(adminPage.includes("Reject and remove this submitted item?"), "Admin rejected actions should require explicit confirmation.");
assert(adminPage.includes("Yes, reject/remove") && adminPage.includes("No, keep it"), "Admin rejection confirmation yes/no buttons missing.");
assert(adminPage.includes("Admin review history") && adminPage.includes("Archive is an admin-selected saved state"), "Admin review history/archive distinction missing.");
assert(adminPage.includes('{ value: "moderated", label: "Moderated" }'), "Admin Review should expose a Moderated recovery filter.");
assert(adminPage.includes("Moderated content recovery"), "Admin Review moderated recovery heading missing.");
assert(adminPage.includes("Review status and moderation state are separate"), "Admin Review should explain review status vs moderation state.");
assert(adminPage.includes("Restore to public") && adminPage.includes("Keep hidden"), "Admin Review recovery actions missing.");
assert(adminPage.includes("Rejected recovery is a review reconsideration workflow"), "Admin Review rejected recovery explanation missing.");
assert(adminPage.includes("Reopen review") && adminPage.includes("Approve and restore") && adminPage.includes("Keep rejected"), "Admin Review rejected recovery controls missing.");
assert(adminPage.includes("Source content not found; this rejected record is history only."), "Admin Review rejected history-only fallback missing.");
assert(adminPage.includes("Public visibility") && adminPage.includes("Moderation state") && adminPage.includes("Review status"), "Admin Review detail should surface review/moderation/public visibility state.");
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
assert(publicProfile.includes("publicUsernameFromHandle") && publicProfile.includes("publicHandle") && publicProfile.includes("Profile not found or not public"), "Public Commons profile should parse @handles and show a safe unavailable state.");
assert(commonsApi.includes("loadPublicCommonsProfile") && !commonsApi.match(/loadPublicCommonsProfile[\s\S]*?select\("[^"]*is_admin/), "Public profile loader should not select admin/private authority fields.");
assert(commonsApi.includes('select("id, username, display_name, bio, interests, website_url, github_url, avatar_url, commons_onboarding_completed_at")'), "Public profile loader should start from live-safe baseline profile fields.");
assert(commonsApi.includes("Public profile fields") && commonsApi.includes("organization, headline, featured_public_links"), "Public profile optional fields should load separately from the baseline profile row.");
assert(publicProfileFieldsMigration.includes("add column if not exists organization") && publicProfileFieldsMigration.includes("add column if not exists headline") && publicProfileFieldsMigration.includes("add column if not exists featured_public_links"), "Public profile field repair migration should add explicit public profile fields.");
assert(commons.includes("Shape your public profile room") && commonsSetup.includes("Organization, optional"), "Commons Circle should still expose public profile customization/editing paths.");
assert(commonsSetup.includes("Headline, optional") && commonsSetup.includes("Featured public links, optional"), "Commons Profile setup should include newly rendered public fields.");
assert(commonsSetup.includes("Choose profile picture") && commonsSetup.includes("Remove profile picture"), "Commons Profile setup should expose public avatar upload/remove controls.");
assert(commonsSetup.includes("This image is public") && commonsSetup.includes("does not import or sync a private local Elysia identity photo"), "Commons Profile setup should explain avatar public/local boundary.");
assert(commonsSetup.includes("logSetupDiagnostics") && !commonsSetup.includes("homebaseResult.warnings.forEach(pushMessage)"), "Commons Profile setup should not surface broad homebase diagnostics as setup warnings.");
assert(commonsSetup.includes("current.includes(trimmed)"), "Commons Profile setup messages should deduplicate repeated warnings while preserving order.");
assert(commonsApi.includes('"Profile customization": "Profile customization is not configured yet."') && commonsApi.includes('`${label} is not configured yet.`'), "Commons Circle friendly backend messages should avoid incorrect plural grammar.");
assert(commonsApi.includes("removeProfileMedia") && commonsApi.includes('status: "removed"'), "Commons Profile media removal helper missing.");
assert(commonsApi.includes("profile-avatars") && commonsApi.includes("image/png") && commonsApi.includes("image/webp"), "Commons Profile avatar upload should use the public avatar bucket and image MIME guard.");
assert(commonsApi.includes("avatar_media_id") && commonsApi.includes("profiles\").update({ avatar_url: publicUrl"), "Commons Profile avatar upload should keep active media and baseline public avatar URL in sync.");
assert(commonsApi.includes("avatar_url: null") && commonsApi.includes("avatar_media_id\" : \"banner_media_id\""), "Commons Profile avatar removal should clear public avatar URL and customization media pointer.");
assert(commons.includes("Remove profile picture") && commons.includes("Avatar and banner media update immediately when selected"), "Commons Circle customization should expose public avatar removal and boundary copy.");
assert(commons.includes("Unsaved preview. Press Save customization") && commons.includes("Saved customization is live on your public profile"), "Commons Circle customization should clearly distinguish unsaved preview from saved public profile styling.");
assert(commons.includes("Avatar and banner media update immediately when selected") && commons.includes("Decorative markers are public visual labels"), "Commons Circle customization should honestly distinguish immediate media uploads from limited decorative markers.");
assert(commons.includes("customizationClass(savedCustomization)") && commons.includes("customizationClass(customizationDraft)") && commons.includes("commons-customization-preview"), "Commons Circle live homebase should use saved customization while draft changes render in a bounded preview.");
assert(commons.includes("Revert preview") && commons.includes("setCustomizationDraft(savedCustomization)"), "Commons Circle customization should let users discard unsaved preview changes.");
assert(publicProfile.includes("CommonsAvatarViewer") && commons.includes("CommonsAvatarViewer") && commonsSetup.includes("CommonsAvatarViewer"), "Commons avatar viewer should be wired into public profile, homebase, and setup preview.");
assert(commonsAvatarViewer.includes('role="dialog"') && commonsAvatarViewer.includes('aria-modal="true"') && commonsAvatarViewer.includes("Escape") && commonsAvatarViewer.includes("commons-avatar-lightbox-image"), "Commons avatar viewer should provide a keyboard-closeable full-image lightbox.");
assert(publicProfile.includes("safeAccentColor") && publicProfile.includes("--commons-accent"), "Public Commons profile should sanitize and apply the saved accent color.");
assert(publicProfile.includes("data-commons-theme") && publicProfile.includes("data-commons-background") && publicProfile.includes("data-commons-layout"), "Public Commons profile should expose saved theme/background/layout presentation markers.");
assert(publicProfile.includes("commons-public-banner") && publicProfile.includes("customization.banner_url"), "Public Commons profile should render an uploaded public banner when active.");
assert(publicProfile.includes("commons-public-profile-mantle") && publicProfile.includes("commons-public-room-hero"), "Public Commons profile should render saved customization in the main public room hero.");
assert(publicProfile.includes("commons-customization-badges"), "Public Commons profile should visibly summarize selected presentation settings.");
assert(commonsApi.includes("Public customization") && commonsApi.includes("Public profile media") && commonsApi.includes('eq("status", "active")'), "Public profile loader should load safe customization and active public media only.");
assert(styles.includes(".commons-public-banner") && styles.includes("object-fit: cover"), "Public Commons profile banner styling should render active banners safely.");
assert(styles.includes(".commons-public-profile.commons-layout-compact_archive") && styles.includes(".commons-public-profile.commons-layout-garden_shelves"), "Public Commons profile layout choices should visibly affect the rendered profile.");
assert(styles.includes(".commons-public-profile.commons-theme-high_contrast") && styles.includes(".commons-public-profile.commons-background-soft_cyber_garden"), "Public Commons profile should visibly apply saved theme and background variants.");
assert(styles.includes(".commons-customization-preview") && styles.includes(".commons-customization-preview .commons-profile-mantle"), "Commons Circle customization should style a bounded draft preview rather than restyling the whole live homebase.");
assert(styles.includes(".commons-customization-badges"), "Public Commons profile should style visible customization markers.");
assert(publicProfile.includes("This is a public Commons Circle profile. It does not expose private account email") && publicProfile.includes("Public Commune contributions"), "Public profile should include privacy boundary copy and real public contribution rendering.");
assert(!publicProfile.includes("publicSavedSources") && !commonsApi.includes("Public saved sources"), "Public profiles must not expose private saved Living Library shelves.");
assert(!publicProfile.includes("Developer status") && !publicProfile.includes("online status") && !publicProfile.includes("followers") && !publicProfile.includes("clout"), "Public profile should not render status/clout/follower mechanics.");
assert(!publicProfile.includes("auth.email") && !publicProfile.includes("contact_email") && !publicProfile.includes("review_items") && !publicProfile.includes("work_with_requests"), "Public profile page should not query private email or request data.");
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
