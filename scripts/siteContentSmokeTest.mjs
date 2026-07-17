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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cssRuleIncludes(css, selector, requiredParts) {
  const match = css.match(new RegExp(`${escapeRegExp(selector)}\\s*\\{([\\s\\S]*?)\\}`));
  return Boolean(match && requiredParts.every((part) => match[1].includes(part)));
}

const nav = await read("src/shared/components/SiteNav.tsx");
const footer = await read("src/shared/components/SiteFooter.tsx");
const app = await read("src/App.tsx");
const commons = await read("src/pages/The-Commons-Circle/index.tsx");
const commonsApi = await read("src/pages/The-Commons-Circle/commonsCircleApi.ts");
const commonsSetup = await read("src/pages/The-Commons-Circle/CommonsCircleSetupPage.tsx");
const commonsLocalOnboarding = await read("src/pages/The-Commons-Circle/CommonsCircleOnboardingPage.tsx");
const commonsAvatarViewer = await read("src/shared/components/CommonsAvatarViewer.tsx");
const commonsAdminConsole = await read("src/pages/The-Commons-Circle/CommonsCircleAdminConsolePage.tsx");
const publicProfileFieldsMigration = await read("supabase/legacy-migrations/2026_06_22_commons_public_profile_fields.sql");
const commonsBannerFramingMigration = await read("supabase/legacy-migrations/2026_07_02_commons_banner_framing.sql");
const supabaseSchema = await read("supabase/schema.sql");
const softDeleteCleanupMigration = await read("supabase/legacy-migrations/2026_07_07_commune_soft_delete_cleanup.sql");
const communityVoteDeleteFilterMigration = await read("supabase/legacy-migrations/2026_07_08_commune_vote_delete_parent_filter.sql");
const adminPage = await read("src/pages/Admin/index.tsx");
const reviewClient = await read("src/shared/review/reviewClient.ts");
const jobPostReviewClient = await read("src/shared/review/jobPostReviewClient.ts");
const jobPostEconomicMigration = await read("supabase/migrations/20260716040000_job_post_economic_sidecar_and_publication_gate.sql");
const publicProfile = await read("src/pages/Public-Commons-Profile/index.tsx");
const commune = await read("src/pages/The-Elysia-Commune/index.tsx");
const communeAccountApi = await read("src/pages/The-Elysia-Commune/communeAccountApi.ts");
const signalConsole = await read("src/pages/The-Commons-Circle/SignalConsolePage.tsx");
const communityVotePolicyDoc = await read("docs/commune/community-voting-room-policy.md");
const communityVoteBoundaryDoc = await read("docs/security/community-voting-room-boundary.md");
const communityVoteContractDoc = await read("docs/api/community-vote-contract.md");
const forgeValidator = await read("src/pages/The-Developer-Forge/developerForgeValidator.ts");
const forgeTemplates = await read("src/pages/The-Developer-Forge/developerForgeTemplates.ts");
const forgeApi = await read("src/pages/The-Developer-Forge/developerForgeApi.ts");
const forgeWorkbench = await read("src/pages/The-Developer-Forge/ForgeWorkbench.tsx");
const adminModerationClient = await read("src/shared/review/adminModerationClient.ts");
const forgeSnapshotMigration = await read("supabase/legacy-migrations/2026_06_27_developer_forge_submission_snapshots.sql");
const forgeSubmissionDocs = await read("docs/developer-forge/submission-review-process.md");
const forgeWorkbenchDocs = await read("docs/developer-forge/workbench.md");
const legalIndex = await read("src/pages/Legal/index.tsx");
const legalPolicies = await read("src/pages/Legal/legalPolicyPages.ts");
const archive = await read("src/pages/The-Elysia-Archive/index.tsx");
const styles = await read("src/styles.css");
const commonsBackgroundCatalog = await read("src/shared/commonsBackgroundStyles.ts");
const commonsDecorativeMarkers = await read("src/shared/commonsDecorativeMarkers.ts");
const commonsBackgroundAtmosphere = await read("src/shared/components/CommonsBackgroundAtmosphere.tsx");
const commonsBackgroundCss = await read("src/styles/commonsBackgrounds.css");
const commonsProfileLayoutCatalog = await read("src/shared/commonsProfileLayouts.ts");
const commonsProfileLayoutFrame = await read("src/shared/components/CommonsProfileLayoutFrame.tsx");
const commonsProfileLayoutCss = await read("src/styles/commonsProfileLayouts.css");
const commonsThemeModes = await read("src/shared/commonsThemeModes.ts");
const commonsCustomizationStyles = await read("src/shared/commonsCustomizationStyles.ts");
const pageHero = await read("src/shared/components/PageHero.tsx");
const pageBrandMark = await read("src/shared/components/PageBrandMark.tsx");
const homeMain = await read("src/pages/Elysia-Ecobotics-Online-MainPage/index.tsx");
const marketplaceHome = await read("src/pages/The-Elysia-Marketplace/pages/HomePage.tsx");
const marketplaceCard = await read("src/pages/The-Elysia-Marketplace/components/AddonCard.tsx");
const marketplaceDetails = await read("src/pages/The-Elysia-Marketplace/components/AddonDetails.tsx");
const installIntentApi = await read("src/pages/The-Elysia-Marketplace/lib/installIntentApi.ts");
const marketplaceIdentifierMigration = await read("supabase/migrations/20260716012000_marketplace_identifier_compatibility.sql");
const productsPage = await read("src/pages/Elysia-Ecobotics-Products/index.tsx");
const labPage = await read("src/pages/The-Elysia-Ecobotics-Lab/index.tsx");
const forgePage = await read("src/pages/The-Developer-Forge/index.tsx");
const livingLibraryPage = await read("src/pages/The-Living-Library/index.tsx");
const workWithPage = await read("src/pages/Work-With-Elysia-Ecobotics/index.tsx");
const storyPage = await read("src/pages/The-Story-of-Elysia/index.tsx");
const aboutPage = await read("src/pages/About-Elysia-Ecobotics/index.tsx");
const missionPage = await read("src/pages/The-Elysia-Mission/index.tsx");
const sandboxHandoff = await read("src/shared/sandbox/sandboxHandoffBuilder.ts");
const supportPage = await read("src/pages/Support/index.tsx");
const supportThankYou = await read("src/pages/Support/SupportThankYouPage.tsx");
const billingClient = await read("src/shared/billing/billingClient.ts");
const exactMoney = await read("src/shared/billing/exactMoney.ts");
const stripeTestCatalog = await read("scripts/billingStripeTestCatalog.mjs");
const supportBilling = await read("src/pages/The-Commons-Circle/SupportBillingPage.tsx");
const checkoutReturnStatus = await read("src/shared/billing/CheckoutReturnStatus.tsx");
const economicOperations = await read("src/pages/Admin/EconomicOperationsPage.tsx");
const forgotPassword = await read("src/pages/Account/AccountForgotPasswordPage.tsx");
const accountRecovery = await read("src/pages/Account/AccountRecoveryPage.tsx");
const authPanel = await read("src/pages/The-Elysia-Marketplace/components/AuthPanel.tsx");
const safeInternalActionPath = await read("src/shared/navigation/safeInternalActionPath.ts");
const authProvider = await read("src/shared/auth/AuthProvider.tsx");

