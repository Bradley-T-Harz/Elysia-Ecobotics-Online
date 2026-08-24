import { matchPath } from "react-router-dom";

const requiredRoutes = [
  "/", "/archive", "/marketplace", "/marketplace/browse", "/marketplace/addons/:id",
  "/marketplace/action-preview", "/marketplace/account", "/marketplace/submit", "/marketplace/trust",
  "/marketplace/manifest-api", "/marketplace/admin", "/products", "/lab", "/developer-forge", "/developer-forge/profile", "/developer-forge/dashboard", "/developer-forge/drafts", "/developer-forge/drafts/new", "/developer-forge/drafts/:id", "/developer-forge/drafts/:id/manifest", "/developer-forge/drafts/:id/permissions", "/developer-forge/drafts/:id/package", "/developer-forge/drafts/:id/validate", "/developer-forge/drafts/:id/preview", "/developer-forge/drafts/:id/submit", "/developer-forge/submissions", "/developer-forge/submissions/:id", "/developer-forge/docs", "/developer-forge/docs/workbench", "/developer-forge/docs/manifest", "/developer-forge/docs/permissions", "/developer-forge/docs/security", "/developer-forge/docs/templates", "/developer-forge/docs/compatibility",
  "/living-library", "/living-library/browse/earth-environment", "/living-library/source/nasa-earthdata", "/commune", "/commune/rooms", "/commune/rooms/:roomSlug/new", "/commune/rooms/:roomSlug/posts", "/commune/rooms/:roomSlug", "/commune/:roomSlug", "/commune/:roomSlug/new", "/commune/posts/:postId", "/commune/new", "/commune/repository-showcase", "/commune/repository-showcase/new", "/commune/repository-showcase/sandbox-request", "/commune/elysia-iteration-showcase/sandbox-request", "/commune/troubleshooting", "/commune/troubleshooting-grove/review", "/commune/troubleshooting-grove/sandbox-request", "/commune/sandbox-review", "/commune/coding-cornucopia/review", "/commune/coding-cornucopia/sandbox-request", "/commune/code-sharing/review", "/commune/code-sharing/sandbox-request", "/commune/realtime", "/commune/moderation", "/work-with-elysia-ecobotics", "/support", "/support/thank-you", "/account/forgot-password", "/account/recovery", "/account/export", "/account/delete", "/commons-circle", "/commons-circle/admin-console", "/commons-circle/admin-communications", "/commons-circle/admin/messaging-access", "/commons-circle/saved-shelves", "/commons-circle/inbox", "/commons-circle/notifications", "/commons-circle/requests-reviews", "/commons-circle/signals", "/commons-circle/signals/inbox", "/commons-circle/signals/notifications", "/commons-circle/signals/requests-reviews", "/commons-circle/signals/coding-proposals", "/commons-circle/signals/troubleshooting", "/commons-circle/signals/research-notes", "/commons-circle/signals/repository-showcases", "/commons-circle/signals/iteration-showcases", "/commons-circle/signals/job-posts", "/commons-circle/signals/voting-room", "/commons-circle/signals/official-updates", "/commons-circle/signals/sandbox-reviews", "/commons-circle/signals/work-with", "/commons-circle/signals/marketplace-forge", "/commons-circle/support-billing",
  "/commons-circle/signals/inbox/new", "/commons-circle/signals/inbox/settings", "/commons-circle/signals/inbox/conversations/:conversationId", "/commons-circle/signals/circle",
  "/commons-circle/onboarding", "/commons-circle/setup/profile", "/commons-circle/setup/stewardship",
  "/commons-circle/setup/work-with", "/commons-circle/setup/confirm", "/commons-circle/:publicHandle", "/commons/:publicHandle", "/artisan-collective", "/story",
  "/about", "/mission", "/legal", "/legal/privacy-policy", "/legal/terms-of-use",
  "/legal/community-guidelines", "/legal/marketplace-developer-agreement",
  "/legal/add-on-submission-policy", "/legal/security-review-policy",
  "/legal/vulnerability-disclosure-policy", "/legal/dmca-copyright-policy",
  "/legal/acceptable-use-policy", "/legal/code-of-conduct",
  "/legal/volunteer-contributor-disclaimer", "/legal/donation-recognition-terms",
  "/legal/trademark-notice", "/legal/third-party-media-credits", "/legal/support-and-billing-terms", "/legal/refund-and-cancellation-policy", "/legal/sandbox-credit-terms", "/legal/job-post-fee-terms", "/legal/marketplace-commerce-terms", "/legal/organization-services-terms", "/legal/sponsorship-independence-policy", "/legal/account-closure-financial-retention", "/legal/living-library-third-party-resources", "/admin", "/admin/moderation", "/admin/reports", "/admin/economic-operations",
  "/admin/addon-submissions", "/admin/developers", "/admin/library-sources",
  "/admin/work-submissions", "/admin/review", "/admin/review/work-with",
  "/admin/review/stewardship", "/admin/review/commune", "/admin/review/living-library",
  "/admin/review/marketplace", "/admin/review/broken-links", "/admin/roles", "/admin/badges", "/admin/audit", "/browse", "/addons/:id", "/action-preview", "/account", "/submit",
  "/trust", "/manifest-api", "/admin"
];
const app = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/App.tsx", import.meta.url), "utf8"));
const communePage = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/pages/The-Elysia-Commune/index.tsx", import.meta.url), "utf8"));
const viteConfig = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../vite.config.ts", import.meta.url), "utf8"));
const missing = requiredRoutes.filter((route) => {
  if (route === "/") return !app.includes("<Route index");
  const path = route.replace(/^\//, "");
  const nestedPath = path.replace(/^marketplace\//, "");
  const legalPolicyRoute = path.startsWith("legal/") && app.includes(`path=\"legal/:slug\"`);
  const commonsSetupRoute = path.startsWith("commons-circle/setup/") && app.includes(`path=\"commons-circle/setup/:step\"`);
  const livingLibraryCategoryRoute = path.startsWith("living-library/browse/") && app.includes(`path=\"living-library/browse/:categorySlug\"`);
  const livingLibrarySourceRoute = path.startsWith("living-library/source/") && app.includes(`path=\"living-library/source/:sourceId\"`);
  return !(legalPolicyRoute || commonsSetupRoute || livingLibraryCategoryRoute || livingLibrarySourceRoute || app.includes(`path=\"${path}\"`) || app.includes(`path=\"${nestedPath}\"`) || app.includes(`to=\"${route}\"`) || app.includes(`target=\"${route}\"`));
});
if (missing.length) {
  console.error(`Missing route wiring: ${missing.join(", ")}`);
  process.exit(1);
}
if (!matchPath({ path: "commons-circle/:publicHandle" }, "/commons-circle/@bradley-harz")) {
  console.error("Commons Circle public profile route does not match /commons-circle/@username.");
  process.exit(1);
}
if (!matchPath({ path: "commons/:publicHandle" }, "/commons/@bradley-harz")) {
  console.error("Legacy Commons public profile route does not match /commons/@username.");
  process.exit(1);
}
if (!matchPath({ path: "commune/:roomSlug" }, "/commune/community-vote")) {
  console.error("Generic Commune room route does not match /commune/community-vote.");
  process.exit(1);
}
if (!matchPath({ path: "commune/rooms/:roomSlug" }, "/commune/rooms/community-vote")) {
  console.error("Generic Commune rooms route does not match /commune/rooms/community-vote.");
  process.exit(1);
}
if (!matchPath({ path: "commune/rooms", end: true }, "/commune/rooms")) {
  console.error("Commune rooms directory route does not match /commune/rooms.");
  process.exit(1);
}
if (!matchPath({ path: "commune/rooms/:roomSlug/posts" }, "/commune/rooms/community-vote/posts")) {
  console.error("Commune room posts route does not match /commune/rooms/community-vote/posts.");
  process.exit(1);
}
if (!matchPath({ path: "commune/rooms/:roomSlug/new" }, "/commune/rooms/community-vote/new")) {
  console.error("Commune room composer route does not match /commune/rooms/community-vote/new.");
  process.exit(1);
}
for (const [pattern, path, label] of [
  ["commune/rooms/:roomSlug", "/commune/rooms/repository-showcase", "hub"],
  ["commune/rooms/:roomSlug/new", "/commune/rooms/repository-showcase/new", "composer"],
  ["commune/rooms/:roomSlug/posts", "/commune/rooms/repository-showcase/posts", "posts feed"]
]) {
  if (!matchPath({ path: pattern }, path)) {
    console.error(`Repository Showcase ${label} route does not match ${path}.`);
    process.exit(1);
  }
}
if (!app.includes('path="commune/repository-showcase" element={<Navigate replace to="/commune/rooms/repository-showcase/new" />}')) {
  console.error("Legacy Repository Showcase composer route should redirect safely to the canonical /new route.");
  process.exit(1);
}
if (communePage.includes('routeMode === "repository-showcase" && <RepositoryShowcaseForm') || communePage.includes('"new", "repository-showcase", "troubleshooting"')) {
  console.error("Repository Showcase hub is still swallowed by the legacy specialized composer route mode.");
  process.exit(1);
}
if ((communePage.match(/<RepositoryShowcaseForm/g) ?? []).length !== 1 || !communePage.includes('if (type.backendValue === "repository_showcase") return <RepositoryShowcaseForm')) {
  console.error("Repository Showcase should reuse exactly one existing form instance through the shared room composer mode.");
  process.exit(1);
}
if (!communePage.includes("community_vote: \"community-vote\"")) {
  console.error("Community Voting Room should be mapped through roomSlugByPostType instead of requiring an explicit App route.");
  process.exit(1);
}
if (!communePage.includes('routeMode === "rooms-index"') || !communePage.includes("isRoomPosts") || !communePage.includes("roomPageMode")) {
  console.error("Commune page should explicitly distinguish rooms index, room posts, and room composer modes.");
  process.exit(1);
}
if (matchPath({ path: "commons-circle/@:username" }, "/commons-circle/@bradley-harz")) {
  console.error("Broken @:username route pattern unexpectedly matched; keep using :publicHandle with explicit @ parsing.");
  process.exit(1);
}
const redirects = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../public/_redirects", import.meta.url), "utf8"));
const notFoundDocument = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../public/404.html", import.meta.url), "utf8"));
if (/^\/\* \/(?:index\.html)? 200$/m.test(redirects)) {
  console.error("Global SPA fallback would return index.html for missing JavaScript and CSS assets.");
  process.exit(1);
}
if (/^\/assets\//m.test(redirects)) {
  console.error("Asset paths must not be rewritten; Cloudflare Pages redirects run even when a real asset exists.");
  process.exit(1);
}
if (!viteConfig.includes('const browserAssetNamespace = "safe-assets-v1"') || !viteConfig.includes("entryFileNames:") || !viteConfig.includes("chunkFileNames:")) {
  console.error("The safe asset namespace must keep entry and shared chunks outside the historically poisoned immutable-cache generation.");
  process.exit(1);
}
if (!notFoundDocument.includes("This path has not taken root.") || notFoundDocument.includes('id="root"') || /<script\b/i.test(notFoundDocument)) {
  console.error("The static 404 boundary must be visibly truthful and independent of the SPA runtime.");
  process.exit(1);
}
const spaRewriteSources = redirects
  .split(/\r?\n/)
  .map((line) => line.trim().split(/\s+/))
  .filter((parts) => parts.length === 3 && parts[1] === "/" && parts[2] === "200")
  .map(([source]) => source);
const uncoveredSpaRoutes = requiredRoutes.filter((route) => {
  if (route === "/" || route === "/artisan-collective") return false;
  return !spaRewriteSources.some((pattern) => matchPath({ path: pattern, end: true }, route));
});
if (uncoveredSpaRoutes.length) {
  console.error(`Cloudflare Pages lacks explicit SPA rewrites for: ${uncoveredSpaRoutes.join(", ")}`);
  process.exit(1);
}
for (const [legacy, canonical] of [
  ["/community-guidelines", "/legal/community-guidelines"],
  ["/work-with", "/work-with-elysia-ecobotics"],
]) {
  const redirect = `${legacy} ${canonical} 301`;
  if (!redirects.includes(redirect)) {
    console.error(`Missing canonical redirect: ${redirect}`);
    process.exit(1);
  }
}
if (!app.includes("function LegacyCommunicationAlias") || !app.includes("replace") || !app.includes("search: location.search") || !app.includes("hash: location.hash")) {
  console.error("Legacy communication routes must replace-navigate while preserving query and hash state.");
  process.exit(1);
}

const fs = await import("node:fs/promises");
async function readSourceFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dir);
    if (entry.isDirectory()) return readSourceFiles(child);
    if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) return [child];
    return [];
  }));
  return files.flat();
}
const canonicalScanRoots = [
  new URL("../src/pages/The-Elysia-Marketplace/", import.meta.url),
  new URL("../src/shared/", import.meta.url),
  new URL("../src/layouts/", import.meta.url)
];
const staleMarketplaceLinkPatterns = [
  'to="/browse"', 'to="/addons/', 'to="/action-preview"', 'to="/account"',
  'to="/submit"', 'to="/trust"', 'to="/manifest-api"', 'to="/admin"'
];
const staleHits = [];
for (const root of canonicalScanRoots) {
  for (const sourceFile of await readSourceFiles(root)) {
    const text = await fs.readFile(sourceFile, "utf8");
    for (const pattern of staleMarketplaceLinkPatterns) {
      if (text.includes(pattern)) staleHits.push(`${sourceFile.pathname}: ${pattern}`);
    }
  }
}
if (staleHits.length) {
  console.error(`Noncanonical Marketplace links found:\n${staleHits.join("\n")}`);
  process.exit(1);
}
console.log(`Route contract ok (${requiredRoutes.length} routes/aliases).`);
