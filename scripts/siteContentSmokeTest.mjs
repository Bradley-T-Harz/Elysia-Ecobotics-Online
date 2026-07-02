import fs from "node:fs/promises";

async function read(file) {
  return fs.readFile(new URL(`../${file}`, import.meta.url), "utf8");
}

async function exists(file) {
  try {
    await fs.access(new URL(`../${file}`, import.meta.url));
    return true;
  } catch {
    return false;
  }
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
const commonsBannerFramingMigration = await read("supabase/migrations/2026_07_02_commons_banner_framing.sql");
const supabaseSchema = await read("supabase/schema.sql");
const adminPage = await read("src/pages/Admin/index.tsx");
const reviewClient = await read("src/shared/review/reviewClient.ts");
const publicProfile = await read("src/pages/Public-Commons-Profile/index.tsx");
const commune = await read("src/pages/The-Elysia-Commune/index.tsx");
const forgeValidator = await read("src/pages/The-Developer-Forge/developerForgeValidator.ts");
const forgeTemplates = await read("src/pages/The-Developer-Forge/developerForgeTemplates.ts");
const forgeApi = await read("src/pages/The-Developer-Forge/developerForgeApi.ts");
const forgeWorkbench = await read("src/pages/The-Developer-Forge/ForgeWorkbench.tsx");
const adminModerationClient = await read("src/shared/review/adminModerationClient.ts");
const forgeSnapshotMigration = await read("supabase/migrations/2026_06_27_developer_forge_submission_snapshots.sql");
const forgeSubmissionDocs = await read("docs/developer-forge/submission-review-process.md");
const forgeWorkbenchDocs = await read("docs/developer-forge/workbench.md");
const legalIndex = await read("src/pages/Legal/index.tsx");
const legalPolicies = await read("src/pages/Legal/legalPolicyPages.ts");
const archive = await read("src/pages/The-Elysia-Archive/index.tsx");
const styles = await read("src/styles.css");
const commonsBackgroundCatalog = await read("src/shared/commonsBackgroundStyles.ts");
const commonsBackgroundAtmosphere = await read("src/shared/components/CommonsBackgroundAtmosphere.tsx");
const commonsBackgroundCss = await read("src/styles/commonsBackgrounds.css");
const commonsProfileLayoutCatalog = await read("src/shared/commonsProfileLayouts.ts");
const commonsProfileLayoutFrame = await read("src/shared/components/CommonsProfileLayoutFrame.tsx");
const commonsProfileLayoutCss = await read("src/styles/commonsProfileLayouts.css");
const commonsThemeModes = await read("src/shared/commonsThemeModes.ts");
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
assert(styles.includes('@import "./styles/commonsBackgrounds.css";'), "Global styles should import Commons background atmosphere styles.");
const commonsBackgroundOptions = [
  ["soft_cyber_garden", "Soft Cyber Garden", "commons-background--soft-cyber-garden", "src/assets/commons/backgrounds/soft-cyber-garden-overlay.svg"],
  ["starfield_mantle", "Starfield Mantle", "commons-background--starfield-mantle", ""],
  ["living_archive", "Living Archive", "commons-background--living-archive", "src/assets/commons/backgrounds/living-archive-overlay.svg"],
  ["clear_lantern", "Clear Lantern", "commons-background--clear-lantern", ""],
  ["mycelium_glow", "Mycelium Glow", "commons-background--mycelium-glow", "src/assets/commons/backgrounds/mycelium-glow-overlay.svg"],
  ["watershed_mist", "Watershed Mist", "commons-background--watershed-mist", "src/assets/commons/backgrounds/watershed-mist-overlay.svg"],
  ["aurora_canopy", "Aurora Canopy", "commons-background--aurora-canopy", "src/assets/commons/backgrounds/aurora-canopy-overlay.png"],
  ["solar_restoration", "Solar Restoration", "commons-background--solar-restoration", "src/assets/commons/backgrounds/solar-restoration-overlay.svg"],
  ["obsidian_laboratory", "Obsidian Laboratory", "commons-background--obsidian-laboratory", ""],
  ["field_notebook", "Field Notebook", "commons-background--field-notebook", "src/assets/commons/backgrounds/field-notebook-contours.svg"]
];
for (const [key, label, className, assetPath] of commonsBackgroundOptions) {
  assert(commonsBackgroundCatalog.includes(`"${key}"`), `Commons background catalog missing key: ${key}`);
  assert(commonsBackgroundCatalog.includes(`label: "${label}"`), `Commons background catalog missing display label: ${label}`);
  assert(commonsBackgroundCatalog.includes(`className: "${className}"`), `Commons background catalog missing class for ${key}.`);
  assert(commonsBackgroundCss.includes(`.${className}`), `Commons background CSS missing style class: ${className}`);
  if (assetPath) assert(await exists(assetPath), `Commons background asset missing: ${assetPath}`);
}
assert(commonsBackgroundCatalog.includes('DEFAULT_COMMONS_BACKGROUND_STYLE') && commonsBackgroundCatalog.includes('"soft_cyber_garden"') && commonsBackgroundCatalog.includes("normalizeCommonsBackgroundStyle"), "Commons background catalog should normalize invalid values to Soft Cyber Garden.");
assert(!commonsBackgroundCatalog.includes("profile_layout") && !commonsBackgroundCatalog.includes("decal_set"), "Commons background catalog must stay scoped to Background style, not layouts or decorative markers.");
assert(commonsBackgroundAtmosphere.includes("commons-atmosphere__base") && commonsBackgroundAtmosphere.includes("commons-atmosphere__texture") && commonsBackgroundAtmosphere.includes("commons-atmosphere__motif") && commonsBackgroundAtmosphere.includes("commons-atmosphere__glow") && commonsBackgroundAtmosphere.includes("data-commons-background-style"), "Commons background atmosphere component should render layered decorative background elements.");
assert(commonsBackgroundCss.includes("aurora-canopy-overlay.png"), "Aurora Canopy should use the repo-local generated PNG overlay.");
assert(!/url\(\s*["']?https?:\/\//i.test(commonsBackgroundCss), "Commons background CSS must not use remote background assets.");
for (const visibilityClass of ["commons-public-atmosphere-stage", "commons-public-atmosphere-rail", "commons-public-atmosphere-reveal", "commons-public-section", "commons-public-section--compact", "commons-public-section--empty", "commons-public-card-glass", "commons-public-card-grid"]) {
  assert(commonsBackgroundCss.includes(`.${visibilityClass}`), `Commons background visibility CSS missing: ${visibilityClass}`);
}
const commonsProfileLayoutOptions = [
  ["classic_homebase", "Classic Homebase", "commons-profile-layout--classic-homebase"],
  ["compact_archive", "Compact Archive", "commons-profile-layout--compact-archive"],
  ["garden_shelves", "Garden Shelves", "commons-profile-layout--garden-shelves"],
  ["field_notebook_layout", "Field Notebook", "commons-profile-layout--field-notebook"],
  ["constellation_map", "Constellation Map", "commons-profile-layout--constellation-map"],
  ["stewardship_board", "Stewardship Board", "commons-profile-layout--stewardship-board"]
];
for (const [key, label, className] of commonsProfileLayoutOptions) {
  assert(commonsProfileLayoutCatalog.includes(`"${key}"`), `Commons profile layout catalog missing key: ${key}`);
  assert(commonsProfileLayoutCatalog.includes(`label: "${label}"`), `Commons profile layout catalog missing display label: ${label}`);
  assert(commonsProfileLayoutCatalog.includes(`className: "${className}"`), `Commons profile layout catalog missing class for ${key}.`);
  assert(commonsProfileLayoutCss.includes(`.${className}`), `Commons profile layout CSS missing style class: ${className}`);
}
assert(commonsProfileLayoutCatalog.includes("DEFAULT_COMMONS_PROFILE_LAYOUT") && commonsProfileLayoutCatalog.includes('"classic_homebase"') && commonsProfileLayoutCatalog.includes("normalizeCommonsProfileLayout"), "Commons profile layout catalog should normalize invalid values to Classic Homebase.");
assert(!commonsProfileLayoutCatalog.includes("background_style") && !commonsProfileLayoutCatalog.includes("decal_set"), "Commons profile layout catalog must stay scoped to Profile layout, not Background style or decorative markers.");
assert(commonsProfileLayoutFrame.includes("data-commons-profile-layout") && commonsProfileLayoutFrame.includes("`commons-profile-layout--${variant}`") && commonsProfileLayoutFrame.includes('variant = "public"'), "Commons profile layout frame should render public/preview variants and normalized layout metadata.");
assert(styles.includes('@import "./styles/commonsProfileLayouts.css";'), "Global styles should import Commons profile layout styles.");
const commonsThemeModeOptions = [
  ["deep_grove", "Deep Grove"],
  ["starlit_archive", "Starlit Archive"],
  ["solar_meadow", "Solar Meadow"],
  ["moonlit_reef", "Moonlit Reef"],
  ["aether_blue", "Aether Blue"],
  ["high_contrast", "High Contrast"]
];
for (const [key, label] of commonsThemeModeOptions) {
  assert(commonsThemeModes.includes(`"${key}"`), `Commons theme mode catalog missing key: ${key}`);
  assert(commonsThemeModes.includes(`label: "${label}"`), `Commons theme mode catalog missing readable label: ${label}`);
  assert(commonsProfileLayoutCss.includes(`commons-theme-${key}`), `Commons theme mode CSS missing class: commons-theme-${key}`);
}
assert(commonsThemeModes.includes("DEFAULT_COMMONS_THEME_MODE") && commonsThemeModes.includes('"deep_grove"') && commonsThemeModes.includes("normalizeCommonsThemeMode"), "Commons theme mode catalog should normalize invalid values to Deep Grove.");
assert(commons.includes("COMMONS_THEME_MODES.map") && commons.includes("theme.label") && commons.includes("normalizeCommonsThemeMode(customizationDraft.theme_mode)"), "Commons Circle Theme mode dropdown should use shared readable labels and normalized values.");
assert(!commons.includes("themeModes.map") && !commons.includes(">{theme}</option>"), "Commons Circle Theme mode dropdown should not render raw theme keys as option labels.");
assert(publicProfile.includes("getCommonsThemeModeOption(themeMode).label") && commons.includes("getCommonsThemeModeOption(customizationDraft.theme_mode).label"), "Public and preview theme chips should use readable theme mode labels.");
for (const mastheadClass of ["commons-profile-masthead", "commons-profile-masthead--classic-homebase", "commons-profile-masthead__banner", "commons-profile-masthead__identity", "commons-profile-masthead__avatar", "commons-profile-masthead__avatar-image", "commons-profile-masthead__edit", "commons-avatar--masthead"]) {
  assert(publicProfile.includes(mastheadClass) || commons.includes(mastheadClass), `Commons profile masthead hook missing: ${mastheadClass}`);
}
assert(commonsProfileLayoutCss.includes(".commons-profile-layout--public.commons-profile-layout--classic-homebase .commons-profile-masthead--classic-homebase") && commonsProfileLayoutCss.includes("1360px"), "Classic Homebase public masthead should use a Classic-only wider masthead modifier.");
assert(!commonsProfileLayoutCss.includes("width: min(100%, 1120px)") && !styles.includes("commons-layout-classic_homebase .commons-public-room-hero {\n  max-width: 1120px;"), "Classic Homebase masthead should not keep the old 1120px cap.");
for (const slotClass of ["commons-profile-slot--summary", "commons-profile-slot--identity", "commons-profile-slot--recognition", "commons-profile-slot--badges", "commons-profile-slot--collections", "commons-profile-slot--contributions"]) {
  assert(publicProfile.includes(slotClass), `Public Commons profile missing semantic layout slot: ${slotClass}`);
  assert(commonsProfileLayoutCss.includes(`.${slotClass}`), `Commons profile layout CSS missing semantic slot style: ${slotClass}`);
}
for (const cardClass of ["commons-profile-summary-card", "commons-profile-summary-card__avatar", "commons-profile-summary-card__body", "commons-profile-summary-card__handle", "commons-profile-summary-card__name", "commons-profile-summary-card__chips", "commons-profile-summary-card__edit", "commons-public-section-card", "commons-public-section-card--empty", "commons-public-section-card__eyebrow", "commons-public-identity-card", "commons-public-link-list", "commons-public-authority-note", "commons-public-recognition-card", "commons-public-badges-card", "commons-public-badge-list", "commons-public-badge-card", "commons-public-badge-tags", "commons-public-collections-card", "commons-public-collection-list", "commons-public-contributions-card", "commons-public-contribution-grid", "commons-public-contribution-card", "commons-public-contribution-card__type"]) {
  assert(publicProfile.includes(cardClass) || commons.includes(cardClass), `Commons profile layout missing stable class hook: ${cardClass}`);
}
assert(publicProfile.includes("CommonsProfileLayoutFrame") && publicProfile.includes('variant="public"') && publicProfile.includes("profileLayout={profileLayout}"), "Public Commons profile should use one shared layout frame for all profile layouts.");
assert(commons.includes("COMMONS_PROFILE_LAYOUTS.map") && commons.includes("layout.label") && commons.includes("normalizeCommonsProfileLayout(customizationDraft.profile_layout)"), "Commons Circle Profile layout dropdown should use shared labels and normalized values.");
assert(commons.includes("CommonsProfileLayoutFrame") && commons.includes('variant="preview"') && commons.includes("getCommonsProfileLayoutOption(customizationDraft.profile_layout).label"), "Commons Circle customization preview should use the shared profile layout frame and readable layout labels.");
assert(!commonsBackgroundCatalog.includes("field_notebook_layout") && !commonsBackgroundCatalog.includes("constellation_map") && !commonsBackgroundCatalog.includes("stewardship_board"), "Profile layout keys should not drift into the Background style catalog.");
assert(!commonsProfileLayoutCatalog.includes("soft_cyber_garden") && !commonsProfileLayoutCatalog.includes("selected_decals"), "Background/decorative marker keys should not drift into the Profile layout catalog.");
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
assert(commonsApi.includes("profile-avatars") && commonsApi.includes("profile-banners") && commonsApi.includes("image/png") && commonsApi.includes("image/webp"), "Commons Profile media upload should use the public avatar/banner buckets and image MIME guard.");
assert(commonsApi.includes("safeFileSuffix") && commonsApi.includes("safeStorageObjectId") && commonsApi.includes('const folder = mediaType === "avatar" ? "avatars" : "banners"'), "Commons Profile media uploads should sanitize filenames and use generated storage object paths.");
assert(commonsApi.includes("avatar_media_id") && commonsApi.includes("profiles\").update({ avatar_url: publicUrl"), "Commons Profile avatar upload should keep active media and baseline public avatar URL in sync.");
assert(commonsApi.includes("banner_media_id") && commonsApi.includes("mediaId") && commonsApi.includes("profile_media"), "Commons Profile banner upload should persist an active media row and customization pointer.");
assert(commonsApi.includes("avatar_url: null") && commonsApi.includes("avatar_media_id\" : \"banner_media_id\""), "Commons Profile avatar removal should clear public avatar URL and customization media pointer.");
assert(commons.includes("Remove profile picture") && commons.includes("Remove banner") && commons.includes("Avatar and banner media update immediately when selected"), "Commons Circle customization should expose public avatar/banner removal and boundary copy.");
assert(commons.includes("mediaStatus") && commons.includes("Uploading") && commons.includes("aria-live=\"polite\""), "Commons Circle customization should show immediate avatar/banner upload status without relying on Save customization.");
assert(commons.includes("Unsaved preview. Press Save customization") && commons.includes("Saved customization is live on your public profile"), "Commons Circle customization should clearly distinguish unsaved preview from saved public profile styling.");
assert(commonsBannerFramingMigration.includes("banner_zoom numeric not null default 1") && commonsBannerFramingMigration.includes("banner_position_x numeric not null default 50") && commonsBannerFramingMigration.includes("banner_position_y numeric not null default 50"), "Commons banner framing migration should add zoom and x/y position defaults.");
assert(commonsBannerFramingMigration.includes("profile_customization_banner_zoom_range") && commonsBannerFramingMigration.includes("banner_zoom >= 0.5 and banner_zoom <= 2.0") && commonsBannerFramingMigration.includes("banner_position_x >= 0 and banner_position_x <= 100") && commonsBannerFramingMigration.includes("banner_position_y >= 0 and banner_position_y <= 100"), "Commons banner framing migration should constrain zoom and x/y ranges.");
assert(supabaseSchema.includes("banner_zoom numeric not null default 1") && supabaseSchema.includes("banner_position_x numeric not null default 50") && supabaseSchema.includes("banner_position_y numeric not null default 50"), "Supabase schema snapshot should include Commons banner framing fields.");
assert(commonsApi.includes("DEFAULT_COMMONS_BANNER_ZOOM") && commonsApi.includes("DEFAULT_COMMONS_BANNER_POSITION_X") && commonsApi.includes("DEFAULT_COMMONS_BANNER_POSITION_Y") && commonsApi.includes("normalizeCommonsBannerZoom") && commonsApi.includes("normalizeCommonsBannerPosition"), "Commons Circle API should define banner framing defaults and normalizers.");
assert(commonsApi.includes("clampNumber") && commonsApi.includes("COMMONS_BANNER_ZOOM_MIN") && commonsApi.includes("COMMONS_BANNER_ZOOM_MAX") && commonsApi.includes("COMMONS_BANNER_POSITION_MIN") && commonsApi.includes("COMMONS_BANNER_POSITION_MAX"), "Commons Circle API should clamp banner framing values.");
assert(commonsApi.includes("banner_zoom: normalizeCommonsBannerZoom") && commonsApi.includes("banner_position_x: normalizeCommonsBannerPosition") && commonsApi.includes("banner_position_y: normalizeCommonsBannerPosition"), "Commons Circle API should normalize and save banner framing fields.");
assert(commons.includes("Banner framing") && commons.includes("Banner zoom") && commons.includes("Horizontal position") && commons.includes("Vertical position") && commons.includes("Reset banner framing"), "Commons Circle customization should expose Banner framing controls.");
assert(commons.includes("styleSignature") && commons.includes("banner_zoom: normalizeCommonsBannerZoom(settings.banner_zoom)") && commons.includes("banner_position_x: normalizeCommonsBannerPosition(settings.banner_position_x)") && commons.includes("banner_position_y: normalizeCommonsBannerPosition(settings.banner_position_y)"), "Commons Circle unsaved customization detection should include banner framing values.");
assert(commons.includes("bannerFramingStyle(customizationDraft)") && commons.includes("--commons-banner-zoom") && commons.includes("--commons-banner-position-x") && commons.includes("--commons-banner-position-y"), "Commons Circle preview should apply draft banner framing CSS variables.");
assert(publicProfile.includes("bannerFramingStyle(customization)") && publicProfile.includes("normalizeCommonsBannerZoom(settings.banner_zoom)") && publicProfile.includes("normalizeCommonsBannerPosition(settings.banner_position_x)") && publicProfile.includes("normalizeCommonsBannerPosition(settings.banner_position_y)"), "Public Commons profile should apply saved banner framing CSS variables.");
assert(commons.includes("Avatar and banner media update immediately when selected") && commons.includes("Decorative markers are public visual labels"), "Commons Circle customization should honestly distinguish immediate media uploads from limited decorative markers.");
assert(commons.includes("customizationSkinClass(savedCustomization)") && commons.includes("customizationClass(customizationDraft)") && commons.includes("commons-customization-preview"), "Commons Circle live homebase should use saved skin customization while draft changes render in a bounded layout preview.");
assert(commons.includes("commons-private-homebase") && commons.includes("commons-private-homebase__mantle") && commons.includes("commons-private-homebase__banner-image"), "Commons Circle private homebase should expose a stable private-only namespace.");
assert(commons.includes("savedCustomization.banner_url") && commons.includes("savedCustomization.avatar_url"), "Commons Circle private homebase should render saved banner/avatar media, not draft preview media.");
assert(commons.includes("commons-circle-private-homebase-mantle") && commons.includes("commons-circle-private-banner-image"), "Commons Circle private homebase should preserve private-only banner fit hooks.");
assert(commons.includes("commons-circle-customization-preview-mantle") && commons.includes("commons-circle-customization-preview-banner-image"), "Commons Circle customization preview should expose private-only banner fit hooks.");
assert(styles.includes(".commons-private-homebase__mantle .commons-private-homebase__banner-image") && styles.includes(".commons-circle-customization-preview-mantle .commons-circle-customization-preview-banner-image"), "Commons Circle private banner fit CSS should stay rooted in private-only class hooks.");
assert(styles.includes(".commons-customization-preview .commons-profile-layout--preview .commons-circle-customization-preview-mantle .commons-circle-customization-preview-banner-image"), "Commons Circle preview banner translation should have a preview-only cascade lock.");
assert(styles.includes(".commons-private-homebase__mantle .commons-private-homebase__banner-image") && styles.includes("transform: translate(-50%, -50%)") && commonsProfileLayoutCss.includes(".commons-profile-layout--preview .commons-circle-customization-preview-mantle .commons-circle-customization-preview-banner-image") && commonsProfileLayoutCss.includes(".commons-profile-layout--public.commons-profile-layout--classic-homebase .commons-profile-masthead--classic-homebase .commons-profile-masthead__banner-image"), "Banner translation should use surface-specific height-first rules for private homebase, preview, and public Classic mastheads.");
assert(styles.includes("top: var(--commons-banner-position-y, 50%)") && styles.includes("left: var(--commons-banner-position-x, 50%)") && styles.includes("height: calc(100% * var(--commons-banner-zoom, 1))"), "Commons Circle preview banner translation should consume banner framing CSS variables.");
assert(commonsProfileLayoutCss.includes(".commons-profile-layout--public .commons-public-profile-mantle .commons-profile-masthead__banner-image") && commonsProfileLayoutCss.includes("top: var(--commons-banner-position-y, 50%)") && commonsProfileLayoutCss.includes("left: var(--commons-banner-position-x, 50%)") && commonsProfileLayoutCss.includes("height: calc(100% * var(--commons-banner-zoom, 1))"), "Public Commons profile banner translation should consume saved banner framing CSS variables.");
const fieldNotebookPublicBannerRule = /\.commons-profile-layout--public\.commons-profile-layout--field-notebook\s+\.commons-public-profile-mantle\s+\.commons-profile-masthead__banner-image\s*\{(?=[^}]*top:\s*var\(--commons-banner-position-y,\s*50%\))(?=[^}]*left:\s*var\(--commons-banner-position-x,\s*50%\))(?=[^}]*height:\s*calc\(100%\s*\*\s*var\(--commons-banner-zoom,\s*1\)\))(?=[^}]*width:\s*auto)(?=[^}]*max-width:\s*none)(?=[^}]*transform:\s*translate\(-50%, -50%\))(?=[^}]*object-fit:\s*contain)/s;
assert(fieldNotebookPublicBannerRule.test(commonsProfileLayoutCss), "Field Notebook public banner should use a public-only variable-driven height-first banner translation rule.");
const globalPublicBannerRule = styles.match(/\.commons-public-banner\s*\{[^}]*\}/s)?.[0] ?? "";
assert(!globalPublicBannerRule.includes("--commons-banner") && !globalPublicBannerRule.includes("var(--commons-banner"), "Banner framing must not tune the global .commons-public-banner selector.");
assert(!styles.includes("object-fit: fill") && !commonsProfileLayoutCss.includes("object-fit: fill"), "Banner translation must not distort uploaded banner art with object-fit: fill.");
assert(!publicProfile.includes("commons-private-homebase") && !publicProfile.includes("commons-circle-private-homebase-mantle") && !publicProfile.includes("commons-circle-customization-preview-mantle"), "Public Commons profile must not reference private Commons Circle banner fit hooks.");
const brokenPrivateBannerHelper = "Commons" + "PrivateBannerArt";
const brokenPrivateBannerClass = "commons-private" + "-banner-art";
const leakingHomebaseMantleSelector = new RegExp(`\\.${"commons-homebase" + "-hero"}\\s+\\.${"commons-profile" + "-mantle"}\\s*>\\s*:${"not"}`);
const broadMantleChildSelector = "." + "commons-profile-mantle > :" + "not";
assert(!commons.includes(brokenPrivateBannerHelper) && !styles.includes(brokenPrivateBannerClass) && !publicProfile.includes(brokenPrivateBannerClass), "Broken private two-layer banner helper/classes must not be reintroduced.");
assert(!leakingHomebaseMantleSelector.test(styles), "Commons Circle private banner fixes must not use the leaking homebase/mantle descendant selector.");
assert(!styles.includes(broadMantleChildSelector), "Commons mantle stacking should not rely on a broad shared child selector.");
assert(commons.includes("COMMONS_BACKGROUND_STYLES.map") && commons.includes("style.label") && commons.includes("normalizeCommonsBackgroundStyle(customizationDraft.background_style)"), "Commons Circle Background style dropdown should use shared labels and normalized values.");
assert(commons.includes("CommonsBackgroundAtmosphere") && commons.includes('variant="preview"') && commons.includes("getCommonsBackgroundStyleOption(customizationDraft.background_style).label"), "Commons Circle customization preview should use the shared atmosphere component and readable background labels.");
assert(commons.includes("Revert preview") && commons.includes("setCustomizationDraft(savedCustomization)"), "Commons Circle customization should let users discard unsaved preview changes.");
assert(publicProfile.includes("CommonsAvatarViewer") && commons.includes("CommonsAvatarViewer") && commonsSetup.includes("CommonsAvatarViewer"), "Commons avatar viewer should be wired into public profile, homebase, and setup preview.");
assert(commonsAvatarViewer.includes('role="dialog"') && commonsAvatarViewer.includes('aria-modal="true"') && commonsAvatarViewer.includes("Escape") && commonsAvatarViewer.includes("commons-avatar-lightbox-image"), "Commons avatar viewer should provide a keyboard-closeable full-image lightbox.");
assert(publicProfile.includes("safeAccentColor") && publicProfile.includes("--commons-accent"), "Public Commons profile should sanitize and apply the saved accent color.");
assert(publicProfile.includes("data-commons-theme") && publicProfile.includes("data-commons-background") && publicProfile.includes("data-commons-layout"), "Public Commons profile should expose saved theme/background/layout presentation markers.");
assert(publicProfile.includes("CommonsBackgroundAtmosphere") && publicProfile.includes('variant="public"') && publicProfile.includes("normalizeCommonsBackgroundStyle(customization.background_style)") && publicProfile.includes("getCommonsBackgroundStyleOption(backgroundStyle).label"), "Public Commons profile should use the shared background atmosphere and readable background labels.");
assert(publicProfile.includes("commons-public-atmosphere-stage") && publicProfile.includes("commons-public-atmosphere-reveal") && publicProfile.includes("commons-public-card-glass") && publicProfile.includes("commons-public-section--empty"), "Public Commons profile should expose stage/reveal/glass/compact classes so Background styles remain visible.");
assert(publicProfile.includes("commons-public-banner") && publicProfile.includes("commons-profile-banner-layer") && publicProfile.includes("customization.banner_url"), "Public Commons profile should render an uploaded public banner image layer when active.");
assert(publicProfile.includes("commons-public-profile-mantle") && publicProfile.includes("commons-public-room-hero"), "Public Commons profile should render saved customization in the main public room hero.");
assert(publicProfile.includes("commons-customization-badges"), "Public Commons profile should visibly summarize selected presentation settings.");
assert(commonsApi.includes("Public customization") && commonsApi.includes("Public profile media") && commonsApi.includes('eq("status", "active")'), "Public profile loader should load safe customization and active public media only.");
assert(commonsApi.includes("DEFAULT_COMMONS_BACKGROUND_STYLE") && commonsApi.includes("normalizeCommonsBackgroundStyle(merged.background_style)") && commonsApi.includes("background_style: normalized.background_style"), "Commons Circle API should save/load normalized Background style values.");
assert(commonsApi.includes("DEFAULT_COMMONS_PROFILE_LAYOUT") && commonsApi.includes("normalizeCommonsProfileLayout(merged.profile_layout)") && commonsApi.includes("profile_layout: normalized.profile_layout"), "Commons Circle API should save/load normalized Profile layout values.");
assert(styles.includes(".commons-public-banner") && styles.includes(".commons-profile-banner-layer") && styles.includes("object-fit: cover"), "Public Commons profile banner styling should render active banners safely.");
assert(commonsProfileLayoutCss.includes("--commons-theme-surface") && commonsProfileLayoutCss.includes("--commons-theme-chip-bg") && commonsProfileLayoutCss.includes("--commons-theme-avatar-bg"), "Theme mode should skin profile UI surfaces, chips, and avatar placeholders.");
assert(!styles.includes(".commons-homebase.commons-theme-deep_grove .commons-profile-mantle") && !styles.includes(".commons-homebase.commons-theme-starlit_archive .commons-profile-mantle"), "Theme mode should not paint the banner/mantle as a fake banner substitute.");
assert(styles.includes(".commons-public-profile.commons-layout-compact_archive") && styles.includes(".commons-public-profile.commons-layout-garden_shelves") && commonsProfileLayoutCss.includes(".commons-profile-layout--stewardship-board"), "Public Commons profile layout choices should visibly affect the rendered profile.");
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
assert(forgeValidator.includes("Ajv") && forgeValidator.includes("addFormats") && forgeValidator.includes("semver.valid"), "Developer Forge manifest validation should use Ajv, format checks, and semver validation.");
assert(forgeValidator.includes('"blocked"') && forgeValidator.includes('"needs_reviewer"'), "Developer Forge validation should classify blocked and reviewer-needed findings.");
assert(forgeWorkbench.includes("@monaco-editor/react") && forgeWorkbench.includes("react-markdown") && forgeWorkbench.includes("remark-gfm") && forgeWorkbench.includes("rehype-sanitize"), "Developer Forge workbench should wire Monaco and sanitized Markdown preview.");
assert(forgeWorkbench.includes("prettier/standalone") && forgeWorkbench.includes("cmdk") && forgeWorkbench.includes("ForgeCommandPalette"), "Developer Forge workbench should wire Prettier formatting and a safe command palette.");
assert(!forgeWorkbench.includes("npm install") && !forgeWorkbench.includes("run-shell") && !forgeWorkbench.includes("raw shell"), "Developer Forge command palette must not expose package install or shell actions.");
assert(forgePage.includes("ForgeWorkbenchSurface") && forgePage.includes("Submit immutable snapshot for review") && forgePage.includes("Duplicate draft for revision"), "Developer Forge page should expose the workbench, immutable submission, and revision draft flow.");
assert(forgePage.includes("This is not a terminal") && forgePage.includes("does not execute package code"), "Developer Forge workbench copy should preserve the no-terminal/no-execution boundary.");
assert(forgeApi.includes("addon_submission_snapshots") && forgeApi.includes("createSubmissionSnapshot") && forgeApi.includes("isDraftLockedForEditing"), "Developer Forge API should create immutable snapshots and recognize locked drafts.");
assert(forgeApi.includes("locked_at") && forgeApi.includes("locked_reason") && forgeApi.includes("submitted_for_marketplace_review"), "Developer Forge API should lock submitted drafts with an explicit reason.");
assert(adminModerationClient.includes("addon_submission_snapshots") && adminModerationClient.includes("manifest_snapshot") && adminModerationClient.includes("marketplace_preview_snapshot"), "Admin Marketplace publishing should read immutable Developer Forge snapshots.");
assert(adminPage.includes("Immutable review snapshot") && adminPage.includes("Private package inspection") && adminPage.includes("legacy submission from before the snapshot migration"), "Admin add-on review should surface immutable snapshot/package facts and migration fallback copy.");
assert(forgeSnapshotMigration.includes("create table if not exists public.addon_submission_snapshots"), "Developer Forge snapshot migration table missing.");
for (const snapshotField of ["manifest_snapshot", "permissions_snapshot", "package_snapshot", "validation_snapshot", "scan_snapshot", "marketplace_preview_snapshot", "signature_status"]) {
  assert(forgeSnapshotMigration.includes(snapshotField), `Developer Forge snapshot migration missing ${snapshotField}.`);
}
assert(forgeSnapshotMigration.includes("enable row level security") && forgeSnapshotMigration.includes("developers read own addon submission snapshots") && forgeSnapshotMigration.includes("marketplace reviewers manage addon submission snapshots"), "Developer Forge snapshot migration should include RLS policies.");
assert(forgeSnapshotMigration.includes("prevent_locked_addon_draft_owner_mutation") && forgeSnapshotMigration.includes("prevent_locked_addon_draft_child_mutation"), "Developer Forge snapshot migration should prevent silent owner mutation of submitted draft evidence.");
assert(forgeSubmissionDocs.includes("immutable review snapshot") && forgeWorkbenchDocs.includes("Monaco") && forgeWorkbenchDocs.includes("sanitized") && forgeWorkbenchDocs.includes("must not run package code"), "Developer Forge docs should describe the workbench, snapshots, and no-execution boundary.");
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