const expectedNav = ["Home", "Archive", "Marketplace", "Products", "Lab", "Developer Forge", "Living Library", "Commune", "Work With", "Commons Circle", "Story", "About", "Mission", "Support", "Legal"];
let cursor = -1;
for (const label of expectedNav) {
  const next = nav.indexOf(`label: "${label}"`);
  assert(next > cursor, `Nav order missing or out of order: ${label}`);
  cursor = next;
}
assert(nav.includes('aria-controls="site-navigation-links"') && nav.includes("aria-expanded={open}"), "Responsive site navigation should expose its controlled menu and open state to assistive technology.");
assert(nav.includes('data-open={open ? "true" : "false"}') && nav.includes("onClick={() => setOpen(false)}"), "Responsive site navigation should expose its visual state and close after route selection.");
assert(cssRuleIncludes(styles, ".site-nav", ["flex-wrap: wrap", "overflow-x: visible"]), "Desktop site navigation should wrap without a persistent horizontal scrollbar.");
assert(styles.includes('.site-nav[data-open="true"] { display: grid; }') && cssRuleIncludes(styles, ".site-nav-toggle", ["display: none"]), "Responsive site navigation should use an explicit accessible disclosure instead of horizontal overflow.");
assert(styles.includes(".site-footer { display: grid; grid-template-columns: minmax(18rem, 0.6fr) minmax(0, 1.4fr);"), "Desktop footer should reserve readable space for its identity text while allowing its link collection to wrap.");

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
const commonsDecorativeMarkerOptions = [
  ["leaf_glyph", "Leaf Glyph", "leaf_glyph.png", "commons-public-decorative-marker--leaf-glyph"],
  ["water_ripple", "Water Ripple", "water_ripple.png", "commons-public-decorative-marker--water-ripple"],
  ["star_map", "Star Map", "star_map.png", "commons-public-decorative-marker--star-map"],
  ["mushroom_badge", "Mushroom Button", "mushroom_badge.png", "commons-public-decorative-marker--mushroom-badge"],
  ["circuit_vine", "Circuit Vine", "circuit_vine.png", "commons-public-decorative-marker--circuit-vine"],
  ["pollinator", "Pollinator", "pollinator.png", "commons-public-decorative-marker--pollinator"],
  ["wetland_reed", "Wetland Reed", "wetland_reed.png", "commons-public-decorative-marker--wetland-reed"],
  ["moon_crest", "Moon Crest", "moon_crest.png", "commons-public-decorative-marker--moon-crest"],
  ["robotic_seed", "Robotic Seed", "robotic_seed.png", "commons-public-decorative-marker--robotic-seed"],
];
for (const [key, label, assetName, className] of commonsDecorativeMarkerOptions) {
  assert(commonsDecorativeMarkers.includes(`key: "${key}"`), `Commons decorative marker catalog missing stable key: ${key}`);
  assert(commonsDecorativeMarkers.includes(`label: "${label}"`), `Commons decorative marker catalog missing display label: ${label}`);
  assert(commonsDecorativeMarkers.includes(className), `Commons decorative marker catalog class missing for ${key}.`);
  assert(await exists(`src/assets/commons/decorative-markers/${assetName}`), `Commons decorative marker asset missing: ${assetName}`);
}
const oldMushroomLabel = "Mushroom " + "Badge";
assert(commonsDecorativeMarkers.includes("COMMONS_DECORATIVE_MARKERS") && commonsDecorativeMarkers.includes("COMMONS_DECORATIVE_MARKER_KEYS") && commonsDecorativeMarkers.includes("COMMONS_DECORATIVE_MARKER_SET_OPTIONS") && commonsDecorativeMarkers.includes("normalizeCommonsDecorativeMarkerSet") && commonsDecorativeMarkers.includes("normalizeCommonsSelectedDecorativeMarkers"), "Commons decorative marker catalog should export keys, options, and normalizers.");
assert(commonsDecorativeMarkers.includes('key: "none", label: "None"') && commonsDecorativeMarkers.includes("formatCommonsDecorativeMarkerLabel") && commonsDecorativeMarkers.includes("resolveCommonsDecorativeMarkers"), "Commons decorative marker catalog should include None, labels, and public resolution behavior.");
assert(commonsDecorativeMarkers.includes('label: "Mushroom Button"') && commonsDecorativeMarkers.includes('key: "mushroom_badge"') && !commonsDecorativeMarkers.includes(oldMushroomLabel), "Mushroom decorative marker must keep the database key but display as Mushroom Button.");
assert(!/https?:\/\//i.test(commonsDecorativeMarkers), "Commons decorative marker catalog must not use remote marker image URLs.");
assert(commons.includes("COMMONS_DECORATIVE_MARKER_SET_OPTIONS.map") && commons.includes("option.label") && !commons.includes(">{decal}</option>"), "Commons Circle decorative marker dropdown should use shared readable labels, not raw keys.");
assert(!commons.includes("Selected decorative markers") && !commons.includes("commons-decal-picker") && !commons.includes("toggleSelectedDecal") && !commons.includes("COMMONS_DECORATIVE_MARKERS.map") && !commons.includes("selected_decals).includes"), "Commons Circle should no longer render selected decorative marker checkbox controls.");
assert(publicProfile.includes("getCommonsDecorativeMarkerOption") && publicProfile.includes("normalizeCommonsDecorativeMarkerSet") && publicProfile.includes("CommonsPublicHeroDecorativeMarker") && publicProfile.includes("customization.decal_set"), "Public Commons profile should resolve decorative markers from decal_set only.");
assert(publicProfile.includes("commons-public-profile-hero-marker") && publicProfile.includes("aria-hidden=\"true\"") && publicProfile.includes("alt=\"\"") && publicProfile.includes("draggable={false}"), "Public Commons profile should render a single non-interactive hero marker image.");
assert(!publicProfile.includes("resolveCommonsDecorativeMarkers(") && !publicProfile.includes("commons-public-decorative-marker-layer"), "Public Commons profile marker rendering must ignore selected_decals and old multi-marker layer logic.");
assert(cssRuleIncludes(styles, ".commons-public-profile .commons-public-profile-hero-marker", ["position: absolute", "right:", "width: clamp(7rem, 14vw, 14rem)", "pointer-events: none", "user-select: none"]) && cssRuleIncludes(styles, ".commons-public-profile .commons-public-profile-hero-marker img", ["filter:", "object-fit: contain"]), "Public hero marker CSS should be public-scoped and visibly positioned in the top hero.");
assert(!styles.includes(".commons-public-profile .commons-public-decorative-marker-layer") && !styles.includes(".commons-public-profile .commons-public-decorative-marker--"), "Old multi-marker public layout overlay CSS should be removed.");
assert(!commons.includes("commons-public-profile-hero-marker") && !commons.includes("commons-public-decorative-marker-layer"), "Customization Studio preview must not render decorative marker PNG overlays.");
for (const mastheadClass of ["commons-profile-masthead", "commons-profile-masthead--classic-homebase", "commons-profile-masthead__banner", "commons-profile-masthead__identity", "commons-profile-masthead__avatar", "commons-profile-masthead__avatar-image", "commons-profile-masthead__edit", "commons-avatar--masthead"]) {
  assert(publicProfile.includes(mastheadClass) || commons.includes(mastheadClass), `Commons profile masthead hook missing: ${mastheadClass}`);
}
assert(commonsProfileLayoutCss.includes(".commons-profile-layout--public.commons-profile-layout--classic-homebase .commons-profile-masthead--classic-homebase") && commonsProfileLayoutCss.includes("1360px"), "Classic Homebase public masthead should use a Classic-only wider masthead modifier.");
assert(commonsProfileLayoutCss.includes(".commons-profile-layout--classic-homebase .commons-profile-masthead--classic-homebase .commons-profile-masthead__avatar") && commonsProfileLayoutCss.includes("justify-self: start"), "Classic Homebase avatar placement should remain protected by Classic-only masthead selectors.");
assert(commonsProfileLayoutCss.includes(".commons-profile-layout--constellation-map .commons-profile-summary-card") && commonsProfileLayoutCss.includes("justify-items: center") && commonsProfileLayoutCss.includes("border-radius: 999px"), "Constellation Map avatar placement should remain protected by centered orbital summary-card geometry.");
const constellationOrbitalLineRule = /\.commons-profile-layout--constellation-map::before,[\s\S]*?\.commons-profile-layout--constellation-map::after\s*\{(?=[^}]*border:\s*1px solid)(?=[^}]*border-radius:\s*999px)/s;
assert(constellationOrbitalLineRule.test(commonsProfileLayoutCss), "Constellation Map should keep layout-specific orbital linework.");
const constellationPreviewSummaryFitRule = /\.commons-profile-layout--preview\.commons-profile-layout--constellation-map\s+\.commons-profile-summary-card\s*\{(?=[^}]*min-height:\s*clamp)(?=[^}]*align-content:\s*center)/s;
assert(constellationPreviewSummaryFitRule.test(commonsProfileLayoutCss), "Constellation Map preview center node should have a layout-specific content-fit rule.");
const constellationPreviewNodeFitRule = /\.commons-profile-layout--preview\.commons-profile-layout--constellation-map\s+\.commons-public-section-card\s*\{(?=[^}]*min-height:\s*clamp)(?=[^}]*align-content:\s*center)/s;
assert(constellationPreviewNodeFitRule.test(commonsProfileLayoutCss), "Constellation Map preview side nodes should have a layout-specific fitting rule.");
const constellationPreviewContributionsRule = /\.commons-profile-layout--preview\.commons-profile-layout--constellation-map\s+\.commons-public-contributions-card\s*\{(?=[^}]*min-height:\s*clamp)(?=[^}]*padding-inline:\s*clamp)/s;
assert(constellationPreviewContributionsRule.test(commonsProfileLayoutCss), "Constellation Map preview contributions node should avoid a shallow ribbon treatment.");
const constellationPreviewSpacingRule = /\.commons-profile-layout--preview\.commons-profile-layout--constellation-map\s*\{(?=[^}]*--profile-layout-gap:\s*clamp\(0\.85rem)(?=[^}]*row-gap:\s*clamp)(?=[^}]*column-gap:\s*clamp)/s;
assert(constellationPreviewSpacingRule.test(commonsProfileLayoutCss), "Constellation Map preview should keep a preview-only breathing-room rule.");
const constellationPublicIdentityRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-identity-card\s*\{(?=[^}]*min-height:\s*clamp)(?=[^}]*padding:\s*clamp)/s;
assert(constellationPublicIdentityRule.test(commonsProfileLayoutCss), "Constellation Map public identity node should have a layout-specific content-fit rule.");
const constellationPublicCenterChipRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-profile-summary-card__chips\s*\{(?=[^}]*margin-block-start:\s*0)(?=[^}]*transform:\s*translateY\(-0\.65rem\))/s;
assert(constellationPublicCenterChipRule.test(commonsProfileLayoutCss), "Constellation Map public center chip row should have a public-only bottom-safe lift.");
const constellationPublicAuthorityNoteRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-authority-note\s*\{(?=[^}]*border-radius:\s*clamp\(28px)(?=[^}]*var\(--commons-theme-notice-bg\))/s;
assert(constellationPublicAuthorityNoteRule.test(commonsProfileLayoutCss), "Constellation Map public authority notes should be integrated with rounded node styling.");
const constellationPublicContributionsRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-contributions-card\s*\{(?=[^}]*width:\s*min\(calc\(100%\s*-\s*6\.5rem\),\s*91\.25rem\))(?=[^}]*min-height:\s*clamp\(21\.25rem)(?=[^}]*padding:\s*clamp)/s;
assert(constellationPublicContributionsRule.test(commonsProfileLayoutCss), "Constellation Map public contributions node should be content-aware and layout-specific.");
const constellationPublicInnerCardRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-badge-card,[\s\S]*?\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-contribution-card\s*\{(?=[^}]*border-radius:\s*clamp)/s;
assert(constellationPublicInnerCardRule.test(commonsProfileLayoutCss), "Constellation Map public inner badge/contribution cards should harmonize with rounded parent nodes.");
const constellationPublicSafeAreaRootRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s*\{(?=[^}]*--profile-constellation-safe-inline:\s*clamp\(3\.25rem)(?=[^}]*scroll-margin-top:\s*11rem)(?=[^}]*padding-block-start:\s*clamp\(3\.25rem)/s;
assert(constellationPublicSafeAreaRootRule.test(commonsProfileLayoutCss), "Constellation Map public layout should define a public-only readable safe zone.");
const constellationPublicEyebrowSeatingRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-section-card__eyebrow\s*\{(?=[^}]*transform:\s*translate\()(?=[^}]*margin-block-end:\s*clamp)/s;
assert(constellationPublicEyebrowSeatingRule.test(commonsProfileLayoutCss), "Constellation Map public node labels should have a public-only safe-lane seating rule.");
const constellationPublicProfileLabelRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-identity-card\s+\.commons-public-section-card__eyebrow\s*\{(?=[^}]*transform:\s*translate\(clamp\(2\.6rem,[^}]*clamp\(1\.2rem)/s;
assert(constellationPublicProfileLabelRule.test(commonsProfileLayoutCss), "Constellation Map public PROFILE label should have scoped final safe-lane seating.");
const constellationPublicMedallionsLabelRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-badges-card\s+\.commons-public-section-card__eyebrow\s*\{(?=[^}]*transform:\s*translate\(clamp\(5\.2rem,[^}]*clamp\(2rem)/s;
assert(constellationPublicMedallionsLabelRule.test(commonsProfileLayoutCss), "Constellation Map public MEDALLIONS label should have scoped down/right safe-lane seating.");
const constellationPublicIdentitySafeZoneRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-identity-card\s*\{(?=[^}]*padding-inline-start:\s*clamp\(2rem)(?=[^}]*padding-inline-end:\s*clamp\(1\.25rem)/s;
assert(constellationPublicIdentitySafeZoneRule.test(commonsProfileLayoutCss), "Constellation Map public identity node should use the readable safe zone.");
const constellationPublicIdentityContainmentRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-identity-card\s*\{(?=[^}]*width:\s*min\(calc\(100%\s*\+\s*2rem\),\s*33rem\))(?=[^}]*border-radius:\s*clamp\(112px,\s*11\.5vw,\s*188px\)\s*clamp\(54px,\s*5\.8vw,\s*92px\)\s*clamp\(70px,\s*7vw,\s*112px\)\s*clamp\(128px,\s*12\.5vw,\s*204px\))/s;
assert(constellationPublicIdentityContainmentRule.test(commonsProfileLayoutCss), "Constellation Map public identity outer card should pull its right edge away from the center node.");
const constellationPublicIdentityContentRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-identity-card\s+>\s*:where\(h2,\s*\.commons-public-link-list\),[\s\S]*?\.commons-public-identity-card\s+>\s*p:not\(\.commons-public-section-card__eyebrow\):not\(\.commons-public-authority-note\)\s*\{(?=[^}]*max-width:\s*min\(100%,\s*32\.75rem\))(?=[^}]*transform:\s*translate\(clamp\(0\.55rem)/s;
assert(constellationPublicIdentityContentRule.test(commonsProfileLayoutCss), "Constellation Map public identity readable content should have a scoped up/right seating rule.");
const constellationPublicIdentityHeadingRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-identity-card\s+>\s*h2\s*\{(?=[^}]*transform:\s*translate\(clamp\(0\.55rem,[^}]*-0\.45rem\))/s;
assert(constellationPublicIdentityHeadingRule.test(commonsProfileLayoutCss), "Constellation Map public identity heading should separate safely from the PROFILE label without moving body copy.");
const constellationPublicBadgesSafeZoneRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-badges-card\s*\{(?=[^}]*padding-inline-start:\s*clamp\(2rem)(?=[^}]*padding-inline-end:\s*clamp\(1\.25rem)/s;
assert(constellationPublicBadgesSafeZoneRule.test(commonsProfileLayoutCss), "Constellation Map public badges node should use the readable safe zone.");
const constellationPublicBadgesHeadingRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-badges-card\s+>\s*h2\s*\{(?=[^}]*transform:\s*translate\(3\.15rem,\s*0\.25rem\))/s;
assert(constellationPublicBadgesHeadingRule.test(commonsProfileLayoutCss), "Constellation Map public badges heading should have scoped left-safe seating.");
const constellationPublicContributionsSafeZoneRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-contributions-card\s*\{(?=[^}]*padding-inline-start:\s*clamp)(?=[^}]*padding-inline-end:\s*clamp)(?=[^}]*align-content:\s*start)/s;
assert(constellationPublicContributionsSafeZoneRule.test(commonsProfileLayoutCss), "Constellation Map public contributions capsule should use safe edge padding and content-aware alignment.");
const constellationPublicAuthorityNoteChamberRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-identity-card\s+\.commons-public-authority-note,[\s\S]*?\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-badges-card\s+\.commons-public-authority-note\s*\{(?=[^}]*border-radius:\s*clamp\(26px,\s*3\.1vw,\s*34px\)\s*clamp\(36px,\s*4vw,\s*48px\)\s*clamp\(4px,\s*0\.85vw,\s*10px\)\s*clamp\(30px,\s*3\.6vw,\s*42px\))/s;
assert(constellationPublicAuthorityNoteChamberRule.test(commonsProfileLayoutCss), "Constellation Map public authority notes should use scoped asymmetric chamber radii.");
const constellationPublicIdentityNoteRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-identity-card\s+\.commons-public-authority-note\s*\{(?=[^}]*max-width:\s*min\(100%)(?=[^}]*33\.5rem)(?=[^}]*transform:\s*translate\(0\.45rem,\s*-2\.05rem\))/s;
assert(constellationPublicIdentityNoteRule.test(commonsProfileLayoutCss), "Constellation Map public identity warning note should be seated as an inner chamber.");
const constellationPublicBadgesNoteRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-badges-card\s+\.commons-public-authority-note\s*\{(?=[^}]*--commons-badges-note-cut-left-x:\s*clamp\(44px,\s*3\.55vw,\s*58px\))(?=[^}]*--commons-badges-note-cut-left-y:\s*clamp\(26px,\s*2\.25vw,\s*34px\))(?=[^}]*--commons-badges-note-cut-right-x:\s*clamp\(84px,\s*6\.25vw,\s*100px\))(?=[^}]*--commons-badges-note-cut-right-y:\s*clamp\(44px,\s*3\.85vw,\s*58px\))(?=[^}]*position:\s*relative)(?=[^}]*isolation:\s*isolate)(?=[^}]*z-index:\s*0)(?=[^}]*max-width:\s*min\(94%,\s*21\.85rem\))(?=[^}]*border:\s*0)(?=[^}]*border-radius:\s*clamp\(32px,\s*3\.4vw,\s*44px\)\s*clamp\(40px,\s*3\.9vw,\s*54px\))(?=[^}]*padding:\s*clamp\(0\.72rem,\s*1\.25vw,\s*0\.92rem\)\s*clamp\(1\.85rem,\s*3\.35vw,\s*2\.35rem\)\s*clamp\(1rem,\s*1\.55vw,\s*1\.2rem\)\s*clamp\(1\.15rem,\s*2\.35vw,\s*1\.65rem\))(?=[^}]*background:\s*transparent)(?=[^}]*box-shadow:\s*none)(?=[^}]*clip-path:\s*none)(?=[^}]*overflow:\s*visible)(?=[^}]*transform:\s*translate\(0\.2rem,\s*-0\.05rem\))/s;
assert(constellationPublicBadgesNoteRule.test(commonsProfileLayoutCss), "Constellation Map public badges warning note should keep the readable text box un-clipped with the right side pulled inward.");
const constellationPublicBadgesNoteOuterShellRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-badges-card\s+\.commons-public-authority-note::before\s*\{(?=[^}]*content:\s*"";)(?=[^}]*position:\s*absolute)(?=[^}]*inset:\s*0)(?=[^}]*z-index:\s*-2)(?=[^}]*background:\s*var\(--commons-theme-notice-border)(?=[^}]*border-radius:\s*clamp\(32px,\s*3\.4vw,\s*44px\)\s*clamp\(40px,\s*3\.9vw,\s*54px\)\s*0\s*0)(?=[^}]*clip-path:\s*polygon\()/s;
assert(constellationPublicBadgesNoteOuterShellRule.test(commonsProfileLayoutCss), "Constellation Map public badges warning note should draw the adjusted outer shaped theme-border shell behind the text.");
const constellationPublicBadgesNoteInnerShellRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-badges-card\s+\.commons-public-authority-note::after\s*\{(?=[^}]*content:\s*"";)(?=[^}]*position:\s*absolute)(?=[^}]*inset:\s*1\.2px)(?=[^}]*z-index:\s*-1)(?=[^}]*var\(--commons-theme-notice-bg\))(?=[^}]*border-radius:\s*clamp\(31px,\s*3\.3vw,\s*43px\)\s*clamp\(39px,\s*3\.8vw,\s*53px\)\s*0\s*0)(?=[^}]*clip-path:\s*polygon\()/s;
assert(constellationPublicBadgesNoteInnerShellRule.test(commonsProfileLayoutCss), "Constellation Map public badges warning note should draw the adjusted inner shaped theme fill behind the text.");
const constellationPublicBadgeChamberRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-badge-card\s*\{(?=[^}]*width:\s*min\(100%,\s*23\.35rem\))(?=[^}]*max-width:\s*23\.35rem)(?=[^}]*border-radius:\s*clamp\(26px)/s;
assert(constellationPublicBadgeChamberRule.test(commonsProfileLayoutCss), "Constellation Map public badge card should stay wider and chamber-like inside the badges node.");
const constellationPublicSlotSeatingRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-profile-slot--identity\s*\{(?=[^}]*transform:\s*translate\(-1\.25rem,\s*0\.4rem\))[\s\S]*?\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-profile-slot--badges\s*\{(?=[^}]*transform:\s*translate\(3\.5rem,\s*-0\.15rem\))[\s\S]*?\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-profile-slot--collections\s*\{(?=[^}]*transform:\s*translate\(-2\.9rem,\s*-0\.55rem\))/s;
assert(constellationPublicSlotSeatingRule.test(commonsProfileLayoutCss), "Constellation Map public orbiting nodes should use public-only seating adjustments.");
const constellationPublicButtonLaneRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-profile-summary-card__edit,[\s\S]*?\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-profile-masthead__edit\s*\{(?=[^}]*margin-block-start:\s*clamp\(2rem)(?=[^}]*justify-content:\s*center)/s;
assert(constellationPublicButtonLaneRule.test(commonsProfileLayoutCss), "Constellation Map public edit button should keep a public-only breathing lane under the center node.");
const constellationPublicContributionRhythmRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-contributions-card\s+>\s*h2\s*\{(?=[^}]*margin-block-end:\s*0)/s;
assert(constellationPublicContributionRhythmRule.test(commonsProfileLayoutCss), "Constellation Map public contributions heading should keep a scoped tighter rhythm with the card row.");
const constellationPublicContributionGridRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-contribution-grid\s*\{(?=[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*19rem\),\s*22rem\)\))(?=[^}]*gap:\s*clamp\(0\.9rem)(?=[^}]*align-items:\s*start)(?=[^}]*margin-block-start:\s*clamp\(0\.85rem,\s*1\.3vw,\s*1\.15rem\))(?=[^}]*padding-inline:\s*clamp\(0\.5rem,\s*1vw,\s*0\.85rem\)\s*clamp\(1\.6rem)/s;
assert(constellationPublicContributionGridRule.test(commonsProfileLayoutCss), "Constellation Map public contribution cards should sit below the title with scoped right-edge breathing room.");
const constellationPublicContributionCardRhythmRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-contribution-card\s*\{(?=[^}]*display:\s*grid)(?=[^}]*align-self:\s*start)(?=[^}]*align-content:\s*center)(?=[^}]*min-height:\s*clamp\(7\.4rem)(?=[^}]*padding:\s*clamp\(0\.72rem,[^}]*clamp\(0\.7rem)(?=[^}]*gap:\s*clamp\(0\.32rem)(?=[^}]*line-height:\s*1\.32)/s;
assert(constellationPublicContributionCardRhythmRule.test(commonsProfileLayoutCss), "Constellation Map public contribution cards should use compact card rhythm instead of old tiny-gap/negative-transform hacks.");
const constellationPublicContributionCardChildResetRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-contribution-card\s+>\s*\*\s*\{(?=[^}]*margin:\s*0)/s;
assert(constellationPublicContributionCardChildResetRule.test(commonsProfileLayoutCss), "Constellation Map public contribution card children should reset default margins so card height is controlled by the card rhythm.");
const constellationPublicContributionCardContentRhythmRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-contribution-card__type\s*\{(?=[^}]*line-height:\s*1\.1)[\s\S]*?\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-contribution-card\s+h3\s*\{(?=[^}]*margin:\s*0)(?=[^}]*line-height:\s*1\.16)[\s\S]*?\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-contribution-card\s+p\s*\{(?=[^}]*margin:\s*0)(?=[^}]*line-height:\s*1\.28)/s;
assert(constellationPublicContributionCardContentRhythmRule.test(commonsProfileLayoutCss), "Constellation Map public contribution card text should have scoped compact line-height and margin rules.");
const constellationPublicDesktopContributionsRule = /@media \(min-width:\s*1180px\)\s*\{[\s\S]*?\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-contributions-card\s*\{(?=[^}]*width:\s*min\(calc\(100%\s*-\s*11\.5rem\),\s*85\.75rem\))(?=[^}]*min-height:\s*clamp\(17\.35rem)(?=[^}]*padding-inline-start:\s*clamp\(2\.7rem)(?=[^}]*padding-inline-end:\s*clamp\(3\.1rem)[\s\S]*?\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-contributions-card\s+>\s*\.commons-public-section-card__eyebrow\s*\{(?=[^}]*transform:\s*translate\(0\.85rem,\s*0\.75rem\))[\s\S]*?\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-contribution-grid\s*\{(?=[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(17rem,\s*1fr\)\))(?=[^}]*gap:\s*clamp\(1\.5rem)(?=[^}]*margin-block-start:\s*clamp\(0\.75rem,\s*1vw,\s*1\.05rem\))[\s\S]*?\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-contribution-card\s*\{(?=[^}]*width:\s*100%)(?=[^}]*max-width:\s*21\.25rem)/s;
assert(constellationPublicDesktopContributionsRule.test(commonsProfileLayoutCss), "Constellation Map public contributions should force a scoped three-card desktop row while keeping the cards below the title.");
const constellationPublicContributionButtonRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-public-contribution-card\s+\.button-link\s*\{(?=[^}]*justify-self:\s*start)(?=[^}]*margin-block-start:\s*clamp\(0\.08rem)(?=[^}]*transform:\s*none)/s;
assert(constellationPublicContributionButtonRule.test(commonsProfileLayoutCss), "Constellation Map public contribution buttons should sit naturally in the compact card rhythm without a negative translate.");
const constellationPublicOrbitSofteningRule = /\.commons-profile-layout--public\.commons-profile-layout--constellation-map::before\s*\{(?=[^}]*opacity:\s*0\.4)[\s\S]*?\.commons-profile-layout--public\.commons-profile-layout--constellation-map::after\s*\{(?=[^}]*opacity:\s*0\.26)/s;
assert(constellationPublicOrbitSofteningRule.test(commonsProfileLayoutCss), "Constellation Map public orbital line tuning should remain layout-specific.");
const constellationPublicMobileResetRule = /@media \(max-width:\s*860px\)\s*\{[\s\S]*?\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-profile-slot--identity,[\s\S]*?\.commons-profile-layout--public\.commons-profile-layout--constellation-map\s+\.commons-profile-slot--collections\s*\{(?=[^}]*transform:\s*none)/s;
assert(constellationPublicMobileResetRule.test(commonsProfileLayoutCss), "Constellation Map public desktop seating adjustments should reset safely on narrow layouts.");
const constellationPreviewBlocks = [...commonsProfileLayoutCss.matchAll(/\.commons-profile-layout--preview\.commons-profile-layout--constellation-map[^{]*\{[^}]*\}/g)].map((match) => match[0]);
assert(!constellationPreviewBlocks.some((block) => block.includes("--profile-constellation-safe-inline") || block.includes("scroll-margin-top")), "Public Constellation safe-area variables should not be applied through preview selectors.");
const constellationSlimRevealRule = /\.commons-public-profile\[data-commons-layout="constellation_map"\]\s+\.commons-public-atmosphere-reveal--slim\s*\{(?=[^}]*display:\s*none)/s;
assert(constellationSlimRevealRule.test(commonsBackgroundCss), "Constellation Map public profile should hide the decorative slim atmosphere reveal only for that layout.");
assert(!/\n\.commons-public-atmosphere-reveal--slim\s*\{(?=[^}]*display:\s*none)/s.test(commonsBackgroundCss), "Slim atmosphere reveal should not be hidden globally.");
assert(!/\n\.commons-public-card-glass\s*\{(?=[^}]*(?:border-radius|min-height|padding|grid-template|position|transform)\s*:)/s.test(`${commonsBackgroundCss}\n${commonsProfileLayoutCss}`), "Constellation Map fitting should not be implemented through a broad public card glass geometry rule.");
assert(!/\n\.commons-profile-summary-card\s*\{(?=[^}]*(?:border-radius|min-height|padding|grid-template|position|transform)\s*:)/s.test(commonsProfileLayoutCss), "Constellation Map fitting should not be implemented through a broad summary-card geometry rule.");
assert(!/\n\.commons-profile-masthead\s*\{(?=[^}]*(?:border-radius|min-height|padding|grid-template|position|transform|top|left|right|bottom)\s*:)/s.test(commonsProfileLayoutCss), "Constellation Map fitting should not be implemented through a broad masthead geometry rule.");
assert(!commonsProfileLayoutCss.includes("width: min(100%, 1120px)") && !styles.includes("commons-layout-classic_homebase .commons-public-room-hero {\n  max-width: 1120px;"), "Classic Homebase masthead should not keep the old 1120px cap.");
for (const [label, layoutClass] of [
  ["Compact Archive", "compact-archive"],
  ["Garden Shelves", "garden-shelves"],
  ["Field Notebook", "field-notebook"]
]) {
  const previewAvatarSelector = `.commons-profile-layout--preview.commons-profile-layout--${layoutClass} .commons-profile-masthead__avatar`;
  const publicAvatarSelector = `.commons-profile-layout--public.commons-profile-layout--${layoutClass} .commons-profile-masthead__avatar`;
  const previewScrimSelector = `.commons-profile-layout--preview.commons-profile-layout--${layoutClass} .commons-profile-masthead__banner-scrim`;
  const publicScrimSelector = `.commons-profile-layout--public.commons-profile-layout--${layoutClass} .commons-profile-masthead__banner-scrim`;
  assert(commonsProfileLayoutCss.includes(previewAvatarSelector), `${label} preview avatar should use a layout-specific upper-left placement selector.`);
  assert(commonsProfileLayoutCss.includes(publicAvatarSelector), `${label} public avatar should use a layout-specific upper-left placement selector.`);
  assert(commonsProfileLayoutCss.includes(previewScrimSelector) && commonsProfileLayoutCss.includes(publicScrimSelector), `${label} banner scrim should be scoped out of the summary-card grid for avatar placement.`);
}
const upperLeftAvatarPlacementRule = /\.commons-profile-layout--preview\.commons-profile-layout--compact-archive\s+\.commons-profile-masthead__avatar,[\s\S]*?\.commons-profile-layout--public\.commons-profile-layout--field-notebook\s+\.commons-profile-masthead__avatar\s*\{(?=[^}]*align-self:\s*start)(?=[^}]*justify-self:\s*start)/s;
assert(upperLeftAvatarPlacementRule.test(commonsProfileLayoutCss), "Compact Archive, Garden Shelves, and Field Notebook avatars should share a scoped upper-left placement rule.");
const stewardshipPreviewAvatarRule = /\.commons-profile-layout--preview\.commons-profile-layout--stewardship-board\s+\.commons-profile-masthead__avatar\s*\{(?=[^}]*position:\s*absolute)(?=[^}]*top:\s*clamp)(?=[^}]*right:\s*clamp)/s;
assert(stewardshipPreviewAvatarRule.test(commonsProfileLayoutCss), "Stewardship Board preview should have a preview-only upper-right avatar placement override.");
assert(!/\.commons-profile-layout--public\.commons-profile-layout--stewardship-board\s+\.commons-profile-masthead__avatar\s*\{/.test(commonsProfileLayoutCss), "Stewardship Board public avatar placement should not be targeted by the preview-only override.");
for (const broadAvatarPlacementRule of [
  /\n\.commons-avatar\s*\{(?=[^}]*(?:position|top|right|bottom|left|align-self|justify-self)\s*:)/s,
  /\n\.commons-profile-masthead__avatar\s*\{(?=[^}]*(?:position|top|right|bottom|left|align-self|justify-self)\s*:)/s,
  /\n\.commons-profile-summary-card__avatar\s*\{(?=[^}]*(?:position|top|right|bottom|left|align-self|justify-self)\s*:)/s,
  /\n\.commons-profile-layout\s+\.commons-profile-masthead__avatar\s*\{/s,
  /\n\.commons-profile-layout\s+\.commons-profile-summary-card__avatar\s*\{(?=[^}]*(?:top|right|bottom|left|align-self|justify-self)\s*:)/s
]) {
  assert(!broadAvatarPlacementRule.test(`${styles}\n${commonsProfileLayoutCss}`), "Profile layout avatar placement should not be implemented through broad/global avatar selectors.");
}
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
assert(reviewClient.includes('status: "published"') && reviewClient.includes('visibility: "public"'), "Non-Job-Post Commune approval should preserve existing underlying-post publication behavior.");
assert(jobPostReviewClient.includes('rpc("review_commune_job_post"') && jobPostReviewClient.includes("p_job_post_id") && jobPostReviewClient.includes("p_action") && jobPostReviewClient.includes("p_reason"), "Job Post review must use the exact database publication-gate RPC contract.");
assert(reviewClient.includes("resolveReviewItemJobPostTarget") && reviewClient.includes("reviewJobPostFromReviewItem") && reviewClient.includes("governedJobPostReview.handled"), "Admin Review must bypass generic direct Commune post writes for Job Post records.");
assert(reviewClient.includes("if (!supabase || !result.published) return") && reviewClient.includes("finalizeGovernedJobPostReviewPublication"), "Job Post attachment/thread publication must be conditional on the database's published result.");
assert(reviewClient.includes('currentRow.post_type === "job_post"') && reviewClient.includes('action === "approve_and_restore" ? "approve" : "needs_information"'), "Job Post visibility restore and rejected recovery paths must retain the database publication gate.");
assert(jobPostEconomicMigration.includes("v_economic_satisfied := not v_fee_enabled") && jobPostEconomicMigration.includes("condition_status in ('not_required', 'satisfied', 'waived', 'subsidized')"), "Job Post fee-off compatibility and fee-on independent condition gate are not both represented.");
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
assert(commonsApi.includes("const canonicalFreeMemberCompletedAt = profile?.commons_onboarding_completed_at ?? null") && commonsApi.includes("const profileQualifiesForFreeMember = Boolean(canonicalFreeMemberCompletedAt)"), "Free Member eligibility must use the canonical account-bound Commons onboarding timestamp.");
assert(commonsApi.includes("profileQualifiesForFreeMember && !hasFreeMemberAward") && commonsApi.includes('badge.badge_key === "free_member" && !badge.revoked_at'), "Free Member reconciliation must preserve a legitimate loaded active award and only grant a missing award after canonical onboarding.");
assert(!commonsApi.includes("profile.commons_onboarding_completed_at || localOnboarding.completed") && !commonsApi.includes("localOnboarding.completedAt as string") && !commonsApi.includes("userBadges: [freeMemberFallbackBadge()]"), "A browser-local onboarding flag or disconnected fallback badge must not qualify an account for Free Member recognition.");
assert(commonsApi.includes('description: "Recognition for completing signed-in Commons Profile onboarding."') && commonsApi.includes('award_mode: "automatic after Commons onboarding"'), "Free Member fallback metadata must describe canonical Commons onboarding rather than mere website-account existence.");
assert(commons.includes("const profileSetupComplete = Boolean(profile?.commons_onboarding_completed_at)") && commons.includes("freeMemberRecognized") && commons.includes("membershipTierLabel"), "Commons private membership state must derive Free Member recognition from canonical onboarding or a legitimate loaded award.");
assert(commons.includes("Free Member pending") && commons.includes("A browser-local onboarding flag or a minimal Marketplace profile is not sufficient."), "Commons Circle must show a pending state and explain the cross-account/minimal-profile boundary.");
assert(commonsSetup.includes("successfully records this signed-in Commons Profile's onboarding completion") && commonsSetup.includes("minimal Marketplace profile alone does not qualify") && commonsSetup.includes("Existing legitimate awards remain preserved"), "Final Commons setup must explain canonical Free Member grant eligibility and preserve legitimate prior awards.");
assert(commonsLocalOnboarding.includes("These local choices do not grant Free Member recognition to this or any other account"), "Browser-local Commons onboarding must not claim or imply account-bound Free Member recognition.");
assert(commons.includes("CommonsCircleAdminEntryCard"), "Commons Circle should show a compact admin-console entry card instead of the full panel.");
assert(commons.includes("`/commons-circle/@${encodeURIComponent(profile.username)}`"), "Commons Circle View public profile should use /commons-circle/@username.");
assert(!commons.includes("href=\"/\"") || !commons.includes("View public profile"), "Commons Circle View public profile should not point to the homepage.");
assert(!commons.includes("<h2>Moderation and governance tools</h2>"), "Commons Circle main page should not render the full Admin Console panel inline.");
assert(commonsAdminConsole.includes("Moderation and governance tools"), "Commons Circle Admin Console page must preserve the full console panel.");
assert(commonsAdminConsole.includes("Admin dashboard") && commonsAdminConsole.includes("User role management") && commonsAdminConsole.includes("Audit logs"), "Commons Circle Admin Console links missing.");
assert(commonsAdminConsole.includes("Role required") && commonsAdminConsole.includes("Sign in required"), "Commons Circle Admin Console role/sign-in gate copy missing.");
assert(commune.includes("Code executes nowhere by default") || commune.includes("execute nowhere"), "Commune code-execution safety copy missing.");
assert(commune.includes("Do not upload .env files, API keys, tokens, credentials, private logs, or vault data."), "Commune public safety copy should preserve direct .env/API key/token/credential/private log/vault warning language.");
assert(commune.includes("Choose a moderated community room"), "Commune room-card section heading missing.");
assert(commune.includes("function RoomCardEnterAction") && commune.includes("commune-room-card-actions") && commune.includes("commune-room-enter-button"), "Commune room cards should preserve the shared Enter room CTA path.");
assert(commune.includes("Enter room"), "Commune room-card CTA copy should remain Enter room.");
assert(styles.includes(".commune-room-card-actions") && styles.includes(".commune-room-enter-button"), "Commune room-card CTA styles should remain scoped to room cards.");
assert(commune.includes("Code snippets in Media Garden are visual/read-only material. They are not executed by the website and are not a trust signal.") && commune.includes("discussion, design, structure, symbols, or aesthetic context"), "Media Garden public copy should distinguish visual code material from executable/trusted code.");
assert(commune.includes("`/commons-circle/@${encodeURIComponent(username)}`"), "Commune author links should route to /commons-circle/@username.");
assert(!commune.includes("to={`/commons/@${encodeURIComponent(username)}`"), "Commune author links should not use the old /commons/@username path.");
assert(publicProfile.includes("publicUsernameFromHandle") && publicProfile.includes("publicHandle") && publicProfile.includes("Profile not found or not public"), "Public Commons profile should parse @handles and show a safe unavailable state.");
assert(commonsApi.includes("loadPublicCommonsProfile") && !commonsApi.match(/loadPublicCommonsProfile[\s\S]*?select\("[^"]*is_admin/), "Public profile loader should not select admin/private authority fields.");
assert(commonsApi.includes('select("id, username, display_name, bio, interests, website_url, github_url, avatar_url, commons_onboarding_completed_at")'), "Public profile loader should start from live-safe baseline profile fields.");
assert(commonsApi.includes("Public profile fields") && commonsApi.includes("organization, headline, featured_public_links"), "Public profile optional fields should load separately from the baseline profile row.");
assert(commonsApi.includes('const selfBadgeAwardColumns = "badge_key, awarded_at, award_source, visibility, revoked_at"'), "Ordinary/self badge reads must request only columns still granted after badge hardening.");
const publicProfileLoader = commonsApi.slice(commonsApi.indexOf("export async function loadPublicCommonsProfile"));
assert(publicProfileLoader.includes('from("visible_user_badges").select(publicBadgeAwardColumns)') && !publicProfileLoader.includes('from("user_badges")'), "Public Commons profiles must load badge presentation through the column-minimized visible_user_badges view.");
for (const privateBadgeField of ["award_reason", "evidence_type", "evidence_id"]) {
  assert(!publicProfileLoader.includes(privateBadgeField), `Public profile badge loading must never request private award evidence field: ${privateBadgeField}`);
}
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
assert(commonsCustomizationStyles.includes("export function commonsCustomizationStyle") && commonsCustomizationStyles.includes("safeCommonsAccentColor") && commonsCustomizationStyles.includes("customizationSkinClass") && commonsCustomizationStyles.includes("customizationLayoutClass"), "Commons customization style helper should centralize style variables, accent safety, and class helpers.");
assert(commonsCustomizationStyles.includes("--commons-banner-zoom") && commonsCustomizationStyles.includes("--commons-banner-position-x") && commonsCustomizationStyles.includes("--commons-banner-position-y") && commonsCustomizationStyles.includes("--commons-theme-surface") && commonsCustomizationStyles.includes("--commons-theme-panel-border") && commonsCustomizationStyles.includes("--commons-accent-soft") && commonsCustomizationStyles.includes("--commons-accent-focus"), "Commons customization style helper should expose shared banner, theme, and accent variables.");
assert(commons.includes("Banner framing") && commons.includes("Banner zoom") && commons.includes("Horizontal position") && commons.includes("Vertical position") && commons.includes("Reset banner framing"), "Commons Circle customization should expose Banner framing controls.");
assert(commons.includes("styleSignature") && commons.includes("banner_zoom: normalizeCommonsBannerZoom(settings.banner_zoom)") && commons.includes("banner_position_x: normalizeCommonsBannerPosition(settings.banner_position_x)") && commons.includes("banner_position_y: normalizeCommonsBannerPosition(settings.banner_position_y)"), "Commons Circle unsaved customization detection should include banner framing values.");
assert(commons.includes("const previewStyle = commonsCustomizationStyle(customizationDraft)") && commons.includes("style={previewStyle}"), "Commons Circle preview should apply draft banner/theme/accent CSS variables.");
assert(publicProfile.includes("const style = commonsCustomizationStyle(customization)") && publicProfile.includes("style={style}"), "Public Commons profile should apply saved banner/theme/accent CSS variables.");
assert(commons.includes("Avatar and banner media update immediately when selected") && commons.includes("Decorative markers are public visual labels"), "Commons Circle customization should honestly distinguish immediate media uploads from limited decorative markers.");
assert(commons.includes("customizationSkinClass(savedCustomization)") && commons.includes("customizationClass(customizationDraft)") && commons.includes("commons-customization-preview"), "Commons Circle live homebase should use saved skin customization while draft changes render in a bounded layout preview.");
assert(commons.includes("commons-private-homebase") && commons.includes("commons-private-homebase__mantle") && commons.includes("commons-private-homebase__banner-image"), "Commons Circle private homebase should expose a stable private-only namespace.");
assert(commons.includes("savedCustomization.banner_url") && commons.includes("savedCustomization.avatar_url"), "Commons Circle private homebase should render saved banner/avatar media, not draft preview media.");
assert(commons.includes("const homeStyle = commonsCustomizationStyle(savedCustomization)") && commons.includes("<div className={homebaseClasses} style={homeStyle}>"), "Commons Circle private homebase should consume saved customization variables, not draft framing variables.");
assert(commons.includes("commons-circle-private-homebase-mantle") && commons.includes("commons-circle-private-banner-image"), "Commons Circle private homebase should preserve private-only banner fit hooks.");
assert(commons.includes("commons-circle-customization-preview-mantle") && commons.includes("commons-circle-customization-preview-banner-image"), "Commons Circle customization preview should expose private-only banner fit hooks.");
assert(styles.includes(".commons-private-homebase__mantle .commons-private-homebase__banner-image") && styles.includes(".commons-circle-customization-preview-mantle .commons-circle-customization-preview-banner-image"), "Commons Circle private banner fit CSS should stay rooted in private-only class hooks.");
assert(styles.includes(".commons-customization-preview .commons-profile-layout--preview .commons-circle-customization-preview-mantle .commons-circle-customization-preview-banner-image"), "Commons Circle preview banner translation should have a preview-only cascade lock.");
assert(styles.includes(".commons-private-homebase__mantle .commons-private-homebase__banner-image") && styles.includes("transform: translate(-50%, -50%)") && commonsProfileLayoutCss.includes(".commons-profile-layout--preview .commons-circle-customization-preview-mantle .commons-circle-customization-preview-banner-image") && commonsProfileLayoutCss.includes(".commons-profile-layout--public.commons-profile-layout--classic-homebase .commons-profile-masthead--classic-homebase .commons-profile-masthead__banner-image"), "Banner translation should use surface-specific height-first rules for private homebase, preview, and public Classic mastheads.");
assert(styles.includes(".commons-private-homebase__mantle .commons-private-homebase__banner-image") && styles.includes("top: var(--commons-banner-position-y, 50%)") && styles.includes("left: var(--commons-banner-position-x, 50%)") && styles.includes("height: calc(100% * var(--commons-banner-zoom, 1))"), "Commons Circle private and preview banner translation should consume banner framing CSS variables.");
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
assert(commonsAvatarViewer.includes('import { createPortal } from "react-dom";') && commonsAvatarViewer.includes("createPortal(lightbox, document.body)"), "Commons avatar viewer lightbox should portal to document.body so it escapes clipped profile layout containers.");
const commonsAvatarLightboxRule = /\.commons-avatar-lightbox\s*\{(?=[^}]*position:\s*fixed)(?=[^}]*inset:\s*0)(?=[^}]*z-index:\s*10000)(?=[^}]*isolation:\s*isolate)(?=[^}]*overscroll-behavior:\s*contain)/s;
assert(commonsAvatarLightboxRule.test(styles), "Commons avatar lightbox overlay should be fixed, viewport-level, and isolated.");
const commonsAvatarLightboxPanelRule = /\.commons-avatar-lightbox-panel\s*\{(?=[^}]*width:\s*min\(96vw,\s*92rem\))(?=[^}]*max-width:\s*calc\(100vw)(?=[^}]*max-height:\s*calc\(100vh)/s;
assert(commonsAvatarLightboxPanelRule.test(styles), "Commons avatar lightbox panel should size against the viewport rather than parent profile cards.");
const commonsAvatarLightboxImageRule = /\.commons-avatar-lightbox-image\s*\{(?=[^}]*max-width:\s*min\(100%,\s*calc\(100vw)(?=[^}]*max-height:\s*min\(84vh,\s*860px\))(?=[^}]*object-fit:\s*contain)/s;
assert(commonsAvatarLightboxImageRule.test(styles), "Commons avatar lightbox image should be fully visible with viewport-bounded contain sizing.");
assert(publicProfile.includes("safeCommonsAccentColor") && publicProfile.includes("commonsCustomizationStyle(customization)") && commonsBackgroundAtmosphere.includes("safeCommonsAccentColor"), "Public Commons profile should sanitize and apply saved accent color through the shared customization helper.");
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
assert(styles.includes("--commons-theme-surface") && styles.includes("--commons-theme-chip-bg") && styles.includes("--commons-accent-border") && styles.includes(".commons-private-homebase__mantle"), "Private homebase should consume shared theme/accent variables without using profile layout structure.");
const previewCardAccentRule = /\.commons-profile-layout--preview\s+\.commons-public-section-card\s*\{(?=[^}]*border-color:\s*color-mix\([^}]*var\(--commons-accent\))(?=[^}]*var\(--commons-accent-glow\))/s;
const previewBadgeChipAccentRule = /\.commons-profile-layout--preview\s+\.commons-public-badge-list\s+span\s*\{(?=[^}]*var\(--commons-accent\))(?=[^}]*var\(--commons-theme-chip-bg\))(?=[^}]*var\(--commons-theme-chip-text\))/s;
const publicCardThemeRule = /\.commons-public-profile\s+\.commons-public-card-glass\s*\{(?=[^}]*var\(--commons-theme-surface\))(?=[^}]*var\(--commons-theme-shadow\))(?=[^}]*var\(--commons-accent\))/s;
const publicAtmosphereThemeRule = /\.commons-public-profile\s+\.commons-atmosphere\.commons-public-profile-atmosphere\s+\.section-card,\s*\.commons-public-profile\s+\.commons-atmosphere\.commons-public-profile-atmosphere\s+\.commons-homebase-hero\s*\{(?=[^}]*var\(--commons-theme-surface-strong\))(?=[^}]*var\(--commons-theme-shadow\))/s;
assert(previewCardAccentRule.test(commonsProfileLayoutCss) && previewBadgeChipAccentRule.test(commonsProfileLayoutCss), "Customization Studio preview cards and chips should consume accent variables, not hardcoded muted preview colors.");
assert(publicCardThemeRule.test(commonsBackgroundCss) && publicAtmosphereThemeRule.test(commonsBackgroundCss), "Public Commons profile glass cards should consume theme surface variables while preserving accent highlights.");
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
for (const slug of ["support-and-billing-terms", "refund-and-cancellation-policy", "sandbox-credit-terms", "job-post-fee-terms", "marketplace-commerce-terms", "organization-services-terms", "sponsorship-independence-policy", "account-closure-financial-retention"]) {
  assert(legalPolicies.includes(`slug: "${slug}"`), `Economic legal policy missing: ${slug}`);
}
assert(legalPolicies.includes("Payment does not grant governance") && legalPolicies.includes("Credits are service units, not money or recognition") && legalPolicies.includes("Payment is not approval"), "Economic policies must preserve no-pay-to-govern, sandbox-credit, and Job Post review boundaries.");
for (const organizationBoundary of ["Human-reviewed scope", "Proposal and contract", "Invoices and payment", "Confidentiality and minimum necessary data", "Data processors and external services", "Cancellation and suspension", "Refunds and service credits", "No purchase of authority"]) {
  assert(legalPolicies.includes(organizationBoundary), `Organization Services Terms are missing required boundary: ${organizationBoundary}`);
}
assert(legalPolicies.includes('slugs: ["organization-services-terms", "sponsorship-independence-policy"]') && legalIndex.includes('to="/legal/organization-services-terms"'), "Organization Services Terms must appear in legal metadata/grouping and policy navigation.");
assert(legalPolicies.includes("Economic and payment processing") && legalPolicies.includes("Guest checkout is not linked to a Website Account merely by matching an email address"), "Privacy policy economic processor and account-linking disclosure missing.");

assert(app.includes('path="support"') && app.includes('path="support/thank-you"') && app.includes('path="commons-circle/support-billing"') && app.includes('path="admin/economic-operations"'), "Economic routes are not wired into the application.");
assert(app.includes('path="account/forgot-password"') && app.includes('path="account/recovery"'), "Website Account recovery routes are not wired.");
assert(supportPage.includes("No recurring option is preselected") && supportPage.includes("Free local core") && supportPage.includes("No pay-to-govern"), "Support page must preserve free local use and deliberate recurring support.");
for (const neutralLabel of ["$1 monthly support", "$5 monthly support", "$12 monthly support", "$25 monthly support", "$50 monthly support"]) {
  assert(supportPage.includes(neutralLabel) && stripeTestCatalog.includes(neutralLabel), `Neutral recurring-support label is not aligned across Elysia and Stripe test checkout: ${neutralLabel}`);
}
for (const wealthLikeLabel of ["Seed Supporter", "Commons Sustainer", "Infrastructure Sustainer", "Sandbox Sustainer", "Commons Patron"]) {
  assert(!supportPage.includes(wealthLikeLabel) && !stripeTestCatalog.includes(wealthLikeLabel), `Recurring support must not create a wealth- or rank-like public/provider label: ${wealthLikeLabel}`);
}
assert(supportPage.includes("does not itself promise sandbox credits") && supportPage.includes("no authority, rank, or public financial status") && stripeTestCatalog.includes("does not promise credits"), "Recurring support must not imply an unfulfilled sandbox-credit benefit or public status.");
assert(supportPage.includes('searchParams.get("checkout") === "canceled"') && supportPage.includes("No completed payment is being claimed"), "Canceled checkout return must not show a fake success or change account standing.");
for (const priceCode of ["support_monthly_seed_usd", "support_monthly_commons_usd", "support_monthly_infrastructure_usd", "support_monthly_sandbox_usd", "support_monthly_50_usd"]) {
  assert(supportPage.includes(priceCode) && billingClient.includes(priceCode), `Recurring support product is not aligned across UI/client: ${priceCode}`);
}
for (const requestField of ["clientRequestId", "amountMinor", "priceCode", "sourceRoute", "consentVersion"]) {
  assert(billingClient.includes(requestField), `Billing client request contract missing ${requestField}.`);
}
assert(billingClient.includes('url.hostname === "checkout.stripe.com"') && billingClient.includes('url.hostname === "billing.stripe.com"') && billingClient.includes('url.hostname === "connect.stripe.com"'), "Billing client must constrain checkout, portal, and seller-onboarding redirects to exact provider hosts.");
assert(billingClient.includes("new AbortController()") && billingClient.includes("15_000") && billingClient.includes("clearTimeout(timeout)"), "Browser billing requests must have a cleared bounded timeout rather than leaving support/account screens busy indefinitely.");
assert(supportPage.includes("checkoutRequestIdRef") && supportPage.includes("createBillingClientRequestId"), "Checkout retries must retain a client idempotency key until the economic input changes.");
assert(!billingClient.includes("support_kind: request") && !billingClient.includes("amount_cents: request"), "Billing client still sends the superseded checkout payload.");
assert(supportThankYou.includes('searchParams.get("order")') && supportThankYou.includes("loadBillingOrder(reference, accessToken)") && supportThankYou.includes("redirect alone is not proof of payment") && supportThankYou.includes('order.flow === "support_one_time" || order.flow === "support_recurring"') && supportThankYou.includes("This Support page does not identify it as support"), "Support return page must verify the opaque order reference and its support flow server-side with the account bearer when present.");
assert(supportBilling.includes("Manage billing in Stripe") && supportBilling.includes("Continue to cancellation") && !supportBilling.includes('from("profiles")'), "Support & Billing must use private server/provider paths, not public profile data.");
assert(billingClient.includes('billingFetch("/api/billing/sandbox-credits/catalog", { cache: "no-store" })') && billingClient.includes('billingFetch("/api/billing/sandbox-credits/checkout"'), "Sandbox credit commerce client must use only the same-origin catalog and authenticated checkout routes.");
const sandboxCheckoutClient = billingClient.slice(billingClient.indexOf("export async function createSandboxCreditCheckout"), billingClient.indexOf("export async function createSupportCheckout"));
assert(sandboxCheckoutClient.includes("const body: SandboxCreditCheckoutInput = { clientRequestId, packCode: input.packCode, sourceRoute: input.sourceRoute, consentVersion: input.consentVersion }") && sandboxCheckoutClient.includes("JSON.stringify(body)"), "Sandbox checkout must send only the exact request ID, pack code, source route, and consent version contract.");
assert(sandboxCheckoutClient.includes('pack.changesSafetyPrivileges !== false') && sandboxCheckoutClient.includes('new URL(checkoutUrl).hostname === "checkout.stripe.com"'), "Sandbox checkout response must prove no safety-privilege change and constrain its redirect to exact Stripe Checkout.");
assert(supportBilling.includes('useState("")') && supportBilling.includes("No option is preselected, no automatic purchase occurs") && supportBilling.includes("checkoutRequestIdRef.current ||="), "Sandbox pack selection must start empty, avoid automatic purchase, and retain one request ID across ambiguous retries.");
assert(supportBilling.includes("Sandbox Credit Terms") && supportBilling.includes("fulfillment requires a verified webhook") && supportBilling.includes("The browser does not set price, units, expiration, provider references, fulfillment, or safety privileges"), "Sandbox checkout must collect explicit terms consent and preserve server-authoritative price, fulfillment, and safety boundaries.");
assert(supportBilling.includes('["sandbox-payment", "sandbox_credits", "sandbox service"') && supportBilling.includes("<CheckoutReturnStatus") && checkoutReturnStatus.includes("Browser return alone is not proof of payment or fulfillment") && checkoutReturnStatus.includes("loadBillingOrder(orderReference, accessToken)") && checkoutReturnStatus.includes("order?.flow === expectedFlow") && checkoutReturnStatus.includes("The private order belongs to a different economic flow"), "Sandbox checkout return must verify the exact private order and canonical sandbox flow without claiming browser-verified payment or credit fulfillment.");
assert(billingClient.includes("flow: BillingOrderFlow | null") && billingClient.includes("strictBillingOrderFlow(source.flow)") && billingClient.includes('exactRecord(data, ["ok", "order"]') && billingClient.includes("source.publicReference !== reference"), "Billing order lookup must retain and strictly validate the canonical server flow and exact private response.");
assert(exactMoney.includes("wholeMinor") && exactMoney.includes("fractionalMinor") && !exactMoney.includes("parseFloat") && supportPage.includes("exactUsdDecimalToMinor(customAmount) ?? 0") && !supportPage.includes("Math.round(amount * 100)"), "Support custom USD input must convert exact decimal strings to minor units without floating-point rounding.");
assert(economicOperations.includes("overview?.authorized") && economicOperations.includes("loadEconomicOperatorOverview") && !economicOperations.includes("loadCurrentRoleState") && !economicOperations.includes("is_admin"), "Economic operations gate must use the dedicated private operator overview, not personal billing or community roles.");
assert(billingClient.includes('billingFetch("/api/billing/operator/overview", { cache: "no-store" }, accessToken)') && billingClient.includes("operator.testMode !== true"), "Economic operator overview client must use the authenticated no-store test-only endpoint.");
for (const field of ["authorized", "capabilities", "orderQueue", "paymentQueue", "refundablePaymentQueue", "refundQueue", "subscriptionQueue", "disputeQueue", "webhookQueue", "reconciliationQueue", "sandboxCorrectionQueue", "jobPostEconomicQueue", "sellerPayableQueue", "sellerPayoutPreparationQueue", "organizationServiceQueue", "sponsorshipQueue", "accountRequestQueue", "assistanceProgramQueue", "assistanceQueue", "featureFlags", "providerIdentifiersExposed", "personalContactDataExposed", "testMode"]) {
  assert(billingClient.includes(`operator.${field}`), `Economic operator overview parser is missing exact field: ${field}`);
}
assert(billingClient.includes("boundedOperatorQueue") && billingClient.includes("maximum = 10") && billingClient.includes("value.length > maximum") && billingClient.includes("operatorQueueMoney") && billingClient.includes("100_000_000_000"), "Operator overview queues must remain count-bounded while exact monetary summaries use the frozen minor-unit ceiling.");
for (const [capability, method, path] of [
  ["economic_operator_assignments_manage", "setEconomicOperatorAssignment", "/api/billing/operator/assignment"],
  ["sandbox_credits_adjust", "grantEconomicOperatorSandboxCredits", "/api/billing/operator/sandbox-credit-grant"],
  ["economic_refunds_manage", "placeEconomicOperatorRefundHold", "/api/billing/operator/refund-hold"],
  ["economic_reconciliation_manage", "openEconomicOperatorReconciliationCase", "/api/billing/operator/reconciliation"]
]) {
  assert(economicOperations.includes(`hasCapability("${capability}")`) && economicOperations.includes(method), `Economic operations UI is missing exact capability gating for ${capability}.`);
  assert(billingClient.includes(`billingFetch("${path}"`) && billingClient.includes(`export async function ${method}`), `Strict operator billing client is missing ${path}.`);
}
assert(billingClient.includes("exactRecord") && billingClient.includes("operatorMutationEnvelope") && billingClient.includes("MAX_BILLING_RESPONSE_BYTES") && billingClient.includes("TextEncoder().encode(text).byteLength"), "Operator browser responses must be size-bounded and exact-schema parsed.");
assert(billingClient.includes("billingUuidPattern") && billingClient.includes("normalizedOperatorReason") && billingClient.includes("Number.isSafeInteger(input.units)") && billingClient.includes("Number.isSafeInteger(input.amountMinor)"), "Operator clients must validate internal UUIDs, private reasons, and bounded integer units before mutation.");
for (const confirmation of ["grant-economic-capability", "revoke-economic-capability"]) {
  assert(economicOperations.includes(confirmation) && billingClient.includes(confirmation), `Operator capability assignment is missing typed confirmation: ${confirmation}`);
}
assert((economicOperations.match(/if \(busy\) return;/g) ?? []).length >= 6 && economicOperations.includes("disabled={!canSubmit}") && economicOperations.includes('role="status"') && economicOperations.includes('role="alert"'), "Deliberate operator forms must prevent double submission and expose accessible status/error regions.");
assert(economicOperations.includes("idempotencyKeyRef.current ||=") && (economicOperations.match(/clientRequestIdRef\.current \|\|=/g) ?? []).length >= 3, "Sandbox, refund, reconciliation, and lifecycle retries must retain stable client idempotency identifiers.");
assert(billingClient.includes('export async function executeEconomicOperatorTestRefund') && billingClient.includes('billingFetch("/api/billing/operator/refund-execution"') && billingClient.includes('confirmation: "AUTHORIZE TEST REFUND"'), "Test refund execution client must use the exact two-step audited route and confirmation contract.");
assert(economicOperations.includes("requestIdsRef.current") && economicOperations.includes("approvalClientRequestId") && economicOperations.includes("providerAttachClientRequestId") && economicOperations.includes("while (providerAttachClientRequestId === approvalClientRequestId)"), "Test-refund UI must retain two distinct request IDs across ambiguous retries.");
assert(economicOperations.includes("TEST MODE ONLY") && economicOperations.includes("Stripe's test API only") && economicOperations.includes("operator who requested the hold from approving it"), "Test-refund UI must disclose test-only provider execution and independent approval separation.");
assert(economicOperations.includes("Bootstrap assignment remains server-only and is unavailable in this browser") && economicOperations.includes("Economic-operator bootstrap remains an explicit server-side procedure"), "Economic operator bootstrap must remain unavailable to browser code.");
for (const privateResultId of ["assignmentId", "creditLotId", "reconciliationCaseId"]) {
  assert(!economicOperations.includes(privateResultId), `Economic operator UI must not render private result identifier: ${privateResultId}`);
}
assert(!economicOperations.includes("result.refundRequestId") && !economicOperations.includes(">{refundRequestId}<"), "Test-refund UI may accept an internal request UUID but must not render returned private identifiers.");
assert(economicOperations.includes("not a Stripe checkout, payment, charge, customer, or subscription ID") && economicOperations.includes("does not send a Stripe refund"), "Operator forms must distinguish internal order UUIDs from provider identifiers and refund execution.");
assert(forgotPassword.includes("resetPasswordForEmail") && forgotPassword.includes("does not confirm whether an account exists"), "Forgot-password flow must send a privacy-preserving recovery request.");
assert(accountRecovery.includes('autoComplete="new-password"') && accountRecovery.includes("minLength={6}") && /Twelve or more unique characters/i.test(accountRecovery), "Recovery form must preserve the repository 6-character compatibility minimum while recommending stronger passwords.");
assert(authProvider.includes('event === "PASSWORD_RECOVERY"') && authProvider.includes("recoveryMode") && accountRecovery.includes("!recoveryMode"), "Password update must require an actual Supabase recovery event, not any ordinary signed-in session or a user-controlled URL hint.");
assert(authPanel.includes('autoComplete={authMode === "sign_up" ? "new-password" : "current-password"}') && authPanel.includes('to="/account/forgot-password"') && authPanel.includes("password.length < 6"), "Website Account form must preserve password-manager and recovery behavior without raising the current minimum.");
assert(safeInternalActionPath.includes('value.startsWith("//")') && safeInternalActionPath.includes("parsed.origin"), "Database-backed notification actions must be constrained to safe internal paths.");
assert(signalConsole.includes("Support & Billing") && signalConsole.includes("safeInternalActionPath"), "Signal Console must categorize economic notices and constrain their actions.");
assert(commons.includes('to="/commons-circle/support-billing"') && commons.includes("Private economic account room"), "Commons Circle must expose the private Support & Billing room without changing membership.");
assert(archive.includes("No public installer exists yet"), "Archive must not imply a public installer exists.");
assert(archive.includes("unofficial mirror") || archive.includes("unofficial mirrors"), "Archive unofficial mirror warning missing.");
assert(archive.includes("Signatures") && archive.includes("after signing is actually in place"), "Archive signature honesty copy missing.");
assert(archive.includes("Downloads remain independent of payment") && archive.includes("will not require a Website Account"), "Archive must preserve free local downloads independently of support.");
assert(marketplaceHome.includes("Seed catalog fallback") || marketplaceHome.includes("local seed catalog"), "Marketplace seed/demo catalog clarity missing.");
assert(marketplaceCard.includes("Seed/example catalog"), "Marketplace cards must label seed/example catalog entries.");
assert(marketplaceCard.includes("Unsigned or unverified package"), "Marketplace cards must avoid fake signature claims.");
assert(marketplaceDetails.includes("Install intent blocked"), "Marketplace details must block install intent for revoked/unavailable listings.");
assert(marketplaceDetails.includes("This website does not install this add-on locally"), "Marketplace details local-install boundary copy missing.");
assert(installIntentApi.includes("legacy_addon_id: addonRow?.id ?? null") && !installIntentApi.includes("\n      addon_id: addonRow?.id ?? null"), "Marketplace install intent must use the migration-declared legacy_addon_id rather than the absent active-baseline addon_id column.");
assert(installIntentApi.includes("marketplace_addon_version_id: liveVersion?.id ?? null") && installIntentApi.includes("addon_version_id: versionRow?.id ?? null"), "Marketplace install intent must preserve current Marketplace and legacy add-on version lineages for the compatibility trigger.");
assert(marketplaceIdentifierMigration.includes("new.legacy_addon_version_id := coalesce(") && marketplaceIdentifierMigration.includes("new.addon_version_id := new.marketplace_addon_version_id") && marketplaceIdentifierMigration.includes("if new.legacy_addon_id is null and new.addon_slug is not null"), "Marketplace identifier migration must normalize the explicitly separated current and legacy install-intent identifiers.");
assert(sandboxHandoff.includes("private_reviewer_notes_included") && sandboxHandoff.includes("false"), "Sandbox handoff must explicitly exclude private reviewer notes.");
assert(commune.includes("Community Voting Room") && commune.includes("Community votes guide stewardship decisions"), "Commune should include Community Voting Room advisory copy.");
assert(commune.includes("Repository Showcase guidance") && commune.includes("Admin room guidance / template post") && commune.includes("not a repository approval, compatibility review, Marketplace listing, install recommendation, or trust signal"), "Repository Showcase copy should distinguish admin guidance/template posts from repository listings and trust/Marketplace approval.");
assert(commune.includes("Repository Showcase boundaries") && commune.includes("Metadata and presentation only, never execution") && commune.includes("Admin guidance/template posts explain safe room use"), "Repository Showcase hub should preserve metadata-only and admin-guidance boundary copy.");
assert(commune.includes("Research discussion") && commune.includes('id="commune-research-discussion-heading">Context / discussion') && commune.includes("isRepeatedResearchDiscussion"), "Research Notes should label distinct full-width discussion while suppressing exact body duplication.");
assert(commune.includes("commune-post-prose") && commune.includes("function CommunePostBody") && commune.includes('block.type === "heading"'), "Commune post body Markdown headings should remain prose/body content, not room-native metadata cards.");
assert(commune.includes("roomNativeFormHeadingsByPostType") && commune.includes("legacyCommunityNetworkDetails") && !commune.includes("parsedBody.sections.map"), "Commune room-native metadata should be explicit structured fields, not arbitrary body heading cards.");
assert(commune.includes("They do not automatically change site policy") && commune.includes("Marketplace behavior") && commune.includes("Developer Forge behavior") && commune.includes("Official Updates"), "Community Voting Room should state it is not automatic site/policy/legal/safety/Marketplace/Developer Forge/Official Update governance.");
assert(commune.includes("Anonymous visitors can view Community Voting Room votes") && commune.includes("Signed-in members can cast one ballot") && commune.includes("Admins control lifecycle and outcomes"), "Community Voting Room should explain anonymous, member, and admin roles.");
assert(commune.includes("Delete/remove this Commune content?") && commune.includes("This removes the item from public views") && commune.includes("Archive</button>"), "Commune copy should keep Admin Moderation Delete separate from Community Voting Room lifecycle Archive controls.");
assert(communeAccountApi.includes("Database cleanup failed because the deployed cleanup function references an unavailable column. Apply the latest cleanup migration."), "Commune admin deletion should provide safe actionable copy for deployed cleanup-column drift.");
assert(signalConsole.includes("Community Voting Room activity") && signalConsole.includes("Community Voting Room attention") && signalConsole.includes("Official Update remains separate"), "Signal Console should include Community Voting Room category/copy.");
assert(communityVotePolicyDoc.includes("advisory governance feature") && communityVotePolicyDoc.includes("Anonymous visitors cannot vote") && communityVotePolicyDoc.includes("Official Update remains separate"), "Community Voting Room policy doc missing purpose/anonymous/Official Update boundary.");
assert(communityVoteBoundaryDoc.includes("Authenticated members can read their own ballot") && communityVoteBoundaryDoc.includes("aggregate counts only") && communityVoteBoundaryDoc.includes("does not automatically create Official Updates"), "Community Voting Room boundary doc missing ballot privacy/result/Official Update boundary.");
assert(communityVoteContractDoc.includes("commune_vote_posts") && communityVoteContractDoc.includes("castCommunityVoteBallot") && communityVoteContractDoc.includes("Voting Room signals remain separate from Official Update signals"), "Community Vote API contract doc missing table/helper/signal separation contract.");
assert(commonsApi.includes("visibleSavedCommuneRows") && commonsApi.includes("filterNotificationsByActiveCommunePost") && commonsApi.includes("visiblePublicComments"), "Deleted/removed Commune posts should not remain in Saved Shelves, Signal Console, Homebase notifications, or public profile contribution cards.");
assert(softDeleteCleanupMigration.includes("soft_delete_commune_post") && softDeleteCleanupMigration.includes("audit_preserved") && softDeleteCleanupMigration.includes("delete from public.user_saved_commune_posts") && softDeleteCleanupMigration.includes("delete from public.user_notifications"), "Commune soft-delete cleanup migration should remove user-facing ghost references while preserving audit history.");
assert(communityVoteDeleteFilterMigration.includes("Community Voting Room moderation-delete visibility hardening") && communityVoteDeleteFilterMigration.includes("commune_vote_result_summary") && communityVoteDeleteFilterMigration.includes("removed_at is null"), "Community Voting Room deleted-post sidecars should be parent-filtered for normal user-facing content.");
assert(!commonsApi.includes("Deleted Commune post placeholder") && !signalConsole.includes("Deleted Commune post placeholder"), "User-facing deleted Commune placeholder cards should not be introduced.");

console.log("Site content smoke test ok.");
